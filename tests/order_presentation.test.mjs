import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrderNextStep } from '../src/live/orderPresentation.ts';

const now = Date.parse('2026-11-11T12:00:00Z');
const order = (status, paid_amount, balance_due) => ({ status, paid_amount, balance_due });
const hold = (review_at) => ({ status: 'active', review_at, expires_at: '2026-11-13T12:00:00Z' });
const delivery = (delivery_status) => ({ delivery_status });

test('unpaid order sends staff to Finance before dispatch', () => {
  const next = getOrderNextStep(order('confirmed', 0, 5000), [], [], now);
  assert.equal(next.area, 'finance');
  assert.match(next.title, /Payment awaiting Finance/);
});

test('deposit reservation due for review takes priority over collecting the balance', () => {
  const next = getOrderNextStep(order('partially_paid', 1000, 4000),
    [hold('2026-11-10T12:00:00Z')], [], now);
  assert.equal(next.area, 'reservations');
});

test('future deposit reservation remains active until its review date', () => {
  const next = getOrderNextStep(order('partially_paid', 1000, 4000),
    [hold('2026-11-12T12:00:00Z')], [], now);
  assert.equal(next.area, 'reservations');
  assert.match(next.title, /reservation active/);
});

test('full payment makes stock preparation the next step', () => {
  const next = getOrderNextStep(order('paid', 5000, 0), [], [], now);
  assert.equal(next.area, 'deliveries');
  assert.match(next.title, /Ready for stock preparation/);
});

test('failed delivery goes to quarantine workflow', () => {
  const next = getOrderNextStep(order('dispatched', 5000, 0), [], [delivery('failed')], now);
  assert.equal(next.area, 'deliveries');
  assert.match(next.detail, /quarantine/);
});

test('out-for-delivery order waits for signed handover', () => {
  const next = getOrderNextStep(order('dispatched', 5000, 0), [], [delivery('out_for_delivery')], now);
  assert.match(next.title, /signed handover/);
});

test('completed handover does not suggest another operational action', () => {
  const next = getOrderNextStep(order('delivered', 5000, 0), [], [delivery('delivered')], now);
  assert.equal(next.area, null);
});
