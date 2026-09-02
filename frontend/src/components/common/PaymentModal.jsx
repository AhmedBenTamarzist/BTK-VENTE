import React, { useState, useEffect, useRef } from 'react';
import { toast } from '../../contexts/ToastContext';
import { Modal } from './Modal';
import { api } from '../../services/api';
import { CheckCircle2, X } from 'lucide-react';

export const PaymentModal = ({ isOpen, onClose, document, onPaymentCompleted, forceWhatsapp }) => {
  const montantRestant = document ? parseFloat(document.montant_restant || document.montant_ttc_final) : 0;

  const [montant, setMontant] = useState('');
  const [modePaiement, setModePaiement] = useState('espece');
  const [referencePaiement, setReferencePaiement] = useState('');
  const [dateEcheance, setDateEcheance] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendWhatsapp, setSendWhatsapp] = useState(true);

  const inputRef = useRef(null);

  // Reset & pre-fill each time the modal opens
  useEffect(() => {
    if (isOpen && document) {
      const restant = parseFloat(document.montant_restant || document.montant_ttc_final || 0);
      setMontant('');
      setModePaiement('espece');
      setReferencePaiement('');
      setDateEcheance('');
      setNotes('');
      setSendWhatsapp(true);
      toast.error('');
      // Auto-focus and auto-select the amount input
      setTimeout(() => inputRef.current?.select(), 120);
    }
    // Ne dépend que de l'id du document : un nouvel objet `document` fourni
    // par le rafraîchissement automatique en arrière-plan ne doit pas
    // réinitialiser le montant en cours de saisie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, document?.id_document]);

  if (!document) return null;

  const montantSaisi = parseFloat(montant) || 0;
  const monnaieRendue = modePaiement === 'espece' ? Math.max(0, montantSaisi - montantRestant) : 0;
  const resteApresEncaissement = Math.max(0, montantRestant - montantSaisi);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    toast.error('');

    if (!montantSaisi || montantSaisi <= 0) {
      toast.error('Le montant doit être supérieur à 0.');
      return;
    }

    try {
      setLoading(true);
      const reglement = await api.createClientPayment({
        id_client: document.id_client,
        id_document: document.id_document || null,
        id_facturation: document.id_facturation || null,
        montant: montantSaisi,
        mode_paiement: modePaiement,
        reference_paiement: referencePaiement.trim() || null,
        date_echeance: dateEcheance || null,
        notes: notes.trim() || null,
        send_whatsapp: forceWhatsapp !== undefined ? forceWhatsapp : sendWhatsapp,
      });

      if (onPaymentCompleted) {
        onPaymentCompleted(reglement, montantSaisi, monnaieRendue);
      }
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Allow Enter key to validate
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) handleSubmit();
  };

  const MODE_LABELS = {
    espece: '💵 Espèce',
    cheque: '🏦 Chèque',
    virement: '🔁 Virement',
    carte: '💳 Carte',
    traite: '📄 Traite',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`💰 Encaissement — ${document.numero}`}
      maxWidth="460px"
      footer={
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
          <button
            className="btn btn-outline"
            onClick={onClose}
            type="button"
            disabled={loading}
            style={{ flex: 1 }}
          >
            <X size={14} /> Payer plus tard
          </button>
          <button
            className="btn btn-success"
            onClick={handleSubmit}
            type="button"
            disabled={loading}
            style={{
              flex: 2,
              fontSize: '1rem',
              fontWeight: '700',
              background: 'linear-gradient(135deg,#10b981,#059669)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={16} />
            {loading ? 'Enregistrement...' : 'Valider & Imprimer le Ticket'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>


        {/* Montant à payer — grand affichage */}
        <div style={{
          background: 'rgba(16,185,129,0.08)',
          border: '2px solid rgba(16,185,129,0.4)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Montant Total à Régler
          </div>
          <div style={{ fontSize: '2.4rem', fontWeight: '900', color: '#34d399', letterSpacing: '-0.02em' }}>
            {montantRestant.toFixed(3)}
            <span style={{ fontSize: '1rem', fontWeight: '500', marginLeft: '0.4rem' }}>TND</span>
          </div>
          {parseFloat(document.montant_paye) > 0 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
              Déjà payé : {parseFloat(document.montant_paye).toFixed(3)} TND &nbsp;|&nbsp;
              Total doc : {parseFloat(document.montant_ttc_final).toFixed(3)} TND
            </div>
          )}
        </div>

        {/* Montant encaissé — grand champ */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '0.85rem', marginBottom: '0.35rem' }}>
            Montant Encaissé (TND)
          </label>
          <input
            ref={inputRef}
            className="form-input"
            type="number"
            step="0.001"
            min="0"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              fontSize: '1.7rem',
              fontWeight: '800',
              textAlign: 'center',
              color: 'var(--text-main)',
              padding: '0.8rem',
              letterSpacing: '-0.01em',
            }}
          />
        </div>

        {/* Indicateur monnaie / reste */}
        {modePaiement === 'espece' && montantSaisi > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.65rem 1rem',
            borderRadius: '8px',
            background: monnaieRendue > 0 ? 'rgba(251,191,36,0.12)' : resteApresEncaissement > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.12)',
            border: `1px solid ${monnaieRendue > 0 ? 'rgba(251,191,36,0.5)' : resteApresEncaissement > 0 ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
          }}>
            {monnaieRendue > 0 ? (
              <>
                <span style={{ color: '#fbbf24', fontWeight: '600' }}>🪙 Monnaie à rendre</span>
                <span style={{ color: '#fbbf24', fontWeight: '800', fontSize: '1.2rem' }}>{monnaieRendue.toFixed(3)} TND</span>
              </>
            ) : resteApresEncaissement > 0 ? (
              <>
                <span style={{ color: '#f87171' }}>⚠️ Reste à payer</span>
                <span style={{ color: '#f87171', fontWeight: '700', fontSize: '1.1rem' }}>{resteApresEncaissement.toFixed(3)} TND</span>
              </>
            ) : (
              <>
                <span style={{ color: '#34d399', fontWeight: '600' }}>✅ Paiement exact</span>
                <span style={{ color: '#34d399', fontWeight: '800' }}>0.000 TND</span>
              </>
            )}
          </div>
        )}

        {/* Mode de paiement — boutons */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '0.82rem', marginBottom: '0.35rem' }}>Mode de Paiement</label>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {Object.entries(MODE_LABELS).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setModePaiement(val)}
                style={{
                  flex: 1,
                  minWidth: '75px',
                  padding: '0.45rem 0.4rem',
                  borderRadius: '6px',
                  border: `1px solid ${modePaiement === val ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                  background: modePaiement === val ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.04)',
                  color: modePaiement === val ? '#34d399' : 'var(--text-muted)',
                  fontWeight: modePaiement === val ? '700' : '400',
                  cursor: 'pointer',
                  fontSize: '0.77rem',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Référence / Échéance (si non espèce) */}
        {modePaiement !== 'espece' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>N° Référence</label>
              <input
                className="form-input"
                value={referencePaiement}
                onChange={(e) => setReferencePaiement(e.target.value)}
                placeholder="ex: CHQ-895623"
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Date d'Échéance</label>
              <input
                className="form-input"
                type="date"
                value={dateEcheance}
                onChange={(e) => setDateEcheance(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>Notes (optionnel)</label>
          <textarea
            className="form-textarea"
            rows={1}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Remarques éventuelles..."
          />
        </div>
        
        {/* WhatsApp Checkbox - seulement si pas forcé depuis la vente */}
        {forceWhatsapp === undefined && (
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input type="checkbox" checked={sendWhatsapp} onChange={(e) => setSendWhatsapp(e.target.checked)} />
              Envoyer une notification WhatsApp
            </label>
          </div>
        )}
        {forceWhatsapp === true && (
          <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)', fontSize: '0.8rem', color: '#25d366', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📱</span> Un message WhatsApp complet (document + paiement) sera envoyé au client automatiquement.
          </div>
        )}
      </div>
    </Modal>
  );
};