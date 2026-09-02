import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

  return (
    <div className="app-container">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={collapsed} />
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <button
        className="sidebar-collapse-toggle"
        onClick={toggleCollapsed}
        title={collapsed ? 'Afficher le menu' : 'Masquer le menu'}
        aria-label={collapsed ? 'Afficher le menu' : 'Masquer le menu'}
        style={{ left: collapsed ? '0.5rem' : '234px' }}
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>

      <div className="main-content">
        <Header onMenuClick={() => setSidebarOpen((v) => !v)} />
        <main className="page-body">{children}</main>
      </div>
    </div>
  );
};
