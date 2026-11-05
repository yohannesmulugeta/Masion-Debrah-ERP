-- ============================================================================
-- MAISON DEBRAH ERP - MIGRATION 00001: INITIAL SCHEMA & PHYSICAL TABLES
-- Designed for 1 Central Warehouse + 3 Showrooms
-- Strict invariants: sellable_on_hand >= active_reserved >= 0
-- ============================================================================

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Enumerated types
CREATE TYPE staff_role AS ENUM (
    'admin',
    'manager',
    'stock_clerk',
    'showroom_sales',
    'finance'
);

CREATE TYPE location_type AS ENUM (
    'warehouse',
    'showroom'
);

CREATE TYPE movement_type AS ENUM (
    'receipt',
    'transfer_out',
    'transfer_in',
    'reservation_hold',
    'reservation_release',
    'sale_fulfilment',
    'count_adjustment',
    'quarantine_damage',
    'warranty_return'
);

CREATE TYPE order_status AS ENUM (
    'draft',
    'reserved',
    'confirmed',
    'partially_paid',
    'paid',
    'dispatched',
    'delivered',
    'cancelled',
    'refunded'
);

CREATE TYPE reservation_status AS ENUM (
    'active',
    'fulfilled',
    'cancelled',
    'expired'
);

CREATE TYPE payment_method AS ENUM (
    'cash',
    'telebirr',
    'cbe_birr',
    'bank_transfer',
    'card'
);

CREATE TYPE exception_type AS ENUM (
    'return',
    'damage',
    'warranty'
);

CREATE TYPE disposition_status AS ENUM (
    'pending_inspection',
    'quarantined',
    'restocked_sellable',
    'written_off'
);

-- 3. Staff Profiles (Private ERP identity linked to auth.users)
CREATE TABLE staff_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role staff_role NOT NULL DEFAULT 'showroom_sales',
    default_location_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Locations (1 Warehouse + 3 Showrooms)
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type location_type NOT NULL,
    address TEXT,
    phone TEXT,
    is_customer_available BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Foreign key for staff default location
ALTER TABLE staff_profiles 
    ADD CONSTRAINT fk_staff_default_location 
    FOREIGN KEY (default_location_id) REFERENCES locations(id) ON DELETE SET NULL;

-- 5. Products (HQ Official Master Catalogue)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    collection TEXT NOT NULL DEFAULT 'General',
    category TEXT NOT NULL DEFAULT 'Furniture',
    description TEXT,
    specifications JSONB NOT NULL DEFAULT '{}'::JSONB,
    dimensions TEXT,
    materials TEXT,
    image_url TEXT,
    reference_price NUMERIC(12, 2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_sku_nonblank CHECK (LENGTH(TRIM(sku)) > 0)
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_collection ON products(collection);
CREATE INDEX idx_products_category ON products(category);

-- 6. Product Import Batches & Validation Logs
CREATE TABLE product_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_reference TEXT NOT NULL UNIQUE,
    source_filename TEXT NOT NULL,
    total_records INT NOT NULL DEFAULT 0,
    imported_records INT NOT NULL DEFAULT 0,
    failed_records INT NOT NULL DEFAULT 0,
    imported_by UUID REFERENCES staff_profiles(id),
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_import_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES product_import_batches(id) ON DELETE CASCADE,
    row_number INT NOT NULL,
    raw_data JSONB NOT NULL,
    error_message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Stock Balances (Physical Stock & Reservable Invariants)
CREATE TABLE stock_balances (
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    sellable_on_hand INT NOT NULL DEFAULT 0,
    active_reserved INT NOT NULL DEFAULT 0,
    damaged_count INT NOT NULL DEFAULT 0,
    quarantine_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (product_id, location_id),
    -- Strict physical and mathematical integrity constraints
    CONSTRAINT chk_sellable_on_hand_non_negative CHECK (sellable_on_hand >= 0),
    CONSTRAINT chk_active_reserved_non_negative CHECK (active_reserved >= 0),
    CONSTRAINT chk_damaged_count_non_negative CHECK (damaged_count >= 0),
    CONSTRAINT chk_quarantine_count_non_negative CHECK (quarantine_count >= 0),
    CONSTRAINT chk_stock_reservable_invariant CHECK (sellable_on_hand >= active_reserved)
);

CREATE INDEX idx_stock_balances_product ON stock_balances(product_id);
CREATE INDEX idx_stock_balances_location ON stock_balances(location_id);

-- 8. Stock Movements (Append-Only Ledger)
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    source_location_id UUID REFERENCES locations(id),
    dest_location_id UUID REFERENCES locations(id),
    movement_type movement_type NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    reference_no TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_by UUID REFERENCES staff_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_no);

-- 9. Stock Counts & Physical Audit Adjustments
CREATE TABLE stock_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_reference TEXT NOT NULL UNIQUE,
    location_id UUID NOT NULL REFERENCES locations(id),
    counted_by UUID NOT NULL REFERENCES staff_profiles(id),
    approved_by UUID REFERENCES staff_profiles(id),
    status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'approved', 'rejected')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ
);

CREATE TABLE stock_count_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_id UUID NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    system_quantity INT NOT NULL,
    counted_quantity INT NOT NULL,
    variance INT GENERATED ALWAYS AS (counted_quantity - system_quantity) STORED,
    discrepancy_reason TEXT
);

-- 10. Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    tin_number TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_phone ON customers(phone);

-- 11. Sales Orders & Order Lines
CREATE TABLE sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    location_id UUID NOT NULL REFERENCES locations(id),
    status order_status NOT NULL DEFAULT 'draft',
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    balance_due NUMERIC(12, 2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    notes TEXT,
    created_by UUID REFERENCES staff_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id);
CREATE INDEX idx_sales_orders_status ON sales_orders(status);

CREATE TABLE sales_order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    line_total NUMERIC(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- 12. Reservations (Customer Holds with strict countdown)
CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    location_id UUID NOT NULL REFERENCES locations(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    status reservation_status NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ NOT NULL,
    released_at TIMESTAMPTZ,
    released_by UUID REFERENCES staff_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_expires_at ON reservations(expires_at);

-- 13. Payments & Reversals (Ledger of Monetary Transactions)
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'ETB',
    payment_method payment_method NOT NULL,
    reference_no TEXT NOT NULL,
    notes TEXT,
    recorded_by UUID NOT NULL REFERENCES staff_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON payments(order_id);

CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    approved_by UUID NOT NULL REFERENCES staff_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Deliveries
CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES sales_orders(id),
    dispatch_date TIMESTAMPTZ,
    delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'out_for_delivery', 'delivered', 'failed')),
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    driver_or_service TEXT,
    delivered_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Exception Cases (Returns, Damage, Warranty)
CREATE TABLE exception_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number TEXT NOT NULL UNIQUE,
    case_type exception_type NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id),
    location_id UUID NOT NULL REFERENCES locations(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    disposition disposition_status NOT NULL DEFAULT 'pending_inspection',
    customer_id UUID REFERENCES customers(id),
    order_id UUID REFERENCES sales_orders(id),
    issue_description TEXT NOT NULL,
    resolution_notes TEXT,
    recorded_by UUID NOT NULL REFERENCES staff_profiles(id),
    resolved_by UUID REFERENCES staff_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 16. Audit Events (Immutable System Traceability Log)
CREATE TABLE audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES staff_profiles(id),
    action TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_events_entity ON audit_events(entity_name, entity_id);
CREATE INDEX idx_audit_events_created_at ON audit_events(created_at);
