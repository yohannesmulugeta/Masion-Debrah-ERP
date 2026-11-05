import React, { useState } from 'react';
import { useErp } from '../context/ErpContext';
import { ArrowDownLeft, ArrowLeftRight, ClipboardCheck, AlertTriangle } from 'lucide-react';

export const StockOperationsView: React.FC = () => {
  const {
    products,
    locations,
    postReceipt,
    postTransfer,
    recordAdjustment,
    getProductStock,
    canPerform,
    currentStaff,
  } = useErp();

  const [activeTab, setActiveTab] = useState<'receipt' | 'transfer' | 'adjustment'>('receipt');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [receiptForm, setReceiptForm] = useState({
    productId: products[0]?.id || '',
    locationId: locations[0]?.id || '',
    quantity: 1,
    referenceNo: `RCV-${Date.now().toString().slice(-6)}`,
    reason: 'HQ Container import arrival',
  });

  const [transferForm, setTransferForm] = useState({
    productId: products[0]?.id || '',
    sourceLocationId: 'loc-wh',
    destLocationId: 'loc-bole',
    quantity: 1,
    referenceNo: `TRF-${Date.now().toString().slice(-6)}`,
    reason: 'Showroom stock replenishment',
  });

  const [adjustmentForm, setAdjustmentForm] = useState({
    productId: products[0]?.id || '',
    locationId: 'loc-wh',
    newQuantity: 5,
    reason: 'Physical month-end audit reconciliation',
  });

  const clearMessages = () => {
    setSuccessMsg(null);
    setErrorMsg(null);
  };

  const handleReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    try {
      postReceipt(receiptForm);
      setSuccessMsg(`Successfully received ${receiptForm.quantity} unit(s) into inventory.`);
      setReceiptForm((prev) => ({
        ...prev,
        referenceNo: `RCV-${Date.now().toString().slice(-6)}`,
        quantity: 1,
      }));
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Receipt failed.');
      }
    }
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    try {
      postTransfer(transferForm);
      setSuccessMsg(
        `Successfully moved ${transferForm.quantity} unit(s) between areas.`
      );
      setTransferForm((prev) => ({
        ...prev,
        referenceNo: `TRF-${Date.now().toString().slice(-6)}`,
        quantity: 1,
      }));
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Transfer failed.');
      }
    }
  };

  const handleAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    try {
      recordAdjustment(adjustmentForm);
      setSuccessMsg(
        `Authorized stock adjustment recorded. New count set to ${adjustmentForm.newQuantity}.`
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Adjustment failed.');
      }
    }
  };

  // Source stock available for transfer
  const transferSrcStock = getProductStock(
    transferForm.productId,
    transferForm.sourceLocationId
  );

  return (
    <div>
      <div className="view-header">
        <div className="view-title-group">
          <h1>Stock Operations & Inventory Ledger</h1>
          <p>
            Authorized receipts, moves between rooms, and audited adjustments.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: '28px',
        }}
      >
        <button
          className={`btn ${activeTab === 'receipt' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setActiveTab('receipt');
            clearMessages();
          }}
        >
          <ArrowDownLeft size={16} />
          <span>Goods Receipt (Inflow)</span>
        </button>

        <button
          className={`btn ${activeTab === 'transfer' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setActiveTab('transfer');
            clearMessages();
          }}
        >
          <ArrowLeftRight size={16} />
          <span>Move Stock Between Areas</span>
        </button>

        <button
          className={`btn ${activeTab === 'adjustment' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setActiveTab('adjustment');
            clearMessages();
          }}
        >
          <ClipboardCheck size={16} />
          <span>Physical Audit & Adjustment</span>
        </button>
      </div>

      {/* Feedback alerts */}
      {successMsg && (
        <div
          style={{
            background: 'var(--color-success-bg)',
            color: 'var(--color-success-text)',
            padding: '12px 18px',
            borderRadius: '4px',
            marginBottom: '20px',
            fontWeight: 500,
            fontSize: '0.86rem',
          }}
        >
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger-text)',
            padding: '12px 18px',
            borderRadius: '4px',
            marginBottom: '20px',
            fontWeight: 500,
            fontSize: '0.86rem',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Tab 1: Goods Receipt */}
      {activeTab === 'receipt' && (
        <div className="card" style={{ maxWidth: '680px' }}>
          <div className="card-header">
            <h2>Post Goods Receipt to Location</h2>
          </div>
          <form onSubmit={handleReceipt} style={{ padding: '24px' }}>
            <div className="form-group">
              <label htmlFor="receipt-product">Select Catalogue Product (HQ SKU)</label>
              <select
                id="receipt-product"
                className="form-select"
                value={receiptForm.productId}
                onChange={(e) =>
                  setReceiptForm({ ...receiptForm, productId: e.target.value })
                }
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name} ({p.collection})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="receipt-area">Receiving Area</label>
                <select
                  id="receipt-area"
                  className="form-select"
                  value={receiptForm.locationId}
                  onChange={(e) =>
                    setReceiptForm({ ...receiptForm, locationId: e.target.value })
                  }
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="receipt-quantity">Quantity to Receive</label>
                <input
                  id="receipt-quantity"
                  type="number"
                  min="1"
                  className="form-input"
                  value={receiptForm.quantity}
                  onChange={(e) =>
                    setReceiptForm({ ...receiptForm, quantity: parseInt(e.target.value) || 1 })
                  }
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="receipt-reference">Bill of Lading / Shipping Reference</label>
                <input
                  id="receipt-reference"
                  type="text"
                  className="form-input"
                  value={receiptForm.referenceNo}
                  onChange={(e) =>
                    setReceiptForm({ ...receiptForm, referenceNo: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="receipt-note">Receipt Note / Reason</label>
                <input
                  id="receipt-note"
                  type="text"
                  className="form-input"
                  value={receiptForm.reason}
                  onChange={(e) =>
                    setReceiptForm({ ...receiptForm, reason: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '16px',
                borderTop: '1px solid var(--color-border)',
                paddingTop: '16px',
              }}
            >
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!canPerform('post_receipt')}
              >
                <ArrowDownLeft size={16} />
                <span>Post Goods Receipt</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Move stock between areas */}
      {activeTab === 'transfer' && (
        <div className="card" style={{ maxWidth: '680px' }}>
          <div className="card-header">
            <h2>Move Stock Between Areas</h2>
          </div>
          <form onSubmit={handleTransfer} style={{ padding: '24px' }}>
            <div className="form-group">
              <label htmlFor="transfer-product">Select Product (HQ SKU)</label>
              <select
                id="transfer-product"
                className="form-select"
                value={transferForm.productId}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, productId: e.target.value })
                }
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="transfer-source">From Area</label>
                <select
                  id="transfer-source"
                  className="form-select"
                  value={transferForm.sourceLocationId}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, sourceLocationId: e.target.value })
                  }
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="transfer-destination">To Area</label>
                <select
                  id="transfer-destination"
                  className="form-select"
                  value={transferForm.destLocationId}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, destLocationId: e.target.value })
                  }
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Real-time availability indicator at source */}
            <div
              style={{
                background: 'var(--color-bg-subtle)',
                padding: '12px 14px',
                borderRadius: '4px',
                fontSize: '0.82rem',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Source Available (Unreserved):</span>
              <strong
                style={{
                  color:
                    transferSrcStock.available > 0
                      ? 'var(--color-primary)'
                      : 'var(--color-danger-text)',
                }}
              >
                {transferSrcStock.available} unit(s) available
              </strong>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="transfer-quantity">Quantity to Move</label>
                <input
                  id="transfer-quantity"
                  type="number"
                  min="1"
                  max={transferSrcStock.available || 1}
                  className="form-input"
                  value={transferForm.quantity}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, quantity: parseInt(e.target.value) || 1 })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="transfer-waybill">Transfer Waybill Number</label>
                <input
                  id="transfer-waybill"
                  type="text"
                  className="form-input"
                  value={transferForm.referenceNo}
                  onChange={(e) =>
                    setTransferForm({ ...transferForm, referenceNo: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="transfer-reason">Reason / Dispatch Memo</label>
              <input
                id="transfer-reason"
                type="text"
                className="form-input"
                value={transferForm.reason}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, reason: e.target.value })
                }
                required
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '16px',
                borderTop: '1px solid var(--color-border)',
                paddingTop: '16px',
              }}
            >
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!canPerform('post_transfer') || transferSrcStock.available < transferForm.quantity}
              >
                <ArrowLeftRight size={16} />
                <span>Execute Stock Transfer</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 3: Physical Count Audit & Adjustment */}
      {activeTab === 'adjustment' && (
        <div className="card" style={{ maxWidth: '680px' }}>
          <div className="card-header">
            <h2>Authorized Physical Inventory Count Adjustment</h2>
          </div>
          <form onSubmit={handleAdjustment} style={{ padding: '24px' }}>
            {!canPerform('approve_adjustment') && (
              <div
                style={{
                  background: 'var(--color-warning-bg)',
                  color: 'var(--color-warning-text)',
                  padding: '12px 16px',
                  borderRadius: '4px',
                  marginBottom: '16px',
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <AlertTriangle size={18} />
                <span>
                  <strong>Manager Authorization Required:</strong> Current role (
                  <code>{currentStaff.role}</code>) cannot approve inventory count adjustments.
                  Switch to <strong>Administrator</strong> or <strong>Manager</strong> in top header to approve.
                </span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="adjustment-product">Select Product (SKU)</label>
              <select
                id="adjustment-product"
                className="form-select"
                value={adjustmentForm.productId}
                onChange={(e) =>
                  setAdjustmentForm({ ...adjustmentForm, productId: e.target.value })
                }
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="adjustment-area">Area</label>
                <select
                  id="adjustment-area"
                  className="form-select"
                  value={adjustmentForm.locationId}
                  onChange={(e) =>
                    setAdjustmentForm({ ...adjustmentForm, locationId: e.target.value })
                  }
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="adjustment-count">Verified Physical Count</label>
                <input
                  id="adjustment-count"
                  type="number"
                  min="0"
                  className="form-input"
                  value={adjustmentForm.newQuantity}
                  onChange={(e) =>
                    setAdjustmentForm({
                      ...adjustmentForm,
                      newQuantity: parseInt(e.target.value) || 0,
                    })
                  }
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="adjustment-reason">Justification / Discrepancy Reason</label>
              <input
                id="adjustment-reason"
                type="text"
                className="form-input"
                value={adjustmentForm.reason}
                onChange={(e) =>
                  setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })
                }
                required
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '16px',
                borderTop: '1px solid var(--color-border)',
                paddingTop: '16px',
              }}
            >
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!canPerform('approve_adjustment')}
              >
                <ClipboardCheck size={16} />
                <span>Authorize & Post Adjustment</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
