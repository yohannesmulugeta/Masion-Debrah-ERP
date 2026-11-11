import type { DeliveryRecord, Payment, RefundRecord, Reservation, SalesOrder, StockBalance } from '../types';

export interface RefundPlan {
  amount: number;
  activeHolds: Reservation[];
  balances: StockBalance[];
  reservations: Reservation[];
}

export function planFullRefund(
  order: SalesOrder,
  payments: Payment[],
  refunds: RefundRecord[],
  deliveries: DeliveryRecord[],
  balances: StockBalance[],
  reservations: Reservation[],
  referenceNo: string,
  now: string,
): RefundPlan {
  if (order.status === 'cancelled') throw new Error('This order is already cancelled.');
  if (deliveries.some(item => item.orderId === order.id)) throw new Error('An item was already dispatched. Resolve delivery before a refund.');
  const reference = referenceNo.trim().toLowerCase();
  if (!reference) throw new Error('Enter a refund transaction reference.');
  if (refunds.some(item => item.referenceNo.trim().toLowerCase() === reference)) throw new Error('This refund reference is already recorded.');

  const amount = payments.filter(item => item.orderId === order.id).reduce((sum, item) => sum + item.amount, 0);
  if (amount <= 0 || Math.abs(amount - order.paidAmount) > 0.001) throw new Error('Payment totals need Finance review before refund.');

  const activeHolds = reservations.filter(item => item.orderId === order.id && item.status === 'active');
  const nextBalances = balances.map(balance => {
    const released = activeHolds
      .filter(hold => hold.productId === balance.productId && hold.locationId === balance.locationId)
      .reduce((sum, hold) => sum + hold.quantity, 0);
    if (released > balance.activeReserved) throw new Error('Reservation balance needs review before refund.');
    return released ? { ...balance, activeReserved: balance.activeReserved - released, updatedAt: now } : balance;
  });
  for (const hold of activeHolds) {
    if (!balances.some(balance => balance.productId === hold.productId && balance.locationId === hold.locationId)) {
      throw new Error('Reservation balance needs review before refund.');
    }
  }

  return {
    amount,
    activeHolds,
    balances: nextBalances,
    reservations: reservations.map(item => item.orderId === order.id && item.status === 'active' ? { ...item, status: 'cancelled' as const } : item),
  };
}
