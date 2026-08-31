import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShoppingCart, PlusCircle, Wifi, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSalesTabs } from '../../context/SalesTabsContext';

export const Header = ({ onMenuClick = () => {} }) => {
  const { user } = useAuth();
  const { addTab } = useSalesTabs();
  const navigate = useNavigate();
  const location = useLocation();

  const handleNewSale = () => {
    addTab('bon_livraison');
    if (location.pathname !== '/sales') {
      navigate('/sales');
    }
  };

  return (
    <header className="header-container" style={{ height: '60px', background: '#1e293b', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', flexShrink: 0, gap: '0.75rem' }}>
      {/* Mobile menu toggle + Network / LAN Server Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
        <button
          className="mobile-menu-btn"
          onClick={onMenuClick}
          aria-label="Ouvrir le menu"
          style={{ display: 'none', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white', padding: '0.4rem', cursor: 'pointer', flexShrink: 0 }}
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

        <div className="header-session-label" style={{ fontSize: '0.85rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
          Session: <strong style={{ color: 'white' }}>{user?.nom}</strong>
        </div>
      </div>
    </header>
  );
};
