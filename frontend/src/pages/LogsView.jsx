import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Activity, RefreshCw } from 'lucide-react';

const TABLE_LABELS = {
  documents: 'Documents de vente',
  clients: 'Clients',
  articles: 'Articles',
  achats: 'Achats fournisseur',
  fournisseurs: 'Fournisseurs',
  bons_retour: 'Bons de retour',
  facturations: 'Facturation groupée',
  reglements: 'Règlements clients',
  reglements_fournisseur: 'Règlements fournisseurs',
  utilisateurs: 'Utilisateurs',
};

const ACTION_STYLES = {
  creation: { label: 'Création', badge: 'badge-success' },
  modification: { label: 'Modification', badge: 'badge-info' },
  suppression: { label: 'Suppression', badge: 'badge-danger' },
  ajustement_stock: { label: 'Ajustement Stock', badge: 'badge-warning' },
  livraison_articles: { label: 'Livraison', badge: 'badge-info' },
  conversion: { label: 'Conversion', badge: 'badge-info' },
  facturation_fiscale: { label: 'Facturation', badge: 'badge-success' },
  facturation_modifiee: { label: 'Facturation modifiée', badge: 'badge-warning' },
  facturation_supprimee: { label: 'Facturation supprimée', badge: 'badge-danger' },
  reglement_client: { label: 'Règlement Client', badge: 'badge-success' },
  reglement_fournisseur: { label: 'Règlement Fournisseur', badge: 'badge-success' },
  retour_client: { label: 'Retour Client', badge: 'badge-warning' },
  connexion: { label: 'Connexion', badge: 'badge-secondary' },
};

export const LogsView = () => {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableFilter, setTableFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [limit, setLimit] = useState(200);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getLogs(tableFilter, userFilter, limit);
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tableFilter, userFilter, limit]);

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => {});
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={22} /> Journal des Activités
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Historique de toutes les actions effectuées dans l'application</p>
        </div>
        <button className="btn btn-outline" onClick={fetchLogs}>
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      <div className="glass-card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Table concernée</label>
          <select className="form-input" value={tableFilter} onChange={(e) => setTableFilter(e.target.value)}>
            <option value="">Toutes</option>
            {Object.entries(TABLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Utilisateur</label>
          <select className="form-input" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="">Tous</option>
            {users.map((u) => (
              <option key={u.id_utilisateur} value={u.id_utilisateur}>{u.nom} {u.prenom || ''}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Nombre d'entrées</label>
          <select className="form-input" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={100}>100 dernières</option>
            <option value={200}>200 dernières</option>
            <option value={500}>500 dernières</option>
            <option value={1000}>1000 dernières</option>
          </select>
        </div>
      </div>

      <div className="glass-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Utilisateur</th>
                <th>Action</th>
                <th>Table</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>Chargement du journal...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Aucune activité trouvée.</td></tr>
              ) : (
                logs.map((log) => {
                  const action = ACTION_STYLES[log.type_action] || { label: log.type_action, badge: 'badge-secondary' };
                  return (
                    <tr key={log.id_log}>
                      <td style={{ whiteSpace: 'nowrap', color: '#94a3b8', fontSize: '0.8rem' }}>
                        {new Date(log.date_action).toLocaleString('fr-FR')}
                      </td>
                      <td>
                        {log.utilisateur ? (
                          <strong style={{ color: 'white' }}>{log.utilisateur.nom} {log.utilisateur.prenom || ''}</strong>
                        ) : (
                          <span style={{ color: '#64748b' }}>Système</span>
                        )}
                      </td>
                      <td><span className={`badge ${action.badge}`}>{action.label}</span></td>
                      <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{TABLE_LABELS[log.table_concernee] || log.table_concernee || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>{log.description || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
