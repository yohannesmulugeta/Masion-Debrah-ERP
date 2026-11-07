import React, { useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  PackageCheck,
  Boxes,
  ArrowLeftRight,
  ShoppingCart,
  BookmarkCheck,
  CreditCard,
  AlertTriangle,
  FileText,
  Globe,
} from 'lucide-react';
import { useErp } from '../context/ErpContext';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isOpen, onClose }) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      }
      if (event.key !== 'Tab') return;
      const buttons = Array.from(sidebarRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || []);
      if (buttons.length === 0) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || !sidebarRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !sidebarRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      document.querySelector<HTMLButtonElement>('.menu-toggle')?.focus();
    };
  }, [isOpen]);
  const { orders, reservations, exceptions } = useErp();

  const activeReservationsCount = reservations.filter((r) => r.status === 'active').length;
  const pendingOrdersCount = orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled').length;
  const activeExceptionsCount = exceptions.length;

  return (
    <aside id="main-navigation" ref={sidebarRef} className={`app-sidebar ${isOpen ? 'is-open' : ''}`} aria-label="Main navigation" role={isOpen ? 'dialog' : undefined} aria-modal={isOpen ? true : undefined}>
      <div className="sidebar-brand">
        <button className="sidebar-close" ref={closeButtonRef} onClick={onClose} aria-label="Close navigation">×</button>
        <div className="brand-eyebrow">Ethiopia Operations</div>
        <img
          className="brand-logo"
          src={`${import.meta.env.BASE_URL}brand/maison-debrah-logo-light.svg`}
          alt="Maison Debrah"
        />
        <div className="brand-sub">Private ERP & Inventory</div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Overview</div>
        <button
          className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
          aria-current={currentView === 'dashboard' ? 'page' : undefined}
          onClick={() => onNavigate('dashboard')}
        >
          <LayoutDashboard />
          <span>Dashboard</span>
        </button>

        <div className="nav-section-title">Catalogue & Stock</div>
        <button
          className={`nav-item ${currentView === 'catalogue' ? 'active' : ''}`}
          aria-current={currentView === 'catalogue' ? 'page' : undefined}
          onClick={() => onNavigate('catalogue')}
        >
          <PackageCheck />
          <span>HQ Catalogue & Import</span>
        </button>

        <button
          className={`nav-item ${currentView === 'inventory' ? 'active' : ''}`}
          aria-current={currentView === 'inventory' ? 'page' : undefined}
          onClick={() => onNavigate('inventory')}
        >
          <Boxes />
          <span>Stock by Area</span>
        </button>

        <button
          className={`nav-item ${currentView === 'operations' ? 'active' : ''}`}
          aria-current={currentView === 'operations' ? 'page' : undefined}
          onClick={() => onNavigate('operations')}
        >
          <ArrowLeftRight />
          <span>Receipts & Transfers</span>
        </button>

        <div className="nav-section-title">Sales & Fulfillment</div>
        <button
          className={`nav-item ${currentView === 'orders' ? 'active' : ''}`}
          aria-current={currentView === 'orders' ? 'page' : undefined}
          aria-label={`Showroom Orders, ${pendingOrdersCount} pending`}
          onClick={() => onNavigate('orders')}
        >
          <ShoppingCart />
          <span>Showroom Orders</span>
          {pendingOrdersCount > 0 && <span className="nav-badge" aria-hidden="true">{pendingOrdersCount}</span>}
        </button>

        <button
          className={`nav-item ${currentView === 'reservations' ? 'active' : ''}`}
          aria-current={currentView === 'reservations' ? 'page' : undefined}
          aria-label={`Reservations, ${activeReservationsCount} active holds`}
          onClick={() => onNavigate('reservations')}
        >
          <BookmarkCheck />
          <span>Reservations (Holds)</span>
          {activeReservationsCount > 0 && (
            <span className="nav-badge nav-badge-accent" aria-hidden="true">
              {activeReservationsCount}
            </span>
          )}
        </button>

        <button
          className={`nav-item ${currentView === 'payments' ? 'active' : ''}`}
          aria-current={currentView === 'payments' ? 'page' : undefined}
          onClick={() => onNavigate('payments')}
        >
          <CreditCard />
          <span>Payments & Balances</span>
        </button>

        <div className="nav-section-title">Compliance & Traceability</div>
        <button
          className={`nav-item ${currentView === 'exceptions' ? 'active' : ''}`}
          aria-current={currentView === 'exceptions' ? 'page' : undefined}
          aria-label={`Returns and Damage, ${activeExceptionsCount} cases`}
          onClick={() => onNavigate('exceptions')}
        >
          <AlertTriangle />
          <span>Returns & Damage</span>
          {activeExceptionsCount > 0 && (
            <span className="nav-badge" aria-hidden="true" style={{ backgroundColor: 'var(--color-danger-text)' }}>
              {activeExceptionsCount}
            </span>
          )}
        </button>

        <button
          className={`nav-item ${currentView === 'audit' ? 'active' : ''}`}
          aria-current={currentView === 'audit' ? 'page' : undefined}
          onClick={() => onNavigate('audit')}
        >
          <FileText />
          <span>Audit & Ledger</span>
        </button>

        <div className="nav-section-title">Integration Target</div>
        <button
          className={`nav-item ${currentView === 'website_feed' ? 'active' : ''}`}
          aria-current={currentView === 'website_feed' ? 'page' : undefined}
          onClick={() => onNavigate('website_feed')}
        >
          <Globe color="var(--color-accent)" />
          <span>Website Feed Inspector</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div>Maison Debrah ERP v1.0</div>
        <div style={{ color: 'var(--color-accent)', marginTop: '2px' }}>Browser-local prototype</div>
      </div>
    </aside>
  );
};
