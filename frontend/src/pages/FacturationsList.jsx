import React, { useState, useEffect, useRef } from 'react';
import { toast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { EditFacturationModal } from '../components/common/EditFacturationModal';
import { DevisRapideModal } from '../components/common/DevisRapideModal';
import { FacturePrint } from '../components/print/FacturePrint';
import { exportFacturationToExcel } from '../utils/exportFacturationExcel';
import { generateFacturePdf } from '../utils/generateFacturePdf';
import { FileSpreadsheet, Plus, CheckSquare, Square, Eye, RefreshCw, Pencil, Trash2, Printer, FileDown, FileText } from 'lucide-react';
import { usePolling } from '../hooks/usePolling';

export const FacturationsList = () => {
  const [facturations, setFacturations] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Group Invoicing Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [availableBls, setAvailableBls] = useState([]);
  const [selectedBlIds, setSelectedBlIds] = useState([]);
  const [availableRetours, setAvailableRetours] = useState([]);
  const [selectedRetourIds, setSelectedRetourIds] = useState([]);
  const [modeTraitementRetours, setModeTraitementRetours] = useState('soustraction');
  const [showNegativeWarning, setShowNegativeWarning] = useState(false);
  const [periodeDebut, setPeriodeDebut] = useState('');
  const [periodeFin, setPeriodeFin] = useState('');

  // Detail Modal State
  const [selectedFactuation, setSelectedFacturation] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailBls, setDetailBls] = useState([]);
  const [loadingDetailBls, setLoadingDetailBls] = useState(false);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFacturation, setEditFacturation] = useState(null);

  // Devis Rapide Modal State
  const [showDevisModal, setShowDevisModal] = useState(false);

  // Print Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printFacturation, setPrintFacturation] = useState(null);
  const [enterprise, setEnterprise] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const printRef = useRef(null);

  const [error, setError] = useState('');

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [facts, cls, ent] = await Promise.all([
        api.getFacturations(),
        api.getClients(''),
        enterprise ? Promise.resolve(enterprise) : api.getEnterprise().catch(() => null)
      ]);
      setFacturations(facts);
      setClients(cls);
      if (ent) setEnterprise(ent);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  usePolling(fetchData, []);

  const handlePrint = (f) => {
    setPrintFacturation(f);
    setShowPrintModal(true);
  };

  const handleExportExcel = async (f) => {
    try {
      await exportFacturationToExcel(f, enterprise);
    } catch (err) {
      toast.error("Erreur lors de l'export Excel: " + err.message);
    }
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current || !printFacturation) return;
    try {
      setGeneratingPdf(true);
      await generateFacturePdf(printRef.current, `Facture_${printFacturation.numero_facture.replace(/\//g, '-')}.pdf`);
    } catch (err) {
      toast.error('Erreur lors de la génération du PDF: ' + err.message);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Fetch available BLs and Retours when client changes in create modal
  useEffect(() => {
    if (selectedClientId) {
      Promise.all([
        api.getDocuments('bon_livraison', selectedClientId, '', '', true),
        api.getRetours(selectedClientId)
      ]).then(([bls, retours]) => {
        setAvailableBls(bls);
        setSelectedBlIds(bls.map((b) => b.id_document)); // select all by default
        
        // Filter un-invoiced retours
        const uninvoicedRetours = retours.filter(r => !r.facture_dans_facturation);
        setAvailableRetours(uninvoicedRetours);
        setSelectedRetourIds(uninvoicedRetours.map((r) => r.id_retour)); // select all by default
      }).catch(() => {
        setAvailableBls([]);
        setAvailableRetours([]);
      });
    } else {
      setAvailableBls([]);
      setSelectedBlIds([]);
      setAvailableRetours([]);
      setSelectedRetourIds([]);
    }
  }, [selectedClientId]);

  const toggleBlSelection = (blId) => {
    if (selectedBlIds.includes(blId)) {
      setSelectedBlIds(selectedBlIds.filter((id) => id !== blId));
    } else {
      setSelectedBlIds([...selectedBlIds, blId]);
    }
  };

  const toggleRetourSelection = (retourId) => {
    if (selectedRetourIds.includes(retourId)) {
      setSelectedRetourIds(selectedRetourIds.filter((id) => id !== retourId));
    } else {
      setSelectedRetourIds([...selectedRetourIds, retourId]);
    }
  };

  const TIMBRE_DEFAUT = 1.000;

  // Preview merged aggregated lines
  const calculateMergedPreview = () => {
    const selectedBls = availableBls.filter((b) => selectedBlIds.includes(b.id_document));
    const selectedRetours = availableRetours.filter((r) => selectedRetourIds.includes(r.id_retour));
    const mergedMap = {};
    let hasNegatives = false;

    selectedBls.forEach((b) => {
      (b.lignes || []).forEach((l) => {
        const artId = l.id_article;
        const artName = l.article?.nom || `Art #${artId}`;
        const qty = parseFloat(l.quantite);
        const puApresRemiseTtc = parseFloat(l.prix_unitaire_apres_remise);
        const tvaPct = parseFloat(l.article?.taux_tva_vente || 19.0);

        const puHt = puApresRemiseTtc / (1 + tvaPct / 100);
        const lineHt = qty * puHt;
        const lineTtc = qty * puApresRemiseTtc;
        const lineTva = lineTtc - lineHt;

        if (!mergedMap[artId]) {
          mergedMap[artId] = {
            artName,
            quantiteTotale: 0,
            montantHt: 0,
            montantTva: 0,
            montantTtc: 0,
            tvaPct
          };
        }

        mergedMap[artId].quantiteTotale += qty;
        mergedMap[artId].montantHt += lineHt;
        mergedMap[artId].montantTva += lineTva;
        mergedMap[artId].montantTtc += lineTtc;
      });
    });

    if (modeTraitementRetours === 'soustraction') {
      selectedRetours.forEach((r) => {
        (r.lignes || []).forEach((l) => {
          const artId = l.id_article;
          const qty = parseFloat(l.quantite);
          const puTtc = parseFloat(l.prix_unitaire_ttc);
          const tvaPct = parseFloat(l.article?.taux_tva_vente || 19.0);

          const puHt = puTtc / (1 + tvaPct / 100);
          const lineHt = qty * puHt;
          const lineTtc = qty * puTtc;
          const lineTva = lineTtc - lineHt;

          if (!mergedMap[artId]) {
             hasNegatives = true;
          } else {
             mergedMap[artId].quantiteTotale -= qty;
             mergedMap[artId].montantHt -= lineHt;
             mergedMap[artId].montantTva -= lineTva;
             mergedMap[artId].montantTtc -= lineTtc;

             if (mergedMap[artId].quantiteTotale < 0) {
                 hasNegatives = true;
             }
          }
        });
      });
    }

    // Filter out 0 or negative qty_totale items from preview if soustraction
    const linesArray = Object.values(mergedMap).filter(item => item.quantiteTotale > 0);
    const totHt = linesArray.reduce((s, item) => s + item.montantHt, 0);
    const totTva = linesArray.reduce((s, item) => s + item.montantTva, 0);
    const totTimbre = TIMBRE_DEFAUT;
    const totTtc = linesArray.reduce((s, item) => s + item.montantTtc, 0) + totTimbre;

    return { linesArray, totHt, totTva, totTimbre, totTtc, hasNegatives };
  };

  const preview = calculateMergedPreview();

  const handleCreateFacturation = async () => {
    toast.error('');
    if (!selectedClientId) {
      toast.error('Veuillez sélectionner un client.');
      return;
    }
    if (selectedBlIds.length === 0) {
      toast.error('Veuillez sélectionner au moins un Bon de Livraison.');
      return;
    }

    if (modeTraitementRetours === 'soustraction' && preview.hasNegatives) {
      setShowNegativeWarning(true);
      return;
    }

    try {
      const newFact = await api.createFacturation({
        id_client: parseInt(selectedClientId),
        document_ids: selectedBlIds,
        retour_ids: selectedRetourIds,
        mode_traitement_retours: modeTraitementRetours,
        montant_timbre: TIMBRE_DEFAUT,
        periode_debut: periodeDebut || null,
        periode_fin: periodeFin || null
      });

      alert(`Facture Fiscale N\u00b0 ${newFact.numero_facture} g\u00e9n\u00e9r\u00e9e avec succ\u00e8s !`);
      setShowAddModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleOpenDetail = async (f) => {
    setSelectedFacturation(f);
    setShowDetailModal(true);
    setDetailBls([]);
    setLoadingDetailBls(true);
    try {
      const bls = await api.getFacturationBls(f.id_facturation);
      setDetailBls(bls);
    } catch {
      setDetailBls([]);
    } finally {
      setLoadingDetailBls(false);
    }
  };

  const handleDelete = async (f) => {
    if (!window.confirm(`Supprimer la facture N\u00b0 ${f.numero_facture} ? Les BLs li\u00e9s seront lib\u00e9r\u00e9s.`)) return;
    try {
      await api.deleteFacturation(f.id_facturation);
      fetchData();
    } catch (err) {
      alert(`Erreur: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Facturation Fiscale Groupée</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Regroupement de plusieurs Bons de Livraison en Factures Officiels (format 0001/26)</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline" onClick={() => setShowDevisModal(true)}>
            <FileText size={16} /> Devis Rapide
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> + Nouvelle Facture Groupée
          </button>
        </div>
      </div>

      <div className="glass-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>N° Facture</th>
                <th>Date</th>
                <th>Client</th>
                <th style={{ textAlign: 'right' }}>Total HT</th>
                <th style={{ textAlign: 'right' }}>TVA</th>
                <th style={{ textAlign: 'right' }}>Total TTC</th>
                <th style={{ textAlign: 'center' }}>Statut</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>Chargement des factures...</td></tr>
              ) : facturations.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Aucune facture fiscale groupée.</td></tr>
              ) : (
                facturations.map((f) => {
                  const client = clients.find((c) => c.id_client === f.id_client);
                  return (
                    <tr key={f.id_facturation}>
                      <td><strong style={{ color: 'white' }}>{f.numero_facture}</strong></td>
                      <td>{new Date(f.date_facturation).toLocaleDateString('fr-FR')}</td>
                      <td>{client ? `${client.nom} ${client.prenom || ''}` : `Client #${f.id_client}`}</td>
                      <td style={{ textAlign: 'right' }}>{parseFloat(f.montant_ht).toFixed(3)} TND</td>
                      <td style={{ textAlign: 'right' }}>{parseFloat(f.montant_tva).toFixed(3)} TND</td>
                      <td style={{ textAlign: 'right' }}>
                        {parseFloat(f.montant_retourne) > 0 ? (
                          <div style={{ fontSize: '0.85rem', lineHeight: '1.2' }}>
                            <div style={{ textDecoration: 'line-through', color: '#94a3b8' }}>
                              TTC: {parseFloat(f.montant_ttc).toFixed(3)}
                            </div>
                            <div style={{ color: '#f87171' }}>
                              Ret: -{parseFloat(f.montant_retourne).toFixed(3)}
                            </div>
                            <div style={{ fontWeight: 'bold', color: '#34d399' }}>
                              Net: {(parseFloat(f.montant_ttc) - parseFloat(f.montant_retourne)).toFixed(3)} TND
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontWeight: 'bold', color: '#34d399' }}>{parseFloat(f.montant_ttc).toFixed(3)} TND</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}><StatusBadge status={f.statut} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => handleOpenDetail(f)} title="Voir d\u00e9tail">
                            <Eye size={13} /> D\u00e9tail
                          </button>
                          <button className="btn btn-outline btn-sm" onClick={() => handlePrint(f)} title="Imprimer (format A4)">
                            <Printer size={13} />
                          </button>
                          <button className="btn btn-outline btn-sm" onClick={() => handleExportExcel(f)} title="Exporter en Excel">
                            <FileDown size={13} />
                          </button>
                          <button className="btn btn-outline btn-sm" onClick={() => { setEditFacturation(f); setShowEditModal(true); }} title="Modifier">
                            <Pencil size={13} />
                          </button>
                          <button className="btn btn-outline btn-sm" onClick={() => handleDelete(f)} title="Supprimer" style={{ color: '#f87171', borderColor: '#f87171' }}>
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

      {/* Group Facturation Creation Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Créer une Facture Fiscale Groupée"
        maxWidth="800px"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowAddModal(false)}>Annuler</button>
            <button id="submit-facture-btn" className="btn btn-primary" onClick={handleCreateFacturation}>Générer la Facture (Format 0001/26)</button>
          </>
        }
      >

        <div className="form-group">
          <label className="form-label">Client *</label>
          <select className="form-select" value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
            <option value="">-- Sélectionner le Client à Facturer --</option>
            {clients.map((c) => (
              <option key={c.id_client} value={c.id_client}>{c.nom} {c.prenom || ''} (Tél: {c.telephone || 'N/A'})</option>
            ))}
          </select>
        </div>

        {selectedClientId && (
          <>
            <h4 style={{ fontSize: '0.95rem', margin: '1rem 0 0.5rem 0' }}>Bons de Livraison Non Facturés</h4>
            {availableBls.length === 0 ? (
              <div style={{ padding: '1rem', background: '#0f172a', borderRadius: '6px', color: '#94a3b8', fontSize: '0.85rem' }}>
                Aucun Bon de Livraison en attente de facturation pour ce client.
              </div>
            ) : (
              <div style={{ maxHeight: '180px', overflowY: 'auto', background: '#0f172a', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem' }}>
                {availableBls.map((bl) => {
                  const isChecked = selectedBlIds.includes(bl.id_document);
                  return (
                    <div
                      key={bl.id_document}
                      onClick={() => toggleBlSelection(bl.id_document)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isChecked ? <CheckSquare size={16} color="#6366f1" /> : <Square size={16} color="#94a3b8" />}
                        <strong style={{ color: 'white' }}>BL N° {bl.numero}</strong>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>({new Date(bl.date_document).toLocaleDateString('fr-FR')})</span>
                      </div>
                      <div style={{ fontWeight: 'bold', color: '#34d399' }}>
                        {parseFloat(bl.montant_ttc_final).toFixed(3)} TND
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Uninvoiced Retours */}
            <h4 style={{ fontSize: '0.95rem', margin: '1rem 0 0.5rem 0', color: '#f87171' }}>Bons de Retour Non Facturés</h4>
            {availableRetours.length === 0 ? (
              <div style={{ padding: '1rem', background: '#0f172a', borderRadius: '6px', color: '#94a3b8', fontSize: '0.85rem' }}>
                Aucun Bon de Retour en attente de facturation pour ce client.
              </div>
            ) : (
              <div style={{ maxHeight: '180px', overflowY: 'auto', background: '#0f172a', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem' }}>
                {availableRetours.map((r) => {
                  const isChecked = selectedRetourIds.includes(r.id_retour);
                  return (
                    <div
                      key={r.id_retour}
                      onClick={() => toggleRetourSelection(r.id_retour)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {isChecked ? <CheckSquare size={16} color="#f87171" /> : <Square size={16} color="#94a3b8" />}
                        <strong style={{ color: '#f87171' }}>Retour N° {r.numero}</strong>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>({new Date(r.date_retour).toLocaleDateString('fr-FR')})</span>
                      </div>
                      <div style={{ fontWeight: 'bold', color: '#f87171' }}>
                        -{parseFloat(r.montant_ttc).toFixed(3)} TND
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Aggregated Lines Preview */}
            <h4 style={{ fontSize: '0.95rem', margin: '1.25rem 0 0.5rem 0' }}>Aperçu des Articles Fusionnés & Totaux Fiscaux</h4>
            <div className="table-responsive">
              <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th>Article</th>
                    <th style={{ textAlign: 'center' }}>Qté Totale</th>
                    <th style={{ textAlign: 'right' }}>Prix Moyen HT</th>
                    <th style={{ textAlign: 'right' }}>TVA %</th>
                    <th style={{ textAlign: 'right' }}>Montant HT</th>
                    <th style={{ textAlign: 'right' }}>Montant TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.linesArray.map((l, idx) => (
                    <tr key={idx}>
                      <td>{l.artName}</td>
                      <td style={{ textAlign: 'center' }}>{l.quantiteTotale}</td>
                      <td style={{ textAlign: 'right' }}>{(l.montantHt / l.quantiteTotale).toFixed(3)} TND</td>
                      <td style={{ textAlign: 'right' }}>{l.tvaPct}%</td>
                      <td style={{ textAlign: 'right' }}>{l.montantHt.toFixed(3)} TND</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{l.montantTtc.toFixed(3)} TND</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '8px', marginTop: '1rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span>Total HT: <strong>{preview.totHt.toFixed(3)} TND</strong></span>
              <span>TVA: <strong>{preview.totTva.toFixed(3)} TND</strong></span>
              <span>Timbre: <strong>{preview.totTimbre.toFixed(3)} TND</strong></span>
              <span style={{ color: '#34d399', fontWeight: 'bold' }}>TOTAL FACTURE TTC: {preview.totTtc.toFixed(3)} TND</span>
            </div>
          </>
        )}
      </Modal>

      {/* Facturation Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={`Facture Fiscale N\u00b0 ${selectedFactuation?.numero_facture}`}
        maxWidth="750px"
      >
        {selectedFactuation && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <div><strong>Client:</strong> {clients.find((c) => c.id_client === selectedFactuation.id_client)?.nom}</div>
              <div><strong>Date:</strong> {new Date(selectedFactuation.date_facturation).toLocaleString('fr-FR')}</div>
              <div><strong>Montant HT:</strong> {parseFloat(selectedFactuation.montant_ht).toFixed(3)} TND</div>
              <div><strong>Montant TVA:</strong> {parseFloat(selectedFactuation.montant_tva).toFixed(3)} TND</div>
              <div><strong>Timbre Fiscal:</strong> {parseFloat(selectedFactuation.montant_timbre ?? 1).toFixed(3)} TND</div>
              {parseFloat(selectedFactuation.remise_pct || 0) > 0 && (
                <div style={{ color: '#fbbf24' }}><strong>Remise:</strong> {parseFloat(selectedFactuation.remise_pct).toFixed(1)}%</div>
              )}
              <div style={{ gridColumn: 'span 2', fontSize: '1.1rem', color: '#34d399' }}>
                <strong>TOTAL FACTURE TTC: {parseFloat(selectedFactuation.montant_ttc).toFixed(3)} TND</strong>
              </div>
            </div>

            {/* BLs li\u00e9s */}
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#94a3b8' }}>Bons de Livraison group\u00e9s</h4>
            {loadingDetailBls ? (
              <div style={{ padding: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>Chargement...</div>
            ) : detailBls.length === 0 ? (
              <div style={{ padding: '0.5rem', color: '#64748b', fontSize: '0.85rem' }}>Aucun BL li\u00e9.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {detailBls.map((bl) => (
                  <div key={bl.id_document} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}>
                    <strong style={{ color: '#818cf8' }}>BL N\u00b0 {bl.numero}</strong>
                    <span style={{ color: '#94a3b8', marginLeft: '0.5rem' }}>
                      {bl.date_document ? new Date(bl.date_document).toLocaleDateString('fr-FR') : ''}
                    </span>
                    <span style={{ color: '#34d399', marginLeft: '0.5rem', fontWeight: '600' }}>
                      {parseFloat(bl.montant_ttc_final).toFixed(3)} TND
                    </span>
                  </div>
                ))}
              </div>
            )}

            {selectedFactuation.retours && selectedFactuation.retours.length > 0 && (
              <>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#f87171' }}>Bons de Retour groupés</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                  {selectedFactuation.retours.map((r) => (
                    <div key={r.id_retour} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}>
                      <strong style={{ color: '#f87171' }}>Retour N° {r.numero}</strong>
                      <span style={{ color: '#94a3b8', marginLeft: '0.5rem' }}>
                        {r.date_retour ? new Date(r.date_retour).toLocaleDateString('fr-FR') : ''}
                      </span>
                      <span style={{ color: '#f87171', marginLeft: '0.5rem', fontWeight: '600' }}>
                        -{parseFloat(r.montant_ttc).toFixed(3)} TND
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Lignes Agr\u00e9g\u00e9es De la Facture</h4>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Qt\u00e9 Totale</th>
                  <th style={{ textAlign: 'right' }}>P.U HT</th>
                  <th style={{ textAlign: 'right' }}>Total TTC</th>
                </tr>
              </thead>
              <tbody>
                {(selectedFactuation.lignes || []).map((l, i) => (
                  <tr key={i}>
                    <td>{l.article?.nom || `Art #${l.id_article}`}</td>
                    <td>{parseFloat(l.quantite_totale)}</td>
                    <td style={{ textAlign: 'right' }}>{parseFloat(l.prix_unitaire_moyen_ht).toFixed(3)} TND</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{parseFloat(l.montant_ttc).toFixed(3)} TND</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Edit Facturation Modal */}
      <EditFacturationModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        facturation={editFacturation}
        onUpdated={() => fetchData()}
      />

      {/* Devis Rapide (aperçu imprimable uniquement — rien n'est enregistré) */}
      <DevisRapideModal
        isOpen={showDevisModal}
        onClose={() => setShowDevisModal(false)}
      />
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
                const submitBtn = document.getElementById('submit-facture-btn');
                if (submitBtn) submitBtn.click();
              }, 100);
            }}>
              Afficher Séparément et Générer
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

      {/* Print Preview Modal (format papier A4) */}
      <Modal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title={`Impression Facture N° ${printFacturation?.numero_facture || ''}`}
        maxWidth="820px"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowPrintModal(false)}>Fermer</button>
            <button className="btn btn-outline" onClick={() => handleExportExcel(printFacturation)}>
              <FileDown size={16} /> Exporter Excel
            </button>
            <button className="btn btn-outline" onClick={handleDownloadPdf} disabled={generatingPdf}>
              <FileText size={16} /> {generatingPdf ? 'Génération...' : 'Télécharger PDF'}
            </button>
            <button className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={16} /> Imprimer
            </button>
          </>
        }
      >
        <div style={{ background: '#334155', padding: '1rem', borderRadius: '8px' }}>
          <FacturePrint ref={printRef} facturation={printFacturation} enterprise={enterprise} />
        </div>
      </Modal>
    </div>
  );
};