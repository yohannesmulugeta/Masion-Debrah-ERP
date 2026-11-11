import type { DeliveryRecord, Reservation, SalesOrder, StockBalance } from '../types';

export interface DispatchPlan {
  balances: StockBalance[];
  reservations: Reservation[];
  sourceLocationId: string;
}

export function remainingToDispatch(order: SalesOrder, lineId: string, deliveries: DeliveryRecord[]): number {
  const line = order.lines.find(item => item.id === lineId);
  if (!line) return 0;
  const released = deliveries
    .filter(record => record.orderId === order.id && record.lineId === lineId && record.status !== 'returned_for_review')
    .reduce((sum, record) => sum + record.quantity, 0);
  return Math.max(0, line.quantity - released);
}

export function deliveryStatus(order: SalesOrder, deliveries: DeliveryRecord[]): SalesOrder['status'] {
  const own = deliveries.filter(record => record.orderId === order.id && record.status !== 'returned_for_review');
  const total = order.lines.reduce((sum, line) => sum + line.quantity, 0);
  const released = own.reduce((sum, record) => sum + record.quantity, 0);
  const signed = own.filter(record => record.status === 'delivered').reduce((sum, record) => sum + record.quantity, 0);
  if (total > 0 && signed === total) return 'delivered';
  if (total > 0 && released === total) return 'dispatched';
  if (released > 0) return 'partially_dispatched';
  return 'paid';
}

export function planDispatch(
  order: SalesOrder,
  lineId: string,
  quantity: number,
  locationId: string,
  balances: StockBalance[],
  reservations: Reservation[],
  deliveries: DeliveryRecord[],
  now: string,
): DispatchPlan {
  if (order.status === 'cancelled' || order.status === 'delivered') throw new Error('This order cannot be dispatched.');
  if (order.balanceDue > 0 || order.paidAmount < order.totalAmount) throw new Error('Finance must confirm the full order balance before release.');
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Enter a positive whole quantity.');
  const line = order.lines.find(item => item.id === lineId);
  if (!line) throw new Error('Choose an item on this order.');
  if (quantity > remainingToDispatch(order, lineId, deliveries)) throw new Error('Quantity exceeds the undelivered order line.');

  const holds = reservations.filter(item => item.orderId === order.id && item.productId === line.productId && item.status === 'active');
  if (holds.length > 1) throw new Error('Multiple active reservations require review before dispatch.');
  const hold = holds[0];
  if (hold && hold.locationId !== locationId) throw new Error('Release the item from its reserved area.');
  if (hold && new Date(hold.expiresAt).getTime() <= new Date(now).getTime()) throw new Error('Reservation is past the agreed collection date. Review or extend it first.');
  if (hold && hold.quantity < quantity) throw new Error('Dispatch the reserved quantity first, then dispatch remaining units separately.');

  const index = balances.findIndex(item => item.productId === line.productId && item.locationId === locationId);
  if (index < 0) throw new Error('No stock is recorded in the selected area.');
  const balance = balances[index];
  const available = balance.sellableOnHand - balance.activeReserved;
  if (hold ? balance.activeReserved < quantity || balance.sellableOnHand < quantity : available < quantity) {
    throw new Error('Insufficient available stock in the selected area.');
  }

  const nextBalances = [...balances];
  nextBalances[index] = {
    ...balance,
    sellableOnHand: balance.sellableOnHand - quantity,
    activeReserved: balance.activeReserved - (hold ? quantity : 0),
    updatedAt: now,
  };
  const nextReservations = hold ? reservations.map(item => item.id === hold.id
    ? { ...item, quantity: item.quantity - quantity, status: item.quantity === quantity ? 'fulfilled' as const : item.status }
    : item) : reservations;

  return { balances: nextBalances, reservations: nextReservations, sourceLocationId: locationId };
}
