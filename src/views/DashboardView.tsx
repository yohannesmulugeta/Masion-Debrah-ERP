import React from 'react';
import { useErp } from '../context/ErpContext';
import {
  Boxes,
  BookmarkCheck,
  CreditCard,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  TrendingUp,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const {
    products,
    locations,
    balances,
    reservations,
    orders,
    exceptions,
    movements,
    selectedLocationId,
    getProductStock,
  } = useErp();

  // Metrics calculation
  let totalSellable = 0;
  let totalReserved = 0;

  products.forEach((p) => {
    const stock = getProductStock(p.id, selectedLocationId);
    totalSellable += stock.sellableOnHand;
    totalReserved += stock.activeReserved;
  });

  const stockViewName = selectedLocationId === 'all' ? 'all areas' : locations.find(location => location.id === selectedLocationId)?.name || 'the selected area';
  const activeReservations = reservations.filter((r) => r.status === 'active');
  const stockViewReservations = activeReservations.filter(reservation => selectedLocationId === 'all' || reservation.locationId === selectedLocationId);
  const dueHolds = activeReservations.filter(r => new Date(r.reviewAt || r.expiresAt).getTime() <= Date.now() + 24 * 60 * 60 * 1000);
  const awaitingFulfilment = orders.filter(order => !['delivered', 'cancelled'].includes(order.status));
  const outOfStock = products.filter(product => getProductStock(product.id, 'all').available === 0);
  const totalBalanceDue = orders.reduce((sum, o) => sum + (o.balanceDue || 0), 0);

  return (
    <div>
      <div className="view-header">
        <div className="view-title-group">
          <h1>Ethiopia Operations Overview</h1>
          <p>
            Warehouse and Showrooms 1–3 are rooms in one building. Stock totals show {stockViewName}; tasks and orders cover all areas.
          </p>
        </div>
        <div className="view-actions">
          <button className="btn btn-primary" onClick={() => onNavigate('operations')}>
            <PlusCircle size={15} />
            <span>Post Stock Movement</span>
          </button>
          <button className="btn btn-accent" onClick={() => onNavigate('orders')}>
            <TrendingUp size={15} />
            <span>New Showroom Order</span>
          </button>
        </div>
      </div>

      <section className="card" aria-labelledby="attention-title">
        <div className="card-header"><h2 id="attention-title">Needs Attention</h2></div>
        <div className="attention-grid">
          <button onClick={() => onNavigate('reservations')}><strong>{dueHolds.length}</strong><span>reservations due for review</span><ArrowRight size={16} /></button>
          <button onClick={() => onNavigate('orders')}><strong>{awaitingFulfilment.length}</strong><span>orders awaiting handover</span><ArrowRight size={16} /></button>
          <button onClick={() => onNavigate('inventory')}><strong>{outOfStock.length}</strong><span>products with no available stock</span><ArrowRight size={16} /></button>
          <button onClick={() => onNavigate('exceptions')}><strong>{exceptions.length}</strong><span>cases needing review</span><ArrowRight size={16} /></button>
        </div>
      </section>

      {/* Top Level Metric Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-title">
            <span>Physical Sellable Stock</span>
            <Boxes size={18} color="var(--color-primary)" />
          </div>
          <div className="metric-value">{totalSellable}</div>
          <div className="metric-sub">
            {totalSellable - totalReserved} unreserved & immediately sellable
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-title">
            <span>Active Reservations</span>
            <BookmarkCheck size={18} color="var(--color-accent-text)" />
          </div>
          <div className="metric-value">{totalReserved}</div>
            <div className="metric-sub">{stockViewReservations.length} active customer holds in this stock view</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">
            <span>Outstanding Balances Due</span>
            <CreditCard size={18} color="var(--color-info-text)" />
          </div>
          <div className="metric-value" style={{ fontSize: '1.65rem' }}>
            ETB {totalBalanceDue.toLocaleString()}
          </div>
          <div className="metric-sub">{orders.length} orders in registry</div>
        </div>

        <div className="metric-card">
          <div className="metric-title">
            <span>Cases to Reconcile</span>
            <AlertTriangle size={18} color="var(--color-danger-text)" />
          </div>
          <div className="metric-value">{exceptions.length}</div>
          <div className="metric-sub">
            Review cases and adjust affected stock separately
          </div>
        </div>
      </div>

      {/* Stock distribution by area */}
      <div className="card">
        <div className="card-header">
          <h2>Stock by Area</h2>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('inventory')}>
            <span>Full Inventory Matrix</span>
            <ArrowRight size={13} />
          </button>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Area Code</th>
                <th>Area Name</th>
                <th>Type</th>
                <th>Customer Available</th>
                <th style={{ textAlign: 'right' }}>Total Units On-Hand</th>
                <th style={{ textAlign: 'right' }}>Reserved Holds</th>
                <th style={{ textAlign: 'right' }}>Net Sellable Available</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => {
                const locBalances = balances.filter((b) => b.locationId === loc.id);
                const onHand = locBalances.reduce((acc, b) => acc + b.sellableOnHand, 0);
                const res = locBalances.reduce((acc, b) => acc + b.activeReserved, 0);
                const avail = Math.max(0, onHand - res);

                return (
                  <tr key={loc.id}>
                    <td>
                      <strong>{loc.code}</strong>
                    </td>
                    <td>{loc.name}</td>
                    <td>
                      <span className="badge" style={{ background: '#f0f3f0' }}>
                        {loc.type}
                      </span>
                    </td>
                    <td>
                      {loc.isCustomerAvailable ? (
                        <span className="badge badge-in-stock">Yes (Simulated)</span>
                      ) : (
                        <span className="badge" style={{ background: '#eee' }}>
                          Internal Only
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{onHand}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-accent-text)' }}>{res}</td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: avail > 0 ? 'var(--color-primary)' : 'var(--color-text-light)',
                      }}
                    >
                      {avail}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid: Recent Ledger Movements & Active Holds */}
      <div className="dashboard-lower-grid">
        {/* Movements */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h2>Recent Stock Ledger Entries</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('audit')}>
              <span>View All</span>
              <ArrowRight size={13} />
            </button>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Product</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {movements.slice(0, 5).map((m) => {
                  const prod = products.find((p) => p.id === m.productId);
                  return (
                    <tr key={m.id}>
                      <td style={{ fontSize: '0.75rem', color: 'var(--color-text-light)' }}>
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
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
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{m.quantity}</td>
                      <td style={{ fontSize: '0.78rem' }}>{m.referenceNo}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Holds */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h2>Active Customer Holds</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('reservations')}>
              <span>Manage</span>
              <ArrowRight size={13} />
            </button>
          </div>
          <div style={{ padding: '16px 20px' }}>
            {activeReservations.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--color-text-light)' }}>
                No active holds currently.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeReservations.map((r) => {
                  const prod = products.find((p) => p.id === r.productId);
                  const loc = locations.find((l) => l.id === r.locationId);
                  return (
                    <div
                      key={r.id}
                      style={{
                        padding: '12px',
                        background: 'var(--color-bg-subtle)',
                        borderRadius: '6px',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '4px',
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: '0.84rem' }}>{r.orderNumber}</span>
                        <span className="badge badge-reserved">{r.quantity} unit hold</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        {prod?.name} ({prod?.sku})
                      </div>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--color-text-light)',
                          marginTop: '4px',
                        }}
                      >
                        Held at: {loc?.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
