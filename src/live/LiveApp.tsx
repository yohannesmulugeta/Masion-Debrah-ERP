import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowRight, BookmarkCheck, Boxes, CreditCard, PlusCircle, TrendingUp, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Enums, Tables } from '../types/database.generated';
import { LiveShell, type LiveTab } from './LiveShell';
import { ProductWorkspace } from './ProductWorkspace';
import { OpeningStockWorkspace } from './OpeningStockWorkspace';
import { EvidenceAttachment } from './EvidenceAttachment';
import './live.css';

type Profile = Tables<'staff_profiles'>;
type Location = Tables<'locations'>;
type Product = Tables<'products'>;
type Balance = Tables<'stock_balances'>;
type Order = Tables<'sales_orders'>;
type Line = Tables<'sales_order_lines'>;
type Customer = Tables<'customers'>;
type Reservation = Tables<'reservations'>;
type Delivery = Tables<'deliveries'>;
type Payment = Tables<'payments'>;
type Refund = Tables<'refunds'>;
type Movement = Tables<'stock_movements'>;
type Evidence = Tables<'erp_evidence'>;
type Data = {
  locations: Location[]; products: Product[]; balances: Balance[];
  orders: Order[]; lines: Line[]; customers: Customer[];
  reservations: Reservation[]; deliveries: Delivery[];
  payments: Payment[]; refunds: Refund[]; movements: Movement[];
  evidence: Evidence[];
};

const emptyData: Data = { locations: [], products: [], balances: [], orders: [], lines: [], customers: [], reservations: [], deliveries: [], payments: [], refunds: [], movements: [], evidence: [] };
const money = (value: number | null | undefined) => `${Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : '—';
const value = (form: HTMLFormElement, key: string) => String(new FormData(form).get(key) ?? '').trim();
const int = (form: HTMLFormElement, key: string) => Number(value(form, key));
const dateTime = (form: HTMLFormElement, key: string) => new Date(value(form, key)).toISOString();
const localDateTimeInDays = (days: number) => {
  const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return new Date(target.getTime() - target.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

async function readData(): Promise<Data> {
  if (!supabase) throw new Error('Live backend is not configured');
  const results = await Promise.all([
    supabase.from('locations').select('*').order('code'),
    supabase.from('products').select('*').order('name'),
    supabase.from('stock_balances').select('*'),
    supabase.from('sales_orders').select('*').order('created_at', { ascending: false }),
    supabase.from('sales_order_lines').select('*'),
    supabase.from('customers').select('*'),
    supabase.from('reservations').select('*').order('created_at', { ascending: false }),
    supabase.from('deliveries').select('*').order('created_at', { ascending: false }),
    supabase.from('payments').select('*').order('created_at', { ascending: false }),
    supabase.from('refunds').select('*').order('created_at', { ascending: false }),
    supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(5),
    supabase.from('erp_evidence').select('*').order('created_at', { ascending: false }),
  ] as const);
  const failure = results.find(result => result.error);
  if (failure?.error) throw failure.error;
  return {
    locations: [...(results[0].data ?? [])].sort((a, b) =>
      Number(b.type === 'warehouse') - Number(a.type === 'warehouse') || a.code.localeCompare(b.code)),
    products: results[1].data ?? [],
    balances: results[2].data ?? [], orders: results[3].data ?? [],
    lines: results[4].data ?? [], customers: results[5].data ?? [],
    reservations: results[6].data ?? [], deliveries: results[7].data ?? [],
    payments: results[8].data ?? [], refunds: results[9].data ?? [],
    movements: results[10].data ?? [],
    evidence: results[11].data ?? [],
  };
}

async function duringStartup<T>(request: PromiseLike<T>, step: string): Promise<T> {
  let timeout: number | undefined;
  try {
    return await Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error(`${step} took too long. Check your connection and try again.`)), 12000);
      }),
    ]);
  } finally {
    window.clearTimeout(timeout);
  }
}

function Field({ label, name, type = 'text', required = true, min, step, placeholder, defaultValue }: {
  label: string; name: string; type?: string; required?: boolean; min?: string; step?: string; placeholder?: string; defaultValue?: string;
}) {
  return <label className="live-field"><span>{label}</span><input name={name} type={type} required={required} min={min} step={step} placeholder={placeholder} defaultValue={defaultValue} /></label>;
}

function Select({ label, name, options, required = true, defaultValue }: {
  label: string; name: string; options: { value: string; label: string }[]; required?: boolean; defaultValue?: string;
}) {
  return <label className="live-field"><span>{label}</span><select name={name} required={required} defaultValue={defaultValue ?? ''}><option value="" disabled>Choose…</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

export function LiveApp() {
  useEffect(() => { document.title = 'Maison Debrah ERP | Staff'; }, []);
  const [passwordSetup, setPasswordSetup] = useState(() => new URLSearchParams(window.location.search).get('setup') === '1');
  const [resetMode, setResetMode] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [data, setData] = useState<Data>(emptyData);
  const [tab, setTab] = useState<LiveTab>('overview');
  const [selectedLocationId, setSelectedLocationId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState('Connecting to your staff session…');
  const [startupError, setStartupError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [linkExpired] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('error_code') === 'otp_expired');
  const [orderItems, setOrderItems] = useState([{ product_id: '', quantity: 1 }]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [stockPlanConfirmed, setStockPlanConfirmed] = useState(false);
  const dispatchAttempt = useRef<{ payload: string; key: string } | null>(null);
  const client = supabase;

  const refresh = useCallback(async () => { setData(await readData()); }, []);
  useEffect(() => {
    if (!client) { setLoading(false); return; }
    let active = true;
    const timeout = window.setTimeout(() => {
      if (active) {
        setStartupError('The staff session took too long to load. Check your connection and try again.');
        setLoading(false);
      }
    }, 12000);
    const { data: subscription } = client.auth.onAuthStateChange((event, next) => {
      if (!active || !['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'PASSWORD_RECOVERY'].includes(event)) return;
      window.clearTimeout(timeout);
      setStartupError('');
      setSession(previous => previous?.user.id === next?.user.id ? previous : next);
      if (!next) setLoading(false);
    });
    return () => { active = false; window.clearTimeout(timeout); subscription.subscription.unsubscribe(); };
  }, [client]);
  useEffect(() => {
    if (!client || !session) { setProfile(null); setData(emptyData); return; }
    let active = true;
    setLoading(true);
    setLoadingStage('Loading your staff profile…');
    void (async () => {
      try {
        const { data: staff, error: profileError } = await duringStartup(
          client.from('staff_profiles').select('*').eq('id', session.user.id).maybeSingle(), 'Staff profile');
        if (!active) return;
        if (profileError) throw profileError;
        setProfile(staff);
        if (staff?.is_active) {
          setLoadingStage('Loading shared records…');
          const records = await duringStartup(readData(), 'Shared records');
          if (active) setData(records);
        }
        if (active) setLoading(false);
      } catch (cause) {
        if (active) {
          setStartupError(cause instanceof Error ? cause.message : String(cause));
          setLoading(false);
        }
      }
    })();
    return () => { active = false; };
  }, [client, session, refresh]);

  const names = useMemo(() => ({
    product: new Map(data.products.map(item => [item.id, `${item.sku} · ${item.name}`])),
    location: new Map(data.locations.map(item => [item.id, item.name])),
    customer: new Map(data.customers.map(item => [item.id, item.full_name])),
    order: new Map(data.orders.map(item => [item.id, item.order_number])),
  }), [data]);
  const productOptions = data.products.filter(item => item.is_active).map(item => ({ value: item.id, label: `${item.sku} · ${item.name}` }));
  const locationOptions = data.locations.filter(item => item.is_active).map(item => ({ value: item.id, label: item.name }));
  const showroomOptions = data.locations.filter(item => item.is_active && item.type === 'showroom').map(item => ({ value: item.id, label: item.name }));
  const openOrders = data.orders.filter(order => order.status !== 'cancelled' && order.status !== 'delivered');
  const activeReservations = data.reservations.filter(item => item.status === 'active');
  const expiredReservations = activeReservations.filter(item => new Date(item.expires_at).getTime() <= Date.now());
  const dueReservations = activeReservations.filter(item => item.review_at && new Date(item.review_at).getTime() <= Date.now() + 24 * 60 * 60 * 1000);
  const visibleBalances = data.balances.filter(item => selectedLocationId === 'all' || item.location_id === selectedLocationId);
  const visibleReservations = activeReservations.filter(item => selectedLocationId === 'all' || item.location_id === selectedLocationId);
  const sellableOnHand = visibleBalances.reduce((total, item) => total + item.sellable_on_hand, 0);
  const reservedUnits = visibleBalances.reduce((total, item) => total + item.active_reserved, 0);
  const balanceDue = openOrders.reduce((total, item) => total + (item.balance_due ?? 0), 0);
  const outForDelivery = data.deliveries.filter(item => item.delivery_status === 'out_for_delivery');
  const outOfStock = data.products.filter(product => product.is_active &&
    !data.balances.some(balance => balance.product_id === product.id && balance.sellable_on_hand > balance.active_reserved));
  const stockViewName = selectedLocationId === 'all' ? 'all areas' : names.location.get(selectedLocationId) ?? 'the selected area';
  const tabTitles: Record<LiveTab, string> = {
    overview: 'Ethiopia Operations Overview', products: 'Products & Prices',
    inventory: 'Stock by Area', operations: 'Receipts & Transfers',
    orders: 'Showroom Orders', reservations: 'Reservations (Holds)',
    finance: 'Payments & Balances', deliveries: 'Deliveries & Handover',
  };
  const paymentOrderOptions = openOrders.filter(order => (order.balance_due ?? 0) > 0
    && !['dispatched', 'partially_dispatched'].includes(order.status))
    .map(order => ({ value: order.id, label: `${order.order_number} · ${names.customer.get(order.customer_id) ?? 'Customer'} · ${money(order.balance_due)} due` }));
  const refundOrderOptions = openOrders.filter(order => order.paid_amount > 0
    && !data.refunds.some(refund => refund.order_id === order.id)
    && data.deliveries.filter(delivery => delivery.order_id === order.id)
      .every(delivery => delivery.delivery_status === 'returned_for_review'))
    .map(order => ({ value: order.id, label: `${order.order_number} · ${names.customer.get(order.customer_id) ?? 'Customer'} · ${money(order.paid_amount)} paid` }));
  const lineOptions = data.lines.filter(line => openOrders.some(order => order.id === line.order_id)).map(line => ({ value: line.id, label: `${names.order.get(line.order_id)} · ${names.product.get(line.product_id)} · ${line.quantity} item(s)` }));
  const orderPreview = orderItems.map(item => {
    const product = data.products.find(entry => entry.id === item.product_id);
    const available = data.balances.filter(balance => balance.product_id === item.product_id)
      .reduce((sum, balance) => sum + balance.sellable_on_hand - balance.active_reserved, 0);
    return { ...item, product, available, lineTotal: Number(product?.local_price ?? 0) * item.quantity };
  });
  const previewTotal = orderPreview.reduce((sum, item) => sum + item.lineTotal, 0);
  const needsStockPlan = orderPreview.some(item => item.product && item.quantity > item.available);
  const selectedOrder = data.orders.find(order => order.id === selectedOrderId) ?? null;
  const selectedLines = data.lines.filter(line => line.order_id === selectedOrderId);
  const selectedPayments = data.payments.filter(payment => payment.order_id === selectedOrderId);
  const selectedHolds = data.reservations.filter(hold => hold.order_id === selectedOrderId);
  const selectedDeliveries = data.deliveries.filter(delivery => delivery.order_id === selectedOrderId);
  const role = profile?.role;
  const canSales = role === 'admin' || role === 'manager' || role === 'showroom_sales';
  const canStock = role === 'admin' || role === 'manager' || role === 'stock_clerk';
  const canFinance = role === 'finance';

  async function perform(task: () => PromiseLike<{ error: { message: string } | null }>, success: string, form?: HTMLFormElement): Promise<boolean> {
    if (busy) return false;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await task();
      if (result.error) throw new Error(result.error.message);
      try {
        await refresh();
        form?.reset();
        setMessage(success);
      } catch {
        form?.reset();
        setMessage(`${success} The saved record could not be reloaded. Use Refresh Data before another action.`);
      }
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); return false; }
    finally { setBusy(false); }
  }
  function submit(task: (form: HTMLFormElement) => PromiseLike<{ error: { message: string } | null }>, success: string) {
    return (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      void perform(() => task(form), success, form);
    };
  }
  async function manualRefresh() {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await refresh(); setMessage('Shared records are up to date.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!client) return;
    const form = event.currentTarget;
    setBusy(true); setError('');
    const { error: authError } = await client.auth.signInWithPassword({ email: value(form, 'email'), password: value(form, 'password') });
    if (authError) setError(authError.message);
    else {
      setPasswordSetup(false);
      window.history.replaceState(null, '', window.location.pathname);
    }
    setBusy(false);
  }
  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!client) return;
    const email = value(event.currentTarget, 'email');
    const redirectTo = new URL(window.location.pathname, window.location.origin);
    redirectTo.searchParams.set('setup', '1');
    setBusy(true); setError(''); setMessage('');
    const { error: resetError } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectTo.toString() });
    if (resetError) setError(resetError.message);
    else setMessage('If this is your staff account, a new password setup link is on its way. Open the newest email once.');
    setBusy(false);
  }
  async function finishPasswordSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!client) return;
    const form = event.currentTarget;
    const password = value(form, 'password');
    if (password.length < 12 || password !== value(form, 'confirmation')) {
      setError('Use at least 12 characters and enter the same password twice.');
      return;
    }
    setBusy(true); setError('');
    const { error: updateError } = await client.auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else {
      const url = new URL(window.location.href);
      url.searchParams.delete('setup');
      window.history.replaceState(null, '', url.pathname + url.search);
      form.reset();
      setPasswordSetup(false);
      setMessage('Password set. Your staff account is ready.');
    }
    setBusy(false);
  }

  if (!client) return <div className="live-center">Live backend configuration is missing.</div>;
  if (loading) return <div className="live-center" role="status">{loadingStage}</div>;
  if (startupError) return <main className="live-center"><h1>Unable to load the ERP</h1><p role="alert">{startupError}</p><button type="button" onClick={() => window.location.reload()}>Try again</button></main>;
  if (!session) return <main className="live-auth"><div className="live-auth-card"><p className="live-eyebrow">Maison Debrah</p><h1>{resetMode ? 'Set or reset your password' : 'ERP staff sign in'}</h1><p>{resetMode ? 'Enter your assigned staff email. We will send a new setup link.' : 'Use your assigned staff account. Operational records are shared across the building.'}</p>{linkExpired && !resetMode && <p className="live-error" role="alert">That email link has expired or was already used. Request a new password setup link below.</p>}{resetMode ? <form onSubmit={requestPasswordReset}><Field label="Staff email" name="email" type="email" /><button className="live-primary" disabled={busy}>Send setup link</button></form> : <form onSubmit={signIn}><Field label="Email" name="email" type="email" /><Field label="Password" name="password" type="password" /><button className="live-primary" disabled={busy}>Sign in</button></form>}<button type="button" className="live-text-button" onClick={() => { setResetMode(!resetMode); setError(''); setMessage(''); }}>{resetMode ? 'Back to sign in' : 'Need to set or reset your password?'}</button>{error && <p className="live-error" role="alert">{error}</p>}{message && <p className="live-success" role="status">{message}</p>}</div></main>;
  if (passwordSetup) return <main className="live-auth"><div className="live-auth-card"><p className="live-eyebrow">Maison Debrah</p><h1>Set your ERP password</h1><p>Finish setting up your invited staff account.</p><form onSubmit={finishPasswordSetup}><Field label="New password" name="password" type="password" /><Field label="Confirm password" name="confirmation" type="password" /><button className="live-primary" disabled={busy}>Save password</button></form>{error && <p className="live-error" role="alert">{error}</p>}</div></main>;
  if (!profile?.is_active) return <main className="live-center"><h1>Staff access pending</h1><p>Your account has no active Maison Debrah staff profile. Ask the administrator to assign your role.</p><button onClick={() => void client.auth.signOut()}>Sign out</button></main>;

  return <LiveShell currentTab={tab} onNavigate={next => { setTab(next); setError(''); setMessage(''); }}
    locations={data.locations} selectedLocationId={selectedLocationId} onLocationChange={setSelectedLocationId}
    profile={profile} openOrders={openOrders.length} activeReservations={activeReservations.length}
    onRefresh={() => void manualRefresh()}
    onSignOut={() => void client.auth.signOut()} busy={busy}>
      {error && <p className="live-error" role="alert">{error}</p>}{message && <p className="live-success" role="status">{message}</p>}
      {tab !== 'overview' && <div className="view-header"><div className="view-title-group"><h1>{tabTitles[tab]}</h1><p>Live records for Warehouse and Showrooms 1–3.</p></div></div>}

      {tab === 'overview' && <>
        <div className="view-header"><div className="view-title-group"><h1>Ethiopia Operations Overview</h1>
          <p>Warehouse and Showrooms 1–3 are rooms in one building. Stock totals show {stockViewName}; tasks and orders cover all areas.</p>
        </div><div className="view-actions">
          {canStock && <button className="btn btn-primary" onClick={() => setTab('operations')}><PlusCircle size={15} />Post Stock Movement</button>}
          {canSales && <button className="btn btn-accent" onClick={() => setTab('orders')}><TrendingUp size={15} />New Showroom Order</button>}
        </div></div>
        <section className="card" aria-labelledby="live-attention-title"><div className="card-header"><h2 id="live-attention-title">Needs Attention</h2></div>
          <div className="attention-grid">
            <button onClick={() => setTab('reservations')}><strong>{dueReservations.length}</strong><span>reservations due for review</span><ArrowRight size={16} /></button>
            <button onClick={() => setTab('orders')}><strong>{openOrders.length}</strong><span>orders awaiting handover</span><ArrowRight size={16} /></button>
            <button onClick={() => setTab('inventory')}><strong>{outOfStock.length}</strong><span>products with no available stock</span><ArrowRight size={16} /></button>
            <button onClick={() => setTab('deliveries')}><strong>{outForDelivery.length}</strong><span>items out for delivery</span><ArrowRight size={16} /></button>
          </div></section>
        <div className="metrics-grid">
          <div className="metric-card"><div className="metric-title"><span>Physical Sellable Stock</span><Boxes size={18} /></div><div className="metric-value">{sellableOnHand}</div><div className="metric-sub">{sellableOnHand - reservedUnits} unreserved & immediately sellable</div></div>
          <div className="metric-card"><div className="metric-title"><span>Active Reservations</span><BookmarkCheck size={18} /></div><div className="metric-value">{reservedUnits}</div><div className="metric-sub">{visibleReservations.length} active customer holds in this stock view</div></div>
          <div className="metric-card"><div className="metric-title"><span>Outstanding Balances Due</span><CreditCard size={18} /></div><div className="metric-value live-money-metric">ETB {balanceDue.toLocaleString('en-US')}</div><div className="metric-sub">{openOrders.length} open orders in registry</div></div>
          <div className="metric-card"><div className="metric-title"><span>Out for Delivery</span><Truck size={18} /></div><div className="metric-value">{outForDelivery.length}</div><div className="metric-sub">Awaiting signed handover</div></div>
        </div>
        <section className="card"><div className="card-header"><h2>Stock by Area</h2><button className="btn btn-secondary btn-sm" onClick={() => setTab('inventory')}>Full Inventory Matrix <ArrowRight size={13} /></button></div>
          <div className="table-responsive"><table className="data-table"><thead><tr><th>Area Code</th><th>Area Name</th><th>Type</th><th>Total Units On-Hand</th><th>Reserved Holds</th><th>Net Sellable Available</th></tr></thead>
            <tbody>{data.locations.map(location => { const rows = data.balances.filter(balance => balance.location_id === location.id);
              const onHand = rows.reduce((total, balance) => total + balance.sellable_on_hand, 0);
              const reserved = rows.reduce((total, balance) => total + balance.active_reserved, 0);
              return <tr key={location.id}><td><strong>{location.code}</strong></td><td>{location.name}</td><td>{location.type}</td><td>{onHand}</td><td>{reserved}</td><td>{onHand - reserved}</td></tr>;
            })}</tbody></table></div>
        </section>
        <div className="dashboard-lower-grid">
          <section className="card"><div className="card-header"><h2>Recent Stock Ledger Entries</h2></div>
            {data.movements.length === 0 ? <p className="live-empty">No stock movements recorded yet.</p> : <div className="table-responsive"><table className="data-table"><thead><tr><th>Time</th><th>Action</th><th>Product</th><th>Qty</th><th>Reference</th></tr></thead><tbody>{data.movements.map(movement => <tr key={movement.id}><td>{date(movement.created_at)}</td><td>{movement.movement_type.replaceAll('_', ' ')}</td><td>{names.product.get(movement.product_id)}</td><td>{movement.quantity}</td><td>{movement.reference_no}</td></tr>)}</tbody></table></div>}
          </section>
          <section className="card"><div className="card-header"><h2>Active Customer Holds</h2><button className="btn btn-secondary btn-sm" onClick={() => setTab('reservations')}>Manage <ArrowRight size={13} /></button></div>
            {activeReservations.length === 0 ? <p className="live-empty">No active holds currently.</p> : <div className="live-hold-list">{activeReservations.slice(0, 5).map(hold => <div key={hold.id}><strong>{names.order.get(hold.order_id)}</strong><span>{hold.quantity} unit hold</span><p>{names.product.get(hold.product_id)} · {names.location.get(hold.location_id)}</p></div>)}</div>}
          </section>
        </div>
        {productOptions.length === 0 && <p className="live-note">No products are approved for sale yet. Draft products still need approved prices; no customer order should be entered.</p>}
        {productOptions.length > 0 && data.balances.length === 0 && <p className="live-note">Opening stock has not been posted. Check physical counts before promising an item to a customer.</p>}
      </>}

      {tab === 'products' && <ProductWorkspace products={data.products} balances={data.balances}
        locations={data.locations} canManage={role === 'admin' || role === 'manager'}
        busy={busy} client={client} perform={perform} />}

      {tab === 'inventory' && <>
        <section className="live-card"><h3>Stock by area</h3>{visibleBalances.length === 0 ? <p className="live-empty">No opening stock has been posted in {stockViewName}.</p> : <div className="live-table-wrap"><table><thead><tr><th>Product</th><th>Area</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Quarantine</th></tr></thead><tbody>{visibleBalances.map(item => <tr key={`${item.product_id}-${item.location_id}`}><td>{names.product.get(item.product_id)}</td><td>{names.location.get(item.location_id)}</td><td>{item.sellable_on_hand}</td><td>{item.active_reserved}</td><td>{item.sellable_on_hand - item.active_reserved}</td><td>{item.quarantine_count}</td></tr>)}</tbody></table></div>}</section>
      </>}

      {tab === 'operations' && <>
        <OpeningStockWorkspace products={data.products} locations={data.locations} balances={data.balances}
          canManage={role === 'admin' || role === 'manager'} busy={busy} client={client} perform={perform} />
        {canStock && <div className="live-grid"><section className="live-card"><h3>Receive at Warehouse</h3><form onSubmit={submit(form => client.rpc('erp_post_receipt', { p_product_id: value(form, 'product'), p_quantity: int(form, 'quantity'), p_reference: value(form, 'reference'), p_reason: value(form, 'reason') }), 'Receipt posted.')}><Select label="Product" name="product" options={productOptions} /><Field label="Quantity" name="quantity" type="number" min="1" step="1" /><Field label="Supplier / receipt reference" name="reference" /><Field label="Reason" name="reason" /><button className="live-primary" disabled={busy || !productOptions.length}>Post receipt</button></form></section>
        <section className="live-card"><h3>Transfer between areas</h3><form onSubmit={submit(form => client.rpc('erp_post_transfer', { p_product_id: value(form, 'product'), p_source: value(form, 'source'), p_destination: value(form, 'destination'), p_quantity: int(form, 'quantity'), p_reference: value(form, 'reference'), p_reason: value(form, 'reason') }), 'Transfer posted.')}><Select label="Product" name="product" options={productOptions} /><Select label="From" name="source" options={locationOptions} /><Select label="To" name="destination" options={locationOptions} /><Field label="Quantity" name="quantity" type="number" min="1" step="1" /><Field label="Transfer reference" name="reference" /><Field label="Reason" name="reason" /><button className="live-primary" disabled={busy || !productOptions.length}>Post transfer</button></form></section></div>}
      </>}

      {tab === 'orders' && <>
        {canSales && <section className="live-card"><h3>Create customer order</h3>
          <p className="live-hint">Check the agreed price, exact item, and physical availability before confirming the order.</p>
          <form onSubmit={event => {
            event.preventDefault();
            const form = event.currentTarget;
            const items = orderItems.filter(item => item.product_id && item.quantity > 0);
            if (!items.length || new Set(items.map(item => item.product_id)).size !== items.length) {
              setError('Choose at least one product, with each SKU only once.'); return;
            }
            if (needsStockPlan && (!stockPlanConfirmed || !value(form, 'notes'))) {
              setError('Record the agreed stock or arrival plan in Notes and confirm it with the customer.'); return;
            }
            let createdId: string | null = null;
            void perform(async () => {
              const result = await client.rpc('erp_create_order', {
                p_customer_name: value(form, 'customer'), p_customer_phone: value(form, 'phone'),
                p_showroom_id: value(form, 'showroom'), p_items: items,
                p_notes: value(form, 'notes') || undefined,
              });
              createdId = result.data;
              return result;
            }, 'Order created.', form).then(succeeded => {
              if (succeeded) {
                setOrderItems([{ product_id: '', quantity: 1 }]);
                setStockPlanConfirmed(false);
                setSelectedOrderId(createdId);
              }
            });
          }}>
            <div className="live-grid"><Field label="Customer name" name="customer" /><Field label="Customer phone" name="phone" /><Select label="Showroom" name="showroom" options={showroomOptions} /><Field label="Fulfilment notes" name="notes" required={false} /></div>
            <div className="live-items"><strong>Items</strong>{orderItems.map((item, index) => <div className="live-item-row" key={index}><label className="live-field"><span>Product</span><select required value={item.product_id} onChange={event => { setStockPlanConfirmed(false); setOrderItems(current => current.map((entry, position) => position === index ? { ...entry, product_id: event.target.value } : entry)); }}><option value="">Choose…</option>{productOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="live-field"><span>Quantity</span><input type="number" min="1" step="1" required value={item.quantity} onChange={event => { setStockPlanConfirmed(false); setOrderItems(current => current.map((entry, position) => position === index ? { ...entry, quantity: Number(event.target.value) } : entry)); }} /></label><button type="button" onClick={() => setOrderItems(current => current.filter((_, position) => position !== index))} disabled={orderItems.length === 1}>Remove</button></div>)}</div>
            <div className="live-order-preview"><strong>Review before creating</strong>
              {orderPreview.filter(item => item.product).map(item => <p key={item.product_id}>{item.product?.sku} · {item.quantity} × {money(item.product?.local_price)} = {money(item.lineTotal)} · {item.available} available in building</p>)}
              <strong>Order total: {money(previewTotal)}</strong>
              {needsStockPlan && <label className="live-stock-plan"><input type="checkbox" checked={stockPlanConfirmed} onChange={event => setStockPlanConfirmed(event.target.checked)} /> I discussed the unavailable quantity and recorded the agreed plan in Notes.</label>}
            </div>
            <div className="live-actions"><button type="button" onClick={() => setOrderItems(current => [...current, { product_id: '', quantity: 1 }])}>Add item</button><button className="live-primary" disabled={busy || !productOptions.length || (needsStockPlan && !stockPlanConfirmed)}>Confirm order</button></div>
          </form>
        </section>}
        <section className="live-card"><h3>Orders</h3>{data.orders.length === 0 ? <p className="live-empty">No real orders yet.</p> : <div className="live-table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th><th>Paid</th><th>Balance</th><th>Created</th><th></th></tr></thead><tbody>{data.orders.map(item => <tr key={item.id}><td>{item.order_number}</td><td>{names.customer.get(item.customer_id)}</td><td>{item.status.replaceAll('_', ' ')}</td><td>{money(item.total_amount)}</td><td>{money(item.paid_amount)}</td><td>{money(item.balance_due)}</td><td>{date(item.created_at)}</td><td><button type="button" onClick={() => setSelectedOrderId(item.id)}>View</button></td></tr>)}</tbody></table></div>}</section>
        {selectedOrder && <section className="live-card" aria-labelledby="selected-order-title">
          <h3 id="selected-order-title">{selectedOrder.order_number} · {names.customer.get(selectedOrder.customer_id)}</h3>
          <div className="live-order-detail">
            <div className="live-summary-strip"><span><strong>{selectedOrder.status.replaceAll('_', ' ')}</strong> order stage</span><span><strong>{money(selectedOrder.paid_amount)}</strong> paid</span><span><strong>{money(selectedOrder.balance_due)}</strong> balance</span></div>
            <p><strong>Customer:</strong> {names.customer.get(selectedOrder.customer_id)} · {data.customers.find(item => item.id === selectedOrder.customer_id)?.phone}</p>
            <p><strong>Agreed plan:</strong> {selectedOrder.notes || 'No fulfilment note recorded.'}</p>
            <h4>Items and stock</h4>
            {selectedLines.map(line => <p key={line.id}>{names.product.get(line.product_id)} · {line.quantity} × {money(line.unit_price)} = {money(line.line_total)} · {data.balances.filter(balance => balance.product_id === line.product_id).reduce((sum, balance) => sum + balance.sellable_on_hand - balance.active_reserved, 0)} available now</p>)}
            <h4>Finance</h4>
            {selectedPayments.length ? selectedPayments.map(payment => <p key={payment.id}>{money(payment.amount)} · {payment.payment_method.replaceAll('_', ' ')} · {payment.reference_no} · {['finance', 'admin', 'manager'].includes(role ?? '') ? (data.evidence.some(item => item.payment_id === payment.id) ? 'Proof attached' : 'No proof attached') : 'Proof managed by Finance'}</p>) : <p>No payment recorded yet. Finance records and verifies every payment.</p>}
            <h4>Reservation and handover</h4>
            {selectedHolds.length ? selectedHolds.map(hold => <p key={hold.id}>{names.product.get(hold.product_id)} · {hold.status} · {names.location.get(hold.location_id)} · decision date {date(hold.expires_at)}</p>) : <p>No stock reservation recorded.</p>}
            {selectedDeliveries.length ? selectedDeliveries.map(delivery => <p key={delivery.id}>{names.product.get(delivery.product_id ?? '')} · {delivery.delivery_status.replaceAll('_', ' ')} · {delivery.signed_reference ? `Signed reference ${delivery.signed_reference}` : 'Awaiting signed handover'}</p>) : <p>No item dispatched.</p>}
            <div className="live-actions"><button type="button" onClick={() => setTab('finance')}>Finance</button><button type="button" onClick={() => setTab('reservations')}>Reservations</button><button type="button" onClick={() => setTab('deliveries')}>Delivery</button></div>
          </div>
        </section>}
      </>}

      {tab === 'reservations' && <>
        {canSales && <div className="live-grid"><section className="live-card"><h3>Reserve after Finance records a deposit</h3><p className="live-hint">The agreed starting point is a review around day 3 and a decision by day 5. Confirm the dates with the customer.</p><form onSubmit={submit(form => client.rpc('erp_create_reservation', { p_line_id: value(form, 'line'), p_location_id: value(form, 'location'), p_quantity: int(form, 'quantity'), p_review_at: dateTime(form, 'review'), p_expires_at: dateTime(form, 'collection') }), 'Deposit reservation created.')}><Select label="Order item" name="line" options={lineOptions} /><Select label="Stock area" name="location" options={locationOptions} /><Field label="Quantity" name="quantity" type="number" min="1" step="1" /><Field label="Review with customer" name="review" type="datetime-local" defaultValue={localDateTimeInDays(3)} /><Field label="Agreed decision date" name="collection" type="datetime-local" defaultValue={localDateTimeInDays(5)} /><button className="live-primary" disabled={busy || !lineOptions.length}>Reserve stock</button></form></section><section className="live-card"><h3>Extend by agreement</h3><form onSubmit={submit(form => client.rpc('erp_extend_reservation', { p_reservation_id: value(form, 'reservation'), p_review_at: dateTime(form, 'review'), p_expires_at: dateTime(form, 'collection'), p_reason: value(form, 'reason') }), 'Reservation extension recorded.')}><Select label="Active reservation" name="reservation" options={activeReservations.map(item => ({ value: item.id, label: `${names.order.get(item.order_id)} · ${names.product.get(item.product_id)}` }))} /><Field label="New review date" name="review" type="datetime-local" /><Field label="New agreed date" name="collection" type="datetime-local" /><Field label="Reason agreed with customer" name="reason" /><button className="live-primary" disabled={busy || !activeReservations.length}>Extend reservation</button></form></section></div>}
        {canSales && <section className="live-card"><h3>Expired holds awaiting a decision</h3><p className="live-hint">Discuss an extension with the customer first. Releasing an expired hold frees stock; Finance records any refund separately.</p>{expiredReservations.length === 0 ? <p className="live-empty">No expired active holds.</p> : <form onSubmit={submit(form => client.rpc('erp_release_expired_reservation', { p_reservation_id: value(form, 'reservation'), p_reason: value(form, 'reason') }), 'Expired hold released. Finance still needs to resolve any customer deposit.')}><Select label="Expired reservation" name="reservation" options={expiredReservations.map(item => ({ value: item.id, label: `${names.order.get(item.order_id)} · ${names.product.get(item.product_id)} · ${date(item.expires_at)}` }))} /><Field label="Customer discussion / release reason" name="reason" /><button disabled={busy}>Release expired hold</button></form>}</section>}
        <section className="live-card"><h3>Reservation register</h3>{data.reservations.length === 0 ? <p className="live-empty">No reservations yet.</p> : <div className="live-table-wrap"><table><thead><tr><th>Order</th><th>Product</th><th>Area</th><th>Quantity</th><th>Status</th><th>Review</th><th>Agreed date</th></tr></thead><tbody>{data.reservations.map(item => <tr key={item.id}><td>{names.order.get(item.order_id)}</td><td>{names.product.get(item.product_id)}</td><td>{names.location.get(item.location_id)}</td><td>{item.quantity}</td><td>{item.status}</td><td>{date(item.review_at)}</td><td>{date(item.expires_at)}</td></tr>)}</tbody></table></div>}</section>
      </>}

      {tab === 'deliveries' && <>
        {canStock && <div className="live-grid">
          <section className="live-card"><h3>Dispatch fully paid items</h3>
            <p className="live-hint">The database checks full payment and unreserved stock before deducting any item.</p>
            <form onSubmit={event => {
              event.preventDefault();
              const form = event.currentTarget;
              const payload = JSON.stringify({ line: value(form, 'line'), quantity: int(form, 'quantity'),
                location: value(form, 'location'), address: value(form, 'address'),
                recipient: value(form, 'recipient'), phone: value(form, 'phone') });
              if (!dispatchAttempt.current || dispatchAttempt.current.payload !== payload) {
                dispatchAttempt.current = { payload, key: crypto.randomUUID() };
              }
              const key = dispatchAttempt.current.key;
              void perform(() => client.rpc('erp_dispatch_line', {
                p_line_id: value(form, 'line'), p_quantity: int(form, 'quantity'),
                p_location_id: value(form, 'location'), p_address: value(form, 'address'),
                p_recipient: value(form, 'recipient'), p_phone: value(form, 'phone'), p_request_key: key,
              }), 'Items dispatched. Await signed handover.', form).then(ok => {
                if (ok) dispatchAttempt.current = null;
              });
            }}>
              <Select label="Order item" name="line" options={lineOptions} />
              <Field label="Quantity" name="quantity" type="number" min="1" step="1" />
              <Select label="Stock area" name="location" options={locationOptions} />
              <Field label="Delivery address" name="address" />
              <Field label="Intended recipient" name="recipient" />
              <Field label="Recipient phone" name="phone" />
              <button className="live-primary" disabled={busy || !lineOptions.length}>Dispatch item</button>
            </form>
          </section>
          <section className="live-card"><h3>Confirm signed handover</h3>
            <form onSubmit={submit(form => client.rpc('erp_confirm_delivery', { p_delivery_id: value(form, 'delivery'), p_signed_by: value(form, 'signedBy'), p_signed_reference: value(form, 'signedReference') }), 'Signed handover recorded.')}><Select label="Open dispatch" name="delivery" options={data.deliveries.filter(item => item.delivery_status === 'out_for_delivery').map(item => ({ value: item.id, label: `${names.order.get(item.order_id)} · ${names.product.get(item.product_id ?? '')} · ${item.quantity}` }))} /><Field label="Person who signed" name="signedBy" /><Field label="Signed document reference" name="signedReference" /><button className="live-primary" disabled={busy}>Confirm handover</button></form>
            <h4>Delivery exception</h4>
            <form onSubmit={submit(form => client.rpc('erp_fail_delivery', { p_delivery_id: value(form, 'delivery'), p_reason: value(form, 'reason') }), 'Delivery marked failed. Stock remains outside sellable stock until returned.')}><Select label="Open dispatch" name="delivery" options={data.deliveries.filter(item => item.delivery_status === 'out_for_delivery').map(item => ({ value: item.id, label: `${names.order.get(item.order_id)} · ${item.recipient_name}` }))} /><Field label="Failure reason" name="reason" /><button disabled={busy}>Record failed delivery</button></form>
          </section>
        </div>}
        <section className="live-card"><h3>Delivery register</h3>{data.deliveries.length === 0 ? <p className="live-empty">No dispatches yet.</p> : <div className="live-table-wrap"><table><thead><tr><th>Order</th><th>Product</th><th>Quantity</th><th>Recipient</th><th>Status</th><th>Dispatched</th><th>Signature reference</th><th>Action</th></tr></thead><tbody>{data.deliveries.map(item => <tr key={item.id}><td>{names.order.get(item.order_id)}</td><td>{names.product.get(item.product_id ?? '')}</td><td>{item.quantity}</td><td>{item.recipient_name}</td><td>{item.delivery_status.replaceAll('_', ' ')}</td><td>{date(item.dispatch_date)}</td><td>{item.signed_reference ?? '—'}</td><td>{canStock && item.delivery_status === 'failed' && <button disabled={busy} onClick={() => void perform(() => client.rpc('erp_receive_failed_delivery', { p_delivery_id: item.id }), 'Returned item moved into quarantine.')}>Receive to quarantine</button>}</td></tr>)}</tbody></table></div>}</section>
        <EvidenceAttachment kind="handover" choices={data.deliveries.filter(item => item.delivery_status === 'delivered').map(item => ({ id: item.id, label: `${names.order.get(item.order_id)} · ${item.signed_reference ?? item.recipient_name}` }))}
          evidence={data.evidence} canUpload={canStock} busy={busy} client={client} userId={session.user.id} perform={perform} />
      </>}

      {tab === 'finance' && <>
        {canFinance && <div className="live-grid">
          <section className="live-card"><h3>Record Finance-confirmed payment</h3>
            <p className="live-hint">Verify the money received before recording this transaction. Attach the payment proof below when available.</p>
            <form onSubmit={submit(form => client.rpc('erp_record_payment', {
              p_order_id: value(form, 'order'), p_amount: int(form, 'amount'),
              p_method: value(form, 'method') as Enums<'payment_method'>,
              p_reference: value(form, 'reference'),
            }), 'Payment recorded by Finance.')}>
              <Select label="Order with balance due" name="order" options={paymentOrderOptions}
                defaultValue={paymentOrderOptions.some(option => option.value === selectedOrderId) ? selectedOrderId ?? '' : ''} />
              <Field label="Amount in ETB" name="amount" type="number" min="0.01" step="0.01" />
              <Select label="Payment method" name="method" options={(['cash', 'telebirr', 'cbe_birr', 'bank_transfer', 'card'] as const).map(item => ({ value: item, label: item.replaceAll('_', ' ') }))} />
              <Field label="Verified payment reference" name="reference" />
              <button className="live-primary" disabled={busy || !paymentOrderOptions.length}>Record payment</button>
            </form>
          </section>
          <section className="live-card"><h3>Full refund and cancellation</h3>
            <p className="live-hint">Finance records this after confirming the refund was sent. If goods left the building, every item must first return to quarantine without a signed handover.</p>
            <form onSubmit={submit(form => client.rpc('erp_refund_cancel_order', {
              p_order_id: value(form, 'order'), p_reason: value(form, 'reason'),
              p_reference: value(form, 'reference'),
            }), 'Refund and cancellation recorded.')}>
              <Select label="Eligible order" name="order" options={refundOrderOptions}
                defaultValue={refundOrderOptions.some(option => option.value === selectedOrderId) ? selectedOrderId ?? '' : ''} />
              <Field label="Reason agreed with customer" name="reason" />
              <Field label="Refund transaction reference" name="reference" />
              <button disabled={busy || !refundOrderOptions.length}>Record full refund and cancel</button>
            </form>
          </section>
        </div>}
        <section className="live-card"><h3>Payment ledger</h3>{data.payments.length === 0 ? <p className="live-empty">No payments recorded.</p> : <div className="live-table-wrap"><table><thead><tr><th>Order</th><th>Amount</th><th>Method</th><th>Reference</th><th>Recorded</th></tr></thead><tbody>{data.payments.map(item => <tr key={item.id}><td>{names.order.get(item.order_id)}</td><td>{money(item.amount)}</td><td>{item.payment_method.replaceAll('_', ' ')}</td><td>{item.reference_no}</td><td>{date(item.created_at)}</td></tr>)}</tbody></table></div>}</section>
        {['finance', 'admin', 'manager'].includes(role ?? '') && <EvidenceAttachment kind="payment" choices={data.payments.map(item => ({ id: item.id, label: `${names.order.get(item.order_id)} · ${item.reference_no} · ${money(item.amount)}` }))}
          evidence={data.evidence} canUpload={canFinance} busy={busy} client={client} userId={session.user.id} perform={perform} />}
        <section className="live-card"><h3>Refund ledger</h3>{data.refunds.length === 0 ? <p className="live-empty">No refunds recorded.</p> : <div className="live-table-wrap"><table><thead><tr><th>Order</th><th>Amount</th><th>Reference</th><th>Reason</th><th>Recorded</th></tr></thead><tbody>{data.refunds.map(item => <tr key={item.id}><td>{names.order.get(item.order_id)}</td><td>{money(item.amount)}</td><td>{item.reference_no ?? '—'}</td><td>{item.reason}</td><td>{date(item.created_at)}</td></tr>)}</tbody></table></div>}</section>
      </>}
  </LiveShell>;
}
