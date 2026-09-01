import React, { useState, useMemo } from 'react';
import { toast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { RefreshCw, GitCompare, CheckCircle2, XCircle } from 'lucide-react';

const STATUT_BADGE = {
  identique: { label: 'Identique', badge: 'badge-success' },
  different: { label: 'Différent', badge: 'badge-warning' },
  venteapp_seulement: { label: 'VenteApp seulement', badge: 'badge-info' },
  debot_seulement: { label: 'Debot seulement', badge: 'badge-info' },
};

const ACTION_OPTIONS = {
  identique: [{ value: 'ignore', label: 'Ignorer' }],
  different: [
    { value: 'ignore', label: 'Ignorer' },
    { value: 'use_debot', label: 'Utiliser Debot → VenteApp' },
    { value: 'use_venteapp', label: 'Utiliser VenteApp → Debot' },
  ],
  venteapp_seulement: [
    { value: 'ignore', label: 'Ignorer' },
    { value: 'create_in_debot', label: 'Créer dans Debot' },
  ],
  debot_seulement: [
    { value: 'ignore', label: 'Ignorer' },
    { value: 'create_in_venteapp', label: 'Créer dans VenteApp' },
  ],
};

export const DebotSync = () => {
  const [comparing, setComparing] = useState(false);
  const [items, setItems] = useState(null);
  const [totals, setTotals] = useState(null);
  const [actions, setActions] = useState({}); // reference -> action
  const [showIdentiques, setShowIdentiques] = useState(false);
  const [search, setSearch] = useState('');
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState(null);

  const handleCompare = async () => {
    try {
      setComparing(true);
      setResults(null);
      const data = await api.compareDebot();
      setItems(data.items);
      setTotals({ venteapp: data.total_venteapp, debot: data.total_debot, diff: data.total_differences });
      const initialActions = {};
      data.items.forEach((it) => { initialActions[it.reference] = 'ignore'; });
      setActions(initialActions);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setComparing(false);
    }
  };

  const visibleItems = useMemo(() => {
    if (!items) return [];
    return items.filter((it) => {
      if (!showIdentiques && it.statut === 'identique') return false;
      if (search.trim() && !it.reference.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [items, showIdentiques, search]);

  const setAction = (reference, value) => setActions((prev) => ({ ...prev, [reference]: value }));

  const bulkSetVisible = (predicate, value) => {
    setActions((prev) => {
      const next = { ...prev };
      visibleItems.forEach((it) => {
        if (predicate(it)) next[it.reference] = value;
      });
      return next;
    });
  };

  const handleApply = async () => {
    const resolutions = Object.entries(actions)
      .filter(([, action]) => action !== 'ignore')
      .map(([reference, action]) => ({ reference, action }));

    if (resolutions.length === 0) {
      toast.error('Aucune action sélectionnée (tout est sur "Ignorer").');
      return;
    }

    try {
      setApplying(true);
      const res = await api.resolveDebot(resolutions);
      setResults(res.results);
      const failed = res.results.filter((r) => !r.success).length;
      if (failed === 0) {
        toast.success(`${res.results.length} action(s) appliquée(s) avec succès.`);
      } else {
        toast.error(`${failed} action(s) ont échoué sur ${res.results.length}. Voir le détail ci-dessous.`);
      }
      handleCompare();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <GitCompare size={22} /> Synchronisation Debot
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Compare le catalogue d'articles avec Debot (référence VenteApp ↔ code_article Debot)
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleCompare} disabled={comparing}>
          <RefreshCw size={16} /> {comparing ? 'Comparaison en cours...' : 'Comparer avec Debot'}
        </button>
      </div>

      {totals && (
        <div className="glass-card" style={{ display: 'flex', gap: '2rem', padding: '1rem' }}>
          <div><strong style={{ color: 'white' }}>{totals.venteapp}</strong> <span style={{ color: '#94a3b8' }}>articles VenteApp</span></div>
          <div><strong style={{ color: 'white' }}>{totals.debot}</strong> <span style={{ color: '#94a3b8' }}>articles Debot</span></div>
          <div><strong style={{ color: '#fbbf24' }}>{totals.diff}</strong> <span style={{ color: '#94a3b8' }}>à examiner</span></div>
        </div>
      )}

      {items && (
        <>
          <div className="glass-card" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', padding: '1rem', alignItems: 'center' }}>
            <input
              className="form-input" style={{ maxWidth: '220px' }}
              placeholder="Filtrer par référence..."
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#94a3b8' }}>
              <input type="checkbox" checked={showIdentiques} onChange={(e) => setShowIdentiques(e.target.checked)} />
              Afficher aussi les identiques
            </label>
            <div style={{ flex: 1 }} />
            <button className="btn btn-outline btn-sm" onClick={() => bulkSetVisible((it) => it.statut === 'different', 'use_debot')}>
              Différents visibles : Debot → VenteApp
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => bulkSetVisible((it) => it.statut === 'different', 'use_venteapp')}>
              Différents visibles : VenteApp → Debot
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => bulkSetVisible((it) => it.statut === 'debot_seulement', 'create_in_venteapp')}>
              Manquants VenteApp visibles : Créer
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => bulkSetVisible((it) => it.statut === 'venteapp_seulement', 'create_in_debot')}>
              Manquants Debot visibles : Créer
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => bulkSetVisible(() => true, 'ignore')}>
              Tout ignorer (visible)
            </button>
          </div>

          <div className="glass-card">
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Statut</th>
                    <th>Différences</th>
                    <th style={{ minWidth: '220px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Rien à afficher.</td></tr>
                  ) : (
                    visibleItems.map((it) => {
                      const st = STATUT_BADGE[it.statut];
                      const result = results?.find((r) => r.reference === it.reference);
                      return (
                        <tr key={it.reference}>
                          <td><strong style={{ color: 'white' }}>{it.reference}</strong></td>
                          <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                          <td style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                            {it.differences.length === 0 ? '—' : it.differences.map((d) => (
                              <div key={d.champ}>
                                <strong>{d.libelle}</strong> : VenteApp = {d.valeur_venteapp} / Debot = {d.valeur_debot}
                              </div>
                            ))}
                          </td>
                          <td>
                            <select
                              className="form-input"
                              value={actions[it.reference] || 'ignore'}
                              onChange={(e) => setAction(it.reference, e.target.value)}
                            >
                              {(ACTION_OPTIONS[it.statut] || ACTION_OPTIONS.identique).map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            {result && (
                              <div style={{ marginTop: '4px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', color: result.success ? '#34d399' : '#f87171' }}>
                                {result.success ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {result.message}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleApply} disabled={applying}>
              {applying ? 'Application en cours...' : 'Appliquer les actions sélectionnées'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
