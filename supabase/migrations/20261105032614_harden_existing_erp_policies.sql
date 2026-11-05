-- Apply the safe baseline access rules to databases that received the earlier
-- draft policies. Existing records and location IDs are preserved.
CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS public.staff_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT role FROM public.staff_profiles WHERE id = auth.uid() AND is_active = TRUE;
$$;
REVOKE ALL ON FUNCTION public.current_staff_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_staff_role() TO authenticated;

ALTER POLICY "Active staff can view team profiles" ON public.staff_profiles
    USING (is_active = TRUE AND public.current_staff_role() IS NOT NULL);
ALTER POLICY "Admins have full staff profile management" ON public.staff_profiles
    USING (public.current_staff_role() = 'admin')
    WITH CHECK (public.current_staff_role() = 'admin');
ALTER POLICY "Staff can view locations" ON public.locations
    USING (is_active = TRUE AND public.current_staff_role() IS NOT NULL);
ALTER POLICY "Admins can manage locations" ON public.locations
    USING (public.current_staff_role() = 'admin')
    WITH CHECK (public.current_staff_role() = 'admin');
ALTER POLICY "Staff can view catalogue products" ON public.products
    USING (public.current_staff_role() IS NOT NULL);
ALTER POLICY "Admin and Managers can update catalogue" ON public.products
    USING (public.current_staff_role() IN ('admin', 'manager'))
    WITH CHECK (public.current_staff_role() IN ('admin', 'manager'));
ALTER POLICY "Staff can view stock balances" ON public.stock_balances
    USING (public.current_staff_role() IS NOT NULL);
ALTER POLICY "Staff can view stock movement ledger" ON public.stock_movements
    USING (public.current_staff_role() IS NOT NULL);
ALTER POLICY "Staff can view customers" ON public.customers
    USING (public.current_staff_role() IS NOT NULL);
ALTER POLICY "Sales, Managers and Admins can manage customers" ON public.customers
    USING (public.current_staff_role() IN ('admin', 'manager', 'showroom_sales'))
    WITH CHECK (public.current_staff_role() IN ('admin', 'manager', 'showroom_sales'));
ALTER POLICY "Staff can view sales orders" ON public.sales_orders
    USING (public.current_staff_role() IS NOT NULL);
ALTER POLICY "Staff can view order lines" ON public.sales_order_lines
    USING (public.current_staff_role() IS NOT NULL);
ALTER POLICY "Staff can view reservations" ON public.reservations
    USING (public.current_staff_role() IS NOT NULL);
ALTER POLICY "Staff can view payments" ON public.payments
    USING (public.current_staff_role() IS NOT NULL);
ALTER POLICY "Managers and Admins can review audit logs" ON public.audit_events
    USING (public.current_staff_role() IN ('admin', 'manager'));

DROP POLICY IF EXISTS "Stock clerks, managers and admins can manage stock" ON public.stock_balances;
DROP POLICY IF EXISTS "Sales, Managers and Admins can create orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Sales, Managers and Admins can update orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Sales and Managers can manage order lines" ON public.sales_order_lines;
DROP POLICY IF EXISTS "Sales, Managers and Admins can create reservations" ON public.reservations;
DROP POLICY IF EXISTS "Sales and Finance can record payments" ON public.payments;
DROP POLICY IF EXISTS "Finance and Admin can manage refunds" ON public.refunds;

-- Older RPCs trust a caller-supplied actor ID. Keep them private until they
-- verify auth.uid(), roles, and every state transition in database tests.
REVOKE ALL ON FUNCTION public.fn_ensure_stock_balance(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_post_receipt(UUID, UUID, INT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_post_transfer(UUID, UUID, UUID, INT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_create_reservation(UUID, UUID, UUID, INT, INT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_release_reservation(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_fulfil_sales_order(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_record_payment(UUID, NUMERIC, public.payment_method, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_record_stock_adjustment(UUID, UUID, INT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
