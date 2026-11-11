import test from 'node:test';
import assert from 'node:assert/strict';
import { planFullRefund } from '../src/lib/financeOperations.ts';

const now = '2026-11-10T10:00:00Z';
const order = { id: 'order-1', status: 'partially_paid', paidAmount: 50 };
const payments = [{ id: 'pay-1', orderId: order.id, amount: 50 }];
const stock = [{ productId: 'sofa', locationId: 'warehouse', sellableOnHand: 2, activeReserved: 1, updatedAt: now }];
const holds = [{ id: 'hold-1', orderId: order.id, productId: 'sofa', locationId: 'warehouse', quantity: 1, status: 'active' }];

test('full pre-dispatch refund releases the reservation but preserves physical stock', () => {
  const result = planFullRefund(order, payments, [], [], stock, holds, 'REF-1', now);
  assert.equal(result.amount, 50);
  assert.equal(result.balances[0].sellableOnHand, 2);
  assert.equal(result.balances[0].activeReserved, 0);
  assert.equal(result.reservations[0].status, 'cancelled');
  assert.equal(stock[0].activeReserved, 1);
});

test('refund waits for delivery review once an item has left', () => {
  assert.throws(() => planFullRefund(order, payments, [], [{ orderId: order.id, status: 'dispatched' }], stock, holds, 'REF-1', now), /already dispatched/);
});

test('duplicate refund reference and inconsistent payment totals are rejected', () => {
  assert.throws(() => planFullRefund(order, payments, [{ referenceNo: 'ref-1' }], [], stock, holds, 'REF-1', now), /already recorded/);
  assert.throws(() => planFullRefund({ ...order, paidAmount: 60 }, payments, [], [], stock, holds, 'REF-2', now), /Payment totals need Finance review/);
});
