import type { Product, Reservation, SalesOrder, SalesOrderLine, StockBalance } from '../types';

export interface FulfilmentPlan {
  balances: StockBalance[];
  lines: { line: SalesOrderLine; locationId: string }[];
}

export function planFulfilment(
  order: SalesOrder,
  balances: StockBalance[],
  reservations: Reservation[],
  products: Product[],
  now: string,
): FulfilmentPlan {
  if (['delivered', 'dispatched', 'cancelled'].includes(order.status)) {
    throw new Error(`Order cannot be fulfilled from ${order.status} status.`);
  }
  if (order.lines.length === 0) throw new Error('Order has no items to fulfil.');

  const updated = [...balances];
  const lines: FulfilmentPlan['lines'] = [];
  for (const line of order.lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new Error('Order contains an invalid quantity.');
    const holds = reservations.filter(reservation => reservation.orderId === order.id
      && reservation.productId === line.productId && reservation.status === 'active');
    if (holds.length > 1) throw new Error('Multiple active holds exist for one order item. Resolve them before fulfilment.');
    const hold = holds[0];
    if (hold && hold.quantity !== line.quantity) throw new Error('Held quantity does not match the order item. Resolve the hold first.');
    if (hold && new Date(hold.expiresAt).getTime() <= new Date(now).getTime()) {
      throw new Error('The stock hold has expired. Release it before fulfilment.');
    }
    const locationId = hold?.locationId || order.locationId;
    const index = updated.findIndex(balance => balance.productId === line.productId && balance.locationId === locationId);
    if (index < 0) throw new Error('No stock balance exists for an order item.');
    const balance = updated[index];
    const available = balance.sellableOnHand - balance.activeReserved;
    if (hold ? balance.activeReserved < line.quantity || balance.sellableOnHand < line.quantity : available < line.quantity) {
      throw new Error(`Insufficient stock to fulfil ${products.find(product => product.id === line.productId)?.sku || line.productId}.`);
    }
    updated[index] = {
      ...balance,
      sellableOnHand: balance.sellableOnHand - line.quantity,
      activeReserved: balance.activeReserved - (hold ? line.quantity : 0),
      updatedAt: now,
    };
    lines.push({ line, locationId });
  }
  return { balances: updated, lines };
}
