-- Authenticated entry points for orders, Finance payments, and deposit holds.
-- Browser roles cannot write the underlying ledgers directly.

CREATE OR REPLACE FUNCTION public.erp_create_order(
  p_customer_name TEXT, p_customer_phone TEXT, p_showroom_id UUID,
  p_items JSONB, p_notes TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_order_id UUID;
  v_customer_id UUID;
  v_item JSONB;
  v_product_id UUID;
  v_quantity INT;
  v_price NUMERIC(12,2);
  v_total NUMERIC(12,2) := 0;
  v_seen UUID[] := ARRAY[]::UUID[];
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'manager', 'showroom_sales') OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authorized to create orders';
  END IF;
  IF NULLIF(TRIM(p_customer_name), '') IS NULL OR NULLIF(TRIM(p_customer_phone), '') IS NULL THEN
    RAISE EXCEPTION 'Customer name and phone are required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.locations WHERE id = p_showroom_id AND type = 'showroom' AND is_active) THEN
    RAISE EXCEPTION 'Choose an active showroom';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order needs at least one item';
  END IF;

  INSERT INTO public.customers (full_name, phone)
  VALUES (TRIM(p_customer_name), TRIM(p_customer_phone)) RETURNING id INTO v_customer_id;
  INSERT INTO public.sales_orders (order_number, customer_id, location_id, status, notes, created_by)
  VALUES ('MD-ORD-' || TO_CHAR(NOW(), 'YYYY') || '-' || UPPER(SUBSTR(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 12)),
          v_customer_id, p_showroom_id, 'draft', NULLIF(TRIM(p_notes), ''), v_actor)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INT;
    IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 OR v_product_id = ANY(v_seen) THEN
      RAISE EXCEPTION 'Each product must appear once with a positive whole quantity';
    END IF;
    v_seen := array_append(v_seen, v_product_id);
    SELECT local_price INTO v_price FROM public.products
      WHERE id = v_product_id AND is_active FOR SHARE;
    IF v_price IS NULL OR v_price <= 0 THEN
      RAISE EXCEPTION 'Product needs an approved local price before ordering';
    END IF;
    INSERT INTO public.sales_order_lines (order_id, product_id, quantity, unit_price)
    VALUES (v_order_id, v_product_id, v_quantity, v_price);
    v_total := v_total + v_quantity * v_price;
  END LOOP;

  UPDATE public.sales_orders SET subtotal = v_total, total_amount = v_total,
    status = 'confirmed', updated_at = NOW() WHERE id = v_order_id;
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, new_values)
  VALUES (v_actor, 'ORDER_CREATED', 'sales_orders', v_order_id, jsonb_build_object('total_amount', v_total));
  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_record_payment(
  p_order_id UUID, p_amount NUMERIC, p_method public.payment_method, p_reference TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_order public.sales_orders%ROWTYPE;
  v_payment_id UUID;
  v_new_paid NUMERIC(12,2);
BEGIN
  IF public.current_staff_role() IS DISTINCT FROM 'finance' OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Only Finance can record payments';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> ROUND(p_amount, 2)
     OR NULLIF(TRIM(p_reference), '') IS NULL OR p_method IS NULL THEN
    RAISE EXCEPTION 'Enter a valid amount, method, and reference';
  END IF;
  SELECT * INTO v_order FROM public.sales_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.status IN ('cancelled', 'delivered', 'dispatched', 'partially_dispatched') THEN
    RAISE EXCEPTION 'Order is not open for payment';
  END IF;
  IF p_amount > v_order.balance_due THEN
    RAISE EXCEPTION 'Payment exceeds the order balance';
  END IF;
  IF EXISTS (SELECT 1 FROM public.payments WHERE LOWER(TRIM(reference_no)) = LOWER(TRIM(p_reference))) THEN
    RAISE EXCEPTION 'Payment reference already recorded';
  END IF;
  INSERT INTO public.payments (order_id, amount, payment_method, reference_no, recorded_by)
  VALUES (p_order_id, p_amount, p_method, TRIM(p_reference), v_actor) RETURNING id INTO v_payment_id;
  v_new_paid := v_order.paid_amount + p_amount;
  UPDATE public.sales_orders SET paid_amount = v_new_paid,
    status = CASE WHEN v_new_paid = v_order.total_amount THEN 'paid'::public.order_status ELSE 'partially_paid'::public.order_status END,
    updated_at = NOW() WHERE id = p_order_id;
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, new_values)
  VALUES (v_actor, 'PAYMENT_RECORDED', 'payments', v_payment_id, jsonb_build_object('order_id', p_order_id, 'amount', p_amount, 'reference_no', TRIM(p_reference)));
  RETURN v_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_create_reservation(
  p_line_id UUID, p_location_id UUID, p_quantity INT,
  p_review_at TIMESTAMPTZ, p_expires_at TIMESTAMPTZ
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_order public.sales_orders%ROWTYPE;
  v_line public.sales_order_lines%ROWTYPE;
  v_balance public.stock_balances%ROWTYPE;
  v_reservation_id UUID;
  v_released INT;
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'manager', 'showroom_sales') OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authorized to reserve stock';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR p_review_at IS NULL OR p_expires_at IS NULL
     OR p_review_at <= NOW() OR p_review_at > p_expires_at THEN
    RAISE EXCEPTION 'Enter valid quantity, review date, and collection date';
  END IF;
  SELECT * INTO v_line FROM public.sales_order_lines WHERE id = p_line_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order line not found'; END IF;
  SELECT * INTO v_order FROM public.sales_orders WHERE id = v_line.order_id FOR UPDATE;
  IF v_order.status IN ('cancelled', 'delivered') OR v_order.paid_amount <= 0 THEN
    RAISE EXCEPTION 'Finance must record a deposit on an open order first';
  END IF;
  SELECT COALESCE(SUM(quantity), 0) INTO v_released FROM public.deliveries
    WHERE line_id = p_line_id AND delivery_status <> 'returned_for_review';
  IF p_quantity > v_line.quantity - v_released THEN
    RAISE EXCEPTION 'Reservation exceeds the undelivered quantity';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reservations WHERE order_id = v_order.id AND product_id = v_line.product_id AND status = 'active') THEN
    RAISE EXCEPTION 'This item already has an active reservation';
  END IF;
  SELECT * INTO v_balance FROM public.stock_balances
    WHERE product_id = v_line.product_id AND location_id = p_location_id FOR UPDATE;
  IF NOT FOUND OR v_balance.sellable_on_hand - v_balance.active_reserved < p_quantity THEN
    RAISE EXCEPTION 'Insufficient unreserved stock in the selected area';
  END IF;
  UPDATE public.stock_balances SET active_reserved = active_reserved + p_quantity, updated_at = NOW()
    WHERE product_id = v_line.product_id AND location_id = p_location_id;
  INSERT INTO public.reservations (order_id, product_id, location_id, quantity, review_at, expires_at)
  VALUES (v_order.id, v_line.product_id, p_location_id, p_quantity, p_review_at, p_expires_at)
  RETURNING id INTO v_reservation_id;
  INSERT INTO public.stock_movements (product_id, source_location_id, movement_type, quantity, reference_no, reason, created_by)
  VALUES (v_line.product_id, p_location_id, 'reservation_hold', p_quantity, v_order.order_number, 'Deposit reservation', v_actor);
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, new_values)
  VALUES (v_actor, 'RESERVATION_CREATED', 'reservations', v_reservation_id,
    jsonb_build_object('review_at', p_review_at, 'expires_at', p_expires_at, 'quantity', p_quantity));
  RETURN v_reservation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_extend_reservation(
  p_reservation_id UUID, p_review_at TIMESTAMPTZ, p_expires_at TIMESTAMPTZ, p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_reservation public.reservations%ROWTYPE;
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'manager', 'showroom_sales') OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authorized to extend reservations';
  END IF;
  IF NULLIF(TRIM(p_reason), '') IS NULL OR p_review_at IS NULL OR p_expires_at IS NULL
     OR p_review_at <= NOW() OR p_review_at > p_expires_at THEN
    RAISE EXCEPTION 'Enter a reason and valid future dates';
  END IF;
  SELECT * INTO v_reservation FROM public.reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_reservation.status <> 'active' THEN RAISE EXCEPTION 'Active reservation not found'; END IF;
  UPDATE public.reservations SET review_at = p_review_at, expires_at = p_expires_at WHERE id = p_reservation_id;
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, old_values, new_values)
  VALUES (v_actor, 'RESERVATION_EXTENDED', 'reservations', p_reservation_id,
    jsonb_build_object('review_at', v_reservation.review_at, 'expires_at', v_reservation.expires_at),
    jsonb_build_object('review_at', p_review_at, 'expires_at', p_expires_at, 'reason', TRIM(p_reason)));
END;
$$;

REVOKE ALL ON FUNCTION public.erp_create_order(TEXT, TEXT, UUID, JSONB, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.erp_record_payment(UUID, NUMERIC, public.payment_method, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.erp_create_reservation(UUID, UUID, INT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.erp_extend_reservation(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erp_create_order(TEXT, TEXT, UUID, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_record_payment(UUID, NUMERIC, public.payment_method, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_create_reservation(UUID, UUID, INT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_extend_reservation(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
