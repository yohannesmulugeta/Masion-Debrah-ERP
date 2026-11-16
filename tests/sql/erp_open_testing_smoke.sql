-- Run against the explicitly enabled shared testing mode. Leaves no test rows.
BEGIN;
SET LOCAL ROLE anon;
DO $test$
DECLARE
  p UUID; wh UUID; sr UUID; o UUID; l UUID; h UUID; d UUID; pay UUID;
  o2 UUID; l2 UUID; d2 UUID; proof TEXT; actor UUID;
BEGIN
  IF NOT (public.erp_testing_status()->>'enabled')::BOOLEAN THEN
    RAISE EXCEPTION 'Temporary testing must be enabled for this suite';
  END IF;
  actor := (public.erp_testing_status()->>'actor_id')::UUID;
  SELECT id INTO wh FROM public.locations WHERE code = 'WH';
  SELECT id INTO sr FROM public.locations WHERE code = 'SR-1';
  p := public.erp_create_draft_product('OPEN-QA-ROLLBACK', 'Temporary QA product', 'QA', 'Rollback only');
  BEGIN
    PERFORM public.erp_create_draft_product('OPEN-QA-ROLLBACK', 'Duplicate', 'QA', NULL);
    RAISE EXCEPTION 'Duplicate SKU accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  PERFORM public.erp_apply_product_prices('[{"sku":"OPEN-QA-ROLLBACK","price":"100.00"}]', 'QA approval');
  PERFORM public.erp_review_product(p, 'Temporary QA product', 'QA', 'Rollback only', 100, TRUE, 'QA activation');
  PERFORM public.erp_post_opening_stock(jsonb_build_array(
    jsonb_build_object('product_id', p, 'location_id', wh, 'quantity', 10),
    jsonb_build_object('product_id', p, 'location_id', sr, 'quantity', 0)), 'OPEN-QA-COUNT');
  BEGIN
    PERFORM public.erp_post_opening_stock(jsonb_build_array(
      jsonb_build_object('product_id', p, 'location_id', wh, 'quantity', 10)), 'OPEN-QA-DUP');
    RAISE EXCEPTION 'Duplicate opening count accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  PERFORM public.erp_post_receipt(p, 2, 'OPEN-QA-RECEIPT', 'Rollback receipt');
  PERFORM public.erp_post_transfer(p, wh, sr, 3, 'OPEN-QA-TRANSFER', 'Rollback transfer');
  IF (SELECT sum(sellable_on_hand) FROM public.stock_balances WHERE product_id = p) <> 12 THEN
    RAISE EXCEPTION 'Receipt/transfer stock mismatch'; END IF;

  o := public.erp_create_order('Rollback QA customer', '000000000', sr,
    jsonb_build_array(jsonb_build_object('product_id', p, 'quantity', 2)), 'Rollback only');
  SELECT id INTO l FROM public.sales_order_lines WHERE order_id = o;
  BEGIN
    PERFORM public.erp_create_reservation(l, sr, 2, now() + interval '3 days', now() + interval '5 days');
    RAISE EXCEPTION 'QA operation unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%deposit%' THEN RAISE; END IF;
  END;
  pay := public.erp_record_payment(o, 50, 'cash', 'OPEN-QA-DEPOSIT');
  BEGIN
    PERFORM public.erp_record_payment(o, 50, 'cash', 'OPEN-QA-DEPOSIT');
    RAISE EXCEPTION 'QA operation unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%reference%' AND SQLERRM NOT ILIKE '%duplicate%' THEN RAISE; END IF;
  END;
  proof := 'payments/' || actor || '/' || pay || '/rollback.pdf';
  INSERT INTO storage.objects (bucket_id, name) VALUES ('erp-private-evidence', proof);
  PERFORM public.erp_attach_evidence(pay, NULL, proof, 'rollback.pdf', 'application/pdf');
  h := public.erp_create_reservation(l, sr, 2, now() + interval '3 days', now() + interval '5 days');
  PERFORM public.erp_extend_reservation(h, now() + interval '4 days', now() + interval '6 days', 'QA extension');
  BEGIN
    PERFORM public.erp_dispatch_line(l, 1, sr, 'QA address', 'QA recipient', '000000000', gen_random_uuid());
    RAISE EXCEPTION 'QA operation unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%paid%' AND SQLERRM NOT ILIKE '%balance%' THEN RAISE; END IF;
  END;
  PERFORM public.erp_record_payment(o, 150, 'bank_transfer', 'OPEN-QA-FINAL');
  d := public.erp_dispatch_line(l, 1, sr, 'QA address', 'QA recipient', '000000000', gen_random_uuid());
  PERFORM public.erp_confirm_delivery(d, 'QA signer', 'OPEN-QA-SIGN-1');
  proof := 'handover/' || actor || '/' || d || '/rollback.pdf';
  INSERT INTO storage.objects (bucket_id, name) VALUES ('erp-private-evidence', proof);
  PERFORM public.erp_attach_evidence(NULL, d, proof, 'rollback.pdf', 'application/pdf');
  d := public.erp_dispatch_line(l, 1, sr, 'QA address', 'QA recipient', '000000000', gen_random_uuid());
  PERFORM public.erp_confirm_delivery(d, 'QA signer', 'OPEN-QA-SIGN-2');
  IF (SELECT status::TEXT FROM public.sales_orders WHERE id = o) <> 'delivered' THEN
    RAISE EXCEPTION 'Signed handover did not complete order'; END IF;

  o2 := public.erp_create_order('Rollback return customer', '000000000', sr,
    jsonb_build_array(jsonb_build_object('product_id', p, 'quantity', 1)), 'Rollback only');
  SELECT id INTO l2 FROM public.sales_order_lines WHERE order_id = o2;
  PERFORM public.erp_record_payment(o2, 100, 'cash', 'OPEN-QA-RETURN-PAY');
  d2 := public.erp_dispatch_line(l2, 1, wh, 'QA address', 'QA recipient', '000000000', gen_random_uuid());
  PERFORM public.erp_fail_delivery(d2, 'Rollback failure');
  PERFORM public.erp_receive_failed_delivery(d2);
  IF (SELECT quarantine_count FROM public.stock_balances WHERE product_id = p AND location_id = wh) <> 1 THEN
    RAISE EXCEPTION 'Failed delivery not quarantined'; END IF;
  PERFORM public.erp_refund_cancel_order(o2, 'OPEN-QA-REFUND', 'Rollback refund');
  IF (SELECT status::TEXT FROM public.sales_orders WHERE id = o2) <> 'cancelled' THEN
    RAISE EXCEPTION 'Refund did not cancel order'; END IF;

  INSERT INTO storage.objects (bucket_id, name)
  VALUES ('erp-product-images', 'products/' || p || '/rollback.png');
  PERFORM public.erp_link_product_image(p, 'products/' || p || '/rollback.png',
    'https://zcjnyljavilczubvelwb.supabase.co/storage/v1/object/public/erp-product-images/products/' || p || '/rollback.png');
END;
$test$;
RESET ROLE;
-- Set up an expired hold without changing the clock or a real reservation.
DO $$
DECLARE p UUID; sr UUID; wh UUID; o UUID; l UUID;
BEGIN
  SELECT id INTO p FROM public.products WHERE sku = 'OPEN-QA-ROLLBACK';
  SELECT id INTO sr FROM public.locations WHERE code = 'SR-1';
  SELECT id INTO wh FROM public.locations WHERE code = 'WH';
  o := public.erp_create_order('Rollback expiry customer', '000000000', sr,
    jsonb_build_array(jsonb_build_object('product_id', p, 'quantity', 1)), 'Rollback only');
  SELECT id INTO l FROM public.sales_order_lines WHERE order_id = o;
  PERFORM public.erp_record_payment(o, 10, 'cash', 'OPEN-QA-EXPIRY-PAY');
  PERFORM public.erp_create_reservation(l, wh, 1, now() + interval '3 days', now() + interval '5 days');
  UPDATE public.reservations SET expires_at = now() - interval '1 day',
    review_at = now() - interval '2 days' WHERE order_id = o;
END;
$$;
SET LOCAL ROLE anon;
DO $$
DECLARE h UUID; o UUID;
BEGIN
  SELECT r.id, r.order_id INTO h, o FROM public.reservations r
  JOIN public.products p ON p.id = r.product_id
  WHERE p.sku = 'OPEN-QA-ROLLBACK' AND r.status = 'active';
  PERFORM public.erp_release_expired_reservation(h, 'QA agreed release');
  IF (SELECT status::TEXT FROM public.reservations WHERE id = h) <> 'expired' THEN
    RAISE EXCEPTION 'Expired hold not released'; END IF;
  PERFORM public.erp_refund_cancel_order(o, 'OPEN-QA-EXPIRY-REFUND', 'QA cancellation');
END;
$$;
RESET ROLE;
-- Verify the emergency switch restores access checks in the same transaction.
UPDATE erp_testing.access_control SET enabled = FALSE WHERE singleton;
SET LOCAL ROLE anon;
DO $$
BEGIN
  IF (public.erp_testing_status()->>'enabled')::BOOLEAN THEN
    RAISE EXCEPTION 'Access switch failed'; END IF;
  IF (SELECT count(*) FROM public.products) <> 0 THEN
    RAISE EXCEPTION 'Anonymous records remain visible after restoration'; END IF;
  BEGIN
    PERFORM public.erp_create_draft_product('SHOULD-NOT-EXIST', 'Blocked', 'QA', NULL);
    RAISE EXCEPTION 'QA operation unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%Only Admin or Manager%' THEN RAISE; END IF;
  END;
END;
$$;
RESET ROLE;
ROLLBACK;
