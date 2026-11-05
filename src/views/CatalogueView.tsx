import React, { useState } from 'react';
import { useErp } from '../context/ErpContext';
import { Product } from '../types';
import { Search, Upload, CheckCircle2, AlertOctagon, Info, FileSpreadsheet } from 'lucide-react';
import { Modal } from '../components/Modal';
import { CataloguePreview, previewCatalogueImport } from '../lib/catalogueImport';

export const CatalogueView: React.FC = () => {
  const { products, importCatalogueBatch, canPerform } = useErp();
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importReport, setImportReport] = useState<CataloguePreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.sku.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.collection.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  const handleRunImport = () => {
    setImportError(null);
    setImportReport(null);
    try {
      const parsed: unknown = JSON.parse(importJsonText);
      setImportReport(previewCatalogueImport(parsed, products));
    } catch (err: unknown) {
      if (err instanceof Error) {
        setImportError(err.message);
      } else {
        setImportError('Invalid JSON format.');
      }
    }
  };

  const handleConfirmImport = () => {
    if (!importReport || importReport.errors.length > 0 || importReport.validProducts.length === 0) return;
    try {
      const result = importCatalogueBatch(importReport.validProducts);
      setImportSuccess(`${result.imported} demo product(s) imported into this browser.`);
      setIsImportModalOpen(false);
      setImportReport(null);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed.');
    }
  };

  const sampleImportPayload = JSON.stringify(
    [
      {
        id: `prod-new-${Date.now()}-1`,
        sku: 'MD-ACC-009',
        name: 'Kyoto Hand-Carved Travertine Bowl',
        collection: 'Objet',
        category: 'Accessories',
        description: 'Sculptural centerpiece carved from unpolished honed travertine block.',
        dimensions: '40 x 40 x 12 cm',
        materials: 'Honed Roman Travertine',
        imageUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80',
        referencePrice: 42000,
        isActive: true,
      },
      {
        id: `prod-new-${Date.now()}-2`,
        sku: 'MD-SOF-001', // Intentional duplicate to demonstrate constraint rejection!
        name: 'Duplicate Sofa Code Test',
        collection: 'Signature Living',
        category: 'Sofas',
        description: 'Should be rejected by validation engine.',
        dimensions: '200 x 90 cm',
        materials: 'Fabric',
        imageUrl: '',
        referencePrice: 200000,
        isActive: true,
      },
      {
        id: `prod-new-${Date.now()}-3`,
        sku: '', // Intentional blank SKU to demonstrate constraint rejection!
        name: 'Blank SKU Item Test',
        collection: 'Test',
        category: 'Chairs',
        description: 'Must never be imported without unique code.',
        dimensions: '',
        materials: '',
        imageUrl: '',
        referencePrice: 50000,
        isActive: true,
      },
    ],
    null,
    2
  );

  return (
    <div>
      <div className="view-header">
        <div className="view-title-group">
          <h1>Maison Debrah Official Catalogue</h1>
          <p>
            Centrally governed product information: unique SKUs, specifications, dimensions, and
            approved photography.
          </p>
        </div>
        <div className="view-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              setImportJsonText(sampleImportPayload);
              setImportReport(null);
              setImportError(null);
              setIsImportModalOpen(true);
            }}
            disabled={!canPerform('import_catalogue')}
            title={
              !canPerform('import_catalogue')
                ? 'Only Admin and Managers can import catalogue batches'
                : 'Import HQ product records'
            }
          >
            <Upload size={15} />
            <span>Review Catalogue Batch</span>
          </button>
        </div>
      </div>

      {importSuccess && <div className="form-note" role="status">{importSuccess}</div>}

      {/* Notice Banner */}
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
        <Info size={20} color="var(--color-gold)" style={{ flexShrink: 0 }} />
        <div>
          <strong>HQ Single Source of Truth:</strong> Product codes and specifications are
          controlled by Maison Debrah HQ. Stock availability and pricing within Ethiopia are managed
          locally. The public website matches inventory strictly by official SKU.
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-filter-bar">
        <div className="search-input-wrap">
          <Search />
          <label className="visually-hidden" htmlFor="catalogue-search">Search catalogue</label>
          <input
            id="catalogue-search"
            type="text"
            className="form-input"
            placeholder="Search by SKU, product name, collection, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Product Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gap: '24px',
        }}
      >
        {filteredProducts.map((prod) => (
          <div
            key={prod.id}
            className="card"
            role="button"
            tabIndex={0}
            aria-label={`View ${prod.name}, SKU ${prod.sku}`}
            style={{
              marginBottom: 0,
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onClick={() => setSelectedProduct(prod)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedProduct(prod);
              }
            }}
          >
            <div
              style={{
                height: '210px',
                background: '#edeae3',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <img
                src={prod.imageUrl}
                alt={prod.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80';
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  background: 'rgba(25, 37, 31, 0.85)',
                  color: '#fff',
                  padding: '3px 8px',
                  borderRadius: '3px',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                }}
              >
                {prod.sku}
              </span>
            </div>
            <div style={{ padding: '18px 20px' }}>
              <div
                style={{
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--color-gold-text)',
                  fontWeight: 700,
                  marginBottom: '4px',
                }}
              >
                {prod.collection} • {prod.category}
              </div>
              <h3
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.18rem',
                  fontWeight: 400,
                  marginBottom: '8px',
                  color: 'var(--color-primary-dark)',
                }}
              >
                {prod.name}
              </h3>
              <div
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--color-text-muted)',
                  lineHeight: 1.4,
                  marginBottom: '12px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {prod.description}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: '12px',
                }}
              >
                <div style={{ fontSize: '0.74rem', color: 'var(--color-text-light)' }}>
                  Ref. Price
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--color-primary)' }}>
                  ETB {prod.referencePrice.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        ))}
        {filteredProducts.length === 0 && <div className="empty-state">No products match this search.</div>}
      </div>

      {/* Product Details Modal */}
      <Modal
        isOpen={selectedProduct !== null}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct?.name || 'Product Details'}
      >
        {selectedProduct && (
          <div>
            <div
              style={{
                height: '240px',
                borderRadius: '6px',
                overflow: 'hidden',
                marginBottom: '18px',
                background: '#eee',
              }}
            >
              <img
                src={selectedProduct.imageUrl}
                alt={selectedProduct.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Official SKU
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {selectedProduct.sku}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Collection
                </div>
                <div style={{ fontSize: '0.95rem' }}>{selectedProduct.collection}</div>
              </div>
            </div>
            <div className="form-group">
              <div className="detail-label">Description</div>
              <p style={{ fontSize: '0.86rem', color: 'var(--color-text-muted)' }}>
                {selectedProduct.description}
              </p>
            </div>
            <div className="form-group">
              <div className="detail-label">Dimensions</div>
              <p style={{ fontSize: '0.86rem' }}>{selectedProduct.dimensions}</p>
            </div>
            <div className="form-group">
              <div className="detail-label">Materials & Craftsmanship</div>
              <p style={{ fontSize: '0.86rem' }}>{selectedProduct.materials}</p>
            </div>
            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
                Local Reference Price:
              </span>
              <strong style={{ fontSize: '1.2rem', color: 'var(--color-primary)' }}>
                ETB {selectedProduct.referencePrice.toLocaleString()}
              </strong>
            </div>
          </div>
        )}
      </Modal>

      {/* Catalogue Import Dry-Run Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="HQ Catalogue Import & Validation Engine"
      >
        <div>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginBottom: '14px' }}>
            Demo only: paste product JSON, review every validation error, then import valid rows into this browser.
            This is not an HQ catalogue connection.
          </div>

          <div className="form-group">
            <label htmlFor="catalogue-json">JSON Catalogue Payload (HQ Source)</label>
            <textarea
              id="catalogue-json"
              className="form-textarea"
              rows={8}
              value={importJsonText}
              onChange={(e) => { setImportJsonText(e.target.value); setImportReport(null); setImportError(null); }}
              style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}
            />
          </div>

          {importError && (
            <div
              style={{
                background: 'var(--color-danger-bg)',
                color: 'var(--color-danger-text)',
                padding: '10px 14px',
                borderRadius: '4px',
                fontSize: '0.82rem',
                marginBottom: '14px',
              }}
            >
              <strong>Import Error:</strong> {importError}
            </div>
          )}

          {importReport && (
            <div
              style={{
                background: 'var(--color-bg-subtle)',
                border: '1px solid var(--color-border)',
                padding: '14px',
                borderRadius: '6px',
                marginBottom: '16px',
              }}
            >
              <h4 style={{ fontSize: '0.86rem', marginBottom: '8px', color: 'var(--color-primary)' }}>
                Dry-Run Validation Report
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success-text)' }}>
                  <CheckCircle2 size={16} />
                  <span>
                    <strong>{importReport.validProducts.length}</strong> valid products ready to import
                  </span>
                </div>
                {importReport.duplicates > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-warning-text)' }}>
                    <AlertOctagon size={16} />
                    <span>
                      <strong>{importReport.duplicates}</strong> duplicate SKUs rejected (already existing)
                    </span>
                  </div>
                )}
                {importReport.blankSkus > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-danger-text)' }}>
                    <AlertOctagon size={16} />
                    <span>
                      <strong>{importReport.blankSkus}</strong> items rejected due to missing/blank SKU
                    </span>
                  </div>
                )}
                {importReport.invalidRows > 0 && <div>{importReport.invalidRows} rows have invalid product details.</div>}
                {importReport.errors.length > 0 && (
                  <ul className="import-errors">
                    {importReport.errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(false)}>
              Close
            </button>
            <button className="btn btn-secondary" onClick={handleRunImport}>
              <FileSpreadsheet size={15} />
              <span>Preview Batch</span>
            </button>
            <button className="btn btn-primary" onClick={handleConfirmImport} disabled={!importReport || importReport.errors.length > 0 || importReport.validProducts.length === 0}>
              Import Valid Products
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
