import { useMemo } from 'react';
import { ArrowRight, CheckCircle2, Clock3, PackageCheck } from 'lucide-react';
import type { Tables } from '../types/database.generated';
import type { LiveTab } from './LiveShell';
import { getOrderNextStep } from './orderPresentation';

type Order = Tables<'sales_orders'>;
type Line = Tables<'sales_order_lines'>;
type Product = Tables<'products'>;
type Balance = Tables<'stock_balances'>;
type Location = Tables<'locations'>;
type Customer = Tables<'customers'>;
type Payment = Tables<'payments'>;
type Reservation = Tables<'reservations'>;
type Delivery = Tables<'deliveries'>;
type Evidence = Tables<'erp_evidence'>;
type Refund = Tables<'refunds'>;

type Props = {
  order: Order;
  lines: Line[];
  products: Product[];
  balances: Balance[];
  locations: Location[];
  customer: Customer | undefined;
  payments: Payment[];
  reservations: Reservation[];
  deliveries: Delivery[];
  evidence: Evidence[];
  refunds: Refund[];
  canViewPaymentEvidence: boolean;
  onNavigate: (tab: LiveTab) => void;
};

const money = (amount: number | null | undefined) => `${Number(amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : '—';
const label = (value: string) => value.replaceAll('_', ' ');

export function OrderDetail({ order, lines, products, balances, locations, customer, payments,
  reservations, deliveries, evidence, refunds, canViewPaymentEvidence, onNavigate }: Props) {
  const next = getOrderNextStep(order, reservations, deliveries);
  const isClosed = order.status === 'cancelled' || order.status === 'refunded';
  const productById = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  const locationById = useMemo(() => new Map(locations.map(location => [location.id, location.name])), [locations]);
  const paymentState = (order.balance_due ?? 0) <= 0 ? 'Full balance recorded' : order.paid_amount > 0 ? 'Partly paid' : 'Awaiting payment';
  const fulfillmentState = order.status === 'delivered' ? 'Signed handover' :
    deliveries.some(item => item.delivery_status === 'failed') ? 'Delivery failed' :
    deliveries.some(item => item.delivery_status === 'out_for_delivery') ? 'Out for delivery' :
    deliveries.length ? 'Partly dispatched / review' : 'Not dispatched';
  const events = [
    { key: `order-${order.id}`, at: order.created_at, title: 'Order created', detail: order.order_number },
    ...payments.map(item => ({ key: `payment-${item.id}`, at: item.created_at, title: 'Finance payment recorded', detail: `${money(item.amount)} · ${label(item.payment_method)} · ${item.reference_no}` })),
    ...reservations.map(item => ({ key: `hold-${item.id}`, at: item.created_at, title: 'Reservation created', detail: `${productById.get(item.product_id)?.name ?? 'Product'} · ${locationById.get(item.location_id) ?? 'stock area'}` })),
    ...reservations.filter(item => item.released_at).map(item => ({ key: `hold-release-${item.id}`, at: item.released_at!, title: item.status === 'fulfilled' ? 'Reservation fulfilled' : 'Reservation released', detail: `${productById.get(item.product_id)?.name ?? 'Product'} · ${label(item.status)}` })),
    ...refunds.map(item => ({ key: `refund-${item.id}`, at: item.created_at, title: 'Finance refund recorded', detail: `${money(item.amount)} · ${item.reference_no ?? 'No reference'}` })),
    ...deliveries.flatMap(item => [
      { key: `dispatch-${item.id}`, at: item.dispatch_date ?? item.created_at, title: 'Item dispatched', detail: `${productById.get(item.product_id ?? '')?.name ?? 'Product'} · ${item.quantity ?? 0} item(s)` },
      ...(item.delivered_at ? [{ key: `handover-${item.id}`, at: item.delivered_at, title: 'Signed handover', detail: `${item.signed_by ?? item.recipient_name} · ${item.signed_reference ?? 'Reference not recorded'}` }] : []),
      ...(item.returned_at ? [{ key: `return-${item.id}`, at: item.returned_at, title: 'Returned for review', detail: 'Item received into quarantine' }] : []),
    ]),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return <section className="live-card live-order-workspace" aria-labelledby="selected-order-title">
    <div className="live-order-heading">
      <div><span className="live-eyebrow">Customer order</span><h3 id="selected-order-title" tabIndex={-1}>{order.order_number}</h3><p>{customer?.full_name ?? 'Customer'} · {date(order.created_at)}</p></div>
      <span className="live-order-status">{label(order.status)}</span>
    </div>
    <div className="live-order-detail">
      <div className={`live-next-step live-next-step--${next.tone}`} role="status">
        <div className="live-next-icon">{next.tone === 'ready' ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}</div>
        <div><span className="live-eyebrow">Next step</span><strong>{next.title}</strong><p>{next.detail}</p></div>
        {next.area && <button type="button" className="live-next-link" onClick={() => onNavigate(next.area!)}>Open {next.area} <ArrowRight size={15} aria-hidden="true" /></button>}
      </div>

      <div className="live-order-state-grid" aria-label="Order progress">
        <div><span>Order</span><strong>{label(order.status)}</strong></div>
        <div><span>Payment</span><strong>{paymentState}</strong></div>
        <div><span>Fulfilment</span><strong>{fulfillmentState}</strong></div>
      </div>

      <div className="live-order-workspace-grid">
        <div className="live-order-column">
          <section className="live-order-panel" aria-labelledby="order-items-title">
            <h4 id="order-items-title">Items and current stock</h4>
            {lines.map(line => { const product = productById.get(line.product_id);
              const areaStock = balances.filter(balance => balance.product_id === line.product_id && (balance.sellable_on_hand > 0 || balance.active_reserved > 0));
              const held = reservations.filter(item => item.product_id === line.product_id && item.status === 'active').reduce((sum, item) => sum + item.quantity, 0);
              return <div className="live-order-item" key={line.id}>
                {product?.image_url ? <img src={product.image_url} alt={product.name} loading="lazy" /> : <div className="live-order-image-empty" aria-label="No product image"><PackageCheck size={23} aria-hidden="true" /></div>}
                <div className="live-order-item-body"><strong>{product?.name ?? 'Product unavailable'}</strong><span>{product?.sku ?? 'SKU unavailable'} · {line.quantity} × {money(line.unit_price)}</span>
                  <span>Line total {money(line.line_total)}</span>
                  {held > 0 && <span className="live-held-label">{held} reserved for this order</span>}
                  <div className="live-stock-areas" aria-label="Current stock by area">
                    {areaStock.length ? areaStock.map(balance => <span key={balance.location_id}>{locationById.get(balance.location_id) ?? 'Stock area'}: <strong>{balance.sellable_on_hand - balance.active_reserved} unreserved</strong>{balance.active_reserved > 0 ? ` · ${balance.active_reserved} held` : ''}</span>) : <span>No sellable stock posted in any area</span>}
                  </div>
                </div>
              </div>;
            })}
          </section>

          <section className="live-order-panel" aria-labelledby="order-customer-title">
            <h4 id="order-customer-title">Customer and agreed plan</h4>
            <p><strong>{customer?.full_name ?? 'Customer'}</strong>{customer?.phone && <> · {customer.phone}</>}</p>
            <p>Showroom: {locationById.get(order.location_id) ?? 'Unknown area'}</p>
            <p>{order.notes || 'No fulfilment note recorded.'}</p>
          </section>

          <section className="live-order-panel" aria-labelledby="order-reservation-title">
            <h4 id="order-reservation-title">Reservations and delivery</h4>
            {reservations.length ? reservations.map(item => <div className="live-order-record" key={item.id}><strong>{productById.get(item.product_id)?.name ?? 'Product'} · {item.status === 'active' ? `${item.quantity} currently held` : label(item.status)}</strong><span>{locationById.get(item.location_id) ?? 'Stock area'} · {item.status === 'active' ? 'active' : 'no active hold'}</span><span>Latest review {date(item.review_at)} · latest agreed decision {date(item.expires_at)}</span></div>) : <p>No stock reservation recorded.</p>}
            {deliveries.length ? deliveries.map(item => <div className="live-order-record" key={item.id}><strong>{productById.get(item.product_id ?? '')?.name ?? 'Product'} · {label(item.delivery_status)}</strong><span>{item.quantity ?? 0} item(s) · {item.recipient_name} · {item.delivery_address}</span><span>{item.signed_reference ? `Signed handover: ${item.signed_reference}` : item.failure_reason ? `Failure: ${item.failure_reason}` : 'Signed handover pending'}</span></div>) : <p>No item dispatched.</p>}
          </section>
        </div>

        <div className="live-order-column">
          <section className="live-order-panel live-finance-panel" aria-labelledby="order-finance-title">
            <h4 id="order-finance-title">Finance</h4>
            <dl className="live-finance-totals"><div><dt>Order total</dt><dd>{money(order.total_amount)}</dd></div><div><dt>Recorded payments</dt><dd>{money(order.paid_amount)}</dd></div><div className="live-balance-row"><dt>{isClosed ? 'Historical balance at closure' : 'Balance due'}</dt><dd>{money(order.balance_due)}</dd></div></dl>
            {isClosed && <p className="live-hint">This order is closed. Its historical balance is excluded from open receivables.</p>}
            {payments.length ? payments.map(item => <div className="live-order-record" key={item.id}><strong>{money(item.amount)} · {label(item.payment_method)}</strong><span>{date(item.created_at)} · {item.reference_no}</span><span>{canViewPaymentEvidence ? (evidence.some(file => file.payment_id === item.id) ? 'Proof attached' : 'No proof attached') : 'Proof managed by Finance'}</span></div>) : <p>Finance has not recorded a payment.</p>}
            {!isClosed && (order.balance_due ?? 0) > 0 && <p className="live-payment-warning">Dispatch waits until Finance records the full balance.</p>}
          </section>

          <section className="live-order-panel" aria-labelledby="order-timeline-title">
            <h4 id="order-timeline-title">Order timeline</h4>
            <ol className="live-order-timeline">{events.map(event => <li key={event.key}><span>{date(event.at)}</span><strong>{event.title}</strong><p>{event.detail}</p></li>)}</ol>
          </section>
        </div>
      </div>
      <div className="live-actions live-order-actions"><button type="button" onClick={() => onNavigate('finance')}>Finance</button><button type="button" onClick={() => onNavigate('reservations')}>Reservations</button><button type="button" onClick={() => onNavigate('deliveries')}>Delivery</button></div>
    </div>
  </section>;
}
