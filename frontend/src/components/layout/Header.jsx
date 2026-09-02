import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, PlusCircle, Wifi, Menu, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSalesTabs } from '../../context/SalesTabsContext';
import { useTheme } from '../../context/ThemeContext';

export const Header = ({ onMenuClick = () => {} }) => {
  const { user } = useAuth();
  const { addTab } = useSalesTabs();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleNewSale = () => {
    addTab('bon_livraison');
    if (location.pathname !== '/sales') {
      navigate('/sales');
    }
  };

  return (
    <header className="header-container" style={{ height: '60px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', flexShrink: 0, gap: '0.75rem' }}>
      {/* Mobile menu toggle + Network / LAN Server Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
        <button
          className="mobile-menu-btn"
          onClick={onMenuClick}
          aria-label="Ouvrir le menu"
          style={{ display: 'none', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-main)', padding: '0.4rem', cursor: 'pointer', flexShrink: 0 }}
        >
          <Menu size={20} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', color: '#34d399', minWidth: 0 }}>
          <Wifi size={14} style={{ flexShrink: 0 }} />
          <span className="header-network-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Serveur Local Connecté (LAN)</span>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
        <button className="btn btn-primary btn-sm" onClick={handleNewSale} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)' }}>
          <PlusCircle size={16} />
          <span className="header-new-sale-label">Nouveau Document Vente</span>
        </button>

        <div className="header-session-label" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          Session: <strong style={{ color: 'var(--text-main)' }}>{user?.nom}</strong>
        </div>

        <button
          className="btn btn-outline btn-sm"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
          aria-label={theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre'}
          style={{ padding: '0.4rem' }}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
};
