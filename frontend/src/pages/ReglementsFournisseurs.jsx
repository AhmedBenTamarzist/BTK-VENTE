import React, { useState } from 'react';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { ReglementDetailModal } from '../components/common/ReglementDetailModal';
import { CreditCard, RefreshCw } from 'lucide-react';
import { usePolling } from '../hooks/usePolling';

export const ReglementsFournisseurs = () => {
  const [reglements, setReglements] = useState([]);
  const [fournisseursMap, setFournisseursMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedReglement, setSelectedReglement] = useState(null);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [regs, fourn] = await Promise.all([
        api.getSupplierPayments(),
        api.getFournisseurs('')
      ]);
      setReglements(regs);

      const fMap = {};
      fourn.forEach((f) => { fMap[f.id_fournisseur] = f; });
      setFournisseursMap(fMap);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  usePolling(fetchData, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Règlements Fournisseurs (Vue Global)</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Historique des paiements sortants vers les fournisseurs</p>
        </div>
        <button className="btn btn-outline" onClick={fetchData}>
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      <div className="glass-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>N° Règlement</th>
                <th>Date</th>
                <th>Fournisseur</th>
                <th>Mode</th>
                <th>Référence</th>
                <th>Échéance</th>
                <th style={{ textAlign: 'right' }}>Montant Versé</th>
                <th style={{ textAlign: 'center' }}>Statut Chèque</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>Chargement des règlements...</td></tr>
              ) : reglements.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Aucun règlement fournisseur trouvé.</td></tr>
              ) : (
                reglements.map((r) => {
                  const f = fournisseursMap[r.id_fournisseur];
                  return (
                    <tr
                      key={r.id_reglement_fournisseur}
                      onClick={() => setSelectedReglement(r)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><strong style={{ color: 'white' }}>{r.numero}</strong></td>
                      <td>{new Date(r.date_reglement).toLocaleDateString('fr-FR')}</td>
                      <td>{f ? f.nom : `Fournisseur #${r.id_fournisseur}`}</td>
                      <td><span style={{ textTransform: 'capitalize' }}>{r.mode_paiement}</span></td>
                      <td>{r.reference_paiement || 'N/A'}</td>
                      <td>{r.date_echeance ? new Date(r.date_echeance).toLocaleDateString('fr-FR') : 'N/A'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#f87171' }}>{parseFloat(r.montant).toFixed(3)} TND</td>
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
        clientName={selectedReglement ? (fournisseursMap[selectedReglement.id_fournisseur]?.nom || null) : null}
        type="fournisseur"
        onUpdated={fetchData}
      />
    </div>
  );
};
