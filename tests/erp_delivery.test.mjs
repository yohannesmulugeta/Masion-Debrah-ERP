import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryStatus, planDispatch, remainingToDispatch } from '../src/lib/deliveryOperations.ts';

const now = '2026-11-10T10:00:00Z';
const line = { id: 'line-1', orderId: 'order-1', productId: 'sofa', quantity: 2, unitPrice: 100, lineTotal: 200 };
const paidOrder = { id: 'order-1', status: 'paid', totalAmount: 200, paidAmount: 200, balanceDue: 0, lines: [line] };
const stock = { productId: 'sofa', locationId: 'warehouse', sellableOnHand: 2, activeReserved: 2, damagedCount: 0, quarantineCount: 0, updatedAt: now };
const hold = { id: 'hold-1', orderId: 'order-1', productId: 'sofa', locationId: 'warehouse', quantity: 2, status: 'active', expiresAt: '2026-11-20T10:00:00Z', createdAt: now };

test('unpaid order cannot release a luxury item', () => {
  const unpaid = { ...paidOrder, status: 'partially_paid', paidAmount: 100, balanceDue: 100 };
  assert.throws(() => planDispatch(unpaid, line.id, 1, 'warehouse', [stock], [hold], [], now), /full order balance/);
});

test('partial dispatch consumes one physical and reserved unit, leaving the rest open', () => {
  const result = planDispatch(paidOrder, line.id, 1, 'warehouse', [stock], [hold], [], now);
  assert.equal(result.balances[0].sellableOnHand, 1);
  assert.equal(result.balances[0].activeReserved, 1);
  assert.equal(result.reservations[0].quantity, 1);
  assert.equal(result.reservations[0].status, 'active');
  assert.equal(stock.sellableOnHand, 2);
});

test('dispatch is not a signed delivery and released quantity cannot be released twice', () => {
  const dispatched = { id: 'delivery-1', orderId: paidOrder.id, lineId: line.id, productId: 'sofa', quantity: 2, status: 'dispatched' };
  assert.equal(remainingToDispatch(paidOrder, line.id, [dispatched]), 0);
  assert.equal(deliveryStatus(paidOrder, [dispatched]), 'dispatched');
  assert.throws(() => planDispatch(paidOrder, line.id, 1, 'warehouse', [stock], [hold], [dispatched], now), /undelivered order line/);
  assert.equal(deliveryStatus(paidOrder, [{ ...dispatched, status: 'delivered' }]), 'delivered');
});

test('failed delivery remains out of stock until physically received for review', () => {
  const failed = { id: 'delivery-1', orderId: paidOrder.id, lineId: line.id, productId: 'sofa', quantity: 2, status: 'failed' };
  assert.equal(remainingToDispatch(paidOrder, line.id, [failed]), 0);
  assert.equal(deliveryStatus(paidOrder, [failed]), 'dispatched');
  assert.equal(remainingToDispatch(paidOrder, line.id, [{ ...failed, status: 'returned_for_review' }]), 2);
});
