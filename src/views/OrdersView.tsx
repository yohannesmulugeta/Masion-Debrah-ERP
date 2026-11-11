import React, { useEffect, useRef, useState } from 'react';
import { useErp } from '../context/ErpContext';
import { SalesOrder } from '../types';
import { Plus, Search, CreditCard, Truck, BookmarkCheck } from 'lucide-react';
import { Modal } from '../components/Modal';
import { remainingToDispatch } from '../lib/deliveryOperations';

export const OrdersView: React.FC = () => {
  const {
    orders,
    products,
    locations,
    createOrder,
    createReservation,
    dispatchOrderLine,
    deliveries,
    payments,
    refunds,
    reservations,
    recordPayment,
    refundAndCancelOrder,
    getProductStock,
    canPerform,
  } = useErp();

  const [search, setSearch] = useState('');
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<SalesOrder | null>(null);
  const [selectedOrderForRefund, setSelectedOrderForRefund] = useState<SalesOrder | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundReference, setRefundReference] = useState('');
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<SalesOrder | null>(null);
  const [selectedOrderForReserve, setSelectedOrderForReserve] = useState<SalesOrder | null>(null);
  const [reserveProductId, setReserveProductId] = useState('');
  const [reserveQuantity, setReserveQuantity] = useState(1);
  const [reserveLocationId, setReserveLocationId] = useState('loc-wh');
  const [reserveReviewAt, setReserveReviewAt] = useState('');
  const [reserveUntil, setReserveUntil] = useState('');
  const [dispatchLineId, setDispatchLineId] = useState('');
  const [dispatchQuantity, setDispatchQuantity] = useState(1);
  const [dispatchLocationId, setDispatchLocationId] = useState('loc-wh');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [intendedRecipient, setIntendedRecipient] = useState('');
  const [orderError, setOrderError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const orderErrorRef = useRef<HTMLDivElement>(null);
  const paymentErrorRef = useRef<HTMLDivElement>(null);
  const actionErrorRef = useRef<HTMLDivElement>(null);
  const pendingActionRef = useRef(false);

  useEffect(() => { pendingActionRef.current = false; }, [orders, reservations, payments, refunds, deliveries]);

  useEffect(() => { if (orderError) orderErrorRef.current?.focus(); }, [orderError]);
  useEffect(() => { if (paymentError) paymentErrorRef.current?.focus(); }, [paymentError]);
  useEffect(() => { if (actionError) actionErrorRef.current?.focus(); }, [actionError]);

  // New order form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [locationId, setLocationId] = useState('loc-bole');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [orderNotes, setOrderNotes] = useState('');

  // Payment form
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<'' | 'cash' | 'telebirr' | 'cbe_birr' | 'bank_transfer' | 'card'>('');
  const [payRef, setPayRef] = useState('');

  const filteredOrders = orders.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerPhone.includes(q)
    );
  });

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const currentStock = getProductStock(selectedProductId, locationId);

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    if (pendingActionRef.current) return;
    pendingActionRef.current = true;

    try {
      createOrder({
        customerName,
        customerPhone,
        locationId,
        items: [
          {
            productId: selectedProductId,
            quantity,
            unitPrice: selectedProduct.referencePrice,
          },
        ],
        notes: orderNotes,
      });
      setActionError(null);
      setIsNewOrderOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setOrderNotes('');
      setOrderError(null);
    } catch (err: unknown) {
      pendingActionRef.current = false;
      setOrderError(err instanceof Error ? err.message : 'Order creation failed.');
    }
  };

  const handleOpenPayment = (order: SalesOrder) => {
    setSelectedOrderForPayment(order);
    setPaymentError(null);
    setPayAmount(order.balanceDue);
    setPayMethod('');
    setPayRef('');
  };

  const handleOpenReserve = (order: SalesOrder) => {
    const first = order.lines.find(line => !reservations.some(item => item.orderId === order.id && item.productId === line.productId && item.status === 'active') && remainingToDispatch(order, line.id, deliveries) > 0);
    if (!first) return;
    setSelectedOrderForReserve(order);
    setReserveProductId(first.productId);
    setReserveQuantity(1);
    setReserveLocationId(order.locationId);
    setReserveReviewAt('');
    setReserveUntil('');
    setActionError(null);
  };

  const handleReserve = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOrderForReserve) return;
    if (pendingActionRef.current) return;
    pendingActionRef.current = true;
    try {
      createReservation({ orderId: selectedOrderForReserve.id, productId: reserveProductId, locationId: reserveLocationId, quantity: reserveQuantity, reviewAt: reserveReviewAt, expiresAt: reserveUntil });
      setSelectedOrderForReserve(null);
      setActionError(null);
    } catch (err: unknown) {
      pendingActionRef.current = false;
      setActionError(err instanceof Error ? err.message : 'Could not reserve the item.');
    }
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForPayment) return;
    if (!payMethod) {
      setPaymentError('Select a payment method.');
      return;
    }
    if (pendingActionRef.current) return;
    pendingActionRef.current = true;
    try {
      recordPayment({
        orderId: selectedOrderForPayment.id,
        amount: payAmount,
        paymentMethod: payMethod,
        referenceNo: payRef,
      });
      setSelectedOrderForPayment(null);
    } catch (err: unknown) {
      pendingActionRef.current = false;
      setPaymentError(err instanceof Error ? err.message : 'Payment failed.');
    }
  };

  const handleRefund = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOrderForRefund) return;
    if (pendingActionRef.current) return;
    pendingActionRef.current = true;
    try {
      refundAndCancelOrder({ orderId: selectedOrderForRefund.id, reason: refundReason, referenceNo: refundReference });
      setSelectedOrderForRefund(null);
      setActionError(null);
    } catch (err: unknown) {
      pendingActionRef.current = false;
      setActionError(err instanceof Error ? err.message : 'Refund could not be recorded.');
    }
  };

  const handleOpenDispatch = (order: SalesOrder) => {
    const first = order.lines.find(line => remainingToDispatch(order, line.id, deliveries) > 0);
    if (!first) return;
    setSelectedOrderForDispatch(order);
    setDispatchLineId(first.id);
    setDispatchQuantity(1);
    const hold = reservations.find(item => item.orderId === order.id && item.productId === first.productId && item.status === 'active');
    setDispatchLocationId(hold?.locationId || order.locationId);
    setDeliveryAddress('');
    setIntendedRecipient(order.customerName);
    setActionError(null);
  };

  const handleDispatch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOrderForDispatch) return;
    if (pendingActionRef.current) return;
    pendingActionRef.current = true;
    try {
      dispatchOrderLine({
        orderId: selectedOrderForDispatch.id,
        lineId: dispatchLineId,
        quantity: dispatchQuantity,
        locationId: dispatchLocationId,
        deliveryAddress,
        intendedRecipient,
      });
      setSelectedOrderForDispatch(null);
      setActionError(null);
    } catch (err: unknown) {
      pendingActionRef.current = false;
      setActionError(err instanceof Error ? err.message : 'Dispatch failed.');
    }
  };

  return (
    <div>
      <div className="view-header">
        <div className="view-title-group">
          <h1>Showroom Sales & Client Orders</h1>
          <p>Manage customer sales, deposit commitments, and stock reservations.</p>
        </div>
        <div className="view-actions">
          <button
            className="btn btn-primary"
            onClick={() => { setOrderError(null); setIsNewOrderOpen(true); }}
            disabled={!canPerform('create_order')}
          >
            <Plus size={16} />
            <span>New Showroom Order</span>
          </button>
        </div>
      </div>

      {actionError && <div className="form-error" role="alert" tabIndex={-1} ref={actionErrorRef}>{actionError}</div>}

      <div className="search-filter-bar">
        <div className="search-input-wrap">
          <Search />
          <label className="visually-hidden" htmlFor="orders-search">Search orders</label>
          <input
            id="orders-search"
            type="text"
            className="form-input"
            placeholder="Search order, client, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="data-table mobile-card-table">
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Client / Contact</th>
                <th>Showroom</th>
                <th>Items Ordered</th>
                <th style={{ textAlign: 'right' }}>Total Amount</th>
                <th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Balance Due</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => {
                const loc = locations.find((l) => l.id === o.locationId);
                return (
                  <tr key={o.id}>
                    <td data-label="Order">
                      <strong>{o.orderNumber}</strong>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)' }}>
                        {new Date(o.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td data-label="Customer">
                      <strong>{o.customerName}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {o.customerPhone}
                      </div>
                    </td>
                    <td data-label="Showroom">{loc?.code}</td>
                    <td data-label="Items">
                      {o.lines.map((line) => {
                        const p = products.find((prod) => prod.id === line.productId);
                        return (
                          <div key={line.id} style={{ fontSize: '0.8rem' }}>
                            {line.quantity}x {p?.name} ({p?.sku}) · {remainingToDispatch(o, line.id, deliveries)} to dispatch
                          </div>
                        );
                      })}
                    </td>
                    <td data-label="Total" style={{ textAlign: 'right', fontWeight: 600 }}>
                      ETB {o.totalAmount.toLocaleString()}
                    </td>
                    <td data-label="Paid" style={{ textAlign: 'right', color: 'var(--color-success-text)' }}>
                      ETB {o.paidAmount.toLocaleString()}
                    </td>
                    <td
                      data-label="Due"
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: o.balanceDue > 0 ? 'var(--color-danger-text)' : 'inherit',
                      }}
                    >
                      ETB {o.balanceDue.toLocaleString()}
                    </td>
                    <td data-label="Status" style={{ textAlign: 'center' }}>
                      <span
                        className={`badge ${
                          o.status === 'paid'
                            ? 'badge-paid'
                            : o.status === 'partially_paid'
                            ? 'badge-part-paid'
                            : o.status === 'delivered'
                            ? 'badge-delivered'
                            : o.status === 'dispatched' || o.status === 'partially_dispatched'
                            ? 'badge-dispatched'
                            : 'badge-reserved'
                        }`}
                      >
                        {o.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td data-label="Actions" style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '6px' }}>
                        {o.balanceDue > 0 && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenPayment(o)}
                            disabled={!canPerform('record_payment')}
                            title="Log Deposit or Payment"
                          >
                            <CreditCard size={13} />
                            <span>Pay</span>
                          </button>
                        )}
                        {o.status !== 'cancelled' && o.paidAmount > 0 && o.lines.some(line => !reservations.some(item => item.orderId === o.id && item.productId === line.productId && item.status === 'active') && remainingToDispatch(o, line.id, deliveries) > 0) && (
                          <button className="btn btn-secondary btn-sm" onClick={() => handleOpenReserve(o)} disabled={!canPerform('create_reservation')} title="Reserve stock after a Finance-recorded deposit">
                            <BookmarkCheck size={13} /><span>Reserve</span>
                          </button>
                        )}
                        {o.status !== 'cancelled' && o.lines.some(line => remainingToDispatch(o, line.id, deliveries) > 0) && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleOpenDispatch(o)}
                            disabled={!canPerform('fulfil_order') || o.balanceDue > 0}
                            title={o.balanceDue > 0 ? 'Finance must confirm full payment first' : 'Dispatch an item and deduct stock once'}
                          >
                            <Truck size={13} />
                            <span>Dispatch</span>
                          </button>
                        )}
                        {o.status !== 'cancelled' && o.paidAmount > 0 && !deliveries.some(record => record.orderId === o.id) && canPerform('approve_refund') && (
                          <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedOrderForRefund(o); setRefundReason(''); setRefundReference(''); setActionError(null); }} title="Refund all payments and cancel before dispatch">Refund</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && <tr><td colSpan={9} className="empty-state">No orders match this search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Order Modal */}
      <Modal isOpen={isNewOrderOpen} onClose={() => setIsNewOrderOpen(false)} title="Create Showroom Order">
        <form onSubmit={handleCreateOrder}>
          {orderError && <div className="form-error" role="alert" tabIndex={-1} ref={orderErrorRef}>{orderError}</div>}
          <p className="form-note">Demo transaction. The displayed price is sample reference data and is not an approved Ethiopia selling price.</p>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="order-customer-name">Customer Full Name</label>
              <input
                id="order-customer-name"
                type="text"
                className="form-input"
                placeholder="e.g. Solomon Girma"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="order-customer-phone">Customer Phone Number</label>
              <input
                id="order-customer-phone"
                type="tel"
                autoComplete="tel"
                placeholder="+251 9..."
                className="form-input"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="order-showroom">Originating Showroom</label>
              <select
                id="order-showroom"
                className="form-select"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                {locations
                  .filter((l) => l.type === 'showroom')
                  .map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="form-group">
                <label htmlFor="order-product">Product</label>
              <select
                id="order-product"
                className="form-select"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stock availability indicator */}
          <div
            style={{
              background: 'var(--color-bg-subtle)',
              padding: '10px 14px',
              borderRadius: '4px',
              fontSize: '0.82rem',
              marginBottom: '14px',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Stock Available at Selected Showroom:</span>
            <strong
              style={{
                color:
                  currentStock.available > 0
                    ? 'var(--color-primary)'
                    : 'var(--color-warning-text)',
              }}
            >
              {currentStock.available} unit(s) unreserved
            </strong>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="order-quantity">Order Quantity</label>
              <input
                id="order-quantity"
                type="number"
                min="1"
                className="form-input"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="order-reference-price">Demo Reference Price (ETB)</label>
              <input
                id="order-reference-price"
                type="text"
                className="form-input"
                value={selectedProduct ? selectedProduct.referencePrice.toLocaleString() : '0'}
                disabled
              />
            </div>
          </div>

          <p className="form-note">Finance records a deposit first. Sales can then reserve available stock with an agreed review and collection date.</p>

          <div className="form-group">
            <label htmlFor="order-notes">Order Notes / Delivery Instructions</label>
            <input
              id="order-notes"
              type="text"
              className="form-input"
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Enter delivery instructions if needed"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsNewOrderOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Order
            </button>
          </div>
        </form>
      </Modal>

      {/* Payment Cashier Modal */}
      <Modal
        isOpen={selectedOrderForPayment !== null}
        onClose={() => setSelectedOrderForPayment(null)}
        title={`Log Payment for ${selectedOrderForPayment?.orderNumber}`}
      >
        {selectedOrderForPayment && (
          <form onSubmit={handleSubmitPayment}>
            <div
              style={{
                background: 'var(--color-bg-subtle)',
                padding: '12px 16px',
                borderRadius: '6px',
                marginBottom: '16px',
                fontSize: '0.84rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Client:</span>
                <strong>{selectedOrderForPayment.customerName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Total Amount:</span>
                <span>ETB {selectedOrderForPayment.totalAmount.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Already Paid:</span>
                <span style={{ color: 'var(--color-success-text)' }}>
                  ETB {selectedOrderForPayment.paidAmount.toLocaleString()}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: '6px',
                  fontWeight: 700,
                }}
              >
                <span>Balance Due:</span>
                <span style={{ color: 'var(--color-danger-text)' }}>
                  ETB {selectedOrderForPayment.balanceDue.toLocaleString()}
                </span>
              </div>
            </div>

            {paymentError && <div className="form-error" role="alert" tabIndex={-1} ref={paymentErrorRef}>{paymentError}</div>}
            <div className="form-group">
              <label htmlFor="payment-amount">Payment Amount (ETB)</label>
              <input
                id="payment-amount"
                type="number"
                min="1"
                max={selectedOrderForPayment.balanceDue}
                className="form-input"
                value={payAmount}
                onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="payment-method">Payment Method</label>
                <select
                  id="payment-method"
                  className="form-select"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
                  required
                >
                  <option value="">Select payment method</option>
                  <option value="telebirr">Telebirr SuperApp</option>
                  <option value="cbe_birr">CBE Birr Direct</option>
                  <option value="bank_transfer">Direct Bank Transfer</option>
                  <option value="cash">Showroom Cash</option>
                  <option value="card">Point of Sale Card</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="payment-reference">Transaction / Bank Ref</label>
                <input
                  id="payment-reference"
                  type="text"
                  className="form-input"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Enter receipt or bank reference"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedOrderForPayment(null)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Record Payment
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={selectedOrderForRefund !== null} onClose={() => setSelectedOrderForRefund(null)} title={`Finance refund · ${selectedOrderForRefund?.orderNumber || ''}`}>
        {selectedOrderForRefund && <form onSubmit={handleRefund}>
          <p className="form-note">Before dispatch only. Record the full refund of ETB {selectedOrderForRefund.paidAmount.toLocaleString()} and cancel this order. Any reserved stock will be released.</p>
          {actionError && <div className="form-error" role="alert">{actionError}</div>}
          <div className="form-group"><label htmlFor="refund-reason">Reason and customer discussion</label><textarea id="refund-reason" className="form-textarea" value={refundReason} onChange={event => setRefundReason(event.target.value)} required /></div>
          <div className="form-group"><label htmlFor="refund-reference">Refund transaction reference</label><input id="refund-reference" className="form-input" value={refundReference} onChange={event => setRefundReference(event.target.value)} required /></div>
          <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setSelectedOrderForRefund(null)}>Cancel</button><button type="submit" className="btn btn-primary">Record refund & cancel</button></div>
        </form>}
      </Modal>

      <Modal isOpen={selectedOrderForReserve !== null} onClose={() => setSelectedOrderForReserve(null)} title={`Reserve stock · ${selectedOrderForReserve?.orderNumber || ''}`}>
        {selectedOrderForReserve && <form onSubmit={handleReserve}>
          <p className="form-note">A Finance-recorded deposit is required. Set a review date (normally discussed around day 3–5) and the agreed collection or delivery date. Reaching either date does not issue an automatic refund.</p>
          {actionError && <div className="form-error" role="alert">{actionError}</div>}
          <div className="form-row">
            <div className="form-group"><label htmlFor="reserve-item">Item</label><select id="reserve-item" className="form-select" value={reserveProductId} onChange={event => setReserveProductId(event.target.value)} required>
              {selectedOrderForReserve.lines.filter(line => !reservations.some(item => item.orderId === selectedOrderForReserve.id && item.productId === line.productId && item.status === 'active') && remainingToDispatch(selectedOrderForReserve, line.id, deliveries) > 0).map(line => <option key={line.id} value={line.productId}>{products.find(product => product.id === line.productId)?.name}</option>)}
            </select></div>
            <div className="form-group"><label htmlFor="reserve-qty">Quantity</label><input id="reserve-qty" className="form-input" type="number" min="1" max={selectedOrderForReserve.lines.find(line => line.productId === reserveProductId)?.quantity || 1} value={reserveQuantity} onChange={event => setReserveQuantity(Number(event.target.value))} required /></div>
          </div>
          <div className="form-group"><label htmlFor="reserve-area">Item location</label><select id="reserve-area" className="form-select" value={reserveLocationId} onChange={event => setReserveLocationId(event.target.value)} required>{locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}</select></div>
          <div className="form-row">
            <div className="form-group"><label htmlFor="reserve-review">Customer review date</label><input id="reserve-review" className="form-input" type="datetime-local" value={reserveReviewAt} onChange={event => setReserveReviewAt(event.target.value)} required /></div>
            <div className="form-group"><label htmlFor="reserve-until">Agreed collection or delivery date</label><input id="reserve-until" className="form-input" type="datetime-local" value={reserveUntil} onChange={event => setReserveUntil(event.target.value)} required /></div>
          </div>
          <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setSelectedOrderForReserve(null)}>Cancel</button><button type="submit" className="btn btn-primary">Place deposit reservation</button></div>
        </form>}
      </Modal>

      <Modal isOpen={selectedOrderForDispatch !== null} onClose={() => setSelectedOrderForDispatch(null)} title={`Dispatch ${selectedOrderForDispatch?.orderNumber || ''}`}>
        {selectedOrderForDispatch && (
          <form onSubmit={handleDispatch}>
            <p className="form-note">Finance has confirmed the full order balance. Dispatch deducts physical stock once; the signed delivery receipt is recorded separately.</p>
            {actionError && <div className="form-error" role="alert">{actionError}</div>}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="dispatch-item">Item to dispatch</label>
                <select id="dispatch-item" className="form-select" value={dispatchLineId} onChange={event => { setDispatchLineId(event.target.value); setDispatchQuantity(1); }} required>
                  {selectedOrderForDispatch.lines.filter(line => remainingToDispatch(selectedOrderForDispatch, line.id, deliveries) > 0).map(line => (
                    <option key={line.id} value={line.id}>{products.find(product => product.id === line.productId)?.name} · {remainingToDispatch(selectedOrderForDispatch, line.id, deliveries)} remaining</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="dispatch-quantity">Quantity</label>
                <input id="dispatch-quantity" className="form-input" type="number" min="1" max={remainingToDispatch(selectedOrderForDispatch, dispatchLineId, deliveries)} value={dispatchQuantity} onChange={event => setDispatchQuantity(Number(event.target.value))} required />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="dispatch-area">Release from</label>
              <select id="dispatch-area" className="form-select" value={dispatchLocationId} onChange={event => setDispatchLocationId(event.target.value)} required>
                {locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="dispatch-recipient">Intended recipient</label>
                <input id="dispatch-recipient" className="form-input" value={intendedRecipient} onChange={event => setIntendedRecipient(event.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="dispatch-address">Delivery address</label>
                <input id="dispatch-address" className="form-input" value={deliveryAddress} onChange={event => setDeliveryAddress(event.target.value)} required />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedOrderForDispatch(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Record dispatch</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
