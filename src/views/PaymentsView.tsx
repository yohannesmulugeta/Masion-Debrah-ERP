import React from 'react';
import { useErp } from '../context/ErpContext';
import { CheckCircle, Clock } from 'lucide-react';

export const PaymentsView: React.FC = () => {
  const { payments, refunds, orders } = useErp();

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0) - refunds.reduce((sum, refund) => sum + refund.amount, 0);
  const totalDue = orders.reduce((sum, o) => sum + o.balanceDue, 0);

  return (
    <div>
      <div className="view-header">
        <div className="view-title-group">
          <h1>Payments & Financial Cashier</h1>
          <p>
            Finance-recorded deposits, final payments, and pre-dispatch refunds in this browser-local demo.
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
          <div className="metric-sub">{payments.length} payments · {refunds.length} refunds</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">
            <span>Total Outstanding Balances Due</span>
            <Clock size={18} color="var(--color-danger-text)" />
          </div>
          <div className="metric-value">ETB {totalDue.toLocaleString()}</div>
          <div className="metric-sub">Must be cleared before dispatch</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header"><h2>Refunds before dispatch</h2></div>
        <div className="table-responsive"><table className="data-table mobile-card-table">
          <thead><tr><th>Order</th><th>Refund reference</th><th>Reason</th><th>Recorded by</th><th>Amount</th></tr></thead>
          <tbody>{refunds.map(refund => <tr key={refund.id}>
            <td data-label="Order">{refund.orderNumber}</td><td data-label="Reference">{refund.referenceNo}</td><td data-label="Reason">{refund.reason}</td><td data-label="Recorded by">{refund.recordedBy}</td><td data-label="Amount">ETB {refund.amount.toLocaleString()}</td>
          </tr>)}{refunds.length === 0 && <tr><td colSpan={5} className="empty-state">No refunds recorded.</td></tr>}</tbody>
        </table></div>
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
