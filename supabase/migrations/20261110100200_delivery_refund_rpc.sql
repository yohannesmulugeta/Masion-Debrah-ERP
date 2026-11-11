-- Item-level dispatch, signed delivery, failed-delivery return, and Finance refund.

CREATE OR REPLACE FUNCTION public.erp_dispatch_line(
  p_line_id UUID, p_quantity INT, p_location_id UUID, p_address TEXT,
  p_recipient TEXT, p_phone TEXT, p_request_key UUID
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_line public.sales_order_lines%ROWTYPE;
  v_order public.sales_orders%ROWTYPE;
  v_hold public.reservations%ROWTYPE;
  v_balance public.stock_balances%ROWTYPE;
  v_released INT;
  v_total INT;
  v_dispatch_id UUID;
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'manager', 'stock_clerk') OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authorized to dispatch stock';
  END IF;
  IF p_request_key IS NULL OR p_quantity IS NULL OR p_quantity <= 0
     OR NULLIF(TRIM(p_address), '') IS NULL OR NULLIF(TRIM(p_recipient), '') IS NULL
     OR NULLIF(TRIM(p_phone), '') IS NULL THEN
    RAISE EXCEPTION 'Enter valid item, recipient, phone, address, and request key';
  END IF;
  SELECT id INTO v_dispatch_id FROM public.deliveries WHERE request_key = p_request_key;
  IF FOUND THEN RETURN v_dispatch_id; END IF;
  SELECT * INTO v_line FROM public.sales_order_lines WHERE id = p_line_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order line not found'; END IF;
  SELECT * INTO v_order FROM public.sales_orders WHERE id = v_line.order_id FOR UPDATE;
  SELECT id INTO v_dispatch_id FROM public.deliveries WHERE request_key = p_request_key;
  IF FOUND THEN RETURN v_dispatch_id; END IF;
  IF v_order.status IN ('cancelled', 'delivered') OR v_order.balance_due <> 0
     OR v_order.paid_amount <> v_order.total_amount THEN
    RAISE EXCEPTION 'Finance must confirm the full order balance before dispatch';
  END IF;
  SELECT COALESCE(SUM(quantity), 0) INTO v_released FROM public.deliveries
    WHERE line_id = p_line_id AND delivery_status <> 'returned_for_review';
  IF p_quantity > v_line.quantity - v_released THEN
    RAISE EXCEPTION 'Quantity exceeds the unshipped order line';
  END IF;
  IF (SELECT COUNT(*) FROM public.reservations
      WHERE order_id = v_order.id AND product_id = v_line.product_id AND status = 'active') > 1 THEN
    RAISE EXCEPTION 'Multiple active reservations need review';
  END IF;
  SELECT * INTO v_hold FROM public.reservations
    WHERE order_id = v_order.id AND product_id = v_line.product_id AND status = 'active'
    FOR UPDATE;
  IF FOUND AND (v_hold.location_id <> p_location_id OR v_hold.expires_at <= NOW() OR v_hold.quantity < p_quantity) THEN
    RAISE EXCEPTION 'Reserved location, date, or quantity needs review';
  END IF;
  SELECT * INTO v_balance FROM public.stock_balances
    WHERE product_id = v_line.product_id AND location_id = p_location_id FOR UPDATE;
  IF NOT FOUND OR v_balance.sellable_on_hand < p_quantity
     OR (v_hold.id IS NOT NULL AND v_balance.active_reserved < p_quantity)
     OR (v_hold.id IS NULL AND v_balance.sellable_on_hand - v_balance.active_reserved < p_quantity) THEN
    RAISE EXCEPTION 'Insufficient available stock at the selected area';
  END IF;
  UPDATE public.stock_balances SET sellable_on_hand = sellable_on_hand - p_quantity,
    active_reserved = active_reserved - CASE WHEN v_hold.id IS NULL THEN 0 ELSE p_quantity END,
    updated_at = NOW()
    WHERE product_id = v_line.product_id AND location_id = p_location_id;
  IF v_hold.id IS NOT NULL THEN
    UPDATE public.reservations SET quantity = quantity - p_quantity,
      status = CASE WHEN quantity = p_quantity THEN 'fulfilled'::public.reservation_status ELSE status END,
      released_at = CASE WHEN quantity = p_quantity THEN NOW() ELSE released_at END,
      released_by = CASE WHEN quantity = p_quantity THEN v_actor ELSE released_by END
      WHERE id = v_hold.id;
  END IF;
  INSERT INTO public.deliveries (order_id, line_id, product_id, quantity,
    source_location_id, request_key, dispatch_date, delivery_status,
    recipient_name, recipient_phone, delivery_address, dispatched_by)
  VALUES (v_order.id, p_line_id, v_line.product_id, p_quantity, p_location_id,
    p_request_key, NOW(), 'out_for_delivery', TRIM(p_recipient), TRIM(p_phone), TRIM(p_address), v_actor)
  RETURNING id INTO v_dispatch_id;
  INSERT INTO public.stock_movements (product_id, source_location_id, movement_type,
    quantity, reference_no, reason, created_by)
  VALUES (v_line.product_id, p_location_id, 'sale_fulfilment', p_quantity,
    v_dispatch_id::TEXT, 'Order dispatch ' || v_order.order_number, v_actor);
  SELECT COALESCE(SUM(quantity), 0) INTO v_total FROM public.sales_order_lines WHERE order_id = v_order.id;
  SELECT COALESCE(SUM(quantity), 0) INTO v_released FROM public.deliveries
    WHERE order_id = v_order.id AND delivery_status <> 'returned_for_review';
  UPDATE public.sales_orders SET status = CASE WHEN v_released = v_total
      THEN 'dispatched'::public.order_status ELSE 'partially_dispatched'::public.order_status END,
    updated_at = NOW() WHERE id = v_order.id;
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, new_values)
  VALUES (v_actor, 'ORDER_LINE_DISPATCHED', 'deliveries', v_dispatch_id,
    jsonb_build_object('line_id', p_line_id, 'quantity', p_quantity, 'location_id', p_location_id));
  RETURN v_dispatch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_confirm_delivery(
  p_delivery_id UUID, p_signed_by TEXT, p_signed_reference TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_delivery public.deliveries%ROWTYPE;
  v_total INT;
  v_signed INT;
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'manager', 'stock_clerk') OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authorized to confirm delivery';
  END IF;
  IF NULLIF(TRIM(p_signed_by), '') IS NULL OR NULLIF(TRIM(p_signed_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Signed recipient and document reference are required';
  END IF;
  SELECT * INTO v_delivery FROM public.deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND OR v_delivery.delivery_status <> 'out_for_delivery' THEN
    RAISE EXCEPTION 'An open dispatch was not found';
  END IF;
  UPDATE public.deliveries SET delivery_status = 'delivered', delivered_at = NOW(),
    signed_by = TRIM(p_signed_by), signed_reference = TRIM(p_signed_reference)
    WHERE id = p_delivery_id;
  SELECT COALESCE(SUM(quantity), 0) INTO v_total FROM public.sales_order_lines WHERE order_id = v_delivery.order_id;
  SELECT COALESCE(SUM(quantity), 0) INTO v_signed FROM public.deliveries
    WHERE order_id = v_delivery.order_id AND delivery_status = 'delivered';
  IF v_total > 0 AND v_total = v_signed THEN
    UPDATE public.sales_orders SET status = 'delivered', updated_at = NOW() WHERE id = v_delivery.order_id;
  END IF;
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, new_values)
  VALUES (v_actor, 'DELIVERY_SIGNED', 'deliveries', p_delivery_id,
    jsonb_build_object('signed_by', TRIM(p_signed_by), 'reference', TRIM(p_signed_reference)));
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_fail_delivery(p_delivery_id UUID, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_delivery public.deliveries%ROWTYPE;
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'manager', 'stock_clerk') OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authorized to record failed delivery';
  END IF;
  IF NULLIF(TRIM(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Reason is required'; END IF;
  SELECT * INTO v_delivery FROM public.deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND OR v_delivery.delivery_status <> 'out_for_delivery' THEN
    RAISE EXCEPTION 'An open dispatch was not found';
  END IF;
  UPDATE public.deliveries SET delivery_status = 'failed', failure_reason = TRIM(p_reason) WHERE id = p_delivery_id;
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, new_values)
  VALUES (v_actor, 'DELIVERY_FAILED', 'deliveries', p_delivery_id, jsonb_build_object('reason', TRIM(p_reason)));
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_receive_failed_delivery(p_delivery_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_delivery public.deliveries%ROWTYPE; v_total INT; v_released INT;
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'manager', 'stock_clerk') OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authorized to receive returned goods';
  END IF;
  SELECT * INTO v_delivery FROM public.deliveries WHERE id = p_delivery_id FOR UPDATE;
  IF NOT FOUND OR v_delivery.delivery_status <> 'failed' THEN
    RAISE EXCEPTION 'A failed delivery awaiting return was not found';
  END IF;
  UPDATE public.stock_balances SET quarantine_count = quarantine_count + v_delivery.quantity,
    updated_at = NOW() WHERE product_id = v_delivery.product_id AND location_id = v_delivery.source_location_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Original stock area not found'; END IF;
  UPDATE public.deliveries SET delivery_status = 'returned_for_review', returned_at = NOW() WHERE id = p_delivery_id;
  INSERT INTO public.stock_movements (product_id, dest_location_id, movement_type,
    quantity, reference_no, reason, created_by)
  VALUES (v_delivery.product_id, v_delivery.source_location_id, 'delivery_return_quarantine',
    v_delivery.quantity, p_delivery_id::TEXT, 'Failed delivery returned for inspection', v_actor);
  SELECT COALESCE(SUM(quantity), 0) INTO v_total FROM public.sales_order_lines WHERE order_id = v_delivery.order_id;
  SELECT COALESCE(SUM(quantity), 0) INTO v_released FROM public.deliveries
    WHERE order_id = v_delivery.order_id AND delivery_status <> 'returned_for_review';
  UPDATE public.sales_orders SET status = CASE WHEN v_released = 0 THEN 'paid'::public.order_status
    WHEN v_released = v_total THEN 'dispatched'::public.order_status
    ELSE 'partially_dispatched'::public.order_status END,
    updated_at = NOW() WHERE id = v_delivery.order_id;
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, new_values)
  VALUES (v_actor, 'FAILED_DELIVERY_RECEIVED', 'deliveries', p_delivery_id,
    jsonb_build_object('quarantine_quantity', v_delivery.quantity));
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_refund_cancel_order(
  p_order_id UUID, p_reference TEXT, p_reason TEXT
) RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_order public.sales_orders%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_hold public.reservations%ROWTYPE;
  v_amount NUMERIC(12,2);
BEGIN
  IF public.current_staff_role() IS DISTINCT FROM 'finance' OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Only Finance can record refunds';
  END IF;
  IF NULLIF(TRIM(p_reference), '') IS NULL OR NULLIF(TRIM(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Refund reference and reason are required';
  END IF;
  SELECT * INTO v_order FROM public.sales_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status = 'cancelled' THEN RAISE EXCEPTION 'Open order not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.deliveries WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'Dispatched orders require delivery review before refund';
  END IF;
  IF EXISTS (SELECT 1 FROM public.refunds WHERE order_id = p_order_id) THEN
    RAISE EXCEPTION 'Refund already recorded for this order';
  END IF;
  SELECT COALESCE(SUM(amount), 0) INTO v_amount FROM public.payments WHERE order_id = p_order_id;
  IF v_amount <= 0 OR v_amount <> v_order.paid_amount THEN
    RAISE EXCEPTION 'Payment totals need Finance review';
  END IF;
  FOR v_hold IN SELECT * FROM public.reservations WHERE order_id = p_order_id AND status = 'active' FOR UPDATE LOOP
    UPDATE public.stock_balances SET active_reserved = active_reserved - v_hold.quantity,
      updated_at = NOW() WHERE product_id = v_hold.product_id AND location_id = v_hold.location_id
      AND active_reserved >= v_hold.quantity;
    IF NOT FOUND THEN RAISE EXCEPTION 'Reservation balance needs review'; END IF;
    UPDATE public.reservations SET status = 'cancelled', released_at = NOW(), released_by = v_actor WHERE id = v_hold.id;
    INSERT INTO public.stock_movements (product_id, dest_location_id, movement_type,
      quantity, reference_no, reason, created_by)
    VALUES (v_hold.product_id, v_hold.location_id, 'reservation_release', v_hold.quantity,
      TRIM(p_reference), 'Reservation released after Finance refund', v_actor);
  END LOOP;
  FOR v_payment IN SELECT * FROM public.payments WHERE order_id = p_order_id LOOP
    INSERT INTO public.refunds (payment_id, order_id, amount, reason, approved_by, reference_no)
    VALUES (v_payment.id, p_order_id, v_payment.amount, TRIM(p_reason), v_actor, TRIM(p_reference));
  END LOOP;
  UPDATE public.sales_orders SET status = 'cancelled', updated_at = NOW() WHERE id = p_order_id;
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, new_values)
  VALUES (v_actor, 'ORDER_REFUNDED_CANCELLED', 'sales_orders', p_order_id,
    jsonb_build_object('amount', v_amount, 'reference', TRIM(p_reference), 'reason', TRIM(p_reason)));
  RETURN v_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.erp_dispatch_line(UUID, INT, UUID, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.erp_confirm_delivery(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.erp_fail_delivery(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.erp_receive_failed_delivery(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.erp_refund_cancel_order(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erp_dispatch_line(UUID, INT, UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_confirm_delivery(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_fail_delivery(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_receive_failed_delivery(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_refund_cancel_order(UUID, TEXT, TEXT) TO authenticated;
