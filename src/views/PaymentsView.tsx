import React from 'react';
import { useErp } from '../context/ErpContext';
import { CheckCircle, Clock } from 'lucide-react';

export const PaymentsView: React.FC = () => {
  const { payments, orders } = useErp();

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalDue = orders.reduce((sum, o) => sum + o.balanceDue, 0);

  return (
    <div>
      <div className="view-header">
        <div className="view-title-group">
          <h1>Payments & Financial Cashier</h1>
          <p>
            Immutable transaction records for customer deposits, installments, and final settlements.
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-title">
            <span>Total Collected (ETB)</span>
            <CheckCircle size={18} color="var(--color-success-text)" />
          </div>
          <div className="metric-value">ETB {totalCollected.toLocaleString()}</div>
          <div className="metric-sub">{payments.length} verified transactions</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">
            <span>Total Outstanding Balances Due</span>
            <Clock size={18} color="var(--color-danger-text)" />
          </div>
          <div className="metric-value">ETB {totalDue.toLocaleString()}</div>
          <div className="metric-sub">Collectable upon delivery / dispatch</div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="card">
        <div className="card-header">
          <h2>Payment Receipts Ledger</h2>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt ID</th>
                <th>Order Number</th>
                <th>Date & Time</th>
                <th>Payment Method</th>
                <th>Transaction / Bank Ref</th>
                <th>Cashier / Recorded By</th>
                <th style={{ textAlign: 'right' }}>Amount Paid (ETB)</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.id}</strong>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{p.orderNumber}</span>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: '#edf4fc',
                        color: '#1b5997',
                      }}
                    >
                      {p.paymentMethod.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <code>{p.referenceNo}</code>
                  </td>
                  <td>{p.recordedBy}</td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: 700,
                      color: 'var(--color-success-text)',
                    }}
                  >
                    ETB {p.amount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
