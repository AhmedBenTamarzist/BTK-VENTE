import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { X, Loader, Printer } from 'lucide-react';
import { Modal } from './Modal';
import { RetourPrint } from '../print/RetourPrint';

export const RetourDetailModal = ({ isOpen, onClose, retourId }) => {
  const [retour, setRetour] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && retourId) {
      loadData();
    }
  }, [isOpen, retourId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getRetour(retourId);
      setRetour(data);

      if (data.id_client) {
        const clientData = await api.getClient(data.id_client);
        setClient(clientData);
      } else {
        setClient(null);
      }
    } catch (err) {
      setError(err.message || 'Erreur lors du chargement des détails du retour');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <Modal 
      title={`Détails du Bon de Retour N° ${retour?.numero || ''}`} 
      isOpen={isOpen} 
      onClose={onClose} 
      maxWidth="800px"
      footer={
        <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
          <button className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>
            Fermer
          </button>
          {!loading && !error && retour && (
            <button className="btn btn-primary" onClick={handlePrint} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <Printer size={16} /> Imprimer Reçu
            </button>
          )}
        </div>
      }
    >
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
          <Loader className="spin" size={24} style={{ marginBottom: '1rem', display: 'inline-block' }} />
          <p>Chargement des détails...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#f87171' }}>
          {error}
        </div>
      ) : retour ? (
        <div>
          {/* Screen Only View */}
          <div className="no-print">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Date</div>
                <div style={{ fontWeight: '500' }}>{new Date(retour.date_retour).toLocaleString()}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Montant Total TTC</div>
                <div style={{ fontWeight: 'bold', color: '#f87171' }}>{parseFloat(retour.montant_ttc).toFixed(3)} TND</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Document lié</div>
                {retour.numero_document ? (
                  <div style={{ fontWeight: '600', color: '#34d399' }}>📄 {retour.numero_document}</div>
                ) : (
                  <div style={{ fontWeight: '500', color: '#94a3b8', fontStyle: 'italic' }}>Retour Global (sans BL)</div>
                )}
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Motif</div>
                <div style={{ fontWeight: '500' }}>{retour.motif || 'Aucun'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Statut</div>
                <div style={{ fontWeight: '500', textTransform: 'capitalize' }}>
                  <span className="badge badge-success">{retour.statut}</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Mode de Remboursement</div>
                {retour.mode_remboursement === 'especes' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.8rem', background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)', borderRadius: '20px', color: '#fbbf24', fontWeight: '600', fontSize: '0.85rem' }}>
                    💵 Remboursé en Espèces
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.8rem', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: '20px', color: '#60a5fa', fontWeight: '600', fontSize: '0.85rem' }}>
                    🏦 Crédité au Compte Client
                  </span>
                )}
              </div>
            </div>

            <h4 style={{ margin: '0 0 1rem 0', paddingBottom: '0.5rem', borderBottom: '1px solid #334155' }}>Articles Retournés</h4>
            
            <div className="table-responsive">
              <table className="custom-table" style={{ fontSize: '0.9rem' }}>
                <thead>
                  <tr>
                    <th>Article</th>
                    <th style={{ textAlign: 'right' }}>Quantité</th>
                    <th style={{ textAlign: 'right' }}>Prix Unitaire TTC</th>
                    <th style={{ textAlign: 'right' }}>Total Ligne</th>
                  </tr>
                </thead>
                <tbody>
                  {retour.lignes && retour.lignes.map((l, idx) => (
                    <tr key={idx}>
                      <td>
                        <div>{l.article?.nom || `Article ID ${l.id_article}`}</div>
                        {l.article?.reference && <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Ref: {l.article.reference}</div>}
                      </td>
                      <td style={{ textAlign: 'right' }}>{parseFloat(l.quantite).toFixed(2)}</td>
                      <td style={{ textAlign: 'right' }}>{parseFloat(l.prix_unitaire_ttc).toFixed(3)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        {(parseFloat(l.quantite) * parseFloat(l.prix_unitaire_ttc)).toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Print Only Receipt */}
          <div className="print-only" style={{ display: 'none' }}>
            <RetourPrint retour={retour} client={client} />
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
