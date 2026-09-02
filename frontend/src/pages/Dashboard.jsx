import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { ShoppingCart, DollarSign, Clock, Calendar, PlusCircle, CheckCircle2, ArrowRight, TrendingUp } from 'lucide-react';
import { usePolling } from '../hooks/usePolling';

export const Dashboard = () => {
  const [stats, setStats] = useState({
    todaySalesCount: 0,
    todayCollected: 0,
    totalPendingDebt: 0
  });
  const [recentDocs, setRecentDocs] = useState([]);
  const [dueRelances, setDueRelances] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [docs, clients, rels] = await Promise.all([
        api.getDocuments(),
        api.getClients(''),
        api.getRelances('', 'planifiee')
      ]);

      // Today sales
      const todayStr = new Date().toISOString().split('T')[0];
      const todayDocs = docs.filter((d) => d.date_document.startsWith(todayStr));
      const collectedToday = todayDocs.reduce((sum, d) => sum + parseFloat(d.montant_paye || 0), 0);
      const pendingDebt = clients.reduce((sum, c) => sum + (c.solde_compte < 0 ? Math.abs(parseFloat(c.solde_compte)) : 0), 0);

      setStats({
        todaySalesCount: todayDocs.length,
        todayCollected: collectedToday,
        totalPendingDebt: pendingDebt
      });

      setRecentDocs(docs.slice(0, 5));
      setDueRelances(rels.slice(0, 5));
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  usePolling(fetchDashboardData, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Welcome & Quick Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0 }}>Tableau de Bord & Vue d'Ensemble</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Résumé quotidien des ventes, encaissements et relances crédit prioritaires</p>
        </div>

        <button className="btn btn-primary" onClick={() => navigate('/sales')} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #0ea5e9 100%)', padding: '0.65rem 1.25rem' }}>
          <PlusCircle size={18} /> Nouveau Document (Caisse)
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        {/* Card 1: Today Sales Count */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
            <ShoppingCart size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.05em' }}>Ventes du Jour</div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-main)' }}>{stats.todaySalesCount} docs</div>
          </div>
        </div>

        {/* Card 2: Today Collected */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34d399' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.05em' }}>Encaissé Aujourd'hui</div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#34d399' }}>{stats.todayCollected.toFixed(3)} TND</div>
          </div>
        </div>

        {/* Card 3: Total Pending Client Debt */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.05em' }}>Total Crédits Clients</div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#f87171' }}>{stats.totalPendingDebt.toFixed(3)} TND</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.25rem' }}>
        {/* Recent Documents Table */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Derniers Documents Émis</h3>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/documents')}>
              Voir Tous <ArrowRight size={14} />
            </button>
          </div>

          <div className="table-responsive">
            <table className="custom-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Numéro</th>
                  <th>Total TTC</th>
                  <th style={{ textAlign: 'center' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {recentDocs.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>Aucun document émis.</td></tr>
                ) : (
                  recentDocs.map((doc) => (
                    <tr key={doc.id_document}>
                      <td><StatusBadge status={doc.type_document} /></td>
                      <td><strong style={{ color: 'var(--text-main)' }}>{doc.numero}</strong></td>
                      <td style={{ fontWeight: 'bold', color: '#34d399' }}>{parseFloat(doc.montant_ttc_final).toFixed(3)} TND</td>
                      <td style={{ textAlign: 'center' }}><StatusBadge status={doc.statut} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Due Relances Today */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} color="#fbbf24" /> Relances à Effectuer
            </h3>
          </div>

          {dueRelances.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Aucune relance crédit planifiée pour aujourd'hui.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {dueRelances.map((rel) => (
                <div key={rel.id_relance} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ color: 'var(--text-main)', display: 'block', fontSize: '0.85rem' }}>Client #{rel.id_client} : {rel.nom} {rel.prenom || ''} </strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Planifiée: {new Date(rel.date_planifiee).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => navigate(`/clients/${rel.id_client}`)}>
                    Fiche Client
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
