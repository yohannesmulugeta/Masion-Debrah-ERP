-- Local product and price onboarding. Historical order line prices remain snapshots.
REVOKE INSERT, UPDATE, DELETE ON public.products FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.erp_create_product(
  p_sku TEXT, p_name TEXT, p_category TEXT, p_local_price NUMERIC,
  p_description TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_id UUID;
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'manager') OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Only Admin or Manager can create products';
  END IF;
  IF NULLIF(TRIM(p_sku), '') IS NULL OR NULLIF(TRIM(p_name), '') IS NULL
     OR NULLIF(TRIM(p_category), '') IS NULL OR p_local_price IS NULL
     OR p_local_price <= 0 OR p_local_price <> ROUND(p_local_price, 2) THEN
    RAISE EXCEPTION 'Enter SKU, name, category, and approved positive price';
  END IF;
  INSERT INTO public.products (sku, name, category, local_price, description)
  VALUES (UPPER(TRIM(p_sku)), TRIM(p_name), TRIM(p_category), p_local_price,
    NULLIF(TRIM(p_description), '')) RETURNING id INTO v_id;
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, new_values)
  VALUES (v_actor, 'PRODUCT_CREATED', 'products', v_id,
    jsonb_build_object('sku', UPPER(TRIM(p_sku)), 'name', TRIM(p_name), 'local_price', p_local_price));
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.erp_update_product_price(
  p_product_id UUID, p_local_price NUMERIC, p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor UUID := auth.uid(); v_previous NUMERIC(12,2);
BEGIN
  IF public.current_staff_role() NOT IN ('admin', 'manager') OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Only Admin or Manager can change prices';
  END IF;
  IF p_local_price IS NULL OR p_local_price <= 0 OR p_local_price <> ROUND(p_local_price, 2)
     OR NULLIF(TRIM(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Enter an approved price and change reason';
  END IF;
  SELECT local_price INTO v_previous FROM public.products
    WHERE id = p_product_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active product not found'; END IF;
  IF v_previous IS NOT DISTINCT FROM p_local_price THEN RAISE EXCEPTION 'Price has not changed'; END IF;
  UPDATE public.products SET local_price = p_local_price, updated_at = NOW()
    WHERE id = p_product_id;
  INSERT INTO public.audit_events (actor_id, action, entity_name, entity_id, old_values, new_values)
  VALUES (v_actor, 'PRODUCT_PRICE_CHANGED', 'products', p_product_id,
    jsonb_build_object('local_price', v_previous),
    jsonb_build_object('local_price', p_local_price, 'reason', TRIM(p_reason)));
END;
$$;

REVOKE ALL ON FUNCTION public.erp_create_product(TEXT, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.erp_update_product_price(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.erp_create_product(TEXT, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.erp_update_product_price(UUID, NUMERIC, TEXT) TO authenticated;
