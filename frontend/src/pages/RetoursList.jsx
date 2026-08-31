import React, { useState } from 'react';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { Plus, RefreshCw, Trash2, Eye, Printer, Search, X } from 'lucide-react';
import { CreateRetourModal } from '../components/common/CreateRetourModal';
import { RetourDetailModal } from '../components/common/RetourDetailModal';
import { RetourPrint } from '../components/print/RetourPrint';
import { Modal } from '../components/common/Modal';
import { usePolling } from '../hooks/usePolling';

export const RetoursList = () => {
  const [retours, setRetours] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRetourId, setSelectedRetourId] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printedRetour, setPrintedRetour] = useState(null);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [rets, cls] = await Promise.all([
        api.getRetours(),
        api.getClients('')
      ]);
      setRetours(rets);
      setClients(cls);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  usePolling(fetchData, []);

  const handleDelete = async (r) => {
    if (r.facture_dans_facturation) {
      alert(`Impossible de supprimer le Bon de Retour ${r.numero} : il est intégré dans une facturation fiscale. Modifiez d'abord la facturation.`);
      return;
    }
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le Bon de Retour ${r.numero} ?`)) {
      try {
        await api.deleteRetour(r.id_retour);
        fetchData();
      } catch (err) {
        alert(err.message || 'Erreur lors de la suppression.');
      }
    }
  };

  const openDetail = (id) => {
    setSelectedRetourId(id);
    setShowDetailModal(true);
  };

  const clientsMap = {};
  clients.forEach((c) => { clientsMap[c.id_client] = c; });

  const filteredRetours = retours.filter((r) => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    const client = clientsMap[r.id_client];
    const clientName = client ? `${client.nom} ${client.prenom || ''}` : '';
    return (
      r.numero?.toLowerCase().includes(term) ||
      clientName.toLowerCase().includes(term) ||
      r.motif?.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Page Title & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Bons de Retour</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Gestion des retours clients et de leurs remboursements</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-outline" onClick={fetchData} title="Rafraîchir">
            <RefreshCw size={16} /> Actualiser
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Nouveau Bon de Retour
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card">
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '2.5rem', paddingRight: search ? '2.5rem' : undefined }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher : N° retour, client, motif..."
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Date</th>
                <th>Client</th>
                <th>Motif</th>
                <th style={{ textAlign: 'right' }}>Montant TTC</th>
                <th style={{ textAlign: 'center' }}>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>Chargement des retours...</td></tr>
              ) : filteredRetours.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Aucun bon de retour trouvé.</td></tr>
              ) : (
                filteredRetours.map((r) => {
                  const client = clientsMap[r.id_client];
                  return (
                    <tr key={r.id_retour} onClick={() => openDetail(r.id_retour)} style={{ cursor: 'pointer' }}>
                      <td><strong style={{ color: 'white' }}>{r.numero}</strong></td>
                      <td>{new Date(r.date_retour).toLocaleDateString('fr-FR')}</td>
                      <td>{client ? `${client.nom} ${client.prenom || ''}` : `Client #${r.id_client}`}</td>
                      <td style={{ color: '#94a3b8' }}>{r.motif || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#f87171' }}>{parseFloat(r.montant_ttc).toFixed(3)} TND</td>
                      <td style={{ textAlign: 'center' }}><StatusBadge status={r.statut} /></td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openDetail(r.id_retour)} title="Voir détails">
                            <Eye size={13} />
                          </button>
                          <button className="btn btn-outline btn-sm" onClick={() => { setPrintedRetour(r); setShowPrintModal(true); }} title="Imprimer Ticket">
                            <Printer size={13} />
                          </button>
                          <button className="btn btn-outline btn-sm" onClick={() => handleDelete(r)} title="Supprimer" style={{ color: '#f87171', borderColor: '#f87171' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateRetourModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={(created) => {
          fetchData();
          if (created && created.id_retour) {
            setPrintedRetour(created);
            setShowPrintModal(true);
          }
        }}
      />

      <RetourDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        retourId={selectedRetourId}
      />

      {/* Return Print Modal */}
      <Modal
        isOpen={showPrintModal}
        onClose={() => { setShowPrintModal(false); setPrintedRetour(null); }}
        title="Impression Bon de Retour"
        maxWidth="400px"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => { setShowPrintModal(false); setPrintedRetour(null); }}>Fermer</button>
            <button className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={16} /> Imprimer
            </button>
          </>
        }
      >
        <RetourPrint retour={printedRetour} client={clientsMap[printedRetour?.id_client]} />
      </Modal>
    </div>
  );
};
