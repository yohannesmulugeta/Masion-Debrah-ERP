import React, { useEffect, useRef, useState } from 'react';
import { useErp } from '../context/ErpContext';
import { BookmarkCheck, Clock, XCircle } from 'lucide-react';
import { Reservation } from '../types';
import { Modal } from '../components/Modal';

export const ReservationsView: React.FC = () => {
  const { reservations, orders, products, locations, releaseReservation, extendReservation, canPerform } =
    useErp();
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [reviewAt, setReviewAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pendingActionRef = useRef(false);
  useEffect(() => { pendingActionRef.current = false; }, [reservations]);

  const openExtension = (reservation: Reservation) => {
    setSelected(reservation);
    setReviewAt('');
    setExpiresAt('');
    setReason('');
    setError(null);
  };

  const saveExtension = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    if (pendingActionRef.current) return;
    pendingActionRef.current = true;
    try {
      extendReservation({ reservationId: selected.id, reviewAt, expiresAt, reason });
      setSelected(null);
      setError(null);
    } catch (caught: unknown) {
      pendingActionRef.current = false;
      setError(caught instanceof Error ? caught.message : 'Could not extend this reservation.');
    }
  };

  const handleRelease = (resId: string) => {
    if (pendingActionRef.current) return;
    pendingActionRef.current = true;
    try {
      releaseReservation({ reservationId: resId, reason: 'Unpaid legacy hold released after staff review' });
      setError(null);
    } catch (caught: unknown) {
      pendingActionRef.current = false;
      setError(caught instanceof Error ? caught.message : 'Could not release this reservation.');
    }
  };

  return (
    <div>
      <div className="view-header">
        <div className="view-title-group">
          <h1>Customer Stock Reservations (Holds)</h1>
          <p>
            Deposit-backed allocations with customer review and agreed collection dates.
          </p>
        </div>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}

      {/* Invariant Alert */}
      <div
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderLeft: '4px solid var(--color-accent)',
          padding: '14px 18px',
          borderRadius: '4px',
          marginBottom: '24px',
          fontSize: '0.84rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <BookmarkCheck size={20} color="var(--color-accent-text)" style={{ flexShrink: 0 }} />
        <div>
          <strong>Reservation Invariant:</strong> Placing a reservation increments <code>active_reserved</code> and
          decrements <code>sellable_available</code>. Physical stock on-hand does not drop until final fulfilment.
          Releasing a reservation instantly restores sellable availability for other showroom staff.
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Reserved Item (SKU)</th>
                <th>Holding Area</th>
                <th style={{ textAlign: 'center' }}>Quantity</th>
                <th>Customer review / collection</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => {
                const prod = products.find((p) => p.id === r.productId);
                const loc = locations.find((l) => l.id === r.locationId);
                const isExpired = new Date(r.reviewAt || r.expiresAt).getTime() < Date.now();
                const hasDeposit = (orders.find(order => order.id === r.orderId)?.paidAmount || 0) > 0;

                return (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.orderNumber}</strong>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)' }}>
                        Created {new Date(r.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <strong>{prod?.name}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {prod?.sku}
                      </div>
                    </td>
                    <td>{loc?.name}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{r.quantity}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} color={isExpired ? 'var(--color-danger-text)' : 'var(--color-accent-text)'} />
                        <span style={{ color: isExpired ? 'var(--color-danger-text)' : 'inherit' }}>
                          Review: {new Date(r.reviewAt || r.expiresAt).toLocaleString()}
                        </span>
                      </div>
                      <div>Agreed date: {new Date(r.expiresAt).toLocaleString()}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={`badge ${
                          r.status === 'active'
                            ? 'badge-reserved'
                            : r.status === 'fulfilled'
                            ? 'badge-in-stock'
                            : 'badge-order-only'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {r.status === 'active' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleRelease(r.id)}
                            disabled={!canPerform('release_reservation') || hasDeposit}
                            title={hasDeposit ? 'Finance must refund and cancel a paid reservation from Orders' : 'Release an unpaid legacy hold'}
                          >
                            <XCircle size={13} color="var(--color-danger-text)" />
                            <span>Release</span>
                          </button>
                          <button className="btn btn-primary btn-sm" onClick={() => openExtension(r)} disabled={!canPerform('create_reservation')} title="Record a new date after discussion with the customer">Extend</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Modal isOpen={selected !== null} onClose={() => setSelected(null)} title={`Extend reservation · ${selected?.orderNumber || ''}`}>
        {selected && <form onSubmit={saveExtension}>
          <p className="form-note">Discuss the new dates with the customer before saving. The item remains reserved until it is dispatched or the order is cancelled.</p>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="form-row">
            <div className="form-group"><label htmlFor="extension-review">Next review date</label><input id="extension-review" className="form-input" type="datetime-local" value={reviewAt} onChange={event => setReviewAt(event.target.value)} required /></div>
            <div className="form-group"><label htmlFor="extension-collection">New collection or delivery date</label><input id="extension-collection" className="form-input" type="datetime-local" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} required /></div>
          </div>
          <div className="form-group"><label htmlFor="extension-reason">Customer discussion / reason</label><textarea id="extension-reason" className="form-textarea" value={reason} onChange={event => setReason(event.target.value)} required /></div>
          <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>Cancel</button><button type="submit" className="btn btn-primary">Save extension</button></div>
        </form>}
      </Modal>
    </div>
  );
};
