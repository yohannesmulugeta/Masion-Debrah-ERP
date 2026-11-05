import test from 'node:test';
import assert from 'node:assert/strict';
import { planFulfilment } from '../src/lib/stockOperations.ts';
import { previewCatalogueImport } from '../src/lib/catalogueImport.ts';

const now = '2026-11-05T12:00:00Z';
const product = { id: 'sofa', sku: 'SOFA-1' };
const order = (lines) => ({ id: 'order-1', status: 'reserved', locationId: 'showroom-1', lines });
const balance = (productId, sellableOnHand, activeReserved = 0) => ({ productId, locationId: 'showroom-1', sellableOnHand, activeReserved, updatedAt: now });

test('fulfilment rejects a missing second item without changing any balance', () => {
  const before = [balance('sofa', 2), balance('lamp', 0)];
  const snapshot = structuredClone(before);
  assert.throws(() => planFulfilment(order([
    { id: 'line-1', productId: 'sofa', quantity: 1 },
    { id: 'line-2', productId: 'lamp', quantity: 1 },
  ]), before, [], [product, { id: 'lamp', sku: 'LAMP-1' }], now), /Insufficient stock/);
  assert.deepEqual(before, snapshot);
});

test('fulfilment consumes a matching hold and physical unit once', () => {
  const hold = { id: 'hold-1', orderId: 'order-1', productId: 'sofa', locationId: 'showroom-1', quantity: 1, status: 'active', expiresAt: '2026-11-06T12:00:00Z' };
  const result = planFulfilment(order([{ id: 'line-1', productId: 'sofa', quantity: 1 }]), [balance('sofa', 2, 1)], [hold], [product], now);
  assert.equal(result.balances[0].sellableOnHand, 1);
  assert.equal(result.balances[0].activeReserved, 0);
  assert.equal(result.lines[0].locationId, 'showroom-1');
});

test('expired hold cannot be fulfilled as active stock', () => {
  const hold = { id: 'hold-1', orderId: 'order-1', productId: 'sofa', locationId: 'showroom-1', quantity: 1, status: 'active', expiresAt: '2026-11-04T12:00:00Z' };
  assert.throws(() => planFulfilment(order([{ id: 'line-1', productId: 'sofa', quantity: 1 }]), [balance('sofa', 1, 1)], [hold], [product], now), /expired/);
});

test('catalogue preview reports invalid rows and does not change current products', () => {
  const current = [{ id: 'existing', sku: 'SOFA-1' }];
  const preview = previewCatalogueImport([
    { sku: 'SOFA-1' },
    { sku: '' },
    { sku: 'NEW-1', name: 'New sofa', collection: '', category: 'Sofas', description: '', dimensions: '', materials: '', imageUrl: '', referencePrice: 100, isActive: true },
  ], current);
  assert.equal(preview.duplicates, 1);
  assert.equal(preview.blankSkus, 1);
  assert.equal(preview.validProducts.length, 1);
  assert.deepEqual(current, [{ id: 'existing', sku: 'SOFA-1' }]);
});
