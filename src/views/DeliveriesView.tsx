import React, { useEffect, useRef, useState } from 'react';
import { useErp } from '../context/ErpContext';
import { DeliveryRecord } from '../types';
import { Modal } from '../components/Modal';

export const DeliveriesView: React.FC = () => {
  const { deliveries, products, locations, canPerform, confirmDelivery, failDelivery, receiveFailedDelivery } = useErp();
  const [selected, setSelected] = useState<DeliveryRecord | null>(null);
  const [mode, setMode] = useState<'sign' | 'fail' | null>(null);
  const [signedBy, setSignedBy] = useState('');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pendingActionRef = useRef(false);
  useEffect(() => { pendingActionRef.current = false; }, [deliveries]);

  const open = (record: DeliveryRecord, action: 'sign' | 'fail') => {
    setSelected(record);
    setMode(action);
    setSignedBy(record.intendedRecipient);
    setReference('');
    setReason('');
    setError(null);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !mode) return;
    if (pendingActionRef.current) return;
    pendingActionRef.current = true;
    try {
      if (mode === 'sign') confirmDelivery({ deliveryId: selected.id, signedBy, signedReference: reference });
      else failDelivery({ deliveryId: selected.id, reason });
      setSelected(null);
      setMode(null);
      setError(null);
    } catch (caught: unknown) {
      pendingActionRef.current = false;
      setError(caught instanceof Error ? caught.message : 'Could not update this delivery.');
    }
  };

  const receive = (record: DeliveryRecord) => {
    if (pendingActionRef.current) return;
    pendingActionRef.current = true;
    try {
      receiveFailedDelivery(record.id);
      setError(null);
    } catch (caught: unknown) {
      pendingActionRef.current = false;
      setError(caught instanceof Error ? caught.message : 'Could not receive the returned item.');
    }
  };

  return <div>
    <div className="view-header">
      <div className="view-title-group">
        <h1>Deliveries & signed handover</h1>
        <p>Track dispatched items, record the customer's signed receipt, and review failed deliveries.</p>
      </div>
    </div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="card">
      <div className="table-responsive">
        <table className="data-table mobile-card-table">
          <thead><tr><th>Order / Item</th><th>Recipient & Address</th><th>Released from</th><th>Dispatched</th><th>Status / Proof</th><th>Action</th></tr></thead>
          <tbody>
            {deliveries.map(record => <tr key={record.id}>
              <td data-label="Order / Item"><strong>{record.orderNumber}</strong><div>{record.quantity} × {products.find(product => product.id === record.productId)?.name || record.productId}</div></td>
              <td data-label="Recipient & Address"><strong>{record.intendedRecipient}</strong><div>{record.deliveryAddress}</div></td>
              <td data-label="Released from">{locations.find(location => location.id === record.sourceLocationId)?.name}</td>
              <td data-label="Dispatched">{new Date(record.dispatchedAt).toLocaleString()}</td>
              <td data-label="Status / Proof"><span className={`badge ${record.status === 'delivered' ? 'badge-delivered' : record.status === 'dispatched' ? 'badge-dispatched' : 'badge-reserved'}`}>{record.status.replaceAll('_', ' ')}</span>{record.signedBy && <div>Signed by {record.signedBy} · {record.signedReference}</div>}{record.failureReason && <div>{record.failureReason}</div>}</td>
              <td data-label="Action"><div className="delivery-actions">
                {record.status === 'dispatched' && <>
                  <button className="btn btn-primary btn-sm" onClick={() => open(record, 'sign')} disabled={!canPerform('fulfil_order')}>Record signature</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => open(record, 'fail')} disabled={!canPerform('fulfil_order')}>Delivery failed</button>
                </>}
                {record.status === 'failed' && <button className="btn btn-secondary btn-sm" onClick={() => receive(record)} disabled={!canPerform('post_receipt')}>Receive for inspection</button>}
              </div></td>
            </tr>)}
            {deliveries.length === 0 && <tr><td colSpan={6} className="empty-state">No items have been dispatched yet. Fully paid orders can be dispatched from Orders.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
    <Modal isOpen={selected !== null} onClose={() => setSelected(null)} title={mode === 'sign' ? 'Record signed delivery' : 'Record failed delivery'}>
      {selected && <form onSubmit={submit}>
        <p className="form-note">{selected.orderNumber} · {selected.quantity} unit(s). Keep the signed document with this reference for audit.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        {mode === 'sign' ? <>
          <div className="form-group"><label htmlFor="delivery-signatory">Name of person who signed</label><input id="delivery-signatory" className="form-input" value={signedBy} onChange={event => setSignedBy(event.target.value)} required /></div>
          <div className="form-group"><label htmlFor="delivery-proof">Signed delivery document reference</label><input id="delivery-proof" className="form-input" value={reference} onChange={event => setReference(event.target.value)} required /></div>
        </> : <div className="form-group"><label htmlFor="delivery-failure">Reason delivery failed</label><textarea id="delivery-failure" className="form-textarea" value={reason} onChange={event => setReason(event.target.value)} required /></div>}
        <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
      </form>}
    </Modal>
  </div>;
};
