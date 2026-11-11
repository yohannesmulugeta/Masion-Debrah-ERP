-- Disposable role and price-history check. All rows are rolled back.
BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'erp-product-manager@example.invalid'),
  ('e0000000-0000-0000-0000-000000000002', 'erp-product-sales@example.invalid');
INSERT INTO public.staff_profiles (id, email, full_name, role) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'erp-product-manager@example.invalid', 'Product Smoke Manager', 'manager'),
  ('e0000000-0000-0000-0000-000000000002', 'erp-product-sales@example.invalid', 'Product Smoke Sales', 'showroom_sales');

DO $test$
DECLARE v_product UUID; v_price NUMERIC(12,2);
BEGIN
  PERFORM set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000002', true);
  BEGIN
    PERFORM public.erp_create_product('SMOKE-PRODUCT-1', 'Smoke item', 'Test', 100, NULL);
    RAISE EXCEPTION 'Sales unexpectedly created a product';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Only Admin or Manager%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', true);
  v_product := public.erp_create_product('SMOKE-PRODUCT-1', 'Smoke item', 'Test', 100, NULL);
  PERFORM public.erp_update_product_price(v_product, 125, 'Approved test price change');
  SELECT local_price INTO v_price FROM public.products WHERE id = v_product;
  IF v_price <> 125 THEN RAISE EXCEPTION 'Updated price was not stored'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_events WHERE entity_id = v_product
    AND action = 'PRODUCT_PRICE_CHANGED' AND (old_values->>'local_price')::numeric = 100
    AND (new_values->>'local_price')::numeric = 125) THEN
    RAISE EXCEPTION 'Price change was not audited';
  END IF;
END;
$test$;

SELECT 'Product role and price audit smoke test passed; rolling back test records' AS result;
ROLLBACK;
