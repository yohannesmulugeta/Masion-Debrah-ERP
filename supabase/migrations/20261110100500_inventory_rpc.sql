-- Authenticated receipt and room transfer operations. References prevent
-- accidental duplicate posting of the same product movement.
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_receipt_transfer_reference
  ON public.stock_movements (
    movement_type, LOWER(TRIM(reference_no)), product_id,
    COALESCE(source_location_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(dest_location_id, '00000000-0000-0000-0000-000000000000'::UUID)
  ) WHERE movement_type IN ('receipt', 'transfer_out', 'transfer_in');

CREATE OR REPLACE FUNCTION public.erp_post_receipt(
  p_product_id UUID, p_quantity INT, p_reference TEXT, p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_warehouse UUID;
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'manager', 'stock_clerk') OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authorized to receive stock';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR NULLIF(TRIM(p_reference), '') IS NULL
     OR NULLIF(TRIM(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Enter positive quantity, reference, and reason';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND is_active) THEN
    RAISE EXCEPTION 'Active product not found';
  END IF;
  SELECT id INTO v_warehouse FROM public.locations WHERE code = 'WH' AND type = 'warehouse' AND is_active;
  IF v_warehouse IS NULL THEN RAISE EXCEPTION 'Warehouse is not configured'; END IF;
  IF EXISTS (SELECT 1 FROM public.stock_movements WHERE movement_type = 'receipt'
    AND product_id = p_product_id AND dest_location_id = v_warehouse
    AND LOWER(TRIM(reference_no)) = LOWER(TRIM(p_reference))) THEN
    RAISE EXCEPTION 'Receipt reference already posted for this product';
  END IF;
  INSERT INTO public.stock_balances (product_id, location_id, sellable_on_hand)
  VALUES (p_product_id, v_warehouse, p_quantity)
  ON CONFLICT (product_id, location_id) DO UPDATE SET
    sellable_on_hand = public.stock_balances.sellable_on_hand + EXCLUDED.sellable_on_hand,
    updated_at = NOW();
  INSERT INTO public.stock_movements (product_id, dest_location_id, movement_type,
    quantity, reference_no, reason, created_by)
  VALUES (p_product_id, v_warehouse, 'receipt', p_quantity, TRIM(p_reference), TRIM(p_reason), v_actor);
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, new_values)
  VALUES (v_actor, 'STOCK_RECEIVED', 'products', p_product_id,
    jsonb_build_object('quantity', p_quantity, 'reference', TRIM(p_reference)));
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_post_transfer(
  p_product_id UUID, p_source UUID, p_destination UUID,
  p_quantity INT, p_reference TEXT, p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid();
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'manager', 'stock_clerk') OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authorized to transfer stock';
  END IF;
  IF p_source IS NULL OR p_destination IS NULL OR p_source = p_destination
     OR p_quantity IS NULL OR p_quantity <= 0
     OR NULLIF(TRIM(p_reference), '') IS NULL OR NULLIF(TRIM(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Enter distinct areas, positive quantity, reference, and reason';
  END IF;
  IF (SELECT COUNT(*) FROM public.locations WHERE id IN (p_source, p_destination) AND is_active) <> 2 THEN
    RAISE EXCEPTION 'Source and destination must be active areas';
  END IF;
  UPDATE public.stock_balances SET sellable_on_hand = sellable_on_hand - p_quantity,
    updated_at = NOW() WHERE product_id = p_product_id AND location_id = p_source
    AND sellable_on_hand - active_reserved >= p_quantity;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient unreserved stock at source'; END IF;
  INSERT INTO public.stock_balances (product_id, location_id, sellable_on_hand)
  VALUES (p_product_id, p_destination, p_quantity)
  ON CONFLICT (product_id, location_id) DO UPDATE SET
    sellable_on_hand = public.stock_balances.sellable_on_hand + EXCLUDED.sellable_on_hand,
    updated_at = NOW();
  INSERT INTO public.stock_movements (product_id, source_location_id, movement_type,
    quantity, reference_no, reason, created_by)
  VALUES (p_product_id, p_source, 'transfer_out', p_quantity, TRIM(p_reference), TRIM(p_reason), v_actor);
  INSERT INTO public.stock_movements (product_id, source_location_id, dest_location_id, movement_type,
    quantity, reference_no, reason, created_by)
  VALUES (p_product_id, p_source, p_destination, 'transfer_in', p_quantity,
    TRIM(p_reference), TRIM(p_reason), v_actor);
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, new_values)
  VALUES (v_actor, 'STOCK_TRANSFERRED', 'products', p_product_id,
    jsonb_build_object('quantity', p_quantity, 'source', p_source, 'destination', p_destination, 'reference', TRIM(p_reference)));
END;
$$;

REVOKE ALL ON FUNCTION public.erp_post_receipt(UUID, INT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.erp_post_transfer(UUID, UUID, UUID, INT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erp_post_receipt(UUID, INT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_post_transfer(UUID, UUID, UUID, INT, TEXT, TEXT) TO authenticated;
