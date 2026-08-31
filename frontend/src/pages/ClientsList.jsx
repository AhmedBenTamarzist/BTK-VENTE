import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { UserPlus, Search, Eye, RefreshCw, X } from 'lucide-react';
import { QuickClientModal } from '../components/common/QuickClientModal';
import { usePolling } from '../hooks/usePolling';

export const ClientsList = () => {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const navigate = useNavigate();

  const fetchClients = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await api.getClients(search);
      setClients(data);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  usePolling(fetchClients, []);


  // Recherche intelligente multi-mots ("ben ahmed" trouve "Ahmed Ben Salah")
  const matchesSearch = (c) => {
    if (!search.trim()) return true;
    const words = search.toLowerCase().trim().split(/\s+/);
    const haystack = [
      c.nom || '', c.prenom || '', c.telephone || '',
      c.matricule_fiscal || '', c.email || ''
    ].join(' ').toLowerCase();
    return words.every(w => haystack.includes(w));
  };

  const filteredClients = clients.filter((c) => {
    if (!matchesSearch(c)) return false;
    if (!typeFilter) return true;
    return c.type_client === typeFilter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Page Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Gestion des Clients</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Liste des clients particuliers et sociétés, soldes et plafonds de crédit</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <UserPlus size={16} /> + Nouveau Client
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 0.5fr', gap: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '2.5rem', paddingRight: search ? '2.5rem' : undefined }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher : nom, prénom, téléphone, matricule fiscal..."
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>

        <select className="form-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Tous les Types (Physique & Société)</option>
          <option value="physique">Particulier / Physique</option>
          <option value="societe">Société / Entreprise</option>
        </select>

        <button className="btn btn-outline" onClick={fetchClients}>
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Table */}
      <div className="glass-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Nom & Prénom / Raison Sociale</th>
                <th>Téléphone</th>
                <th>Matricule Fiscal</th>
                <th style={{ textAlign: 'right' }}>Plafond Crédit</th>
                <th style={{ textAlign: 'right' }}>Solde Compte</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>Chargement des clients...</td></tr>
              ) : filteredClients.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Aucun client trouvé.</td></tr>
              ) : (
                filteredClients.map((c) => {
                  const solde = parseFloat(c.solde_compte);
                  const isNegative = solde < 0;

                  return (
                    <tr key={c.id_client} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clients/${c.id_client}`)}>
                      <td>
                        <span className={`badge ${c.type_client === 'societe' ? 'badge-info' : 'badge-secondary'}`}>
                          {c.type_client === 'societe' ? 'Société' : 'Physique'}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: 'white' }}>{c.nom} {c.prenom || ''}</strong>
                      </td>
                      <td>{c.telephone || 'N/A'}</td>
                      <td>{c.matricule_fiscal || 'N/A'}</td>
                      <td style={{ textAlign: 'right' }}>{parseFloat(c.plafond_credit).toFixed(3)} TND</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: isNegative ? '#f87171' : '#34d399' }}>
                        {solde.toFixed(3)} TND
                        {isNegative && <span style={{ fontSize: '0.75rem', display: 'block', color: '#f87171' }}>(Client doit)</span>}
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/clients/${c.id_client}`)}>
                          <Eye size={14} /> Fiche Détaillée
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <QuickClientModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onClientCreated={(newClient) => {
          fetchClients();
          navigate(`/clients/${newClient.id_client}`);
        }}
      />
    </div>
  );
};
