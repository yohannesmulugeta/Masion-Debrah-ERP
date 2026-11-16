-- Explicitly requested temporary no-login access to the shared ERP.
-- Restore staff-only access with:
-- UPDATE erp_testing.access_control SET enabled = FALSE WHERE singleton;
-- Existing business constraints and transaction functions remain in place.
CREATE SCHEMA erp_testing;
REVOKE ALL ON SCHEMA erp_testing FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA erp_testing TO anon, authenticated;

CREATE TABLE erp_testing.access_control (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  actor_id UUID NOT NULL REFERENCES public.staff_profiles(id)
);
CREATE TABLE erp_testing.original_functions (
  signature TEXT PRIMARY KEY,
  definition TEXT NOT NULL,
  anon_execute BOOLEAN NOT NULL
);
ALTER TABLE erp_testing.access_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_testing.original_functions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA erp_testing FROM PUBLIC, anon, authenticated;

DO $$
DECLARE v_actor UUID := gen_random_uuid();
BEGIN
  -- No password or login credential. This identity labels temporary test writes.
  INSERT INTO auth.users (id, email)
  VALUES (v_actor, 'shared-testing-' || v_actor::TEXT || '@example.invalid');
  INSERT INTO public.staff_profiles (id, email, full_name, role, is_active)
  VALUES (v_actor, 'shared-testing-' || v_actor::TEXT || '@example.invalid',
    'Shared testing (no sign-in)', 'admin', TRUE);
  INSERT INTO erp_testing.access_control VALUES (TRUE, TRUE, v_actor);
END;
$$;

CREATE FUNCTION erp_testing.is_enabled() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((SELECT enabled FROM erp_testing.access_control WHERE singleton), FALSE);
$$;
REVOKE ALL ON FUNCTION erp_testing.is_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION erp_testing.is_enabled() TO anon, authenticated;

CREATE FUNCTION erp_testing.actor() RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN enabled THEN actor_id ELSE auth.uid() END
  FROM erp_testing.access_control WHERE singleton;
$$;
CREATE FUNCTION erp_testing.workflow_role(p_test_role public.staff_role) RETURNS public.staff_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN erp_testing.is_enabled() THEN p_test_role ELSE public.current_staff_role() END;
$$;
REVOKE ALL ON FUNCTION erp_testing.actor(), erp_testing.workflow_role(public.staff_role)
  FROM PUBLIC, anon, authenticated;

-- Back up exact deployed definitions before changing only their access context.
-- Keep the whitelist explicit; do not open every present or future function.
DO $$
DECLARE r RECORD; v_definition TEXT; v_role TEXT;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, p.oid::regprocedure::TEXT AS signature,
      pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(ARRAY[
      'erp_create_draft_product', 'erp_review_product', 'erp_apply_product_prices',
      'erp_link_product_image', 'erp_post_opening_stock', 'erp_post_receipt',
      'erp_post_transfer', 'erp_create_order', 'erp_record_payment',
      'erp_create_reservation', 'erp_extend_reservation', 'erp_release_expired_reservation',
      'erp_dispatch_line', 'erp_confirm_delivery', 'erp_fail_delivery',
      'erp_receive_failed_delivery', 'erp_refund_cancel_order', 'erp_attach_evidence'
    ])
  LOOP
    INSERT INTO erp_testing.original_functions VALUES
      (r.signature, r.definition, has_function_privilege('anon', r.oid, 'EXECUTE'));
    v_role := CASE WHEN r.proname IN ('erp_record_payment', 'erp_refund_cancel_order')
      THEN 'finance' ELSE 'admin' END;
    -- Evidence accepts both kinds under the same endpoint; payment requires Finance.
    IF r.proname = 'erp_attach_evidence' THEN
      v_definition := replace(r.definition, 'public.current_staff_role()',
        'erp_testing.workflow_role(CASE WHEN p_payment_id IS NOT NULL THEN ''finance''::public.staff_role ELSE ''admin''::public.staff_role END)');
    ELSE
      v_definition := replace(r.definition, 'public.current_staff_role()',
        format('erp_testing.workflow_role(%L::public.staff_role)', v_role));
    END IF;
    v_definition := replace(v_definition, 'auth.uid()', 'erp_testing.actor()');
    EXECUTE v_definition;
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', r.signature);
  END LOOP;
END;
$$;

-- UI reads only; writes still pass through the transactional workflow endpoints.
DO $$
DECLARE v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['locations', 'products', 'stock_balances', 'stock_movements',
    'customers', 'sales_orders', 'sales_order_lines', 'reservations', 'payments',
    'refunds', 'deliveries', 'erp_evidence']
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', v_table);
    EXECUTE format('CREATE POLICY "Temporary shared testing reads" ON public.%I FOR SELECT TO anon, authenticated USING ((SELECT erp_testing.is_enabled()))', v_table);
  END LOOP;
END;
$$;

CREATE POLICY "Temporary shared testing file reads" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id IN ('erp-product-images', 'erp-private-evidence')
  AND (SELECT erp_testing.is_enabled()));
CREATE POLICY "Temporary shared testing file uploads" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id IN ('erp-product-images', 'erp-private-evidence')
  AND (SELECT erp_testing.is_enabled()));

CREATE FUNCTION public.erp_testing_status() RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('enabled', enabled, 'actor_id', CASE WHEN enabled THEN actor_id END)
  FROM erp_testing.access_control WHERE singleton;
$$;
REVOKE ALL ON FUNCTION public.erp_testing_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.erp_testing_status() TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
