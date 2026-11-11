-- Product approval, verified opening counts, reservation release, and private evidence.
-- Existing product and stock rows are never changed by this migration.

CREATE OR REPLACE FUNCTION public.erp_review_product(
  p_product_id UUID, p_name TEXT, p_category TEXT, p_description TEXT,
  p_local_price NUMERIC, p_is_active BOOLEAN, p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_before public.products%ROWTYPE;
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'manager') OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Only Admin or Manager can review products';
  END IF;
  IF NULLIF(TRIM(p_name), '') IS NULL OR NULLIF(TRIM(p_category), '') IS NULL
    OR NULLIF(TRIM(p_reason), '') IS NULL OR p_is_active IS NULL
    OR (p_local_price IS NOT NULL AND (p_local_price <= 0 OR p_local_price <> ROUND(p_local_price, 2)))
    OR (p_is_active AND p_local_price IS NULL) THEN
    RAISE EXCEPTION 'Enter product details, a reason, and an approved positive price before activation';
  END IF;
  SELECT * INTO v_before FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF v_before.name = TRIM(p_name) AND v_before.category = TRIM(p_category)
    AND v_before.description IS NOT DISTINCT FROM NULLIF(TRIM(p_description), '')
    AND v_before.local_price IS NOT DISTINCT FROM p_local_price
    AND v_before.is_active = p_is_active THEN
    RAISE EXCEPTION 'No product changes to save';
  END IF;
  UPDATE public.products SET name = TRIM(p_name), category = TRIM(p_category),
    description = NULLIF(TRIM(p_description), ''), local_price = p_local_price,
    is_active = p_is_active, updated_at = NOW() WHERE id = p_product_id;
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, old_values, new_values)
  VALUES (v_actor, 'PRODUCT_REVIEWED', 'products', p_product_id,
    jsonb_build_object('name', v_before.name, 'category', v_before.category,
      'description', v_before.description, 'local_price', v_before.local_price, 'is_active', v_before.is_active),
    jsonb_build_object('name', TRIM(p_name), 'category', TRIM(p_category),
      'description', NULLIF(TRIM(p_description), ''), 'local_price', p_local_price,
      'is_active', p_is_active, 'reason', TRIM(p_reason)));
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_create_draft_product(
  p_sku TEXT, p_name TEXT, p_category TEXT, p_description TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_id UUID;
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'manager') OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Only Admin or Manager can create products';
  END IF;
  IF NULLIF(TRIM(p_sku), '') IS NULL OR NULLIF(TRIM(p_name), '') IS NULL
    OR NULLIF(TRIM(p_category), '') IS NULL THEN
    RAISE EXCEPTION 'SKU, name, and category are required';
  END IF;
  INSERT INTO public.products (sku, name, category, description, is_active)
  VALUES (UPPER(TRIM(p_sku)), TRIM(p_name), TRIM(p_category),
    NULLIF(TRIM(p_description), ''), FALSE) RETURNING id INTO v_id;
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, new_values)
  VALUES (v_actor, 'PRODUCT_DRAFT_CREATED', 'products', v_id,
    jsonb_build_object('sku', UPPER(TRIM(p_sku)), 'name', TRIM(p_name)));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_apply_product_prices(
  p_prices JSONB, p_reason TEXT
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor UUID := auth.uid(); v_item JSONB; v_sku TEXT; v_price NUMERIC(12,2);
  v_before public.products%ROWTYPE; v_seen TEXT[] := ARRAY[]::TEXT[]; v_count INT := 0;
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'manager') OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Only Admin or Manager can approve prices';
  END IF;
  IF NULLIF(TRIM(p_reason), '') IS NULL OR p_prices IS NULL
    OR jsonb_typeof(p_prices) <> 'array' OR jsonb_array_length(p_prices) = 0 THEN
    RAISE EXCEPTION 'Enter prices and an approval reference';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_prices) LOOP
    v_sku := UPPER(TRIM(v_item->>'sku'));
    IF v_sku IS NULL OR v_sku = '' OR v_sku = ANY(v_seen)
      OR (v_item->>'price') !~ '^[0-9]+(\.[0-9]{1,2})?$' THEN
      RAISE EXCEPTION 'Each SKU needs one valid positive price with at most two decimals';
    END IF;
    v_seen := array_append(v_seen, v_sku);
    v_price := (v_item->>'price')::NUMERIC(12,2);
    IF v_price <= 0 THEN RAISE EXCEPTION 'Prices must be positive'; END IF;
    SELECT * INTO v_before FROM public.products WHERE sku = v_sku FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unknown SKU: %', v_sku; END IF;
    IF v_before.local_price IS NOT DISTINCT FROM v_price THEN CONTINUE; END IF;
    UPDATE public.products SET local_price = v_price, updated_at = NOW() WHERE id = v_before.id;
    INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, old_values, new_values)
    VALUES (v_actor, 'PRODUCT_PRICE_CHANGED', 'products', v_before.id,
      jsonb_build_object('local_price', v_before.local_price),
      jsonb_build_object('local_price', v_price, 'reason', TRIM(p_reason)));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE POLICY "Managers upload verified product photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'erp-product-images'
    AND (storage.foldername(name))[1] = 'products'
    AND public.current_staff_role() IN ('admin', 'manager'));

CREATE OR REPLACE FUNCTION public.erp_link_product_image(
  p_product_id UUID, p_storage_path TEXT, p_public_url TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_previous TEXT;
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'manager') OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Only Admin or Manager can link product images';
  END IF;
  IF p_storage_path NOT LIKE ('products/' || p_product_id::TEXT || '/%')
    OR p_public_url !~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/erp-product-images/'
    OR p_public_url NOT LIKE ('%/storage/v1/object/public/erp-product-images/' || p_storage_path)
    OR NOT EXISTS (SELECT 1 FROM storage.objects
      WHERE bucket_id = 'erp-product-images' AND name = p_storage_path) THEN
    RAISE EXCEPTION 'Upload a verified image for this product first';
  END IF;
  SELECT image_url INTO v_previous FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  UPDATE public.products SET image_url = p_public_url, updated_at = NOW() WHERE id = p_product_id;
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, old_values, new_values)
  VALUES (v_actor, 'PRODUCT_IMAGE_LINKED', 'products', p_product_id,
    jsonb_build_object('image_url', v_previous), jsonb_build_object('image_url', p_public_url));
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_post_opening_stock(
  p_items JSONB, p_reference TEXT
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor UUID := auth.uid(); v_item JSONB; v_product UUID; v_location UUID;
  v_quantity INT; v_count INT := 0; v_seen TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'manager') OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Only Admin or Manager can post opening stock';
  END IF;
  IF NULLIF(TRIM(p_reference), '') IS NULL OR p_items IS NULL
    OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Enter opening counts and a count-sheet reference';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_product := (v_item->>'product_id')::UUID;
    v_location := (v_item->>'location_id')::UUID;
    IF (v_item->>'quantity') !~ '^[0-9]+$' THEN
      RAISE EXCEPTION 'Opening quantity must be a non-negative whole number';
    END IF;
    v_quantity := (v_item->>'quantity')::INT;
    IF v_product IS NULL OR v_location IS NULL OR (v_product::TEXT || '/' || v_location::TEXT) = ANY(v_seen) THEN
      RAISE EXCEPTION 'Each product and area may appear once per count sheet';
    END IF;
    v_seen := array_append(v_seen, v_product::TEXT || '/' || v_location::TEXT);
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_product AND is_active AND local_price > 0)
      OR NOT EXISTS (SELECT 1 FROM public.locations WHERE id = v_location AND is_active) THEN
      RAISE EXCEPTION 'Opening count needs an approved product and active area';
    END IF;
    INSERT INTO public.stock_balances (product_id, location_id, sellable_on_hand)
    VALUES (v_product, v_location, v_quantity);
    IF v_quantity > 0 THEN
      INSERT INTO public.stock_movements (product_id, dest_location_id, movement_type,
        quantity, reference_no, reason, created_by)
      VALUES (v_product, v_location, 'receipt', v_quantity,
        TRIM(p_reference), 'Verified opening stock count', v_actor);
    END IF;
    INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, new_values)
    VALUES (v_actor, 'OPENING_STOCK_POSTED', 'products', v_product,
      jsonb_build_object('location_id', v_location, 'quantity', v_quantity, 'reference', TRIM(p_reference)));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_release_expired_reservation(
  p_reservation_id UUID, p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_hold public.reservations%ROWTYPE;
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'manager', 'showroom_sales') OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authorized to release a reservation';
  END IF;
  IF NULLIF(TRIM(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Reason is required'; END IF;
  SELECT * INTO v_hold FROM public.reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND OR v_hold.status <> 'active' OR v_hold.expires_at > NOW() THEN
    RAISE EXCEPTION 'Only an expired active reservation may be released';
  END IF;
  UPDATE public.stock_balances SET active_reserved = active_reserved - v_hold.quantity,
    updated_at = NOW() WHERE product_id = v_hold.product_id AND location_id = v_hold.location_id
    AND active_reserved >= v_hold.quantity;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation balance needs review'; END IF;
  UPDATE public.reservations SET status = 'expired', released_at = NOW(), released_by = v_actor
    WHERE id = p_reservation_id;
  INSERT INTO public.stock_movements (product_id, source_location_id, movement_type,
    quantity, reference_no, reason, created_by)
  VALUES (v_hold.product_id, v_hold.location_id, 'reservation_release', v_hold.quantity,
    p_reservation_id::TEXT, TRIM(p_reason), v_actor);
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, new_values)
  VALUES (v_actor, 'RESERVATION_EXPIRED_RELEASED', 'reservations', p_reservation_id,
    jsonb_build_object('quantity', v_hold.quantity, 'reason', TRIM(p_reason)));
END;
$$;

-- Payment and signed handover files are private. A reference can exist while
-- paper evidence is being scanned; attaching later never changes the ledger.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('erp-private-evidence', 'erp-private-evidence', FALSE, 10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.erp_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id) ON DELETE RESTRICT,
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.staff_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT erp_evidence_one_owner CHECK ((payment_id IS NULL) <> (delivery_id IS NULL))
);
CREATE UNIQUE INDEX erp_evidence_payment_once ON public.erp_evidence(payment_id) WHERE payment_id IS NOT NULL;
CREATE UNIQUE INDEX erp_evidence_delivery_once ON public.erp_evidence(delivery_id) WHERE delivery_id IS NOT NULL;
ALTER TABLE public.erp_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read ERP evidence records" ON public.erp_evidence FOR SELECT TO authenticated
  USING (public.current_staff_role() IS NOT NULL);
GRANT SELECT ON public.erp_evidence TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.erp_evidence FROM anon, authenticated;

CREATE POLICY "Finance uploads payment evidence" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'erp-private-evidence'
    AND (storage.foldername(name))[1] = 'payments'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::TEXT
    AND public.current_staff_role() = 'finance');
CREATE POLICY "Stock uploads signed handover" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'erp-private-evidence'
    AND (storage.foldername(name))[1] = 'handover'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::TEXT
    AND public.current_staff_role() IN ('admin', 'manager', 'stock_clerk'));
CREATE POLICY "ERP staff read private evidence" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'erp-private-evidence' AND public.current_staff_role() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.erp_attach_evidence(
  p_payment_id UUID, p_delivery_id UUID, p_storage_path TEXT,
  p_file_name TEXT, p_mime_type TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_id UUID; v_role public.staff_role;
BEGIN
  v_role := public.current_staff_role();
  IF v_actor IS NULL OR (p_payment_id IS NULL) = (p_delivery_id IS NULL)
    OR NULLIF(TRIM(p_storage_path), '') IS NULL OR NULLIF(TRIM(p_file_name), '') IS NULL
    OR p_mime_type NOT IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp') THEN
    RAISE EXCEPTION 'Choose one payment or delivery and a valid evidence file';
  END IF;
  IF p_payment_id IS NOT NULL THEN
    IF v_role <> 'finance' OR NOT EXISTS (SELECT 1 FROM public.payments WHERE id = p_payment_id)
      OR p_storage_path NOT LIKE ('payments/' || v_actor::TEXT || '/%') THEN
      RAISE EXCEPTION 'Only Finance can attach evidence to a recorded payment';
    END IF;
  ELSE
    IF v_role NOT IN ('admin', 'manager', 'stock_clerk')
      OR NOT EXISTS (SELECT 1 FROM public.deliveries WHERE id = p_delivery_id AND delivery_status = 'delivered')
      OR p_storage_path NOT LIKE ('handover/' || v_actor::TEXT || '/%') THEN
      RAISE EXCEPTION 'Signed handover must be recorded before its document is attached';
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects
    WHERE bucket_id = 'erp-private-evidence' AND name = p_storage_path) THEN
    RAISE EXCEPTION 'Uploaded evidence file was not found';
  END IF;
  INSERT INTO public.erp_evidence (payment_id, delivery_id, storage_path, file_name, mime_type, uploaded_by)
  VALUES (p_payment_id, p_delivery_id, p_storage_path, TRIM(p_file_name), p_mime_type, v_actor)
  RETURNING id INTO v_id;
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, new_values)
  VALUES (v_actor, 'ERP_EVIDENCE_ATTACHED', 'erp_evidence', v_id,
    jsonb_build_object('payment_id', p_payment_id, 'delivery_id', p_delivery_id,
      'storage_path', p_storage_path));
  RETURN v_id;
END;
$$;

-- Before any signed handover, a failed shipment physically returned to
-- quarantine may be cancelled and refunded by Finance. Existing signatures
-- remain an absolute block because delivery status is then 'delivered'.
CREATE OR REPLACE FUNCTION public.erp_refund_cancel_order(
  p_order_id UUID, p_reference TEXT, p_reason TEXT
) RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor UUID := auth.uid(); v_order public.sales_orders%ROWTYPE;
  v_payment public.payments%ROWTYPE; v_hold public.reservations%ROWTYPE;
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
  IF EXISTS (SELECT 1 FROM public.deliveries WHERE order_id = p_order_id
    AND delivery_status <> 'returned_for_review') THEN
    RAISE EXCEPTION 'Every dispatched item must return before refund; signed handover cannot be refunded';
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

REVOKE ALL ON FUNCTION public.erp_review_product(UUID, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.erp_create_draft_product(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.erp_apply_product_prices(JSONB, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.erp_link_product_image(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.erp_post_opening_stock(JSONB, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.erp_release_expired_reservation(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.erp_attach_evidence(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erp_review_product(UUID, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_create_draft_product(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_apply_product_prices(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_link_product_image(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_post_opening_stock(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_release_expired_reservation(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_attach_evidence(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
