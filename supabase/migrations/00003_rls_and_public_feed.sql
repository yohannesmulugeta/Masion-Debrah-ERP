-- ============================================================================
-- MAISON DEBRAH ERP - MIGRATION 00003: ROW-LEVEL SECURITY & PUBLIC FEED VIEW
-- Absolute isolation of private ERP tables, role-based database policies,
-- and safe public availability feed for et.maisondebrah.com
-- ============================================================================

-- 1. Enable RLS on every private operational table
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_import_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_count_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE exception_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- 2. Helper function to get current user's role
CREATE OR REPLACE FUNCTION public.current_staff_role()
RETURNS public.staff_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT role FROM public.staff_profiles WHERE id = auth.uid() AND is_active = TRUE;
$$;
REVOKE ALL ON FUNCTION public.current_staff_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_staff_role() TO authenticated;

-- 3. Staff Profiles Policies
CREATE POLICY "Active staff can view team profiles"
    ON staff_profiles FOR SELECT
    TO authenticated
    USING (is_active = TRUE AND public.current_staff_role() IS NOT NULL);

CREATE POLICY "Admins have full staff profile management"
    ON staff_profiles FOR ALL
    TO authenticated
    USING (public.current_staff_role() = 'admin');

-- 4. Locations Policies
CREATE POLICY "Staff can view locations"
    ON locations FOR SELECT
    TO authenticated
    USING (is_active = TRUE AND public.current_staff_role() IS NOT NULL);

CREATE POLICY "Admins can manage locations"
    ON locations FOR ALL
    TO authenticated
    USING (public.current_staff_role() = 'admin');

-- 5. Products Policies
CREATE POLICY "Staff can view catalogue products"
    ON products FOR SELECT
    TO authenticated
    USING (public.current_staff_role() IS NOT NULL);

CREATE POLICY "Admin and Managers can update catalogue"
    ON products FOR ALL
    TO authenticated
    USING (public.current_staff_role() IN ('admin', 'manager'));

-- 6. Stock Balances & Movements Policies
CREATE POLICY "Staff can view stock balances"
    ON stock_balances FOR SELECT
    TO authenticated
    USING (public.current_staff_role() IS NOT NULL);

CREATE POLICY "Staff can view stock movement ledger"
    ON stock_movements FOR SELECT
    TO authenticated
    USING (public.current_staff_role() IS NOT NULL);

-- Stock balances are never writable directly through the Data API. Atomic
-- stock functions require separate verified execution grants before live use.

-- 7. Customers & Orders Policies
CREATE POLICY "Staff can view customers"
    ON customers FOR SELECT
    TO authenticated
    USING (public.current_staff_role() IS NOT NULL);

CREATE POLICY "Sales, Managers and Admins can manage customers"
    ON customers FOR ALL
    TO authenticated
    USING (public.current_staff_role() IN ('admin', 'manager', 'showroom_sales'));

CREATE POLICY "Staff can view sales orders"
    ON sales_orders FOR SELECT
    TO authenticated
    USING (public.current_staff_role() IS NOT NULL);

-- Orders and order lines require a validated creation transaction.

CREATE POLICY "Staff can view order lines"
    ON sales_order_lines FOR SELECT
    TO authenticated
    USING (public.current_staff_role() IS NOT NULL);


-- 8. Reservations Policies
CREATE POLICY "Staff can view reservations"
    ON reservations FOR SELECT
    TO authenticated
    USING (public.current_staff_role() IS NOT NULL);

-- Reservation writes require a single transaction with the stock balance.

-- 9. Payments & Finance Policies
CREATE POLICY "Staff can view payments"
    ON payments FOR SELECT
    TO authenticated
    USING (public.current_staff_role() IS NOT NULL);

-- Payment and refund writes require validated financial transactions.

-- 10. Audit Events Policy (Strictly immutable)
CREATE POLICY "Managers and Admins can review audit logs"
    ON audit_events FOR SELECT
    TO authenticated
    USING (public.current_staff_role() IN ('admin', 'manager'));

-- Existing business functions accept caller-supplied actor IDs and have not
-- passed role-specific RPC tests. Keep them unavailable to browser roles.
REVOKE ALL ON FUNCTION public.fn_ensure_stock_balance(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_post_receipt(UUID, UUID, INT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_post_transfer(UUID, UUID, UUID, INT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_create_reservation(UUID, UUID, UUID, INT, INT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_release_reservation(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_fulfil_sales_order(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_record_payment(UUID, NUMERIC, payment_method, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_record_stock_adjustment(UUID, UUID, INT, TEXT, UUID) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 11. PUBLIC WEBSITE AVAILABILITY FEED (et.maisondebrah.com target)
-- Exposes SKU, selected catalogue metadata, and a derived availability status.
-- Contains ZERO raw stock counts, ZERO financial figures, ZERO private data.
-- ============================================================================

CREATE OR REPLACE VIEW v_public_product_availability AS
SELECT 
    p.sku,
    p.name,
    p.collection,
    p.category,
    p.image_url,
    p.dimensions,
    p.materials,
    CASE 
        -- Sum positive unreserved sellable stock across customer-available locations
        WHEN COALESCE(SUM(
            CASE 
                WHEN loc.is_customer_available = TRUE 
                     AND (sb.sellable_on_hand - sb.active_reserved) > 0 
                THEN (sb.sellable_on_hand - sb.active_reserved)
                ELSE 0 
            END
        ), 0) > 0 THEN 'in_stock'
        ELSE 'available_to_order'
    END AS availability_status
FROM products p
LEFT JOIN stock_balances sb ON sb.product_id = p.id
LEFT JOIN locations loc ON loc.id = sb.location_id
WHERE p.is_active = TRUE
GROUP BY p.id, p.sku, p.name, p.collection, p.category, p.image_url, p.dimensions, p.materials;

-- Grant public read access to the view only
GRANT SELECT ON v_public_product_availability TO anon, authenticated;

-- Explicitly revoke public table access from anon
REVOKE ALL ON staff_profiles FROM anon;
REVOKE ALL ON stock_balances FROM anon;
REVOKE ALL ON stock_movements FROM anon;
REVOKE ALL ON customers FROM anon;
REVOKE ALL ON sales_orders FROM anon;
REVOKE ALL ON sales_order_lines FROM anon;
REVOKE ALL ON payments FROM anon;
REVOKE ALL ON refunds FROM anon;
REVOKE ALL ON audit_events FROM anon;
