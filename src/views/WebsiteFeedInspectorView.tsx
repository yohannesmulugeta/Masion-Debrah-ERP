import React, { useState } from 'react';
import { useErp } from '../context/ErpContext';
import { Globe, ShieldCheck, Eye, Code2 } from 'lucide-react';

export const WebsiteFeedInspectorView: React.FC = () => {
  const { getPublicAvailabilityFeed, getProductStock, products } = useErp();
  const [selectedSku, setSelectedSku] = useState<string>(products[0]?.sku || '');
  const [showCodeSnippet, setShowCodeSnippet] = useState(false);

  const publicFeed = getPublicAvailabilityFeed();
  const selectedProduct = products.find((p) => p.sku === selectedSku);
  const selectedStock = selectedProduct ? getProductStock(selectedProduct.id) : null;
  const selectedFeedItem = publicFeed.find((f) => f.sku === selectedSku);

  return (
    <div>
      <div className="view-header">
        <div className="view-title-group">
          <h1>Website Availability Feed Inspector</h1>
          <p>
            Browser-only preview of the proposed availability feed for <code>et.maisondebrah.com</code>.
          </p>
        </div>
        <div className="view-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setShowCodeSnippet(!showCodeSnippet)}
          >
            <Code2 size={16} />
            <span>{showCodeSnippet ? 'Hide Integration Code' : 'View React Snippet'}</span>
          </button>
        </div>
      </div>

      {/* Security Isolation Banner */}
      <div
        style={{
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderLeft: '4px solid #16a34a',
          padding: '16px 20px',
          borderRadius: '4px',
          marginBottom: '28px',
          fontSize: '0.84rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <ShieldCheck size={20} color="#16a34a" />
          <strong style={{ fontSize: '0.92rem', color: 'var(--color-primary-dark)' }}>
            Proposed Public Data Boundary
          </strong>
        </div>
        <div style={{ color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          This preview includes catalogue details and a derived status. The proposed SQL view also selects
          product name, collection, category, image, dimensions, and materials. It does not select raw stock,
          customers, payments, or movements. Database permissions and website delivery have not been verified.
        </div>
      </div>

      {/* Code Snippet Box */}
      {showCodeSnippet && (
        <div className="card" style={{ background: '#1c2826', color: '#e5eee8', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-accent)' }}>
              Client Helper: src/lib/availabilityClient.ts
            </span>
          </div>
          <pre style={{ fontSize: '0.78rem', overflowX: 'auto', lineHeight: 1.6, color: '#f3f7f4' }}>
{`// Safe Public Availability Feed for et.maisondebrah.com
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY // Safe public anon key only
);

export async function fetchProductAvailability(sku: string) {
  const { data, error } = await supabase
    .from('v_public_product_availability')
    .select('sku, availability_status')
    .eq('sku', sku)
    .single();

  if (error || !data) {
    return { status: 'check_availability', label: 'Check Availability' };
  }

  return {
    status: data.availability_status,
    label: data.availability_status === 'in_stock' 
      ? 'Available in Ethiopia' 
      : 'Ask about ordering'
  };
}`}
          </pre>
        </div>
      )}

      {/* Side-by-Side Comparison: Public Website View vs Private ERP Truth */}
      <div className="feed-comparison-grid" style={{ marginBottom: '32px' }}>
        {/* Left: What Public Website Visitors See */}
        <div className="card" style={{ borderColor: '#bbf7d0', boxShadow: '0 4px 14px rgba(22, 163, 74, 0.08)' }}>
          <div className="card-header" style={{ background: '#f0fdf4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={18} color="#16a34a" />
              <h2 style={{ fontSize: '1.1rem', color: '#15803d' }}>
                Public Website Experience (et.maisondebrah.com)
              </h2>
            </div>
            <span className="badge badge-in-stock">Simulated Feed</span>
          </div>

          <div style={{ padding: '24px' }}>
            {selectedProduct && selectedFeedItem && (
              <div>
                <div style={{ height: '220px', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' }}>
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--color-accent-text)', fontWeight: 700 }}>
                  {selectedProduct.collection}
                </div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 400, margin: '4px 0 8px' }}>
                  {selectedProduct.name}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginBottom: '18px' }}>
                  SKU: {selectedProduct.sku}
                </div>

                {/* THE DERIVED PUBLIC BADGE */}
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '6px',
                    textAlign: 'center',
                    backgroundColor:
                      selectedFeedItem.availabilityStatus === 'in_stock' ? '#e8f5ec' : '#fcf5ea',
                    border:
                      selectedFeedItem.availabilityStatus === 'in_stock'
                        ? '1px solid #c2e5cb'
                        : '1px solid #fae6cb',
                  }}
                >
                  <div
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      color:
                        selectedFeedItem.availabilityStatus === 'in_stock' ? '#166534' : '#9a5806',
                      marginBottom: '4px',
                    }}
                  >
                    {selectedFeedItem.availabilityStatus === 'in_stock'
                      ? '● Available in Ethiopia'
                      : '○ Ask about ordering'}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#666' }}>
                    {selectedFeedItem.availabilityStatus === 'in_stock'
                      ? 'Contact staff to confirm viewing or delivery arrangements.'
                      : 'Not currently in local stock. Inquire with our consultants for made-to-order delivery.'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Private ERP Backend Reality */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={18} color="var(--color-primary)" />
              <h2 style={{ fontSize: '1.1rem' }}>Private ERP Internal Ledger (Staff Only)</h2>
            </div>
            <span className="badge" style={{ background: '#f0f3f0' }}>Browser Demo</span>
          </div>

          <div style={{ padding: '24px' }}>
            {selectedProduct && selectedStock && (
              <div>
                <div className="form-group">
                  <label htmlFor="feed-product">Select Product to Inspect</label>
                  <select
                    id="feed-product"
                    className="form-select"
                    value={selectedSku}
                    onChange={(e) => setSelectedSku(e.target.value)}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.sku}>
                        {p.sku} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '14px',
                    marginTop: '20px',
                    marginBottom: '20px',
                  }}
                >
                  <div style={{ background: 'var(--color-bg-subtle)', padding: '14px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      Physical Stock On-Hand
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                      {selectedStock.sellableOnHand}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)' }}>
                      Across warehouse & 3 showrooms
                    </div>
                  </div>

                  <div style={{ background: 'var(--color-bg-subtle)', padding: '14px', borderRadius: '6px' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                      Active Customer Holds
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-accent-text)' }}>
                      {selectedStock.activeReserved}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-light)' }}>
                      Committed in showroom orders
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: '16px',
                    background: '#faf9f6',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.84rem' }}>Net Unreserved Available:</span>
                    <strong style={{ fontSize: '1.1rem', color: selectedStock.available > 0 ? 'var(--color-primary)' : 'var(--color-danger-text)' }}>
                      {selectedStock.available} unit(s)
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Reference Retail Price:</span>
                    <span>ETB {selectedProduct.referencePrice.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Quarantine / Damaged Units:</span>
                    <span style={{ color: selectedStock.damagedCount > 0 ? 'var(--color-danger-text)' : 'inherit' }}>
                      {selectedStock.damagedCount}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full Live Public Feed View Table */}
      <div className="card">
        <div className="card-header">
          <h2>Simulated Availability Output</h2>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Official SKU</th>
                <th>Product Name</th>
                <th>Collection</th>
                <th>Category</th>
                <th style={{ textAlign: 'center' }}>Derived Website Status</th>
                <th style={{ textAlign: 'center' }}>Customer Website Label</th>
              </tr>
            </thead>
            <tbody>
              {publicFeed.map((f) => (
                <tr
                  key={f.sku}
                  style={{
                    backgroundColor: f.sku === selectedSku ? '#fbf7ee' : undefined,
                  }}
                >
                  <td>
                    <button className="table-link-button" onClick={() => setSelectedSku(f.sku)}>{f.sku}</button>
                  </td>
                  <td>{f.name}</td>
                  <td>{f.collection}</td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    {f.category}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <code>{f.availabilityStatus}</code>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {f.availabilityStatus === 'in_stock' ? (
                      <span className="badge badge-in-stock">Available in Ethiopia</span>
                    ) : (
                      <span className="badge badge-order-only">Ask about ordering</span>
                    )}
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
