-- Public website integration is pending approval. Keep the availability view
-- available to authenticated staff only, under the caller's RLS policies.
ALTER VIEW public.v_public_product_availability SET (security_invoker = true);
REVOKE ALL ON TABLE public.v_public_product_availability FROM anon;
GRANT SELECT ON TABLE public.v_public_product_availability TO authenticated;

-- Legacy RPCs remain revoked. Pin their search path to prevent role-mutable lookup.
ALTER FUNCTION public.fn_ensure_stock_balance(UUID, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_post_receipt(UUID, UUID, INT, TEXT, TEXT, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_post_transfer(UUID, UUID, UUID, INT, TEXT, TEXT, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_create_reservation(UUID, UUID, UUID, INT, INT, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_release_reservation(UUID, TEXT, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_fulfil_sales_order(UUID, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_record_payment(UUID, NUMERIC, public.payment_method, TEXT, TEXT, UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_record_stock_adjustment(UUID, UUID, INT, TEXT, UUID) SET search_path = public, pg_temp;
