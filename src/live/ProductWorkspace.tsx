import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Tables } from '../types/database.generated';
import { supabase } from '../lib/supabase';
import { EthiopiaOpeningCounts, ethiopiaOpeningAreaCodes } from './OpeningStockWorkspace';

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
  error?: string;
  message?: string;
  client: Client;
  onReceiveProduct: (productId: string) => void;
  perform: (task: () => PromiseLike<TaskResult>, success: string, form?: HTMLFormElement) => Promise<boolean>;
};

const field = (form: HTMLFormElement, name: string) => String(new FormData(form).get(name) ?? '').trim();
const pricePattern = /^\d+(?:\.\d{1,2})?$/;
const imageExtensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function catalogueVariant(product: Product) {
  const specifications = product.specifications;
  return specifications && typeof specifications === 'object' && !Array.isArray(specifications)
    && typeof specifications.variant === 'string' ? specifications.variant : '';
}

function isInEthiopiaWebsiteCatalogue(product: Product) {
  const specifications = product.specifications;
  return specifications !== null && typeof specifications === 'object'
    && !Array.isArray(specifications) && Boolean(specifications.ethiopia_website_catalogue);
}

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

function ProductPanel({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const overflow = document.body.style.overflow;
    dialog?.showModal(); document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={ref} className="live-product-panel" aria-labelledby="product-panel-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="live-product-panel-header"><div><p>PRODUCT CATALOGUE</p><h2 id="product-panel-title">{title}</h2></div>
      <button type="button" disabled={busy} onClick={onClose} aria-label="Close product panel">Close</button></header>
    {children}
  </dialog>;
}

export function ProductWorkspace({ products, balances, locations, canManage, busy, error, message, client, onReceiveProduct, perform }: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'draft' | 'active' | 'paused' | 'ethiopia'>(
    () => products.some(isInEthiopiaWebsiteCatalogue) ? 'ethiopia' : 'draft'
  );
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftSku, setDraftSku] = useState('');
  const [panelMessage, setPanelMessage] = useState('');
  const duplicate = products.find(product => product.sku.trim().toUpperCase() === draftSku.trim().toUpperCase());
  const [priceText, setPriceText] = useState('');
  const [uploadError, setUploadError] = useState('');
  const selected = products.find(product => product.id === selectedId) ?? null;
  const pricePreview = useMemo(() => parsePrices(priceText, products), [priceText, products]);
  const catalogue = products.filter(isInEthiopiaWebsiteCatalogue);
  const openingAreaIds = new Set(locations.filter(area => area.is_active && ethiopiaOpeningAreaCodes.includes(area.code)).map(area => area.id));
  const recordedAreas = new Map<string, number>();
  for (const balance of balances) {
    if (openingAreaIds.has(balance.location_id)) {
      recordedAreas.set(balance.product_id, (recordedAreas.get(balance.product_id) ?? 0) + 1);
    }
  }
  const allAreasRecorded = (product: Product) => recordedAreas.get(product.id) === ethiopiaOpeningAreaCodes.length;
  const listed = products.filter(product => {
    const status = product.is_active ? 'active' : product.local_price == null ? 'draft' : 'paused';
    const matchesFilter = filter === 'ethiopia'
      ? isInEthiopiaWebsiteCatalogue(product)
      : filter === 'all' || status === filter;
    const query = search.trim().toLowerCase();
    return matchesFilter && (!query || `${product.sku} ${product.name} ${product.category}`.toLowerCase().includes(query));
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
    const rawPrice = field(form, 'price') || (selected.local_price == null ? '' : String(selected.local_price));
    setPanelMessage('');
    const nextStatus = field(form, 'status') === 'active' ? 'active' : rawPrice ? 'paused' : 'draft';
    void perform(() => client.rpc('erp_review_product', {
      p_product_id: selected.id,
      p_name: field(form, 'name') || selected.name,
      p_category: field(form, 'category') || selected.category,
      p_description: field(form, 'description') || selected.description || '',
      // The generated RPC type marks NUMERIC as required, although SQL accepts NULL for a draft.
      p_local_price: (rawPrice ? Number(rawPrice) : null) as number,
      p_is_active: nextStatus === 'active',
      p_reason: field(form, 'reason'),
    }), 'Product review saved. Existing order prices remain unchanged.')
      .then(ok => { if (ok) { setFilter(nextStatus); setPage(0); setPanelMessage('Product review saved.'); } });
  }

  function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (duplicate) return;
    const photo = (form.elements.namedItem('photo') as HTMLInputElement).files?.[0];
    if (photo && (!imageExtensions[photo.type] || photo.size === 0 || photo.size > 10 * 1024 * 1024)) {
      setUploadError('Choose a JPEG, PNG, or WebP image between 1 byte and 10 MB.');
      return;
    }
    setUploadError('');
    let createdId: string | null = null;
    let photoError = '';
    void perform(async () => {
      const created = await client.rpc('erp_create_catalogue_draft', {
        p_sku: field(form, 'sku'), p_name: field(form, 'name'), p_category: field(form, 'category'),
        p_description: field(form, 'description'), p_variant: field(form, 'variant'),
      });
      if (created.error) return { error: created.error };
      createdId = created.data;
      if (photo && createdId) {
        try {
          photoError = (await savePhoto(createdId, photo)).error?.message ?? '';
        } catch {
          photoError = 'The upload could not be completed.';
        }
      }
      return { error: null };
    }, 'Draft product added.').then(ok => {
      if (!ok) return;
      setAdding(false); setDraftSku(''); setFilter('draft'); setSearch(''); setPage(0); setSelectedId(createdId);
      if (photoError) setUploadError(`Draft saved. Retry the photo from this panel. ${photoError}`);
    });
  }

  function submitPrices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pricePreview.rows.length || pricePreview.errors.length) return;
    const form = event.currentTarget;
    void perform(() => client.rpc('erp_apply_product_prices', {
      p_prices: pricePreview.rows, p_reason: field(form, 'reason'),
    }), `Approved prices updated for ${pricePreview.rows.length} SKU(s). Existing sale status is unchanged.`)
      .then(ok => { if (ok) { setPriceText(''); setFilter('all'); setPage(0); form.reset(); } });
  }

  async function savePhoto(productId: string, file: File) {
    const path = `products/${productId}/${crypto.randomUUID()}.${imageExtensions[file.type]}`;
    const uploaded = await client.storage.from('erp-product-images').upload(path, file, {
      contentType: file.type, upsert: false,
    });
    if (uploaded.error) return { error: uploaded.error };
    const { data } = client.storage.from('erp-product-images').getPublicUrl(path);
    return client.rpc('erp_link_product_image', {
      p_product_id: productId, p_storage_path: path, p_public_url: data.publicUrl,
    });
  }

  function uploadImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const input = event.currentTarget.elements.namedItem('photo') as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file || !imageExtensions[file.type] || file.size === 0 || file.size > 10 * 1024 * 1024) {
      setUploadError('Choose a JPEG, PNG, or WebP image no larger than 10 MB.');
      return;
    }
    setUploadError('');
    void perform(() => savePhoto(selected.id, file), 'Verified product image linked.', event.currentTarget);
  }

  return <>
    <div className="live-product-toolbar"><div><strong>Manage your catalogue</strong><p>Review existing products or add a new product draft.</p></div>{canManage && <button className="live-primary" onClick={() => { setSelectedId(null); setDraftSku(''); setPanelMessage(''); setUploadError(''); setAdding(true); }}>+ Add product</button>}</div>
    <div className="live-summary-strip" aria-label="Product review summary">
      {filter === 'ethiopia' ? <>
        <span><strong>{catalogue.length}</strong> listed on website</span>
        <span><strong>{catalogue.filter(product => !product.image_url).length}</strong> need confirmed images</span>
        <span><strong>{catalogue.filter(product => !allAreasRecorded(product)).length}</strong> need stock records</span>
        <span><strong>{catalogue.filter(product => product.image_url && allAreasRecorded(product)).length}</strong> ready for review</span>
      </> : <>
        <span><strong>{draftCount}</strong> need first price</span>
        <span><strong>{activeCount}</strong> available to order</span>
        <span><strong>{missingImages}</strong> need confirmed images</span>
      </>}
    </div>
    <section className="live-card">
      <h3>Product review</h3>
      <p className="live-hint">Choose an imported product to check its identity, price, and sale status. “Active” allows new orders; physical availability still depends on stock.</p>
      {filter === 'ethiopia' && <p><a href="#ethiopia-opening-counts">Enter or review opening counts</a></p>}
      <div className="live-product-controls">
        <label className="live-field"><span>Find SKU or product</span><input value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="Search by SKU, name, or category" /></label>
        <label className="live-field"><span>Show</span><select value={filter} onChange={event => { setFilter(event.target.value as typeof filter); setPage(0); }}>
          <option value="draft">Needs first price</option><option value="paused">Priced but paused</option>
          <option value="active">Active</option><option value="all">All products</option>
          <option value="ethiopia">Ethiopia website catalogue</option>
        </select></label>
      </div>
      <p className="live-list-count">Showing {listed.length} of {products.length} products</p>
      {listed.length === 0 ? <p className="live-empty">No products match this search and filter.</p> :
        <div className="live-table-wrap"><table><thead><tr><th>Photo</th><th>SKU and name</th><th>Price</th><th>Stock available</th><th>Status</th><th></th></tr></thead><tbody>
          {visible.map(product => {
            const productBalances = balances.filter(balance => balance.product_id === product.id);
            const available = productBalances.reduce((sum, balance) => sum + balance.sellable_on_hand - balance.active_reserved, 0);
            const areaCount = recordedAreas.get(product.id) ?? 0;
            return <tr key={product.id}>
              <td>{product.image_url ? <img className="live-product-image" src={product.image_url} alt={product.name} loading="lazy" /> : <span className="live-image-pending">Photo pending</span>}</td>
              <td><strong>{product.sku}</strong><br />{product.name}{isInEthiopiaWebsiteCatalogue(product) && <><br /><small>Listed on website</small></>}</td>
              <td>{product.local_price == null ? 'Price pending' : `${Number(product.local_price).toLocaleString()} ETB`}</td>
              <td>{productBalances.length ? available : 'Stock unconfirmed'}
                {filter === 'ethiopia' && areaCount > 0 && <><br /><small>{areaCount} of {ethiopiaOpeningAreaCodes.length} areas recorded</small></>}
              </td>
              <td>{product.is_active ? 'Active' : product.local_price == null ? 'Draft' : 'Paused'}</td>
              <td><button type="button" onClick={() => {
                setPanelMessage(''); setUploadError(''); setSelectedId(product.id);
              }}>Review</button></td>
            </tr>;
          })}
        </tbody></table></div>}
      {listed.length > 10 && <div className="live-pagination"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
        <span>Page {currentPage + 1} of {pageCount}</span>
        <button type="button" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next</button></div>}
    </section>

    <div hidden={filter !== 'ethiopia'} id="ethiopia-opening-counts">
      <EthiopiaOpeningCounts products={catalogue} locations={locations} balances={balances}
        canManage={canManage} busy={busy} client={client} perform={perform} />
    </div>

    {selected && <ProductPanel title={`Review ${selected.sku}`} busy={busy} onClose={() => setSelectedId(null)}><section className="live-card live-review-card" >
      <p className="live-hint">Saved information is filled in. Complete missing fields or update a value; blank fields keep saved information. SKU: <strong>{selected.sku}</strong>.</p>
      {error && <p className="live-panel-feedback live-error" role="alert">{error}</p>}{(message || panelMessage) && <p className="live-panel-feedback" role="status">{message || panelMessage}</p>}
      <div className="live-selected-product">
        {selected.image_url ? <img src={selected.image_url} alt={selected.name} /> : <span className="live-image-pending">Photo pending</span>}
        <div><strong>{selected.name}</strong>{catalogueVariant(selected) && <p>{catalogueVariant(selected)}</p>}<p>{selected.description || 'No description yet.'}</p>
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
      {canManage && <button type="button" disabled={busy} onClick={() => onReceiveProduct(selected.id)}>Receive at Warehouse</button>}
    </section></ProductPanel>}

    {canManage && adding && <ProductPanel title="Add product" busy={busy} onClose={() => setAdding(false)}><section className="live-card">{error && <p className="live-panel-feedback live-error" role="alert">{error}</p>}<p className="live-hint">Create a draft first, then review its price, photo, and sale status.</p><form onSubmit={submitDraft}>
        <label className="live-field"><span>SKU</span><input name="sku" value={draftSku} onChange={event => setDraftSku(event.target.value)} required autoComplete="off" /></label>
        <label className="live-field"><span>Product name</span><input name="name" required /></label>
        <label className="live-field"><span>Category</span><input name="category" required /></label>
        <label className="live-field"><span>Variant or finish</span><input name="variant" /></label>
        <label className="live-field"><span>Description</span><textarea name="description" rows={3} /></label>
        <label className="live-field"><span>Product photo (optional)</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        {uploadError && <p className="live-error" role="alert">{uploadError}</p>}
        {duplicate && <div className="live-duplicate" role="status"><strong>This SKU already exists: {duplicate.name}</strong><p>Open its review to complete missing information.</p><button type="button" onClick={() => { setAdding(false); setPanelMessage(''); setUploadError(''); setSelectedId(duplicate.id); }}>Review existing product</button></div>}
        <button className="live-primary" disabled={busy || !!duplicate}>{busy ? 'Saving...' : 'Create product draft'}</button>
      </form></section></ProductPanel>}
    {canManage && <details className="live-price-tools"><summary>Bulk price update</summary>
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
    </details>}
  </>;
}
