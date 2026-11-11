-- Disposable remote smoke test. Every test row is rolled back.
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'erp-smoke-sales@example.invalid'),
  ('a0000000-0000-0000-0000-000000000002', 'erp-smoke-finance@example.invalid'),
  ('a0000000-0000-0000-0000-000000000003', 'erp-smoke-stock@example.invalid');

INSERT INTO public.staff_profiles (id, email, full_name, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'erp-smoke-sales@example.invalid', 'Smoke Sales', 'showroom_sales'),
  ('a0000000-0000-0000-0000-000000000002', 'erp-smoke-finance@example.invalid', 'Smoke Finance', 'finance'),
  ('a0000000-0000-0000-0000-000000000003', 'erp-smoke-stock@example.invalid', 'Smoke Stock', 'stock_clerk');

INSERT INTO public.products (id, sku, name, local_price) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'ERP-SMOKE-1', 'Smoke test item', 200),
  ('b0000000-0000-0000-0000-000000000002', 'ERP-SMOKE-2', 'Refund test item', 100);
DO $test$
DECLARE
  v_order UUID;
  v_line UUID;
  v_first UUID;
  v_second UUID;
  v_refund_order UUID;
  v_refund_line UUID;
  v_balance public.stock_balances%ROWTYPE;
  v_status public.order_status;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', true);
  PERFORM public.erp_post_receipt('b0000000-0000-0000-0000-000000000001', 3, 'SMOKE-RECEIPT-1', 'Test receipt');
  PERFORM public.erp_post_receipt('b0000000-0000-0000-0000-000000000002', 1, 'SMOKE-RECEIPT-2', 'Test receipt');
  PERFORM public.erp_post_transfer('b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002',
    1, 'SMOKE-TRANSFER-1', 'Test room transfer');
  BEGIN
    PERFORM public.erp_post_receipt('b0000000-0000-0000-0000-000000000001', 3, 'SMOKE-RECEIPT-1', 'Duplicate');
    RAISE EXCEPTION 'Duplicate receipt unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%already posted%' THEN RAISE; END IF;
  END;
  SELECT * INTO v_balance FROM public.stock_balances
    WHERE product_id = 'b0000000-0000-0000-0000-000000000001'
      AND location_id = 'c0000000-0000-0000-0000-000000000001';
  IF v_balance.sellable_on_hand <> 2 THEN RAISE EXCEPTION 'Transfer did not conserve Warehouse quantity'; END IF;

  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
  v_order := public.erp_create_order('Smoke Customer', '000000001',
    'c0000000-0000-0000-0000-000000000002',
    '[{"product_id":"b0000000-0000-0000-0000-000000000001","quantity":2}]'::jsonb);
  SELECT id INTO v_line FROM public.sales_order_lines WHERE order_id = v_order;

  BEGIN
    PERFORM public.erp_record_payment(v_order, 100, 'cash', 'SMOKE-PAY-1');
    RAISE EXCEPTION 'Sales payment unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Only Finance%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
  PERFORM public.erp_record_payment(v_order, 100, 'cash', 'SMOKE-PAY-1');
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
  PERFORM public.erp_create_reservation(v_line, 'c0000000-0000-0000-0000-000000000001', 2,
    NOW() + INTERVAL '3 days', NOW() + INTERVAL '5 days');

  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', true);
  BEGIN
    PERFORM public.erp_dispatch_line(v_line, 1, 'c0000000-0000-0000-0000-000000000001',
      'Smoke address', 'Smoke Customer', '000000001', 'd0000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'Unpaid dispatch unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%full order balance%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
  PERFORM public.erp_record_payment(v_order, 300, 'cash', 'SMOKE-PAY-2');
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', true);
  v_first := public.erp_dispatch_line(v_line, 1, 'c0000000-0000-0000-0000-000000000001',
    'Smoke address', 'Smoke Customer', '000000001', 'd0000000-0000-0000-0000-000000000001');
  IF v_first <> public.erp_dispatch_line(v_line, 1, 'c0000000-0000-0000-0000-000000000001',
    'Smoke address', 'Smoke Customer', '000000001', 'd0000000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'Retry did not return the same dispatch';
  END IF;
  SELECT * INTO v_balance FROM public.stock_balances
    WHERE product_id = 'b0000000-0000-0000-0000-000000000001'
      AND location_id = 'c0000000-0000-0000-0000-000000000001';
  IF v_balance.sellable_on_hand <> 1 OR v_balance.active_reserved <> 1 THEN
    RAISE EXCEPTION 'Partial dispatch changed stock incorrectly';
  END IF;

  v_second := public.erp_dispatch_line(v_line, 1, 'c0000000-0000-0000-0000-000000000001',
    'Smoke address', 'Smoke Customer', '000000001', 'd0000000-0000-0000-0000-000000000002');
  PERFORM public.erp_confirm_delivery(v_first, 'Smoke Customer', 'SMOKE-SIGNED-1');
  SELECT status INTO v_status FROM public.sales_orders WHERE id = v_order;
  IF v_status = 'delivered' THEN RAISE EXCEPTION 'Order closed before second signature'; END IF;
  PERFORM public.erp_confirm_delivery(v_second, 'Smoke Customer', 'SMOKE-SIGNED-2');
  SELECT status INTO v_status FROM public.sales_orders WHERE id = v_order;
  IF v_status <> 'delivered' THEN RAISE EXCEPTION 'Order did not close after both signatures'; END IF;

  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
  BEGIN
    PERFORM public.erp_refund_cancel_order(v_order, 'SMOKE-REF-INVALID', 'Too late');
    RAISE EXCEPTION 'Post-dispatch refund unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Dispatched orders%' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
  v_refund_order := public.erp_create_order('Smoke Refund Customer', '000000002',
    'c0000000-0000-0000-0000-000000000002',
    '[{"product_id":"b0000000-0000-0000-0000-000000000002","quantity":1}]'::jsonb);
  SELECT id INTO v_refund_line FROM public.sales_order_lines WHERE order_id = v_refund_order;
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
  PERFORM public.erp_record_payment(v_refund_order, 50, 'cash', 'SMOKE-PAY-3');
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
  PERFORM public.erp_create_reservation(v_refund_line, 'c0000000-0000-0000-0000-000000000001', 1,
    NOW() + INTERVAL '3 days', NOW() + INTERVAL '5 days');
  PERFORM set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', true);
  IF public.erp_refund_cancel_order(v_refund_order, 'SMOKE-REF-1', 'Customer discussion') <> 50 THEN
    RAISE EXCEPTION 'Refund amount incorrect';
  END IF;
  SELECT * INTO v_balance FROM public.stock_balances
    WHERE product_id = 'b0000000-0000-0000-0000-000000000002'
      AND location_id = 'c0000000-0000-0000-0000-000000000001';
  IF v_balance.sellable_on_hand <> 1 OR v_balance.active_reserved <> 0 THEN
    RAISE EXCEPTION 'Refund did not release reserved stock';
  END IF;
END;
$test$;

SELECT 'ERP workflow smoke test passed; rolling back test records' AS result;
ROLLBACK;
