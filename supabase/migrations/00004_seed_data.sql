-- ============================================================================
-- MAISON DEBRAH ERP - MIGRATION 00004: SEED DATA & OPENING BALANCES
-- Configures one Warehouse and three showroom rooms in the same building.
-- Product and balance rows below are DEMO ONLY and require app.allow_demo_seed=on.
-- ============================================================================

-- 1. Insert 4 Configured Locations
INSERT INTO locations (id, code, name, type, address, phone, is_customer_available, is_active)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'WH', 'Warehouse', 'warehouse', NULL, NULL, TRUE, TRUE),
    ('c0000000-0000-0000-0000-000000000002', 'SR-1', 'Showroom 1', 'showroom', NULL, NULL, TRUE, TRUE),
    ('c0000000-0000-0000-0000-000000000003', 'SR-2', 'Showroom 2', 'showroom', NULL, NULL, TRUE, TRUE),
    ('c0000000-0000-0000-0000-000000000004', 'SR-3', 'Showroom 3', 'showroom', NULL, NULL, TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

DO $demo$
BEGIN
IF current_setting('app.allow_demo_seed', TRUE) IS DISTINCT FROM 'on' THEN
    RAISE NOTICE 'Demo products and stock skipped; set app.allow_demo_seed=on only in disposable local databases.';
    RETURN;
END IF;

-- 2. Insert sample catalogue products for local demonstrations only
INSERT INTO products (id, sku, name, collection, category, description, dimensions, materials, reference_price, is_active)
VALUES
    ('d0000000-0000-0000-0000-000000000001', 'MD-SOF-001', 'Aura Curved Bouclé Sofa', 'Signature Living', 'Sofas', 'Sculptural three-seat sofa in premium textured ivory bouclé with brushed bronze plinth base.', '240 x 105 x 78 cm', 'Textured Bouclé, Solid Walnut Inner Frame, Brushed Bronze Base', 285000.00, TRUE),
    ('d0000000-0000-0000-0000-000000000002', 'MD-CHR-002', 'Palais Velvet Occasional Chair', 'Elegance', 'Chairs', 'Architectural accent armchair tailored in sage Italian velvet with fluted backrest detailing.', '85 x 82 x 80 cm', 'Sage Cotton Velvet, Handcrafted Ash Frame, Brass Ferrules', 125000.00, TRUE),
    ('d0000000-0000-0000-0000-000000000003', 'MD-TBL-003', 'Monolith Travertine Dining Table', 'Atelier Stone', 'Tables', 'Monumental 8-seater dining table crafted from unfilled Roman travertine with fluted cylinder pedestals.', '260 x 110 x 75 cm', 'Honed Roman Travertine, Structural Core', 390000.00, TRUE),
    ('d0000000-0000-0000-0000-000000000004', 'MD-LGT-004', 'Lumière Brass & Opal Chandelier', 'Lumière', 'Lighting', 'Statement 12-arm branched chandelier in hand-waxed antique brass with hand-blown matte opal glass spheres.', '130 x 130 x 90 cm', 'Antiqued Brass, Hand-Blown Triplex Opal Glass', 165000.00, TRUE),
    ('d0000000-0000-0000-0000-000000000005', 'MD-CRD-005', 'Vesper Fluted Oak Credenza', 'Nordic Luxe', 'Storage', 'Four-door low credenza in smoked French oak featuring undulating fluted paneling and Calacatta marble top.', '210 x 50 x 78 cm', 'Smoked Oak, Calacatta Viola Marble, Soft-Close Hardware', 310000.00, TRUE),
    ('d0000000-0000-0000-0000-000000000006', 'MD-BED-006', 'Sienna Upholstered King Bed', 'Serenity', 'Bedroom', 'Sumptuous king bed with wrap-around winged headboard upholstered in sand linen with inset walnut trim.', '215 x 220 x 140 cm', 'Belgian Sand Linen, Solid American Walnut, Sprung Slats', 340000.00, TRUE),
    ('d0000000-0000-0000-0000-000000000007', 'MD-COF-007', 'Solstice Marble Tiered Coffee Table', 'Atelier Stone', 'Tables', 'Dual-height nesting coffee table with Nero Marquina black marble and brushed champagne gold frame.', '120 x 70 x 42 cm', 'Nero Marquina Marble, Champagne Gold Steel', 145000.00, TRUE),
    ('d0000000-0000-0000-0000-000000000008', 'MD-ACC-008', 'Eos Alabaster Vessel Lamp', 'Objet', 'Lighting', 'Solid Spanish alabaster table lamp with organic veining and integrated warm dimmable LED glow.', '28 x 28 x 45 cm', 'Natural Spanish Alabaster, Dimmer Switch', 78000.00, TRUE)
ON CONFLICT (sku) DO NOTHING;

-- 3. Initialize Stock Balances for the Catalogue Across Locations
INSERT INTO stock_balances (product_id, location_id, sellable_on_hand, active_reserved, damaged_count, quarantine_count)
VALUES
    -- Aura Sofa: 4 in Warehouse (1 reserved), 1 in Showroom 1
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 4, 1, 0, 0),
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 1, 0, 0, 0),
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 0, 0, 0, 0),
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 0, 0, 0, 0),

    -- Palais Velvet Chair: 6 in Warehouse, 2 in Showroom 1, 2 in Showroom 2, 1 in Showroom 3
    ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 6, 0, 0, 0),
    ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 2, 0, 0, 0),
    ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 2, 0, 0, 0),
    ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000004', 1, 0, 0, 0),

    -- Monolith Table: 2 in Warehouse (1 reserved), 1 in Showroom 1
    ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 2, 1, 0, 0),
    ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000002', 1, 0, 0, 0),

    -- Lumiere Chandelier: 3 in Warehouse, 1 in Showroom 2, 1 in Showroom 3
    ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 3, 0, 0, 0),
    ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000003', 1, 0, 0, 0),
    ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000004', 1, 0, 0, 0),

    -- Vesper Credenza: 0 locally stocked (Made to Order / Available to Order test case!)
    ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000001', 0, 0, 0, 0),
    ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 0, 0, 0, 0),

    -- Sienna Bed: 1 in Warehouse, 1 in Showroom 1
    ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000001', 1, 0, 0, 0),
    ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', 1, 0, 0, 0),

    -- Solstice Coffee Table: 4 in Warehouse, 2 in Showroom 2, 1 in Showroom 3
    ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001', 4, 0, 0, 0),
    ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000003', 2, 0, 0, 0),
    ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000004', 1, 0, 0, 0),

    -- Eos Lamp: 8 in Warehouse, 3 in Showroom 1, 3 in Showroom 2, 2 in Showroom 3
    ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000001', 8, 0, 0, 0),
    ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000002', 3, 0, 0, 0),
    ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000003', 3, 0, 0, 0),
    ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000004', 2, 0, 0, 0)
ON CONFLICT (product_id, location_id) DO NOTHING;

-- 4. Initial Recorded Stock Movement Ledger
INSERT INTO stock_movements (product_id, dest_location_id, movement_type, quantity, reference_no, reason)
VALUES
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'receipt', 5, 'MD-DEMO-2026-001', 'Demo opening balance'),
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'transfer_in', 1, 'TRF-DEMO-001', 'Demo move from Warehouse to Showroom 1'),
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'reservation_hold', 1, 'RES-DEMO-001', 'Demo customer hold');
END;
$demo$;
