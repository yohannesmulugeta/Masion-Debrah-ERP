import React, { useEffect, useRef, useState } from 'react';
import { useErp } from '../context/ErpContext';
import { SalesOrder } from '../types';
import { Plus, Search, CreditCard, Truck } from 'lucide-react';
import { Modal } from '../components/Modal';

export const OrdersView: React.FC = () => {
  const {
    orders,
    products,
    locations,
    createOrder,
    fulfilOrder,
    recordPayment,
    getProductStock,
    canPerform,
  } = useErp();

  const [search, setSearch] = useState('');
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<SalesOrder | null>(null);
  const [selectedOrderForFulfil, setSelectedOrderForFulfil] = useState<SalesOrder | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const orderErrorRef = useRef<HTMLDivElement>(null);
  const paymentErrorRef = useRef<HTMLDivElement>(null);
  const actionErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (orderError) orderErrorRef.current?.focus(); }, [orderError]);
  useEffect(() => { if (paymentError) paymentErrorRef.current?.focus(); }, [paymentError]);
  useEffect(() => { if (actionError) actionErrorRef.current?.focus(); }, [actionError]);

  // New order form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [locationId, setLocationId] = useState('loc-bole');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [quantity, setQuantity] = useState(1);
  const [placeHold, setPlaceHold] = useState(false);
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
        holdHours: placeHold ? 48 : undefined,
      });
      setActionError(null);
      setIsNewOrderOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setOrderNotes('');
      setPlaceHold(false);
      setOrderError(null);
    } catch (err: unknown) {
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

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForPayment) return;
    if (!payMethod) {
      setPaymentError('Select a payment method.');
      return;
    }
    try {
      recordPayment({
        orderId: selectedOrderForPayment.id,
        amount: payAmount,
        paymentMethod: payMethod,
        referenceNo: payRef,
      });
      setSelectedOrderForPayment(null);
    } catch (err: unknown) {
      setPaymentError(err instanceof Error ? err.message : 'Payment failed.');
    }
  };

  const handleFulfil = () => {
    if (!selectedOrderForFulfil) return;
    try {
      fulfilOrder(selectedOrderForFulfil.id);
      setSelectedOrderForFulfil(null);
      setActionError(null);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Fulfilment failed.');
      setSelectedOrderForFulfil(null);
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
                            {line.quantity}x {p?.name} ({p?.sku})
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
                            : 'badge-reserved'
                        }`}
                      >
                        {o.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td data-label="Actions" style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
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
                        {o.status !== 'delivered' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setSelectedOrderForFulfil(o)}
                            disabled={!canPerform('fulfil_order')}
                            title="Fulfil and deduct physical stock"
                          >
                            <Truck size={13} />
                            <span>Fulfil</span>
                          </button>
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
              <label htmlFor="order-product">Product (Catalogue SKU)</label>
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

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={placeHold}
              onChange={(e) => setPlaceHold(e.target.checked)}
              disabled={currentStock.available < quantity}
            />
            <span>Hold {quantity} unit(s) in this showroom for 48 hours</span>
          </label>
          {currentStock.available < quantity && <p className="form-note">A hold is unavailable because this showroom has only {currentStock.available} unreserved unit(s). The order can still be recorded without a hold.</p>}

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
            <button type="submit" className="btn btn-primary" disabled={placeHold && currentStock.available < quantity}>
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

      <Modal isOpen={selectedOrderForFulfil !== null} onClose={() => setSelectedOrderForFulfil(null)} title="Confirm Stock Fulfilment">
        {selectedOrderForFulfil && (
          <div>
            <p>Deduct stock for order <strong>{selectedOrderForFulfil.orderNumber}</strong> and mark it delivered in this demo?</p>
            <p className="form-note">All order items must have enough stock. A failed check leaves the order unchanged.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setSelectedOrderForFulfil(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleFulfil}>Confirm Fulfilment</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
