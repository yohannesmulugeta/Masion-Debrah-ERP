import test from 'node:test';
import assert from 'node:assert/strict';

// Business logic simulator validating database constraints & invariants
class InventoryEngine {
  constructor() {
    this.locations = new Map();
    this.products = new Map();
    this.balances = new Map(); // key: `${productId}:${locationId}`
    this.movements = [];
    this.reservations = new Map();
    this.orders = new Map();
    this.payments = [];
  }

  addLocation(id, code, name, type, isCustomerAvailable = true) {
    this.locations.set(id, { id, code, name, type, isCustomerAvailable });
  }

  addProduct(id, sku, name, price) {
    if (!sku || sku.trim() === '') {
      throw new Error('SKU cannot be blank');
    }
    this.products.set(id, { id, sku, name, price });
  }

  getBalance(productId, locationId) {
    const key = `${productId}:${locationId}`;
    if (!this.balances.has(key)) {
      this.balances.set(key, { sellableOnHand: 0, activeReserved: 0 });
    }
    return this.balances.get(key);
  }

  getAvailable(productId, locationId) {
    const b = this.getBalance(productId, locationId);
    return b.sellableOnHand - b.activeReserved;
  }

  receiveStock(productId, locationId, quantity, ref, reason, actor) {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    const b = this.getBalance(productId, locationId);
    b.sellableOnHand += quantity;
    this.movements.push({
      type: 'receipt',
      productId,
      destLocationId: locationId,
      quantity,
      ref,
      reason,
      actor
    });
  }

  transferStock(productId, srcId, destId, quantity, ref, reason, actor) {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    if (srcId === destId) throw new Error('Source and dest cannot be identical');
    
    const src = this.getBalance(productId, srcId);
    const dest = this.getBalance(productId, destId);
    
    const available = src.sellableOnHand - src.activeReserved;
    if (available < quantity) {
      throw new Error(`Insufficient unreserved stock at source. Available: ${available}, Requested: ${quantity}`);
    }

    src.sellableOnHand -= quantity;
    dest.sellableOnHand += quantity;

    this.movements.push(
      { type: 'transfer_out', productId, srcId, destId, quantity, ref, reason, actor },
      { type: 'transfer_in', productId, srcId, destId, quantity, ref, reason, actor }
    );
  }

  createReservation(orderId, productId, locationId, quantity, actor) {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    const b = this.getBalance(productId, locationId);
    const available = b.sellableOnHand - b.activeReserved;
    
    if (available < quantity) {
      throw new Error(`Cannot reserve: insufficient stock. Available: ${available}, Requested: ${quantity}`);
    }

    b.activeReserved += quantity;
    const resId = `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.reservations.set(resId, {
      id: resId,
      orderId,
      productId,
      locationId,
      quantity,
      status: 'active'
    });

    this.movements.push({
      type: 'reservation_hold',
      productId,
      locationId,
      quantity,
      ref: resId,
      actor
    });

    return resId;
  }

  releaseReservation(resId, reason, actor) {
    const res = this.reservations.get(resId);
    if (!res || res.status !== 'active') throw new Error('Invalid reservation');

    const b = this.getBalance(res.productId, res.locationId);
    b.activeReserved -= res.quantity;
    res.status = 'cancelled';

    this.movements.push({
      type: 'reservation_release',
      productId: res.productId,
      locationId: res.locationId,
      quantity: res.quantity,
      ref: resId,
      reason,
      actor
    });
  }

  fulfilOrder(orderId, lines, actor) {
    for (const line of lines) {
      // Find active reservation
      let activeRes = null;
      for (const res of this.reservations.values()) {
        if (res.orderId === orderId && res.productId === line.productId && res.status === 'active') {
          activeRes = res;
          break;
        }
      }

      if (activeRes) {
        const b = this.getBalance(line.productId, activeRes.locationId);
        // Single deduction: reduce on-hand AND reduce hold simultaneously
        b.sellableOnHand -= line.quantity;
        b.activeReserved -= line.quantity;
        activeRes.status = 'fulfilled';

        this.movements.push({
          type: 'sale_fulfilment',
          productId: line.productId,
          locationId: activeRes.locationId,
          quantity: line.quantity,
          ref: orderId,
          actor
        });
      } else {
        const b = this.getBalance(line.productId, line.locationId);
        const available = b.sellableOnHand - b.activeReserved;
        if (available < line.quantity) {
          throw new Error('Insufficient stock for fulfilment');
        }
        b.sellableOnHand -= line.quantity;

        this.movements.push({
          type: 'sale_fulfilment',
          productId: line.productId,
          locationId: line.locationId,
          quantity: line.quantity,
          ref: orderId,
          actor
        });
      }
    }
  }

  // Pure public availability view simulator (matching v_public_product_availability)
  getPublicAvailability(sku) {
    let product = null;
    for (const p of this.products.values()) {
      if (p.sku === sku) {
        product = p;
        break;
      }
    }
    if (!product) return null;

    let totalCustomerSellable = 0;
    for (const loc of this.locations.values()) {
      if (loc.isCustomerAvailable) {
        const b = this.getBalance(product.id, loc.id);
        const avail = Math.max(0, b.sellableOnHand - b.activeReserved);
        totalCustomerSellable += avail;
      }
    }

    return {
      sku: product.sku,
      name: product.name,
      status: totalCustomerSellable > 0 ? 'in_stock' : 'available_to_order'
    };
  }
}

// ============================================================================
// TEST CASES
// ============================================================================

test('Stock Invariant 1: Available quantity strictly equals sellable_on_hand minus active_reserved', () => {
  const engine = new InventoryEngine();
  engine.addLocation('loc-wh', 'WH-1', 'Central WH', 'warehouse');
  engine.addProduct('p-1', 'MD-SOF-001', 'Boucle Sofa', 285000);

  engine.receiveStock('p-1', 'loc-wh', 5, 'PO-100', 'Opening balance', 'staff-1');
  assert.equal(engine.getBalance('p-1', 'loc-wh').sellableOnHand, 5);
  assert.equal(engine.getBalance('p-1', 'loc-wh').activeReserved, 0);
  assert.equal(engine.getAvailable('p-1', 'loc-wh'), 5);

  const resId = engine.createReservation('ord-1', 'p-1', 'loc-wh', 2, 'staff-1');
  assert.equal(engine.getBalance('p-1', 'loc-wh').sellableOnHand, 5); // physical on-hand unchanged
  assert.equal(engine.getBalance('p-1', 'loc-wh').activeReserved, 2);  // hold increased
  assert.equal(engine.getAvailable('p-1', 'loc-wh'), 3);             // available reduced

  engine.releaseReservation(resId, 'Customer changed mind', 'staff-1');
  assert.equal(engine.getBalance('p-1', 'loc-wh').activeReserved, 0);
  assert.equal(engine.getAvailable('p-1', 'loc-wh'), 5);             // restored
});

test('Stock Invariant 2: Over-reservation is strictly rejected', () => {
  const engine = new InventoryEngine();
  engine.addLocation('loc-sr1', 'SR-1', 'Bole Showroom', 'showroom');
  engine.addProduct('p-1', 'MD-CHR-002', 'Velvet Chair', 125000);

  engine.receiveStock('p-1', 'loc-sr1', 1, 'PO-101', 'Showroom delivery', 'staff-1');
  assert.equal(engine.getAvailable('p-1', 'loc-sr1'), 1);

  // Reserve the only 1 available unit
  engine.createReservation('ord-2', 'p-1', 'loc-sr1', 1, 'staff-1');

  // Attempt to reserve a 2nd unit must throw
  assert.throws(() => {
    engine.createReservation('ord-3', 'p-1', 'loc-sr1', 1, 'staff-1');
  }, /Cannot reserve: insufficient stock/);
});

test('Stock Invariant 3: Inter-location transfer strictly conserves total quantity', () => {
  const engine = new InventoryEngine();
  engine.addLocation('loc-wh', 'WH-1', 'Central WH', 'warehouse');
  engine.addLocation('loc-sr1', 'SR-1', 'Bole Showroom', 'showroom');
  engine.addProduct('p-1', 'MD-TBL-003', 'Dining Table', 390000);

  engine.receiveStock('p-1', 'loc-wh', 10, 'PO-102', 'Container arrival', 'staff-1');
  
  const totalBefore = engine.getBalance('p-1', 'loc-wh').sellableOnHand + engine.getBalance('p-1', 'loc-sr1').sellableOnHand;
  assert.equal(totalBefore, 10);

  // Transfer 4 units from WH to Showroom 1
  engine.transferStock('p-1', 'loc-wh', 'loc-sr1', 4, 'TRF-001', 'Showroom stock replenishment', 'staff-1');

  assert.equal(engine.getBalance('p-1', 'loc-wh').sellableOnHand, 6);
  assert.equal(engine.getBalance('p-1', 'loc-sr1').sellableOnHand, 4);

  const totalAfter = engine.getBalance('p-1', 'loc-wh').sellableOnHand + engine.getBalance('p-1', 'loc-sr1').sellableOnHand;
  assert.equal(totalAfter, 10, 'Total stock across locations must remain strictly conserved');
});

test('Stock Invariant 4: Order fulfilment from reservation deducts once, avoiding double reduction', () => {
  const engine = new InventoryEngine();
  engine.addLocation('loc-wh', 'WH-1', 'Central WH', 'warehouse');
  engine.addProduct('p-1', 'MD-LGT-004', 'Opal Chandelier', 165000);

  engine.receiveStock('p-1', 'loc-wh', 2, 'PO-103', 'Receipt', 'staff-1');
  
  // Reserve 1 unit
  engine.createReservation('ord-4', 'p-1', 'loc-wh', 1, 'staff-1');
  assert.equal(engine.getBalance('p-1', 'loc-wh').sellableOnHand, 2);
  assert.equal(engine.getBalance('p-1', 'loc-wh').activeReserved, 1);
  assert.equal(engine.getAvailable('p-1', 'loc-wh'), 1);

  // Fulfil order
  engine.fulfilOrder('ord-4', [{ productId: 'p-1', quantity: 1, locationId: 'loc-wh' }], 'staff-1');

  // Physical on-hand decreases by 1, reservation is released (decreases by 1)
  assert.equal(engine.getBalance('p-1', 'loc-wh').sellableOnHand, 1);
  assert.equal(engine.getBalance('p-1', 'loc-wh').activeReserved, 0);
  assert.equal(engine.getAvailable('p-1', 'loc-wh'), 1, 'Remaining available stock is preserved without double-deduction');
});

test('Website Status Invariant: Public availability view only marks "in_stock" when positive unreserved sellable stock exists', () => {
  const engine = new InventoryEngine();
  engine.addLocation('loc-wh', 'WH-1', 'Central WH', 'warehouse', true);
  engine.addLocation('loc-sr1', 'SR-1', 'Bole Showroom', 'showroom', true);
  
  engine.addProduct('p-stocked', 'MD-CRD-005', 'Credenza', 310000);
  engine.addProduct('p-zero', 'MD-BED-006', 'King Bed', 340000);

  // Receive 1 unit of credenza
  engine.receiveStock('p-stocked', 'loc-wh', 1, 'PO-104', 'Opening balance', 'staff-1');

  // Credenza is in stock
  const feedStocked = engine.getPublicAvailability('MD-CRD-005');
  assert.equal(feedStocked.status, 'in_stock');

  // Reserve the only unit
  engine.createReservation('ord-5', 'p-stocked', 'loc-wh', 1, 'staff-1');

  // Immediately flips to available_to_order (Website shows: "Ask about ordering")
  const feedStockedAfterHold = engine.getPublicAvailability('MD-CRD-005');
  assert.equal(feedStockedAfterHold.status, 'available_to_order', 'When unreserved stock reaches 0, public status must immediately switch to available_to_order');

  // Product with zero stock starts as available_to_order
  const feedZero = engine.getPublicAvailability('MD-BED-006');
  assert.equal(feedZero.status, 'available_to_order');

  // Unknown or blank SKU returns null (never false positive name match)
  assert.equal(engine.getPublicAvailability('UNKNOWN-SKU'), null);
});
