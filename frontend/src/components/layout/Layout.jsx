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
        style={{ left: collapsed ? '0.75rem' : '200px' }}
      >
        {collapsed ? <PanelLeftOpen size={22} /> : <PanelLeftClose size={22} />}
      </button>

      <div className="main-content">
        <Header onMenuClick={() => setSidebarOpen((v) => !v)} />
        <main className="page-body">{children}</main>
      </div>
    </div>
  );
};
