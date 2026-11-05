import React, { useState } from 'react';
import { useErp } from '../context/ErpContext';
import { Search, Filter, AlertCircle } from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { products, locations, balances, selectedLocationId, setSelectedLocationId } = useErp();
  const [search, setSearch] = useState('');

  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase();
    return p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="view-header">
        <div className="view-title-group">
          <h1>Inventory by Area</h1>
          <p>
            Stock in the warehouse and three showroom rooms in the same building.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="search-filter-bar">
        <div className="search-input-wrap">
          <Search />
          <label className="visually-hidden" htmlFor="inventory-search">Search inventory</label>
          <input
            id="inventory-search"
            type="text"
            className="form-input"
            placeholder="Search SKU or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} color="var(--color-text-muted)" />
          <label className="visually-hidden" htmlFor="inventory-area">Filter inventory by area</label>
          <select
            id="inventory-area"
            className="form-select"
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            style={{ width: '220px' }}
          >
            <option value="all">All Areas</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Multi-Location Matrix Table */}
      <div className="card">
        <div className="table-responsive">
          <table className={`data-table mobile-card-table ${selectedLocationId === 'all' ? 'inventory-all-areas' : ''}`}>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Category</th>
                {selectedLocationId === 'all' && locations.map((loc) => (
                  <th key={loc.id} style={{ textAlign: 'center' }}>{loc.name}</th>
                ))}
                <th style={{ textAlign: 'right' }}>Total On-Hand</th>
                <th style={{ textAlign: 'right', color: 'var(--color-gold-text)' }}>Reserved Holds</th>
                <th style={{ textAlign: 'right' }}>Sellable Available</th>
                <th style={{ textAlign: 'center' }}>Availability in View</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p) => {
                let totalOnHand = 0;
                let totalReserved = 0;

                if (selectedLocationId === 'all') {
                  const pBalances = balances.filter((b) => b.productId === p.id);
                  totalOnHand = pBalances.reduce((sum, b) => sum + b.sellableOnHand, 0);
                  totalReserved = pBalances.reduce((sum, b) => sum + b.activeReserved, 0);
                } else {
                  const b = balances.find((item) => item.productId === p.id && item.locationId === selectedLocationId);
                  totalOnHand = b?.sellableOnHand || 0;
                  totalReserved = b?.activeReserved || 0;
                }

                const available = Math.max(0, totalOnHand - totalReserved);
                const hasAvailableStock = available > 0;

                return (
                  <tr key={p.id}>
                    <td data-label="SKU">
                      <strong>{p.sku}</strong>
                    </td>
                    <td data-label="Product">{p.name}</td>
                    <td data-label="Category" style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                      {p.category}
                    </td>

                    {selectedLocationId === 'all' && locations.map((loc) => {
                      const balance = balances.find((b) => b.productId === p.id && b.locationId === loc.id);
                      return <td key={loc.id} data-label={loc.name} style={{ textAlign: 'center' }}>{balance?.sellableOnHand || 0}</td>;
                    })}

                    <td data-label="On hand" style={{ textAlign: 'right', fontWeight: 600 }}>{totalOnHand}</td>
                    <td data-label="Reserved" style={{ textAlign: 'right', color: 'var(--color-gold-text)' }}>
                      {totalReserved > 0 ? totalReserved : '—'}
                    </td>
                    <td
                      data-label="Available"
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: available > 0 ? 'var(--color-primary)' : 'var(--color-text-light)',
                      }}
                    >
                      {available}
                    </td>
                    <td data-label="Availability" style={{ textAlign: 'center' }}>
                      {hasAvailableStock ? (
                        <span className="badge badge-in-stock">In stock</span>
                      ) : (
                        <span className="badge badge-order-only">No available stock</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && <tr><td colSpan={selectedLocationId === 'all' ? locations.length + 7 : 7} className="empty-state">No products match this search.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invariant Explanation Footer */}
      <div
        style={{
          fontSize: '0.78rem',
          color: 'var(--color-text-muted)',
          padding: '12px 18px',
          background: 'var(--color-bg-subtle)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <AlertCircle size={16} color="var(--color-primary)" />
        <span>
          <strong>Stock Invariant:</strong> <code>Sellable Available = Sellable On-Hand - Active Reserved</code>.
          Physical stock never changes on customer reservation holds until final order fulfilment or delivery.
        </span>
      </div>
    </div>
  );
};
