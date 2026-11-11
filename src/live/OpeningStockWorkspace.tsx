import { useMemo, useState, type FormEvent } from 'react';
import type { Tables } from '../types/database.generated';
import { supabase } from '../lib/supabase';

type Product = Tables<'products'>;
type Location = Tables<'locations'>;
type Balance = Tables<'stock_balances'>;
type Client = NonNullable<typeof supabase>;
type TaskResult = { error: { message: string } | null };
type Count = { product_id: string; location_id: string; quantity: number };

type Props = {
  products: Product[]; locations: Location[]; balances: Balance[];
  canManage: boolean; busy: boolean; client: Client;
  perform: (task: () => PromiseLike<TaskResult>, success: string, form?: HTMLFormElement) => Promise<boolean>;
};

function parseCounts(text: string, products: Product[], locations: Location[], balances: Balance[]) {
  const bySku = new Map(products.map(product => [product.sku.toUpperCase(), product]));
  const byArea = new Map(locations.map(location => [location.code.toUpperCase(), location]));
  const existing = new Set(balances.map(balance => `${balance.product_id}/${balance.location_id}`));
  const seen = new Set<string>();
  const rows: Count[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const cells = line.split(/[\t,]/).map(cell => cell.trim());
    if (index === 0 && cells[0]?.toLowerCase() === 'sku') return;
    const product = bySku.get(cells[0]?.toUpperCase() ?? '');
    const location = byArea.get(cells[1]?.toUpperCase() ?? '');
    const quantity = cells[2] ?? '';
    const key = `${product?.id}/${location?.id}`;
    if (cells.length !== 3 || !product?.is_active || product.local_price == null
      || !location?.is_active || !/^\d+$/.test(quantity) || Number(quantity) > 2147483647
      || existing.has(key) || seen.has(key)) {
      errors.push(`Line ${index + 1}: check approved SKU, area code, whole quantity, and whether the opening count was already posted.`);
      return;
    }
    seen.add(key);
    rows.push({ product_id: product.id, location_id: location.id, quantity: Number(quantity) });
  });
  return { rows, errors };
}

export function OpeningStockWorkspace({ products, locations, balances, canManage, busy, client, perform }: Props) {
  const [text, setText] = useState('');
  const preview = useMemo(() => parseCounts(text, products, locations, balances), [text, products, locations, balances]);
  const active = products.filter(product => product.is_active && product.local_price != null);

  function submitSingle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const row = { product_id: String(values.get('product')), location_id: String(values.get('area')),
      quantity: Number(values.get('quantity')) };
    void perform(() => client.rpc('erp_post_opening_stock', {
      p_items: [row], p_reference: String(values.get('reference')).trim(),
    }), 'Opening count recorded.', form);
  }

  function submitBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview.rows.length || preview.errors.length) return;
    const form = event.currentTarget;
    const reference = String(new FormData(form).get('reference') ?? '').trim();
    void perform(() => client.rpc('erp_post_opening_stock', {
      p_items: preview.rows, p_reference: reference,
    }), `${preview.rows.length} opening count(s) recorded together.`)
      .then(ok => { if (ok) { setText(''); form.reset(); } });
  }

  return <section className="live-card">
    <h3>Verified opening stock</h3>
    <p className="live-hint">Use a signed physical count sheet. Enter each SKU separately for Warehouse and Showrooms 1–3. Zero is a valid confirmed count. An opening count can only be posted once per product and area.</p>
    {canManage ? <div className="live-grid live-opening-grid">
      <form onSubmit={submitSingle}>
        <strong>One item and area</strong>
        <label className="live-field"><span>Approved product</span><select name="product" required defaultValue=""><option value="" disabled>Choose…</option>
          {active.map(product => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}
        </select></label>
        <label className="live-field"><span>Counted area</span><select name="area" required defaultValue=""><option value="" disabled>Choose…</option>
          {locations.filter(location => location.is_active).map(location => <option key={location.id} value={location.id}>{location.code} · {location.name}</option>)}
        </select></label>
        <label className="live-field"><span>Physical count</span><input name="quantity" type="number" min="0" step="1" required /></label>
        <label className="live-field"><span>Count sheet reference</span><input name="reference" required /></label>
        <button className="live-primary" disabled={busy || !active.length}>Post opening count</button>
      </form>
      <form onSubmit={submitBatch}>
        <strong>Count sheet import</strong>
        <p className="live-hint">Paste columns <code>SKU,area code,quantity</code>. Every valid row posts in one database transaction.</p>
        <label className="live-field"><span>Counts from approved sheet</span><textarea rows={7} value={text}
          onChange={event => setText(event.target.value)} placeholder={'SKU,area code,quantity\nABC-001,WH,2\nABC-001,SR-1,0'} required /></label>
        <label className="live-field"><span>Count sheet reference</span><input name="reference" required /></label>
        <p className="live-hint">{preview.rows.length} valid row(s){preview.errors.length ? ` · ${preview.errors.length} error(s)` : ''}</p>
        {preview.errors.slice(0, 5).map(error => <p className="live-error" key={error}>{error}</p>)}
        <button className="live-primary" disabled={busy || !preview.rows.length || !!preview.errors.length}>Post all opening counts</button>
      </form>
    </div> : <p className="live-empty">An Admin or Manager posts opening counts after the physical sheet is signed.</p>}
  </section>;
}
