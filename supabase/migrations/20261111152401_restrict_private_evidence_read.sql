-- Payment proof is visible only to Finance and supervisors. Signed handover
-- documents remain visible to active staff who work on the order.
DROP POLICY IF EXISTS "Staff read ERP evidence records" ON public.erp_evidence;
CREATE POLICY "Staff read authorized ERP evidence" ON public.erp_evidence FOR SELECT TO authenticated
  USING ((payment_id IS NOT NULL AND public.current_staff_role() IN ('finance', 'admin', 'manager'))
    OR (delivery_id IS NOT NULL AND public.current_staff_role() IS NOT NULL));

DROP POLICY IF EXISTS "ERP staff read private evidence" ON storage.objects;
CREATE POLICY "Authorized staff read private evidence" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'erp-private-evidence' AND (
    ((storage.foldername(name))[1] = 'payments'
      AND public.current_staff_role() IN ('finance', 'admin', 'manager'))
    OR ((storage.foldername(name))[1] = 'handover'
      AND public.current_staff_role() IS NOT NULL)
  ));
