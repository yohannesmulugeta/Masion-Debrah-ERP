-- ============================================================================
-- MAISON DEBRAH ERP - MIGRATION 00002: ATOMIC TRANSACTIONS & INVARIANTS
-- Concurrency row-locking (FOR UPDATE), exact quantity preservation,
-- and automated balance reconciliation
-- ============================================================================

-- 1. Helper function: Ensure balance record exists
CREATE OR REPLACE FUNCTION fn_ensure_stock_balance(
    p_product_id UUID,
    p_location_id UUID
) RETURNS VOID AS $$
BEGIN
    INSERT INTO stock_balances (product_id, location_id, sellable_on_hand, active_reserved, damaged_count, quarantine_count)
    VALUES (p_product_id, p_location_id, 0, 0, 0, 0)
    ON CONFLICT (product_id, location_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 2. Post Goods Receipt (Stock Inflow)
CREATE OR REPLACE FUNCTION fn_post_receipt(
    p_product_id UUID,
    p_location_id UUID,
    p_quantity INT,
    p_reference TEXT,
    p_reason TEXT,
    p_actor_id UUID
) RETURNS VOID AS $$
DECLARE
    v_old_on_hand INT;
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Receipt quantity must be positive. Received: %', p_quantity;
    END IF;

    PERFORM fn_ensure_stock_balance(p_product_id, p_location_id);

    -- Row lock for concurrency safety
    SELECT sellable_on_hand INTO v_old_on_hand
    FROM stock_balances
    WHERE product_id = p_product_id AND location_id = p_location_id
    FOR UPDATE;

    UPDATE stock_balances
    SET sellable_on_hand = sellable_on_hand + p_quantity,
        updated_at = NOW()
    WHERE product_id = p_product_id AND location_id = p_location_id;

    -- Append-only movement ledger
    INSERT INTO stock_movements (
        product_id,
        dest_location_id,
        movement_type,
        quantity,
        reference_no,
        reason,
        created_by
    ) VALUES (
        p_product_id,
        p_location_id,
        'receipt',
        p_quantity,
        p_reference,
        p_reason,
        p_actor_id
    );

    -- Audit trail
    INSERT INTO audit_events (
        actor_id,
        action,
        entity_name,
        entity_id,
        old_values,
        new_values
    ) VALUES (
        p_actor_id,
        'RECEIPT_POSTED',
        'stock_balances',
        p_product_id,
        jsonb_build_object('location_id', p_location_id, 'sellable_on_hand', v_old_on_hand),
        jsonb_build_object('location_id', p_location_id, 'sellable_on_hand', v_old_on_hand + p_quantity, 'quantity_added', p_quantity)
    );
END;
$$ LANGUAGE plpgsql;

-- 3. Inter-Location Transfer (Warehouse <-> Showrooms)
-- Enforces: source balance falls, dest balance rises, local total is strictly conserved
CREATE OR REPLACE FUNCTION fn_post_transfer(
    p_product_id UUID,
    p_source_location_id UUID,
    p_dest_location_id UUID,
    p_quantity INT,
    p_reference TEXT,
    p_reason TEXT,
    p_actor_id UUID
) RETURNS VOID AS $$
DECLARE
    v_source_on_hand INT;
    v_source_reserved INT;
    v_source_available INT;
    v_lock_loc_1 UUID;
    v_lock_loc_2 UUID;
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Transfer quantity must be positive. Received: %', p_quantity;
    END IF;

    IF p_source_location_id = p_dest_location_id THEN
        RAISE EXCEPTION 'Source and destination locations cannot be identical.';
    END IF;

    PERFORM fn_ensure_stock_balance(p_product_id, p_source_location_id);
    PERFORM fn_ensure_stock_balance(p_product_id, p_dest_location_id);

    -- Deadlock prevention: sort location IDs
    IF p_source_location_id < p_dest_location_id THEN
        v_lock_loc_1 := p_source_location_id;
        v_lock_loc_2 := p_dest_location_id;
    ELSE
        v_lock_loc_1 := p_dest_location_id;
        v_lock_loc_2 := p_source_location_id;
    END IF;

    PERFORM 1 FROM stock_balances 
    WHERE product_id = p_product_id AND location_id IN (v_lock_loc_1, v_lock_loc_2)
    FOR UPDATE;

    -- Check source available stock
    SELECT sellable_on_hand, active_reserved, (sellable_on_hand - active_reserved)
    INTO v_source_on_hand, v_source_reserved, v_source_available
    FROM stock_balances
    WHERE product_id = p_product_id AND location_id = p_source_location_id;

    IF v_source_available < p_quantity THEN
        RAISE EXCEPTION 'Insufficient unreserved stock at source location. Available: %, Requested: %',
            v_source_available, p_quantity;
    END IF;

    -- Deduct from source
    UPDATE stock_balances
    SET sellable_on_hand = sellable_on_hand - p_quantity,
        updated_at = NOW()
    WHERE product_id = p_product_id AND location_id = p_source_location_id;

    -- Add to destination
    UPDATE stock_balances
    SET sellable_on_hand = sellable_on_hand + p_quantity,
        updated_at = NOW()
    WHERE product_id = p_product_id AND location_id = p_dest_location_id;

    -- Ledger entries
    INSERT INTO stock_movements (
        product_id,
        source_location_id,
        dest_location_id,
        movement_type,
        quantity,
        reference_no,
        reason,
        created_by
    ) VALUES (
        p_product_id,
        p_source_location_id,
        p_dest_location_id,
        'transfer_out',
        p_quantity,
        p_reference,
        p_reason,
        p_actor_id
    ), (
        p_product_id,
        p_source_location_id,
        p_dest_location_id,
        'transfer_in',
        p_quantity,
        p_reference,
        p_reason,
        p_actor_id
    );

    -- Audit trail
    INSERT INTO audit_events (
        actor_id,
        action,
        entity_name,
        entity_id,
        new_values
    ) VALUES (
        p_actor_id,
        'STOCK_TRANSFERRED',
        'stock_balances',
        p_product_id,
        jsonb_build_object(
            'source_location_id', p_source_location_id,
            'dest_location_id', p_dest_location_id,
            'quantity', p_quantity,
            'reference', p_reference
        )
    );
END;
$$ LANGUAGE plpgsql;

-- 4. Create Reservation (Holds stock for a pending customer order)
CREATE OR REPLACE FUNCTION fn_create_reservation(
    p_order_id UUID,
    p_product_id UUID,
    p_location_id UUID,
    p_quantity INT,
    p_expires_hours INT,
    p_actor_id UUID
) RETURNS UUID AS $$
DECLARE
    v_available INT;
    v_res_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Reservation quantity must be positive. Received: %', p_quantity;
    END IF;

    PERFORM fn_ensure_stock_balance(p_product_id, p_location_id);

    -- Lock row
    SELECT (sellable_on_hand - active_reserved) INTO v_available
    FROM stock_balances
    WHERE product_id = p_product_id AND location_id = p_location_id
    FOR UPDATE;

    IF v_available < p_quantity THEN
        RAISE EXCEPTION 'Cannot reserve: insufficient unreserved stock. Available: %, Requested: %',
            v_available, p_quantity;
    END IF;

    -- Increase active reserved
    UPDATE stock_balances
    SET active_reserved = active_reserved + p_quantity,
        updated_at = NOW()
    WHERE product_id = p_product_id AND location_id = p_location_id;

    v_expires_at := NOW() + (p_expires_hours || ' hours')::INTERVAL;

    -- Record reservation
    INSERT INTO reservations (
        order_id,
        product_id,
        location_id,
        quantity,
        status,
        expires_at
    ) VALUES (
        p_order_id,
        p_product_id,
        p_location_id,
        p_quantity,
        'active',
        v_expires_at
    ) RETURNING id INTO v_res_id;

    -- Ledger movement
    INSERT INTO stock_movements (
        product_id,
        source_location_id,
        movement_type,
        quantity,
        reference_no,
        reason,
        created_by
    ) VALUES (
        p_product_id,
        p_location_id,
        'reservation_hold',
        p_quantity,
        'RES-' || SUBSTRING(v_res_id::TEXT FROM 1 FOR 8),
        'Customer hold for order ' || p_order_id,
        p_actor_id
    );

    UPDATE sales_orders SET status = 'reserved' WHERE id = p_order_id;

    RETURN v_res_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Release / Cancel Reservation (Restores available quantity)
CREATE OR REPLACE FUNCTION fn_release_reservation(
    p_reservation_id UUID,
    p_reason TEXT,
    p_actor_id UUID
) RETURNS VOID AS $$
DECLARE
    v_res reservations%ROWTYPE;
BEGIN
    SELECT * INTO v_res
    FROM reservations
    WHERE id = p_reservation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation % not found', p_reservation_id;
    END IF;

    IF v_res.status != 'active' THEN
        RAISE EXCEPTION 'Reservation is not active (current status: %)', v_res.status;
    END IF;

    -- Lock and reduce active_reserved
    UPDATE stock_balances
    SET active_reserved = active_reserved - v_res.quantity,
        updated_at = NOW()
    WHERE product_id = v_res.product_id AND location_id = v_res.location_id;

    UPDATE reservations
    SET status = 'cancelled',
        released_at = NOW(),
        released_by = p_actor_id
    WHERE id = p_reservation_id;

    INSERT INTO stock_movements (
        product_id,
        dest_location_id,
        movement_type,
        quantity,
        reference_no,
        reason,
        created_by
    ) VALUES (
        v_res.product_id,
        v_res.location_id,
        'reservation_release',
        v_res.quantity,
        'REL-' || SUBSTRING(p_reservation_id::TEXT FROM 1 FOR 8),
        p_reason,
        p_actor_id
    );
END;
$$ LANGUAGE plpgsql;

-- 6. Fulfil Sales Order (Single-Deduction Invariant)
-- A sale allocated from a reservation consumes that reservation AND physical on-hand ONCE, never twice!
CREATE OR REPLACE FUNCTION fn_fulfil_sales_order(
    p_order_id UUID,
    p_actor_id UUID
) RETURNS VOID AS $$
DECLARE
    v_order sales_orders%ROWTYPE;
    v_line RECORD;
    v_res reservations%ROWTYPE;
    v_available INT;
BEGIN
    SELECT * INTO v_order
    FROM sales_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sales order % not found', p_order_id;
    END IF;

    IF v_order.status IN ('delivered', 'dispatched', 'cancelled') THEN
        RAISE EXCEPTION 'Order cannot be fulfilled in status: %', v_order.status;
    END IF;

    -- For every line item in the order
    FOR v_line IN
        SELECT product_id, quantity
        FROM sales_order_lines
        WHERE order_id = p_order_id
    LOOP
        -- Check if an active reservation exists for this order & product
        SELECT * INTO v_res
        FROM reservations
        WHERE order_id = p_order_id
          AND product_id = v_line.product_id
          AND status = 'active'
        LIMIT 1
        FOR UPDATE;

        IF FOUND THEN
            -- Consume active reservation AND decrement physical stock simultaneously
            UPDATE stock_balances
            SET sellable_on_hand = sellable_on_hand - v_line.quantity,
                active_reserved = active_reserved - v_line.quantity,
                updated_at = NOW()
            WHERE product_id = v_line.product_id AND location_id = v_res.location_id;

            UPDATE reservations
            SET status = 'fulfilled',
                released_at = NOW(),
                released_by = p_actor_id
            WHERE id = v_res.id;
        ELSE
            -- Direct sale without prior reservation: check available stock
            SELECT (sellable_on_hand - active_reserved) INTO v_available
            FROM stock_balances
            WHERE product_id = v_line.product_id AND location_id = v_order.location_id
            FOR UPDATE;

            IF v_available < v_line.quantity THEN
                RAISE EXCEPTION 'Insufficient stock to fulfil product %. Available: %, Required: %',
                    v_line.product_id, v_available, v_line.quantity;
            END IF;

            UPDATE stock_balances
            SET sellable_on_hand = sellable_on_hand - v_line.quantity,
                updated_at = NOW()
            WHERE product_id = v_line.product_id AND location_id = v_order.location_id;
        END IF;

        -- Record movement in ledger
        INSERT INTO stock_movements (
            product_id,
            source_location_id,
            movement_type,
            quantity,
            reference_no,
            reason,
            created_by
        ) VALUES (
            v_line.product_id,
            COALESCE(v_res.location_id, v_order.location_id),
            'sale_fulfilment',
            v_line.quantity,
            v_order.order_number,
            'Fulfilment of sales order ' || v_order.order_number,
            p_actor_id
        );
    END LOOP;

    UPDATE sales_orders
    SET status = 'delivered',
        updated_at = NOW()
    WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Record Payment & Derive Order Balances
CREATE OR REPLACE FUNCTION fn_record_payment(
    p_order_id UUID,
    p_amount NUMERIC(12, 2),
    p_payment_method payment_method,
    p_reference TEXT,
    p_notes TEXT,
    p_recorded_by UUID
) RETURNS UUID AS $$
DECLARE
    v_pay_id UUID;
    v_total NUMERIC(12, 2);
    v_new_paid NUMERIC(12, 2);
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero. Received: %', p_amount;
    END IF;

    -- Lock sales order
    SELECT total_amount, paid_amount INTO v_total, v_new_paid
    FROM sales_orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sales order % not found', p_order_id;
    END IF;

    v_new_paid := v_new_paid + p_amount;

    INSERT INTO payments (
        order_id,
        amount,
        payment_method,
        reference_no,
        notes,
        recorded_by
    ) VALUES (
        p_order_id,
        p_amount,
        p_payment_method,
        p_reference,
        p_notes,
        p_recorded_by
    ) RETURNING id INTO v_pay_id;

    -- Update order status
    UPDATE sales_orders
    SET paid_amount = v_new_paid,
        status = CASE 
            WHEN v_new_paid >= v_total THEN 'paid'::order_status
            ELSE 'partially_paid'::order_status
        END,
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN v_pay_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Authorized Stock Adjustment (Manager/Admin approval only)
CREATE OR REPLACE FUNCTION fn_record_stock_adjustment(
    p_product_id UUID,
    p_location_id UUID,
    p_new_quantity INT,
    p_reason TEXT,
    p_approved_by UUID
) RETURNS VOID AS $$
DECLARE
    v_role staff_role;
    v_old_on_hand INT;
    v_active_reserved INT;
    v_delta INT;
BEGIN
    -- Verify authority
    SELECT role INTO v_role
    FROM staff_profiles
    WHERE id = p_approved_by;

    IF v_role NOT IN ('admin', 'manager') THEN
        RAISE EXCEPTION 'Unauthorized: only managers and administrators can approve inventory adjustments.';
    END IF;

    PERFORM fn_ensure_stock_balance(p_product_id, p_location_id);

    SELECT sellable_on_hand, active_reserved INTO v_old_on_hand, v_active_reserved
    FROM stock_balances
    WHERE product_id = p_product_id AND location_id = p_location_id
    FOR UPDATE;

    IF p_new_quantity < v_active_reserved THEN
        RAISE EXCEPTION 'New quantity (%) cannot be lower than active reservations (%). Release holds first.',
            p_new_quantity, v_active_reserved;
    END IF;

    v_delta := p_new_quantity - v_old_on_hand;

    UPDATE stock_balances
    SET sellable_on_hand = p_new_quantity,
        updated_at = NOW()
    WHERE product_id = p_product_id AND location_id = p_location_id;

    INSERT INTO stock_movements (
        product_id,
        dest_location_id,
        movement_type,
        quantity,
        reference_no,
        reason,
        created_by
    ) VALUES (
        p_product_id,
        p_location_id,
        'count_adjustment',
        ABS(v_delta),
        'ADJ-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS'),
        p_reason || ' (adjusted from ' || v_old_on_hand || ' to ' || p_new_quantity || ')',
        p_approved_by
    );

    INSERT INTO audit_events (
        actor_id,
        action,
        entity_name,
        entity_id,
        old_values,
        new_values
    ) VALUES (
        p_approved_by,
        'INVENTORY_ADJUSTED',
        'stock_balances',
        p_product_id,
        jsonb_build_object('sellable_on_hand', v_old_on_hand),
        jsonb_build_object('sellable_on_hand', p_new_quantity, 'delta', v_delta, 'reason', p_reason)
    );
END;
$$ LANGUAGE plpgsql;
