import type { Tables } from '../types/database.generated';

type Order = Tables<'sales_orders'>;
type Reservation = Tables<'reservations'>;
type Delivery = Tables<'deliveries'>;

export type OrderNextStep = {
  title: string;
  detail: string;
  area: 'finance' | 'reservations' | 'deliveries' | null;
  tone: 'neutral' | 'attention' | 'ready';
};

export function getOrderNextStep(
  order: Pick<Order, 'status' | 'balance_due' | 'paid_amount'>,
  reservations: Pick<Reservation, 'status' | 'review_at' | 'expires_at'>[],
  deliveries: Pick<Delivery, 'delivery_status'>[],
  now = Date.now(),
): OrderNextStep {
  if (order.status === 'cancelled' || order.status === 'refunded') {
    return { title: 'Order closed', detail: 'Review its payment and delivery history below.', area: null, tone: 'neutral' };
  }
  if (order.status === 'delivered') {
    return { title: 'Handover recorded', detail: 'The signed handover reference is below. The agreed no-refund rule now applies.', area: null, tone: 'ready' };
  }
  if (deliveries.some(item => item.delivery_status === 'failed')) {
    return { title: 'Receive failed delivery', detail: 'Stock must receive the item into quarantine before another decision.', area: 'deliveries', tone: 'attention' };
  }
  if (deliveries.some(item => item.delivery_status === 'out_for_delivery')) {
    return { title: 'Await signed handover', detail: 'Record the recipient and signed document reference when the item is received.', area: 'deliveries', tone: 'attention' };
  }
  if ((order.balance_due ?? 0) > 0) {
    const activeHolds = reservations.filter(item => item.status === 'active');
    if (activeHolds.length) {
      const holdDue = activeHolds.some(item => new Date(item.review_at ?? item.expires_at).getTime() <= now);
      return holdDue
        ? { title: 'Review deposit reservation', detail: 'Discuss payment or an agreed extension with the customer. Finance handles any refund.', area: 'reservations', tone: 'attention' }
        : { title: 'Deposit reservation active', detail: 'Follow up on the agreed review date. The full balance must be recorded before dispatch.', area: 'reservations', tone: 'neutral' };
    }
    return {
      title: order.paid_amount > 0 ? 'Balance awaiting Finance' : 'Payment awaiting Finance',
      detail: order.paid_amount > 0
        ? 'Finance records and confirms the remaining balance before dispatch.'
        : 'Finance records and confirms the payment before any dispatch.',
      area: 'finance', tone: 'attention',
    };
  }
  if (deliveries.some(item => item.delivery_status === 'returned_for_review')) {
    return { title: 'Review returned item', detail: 'The item is in quarantine. Check the delivery record before arranging another dispatch.', area: 'deliveries', tone: 'attention' };
  }
  return { title: 'Ready for stock preparation', detail: 'The full balance is recorded. Stock checks the exact item and available area before dispatch.', area: 'deliveries', tone: 'ready' };
}
