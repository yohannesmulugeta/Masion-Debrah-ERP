import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeftRight, BookmarkCheck, Boxes, Building2, CreditCard,
  LayoutDashboard, Menu, PackageCheck, RefreshCw, ShieldCheck,
  ShoppingCart, Truck,
} from 'lucide-react';
import type { Tables } from '../types/database.generated';

export type LiveTab = 'overview' | 'products' | 'inventory' | 'operations' |
  'orders' | 'reservations' | 'finance' | 'deliveries';

type Location = Tables<'locations'>;
type Profile = Tables<'staff_profiles'>;

type LiveShellProps = {
  children: ReactNode;
  currentTab: LiveTab;
  onNavigate: (tab: LiveTab) => void;
  locations: Location[];
  selectedLocationId: string;
  onLocationChange: (id: string) => void;
  profile: Profile;
  openOrders: number;
  activeReservations: number;
  onRefresh: () => void;
  onSignOut: () => void;
  busy: boolean;
};

const navGroups: { title: string; items: { tab: LiveTab; label: string; icon: typeof LayoutDashboard; count?: 'orders' | 'reservations' }[] }[] = [
  { title: 'Overview', items: [{ tab: 'overview', label: 'Dashboard', icon: LayoutDashboard }] },
  { title: 'Catalogue & Stock', items: [
    { tab: 'products', label: 'Products & Prices', icon: PackageCheck },
    { tab: 'inventory', label: 'Stock by Area', icon: Boxes },
    { tab: 'operations', label: 'Receipts & Transfers', icon: ArrowLeftRight },
  ] },
  { title: 'Sales & Fulfillment', items: [
    { tab: 'orders', label: 'Showroom Orders', icon: ShoppingCart, count: 'orders' },
    { tab: 'reservations', label: 'Reservations (Holds)', icon: BookmarkCheck, count: 'reservations' },
    { tab: 'finance', label: 'Payments & Balances', icon: CreditCard },
    { tab: 'deliveries', label: 'Deliveries & Handover', icon: Truck },
  ] },
];

export function LiveShell({
  children, currentTab, onNavigate, locations, selectedLocationId, onLocationChange,
  profile, openOrders, activeReservations, onRefresh, onSignOut, busy,
}: LiveShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); return; }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(sidebarRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      document.querySelector<HTMLButtonElement>('.menu-toggle')?.focus();
    };
  }, [menuOpen]);

  function navigate(tab: LiveTab) {
    onNavigate(tab);
    setMenuOpen(false);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
  }

  const initials = profile.full_name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  return <div className="app-container live-app">
    <a className="skip-link" href="#live-main">Skip to main content</a>
    {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <aside id="main-navigation" ref={sidebarRef} className={`app-sidebar ${menuOpen ? 'is-open' : ''}`}
      aria-label="Main navigation" role={menuOpen ? 'dialog' : undefined} aria-modal={menuOpen || undefined}>
      <div className="sidebar-brand">
        <button className="sidebar-close" ref={closeRef} onClick={() => setMenuOpen(false)} aria-label="Close navigation">×</button>
        <div className="brand-eyebrow">Ethiopia Operations</div>
        <img className="brand-logo" src={`${import.meta.env.BASE_URL}brand/maison-debrah-logo-light.svg`} alt="Maison Debrah" />
        <div className="brand-sub">Private ERP & Inventory</div>
      </div>
      <nav className="sidebar-nav">
        {navGroups.map(group => <div className="live-nav-group" key={group.title}>
          <div className="nav-section-title">{group.title}</div>
          {group.items.map(item => {
            const Icon = item.icon;
            const count = item.count === 'orders' ? openOrders : item.count === 'reservations' ? activeReservations : 0;
            return <button key={item.tab} className={`nav-item ${currentTab === item.tab ? 'active' : ''}`}
              aria-current={currentTab === item.tab ? 'page' : undefined} onClick={() => navigate(item.tab)}>
              <Icon aria-hidden="true" /><span>{item.label}</span>
              {count > 0 && <span className="nav-badge" aria-label={`${count} active`}>{count}</span>}
            </button>;
          })}
        </div>)}
      </nav>
      <div className="sidebar-footer"><div>Maison Debrah ERP v1.0</div><div className="live-sidebar-status">Live shared database</div></div>
    </aside>
    <div className="app-main">
      <header className="app-header">
        <div className="header-left">
          <button className="menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open navigation"
            aria-controls="main-navigation" aria-expanded={menuOpen}><Menu size={22} aria-hidden="true" /></button>
          <div className="header-loc-selector" title="Area used for stock totals and inventory">
            <Building2 size={16} color="var(--color-accent-text)" aria-hidden="true" />
            <label htmlFor="live-header-area">Stock view</label>
            <select id="live-header-area" value={selectedLocationId} onChange={event => onLocationChange(event.target.value)}>
              <option value="all">All Areas</option>
              {locations.map(location => <option key={location.id} value={location.id}>{location.code} — {location.name}</option>)}
            </select>
          </div>
        </div>
        <div className="header-right">
          <button className="btn btn-secondary btn-sm live-refresh" onClick={onRefresh} disabled={busy}>
            <RefreshCw size={13} aria-hidden="true" /><span>Refresh Data</span>
          </button>
          <span className="role-badge live-role-badge"><ShieldCheck size={14} aria-hidden="true" />{profile.role.replaceAll('_', ' ')}</span>
          <div className="header-profile live-profile"><div className="staff-avatar">{initials}</div><div>
            <strong>{profile.full_name}</strong><span>{profile.email}</span>
          </div></div>
          <button className="btn btn-secondary btn-sm live-signout" onClick={onSignOut}>Sign out</button>
        </div>
      </header>
      <div className="live-status-banner">Live staff workspace · Shared Maison Debrah records</div>
      <main id="live-main" className="app-content live-main" tabIndex={-1} ref={mainRef}>{children}</main>
    </div>
  </div>;
}
