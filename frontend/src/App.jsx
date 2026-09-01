import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SalesTabsProvider } from './context/SalesTabsContext';
import { Layout } from './components/layout/Layout';
import { ToastProvider } from './contexts/ToastContext';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { SalesScreen } from './pages/SalesScreen';
import { DocumentsList } from './pages/DocumentsList';
import { ClientsList } from './pages/ClientsList';
import { ClientDetail } from './pages/ClientDetail';
import { RetoursList } from './pages/RetoursList';
import { FacturationsList } from './pages/FacturationsList';
import { AchatsList } from './pages/AchatsList';
import { ArticlePurchases } from './pages/ArticlePurchases';
import { ArticlesCatalog } from './pages/ArticlesCatalog';
import { FournisseursList } from './pages/FournisseursList';
import { ReglementsClients } from './pages/ReglementsClients';
import { ReglementsFournisseurs } from './pages/ReglementsFournisseurs';
import { UsersManagement } from './pages/UsersManagement';
import { Settings } from './pages/Settings';
import { PrintView } from './pages/PrintView';
import { RelancesList } from './pages/RelancesList';
import { LogsView } from './pages/LogsView';
import { DebotSync } from './pages/DebotSync';
import { LivraisonsList } from './pages/LivraisonsList';

const LOADING = <div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}>Chargement...</div>;

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return LOADING;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
};

// RoleRoute — accepts a `roles` array; if empty/undefined = any authenticated user
const RoleRoute = ({ children, roles }) => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return LOADING;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
};

export const App = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <SalesTabsProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/print/:id" element={<PrintView />} />

              {/* All authenticated */}
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/sales" element={<ProtectedRoute><SalesScreen /></ProtectedRoute>} />
              <Route path="/documents" element={<ProtectedRoute><DocumentsList /></ProtectedRoute>} />
              <Route path="/a-livrer" element={<ProtectedRoute><LivraisonsList /></ProtectedRoute>} />
              <Route path="/retours" element={<ProtectedRoute><RetoursList /></ProtectedRoute>} />
              <Route path="/articles" element={<ProtectedRoute><ArticlesCatalog /></ProtectedRoute>} />

              {/* Caissier + Gestionnaire + Admin */}
              <Route path="/clients" element={<RoleRoute roles={['admin','caissier','gestionnaire_stock']}><ClientsList /></RoleRoute>} />
              <Route path="/clients/:id" element={<RoleRoute roles={['admin','caissier','gestionnaire_stock']}><ClientDetail /></RoleRoute>} />
              <Route path="/reglements-clients" element={<RoleRoute roles={['admin','caissier','gestionnaire_stock']}><ReglementsClients /></RoleRoute>} />
              <Route path="/relances" element={<RoleRoute roles={['admin','caissier','gestionnaire_stock', 'vendeur']}><RelancesList /></RoleRoute>} />

              {/* Gestionnaire + Admin */}
              <Route path="/achats" element={<RoleRoute roles={['admin','gestionnaire_stock']}><AchatsList /></RoleRoute>} />
              <Route path="/article-purchases" element={<RoleRoute roles={['admin','gestionnaire_stock']}><ArticlePurchases /></RoleRoute>} />
              <Route path="/fournisseurs" element={<RoleRoute roles={['admin','gestionnaire_stock']}><FournisseursList /></RoleRoute>} />
              <Route path="/reglements-fournisseurs" element={<RoleRoute roles={['admin','gestionnaire_stock']}><ReglementsFournisseurs /></RoleRoute>} />
              <Route path="/debot-sync" element={<RoleRoute roles={['admin','gestionnaire_stock']}><DebotSync /></RoleRoute>} />

              {/* Admin only */}
              <Route path="/facturations" element={<RoleRoute roles={['admin']}><FacturationsList /></RoleRoute>} />
              <Route path="/users" element={<RoleRoute roles={['admin']}><UsersManagement /></RoleRoute>} />
              <Route path="/logs" element={<RoleRoute roles={['admin']}><LogsView /></RoleRoute>} />
              <Route path="/settings" element={<RoleRoute roles={['admin']}><Settings /></RoleRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </SalesTabsProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;

