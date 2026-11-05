import React, { useState } from 'react';
import { useErp } from '../context/ErpContext';
import { History, ShieldCheck, Search } from 'lucide-react';

export const AuditView: React.FC = () => {
  const { movements, auditEvents, products, locations } = useErp();
  const [activeTab, setActiveTab] = useState<'movements' | 'audit'>('movements');
  const [search, setSearch] = useState('');

  const filteredMovements = movements.filter((m) => {
    const prod = products.find((p) => p.id === m.productId);
    const q = search.toLowerCase();
    return (
      m.referenceNo.toLowerCase().includes(q) ||
      m.reason.toLowerCase().includes(q) ||
      m.movementType.toLowerCase().includes(q) ||
      (prod && (prod.sku.toLowerCase().includes(q) || prod.name.toLowerCase().includes(q)))
    );
  });

  const filteredAudit = auditEvents.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.actorName.toLowerCase().includes(q) ||
      a.action.toLowerCase().includes(q) ||
      a.details.toLowerCase().includes(q) ||
      a.entityName.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="view-header">
        <div className="view-title-group">
          <h1>Audit Trail & Immutable Stock Ledger</h1>
          <p>
            Complete traceability: every stock movement, reservation, payment, and adjustment is recorded with actor and timestamp.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: '24px',
        }}
      >
        <button
          className={`btn ${activeTab === 'movements' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('movements')}
        >
          <History size={16} />
          <span>Stock Movement Ledger ({movements.length})</span>
        </button>

        <button
          className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('audit')}
        >
          <ShieldCheck size={16} />
          <span>System Security Audit Log ({auditEvents.length})</span>
        </button>
      </div>

      <div className="search-filter-bar">
        <div className="search-input-wrap">
          <Search />
          <label className="visually-hidden" htmlFor="audit-search">Search audit records</label>
          <input
            id="audit-search"
            type="text"
            className="form-input"
            placeholder={
              activeTab === 'movements'
                ? 'Search ledger by reference, SKU, or reason...'
                : 'Search audit logs by actor, action, or details...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {activeTab === 'movements' && (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Movement Type</th>
                  <th>Product (SKU)</th>
                  <th>From Area</th>
                  <th>To Area</th>
                  <th style={{ textAlign: 'center' }}>Quantity Delta</th>
                  <th>Reference Number</th>
                  <th>Reason / Context</th>
                  <th>Created By</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((m) => {
                  const prod = products.find((p) => p.id === m.productId);
                  const srcLoc = locations.find((l) => l.id === m.sourceLocationId);
                  const destLoc = locations.find((l) => l.id === m.destLocationId);

                  return (
                    <tr key={m.id}>
                      <td style={{ fontSize: '0.76rem', color: 'var(--color-text-light)' }}>
                        {new Date(m.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor:
                              m.movementType === 'receipt'
                                ? 'var(--color-success-bg)'
                                : m.movementType.includes('transfer')
                                ? '#eef4fb'
                                : m.movementType.includes('reservation')
                                ? 'var(--color-warning-bg)'
                                : '#f0f3f0',
                            color:
                              m.movementType === 'receipt'
                                ? 'var(--color-success-text)'
                                : m.movementType.includes('transfer')
                                ? '#1d5899'
                                : m.movementType.includes('reservation')
                                ? '#a06008'
                                : 'inherit',
                          }}
                        >
                          {m.movementType.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <strong>{prod?.sku}</strong>
                        <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                          {prod?.name}
                        </div>
                      </td>
                      <td>{srcLoc ? srcLoc.code : '—'}</td>
                      <td>{destLoc ? destLoc.code : '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }}>{m.quantity}</td>
                      <td>
                        <code>{m.referenceNo}</code>
                      </td>
                      <td style={{ fontSize: '0.8rem', maxWidth: '240px' }}>{m.reason}</td>
                      <td style={{ fontSize: '0.78rem' }}>{m.createdBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Staff Actor & Role</th>
                  <th>Action</th>
                  <th>Entity Target</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudit.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontSize: '0.76rem', color: 'var(--color-text-light)' }}>
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <strong>{a.actorName}</strong>
                    </td>
                    <td>
                      <span className="badge" style={{ background: '#f0f3f0', color: 'var(--color-primary)' }}>
                        {a.action}
                      </span>
                    </td>
                    <td>
                      <code>{a.entityName}</code>
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{a.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
