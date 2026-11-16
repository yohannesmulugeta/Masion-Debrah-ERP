import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '../types/database.generated';

type Client = SupabaseClient<Database>;
type Receipt = { product: string; quantity: number; supplier: string; reference: string; notes: string; file: File | null; path: string };
type Props = {
  products: Tables<'products'>[];
  locations: Tables<'locations'>[];
  balances: Tables<'stock_balances'>[];
  transfers: Tables<'erp_room_transfers'>[];
  receipts: Tables<'stock_movements'>[];
  initialProduct: string;
  canStock: boolean;
  busy: boolean;
  client: Client;
  actor: string;
  perform: (task: () => PromiseLike<{ error: { message: string } | null }>, success: string, form?: HTMLFormElement) => Promise<boolean>;
};
const extensions: Record<string, string> = {
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
};
const field = (data: FormData, name: string) => String(data.get(name) ?? '').trim();

export function StockOperations({ products, locations, balances, transfers, receipts, initialProduct, canStock, busy, client, actor, perform }: Props) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [preview, setPreview] = useState(false);
  const [attachmentUploaded, setAttachmentUploaded] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [receivingId, setReceivingId] = useState('');
  const receiving = transfers.find(transfer => transfer.id === receivingId && transfer.received_at === null);
  const activeAreas = locations.filter(area => area.is_active);
  const productName = (id: string) => {
    const product = products.find(item => item.id === id);
    return product ? `${product.sku} · ${product.name}` : 'Product unavailable';
  };
  const areaName = (id: string) => locations.find(area => area.id === id)?.name ?? 'Unknown area';
  const productChoices = products.map(product => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>);
  const areaChoices = activeAreas.map(area => <option key={area.id} value={area.id}>{area.name}</option>);

  function reviewReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const selected = data.get('document');
    const file = selected instanceof File && selected.name ? selected : receipt?.file ?? null;
    if (file && (!extensions[file.type] || file.size === 0 || file.size > 10 * 1024 * 1024)) {
      setFeedback('Choose a PDF or image between 1 byte and 10 MB.');
      return;
    }
    const sameFile = file === receipt?.file;
    const path = file ? (sameFile ? receipt.path : `warehouse-receipts/${actor}/${crypto.randomUUID()}.${extensions[file.type]}`) : '';
    setReceipt({ product: field(data, 'product'), quantity: Number(field(data, 'quantity')),
      supplier: field(data, 'supplier'), reference: field(data, 'reference'), notes: field(data, 'notes'), file, path });
    if (!sameFile) setAttachmentUploaded(false);
    setFeedback('');
    setPreview(true);
  }

  async function postReceipt() {
    if (!receipt || !canStock || busy) return;
    const saved = await perform(async () => {
      if (receipt.file && !attachmentUploaded) {
        const upload = await client.storage.from('erp-private-evidence').upload(receipt.path, receipt.file, {
          contentType: receipt.file.type, upsert: false,
        });
        if (upload.error) {
          // A retry after a lost upload response can reuse the same private object.
          const existing = await client.storage.from('erp-private-evidence').createSignedUrl(receipt.path, 30);
          if (existing.error) return { error: upload.error };
        }
        setAttachmentUploaded(true);
      }
      return client.rpc('erp_receive_warehouse', {
        p_product: receipt.product, p_quantity: receipt.quantity, p_supplier: receipt.supplier,
        p_reference: receipt.reference, p_notes: receipt.notes, p_document_path: receipt.path,
        p_document_name: receipt.file?.name ?? '',
      });
    }, `Warehouse receipt ${receipt.reference} posted with ${receipt.quantity} units.`);
    if (saved) {
      setReceipt(null);
      setAttachmentUploaded(false);
      setPreview(false);
    }
  }

  async function openDocument(path: string) {
    setFeedback('');
    const result = await client.storage.from('erp-private-evidence').createSignedUrl(path, 60);
    if (!result.data) {
      setFeedback(result.error?.message ?? 'Could not open the receipt document.');
      return;
    }
    const link = document.createElement('a');
    link.href = result.data.signedUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
  }

  return <>
    {feedback && <p className="live-error" role="alert">{feedback}</p>}
    {canStock && <div className="live-grid">
      <section className="live-card">
        <h3>Receive at Warehouse</h3>
        {preview && receipt ? <>
          <p><strong>{receipt.quantity}</strong> units of {productName(receipt.product)}</p>
          <p>{receipt.supplier} · {receipt.reference}{receipt.file && ` · ${receipt.file.name}`}</p>
          {receipt.notes && <p>{receipt.notes}</p>}
          <div className="live-actions">
            <button type="button" disabled={busy} onClick={() => setPreview(false)}>Edit receipt</button>
            <button type="button" className="live-primary" disabled={busy} onClick={() => void postReceipt()}>Confirm warehouse receipt</button>
          </div>
        </> : <form onSubmit={reviewReceipt}>
          <label className="live-field"><span>Product</span><select name="product" required defaultValue={receipt?.product ?? initialProduct}><option value="">Choose…</option>{productChoices}</select></label>
          <label className="live-field"><span>Quantity received</span><input name="quantity" type="number" min="1" max="2147483647" step="1" required defaultValue={receipt?.quantity} /></label>
          <label className="live-field"><span>Supplier</span><input name="supplier" required defaultValue={receipt?.supplier} /></label>
          <label className="live-field"><span>Invoice or delivery note reference</span><input name="reference" required defaultValue={receipt?.reference} /></label>
          <label className="live-field"><span>Notes</span><input name="notes" defaultValue={receipt?.notes} /></label>
          <label className="live-field"><span>Invoice or delivery note (optional)</span><input name="document" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" /></label>
          {receipt?.file && <p>{receipt.file.name} <button type="button" onClick={() => {
            setReceipt({ ...receipt, file: null, path: '' }); setAttachmentUploaded(false);
          }}>Remove attachment</button></p>}
          <button className="live-primary" disabled={busy || !products.length}>Review receipt</button>
        </form>}
      </section>
      <section className="live-card">
        <h3>Dispatch stock transfer</h3>
        <p className="live-hint">Units leave the source on dispatch and enter destination stock after arrival confirmation.</p>
        <form onSubmit={event => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          const product = field(data, 'product');
          const source = field(data, 'source');
          const destination = field(data, 'destination');
          const quantity = Number(field(data, 'quantity'));
          const balance = balances.find(row => row.product_id === product && row.location_id === source);
          if (source === destination || !balance || quantity > balance.sellable_on_hand - balance.active_reserved) {
            setFeedback('Choose different areas and check the unreserved stock at the source.');
            return;
          }
          setFeedback('');
          void perform(() => client.rpc('erp_send_room_transfer', {
            p_product: product, p_source: source, p_destination: destination, p_quantity: quantity,
            p_reference: field(data, 'reference'), p_notes: field(data, 'notes'),
          }), 'Transfer dispatched. Confirm arrival at the destination.', form);
        }}>
          <label className="live-field"><span>Product</span><select name="product" required defaultValue=""><option value="">Choose…</option>{productChoices}</select></label>
          <label className="live-field"><span>From</span><select name="source" required defaultValue=""><option value="">Choose…</option>{areaChoices}</select></label>
          <label className="live-field"><span>Destination</span><select name="destination" required defaultValue=""><option value="">Choose…</option>{areaChoices}</select></label>
          <label className="live-field"><span>Quantity to send</span><input name="quantity" type="number" min="1" max="2147483647" step="1" required /></label>
          <label className="live-field"><span>Transfer reference</span><input name="reference" required /></label>
          <label className="live-field"><span>Notes</span><input name="notes" /></label>
          <button className="live-primary" disabled={busy || !products.length || activeAreas.length < 2}>Dispatch transfer</button>
        </form>
      </section>
    </div>}
    <section className="live-card"><h3>Transfer register</h3>
      {transfers.length === 0 ? <p className="live-empty">No staged transfers yet.</p> : <div className="live-table-wrap"><table>
        <thead><tr><th>Reference</th><th>Product</th><th>Route</th><th>Sent</th><th>Received</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{transfers.map(item => <tr key={item.id}><td>{item.reference}</td><td>{productName(item.product_id)}</td>
          <td>{areaName(item.source_id)} → {areaName(item.destination_id)}</td><td>{item.quantity}</td><td>{item.received_quantity ?? '—'}</td>
          <td>{item.received_at ? item.discrepancy ? `Discrepancy · ${item.discrepancy}` : 'Received' : 'In transit'}</td>
          <td>{canStock && !item.received_at && <button type="button" disabled={busy} onClick={() => setReceivingId(item.id)}>Confirm arrival</button>}</td>
        </tr>)}</tbody>
      </table></div>}
      {canStock && receiving && <form key={receiving.id} onSubmit={event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void perform(() => client.rpc('erp_receive_room_transfer', {
          p_transfer: receiving.id, p_quantity: Number(field(data, 'quantity')), p_discrepancy: field(data, 'discrepancy'),
        }), `Arrival recorded for ${receiving.reference}.`).then(ok => { if (ok) setReceivingId(''); });
      }}>
        <h4>Confirm {receiving.reference} at {areaName(receiving.destination_id)}</h4>
        <label className="live-field"><span>Sellable units that arrived</span><input name="quantity" type="number" min="0" max={receiving.quantity} step="1" required /></label>
        <label className="live-field"><span>Explain any shortage or damage</span><input name="discrepancy" /></label>
        <button className="live-primary" disabled={busy}>Record arrival</button>{' '}
        <button type="button" disabled={busy} onClick={() => setReceivingId('')}>Cancel</button>
      </form>}
    </section>
    <section className="live-card"><h3>Warehouse receipt register</h3>
      {receipts.length === 0 ? <p className="live-empty">No supplier receipts posted through this screen yet.</p> : <div className="live-table-wrap"><table>
        <thead><tr><th>Reference</th><th>Supplier</th><th>Product</th><th>Quantity</th><th>Document</th></tr></thead>
        <tbody>{receipts.map(item => <tr key={item.id}><td>{item.reference_no}</td><td>{item.supplier_name}</td>
          <td>{productName(item.product_id)}</td><td>{item.quantity}</td>
          <td>{item.receipt_document_path ? <button type="button" onClick={() => void openDocument(item.receipt_document_path!)}>{item.receipt_document_name}</button> : '—'}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}
