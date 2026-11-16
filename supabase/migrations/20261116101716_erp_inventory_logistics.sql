-- Staged stock movements, warehouse attachments and delivery assignments.
ALTER TABLE public.stock_movements
  ADD COLUMN supplier_name text,
  ADD COLUMN receipt_document_path text,
  ADD COLUMN receipt_document_name text;

ALTER TABLE public.deliveries
  ADD COLUMN carrier_name text,
  ADD COLUMN planned_delivery_date date;

CREATE TABLE public.erp_room_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  source_id uuid NOT NULL REFERENCES public.locations(id),
  destination_id uuid NOT NULL REFERENCES public.locations(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  reference text NOT NULL CHECK (btrim(reference) <> ''),
  notes text NOT NULL,
  dispatched_at timestamptz NOT NULL DEFAULT now(),
  dispatched_by uuid NOT NULL REFERENCES public.staff_profiles(id),
  received_quantity integer CHECK (received_quantity BETWEEN 0 AND quantity),
  discrepancy text,
  received_at timestamptz,
  received_by uuid REFERENCES public.staff_profiles(id),
  CHECK (source_id <> destination_id),
  CHECK ((received_at IS NULL AND received_quantity IS NULL AND received_by IS NULL) OR
         (received_at IS NOT NULL AND received_quantity IS NOT NULL AND received_by IS NOT NULL)),
  CHECK (received_quantity IS NULL OR received_quantity = quantity OR nullif(btrim(discrepancy), '') IS NOT NULL)
);
CREATE UNIQUE INDEX erp_room_transfer_reference ON public.erp_room_transfers
  (product_id, source_id, destination_id, lower(btrim(reference)));
ALTER TABLE public.erp_room_transfers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.erp_room_transfers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.erp_room_transfers TO anon, authenticated;
CREATE POLICY "Staff read room transfers" ON public.erp_room_transfers FOR SELECT TO authenticated
  USING ((SELECT public.current_staff_role()) IS NOT NULL);
CREATE POLICY "Test room transfer reads" ON public.erp_room_transfers FOR SELECT TO anon, authenticated
  USING ((SELECT erp_testing.is_enabled()));

CREATE FUNCTION public.erp_send_room_transfer(p_product uuid, p_source uuid, p_destination uuid,
  p_quantity integer, p_reference text, p_notes text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := erp_testing.actor(); transfer_id uuid;
BEGIN
  IF actor IS NULL OR NOT COALESCE(erp_testing.workflow_role('stock_clerk') IN ('admin', 'manager', 'stock_clerk'), false) THEN
    RAISE EXCEPTION 'Not authorized to dispatch transfers';
  END IF;
  IF p_source = p_destination OR (SELECT count(*) FROM public.locations
      WHERE id IN (p_source, p_destination) AND is_active) <> 2
     OR p_quantity IS NULL OR p_quantity <= 0 OR nullif(btrim(p_reference), '') IS NULL THEN
    RAISE EXCEPTION 'Choose two active areas, a positive quantity and a transfer reference';
  END IF;
  INSERT INTO public.erp_room_transfers(product_id, source_id, destination_id, quantity, reference, notes, dispatched_by)
  VALUES (p_product, p_source, p_destination, p_quantity, btrim(p_reference), coalesce(btrim(p_notes), ''), actor)
  RETURNING id INTO transfer_id;
  UPDATE public.stock_balances SET sellable_on_hand = sellable_on_hand - p_quantity, updated_at = now()
  WHERE product_id = p_product AND location_id = p_source AND sellable_on_hand - active_reserved >= p_quantity;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient unreserved stock at source'; END IF;
  INSERT INTO public.stock_movements (product_id, source_location_id, movement_type, quantity, reference_no, reason, created_by)
  VALUES (p_product, p_source, 'transfer_out', p_quantity, 'Room transfer ' || transfer_id, btrim(p_reference), actor);
  RETURN transfer_id;
END;
$$;

CREATE FUNCTION public.erp_receive_room_transfer(p_transfer uuid, p_quantity integer, p_discrepancy text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := erp_testing.actor(); transfer public.erp_room_transfers%ROWTYPE;
BEGIN
  IF actor IS NULL OR NOT COALESCE(erp_testing.workflow_role('stock_clerk') IN ('admin', 'manager', 'stock_clerk'), false) THEN
    RAISE EXCEPTION 'Not authorized to receive transfers';
  END IF;
  SELECT * INTO transfer FROM public.erp_room_transfers WHERE id = p_transfer FOR UPDATE;
  IF NOT FOUND OR transfer.received_at IS NOT NULL THEN RAISE EXCEPTION 'Transfer is missing or already received'; END IF;
  IF p_quantity IS NULL OR p_quantity < 0 OR p_quantity > transfer.quantity
     OR (p_quantity < transfer.quantity AND nullif(btrim(p_discrepancy), '') IS NULL) THEN
    RAISE EXCEPTION 'Enter the sellable units received and explain any shortage or damage';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.locations WHERE id = transfer.destination_id AND is_active) THEN
    RAISE EXCEPTION 'Destination area is inactive';
  END IF;
  IF p_quantity > 0 THEN
    INSERT INTO public.stock_balances (product_id, location_id, sellable_on_hand)
    VALUES (transfer.product_id, transfer.destination_id, p_quantity)
    ON CONFLICT (product_id, location_id) DO UPDATE SET
      sellable_on_hand = public.stock_balances.sellable_on_hand + excluded.sellable_on_hand, updated_at = now();
    INSERT INTO public.stock_movements (product_id, source_location_id, dest_location_id, movement_type,
      quantity, reference_no, reason, created_by)
    VALUES (transfer.product_id, transfer.source_id, transfer.destination_id, 'transfer_in',
      p_quantity, 'Room transfer ' || transfer.id, transfer.reference, actor);
  END IF;
  UPDATE public.erp_room_transfers SET received_quantity = p_quantity, received_at = now(), received_by = actor,
    discrepancy = nullif(btrim(p_discrepancy), '') WHERE id = p_transfer;
END;
$$;

CREATE POLICY "Upload warehouse receipt documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'erp-private-evidence' AND (storage.foldername(name))[1] = 'warehouse-receipts'
    AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
    AND (SELECT public.current_staff_role()) IN ('admin', 'manager', 'stock_clerk'));
CREATE POLICY "Read warehouse receipt documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'erp-private-evidence' AND (storage.foldername(name))[1] = 'warehouse-receipts'
    AND (SELECT public.current_staff_role()) IN ('admin', 'manager', 'stock_clerk'));
CREATE POLICY "Test warehouse receipt uploads" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'erp-private-evidence' AND (storage.foldername(name))[1] = 'warehouse-receipts'
    AND (SELECT erp_testing.is_enabled()));
CREATE POLICY "Test warehouse receipt reads" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'erp-private-evidence' AND (storage.foldername(name))[1] = 'warehouse-receipts'
    AND (SELECT erp_testing.is_enabled()));

CREATE FUNCTION public.erp_receive_warehouse(p_product uuid, p_quantity integer, p_reference text,
  p_supplier text, p_notes text, p_document_path text, p_document_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := erp_testing.actor(); warehouse uuid; movement uuid;
BEGIN
  IF actor IS NULL OR NOT COALESCE(erp_testing.workflow_role('stock_clerk') IN ('admin', 'manager', 'stock_clerk'), false) THEN
    RAISE EXCEPTION 'Not authorized to receive warehouse stock';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 OR nullif(btrim(p_reference), '') IS NULL
     OR nullif(btrim(p_supplier), '') IS NULL THEN
    RAISE EXCEPTION 'Enter supplier, document reference and a positive quantity';
  END IF;
  IF nullif(p_document_path, '') IS NOT NULL AND
    (p_document_path NOT LIKE ('warehouse-receipts/' || actor::text || '/%')
      OR nullif(btrim(p_document_name), '') IS NULL
      OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'erp-private-evidence' AND name = p_document_path)) THEN
    RAISE EXCEPTION 'Receipt attachment is missing or inaccessible';
  END IF;
  SELECT id INTO warehouse FROM public.locations WHERE code = 'WH' AND type = 'warehouse' AND is_active;
  IF warehouse IS NULL THEN RAISE EXCEPTION 'Warehouse is not configured'; END IF;
  INSERT INTO public.stock_movements (product_id, dest_location_id, movement_type, quantity, reference_no, reason,
    created_by, supplier_name, receipt_document_path, receipt_document_name)
  VALUES (p_product, warehouse, 'receipt', p_quantity, btrim(p_reference),
    coalesce(nullif(btrim(p_notes), ''), 'Warehouse receipt'), actor, btrim(p_supplier),
    nullif(p_document_path, ''), nullif(p_document_name, '')) RETURNING id INTO movement;
  INSERT INTO public.stock_balances (product_id, location_id, sellable_on_hand)
  VALUES (p_product, warehouse, p_quantity)
  ON CONFLICT (product_id, location_id) DO UPDATE SET
    sellable_on_hand = public.stock_balances.sellable_on_hand + excluded.sellable_on_hand, updated_at = now();
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, new_values)
  VALUES (actor, 'STOCK_RECEIVED', 'products', p_product,
    jsonb_build_object('movement_id', movement, 'quantity', p_quantity, 'reference', btrim(p_reference)));
  RETURN movement;
END;
$$;

CREATE FUNCTION public.erp_assign_delivery_transport(p_delivery uuid, p_carrier text, p_planned_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := erp_testing.actor();
BEGIN
  IF actor IS NULL OR NOT COALESCE(erp_testing.workflow_role('stock_clerk') IN ('admin', 'manager', 'stock_clerk'), false) THEN
    RAISE EXCEPTION 'Not authorized to assign delivery transport';
  END IF;
  IF nullif(btrim(p_carrier), '') IS NULL OR p_planned_date IS NULL THEN
    RAISE EXCEPTION 'Enter a driver or carrier and a planned delivery date';
  END IF;
  UPDATE public.deliveries SET carrier_name = btrim(p_carrier), planned_delivery_date = p_planned_date
  WHERE id = p_delivery AND delivery_status = 'out_for_delivery';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only open dispatches can be assigned'; END IF;
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, new_values)
  VALUES (actor, 'DELIVERY_TRANSPORT_ASSIGNED', 'deliveries', p_delivery,
    jsonb_build_object('carrier', btrim(p_carrier), 'planned_delivery_date', p_planned_date));
END;
$$;

CREATE FUNCTION public.erp_dispatch_with_transport(p_line uuid, p_quantity integer, p_source uuid,
  p_address text, p_recipient text, p_phone text, p_request_key uuid, p_carrier text, p_planned_date date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE delivery_id uuid;
BEGIN
  IF nullif(btrim(p_carrier), '') IS NULL OR p_planned_date IS NULL THEN
    RAISE EXCEPTION 'Enter a driver or carrier and a planned delivery date';
  END IF;
  delivery_id := public.erp_dispatch_line(p_line, p_quantity, p_source, p_address, p_recipient, p_phone, p_request_key);
  IF EXISTS (SELECT 1 FROM public.deliveries WHERE id = delivery_id AND carrier_name IS NULL) THEN
    PERFORM public.erp_assign_delivery_transport(delivery_id, p_carrier, p_planned_date);
  END IF;
  RETURN delivery_id;
END;
$$;

CREATE FUNCTION public.erp_create_catalogue_draft(p_sku text, p_name text, p_category text, p_description text, p_variant text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE product_id uuid;
BEGIN
  product_id := public.erp_create_draft_product(p_sku, p_name, p_category, p_description);
  IF nullif(btrim(p_variant), '') IS NOT NULL THEN
    UPDATE public.products SET specifications = specifications || jsonb_build_object('variant', btrim(p_variant))
    WHERE id = product_id;
  END IF;
  RETURN product_id;
END;
$$;

-- Public storefront data contains only product codes and a boolean.
CREATE FUNCTION public.erp_website_availability() RETURNS TABLE (sku text, in_stock boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.sku, p.is_active AND EXISTS (
    SELECT 1 FROM public.stock_balances s JOIN public.locations l ON l.id = s.location_id
    WHERE s.product_id = p.id AND l.is_active AND l.code IN ('WH', 'SR-1', 'SR-2', 'SR-3')
      AND s.sellable_on_hand > s.active_reserved
  )
  FROM public.products p WHERE p.specifications ? 'ethiopia_website_catalogue';
$$;

REVOKE ALL ON FUNCTION public.erp_send_room_transfer(uuid, uuid, uuid, integer, text, text),
  public.erp_receive_room_transfer(uuid, integer, text),
  public.erp_receive_warehouse(uuid, integer, text, text, text, text, text),
  public.erp_assign_delivery_transport(uuid, text, date),
  public.erp_dispatch_with_transport(uuid, integer, uuid, text, text, text, uuid, text, date),
  public.erp_create_catalogue_draft(text, text, text, text, text),
  public.erp_website_availability() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.erp_send_room_transfer(uuid, uuid, uuid, integer, text, text),
  public.erp_receive_room_transfer(uuid, integer, text),
  public.erp_receive_warehouse(uuid, integer, text, text, text, text, text),
  public.erp_assign_delivery_transport(uuid, text, date),
  public.erp_dispatch_with_transport(uuid, integer, uuid, text, text, text, uuid, text, date),
  public.erp_create_catalogue_draft(text, text, text, text, text),
  public.erp_website_availability() TO anon, authenticated;
