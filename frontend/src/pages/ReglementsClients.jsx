import React, { useState } from 'react';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { CreditCard, Search, RefreshCw } from 'lucide-react';
import { ReglementDetailModal } from '../components/common/ReglementDetailModal';
import { usePolling } from '../hooks/usePolling';

export const ReglementsClients = () => {
  const [reglements, setReglements] = useState([]);
  const [clientsMap, setClientsMap] = useState({});
  const [modeFilter, setModeFilter] = useState('');
  const [chequeFilter, setChequeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedReglement, setSelectedReglement] = useState(null);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [regs, cls] = await Promise.all([
        api.getClientPayments(),
        api.getClients('')
      ]);
      setReglements(regs);

      const cMap = {};
      cls.forEach((c) => { cMap[c.id_client] = c; });
      setClientsMap(cMap);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  usePolling(fetchData, []);

  const filteredReglements = reglements.filter((r) => {
    if (modeFilter && r.mode_paiement !== modeFilter) return false;
    if (chequeFilter && r.statut_cheque !== chequeFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchNum = r.numero?.toLowerCase().includes(term);
      const matchRef = r.reference_paiement?.toLowerCase().includes(term);
      const matchDoc = r.numero_document?.toLowerCase().includes(term);
      const matchFact = r.numero_facturation?.toLowerCase().includes(term);
      if (!matchNum && !matchRef && !matchDoc && !matchFact) return false;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Règlements Clients (Vue Transverse)</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Suivi global des paiements reçus et contrôle du statut des chèques et traites</p>
        </div>
        <button className="btn btn-outline" onClick={fetchData}>
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Rechercher (N°, Réf, Doc...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>

        <select className="form-select" value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
          <option value="">Tous les Modes de Paiement</option>
          <option value="espece">Espèce</option>
          <option value="cheque">Chèque</option>
          <option value="virement">Virement</option>
          <option value="traite">Traite</option>
        </select>

        <select className="form-select" value={chequeFilter} onChange={(e) => setChequeFilter(e.target.value)}>
          <option value="">Tous les Statuts de Chèques</option>
          <option value="en_attente">Chèques En Attente</option>
          <option value="encaisse">Chèques Encaissés</option>
          <option value="rejete">Chèques Rejetés</option>
        </select>
      </div>

      <div className="glass-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>N° Règlement</th>
                <th>Date</th>
                <th>Client</th>
                <th>Mode</th>
                <th>Référence / N° Chèque</th>
                <th>Échéance</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
                <th style={{ textAlign: 'center' }}>Statut Chèque</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>Chargement des règlements...</td></tr>
              ) : filteredReglements.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Aucun règlement trouvé.</td></tr>
              ) : (
                filteredReglements.map((r) => {
                  const client = clientsMap[r.id_client];
                  return (
                    <tr 
                      key={r.id_reglement} 
                      onClick={() => setSelectedReglement(r)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><strong style={{ color: 'white' }}>{r.numero}</strong></td>
                      <td>{new Date(r.date_reglement).toLocaleDateString('fr-FR')}</td>
                      <td>{client ? `${client.nom} ${client.prenom || ''}` : `Client #${r.id_client}`}</td>
                      <td><span style={{ textTransform: 'capitalize' }}>{r.mode_paiement}</span></td>
                      <td>{r.reference_paiement || 'N/A'}</td>
                      <td>{r.date_echeance ? new Date(r.date_echeance).toLocaleDateString('fr-FR') : 'N/A'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#34d399' }}>{parseFloat(r.montant).toFixed(3)} TND</td>
                      <td style={{ textAlign: 'center' }}>
                        {r.statut_cheque ? <StatusBadge status={r.statut_cheque} /> : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <ReglementDetailModal
        isOpen={!!selectedReglement}
        onClose={() => setSelectedReglement(null)}
        reglement={selectedReglement}
        client={selectedReglement ? clientsMap[selectedReglement.id_client] : null}
        clientName={selectedReglement ? (clientsMap[selectedReglement.id_client] ? `${clientsMap[selectedReglement.id_client].nom} ${clientsMap[selectedReglement.id_client].prenom || ''}` : null) : null}
        type="client"
        onUpdated={fetchData}
      />
    </div>
  );
};

