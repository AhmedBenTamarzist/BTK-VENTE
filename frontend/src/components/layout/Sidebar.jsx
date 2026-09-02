import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, FileText, Users, Truck, Package, RotateCcw,
  FileSpreadsheet, ShoppingBag, History, CreditCard,
  UserCheck, Settings, LogOut, LayoutDashboard, X, Activity, GitCompare, PackageCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// ── Permission map ────────────────────────────────────────────────────────────
// Each nav item has a `roles` array — if undefined = visible to all authenticated
const ALL_NAV = [
  { label: 'Tableau de bord',         path: '/',                    icon: LayoutDashboard, roles: ['admin'] },
  { label: 'Caisse / Ventes (+)',      path: '/sales',               icon: ShoppingCart, highlight: true },
  { label: 'Documents de Vente',       path: '/documents',           icon: FileText },
  { label: 'À Livrer',                 path: '/a-livrer',            icon: PackageCheck },
  { label: 'Bons de Retour',           path: '/retours',             icon: RotateCcw },
  { label: 'Catalogue Articles',       path: '/articles',            icon: Package },
  // caissier+
  { label: 'Clients',                  path: '/clients',             icon: Users,      roles: ['admin','caissier','gestionnaire_stock'] },
  { label: 'Règlements Clients',       path: '/reglements-clients',  icon: CreditCard, roles: ['admin','caissier','gestionnaire_stock'] },
  { label: 'Relances WhatsApp',        path: '/relances',            icon: UserCheck,  roles: ['admin','caissier','gestionnaire_stock', 'vendeur'], highlight: true },
  // gestionnaire_stock+
  { label: 'Achats Fournisseur',       path: '/achats',              icon: ShoppingBag,    roles: ['admin','gestionnaire_stock'] },
  { label: 'Historique par Article',   path: '/article-purchases',   icon: History,        roles: ['admin','gestionnaire_stock'] },
  { label: 'Fournisseurs',             path: '/fournisseurs',        icon: Truck,          roles: ['admin','gestionnaire_stock'] },
  { label: 'Règlements Fournisseurs',  path: '/reglements-fournisseurs', icon: CreditCard, roles: ['admin','gestionnaire_stock'] },
  { label: 'Synchronisation Debot',    path: '/debot-sync',          icon: GitCompare,     roles: ['admin','gestionnaire_stock'] },
  // admin only
  { label: 'Facturation Groupée',      path: '/facturations',        icon: FileSpreadsheet, roles: ['admin'] },
  { label: 'Utilisateurs',             path: '/users',               icon: UserCheck,       roles: ['admin'] },
  { label: 'Journal des Activités',    path: '/logs',                icon: Activity,        roles: ['admin'] },
  { label: 'Paramètres Entreprise',    path: '/settings',            icon: Settings,        roles: ['admin'] },
];

export const Sidebar = ({ isOpen = false, onClose = () => {}, collapsed = false }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || '';

  const handleLogout = () => { logout(); navigate('/login'); };

  const navItems = ALL_NAV.filter(item =>
    !item.roles || item.roles.includes(role)
  );

  const ROLE_LABELS = {
    admin: 'Administrateur',
    vendeur: 'Vendeur',
    caissier: 'Caissier',
    gestionnaire_stock: 'Gestionnaire Stock',
  };

  return (
    <aside className={`sidebar-container ${isOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`} style={{ width: '250px', background: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Brand */}
      <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', flexShrink: 0 }}>
          Q
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: '1.05rem', margin: 0, fontWeight: '700', letterSpacing: '-0.02em', background: 'linear-gradient(135deg, var(--text-main) 0%, var(--text-muted) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Quincaillerie POS
          </h2>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ERP &amp; Ventes</span>
        </div>
        <button
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="Fermer le menu"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', display: 'none', flexShrink: 0 }}
        >
          <X size={22} />
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0.75rem 0.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onClose}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.6rem 0.85rem', borderRadius: '8px', fontSize: '0.875rem',
                fontWeight: isActive ? '600' : '400',
                color: isActive ? 'var(--accent-primary)' : item.highlight ? 'var(--accent-secondary)' : 'var(--text-muted)',
                backgroundColor: isActive ? 'rgba(99,102,241,0.15)' : item.highlight ? 'rgba(99,102,241,0.08)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                transition: 'all 0.15s ease',
              })}
            >
              <Icon size={18} color={item.highlight ? 'var(--accent-secondary)' : undefined} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.nom} {user?.prenom || ''}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', textTransform: 'capitalize' }}>
            {ROLE_LABELS[role] || role}
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleLogout} title="Déconnexion" style={{ padding: '0.3rem 0.5rem' }}>
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
};
