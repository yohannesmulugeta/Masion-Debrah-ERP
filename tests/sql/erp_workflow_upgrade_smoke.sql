-- Disposable checks for the upgraded live workflow. All writes roll back.
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'upgrade-manager@example.invalid'),
  ('f1000000-0000-0000-0000-000000000002', 'upgrade-sales@example.invalid'),
  ('f1000000-0000-0000-0000-000000000003', 'upgrade-finance@example.invalid'),
  ('f1000000-0000-0000-0000-000000000004', 'upgrade-stock@example.invalid');
INSERT INTO public.staff_profiles (id, email, full_name, role) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'upgrade-manager@example.invalid', 'Upgrade Manager', 'manager'),
  ('f1000000-0000-0000-0000-000000000002', 'upgrade-sales@example.invalid', 'Upgrade Sales', 'showroom_sales'),
  ('f1000000-0000-0000-0000-000000000003', 'upgrade-finance@example.invalid', 'Upgrade Finance', 'finance'),
  ('f1000000-0000-0000-0000-000000000004', 'upgrade-stock@example.invalid', 'Upgrade Stock', 'stock_clerk');

DO $test$
DECLARE
  v_product UUID; v_order UUID; v_line UUID; v_hold UUID; v_payment UUID;
  v_delivery UUID; v_balance public.stock_balances%ROWTYPE; v_status public.order_status;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000002', true);
  BEGIN
    PERFORM public.erp_create_draft_product('UPGRADE-1', 'Test sofa', 'Sofa', 'Test');
    RAISE EXCEPTION 'Sales unexpectedly created draft';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Only Admin or Manager%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000001', true);
  v_product := public.erp_create_draft_product('UPGRADE-1', 'Test sofa', 'Sofa', 'Test');
  IF (SELECT is_active OR local_price IS NOT NULL FROM public.products WHERE id = v_product) THEN
    RAISE EXCEPTION 'New draft was made sellable';
  END IF;
  IF public.erp_apply_product_prices('[{"sku":"UPGRADE-1","price":"100.00"}]'::jsonb, 'Approved test list') <> 1 THEN
    RAISE EXCEPTION 'Price list did not update draft';
  END IF;
  IF (SELECT is_active FROM public.products WHERE id = v_product) THEN
    RAISE EXCEPTION 'Price list activated a product without review';
  END IF;
  PERFORM public.erp_review_product(v_product, 'Test sofa', 'Sofa', 'Test', 100, TRUE, 'Manager approved');
  IF NOT (SELECT is_active FROM public.products WHERE id = v_product) THEN
    RAISE EXCEPTION 'Product was not activated';
  END IF;

  IF public.erp_post_opening_stock(jsonb_build_array(
    jsonb_build_object('product_id', v_product, 'location_id', 'c0000000-0000-0000-0000-000000000001', 'quantity', 3),
    jsonb_build_object('product_id', v_product, 'location_id', 'c0000000-0000-0000-0000-000000000002', 'quantity', 0)
  ), 'UPGRADE-COUNT-1') <> 2 THEN RAISE EXCEPTION 'Opening counts not posted'; END IF;
  BEGIN
    PERFORM public.erp_post_opening_stock(jsonb_build_array(
      jsonb_build_object('product_id', v_product, 'location_id', 'c0000000-0000-0000-0000-000000000001', 'quantity', 3)
    ), 'UPGRADE-COUNT-2');
    RAISE EXCEPTION 'Duplicate opening count unexpectedly posted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  PERFORM set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000002', true);
  v_order := public.erp_create_order('Upgrade customer', '000000000',
    'c0000000-0000-0000-0000-000000000002',
    jsonb_build_array(jsonb_build_object('product_id', v_product, 'quantity', 1)), NULL);
  SELECT id INTO v_line FROM public.sales_order_lines WHERE order_id = v_order;
  PERFORM set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000003', true);
  v_payment := public.erp_record_payment(v_order, 50, 'cash', 'UPGRADE-PAY-1');
  INSERT INTO storage.objects (bucket_id, name)
  VALUES ('erp-private-evidence', 'payments/f1000000-0000-0000-0000-000000000003/' || v_payment || '/test.pdf');
  IF public.erp_attach_evidence(v_payment, NULL,
    'payments/f1000000-0000-0000-0000-000000000003/' || v_payment || '/test.pdf',
    'test.pdf', 'application/pdf') IS NULL THEN
    RAISE EXCEPTION 'Payment proof was not linked';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000002', true);
  BEGIN
    PERFORM public.erp_attach_evidence(v_payment, NULL,
      'payments/f1000000-0000-0000-0000-000000000003/' || v_payment || '/test.pdf',
      'test.pdf', 'application/pdf');
    RAISE EXCEPTION 'Sales unexpectedly linked payment proof';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Only Finance%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000002', true);
  v_hold := public.erp_create_reservation(v_line, 'c0000000-0000-0000-0000-000000000001',
    1, NOW() + INTERVAL '3 days', NOW() + INTERVAL '5 days');
  UPDATE public.reservations SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = v_hold;
  PERFORM public.erp_release_expired_reservation(v_hold, 'Customer did not extend');
  SELECT * INTO v_balance FROM public.stock_balances WHERE product_id = v_product
    AND location_id = 'c0000000-0000-0000-0000-000000000001';
  IF v_balance.active_reserved <> 0 OR (SELECT status FROM public.reservations WHERE id = v_hold) <> 'expired' THEN
    RAISE EXCEPTION 'Expired hold was not released';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000003', true);
  IF public.erp_refund_cancel_order(v_order, 'UPGRADE-REFUND-1', 'Customer discussion') <> 50 THEN
    RAISE EXCEPTION 'Deposit refund amount incorrect';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000002', true);
  v_order := public.erp_create_order('Failed delivery customer', '000000001',
    'c0000000-0000-0000-0000-000000000002',
    jsonb_build_array(jsonb_build_object('product_id', v_product, 'quantity', 1)), NULL);
  SELECT id INTO v_line FROM public.sales_order_lines WHERE order_id = v_order;
  PERFORM set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000003', true);
  PERFORM public.erp_record_payment(v_order, 100, 'cash', 'UPGRADE-PAY-2');
  PERFORM set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000004', true);
  v_delivery := public.erp_dispatch_line(v_line, 1,
    'c0000000-0000-0000-0000-000000000001', 'Test address', 'Customer', '000000001',
    'f2000000-0000-0000-0000-000000000001');
  PERFORM public.erp_fail_delivery(v_delivery, 'Customer unavailable');
  PERFORM public.erp_receive_failed_delivery(v_delivery);
  PERFORM set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000003', true);
  IF public.erp_refund_cancel_order(v_order, 'UPGRADE-REFUND-2', 'Customer requested refund') <> 100 THEN
    RAISE EXCEPTION 'Returned failed delivery was not refundable';
  END IF;
  SELECT status INTO v_status FROM public.sales_orders WHERE id = v_order;
  IF v_status <> 'cancelled' THEN RAISE EXCEPTION 'Returned order not cancelled'; END IF;
  SELECT * INTO v_balance FROM public.stock_balances WHERE product_id = v_product
    AND location_id = 'c0000000-0000-0000-0000-000000000001';
  IF v_balance.quarantine_count <> 1 THEN RAISE EXCEPTION 'Returned item became sellable'; END IF;
END;
$test$;

SELECT 'Upgraded workflow smoke checks passed; rolling back all test records' AS result;
ROLLBACK;
