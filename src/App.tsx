import React, { useEffect, useRef, useState } from 'react';
import { ErpProvider } from './context/ErpContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './views/DashboardView';
import { CatalogueView } from './views/CatalogueView';
import { InventoryView } from './views/InventoryView';
import { StockOperationsView } from './views/StockOperationsView';
import { OrdersView } from './views/OrdersView';
import { ReservationsView } from './views/ReservationsView';
import { PaymentsView } from './views/PaymentsView';
import { ExceptionsView } from './views/ExceptionsView';
import { AuditView } from './views/AuditView';
import { WebsiteFeedInspectorView } from './views/WebsiteFeedInspectorView';
import './styles.css';

const validViews = new Set(['dashboard', 'catalogue', 'inventory', 'operations', 'orders', 'reservations', 'payments', 'exceptions', 'audit', 'website_feed']);

function viewFromHash(): string {
  const view = window.location.hash.slice(1);
  return validViews.has(view) ? view : 'dashboard';
}

export const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<string>(viewFromHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const previousView = useRef(currentView);

  useEffect(() => {
    const syncView = () => {
      setCurrentView(viewFromHash());
      setMenuOpen(false);
    };
    window.addEventListener('hashchange', syncView);
    return () => window.removeEventListener('hashchange', syncView);
  }, []);

  useEffect(() => {
    if (previousView.current === currentView) return;
    previousView.current = currentView;
    const frame = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      mainRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [currentView]);

  const navigate = (view: string) => {
    if (!validViews.has(view)) return;
    setCurrentView(view);
    setMenuOpen(false);
    window.location.hash = view;
  };

  return (
    <div className="app-container">
      <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); window.scrollTo(0, 0); mainRef.current?.focus({ preventScroll: true }); }}>Skip to main content</a>
      {menuOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
      <Sidebar currentView={currentView} onNavigate={navigate} isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="app-main">
        <Header onMenuClick={() => setMenuOpen(true)} menuOpen={menuOpen} />
        <div className="demo-banner" role="status">
          Public demo · Sample products, prices, stock and customers · Changes stay in this browser · No live database or website connection
        </div>
        <main className="app-content" id="main-content" ref={mainRef} tabIndex={-1}>
          {currentView === 'dashboard' && <DashboardView onNavigate={navigate} />}
          {currentView === 'catalogue' && <CatalogueView />}
          {currentView === 'inventory' && <InventoryView />}
          {currentView === 'operations' && <StockOperationsView />}
          {currentView === 'orders' && <OrdersView />}
          {currentView === 'reservations' && <ReservationsView />}
          {currentView === 'payments' && <PaymentsView />}
          {currentView === 'exceptions' && <ExceptionsView />}
          {currentView === 'audit' && <AuditView />}
          {currentView === 'website_feed' && <WebsiteFeedInspectorView />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ErpProvider>
      <AppContent />
    </ErpProvider>
  );
}
