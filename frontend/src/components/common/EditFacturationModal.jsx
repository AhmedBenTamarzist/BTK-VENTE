import React, { useState, useEffect } from 'react';
import { toast } from '../../contexts/ToastContext';
import { api } from '../../services/api';
import { Modal } from './Modal';
import { CheckSquare, Square, AlertTriangle, Save } from 'lucide-react';

export const EditFacturationModal = ({ isOpen, onClose, facturation, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [numeroFacture, setNumeroFacture] = useState('');
  const [remisePct, setRemisePct] = useState('');
  const [periodeDebut, setPeriodeDebut] = useState('');
  const [periodeFin, setPeriodeFin] = useState('');

  // BLs
  const [currentBlIds, setCurrentBlIds] = useState([]);   // BLs actuellement liés
  const [availableBls, setAvailableBls] = useState([]);   // BLs non facturés dispo
  const [selectedBlIds, setSelectedBlIds] = useState([]); // BLs sélectionnés (inclut actuels)
  const [loadingBls, setLoadingBls] = useState(false);

  // Retours
  const [availableRetours, setAvailableRetours] = useState([]);
  const [selectedRetourIds, setSelectedRetourIds] = useState([]);
  const [modeTraitementRetours, setModeTraitementRetours] = useState('soustraction');
  const [showNegativeWarning, setShowNegativeWarning] = useState(false);

  useEffect(() => {
    if (!isOpen || !facturation) return;
    toast.error('');
    toast.success('');
    setNumeroFacture(facturation.numero_facture || '');
    setRemisePct(parseFloat(facturation.remise_pct || 0).toString());
    setPeriodeDebut(facturation.periode_debut ? facturation.periode_debut.substring(0, 10) : '');
    setPeriodeFin(facturation.periode_fin ? facturation.periode_fin.substring(0, 10) : '');

    // Load current BLs and Retours linked
    setLoadingBls(true);
    Promise.all([
      api.getFacturationBls(facturation.id_facturation),
      api.getDocuments('bon_livraison', facturation.id_client, '', '', true), // non facturés
      api.getRetours(facturation.id_client),
      api.getFacturationRetours(facturation.id_facturation)  // retours actuellement liés
    ])
      .then(([currentBls, freeBls, allRetours, currentLinkedRetours]) => {
        setCurrentBlIds(currentBls.map((b) => b.id_document));
        setSelectedBlIds(currentBls.map((b) => b.id_document));
        // Merge: current BLs + free BLs (deduplicated by id)
        const allBls = [...currentBls];
        freeBls.forEach((b) => {
          if (!allBls.find((x) => x.id_document === b.id_document)) {
            allBls.push(b);
          }
        });
        setAvailableBls(allBls);

        // Retours actuellement liés → pré-sélectionnés
        const currentRetIds = currentLinkedRetours.map(r => r.id_retour);
        setSelectedRetourIds(currentRetIds);

        // Available retours: current ones + non invoiced ones
        const availableRets = [...currentLinkedRetours];
        allRetours.forEach(r => {
          if (!r.facture_dans_facturation && !availableRets.find(x => x.id_retour === r.id_retour)) {
            availableRets.push(r);
          }
        });
        setAvailableRetours(availableRets);
      })
      .catch(() => {
        toast.error("Erreur lors du chargement des documents.");
      })
      .finally(() => setLoadingBls(false));
    // Ne dépend que de l'id de la facturation : un nouvel objet `facturation`
    // fourni par le rafraîchissement automatique en arrière-plan ne doit pas
    // réinitialiser le formulaire pendant que l'utilisateur modifie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, facturation?.id_facturation]);

  const toggleBl = (blId) => {
    setSelectedBlIds((prev) =>
      prev.includes(blId) ? prev.filter((id) => id !== blId) : [...prev, blId]
    );
  };

  const toggleRetour = (retourId) => {
    setSelectedRetourIds((prev) =>
      prev.includes(retourId) ? prev.filter((id) => id !== retourId) : [...prev, retourId]
    );
  };

  // Calculate preview based on selected BLs and remise
  const calculatePreview = () => {
    const selected = availableBls.filter((b) => selectedBlIds.includes(b.id_document));
    const brut = selected.reduce((s, b) => s + parseFloat(b.montant_ttc_final || 0), 0);
    const remise = (parseFloat(remisePct) || 0) / 100;
    const timbre = parseFloat(facturation?.montant_timbre ?? 1) || 0;
    const net = brut * (1 - remise) + timbre;
    return { brut, net, timbre, remiseVal: brut * remise, nbBls: selected.length };
  };

  const preview = calculatePreview();

  const checkNegatives = () => {
    const selectedBls = availableBls.filter((b) => selectedBlIds.includes(b.id_document));
    const selectedRets = availableRetours.filter((r) => selectedRetourIds.includes(r.id_retour));

    // Si aucun retour sélectionné, pas de problème
    if (selectedRets.length === 0) return false;

    // Si les BLs n'ont pas de lignes chargées, on ne peut pas vérifier → laisser le backend valider
    const blsHaveLignes = selectedBls.some(b => b.lignes && b.lignes.length > 0);
    if (!blsHaveLignes) return false;

    const mergedMap = {};
    let hasNeg = false;

    selectedBls.forEach((b) => {
      (b.lignes || []).forEach((l) => {
        const artId = l.id_article;
        const qty = parseFloat(l.quantite);
        if (!mergedMap[artId]) mergedMap[artId] = 0;
        mergedMap[artId] += qty;
      });
    });

    if (modeTraitementRetours === 'soustraction') {
      selectedRets.forEach((r) => {
        (r.lignes || []).forEach((l) => {
          const artId = l.id_article;
          const qty = parseFloat(l.quantite);
          if (mergedMap[artId] === undefined) {
            hasNeg = true;
          } else {
            mergedMap[artId] -= qty;
            if (mergedMap[artId] < 0) hasNeg = true;
          }
        });
      });
    }

    return hasNeg;
  };

  const handleSave = async () => {
    toast.error('');
    toast.success('');
    if (selectedBlIds.length === 0) {
      toast.error('Veuillez sélectionner au moins un Bon de Livraison.');
      return;
    }
    const remise = parseFloat(remisePct) || 0;
    if (remise < 0 || remise > 100) {
      toast.error('La remise doit être entre 0% et 100%.');
      return;
    }

    if (modeTraitementRetours === 'soustraction' && checkNegatives()) {
      setShowNegativeWarning(true);
      return;
    }

    try {
      setLoading(true);
      const updated = await api.updateFacturation(facturation.id_facturation, {
        document_ids: selectedBlIds,
        retour_ids: selectedRetourIds,
        mode_traitement_retours: modeTraitementRetours,
        remise_pct: remise,
        numero_facture: numeroFacture !== facturation.numero_facture ? numeroFacture : undefined,
        periode_debut: periodeDebut || null,
        periode_fin: periodeFin || null,
      });
      toast.success(`Facture N° ${updated.numero_facture} mise à jour avec succès !`);
      if (onUpdated) onUpdated(updated);
      setTimeout(onClose, 1200);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!facturation) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`✏️ Modifier Facture N° ${facturation.numero_facture}`}
      maxWidth="820px"
      footer={
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>Annuler</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            <Save size={15} /> {loading ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      }
    >

      {/* Infos de base */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Numéro de Facture</label>
          <input
            className="form-input"
            value={numeroFacture}
            onChange={(e) => setNumeroFacture(e.target.value)}
            placeholder="ex: 0001/26"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Remise Globale %</label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            className="form-input"
            value={remisePct}
            onChange={(e) => setRemisePct(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Période Début</label>
          <input type="date" className="form-input" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Période Fin</label>
          <input type="date" className="form-input" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)} />
        </div>
      </div>

      {/* BLs disponibles */}
      <h4 style={{ fontSize: '0.95rem', margin: '0.5rem 0' }}>
        Bons de Livraison
        <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          (les BLs actuellement liés sont pré-sélectionnés)
        </span>
      </h4>

      {loadingBls ? (
        <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Chargement des BLs...</div>
      ) : availableBls.length === 0 ? (
        <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Aucun BL disponible pour ce client.
        </div>
      ) : (
        <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem', marginBottom: '1rem' }}>
          {availableBls.map((bl) => {
            const isSelected = selectedBlIds.includes(bl.id_document);
            const isCurrent = currentBlIds.includes(bl.id_document);
            return (
              <div
                key={bl.id_document}
                onClick={() => toggleBl(bl.id_document)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
                  background: isSelected ? 'rgba(99,102,241,0.08)' : 'transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isSelected ? <CheckSquare size={16} color="#6366f1" /> : <Square size={16} color="#94a3b8" />}
                  <strong style={{ color: 'var(--text-main)' }}>BL N° {bl.numero}</strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    ({bl.date_document ? new Date(bl.date_document).toLocaleDateString('fr-FR') : '—'})
                  </span>
                  {isCurrent && (
                    <span style={{ fontSize: '0.7rem', background: 'rgba(99,102,241,0.2)', color: '#818cf8', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                      Actuel
                    </span>
                  )}
                </div>
                <span style={{ fontWeight: 'bold', color: '#34d399' }}>
                  {parseFloat(bl.montant_ttc_final).toFixed(3)} TND
                </span>
              </div>
            );
          })}
        </div>
      )}

      <h4 style={{ fontSize: '0.95rem', margin: '0.5rem 0', color: '#f87171' }}>
        Bons de Retour
        <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          (les Retours actuellement liés sont pré-sélectionnés)
        </span>
      </h4>
      {availableRetours.length === 0 ? (
        <div style={{ padding: '1rem', background: 'var(--bg-primary)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Aucun Bon de Retour disponible.
        </div>
      ) : (
        <div style={{ maxHeight: '180px', overflowY: 'auto', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem', marginBottom: '1rem' }}>
          {availableRetours.map((r) => {
            const isChecked = selectedRetourIds.includes(r.id_retour);
            const isCurrent = currentBlIds && currentBlIds.length > 0 ? false : false; // Fix: just checking if current, we have currentRetIds in state? We didn't save currentRetIds in state, but we can just check facturation.retours
            const isCurrentRet = facturation.retours?.some(x => x.id_retour === r.id_retour);
            return (
              <div
                key={r.id_retour}
                onClick={() => toggleRetour(r.id_retour)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
                  background: isChecked ? 'rgba(248,113,113,0.08)' : 'transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isChecked ? <CheckSquare size={16} color="#f87171" /> : <Square size={16} color="#94a3b8" />}
                  <strong style={{ color: '#f87171' }}>Retour N° {r.numero}</strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({new Date(r.date_retour).toLocaleDateString('fr-FR')})</span>
                  {isCurrentRet && (
                    <span style={{ fontSize: '0.7rem', background: 'rgba(248,113,113,0.2)', color: '#f87171', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                      Actuel
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 'bold', color: '#f87171' }}>
                  -{parseFloat(r.montant_ttc).toFixed(3)} TND
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview totaux */}
      {preview.nbBls > 0 && (
        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.88rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {preview.nbBls} BL{preview.nbBls > 1 ? 's' : ''} · Brut TTC:
            <strong style={{ color: 'var(--text-main)', marginLeft: '0.3rem' }}>{preview.brut.toFixed(3)} TND</strong>
          </span>
          {parseFloat(remisePct) > 0 && (
            <span style={{ color: '#fbbf24' }}>
              Remise {remisePct}%: <strong>-{preview.remiseVal.toFixed(3)} TND</strong>
            </span>
          )}
          <span style={{ color: 'var(--text-muted)' }}>
            Timbre: <strong style={{ color: 'var(--text-main)' }}>{preview.timbre.toFixed(3)} TND</strong>
          </span>
          <span style={{ color: '#34d399', fontWeight: 'bold', fontSize: '1rem' }}>
            TOTAL NET TTC: {preview.net.toFixed(3)} TND
          </span>
        </div>
      )}

      <Modal
        isOpen={showNegativeWarning}
        onClose={() => setShowNegativeWarning(false)}
        title="Attention : Quantités Retournées Excédentaires"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowNegativeWarning(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={() => {
              setModeTraitementRetours('separer');
              setShowNegativeWarning(false);
              // Wait for state to update then submit
              setTimeout(() => {
                handleSave();
              }, 100);
            }}>
              Afficher Séparément et Enregistrer
            </button>
          </>
        }
      >
        <div style={{ padding: '1rem', background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b', borderRadius: '8px', color: '#fcd34d' }}>
          <h4 style={{ margin: '0 0 0.5rem 0' }}>Action Requise</h4>
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4' }}>
            Certains articles retournés dépassent les quantités facturées ou ne figurent pas dans les BL sélectionnés.
            <br /><br />
            Pour que la comptabilité soit correcte, nous devons afficher les BL en positif, et les Bons de Retour en négatif séparément à la fin de la facture. Voulez-vous procéder ainsi ?
          </p>
        </div>
      </Modal>
    </Modal>
  );
};