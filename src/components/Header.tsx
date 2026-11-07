import React from 'react';
import { useErp } from '../context/ErpContext';
import { StaffRole } from '../types';
import { Building2, ShieldCheck, RefreshCw, Layers, Menu } from 'lucide-react';

export const Header: React.FC<{ onMenuClick: () => void; menuOpen: boolean }> = ({ onMenuClick, menuOpen }) => {
  const {
    currentStaff,
    setCurrentStaffRole,
    locations,
    selectedLocationId,
    setSelectedLocationId,
    resetToBaseline,
  } = useErp();

  return (
    <header className="app-header">
      <div className="header-left">
        <button className="menu-toggle" onClick={onMenuClick} aria-label="Open navigation" aria-controls="main-navigation" aria-expanded={menuOpen}><Menu size={22} aria-hidden="true" /></button>
        {/* Location Filter */}
        <div className="header-loc-selector" title="Area used for stock totals and inventory">
          <Building2 size={16} color="var(--color-accent-text)" aria-hidden="true" />
          <label htmlFor="header-area">Stock view</label>
          <select
            id="header-area"
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
          >
            <option value="all">All Areas</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.code} — {loc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Area summary */}
        <div
          className="header-area-summary"
          style={{
            fontSize: '0.74rem',
            color: 'var(--color-primary)',
            background: 'var(--color-bg-subtle)',
            padding: '5px 10px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px solid var(--color-border)',
          }}
        >
          <Layers size={14} color="var(--color-accent-text)" />
          <span>One building · 4 areas</span>
        </div>
      </div>

      <div className="header-right">
        {/* Reset Demo Data Button */}
        <button
          onClick={() => {
            if (confirm('Reset state to clean baseline sample data?')) {
              resetToBaseline();
            }
          }}
          className="btn btn-secondary btn-sm"
          title="Restore baseline inventory & orders"
        >
          <RefreshCw size={13} />
          <span>Reset Baseline</span>
        </button>

        {/* Demo role switcher */}
        <div className="header-role-switcher" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={16} color="var(--color-accent-text)" aria-hidden="true" />
          <label htmlFor="header-demo-role" className="header-role-label">Demo role</label>
          <select
            id="header-demo-role"
            className="role-switcher-dropdown"
            value={currentStaff.role}
            onChange={(e) => setCurrentStaffRole(e.target.value as StaffRole)}
            title="Switch staff role to test UI authorization"
          >
            <option value="admin">Administrator</option>
            <option value="manager">Manager</option>
            <option value="stock_clerk">Stock Clerk</option>
            <option value="showroom_sales">Sales</option>
            <option value="finance">Finance</option>
          </select>
        </div>

        {/* Active Staff Profile */}
        <div className="header-profile" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="staff-avatar">
            {currentStaff.fullName.split(' ').map((n) => n[0]).join('')}
          </div>
          <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{currentStaff.fullName}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)' }}>
              {currentStaff.email}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
