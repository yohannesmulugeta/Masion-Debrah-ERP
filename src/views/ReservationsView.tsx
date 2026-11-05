import React from 'react';
import { useErp } from '../context/ErpContext';
import { BookmarkCheck, Clock, XCircle, CheckCircle2 } from 'lucide-react';

export const ReservationsView: React.FC = () => {
  const { reservations, products, locations, releaseReservation, fulfilOrder, canPerform } =
    useErp();

  const handleRelease = (resId: string) => {
    const reason = prompt('Please enter reason for releasing this reservation hold:', 'Client cancelled inquiry');
    if (reason) {
      try {
        releaseReservation({ reservationId: resId, reason });
      } catch (err: unknown) {
        if (err instanceof Error) {
          alert(err.message);
        } else {
          alert('Release failed.');
        }
      }
    }
  };

  return (
    <div>
      <div className="view-header">
        <div className="view-title-group">
          <h1>Customer Stock Reservations (Holds)</h1>
          <p>
            Time-bound allocations protecting inventory against double-selling during showroom negotiations.
          </p>
        </div>
      </div>

      {/* Invariant Alert */}
      <div
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderLeft: '4px solid var(--color-gold)',
          padding: '14px 18px',
          borderRadius: '4px',
          marginBottom: '24px',
          fontSize: '0.84rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <BookmarkCheck size={20} color="var(--color-gold)" style={{ flexShrink: 0 }} />
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
                <th>Expiration Deadline</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => {
                const prod = products.find((p) => p.id === r.productId);
                const loc = locations.find((l) => l.id === r.locationId);
                const isExpired = new Date(r.expiresAt).getTime() < Date.now();

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
                        <Clock size={14} color={isExpired ? 'var(--color-danger-text)' : 'var(--color-gold)'} />
                        <span style={{ color: isExpired ? 'var(--color-danger-text)' : 'inherit' }}>
                          {new Date(r.expiresAt).toLocaleString()}
                        </span>
                      </div>
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
                            disabled={!canPerform('release_reservation')}
                            title="Release stock hold immediately"
                          >
                            <XCircle size={13} color="var(--color-danger-text)" />
                            <span>Release</span>
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              if (confirm(`Convert reservation to sale and deduct physical stock?`)) {
                                fulfilOrder(r.orderId);
                              }
                            }}
                            disabled={!canPerform('fulfil_order')}
                            title="Fulfil order"
                          >
                            <CheckCircle2 size={13} />
                            <span>Fulfil</span>
                          </button>
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
    </div>
  );
};
