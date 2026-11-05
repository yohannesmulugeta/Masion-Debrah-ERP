import React, { useState } from 'react';
import { useErp } from '../context/ErpContext';
import { Plus, ShieldAlert } from 'lucide-react';
import { Modal } from '../components/Modal';

export const ExceptionsView: React.FC = () => {
  const { exceptions, products, locations, createException, canPerform } = useErp();
  const [isNewCaseOpen, setIsNewCaseOpen] = useState(false);

  const [form, setForm] = useState({
    caseType: 'damage' as const,
    productId: products[0]?.id || '',
    locationId: 'loc-wh',
    quantity: 1,
    disposition: 'quarantined' as const,
    issueDescription: '',
    customerName: '',
    orderNumber: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      createException(form);
      setIsNewCaseOpen(false);
      setForm({
        caseType: 'damage',
        productId: products[0]?.id || '',
        locationId: 'loc-wh',
        quantity: 1,
        disposition: 'quarantined',
        issueDescription: '',
        customerName: '',
        orderNumber: '',
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert('Logging exception failed.');
      }
    }
  };

  return (
    <div>
      <div className="view-header">
        <div className="view-title-group">
          <h1>Returns, Damage & Warranty Registry</h1>
          <p>
            Record damage, returns, and warranty issues for follow-up and stock reconciliation.
          </p>
        </div>
        <div className="view-actions">
          <button
            className="btn btn-primary"
            onClick={() => setIsNewCaseOpen(true)}
            disabled={!canPerform('manage_exceptions')}
          >
            <Plus size={16} />
            <span>Register Exception Case</span>
          </button>
        </div>
      </div>

      <div
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderLeft: '4px solid var(--color-danger-text)',
          padding: '14px 18px',
          borderRadius: '4px',
          marginBottom: '24px',
          fontSize: '0.84rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <ShieldAlert size={20} color="var(--color-danger-text)" style={{ flexShrink: 0 }} />
        <div>
          <strong>Demo case log:</strong> Registering a case does not change sellable stock.
          An authorized stock adjustment is required before damaged units stop counting as available.
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Case Number</th>
                <th>Type</th>
                <th>Affected Product (SKU)</th>
                <th>Area</th>
                <th style={{ textAlign: 'center' }}>Qty</th>
                <th>Disposition Status</th>
                <th>Issue Description</th>
                <th>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map((exc) => {
                const prod = products.find((p) => p.id === exc.productId);
                const loc = locations.find((l) => l.id === exc.locationId);
                return (
                  <tr key={exc.id}>
                    <td>
                      <strong>{exc.caseNumber}</strong>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)' }}>
                        {new Date(exc.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor:
                            exc.caseType === 'damage'
                              ? 'var(--color-danger-bg)'
                              : exc.caseType === 'return'
                              ? 'var(--color-warning-bg)'
                              : '#eee',
                          color:
                            exc.caseType === 'damage'
                              ? 'var(--color-danger-text)'
                              : exc.caseType === 'return'
                              ? 'var(--color-warning-text)'
                              : 'inherit',
                        }}
                      >
                        {exc.caseType}
                      </span>
                    </td>
                    <td>
                      <strong>{prod?.name}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {prod?.sku}
                      </div>
                    </td>
                    <td>{loc?.name}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{exc.quantity}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor:
                            exc.disposition === 'quarantined'
                              ? '#fef2f2'
                              : exc.disposition === 'restocked_sellable'
                              ? 'var(--color-success-bg)'
                              : '#f5f5f5',
                          color:
                            exc.disposition === 'quarantined'
                              ? '#991b1b'
                              : exc.disposition === 'restocked_sellable'
                              ? 'var(--color-success-text)'
                              : '#555',
                        }}
                      >
                        {exc.disposition.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ maxWidth: '320px', fontSize: '0.82rem' }}>
                      {exc.issueDescription}
                      {exc.resolutionNotes && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--color-text-light)', marginTop: '4px' }}>
                          <em>Resolution: {exc.resolutionNotes}</em>
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{exc.recordedBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Exception Modal */}
      <Modal isOpen={isNewCaseOpen} onClose={() => setIsNewCaseOpen(false)} title="Register Exception Case">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="exception-type">Case Type</label>
              <select
                id="exception-type"
                className="form-select"
                value={form.caseType}
                onChange={(e) => setForm({ ...form, caseType: e.target.value as any })}
              >
                <option value="damage">Transit / Handling Damage</option>
                <option value="return">Customer Return (Pending Inspection)</option>
                <option value="warranty">Warranty Service Claim</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="exception-disposition">Initial Disposition</label>
              <select
                id="exception-disposition"
                className="form-select"
                value={form.disposition}
                onChange={(e) => setForm({ ...form, disposition: e.target.value as any })}
              >
                <option value="quarantined">Segregated in Quarantine</option>
                <option value="pending_inspection">Pending Specialist Inspection</option>
                <option value="written_off">Written Off as Total Loss</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="exception-product">Product (SKU)</label>
              <select
                id="exception-product"
                className="form-select"
                value={form.productId}
                onChange={(e) => setForm({ ...form, productId: e.target.value })}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="exception-area">Area</label>
              <select
                id="exception-area"
                className="form-select"
                value={form.locationId}
                onChange={(e) => setForm({ ...form, locationId: e.target.value })}
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="exception-quantity">Quantity Damaged / Returned</label>
            <input
              id="exception-quantity"
              type="number"
              min="1"
              className="form-input"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="exception-description">Detailed Issue Description</label>
            <textarea
              id="exception-description"
              className="form-textarea"
              rows={3}
              value={form.issueDescription}
              onChange={(e) => setForm({ ...form, issueDescription: e.target.value })}
              placeholder="e.g. Scratched wood finish on back leg discovered upon unpacking shipment"
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsNewCaseOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Log Exception
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
