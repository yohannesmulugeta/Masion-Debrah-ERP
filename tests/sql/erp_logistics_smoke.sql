-- Use after the logistics migration in the shared testing project.
BEGIN;
SET LOCAL ROLE anon;
DO $test$
DECLARE product uuid; warehouse uuid; showroom uuid; transfer uuid; receipt uuid; document_path text;
BEGIN
  SELECT id INTO warehouse FROM public.locations WHERE code = 'WH';
  SELECT id INTO showroom FROM public.locations WHERE code = 'SR-1';
  product := public.erp_create_catalogue_draft('QA-LOGISTICS-ROLLBACK', 'Logistics check', 'QA', '', 'QA finish');
  document_path := 'warehouse-receipts/' || (public.erp_testing_status()->>'actor_id') || '/rollback.pdf';
  INSERT INTO storage.objects (bucket_id, name) VALUES ('erp-private-evidence', document_path);
  receipt := public.erp_receive_warehouse(product, 5, 'QA-LOGISTICS', 'QA supplier', '', document_path, 'rollback.pdf');
  IF NOT EXISTS (SELECT 1 FROM public.stock_movements WHERE id = receipt AND supplier_name = 'QA supplier'
    AND receipt_document_path = document_path) THEN
    RAISE EXCEPTION 'Receipt was not recorded';
  END IF;
  BEGIN
    PERFORM public.erp_receive_warehouse(product, 5, 'qa-logistics', 'QA supplier', '', '', '');
    RAISE EXCEPTION 'Duplicate receipt accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  transfer := public.erp_send_room_transfer(product, warehouse, showroom, 3, 'QA dispatch', '');
  IF (SELECT sellable_on_hand FROM public.stock_balances WHERE product_id = product AND location_id = warehouse) IS DISTINCT FROM 2
    OR EXISTS (SELECT 1 FROM public.stock_balances WHERE product_id = product AND location_id = showroom) THEN
    RAISE EXCEPTION 'In-transit units were counted as sellable';
  END IF;
  PERFORM public.erp_receive_room_transfer(transfer, 2, 'One damaged unit');
  IF (SELECT sellable_on_hand FROM public.stock_balances WHERE product_id = product AND location_id = showroom) IS DISTINCT FROM 2
    OR NOT EXISTS (SELECT 1 FROM public.erp_room_transfers WHERE id = transfer AND received_quantity = 2 AND discrepancy = 'One damaged unit') THEN
    RAISE EXCEPTION 'Transfer discrepancy was not recorded correctly';
  END IF;
  BEGIN
    PERFORM public.erp_receive_room_transfer(transfer, 2, 'Retry');
    RAISE EXCEPTION 'Duplicate arrival accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Transfer is missing or already received' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.erp_website_availability() WHERE sku = 'QA-LOGISTICS-ROLLBACK') THEN
    RAISE EXCEPTION 'Unlisted test SKU leaked to storefront';
  END IF;
END
$test$;
RESET ROLE;
UPDATE public.products SET specifications = specifications || '{"ethiopia_website_catalogue":{}}'
WHERE sku = 'QA-LOGISTICS-ROLLBACK';
SET LOCAL ROLE anon;
DO $test$
DECLARE product uuid; warehouse uuid; showroom uuid; customer_order uuid; sales_line uuid; delivery uuid;
DECLARE dispatch_key uuid := gen_random_uuid();
DECLARE second_order uuid; second_line uuid;
BEGIN
  SELECT id INTO product FROM public.products WHERE sku = 'QA-LOGISTICS-ROLLBACK';
  SELECT id INTO warehouse FROM public.locations WHERE code = 'WH';
  SELECT id INTO showroom FROM public.locations WHERE code = 'SR-1';
  IF (SELECT in_stock FROM public.erp_website_availability() WHERE sku = 'QA-LOGISTICS-ROLLBACK') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Unapproved product shown as sellable';
  END IF;
  PERFORM public.erp_review_product(product, 'Logistics check', 'QA', '', 100, true, 'QA approval');
  IF (SELECT in_stock FROM public.erp_website_availability() WHERE sku = 'QA-LOGISTICS-ROLLBACK') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Available SKU absent from website feed';
  END IF;
  customer_order := public.erp_create_order('Rollback logistics customer', '000000000', showroom,
    jsonb_build_array(jsonb_build_object('product_id', product, 'quantity', 2)), 'Rollback only');
  SELECT id INTO sales_line FROM public.sales_order_lines WHERE order_id = customer_order;
  PERFORM public.erp_record_payment(customer_order, 100, 'cash', 'QA-LOGISTICS-DEPOSIT');
  PERFORM public.erp_create_reservation(sales_line, showroom, 2, now() + interval '1 day', now() + interval '2 days');
  second_order := public.erp_create_order('Second rollback logistics customer', '000000001', showroom,
    jsonb_build_array(jsonb_build_object('product_id', product, 'quantity', 2)), 'Rollback only');
  SELECT id INTO second_line FROM public.sales_order_lines WHERE order_id = second_order;
  PERFORM public.erp_record_payment(second_order, 100, 'cash', 'QA-LOGISTICS-SECOND-DEPOSIT');
  PERFORM public.erp_create_reservation(second_line, warehouse, 2, now() + interval '1 day', now() + interval '2 days');
  IF (SELECT in_stock FROM public.erp_website_availability() WHERE sku = 'QA-LOGISTICS-ROLLBACK') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Reserved stock leaked to website';
  END IF;
  PERFORM public.erp_record_payment(customer_order, 100, 'cash', 'QA-LOGISTICS-FINAL');
  delivery := public.erp_dispatch_with_transport(sales_line, 2, showroom, 'QA address', 'QA recipient', '000000000',
    dispatch_key, 'QA carrier', current_date);
  IF public.erp_dispatch_with_transport(sales_line, 2, showroom, 'QA address', 'QA recipient', '000000000',
    dispatch_key, 'QA carrier', current_date) IS DISTINCT FROM delivery THEN
    RAISE EXCEPTION 'Dispatch retry created a duplicate delivery';
  END IF;
  PERFORM public.erp_assign_delivery_transport(delivery, 'QA replacement carrier', current_date + 1);
  PERFORM public.erp_confirm_delivery(delivery, 'QA signer', 'QA-LOGISTICS-SIGNED');
  IF NOT EXISTS (SELECT 1 FROM public.deliveries WHERE id = delivery AND carrier_name = 'QA replacement carrier'
    AND planned_delivery_date = current_date + 1 AND delivery_status = 'delivered') THEN
    RAISE EXCEPTION 'Transport details or signed handover failed';
  END IF;
END
$test$;
RESET ROLE;
UPDATE erp_testing.access_control SET enabled = false WHERE singleton;
SET LOCAL ROLE anon;
DO $test$
BEGIN
  IF EXISTS (SELECT 1 FROM public.erp_room_transfers) THEN RAISE EXCEPTION 'Anonymous transfer read escaped testing switch'; END IF;
  BEGIN
    PERFORM public.erp_receive_warehouse(NULL, 1, 'QA', 'QA', '', '', '');
    RAISE EXCEPTION 'Anonymous receipt escaped testing switch';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Not authorized to receive warehouse stock' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.erp_create_catalogue_draft('QA', 'QA', 'QA', '', '');
    RAISE EXCEPTION 'Anonymous draft escaped testing switch';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Not authorized to create catalogue drafts' THEN RAISE; END IF;
  END;
END
$test$;
RESET ROLE;
ROLLBACK;
