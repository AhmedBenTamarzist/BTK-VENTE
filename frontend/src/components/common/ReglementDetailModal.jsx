import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import { ReceiptPrint } from '../print/ReceiptPrint';
import { api } from '../../services/api';
import { toast } from '../../contexts/ToastContext';
import { Printer, CheckCircle2, XCircle } from 'lucide-react';

export const ReglementDetailModal = ({ isOpen, onClose, reglement, clientName, client: propClient, type = 'client', onUpdated }) => {
  const [targetDoc, setTargetDoc] = useState(null);
  const [client, setClient] = useState(propClient || null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (isOpen && reglement) {
      // Load target document if linked
      if (reglement.id_document) {
        api.getDocument(reglement.id_document)
          .then(data => setTargetDoc(data))
          .catch(err => console.error("Error fetching doc details:", err));
      } else {
        setTargetDoc(null);
      }

      // Load client if not provided (only applicable to client reglements)
      if (type !== 'fournisseur' && !propClient && reglement.id_client) {
        api.getClients()
          .then(cls => {
            const found = cls.find(c => c.id_client === reglement.id_client);
            if (found) setClient(found);
          })
          .catch(err => console.error("Error fetching client:", err));
      } else {
        setClient(propClient);
      }
    }
  }, [isOpen, reglement, propClient, type]);

  if (!reglement) return null;

  const handlePrint = () => {
    window.print();
  };

  const isCheque = reglement.mode_paiement === 'cheque' || reglement.mode_paiement === 'traite';
  const isPending = reglement.statut_cheque === 'en_attente';

  const handleChequeStatus = async (statut) => {
    setUpdating(true);
    try {
      if (type === 'fournisseur') {
        await api.updateSupplierChequeStatus(reglement.id_reglement_fournisseur, statut);
      } else {
        await api.updateClientChequeStatus(reglement.id_reglement, statut);
      }
      toast.success(statut === 'encaisse' ? 'Chèque/Traite marqué comme encaissé' : 'Chèque/Traite marqué comme rejeté');
      onUpdated?.();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la mise à jour du statut');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Détails du Règlement — ${reglement.numero || 'N/A'}`}
      maxWidth="500px"
      footer={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
          {isCheque && isPending && (
            <div className="no-print" style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              <button
                className="btn btn-outline"
                disabled={updating}
                onClick={() => handleChequeStatus('rejete')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#f87171', borderColor: '#f87171' }}
              >
                <XCircle size={16} /> Marquer Rejeté
              </button>
              <button
                className="btn btn-outline"
                disabled={updating}
                onClick={() => handleChequeStatus('encaisse')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: '#34d399', borderColor: '#34d399' }}
              >
                <CheckCircle2 size={16} /> Marquer Encaissé
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
            <button className="btn btn-outline" onClick={onClose} style={{ flex: 1 }}>
              Fermer
            </button>
            {type !== 'fournisseur' && (
              <button className="btn btn-primary" onClick={handlePrint} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <Printer size={16} /> Imprimer Reçu
              </button>
            )}
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Screen Only View */}
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
          <div>
            <strong style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{type === 'fournisseur' ? 'Fournisseur' : 'Client'}</strong>
            <div style={{ color: 'var(--text-main)' }}>
              {type === 'fournisseur'
                ? (clientName || `Fournisseur #${reglement.id_fournisseur}`)
                : (clientName || (client ? `${client.nom} ${client.prenom || ''}` : `Client #${reglement.id_client}`))}
            </div>
          </div>
          <div>
            <strong style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Date</strong>
            <div style={{ color: 'var(--text-main)' }}>{new Date(reglement.date_reglement).toLocaleString('fr-FR')}</div>
          </div>

          <div>
            <strong style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Montant</strong>
            <div style={{ color: '#34d399', fontWeight: 'bold', fontSize: '1.1rem' }}>
              {parseFloat(reglement.montant).toFixed(3)} TND
            </div>
          </div>
          <div>
            <strong style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Mode de Paiement</strong>
            <div style={{ textTransform: 'capitalize', color: 'var(--text-main)' }}>{reglement.mode_paiement}</div>
          </div>

          {(reglement.reference_paiement || reglement.mode_paiement !== 'espece') && (
            <div>
              <strong style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Référence / N°</strong>
              <div style={{ color: 'var(--text-main)' }}>{reglement.reference_paiement || 'N/A'}</div>
            </div>
          )}

          {reglement.date_echeance && (
            <div>
              <strong style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Date d'échéance</strong>
              <div style={{ color: 'var(--text-main)' }}>{new Date(reglement.date_echeance).toLocaleDateString('fr-FR')}</div>
            </div>
          )}

          {reglement.statut_cheque && (
            <div>
              <strong style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Statut Chèque/Traite</strong>
              <StatusBadge status={reglement.statut_cheque} />
            </div>
          )}

          {reglement.id_document && (
            <div>
              <strong style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Document Cible</strong>
              <div style={{ color: 'var(--text-main)' }}>{reglement.numero_document || `Doc #${reglement.id_document}`}</div>
            </div>
          )}

          {reglement.id_facturation && (
            <div>
              <strong style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Facture Cible</strong>
              <div style={{ color: 'var(--text-main)' }}>{reglement.numero_facturation || `Facture #${reglement.id_facturation}`}</div>
            </div>
          )}
        </div>

        {/* Screen Only Notes */}
        {reglement.notes && (
          <div className="no-print" style={{ marginTop: '0.5rem' }}>
            <strong style={{ display: 'block', color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Notes</strong>
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.05)', 
              padding: '0.75rem', 
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: '#e2e8f0',
              lineHeight: '1.4'
            }}>
              {reglement.notes}
            </div>
          </div>
        )}

        {/* Print Only Receipt */}
        <div className="print-only" style={{ display: 'none' }}>
          <ReceiptPrint reglement={reglement} client={client} document={targetDoc} />
        </div>
      </div>
    </Modal>
  );
};
