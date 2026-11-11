import { useMemo, useState, type FormEvent } from 'react';
import type { Tables } from '../types/database.generated';
import { supabase } from '../lib/supabase';

type Product = Tables<'products'>;
type Balance = Tables<'stock_balances'>;
type Location = Tables<'locations'>;
type Client = NonNullable<typeof supabase>;
type TaskResult = { error: { message: string } | null };

type Props = {
  products: Product[];
  balances: Balance[];
  locations: Location[];
  canManage: boolean;
  busy: boolean;
  client: Client;
  perform: (task: () => PromiseLike<TaskResult>, success: string, form?: HTMLFormElement) => Promise<boolean>;
};

const field = (form: HTMLFormElement, name: string) => String(new FormData(form).get(name) ?? '').trim();
const pricePattern = /^\d+(?:\.\d{1,2})?$/;

function parsePrices(raw: string, products: Product[]) {
  const known = new Set(products.map(product => product.sku.toUpperCase()));
  const seen = new Set<string>();
  const rows: { sku: string; price: string }[] = [];
  const errors: string[] = [];
  raw.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const parts = line.split(/[\t,]/).map(part => part.trim());
    if (index === 0 && parts[0]?.toLowerCase() === 'sku') return;
    const sku = parts[0]?.toUpperCase() ?? '';
    const price = parts[1] ?? '';
    if (parts.length !== 2 || !known.has(sku) || seen.has(sku) || !pricePattern.test(price)
      || Number(price) <= 0 || Number(price) > 9999999999.99) {
      errors.push(`Line ${index + 1}: check SKU and positive ETB price (two decimals maximum).`);
      return;
    }
    seen.add(sku);
    rows.push({ sku, price });
  });
  return { rows, errors };
}

export function ProductWorkspace({ products, balances, locations, canManage, busy, client, perform }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'draft' | 'active' | 'paused'>('draft');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [priceText, setPriceText] = useState('');
  const [uploadError, setUploadError] = useState('');
  const selected = products.find(product => product.id === selectedId) ?? null;
  const pricePreview = useMemo(() => parsePrices(priceText, products), [priceText, products]);
  const listed = products.filter(product => {
    const status = product.is_active ? 'active' : product.local_price == null ? 'draft' : 'paused';
    const matchesStatus = filter === 'all' || status === filter;
    const query = search.trim().toLowerCase();
    return matchesStatus && (!query || `${product.sku} ${product.name} ${product.category}`.toLowerCase().includes(query));
  });
  const pageCount = Math.max(1, Math.ceil(listed.length / 10));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = listed.slice(currentPage * 10, currentPage * 10 + 10);
  const draftCount = products.filter(product => !product.is_active && product.local_price == null).length;
  const activeCount = products.filter(product => product.is_active).length;
  const missingImages = products.filter(product => !product.image_url).length;

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const rawPrice = field(form, 'price');
    const nextStatus = field(form, 'status') === 'active' ? 'active' : rawPrice ? 'paused' : 'draft';
    void perform(() => client.rpc('erp_review_product', {
      p_product_id: selected.id,
      p_name: field(form, 'name'),
      p_category: field(form, 'category'),
      p_description: field(form, 'description'),
      // The generated RPC type marks NUMERIC as required, although SQL accepts NULL for a draft.
      p_local_price: (rawPrice ? Number(rawPrice) : null) as number,
      p_is_active: nextStatus === 'active',
      p_reason: field(form, 'reason'),
    }), 'Product review saved. Existing order prices remain unchanged.')
      .then(ok => { if (ok) { setFilter(nextStatus); setPage(0); } });
  }

  function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void perform(() => client.rpc('erp_create_draft_product', {
      p_sku: field(form, 'sku'), p_name: field(form, 'name'),
      p_category: field(form, 'category'), p_description: field(form, 'description'),
    }), 'Draft product added.', form);
  }

  function submitPrices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pricePreview.rows.length || pricePreview.errors.length) return;
    const form = event.currentTarget;
    void perform(() => client.rpc('erp_apply_product_prices', {
      p_prices: pricePreview.rows, p_reason: field(form, 'reason'),
    }), `Approved price list checked for ${pricePreview.rows.length} SKU(s). Products remain paused until reviewed.`)
      .then(ok => { if (ok) { setPriceText(''); setFilter('paused'); setPage(0); form.reset(); } });
  }

  function uploadImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const input = event.currentTarget.elements.namedItem('photo') as HTMLInputElement | null;
    const file = input?.files?.[0];
    const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    if (!file || !extensions[file.type] || file.size > 10 * 1024 * 1024) {
      setUploadError('Choose a JPEG, PNG, or WebP image no larger than 10 MB.');
      return;
    }
    setUploadError('');
    const path = `products/${selected.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
    void perform(async () => {
      const uploaded = await client.storage.from('erp-product-images').upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (uploaded.error) return { error: uploaded.error };
      const { data } = client.storage.from('erp-product-images').getPublicUrl(path);
      return client.rpc('erp_link_product_image', {
        p_product_id: selected.id, p_storage_path: path, p_public_url: data.publicUrl,
      });
    }, 'Verified product image linked.', event.currentTarget);
  }

  return <>
    <div className="live-summary-strip" aria-label="Product review summary">
      <span><strong>{draftCount}</strong> need first price</span>
      <span><strong>{activeCount}</strong> available to order</span>
      <span><strong>{missingImages}</strong> need confirmed images</span>
    </div>
    <section className="live-card">
      <h3>Product review</h3>
      <p className="live-hint">Choose an imported product to check its identity, price, and sale status. “Active” allows new orders; physical availability still depends on stock.</p>
      <div className="live-product-controls">
        <label className="live-field"><span>Find SKU or product</span><input value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="Search by SKU, name, or category" /></label>
        <label className="live-field"><span>Show</span><select value={filter} onChange={event => { setFilter(event.target.value as typeof filter); setPage(0); }}>
          <option value="draft">Needs first price</option><option value="paused">Priced but paused</option>
          <option value="active">Active</option><option value="all">All products</option>
        </select></label>
      </div>
      <p className="live-list-count">Showing {listed.length} of {products.length} products</p>
      {listed.length === 0 ? <p className="live-empty">No products match this search and filter.</p> :
        <div className="live-table-wrap"><table><thead><tr><th>Photo</th><th>SKU and name</th><th>Price</th><th>Stock available</th><th>Status</th><th></th></tr></thead><tbody>
          {visible.map(product => {
            const available = balances.filter(balance => balance.product_id === product.id)
              .reduce((sum, balance) => sum + balance.sellable_on_hand - balance.active_reserved, 0);
            return <tr key={product.id}>
              <td>{product.image_url ? <img className="live-product-image" src={product.image_url} alt={product.name} loading="lazy" /> : <span className="live-image-pending">Photo pending</span>}</td>
              <td><strong>{product.sku}</strong><br />{product.name}</td>
              <td>{product.local_price == null ? 'Price pending' : `${Number(product.local_price).toLocaleString()} ETB`}</td>
              <td>{available}</td>
              <td>{product.is_active ? 'Active' : product.local_price == null ? 'Draft' : 'Paused'}</td>
              <td><button type="button" onClick={() => {
                setSelectedId(product.id);
                requestAnimationFrame(() => document.getElementById('live-selected-product')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
              }}>Review</button></td>
            </tr>;
          })}
        </tbody></table></div>}
      {listed.length > 10 && <div className="live-pagination"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
        <span>Page {currentPage + 1} of {pageCount}</span>
        <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next</button></div>}
    </section>

    {selected && <section className="live-card live-review-card" aria-labelledby="live-selected-product">
      <h3 id="live-selected-product">Review {selected.sku}</h3>
      <div className="live-selected-product">
        {selected.image_url ? <img src={selected.image_url} alt={selected.name} /> : <span className="live-image-pending">Photo pending</span>}
        <div><strong>{selected.name}</strong><p>{selected.description || 'No description yet.'}</p>
          <p>{locations.map(location => {
            const row = balances.find(balance => balance.product_id === selected.id && balance.location_id === location.id);
            return `${location.name}: ${row ? row.sellable_on_hand - row.active_reserved : 0}`;
          }).join(' · ')}</p></div>
      </div>
      {canManage && <div className="live-grid">
        <form key={`${selected.id}:${selected.updated_at}`} onSubmit={submitReview}>
          <label className="live-field"><span>Product name</span><input name="name" defaultValue={selected.name} required /></label>
          <label className="live-field"><span>Category</span><input name="category" defaultValue={selected.category} required /></label>
          <label className="live-field"><span>Description</span><textarea name="description" defaultValue={selected.description ?? ''} rows={3} /></label>
          <label className="live-field"><span>Approved price in ETB</span><input name="price" type="number" min="0.01" step="0.01" defaultValue={selected.local_price ?? ''} /></label>
          <label className="live-field"><span>Sale status</span><select name="status" defaultValue={selected.is_active ? 'active' : 'paused'}>
            <option value="paused">Paused / draft</option><option value="active">Active for new orders</option>
          </select></label>
          <label className="live-field"><span>Approval or change reason</span><input name="reason" required placeholder="Price list or approval reference" /></label>
          <button className="live-primary" disabled={busy}>Save product review</button>
        </form>
        <form onSubmit={uploadImage}>
          <strong>Confirmed product photo</strong>
          <p className="live-hint">Upload only a photo verified against this exact SKU. New photos are public product media.</p>
          <label className="live-field"><span>JPEG, PNG, or WebP</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required /></label>
          {uploadError && <p className="live-error" role="alert">{uploadError}</p>}
          <button disabled={busy}>Upload and link photo</button>
        </form>
      </div>}
    </section>}

    {canManage && <div className="live-grid">
      <section className="live-card"><h3>Add a new draft</h3><form onSubmit={submitDraft}>
        <label className="live-field"><span>SKU</span><input name="sku" required /></label>
        <label className="live-field"><span>Product name</span><input name="name" required /></label>
        <label className="live-field"><span>Category</span><input name="category" required /></label>
        <label className="live-field"><span>Description</span><textarea name="description" rows={3} /></label>
        <button disabled={busy}>Create draft</button>
      </form></section>
      <section className="live-card"><h3>Apply approved price list</h3>
        <p className="live-hint">Paste SKU and ETB price, one per line. All rows are checked and saved together. This does not activate products.</p>
        <form onSubmit={submitPrices}>
          <label className="live-field"><span>SKU,price</span><textarea value={priceText} onChange={event => setPriceText(event.target.value)} rows={7} placeholder={'SKU,price\nABC-001,125000.00'} required /></label>
          <label className="live-field"><span>Approved price list reference</span><input name="reason" required /></label>
          <p className="live-hint">{pricePreview.rows.length} valid row(s){pricePreview.errors.length ? ` · ${pricePreview.errors.length} error(s)` : ''}</p>
          {pricePreview.errors.slice(0, 5).map(error => <p className="live-error" key={error}>{error}</p>)}
          <button className="live-primary" disabled={busy || !pricePreview.rows.length || !!pricePreview.errors.length}>Save price list</button>
        </form>
      </section>
    </div>}
  </>;
}
