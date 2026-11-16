-- Explicit role checks on the orchestration functions also reject a NULL role.
CREATE OR REPLACE FUNCTION public.erp_dispatch_with_transport(p_line uuid, p_quantity integer, p_source uuid,
  p_address text, p_recipient text, p_phone text, p_request_key uuid, p_carrier text, p_planned_date date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE delivery_id uuid;
BEGIN
  IF erp_testing.actor() IS NULL
    OR NOT coalesce(erp_testing.workflow_role('stock_clerk') IN ('admin', 'manager', 'stock_clerk'), false) THEN
    RAISE EXCEPTION 'Not authorized to dispatch deliveries';
  END IF;
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

CREATE OR REPLACE FUNCTION public.erp_create_catalogue_draft(p_sku text, p_name text, p_category text, p_description text, p_variant text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE product_id uuid;
BEGIN
  IF erp_testing.actor() IS NULL
    OR NOT coalesce(erp_testing.workflow_role('admin') IN ('admin', 'manager'), false) THEN
    RAISE EXCEPTION 'Not authorized to create catalogue drafts';
  END IF;
  product_id := public.erp_create_draft_product(p_sku, p_name, p_category, p_description);
  IF nullif(btrim(p_variant), '') IS NOT NULL THEN
    UPDATE public.products SET specifications = specifications || jsonb_build_object('variant', btrim(p_variant))
    WHERE id = product_id;
  END IF;
  RETURN product_id;
END;
$$;
