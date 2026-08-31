import React, { useState, useEffect } from 'react';
import { toast } from '../contexts/ToastContext';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { PaymentModal } from '../components/common/PaymentModal';
import { EditFacturationModal } from '../components/common/EditFacturationModal';
import { TicketPrint } from '../components/print/TicketPrint';
import { ReceiptPrint } from '../components/print/ReceiptPrint';
import { EditDocumentModal } from '../components/common/EditDocumentModal';
import { RetourDetailModal } from '../components/common/RetourDetailModal';
import { User, Phone, Mail, MapPin, CreditCard, DollarSign, Calendar, FileText, CheckCircle2, RotateCcw, Plus, ArrowLeft, FileSpreadsheet, Eye, Pencil, Trash2, CheckSquare, Square, Printer, Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ReglementDetailModal } from '../components/common/ReglementDetailModal';
import { EditClientModal } from '../components/common/EditClientModal';
import { usePolling } from '../hooks/usePolling';

export const ClientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [reglements, setReglements] = useState([]);
  const [relances, setRelances] = useState([]);
  const [retours, setRetours] = useState([]);
  const [facturations, setFacturations] = useState([]);
  const [showReglementPrint, setShowReglementPrint] = useState(false);
  const [printedReglement, setPrintedReglement] = useState(null);
  const [printedReglementDoc, setPrintedReglementDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activeSubTab, setActiveSubTab] = useState('documents');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Facturation modals
  const [selectedReglement, setSelectedReglement] = useState(null);
  const [showFactDetail, setShowFactDetail] = useState(false);
  const [showFactEdit, setShowFactEdit] = useState(false);
  const [selectedFact, setSelectedFact] = useState(null);
  const [detailBls, setDetailBls] = useState([]);
  const [loadingDetailBls, setLoadingDetailBls] = useState(false);

  // Payment on specific document or facturation
  const [showDocPayment, setShowDocPayment] = useState(false);
  const [selectedDocForPayment, setSelectedDocForPayment] = useState(null);

  // Group Facturation Modal
  const [showAddFacturation, setShowAddFacturation] = useState(false);
  const [availableBls, setAvailableBls] = useState([]);
  const [selectedBlIds, setSelectedBlIds] = useState([]);
  const [availableRetours, setAvailableRetours] = useState([]);
  const [selectedRetourIds, setSelectedRetourIds] = useState([]);
  const [modeTraitementRetours, setModeTraitementRetours] = useState('soustraction');
  const [showNegativeWarning, setShowNegativeWarning] = useState(false);
  const [periodeDebut, setPeriodeDebut] = useState('');
  const [periodeFin, setPeriodeFin] = useState('');
  const [facturationError, setFacturationError] = useState('');

  // Detail / Print / Edit Modal State for Documents
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedDocFull, setSelectedDocFull] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Retour Detail State
  const [showRetourDetail, setShowRetourDetail] = useState(false);
  const [selectedRetourId, setSelectedRetourId] = useState(null);

  // Edit Client State
  const [showEditClient, setShowEditClient] = useState(false);

  // Date filter for extrait
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  const filterByDateRange = (items, dateField) => {
    return items.filter((item) => {
      const d = new Date(item[dateField]);
      if (isNaN(d)) return true;
      const dayOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (dateDebut) {
        const debut = new Date(dateDebut);
        if (dayOnly < debut) return false;
      }
      if (dateFin) {
        const fin = new Date(dateFin);
        if (dayOnly > fin) return false;
      }
      return true;
    });
  };

  const filteredDocuments = filterByDateRange(documents, 'date_document');
  const filteredReglements = filterByDateRange(reglements, 'date_reglement');
  const filteredRetours = filterByDateRange(retours, 'date_retour');

  const DateFilterBar = ({ label }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
      marginBottom: '1rem', padding: '0.65rem 1rem',
      background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
      borderRadius: '10px', fontSize: '0.85rem'
    }}>
      <span style={{ color: '#818cf8', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Calendar size={14} /> Extrait par date :
      </span>
      <label style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        Du
        <input
          type="date"
          value={dateDebut}
          onChange={(e) => setDateDebut(e.target.value)}
          style={{
            background: '#0f172a', border: '1px solid rgba(99,102,241,0.4)',
            color: 'white', borderRadius: '6px', padding: '0.25rem 0.5rem',
            fontSize: '0.82rem', cursor: 'pointer'
          }}
        />
      </label>
      <label style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        Au
        <input
          type="date"
          value={dateFin}
          onChange={(e) => setDateFin(e.target.value)}
          style={{
            background: '#0f172a', border: '1px solid rgba(99,102,241,0.4)',
            color: 'white', borderRadius: '6px', padding: '0.25rem 0.5rem',
            fontSize: '0.82rem', cursor: 'pointer'
          }}
        />
      </label>
      {(dateDebut || dateFin) && (
        <button
          className="btn btn-outline btn-sm"
          onClick={() => { setDateDebut(''); setDateFin(''); }}
          style={{ padding: '0.2rem 0.6rem', fontSize: '0.78rem', color: '#f87171', borderColor: '#f87171' }}
        >
          ✕ Réinitialiser
        </button>
      )}
      {(dateDebut || dateFin) && (
        <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: '0.78rem' }}>
          {label}
        </span>
      )}
    </div>
  );

  const openDetailOrPrint = async (doc, mode) => {
    setSelectedDoc(doc);
    setSelectedDocFull(null);
    if (mode === 'detail') setShowDetailModal(true);
    else setShowPrintModal(true);
    try {
      const full = await api.getDocument(doc.id_document);
      setSelectedDocFull(full);
    } catch (e) {
      setSelectedDocFull(doc);
    }
  };

  const fetchClientData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const c = await api.getClient(id);
      setClient(c);

      const [docs, regs, rels, rets, facts] = await Promise.all([
        api.getDocuments('', id),
        api.getClientPayments(id),
        api.getRelances(id),
        api.getRetours(id),
        api.getFacturations(id)
      ]);

      setDocuments(docs);
      setReglements(regs);
      setRelances(rels);
      setRetours(rets);
      setFacturations(facts);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  usePolling(fetchClientData, [id]);

  useEffect(() => {
    if (showAddFacturation && id) {
      Promise.all([
        api.getDocuments('bon_livraison', id, '', '', true),
        api.getRetours(id)
      ]).then(([bls, rets]) => {
        setAvailableBls(bls);
        setSelectedBlIds(bls.map((b) => b.id_document));
        
        const uninvoicedRetours = rets.filter(r => !r.facture_dans_facturation);
        setAvailableRetours(uninvoicedRetours);
        setSelectedRetourIds(uninvoicedRetours.map((r) => r.id_retour));
      }).catch(() => {
        setAvailableBls([]);
        setAvailableRetours([]);
      });
    }
  }, [showAddFacturation, id]);

  const toggleBlSelection = (blId) => {
    if (selectedBlIds.includes(blId)) {
      setSelectedBlIds(selectedBlIds.filter((bid) => bid !== blId));
    } else {
      setSelectedBlIds([...selectedBlIds, blId]);
    }
  };

  const toggleRetourSelection = (retourId) => {
    if (selectedRetourIds.includes(retourId)) {
      setSelectedRetourIds(selectedRetourIds.filter((bid) => bid !== retourId));
    } else {
      setSelectedRetourIds([...selectedRetourIds, retourId]);
    }
  };

  const calculateMergedPreview = () => {
    const selectedBls = availableBls.filter((b) => selectedBlIds.includes(b.id_document));
    const selectedRets = availableRetours.filter((r) => selectedRetourIds.includes(r.id_retour));
    const mergedMap = {};
    let hasNegatives = false;

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
          if (!mergedMap[artId]) {
            hasNegatives = true;
          } else {
            mergedMap[artId] -= qty;
            if (mergedMap[artId] < 0) hasNegatives = true;
          }
        });
      });
    }

    return hasNegatives;
  };

  const handleCreateFacturation = async () => {
    setFacturationError('');
    if (selectedBlIds.length === 0) {
      setFacturationError('Veuillez sélectionner au moins un Bon de Livraison.');
      return;
    }

    const hasNegatives = calculateMergedPreview();
    if (modeTraitementRetours === 'soustraction' && hasNegatives) {
      setShowNegativeWarning(true);
      return;
    }

    try {
      await api.createFacturation({
        id_client: parseInt(id),
        document_ids: selectedBlIds,
        retour_ids: selectedRetourIds,
        mode_traitement_retours: modeTraitementRetours,
        periode_debut: periodeDebut || null,
        periode_fin: periodeFin || null
      });
      setShowAddFacturation(false);
      fetchClientData();
    } catch (err) {
      setFacturationError(err.message);
    }
  };

  const handleCompleteRelance = async (relanceId) => {
    try {
      await api.updateRelance(relanceId, { statut: 'effectuee', notes: 'Relance effectuée par le vendeur.' });
      alert('Relance marquée comme effectuée ! La relance suivante a été programmée automatiquement.');
      fetchClientData();
    } catch (err) {
      alert(`Erreur: ${err.message}`);
    }
  };

  const handleOpenFactDetail = async (f) => {
    setSelectedFact(f);
    setShowFactDetail(true);
    setDetailBls([]);
    setLoadingDetailBls(true);
    try {
      const bls = await api.getFacturationBls(f.id_facturation);
      setDetailBls(bls);
    } catch { setDetailBls([]); }
    finally { setLoadingDetailBls(false); }
  };

  const handleDeleteFact = async (f) => {
    if (!window.confirm(`Supprimer la facture N° ${f.numero_facture} ? Les BLs liés seront libérés.`)) return;
    try {
      await api.deleteFacturation(f.id_facturation);
      fetchClientData();
    } catch (err) { alert(`Erreur: ${err.message}`); }
  };

  if (loading || !client) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement de la fiche client...</div>;
  }

  const solde = parseFloat(client.solde_compte);
  const isOwing = solde < 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Navigation */}
      <button className="btn btn-outline btn-sm" onClick={() => navigate('/clients')} style={{ alignSelf: 'flex-start' }}>
        <ArrowLeft size={16} /> Retour à la liste des clients
      </button>

      {/* Header Info Card */}
      <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0 }}>
              {client.nom} {client.prenom || ''}
            </h2>
            <span className={`badge ${client.type_client === 'societe' ? 'badge-info' : 'badge-secondary'}`}>
              {client.type_client === 'societe' ? 'Société' : 'Physique'}
            </span>
            <button className="btn btn-outline btn-sm" onClick={() => setShowEditClient(true)} title="Modifier le client" style={{ padding: '0.3rem 0.5rem', marginLeft: '0.5rem' }}>
              <Pencil size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', color: '#94a3b8', fontSize: '0.875rem' }}>
            {client.telephone && <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Phone size={14} /> {client.telephone}</span>}
            {client.email && <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Mail size={14} /> {client.email}</span>}
            {client.matricule_fiscal && <span>MF: <strong>{client.matricule_fiscal}</strong></span>}
            {client.adresse && <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><MapPin size={14} /> {client.adresse}</span>}
          </div>
        </div>

        {/* Balance Card */}
        <div style={{ background: isOwing ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', border: '1px solid', borderColor: isOwing ? '#ef4444' : '#10b981', borderRadius: '12px', padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: isOwing ? '#f87171' : '#34d399', fontWeight: '600' }}>
            Solde Courant du Compte
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '900', color: isOwing ? '#f87171' : '#34d399', margin: '0.25rem 0' }}>
            {solde.toFixed(3)} TND
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Plafond Crédit: {parseFloat(client.plafond_credit).toFixed(3)} TND | Délai Relance: {client.delai_relance_jours} jours
          </div>
        </div>
      </div>

      {/* Sub-Tabs Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeSubTab === 'documents' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('documents')}
        >
          <FileText size={16} /> Documents ({filteredDocuments.length}{filteredDocuments.length !== documents.length ? `/${documents.length}` : ''})
        </button>
        <button
          className={`btn ${activeSubTab === 'reglements' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('reglements')}
        >
          <CreditCard size={16} /> Règlements ({filteredReglements.length}{filteredReglements.length !== reglements.length ? `/${reglements.length}` : ''})
        </button>
        <button
          className={`btn ${activeSubTab === 'relances' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('relances')}
        >
          <Calendar size={16} /> Relances Crédit ({relances.length})
        </button>
        <button
          className={`btn ${activeSubTab === 'retours' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('retours')}
        >
          <RotateCcw size={16} /> Bons de Retour ({filteredRetours.length}{filteredRetours.length !== retours.length ? `/${retours.length}` : ''})
        </button>
        <button
          className={`btn ${activeSubTab === 'facturations' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('facturations')}
        >
          <FileSpreadsheet size={16} /> Facturations ({facturations.length})
        </button>
        <button
          className={`btn ${activeSubTab === 'journal' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('journal')}
          style={activeSubTab === 'journal' ? {} : { background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.4)', color: '#34d399' }}
        >
          <Activity size={16} /> Journal Complet
        </button>
      </div>

      {/* Sub-Tab Content */}
      <div className="glass-card">
        {/* 1. Documents Tab */}
        {activeSubTab === 'documents' && (
          <div>
            <DateFilterBar label={`${filteredDocuments.length} document(s) affiché(s)`} />
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Numéro</th>
                    <th>Date &amp; Heure</th>
                    <th style={{ textAlign: 'right' }}>Total TTC</th>
                    <th style={{ textAlign: 'right' }}>Reste à Payer</th>
                    <th style={{ textAlign: 'center' }}>Statut</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      {documents.length === 0 ? 'Aucun document pour ce client.' : 'Aucun document dans cette période.'}
                    </td></tr>
                  ) : (
                    filteredDocuments.map((d) => {
                      const restant = parseFloat(d.montant_restant);
                      const isPaid = restant <= 0 || d.statut === 'paye';
                      const dateDoc = new Date(d.date_document);
                      return (
                        <tr key={d.id_document}>
                          <td><StatusBadge status={d.type_document} /></td>
                          <td><strong style={{ color: 'white' }}>{d.numero}</strong></td>
                          <td>
                            <div style={{ lineHeight: '1.3' }}>
                              <div style={{ fontWeight: '500' }}>{dateDoc.toLocaleDateString('fr-FR')}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{dateDoc.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {parseFloat(d.montant_retourne) > 0 ? (
                              <div style={{ fontSize: '0.85rem', lineHeight: '1.2' }}>
                                <div style={{ textDecoration: 'line-through', color: '#94a3b8' }}>
                                  TTC: {parseFloat(d.montant_ttc_final).toFixed(3)}
                                </div>
                                <div style={{ color: '#f87171' }}>
                                  Ret: -{parseFloat(d.montant_retourne).toFixed(3)}
                                </div>
                                <div style={{ fontWeight: 'bold' }}>
                                  Net: {(parseFloat(d.montant_ttc_final) - parseFloat(d.montant_retourne)).toFixed(3)} TND
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontWeight: 'bold' }}>{parseFloat(d.montant_ttc_final).toFixed(3)} TND</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', color: restant > 0 ? '#fbbf24' : '#94a3b8' }}>{restant.toFixed(3)} TND</td>
                          <td style={{ textAlign: 'center' }}><StatusBadge status={d.statut} /></td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem', alignItems: 'center' }}>
                              <button className="btn btn-outline btn-sm" title="Voir détail" onClick={() => openDetailOrPrint(d, 'detail')}>
                                <Eye size={14} />
                              </button>
                              <button className="btn btn-outline btn-sm" title="Imprimer ticket" onClick={() => openDetailOrPrint(d, 'print')}>
                                <Printer size={14} />
                              </button>
                              {d.statut !== 'annule' && (
                                <button className="btn btn-outline btn-sm" title="Modifier le document" onClick={() => { setEditDoc(d); setShowEditModal(true); }} style={{ color: '#38bdf8', borderColor: '#38bdf8' }}>
                                  <Pencil size={14} />
                                </button>
                              )}
                              {isPaid && (
                                <span style={{ color: '#34d399', fontSize: '0.8rem', marginLeft: '0.5rem' }}>✔ Payé</span>
                              )}
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
        )}

        {/* 2. Règlements Tab */}
        {activeSubTab === 'reglements' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0 }}>Historique des Paiements Client</h4>
              <button className="btn btn-success btn-sm" onClick={() => setShowPaymentModal(true)}>
                <Plus size={14} /> + Nouveau Règlement
              </button>
            </div>

            <DateFilterBar label={`${filteredReglements.length} règlement(s) affiché(s)`} />

            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>N° Règlement</th>
                    <th>Date &amp; Heure</th>
                    <th>Mode</th>
                    <th>Référence</th>
                    <th>Échéance</th>
                    <th style={{ textAlign: 'right' }}>Montant</th>
                    <th style={{ textAlign: 'center' }}>Statut Chèque</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReglements.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      {reglements.length === 0 ? 'Aucun règlement enregistré.' : 'Aucun règlement dans cette période.'}
                    </td></tr>
                  ) : (
                    filteredReglements.map((r) => {
                      const dateReg = new Date(r.date_reglement);
                      return (
                        <tr 
                          key={r.id_reglement}
                          onClick={() => setSelectedReglement(r)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td><strong style={{ color: 'white' }}>{r.numero}</strong></td>
                          <td>
                            <div style={{ lineHeight: '1.3' }}>
                              <div style={{ fontWeight: '500' }}>{dateReg.toLocaleDateString('fr-FR')}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{dateReg.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          </td>
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
            
            <ReglementDetailModal 
              isOpen={!!selectedReglement}
              onClose={() => setSelectedReglement(null)}
              reglement={selectedReglement}
              client={client}
              clientName={`${client.nom} ${client.prenom || ''}`}
            />
          </div>
        )}

        {/* 3. Relances Crédit Tab */}
        {activeSubTab === 'relances' && (
          <div>
            <h4 style={{ marginBottom: '1rem' }}>Planification & Historique des Relances Crédit</h4>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Date Planifiée</th>
                    <th>Délai (Jours)</th>
                    <th>Solde Snapshot</th>
                    <th>Canal Prévu</th>
                    <th>Statut</th>
                    <th>Date Exécution</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {relances.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Aucune relance crédit enregistrée.</td></tr>
                  ) : (
                    relances.map((rel) => (
                      <tr key={rel.id_relance}>
                        <td><strong style={{ color: 'white' }}>{new Date(rel.date_planifiee).toLocaleDateString('fr-FR')}</strong></td>
                        <td>{rel.delai_jours_utilise} j</td>
                        <td>{rel.solde_au_moment ? `${parseFloat(rel.solde_au_moment).toFixed(3)} TND` : 'N/A'}</td>
                        <td><span style={{ textTransform: 'capitalize' }}>{rel.canal_prevu}</span></td>
                        <td><StatusBadge status={rel.statut} /></td>
                        <td>{rel.date_execution ? new Date(rel.date_execution).toLocaleDateString('fr-FR') : '-'}</td>
                        <td style={{ textAlign: 'right' }}>
                          {rel.statut === 'planifiee' && (
                            <button className="btn btn-success btn-sm" onClick={() => handleCompleteRelance(rel.id_relance)}>
                              <CheckCircle2 size={14} /> Marquer Effectuée
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. Bons de Retour Tab */}
        {activeSubTab === 'retours' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h4 style={{ margin: 0 }}>Historique des Bons de Retour</h4>
            </div>
            <DateFilterBar label={`${filteredRetours.length} retour(s) affiché(s)`} />
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>N° Retour</th>
                    <th>Date &amp; Heure</th>
                    <th>Motif</th>
                    <th style={{ textAlign: 'right' }}>Montant Total TTC</th>
                    <th style={{ textAlign: 'center' }}>Statut</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRetours.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                      {retours.length === 0 ? 'Aucun bon de retour pour ce client.' : 'Aucun bon de retour dans cette période.'}
                    </td></tr>
                  ) : (
                    filteredRetours.map((ret) => {
                      const dateRet = new Date(ret.date_retour);
                      return (
                        <tr key={ret.id_retour}>
                          <td><strong style={{ color: 'white' }}>{ret.numero}</strong></td>
                          <td>
                            <div style={{ lineHeight: '1.3' }}>
                              <div style={{ fontWeight: '500' }}>{dateRet.toLocaleDateString('fr-FR')}</div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{dateRet.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          </td>
                          <td>{ret.motif || 'N/A'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#f87171' }}>{parseFloat(ret.montant_ttc).toFixed(3)} TND</td>
                          <td style={{ textAlign: 'center' }}><StatusBadge status={ret.statut} /></td>
                          <td style={{ textAlign: 'right' }}>
                            <button 
                              className="btn btn-outline btn-sm" 
                              onClick={() => { setSelectedRetourId(ret.id_retour); setShowRetourDetail(true); }} 
                              title="Voir détail"
                            >
                              <Eye size={14} />
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
        )}

        {/* Journal d'Activité Tab */}
        {activeSubTab === 'journal' && (() => {
          // Build unified timeline
          const allEvents = [
            ...documents.map(d => ({
              _type: 'document',
              _date: new Date(d.date_document),
              _id: `doc-${d.id_document}`,
              data: d
            })),
            ...reglements.map(r => ({
              _type: 'reglement',
              _date: new Date(r.date_reglement),
              _id: `reg-${r.id_reglement}`,
              data: r
            })),
            ...retours.map(r => ({
              _type: 'retour',
              _date: new Date(r.date_retour),
              _id: `ret-${r.id_retour}`,
              data: r
            }))
          ].sort((a, b) => b._date - a._date);

          const filteredEvents = allEvents.filter(ev => {
            const day = new Date(ev._date.getFullYear(), ev._date.getMonth(), ev._date.getDate());
            if (dateDebut) { const d = new Date(dateDebut); if (day < d) return false; }
            if (dateFin) { const d = new Date(dateFin); if (day > d) return false; }
            return true;
          });

          const totalDebits = filteredEvents
            .filter(e => e._type === 'document' && e.data.type_document !== 'devis')
            .reduce((s, e) => s + parseFloat(e.data.montant_ttc_final || 0), 0);
          const totalCredits = filteredEvents
            .filter(e => e._type === 'reglement')
            .reduce((s, e) => s + parseFloat(e.data.montant || 0), 0);
          const totalRetours = filteredEvents
            .filter(e => e._type === 'retour')
            .reduce((s, e) => s + parseFloat(e.data.montant_ttc || 0), 0);

          const typeConfig = {
            bon_livraison:   { label: 'Bon de Livraison', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)',   icon: <FileText size={14} /> },
            facture_rapide:  { label: 'Facture Rapide',   color: '#818cf8', bg: 'rgba(129,140,248,0.1)', icon: <FileText size={14} /> },
            devis:           { label: 'Devis',            color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: <FileText size={14} /> },
            reglement:       { label: 'Règlement',        color: '#34d399', bg: 'rgba(52,211,153,0.1)',  icon: <CreditCard size={14} /> },
            retour:          { label: 'Bon de Retour',    color: '#f87171', bg: 'rgba(248,113,113,0.1)', icon: <RotateCcw size={14} /> },
          };

          return (
            <div>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#f87171', fontWeight: '700', letterSpacing: '0.05em', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <TrendingUp size={12} /> Total Ventes (TTC)
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#f87171' }}>
                    {totalDebits.toFixed(3)} TND
                  </div>
                </div>
                <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#34d399', fontWeight: '700', letterSpacing: '0.05em', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <TrendingDown size={12} /> Total Encaissé
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#34d399' }}>
                    {totalCredits.toFixed(3)} TND
                  </div>
                </div>
                <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#fbbf24', fontWeight: '700', letterSpacing: '0.05em', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Minus size={12} /> Total Retours
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#fbbf24' }}>
                    {totalRetours.toFixed(3)} TND
                  </div>
                </div>
              </div>

              <DateFilterBar label={`${filteredEvents.length} événement(s) affiché(s)`} />

              {filteredEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  <Activity size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                  <div>{allEvents.length === 0 ? 'Aucune activité pour ce client.' : 'Aucune activité dans cette période.'}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {filteredEvents.map((ev, idx) => {
                    const isDoc = ev._type === 'document';
                    const isReg = ev._type === 'reglement';
                    const isRet = ev._type === 'retour';
                    const docType = isDoc ? ev.data.type_document : ev._type;

                    // Dynamic config for retour based on mode_remboursement
                    const retourCfg = isRet
                      ? (ev.data.mode_remboursement === 'credit'
                          ? { label: 'Retour — Crédit Compte', color: '#f97316', bg: 'rgba(249,115,22,0.1)', icon: <RotateCcw size={14} /> }
                          : { label: 'Retour — Espèces', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', icon: <RotateCcw size={14} /> })
                      : null;

                    const cfg = isRet ? retourCfg : (typeConfig[docType] || typeConfig.bon_livraison);

                    const dateStr = ev._date.toLocaleDateString('fr-FR');
                    const timeStr = ev._date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                    let montant = 0;
                    let montantLabel = '';
                    let montantColor = '#94a3b8';
                    let montantSign = '';
                    let ref = '';
                    let statut = null;
                    let detail = '';

                    if (isDoc) {
                      montant = parseFloat(ev.data.montant_ttc_final || 0);
                      montantColor = docType === 'devis' ? '#94a3b8' : '#f87171';
                      montantSign = docType !== 'devis' ? '-' : '';
                      montantLabel = 'TTC';
                      ref = ev.data.numero;
                      statut = ev.data.statut;
                      const restant = parseFloat(ev.data.montant_restant || 0);
                      detail = restant > 0 ? `Reste: ${restant.toFixed(3)} TND` : 'Soldé ✓';
                    } else if (isReg) {
                      montant = parseFloat(ev.data.montant || 0);
                      montantColor = '#34d399';
                      montantSign = '+';
                      montantLabel = ev.data.mode_paiement;
                      ref = ev.data.numero;
                      detail = ev.data.reference_paiement ? `Réf: ${ev.data.reference_paiement}` : '';
                    } else if (isRet) {
                      montant = parseFloat(ev.data.montant_ttc || 0);
                      const isCreditCompte = ev.data.mode_remboursement === 'credit';
                      montantColor = isCreditCompte ? '#f97316' : '#fbbf24';
                      montantSign = isCreditCompte ? '+' : '↩';
                      montantLabel = isCreditCompte ? 'Crédit Compte' : 'Espèces';
                      ref = ev.data.numero;
                      detail = ev.data.motif || '';
                    }

                    const isFirst = idx === 0;
                    const isLast = idx === filteredEvents.length - 1;

                    return (
                      <div key={ev._id} style={{ display: 'flex', gap: '0', position: 'relative' }}>
                        {/* Timeline line */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '36px', flexShrink: 0 }}>
                          <div style={{
                            width: '2px',
                            height: isFirst ? '50%' : '100%',
                            background: 'rgba(99,102,241,0.25)',
                            marginTop: isFirst ? 'auto' : '0',
                            flexShrink: 0,
                            alignSelf: 'center'
                          }} />
                          <div style={{
                            width: '30px', height: '30px', borderRadius: '50%',
                            background: cfg.bg, border: `2px solid ${cfg.color}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: cfg.color, flexShrink: 0, zIndex: 1
                          }}>
                            {cfg.icon}
                          </div>
                          <div style={{
                            width: '2px',
                            flex: 1,
                            background: isLast ? 'transparent' : 'rgba(99,102,241,0.25)',
                            flexShrink: 0,
                            alignSelf: 'center'
                          }} />
                        </div>

                        {/* Event card */}
                        <div style={{
                          flex: 1, margin: '4px 0 4px 10px',
                          background: 'rgba(15,23,42,0.6)', border: `1px solid ${cfg.color}22`,
                          borderRadius: '10px', padding: '0.65rem 1rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: '1rem', cursor: isDoc || isReg ? 'pointer' : 'default',
                          transition: 'background 0.15s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = `${cfg.bg}`}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(15,23,42,0.6)'}
                          onClick={() => {
                            if (isDoc) openDetailOrPrint(ev.data, 'detail');
                            else if (isReg) setSelectedReglement(ev.data);
                            else if (isRet) { setSelectedRetourId(ev.data.id_retour); setShowRetourDetail(true); }
                          }}
                        >
                          {/* Left: type + ref */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                            <span style={{
                              fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase',
                              color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}44`,
                              borderRadius: '5px', padding: '0.15rem 0.45rem', whiteSpace: 'nowrap', flexShrink: 0
                            }}>
                              {cfg.label}
                            </span>
                            <strong style={{ color: 'white', fontSize: '0.88rem', whiteSpace: 'nowrap' }}>{ref}</strong>
                            {detail && (
                              <span style={{ color: '#64748b', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {detail}
                              </span>
                            )}
                          </div>

                          {/* Right: date + amount */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
                            <div style={{ textAlign: 'right', color: '#64748b', fontSize: '0.75rem', lineHeight: '1.3' }}>
                              <div style={{ color: '#94a3b8', fontWeight: '500' }}>{dateStr}</div>
                              <div>{timeStr}</div>
                            </div>
                            <div style={{ textAlign: 'right', minWidth: '110px' }}>
                              <div style={{ fontSize: '0.95rem', fontWeight: '800', color: montantColor }}>
                                {montantSign} {montant.toFixed(3)} TND
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#475569', textTransform: 'capitalize' }}>{montantLabel}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Onglet Facturations */}
        {activeSubTab === 'facturations' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0 }}>Facturations Fiscales Groupées</h4>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddFacturation(true)}>
                <Plus size={14} /> Créer une Facturation Groupée
              </button>
            </div>
            {facturations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                Aucune facturation fiscale pour ce client.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>N° Facture</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Montant HT</th>
                      <th style={{ textAlign: 'right' }}>TVA</th>
                      <th style={{ textAlign: 'right' }}>Total TTC</th>
                      <th style={{ textAlign: 'center' }}>Remise</th>
                      <th style={{ textAlign: 'right' }}>Reste à Payer</th>
                      <th style={{ textAlign: 'center' }}>Statut</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturations.map((f) => {
                      const remisePct = parseFloat(f.remise_pct || 0);
                      return (
                        <tr key={f.id_facturation}>
                          <td><strong style={{ color: '#818cf8' }}>{f.numero_facture}</strong></td>
                          <td>{new Date(f.date_facturation).toLocaleDateString('fr-FR')}</td>
                          <td style={{ textAlign: 'right' }}>{parseFloat(f.montant_ht).toFixed(3)} TND</td>
                          <td style={{ textAlign: 'right', color: '#94a3b8' }}>{parseFloat(f.montant_tva).toFixed(3)} TND</td>
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
                          <td style={{ textAlign: 'center', color: remisePct > 0 ? '#fbbf24' : '#64748b' }}>
                            {remisePct > 0 ? `${remisePct.toFixed(1)}%` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', color: parseFloat(f.montant_restant) > 0 ? '#fbbf24' : '#94a3b8' }}>
                            {parseFloat(f.montant_restant).toFixed(3)} TND
                          </td>
                          <td style={{ textAlign: 'center' }}><StatusBadge status={f.statut} /></td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'flex-end' }}>
                              <button className="btn btn-outline btn-sm" onClick={() => handleOpenFactDetail(f)} title="Voir détail">
                                <Eye size={13} /> Voir
                              </button>
                              <button className="btn btn-outline btn-sm" onClick={() => { setSelectedFact(f); setShowFactEdit(true); }} title="Modifier">
                                <Pencil size={13} />
                              </button>
                              <button className="btn btn-outline btn-sm" onClick={() => handleDeleteFact(f)} title="Supprimer" style={{ color: '#f87171', borderColor: '#f87171' }}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border-color)' }}>
                      <td colSpan={4} style={{ fontWeight: '700', color: '#94a3b8', paddingTop: '0.5rem' }}>
                        TOTAL ({facturations.length} facture{facturations.length > 1 ? 's' : ''})
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '900', color: '#34d399', fontSize: '1rem', paddingTop: '0.5rem' }}>
                        {facturations.reduce((s, f) => s + parseFloat(f.montant_ttc), 0).toFixed(3)} TND
                      </td>
                      <td />
                      <td style={{ textAlign: 'right', fontWeight: '700', color: '#fbbf24', paddingTop: '0.5rem' }}>
                        {facturations.reduce((s, f) => s + parseFloat(f.montant_restant), 0).toFixed(3)} TND
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        document={{ id_client: client.id_client, id_document: null, numero: 'Avance / Compte Client', montant_ttc_final: 0, montant_restant: Math.abs(solde) }}
        onPaymentCompleted={(reglement) => {
          fetchClientData();
          if (reglement) {
            setPrintedReglement(reglement);
            setPrintedReglementDoc(null);
            setShowReglementPrint(true);
          }
        }}
      />

      {/* Facturation Detail Modal */}
      <Modal
        isOpen={showFactDetail}
        onClose={() => setShowFactDetail(false)}
        title={`Facture N° ${selectedFact?.numero_facture}`}
        maxWidth="750px"
      >
        {selectedFact && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <div><strong>Date :</strong> {new Date(selectedFact.date_facturation).toLocaleString('fr-FR')}</div>
              <div><strong>Statut :</strong> <StatusBadge status={selectedFact.statut} /></div>
              <div><strong>Montant HT :</strong> {parseFloat(selectedFact.montant_ht).toFixed(3)} TND</div>
              <div><strong>TVA :</strong> {parseFloat(selectedFact.montant_tva).toFixed(3)} TND</div>
              {parseFloat(selectedFact.remise_pct || 0) > 0 && (
                <div style={{ color: '#fbbf24' }}><strong>Remise :</strong> {parseFloat(selectedFact.remise_pct).toFixed(1)}%</div>
              )}
              <div style={{ gridColumn: 'span 2', fontSize: '1.05rem', color: '#34d399', fontWeight: '700' }}>
                TOTAL TTC : {parseFloat(selectedFact.montant_ttc).toFixed(3)} TND
              </div>
            </div>

            <h4 style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Bons de Livraison groupés</h4>
            {loadingDetailBls ? (
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>Chargement...</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                {detailBls.length === 0 ? (
                  <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Aucun BL lié.</span>
                ) : detailBls.map((bl) => (
                  <div key={bl.id_document} style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}>
                    <strong style={{ color: '#818cf8' }}>BL N° {bl.numero}</strong>
                    <span style={{ color: '#94a3b8', marginLeft: '0.4rem' }}>{bl.date_document ? new Date(bl.date_document).toLocaleDateString('fr-FR') : ''}</span>
                    <span style={{ color: '#34d399', marginLeft: '0.4rem', fontWeight: '600' }}>{parseFloat(bl.montant_ttc_final).toFixed(3)} TND</span>
                  </div>
                ))}
              </div>
            )}

            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Lignes agrégées</h4>
            <table className="custom-table" style={{ fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th>Article</th>
                  <th style={{ textAlign: 'center' }}>Qté</th>
                  <th style={{ textAlign: 'right' }}>P.U HT</th>
                  <th style={{ textAlign: 'right' }}>Total TTC</th>
                </tr>
              </thead>
              <tbody>
                {(selectedFact.lignes || []).map((l, i) => (
                  <tr key={i}>
                    <td>{l.article?.nom || `Art #${l.id_article}`}</td>
                    <td style={{ textAlign: 'center' }}>{parseFloat(l.quantite_totale)}</td>
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
        isOpen={showFactEdit}
        onClose={() => setShowFactEdit(false)}
        facturation={selectedFact}
        onUpdated={() => fetchClientData()}
      />
      {/* Create Facturation Modal */}
      <Modal
        isOpen={showAddFacturation}
        onClose={() => setShowAddFacturation(false)}
        title="Créer une Facture Fiscale Groupée"
        maxWidth="700px"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowAddFacturation(false)}>Annuler</button>
            <button id="client-submit-facture-btn" className="btn btn-primary" onClick={handleCreateFacturation}>Générer la Facture (Format 0001/26)</button>
          </>
        }
      >


        <h4 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem 0' }}>Bons de Livraison Non Facturés</h4>
        {availableBls.length === 0 ? (
          <div style={{ padding: '1rem', background: '#0f172a', borderRadius: '6px', color: '#94a3b8', fontSize: '0.85rem' }}>
            Aucun Bon de Livraison en attente de facturation pour ce client.
          </div>
        ) : (
          <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#0f172a', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem', marginBottom: '1rem' }}>
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
      </Modal>

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
                const submitBtn = document.getElementById('client-submit-facture-btn');
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

      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedDocFull(null); }}
        title={`Détail Document N° ${selectedDoc?.numero}`}
        maxWidth="700px"
      >
        {selectedDoc && (() => {
          const docFull = selectedDocFull || selectedDoc;
          const vendeurMatch = docFull.notes?.match(/^Vendeur:\s*([^.]+)/);
          const vendeurNom = vendeurMatch ? vendeurMatch[1].trim() : null;
          const notesTexte = docFull.notes?.replace(/^Vendeur:\s*[^.]+\.\s*/, '').trim() || '';
          return (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                <div><strong>Type:</strong> <StatusBadge status={docFull.type_document} /></div>
                <div><strong>Statut Vente:</strong> <StatusBadge status={docFull.statut} /></div>
                <div><strong>Client:</strong> {client?.nom || `#${docFull.id_client}`}</div>
                <div><strong>Date:</strong> {new Date(docFull.date_document).toLocaleString('fr-FR')}</div>
                {vendeurNom && <div style={{ gridColumn: 'span 2' }}><strong>Vendeur:</strong> {vendeurNom}</div>}
                {notesTexte && <div style={{ gridColumn: 'span 2', color: '#94a3b8' }}><strong>Notes:</strong> {notesTexte}</div>}
              </div>

              <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Articles Vendus</span>
                {docFull.statut_livraison && (
                  <span style={{
                    fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '5px', fontWeight: '600',
                    background: docFull.statut_livraison === 'livre' ? 'rgba(16,185,129,0.15)' :
                                docFull.statut_livraison === 'partiellement_livre' ? 'rgba(251,191,36,0.15)' : 'rgba(100,116,139,0.15)',
                    color: docFull.statut_livraison === 'livre' ? '#34d399' :
                           docFull.statut_livraison === 'partiellement_livre' ? '#fbbf24' : '#94a3b8',
                    border: '1px solid',
                    borderColor: docFull.statut_livraison === 'livre' ? '#10b981' :
                                 docFull.statut_livraison === 'partiellement_livre' ? '#fbbf24' : '#475569',
                  }}>
                    {docFull.statut_livraison === 'livre' ? '✓ Livré' :
                     docFull.statut_livraison === 'partiellement_livre' ? '◑ Partiellement livré' :
                     '✗ Non livré'}
                  </span>
                )}
              </h4>
              <table className="custom-table" style={{ marginBottom: '1rem' }}>
                <thead>
                  <tr>
                    <th>Article</th>
                    <th style={{ textAlign: 'center' }}>Qté</th>
                    <th style={{ textAlign: 'center' }}>Livré</th>
                    <th style={{ textAlign: 'right' }}>P.U TTC</th>
                    <th style={{ textAlign: 'right' }}>Remise</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'center' }}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDocFull === null && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: '#64748b', padding: '1rem' }}>Chargement...</td></tr>
                  )}
                  {(docFull.lignes || []).map((l, i) => {
                    const qty = parseFloat(l.quantite);
                    const qtyLivree = parseFloat(l.quantite_livree ?? 0);
                    const pu = parseFloat(l.prix_unitaire_ttc);
                    const remisePct = parseFloat(l.remise_pourcentage) || 0;
                    const total = qty * pu;

                    let livraisonIcon, livraisonColor;
                    if (l.statut_livraison === 'livre' || qtyLivree >= qty) {
                      livraisonIcon = '✓ Livré'; livraisonColor = '#34d399';
                    } else if (l.statut_livraison === 'partiellement_livre' || qtyLivree > 0) {
                      livraisonIcon = '◑ Partiel'; livraisonColor = '#fbbf24';
                    } else {
                      livraisonIcon = '✗ Non livré'; livraisonColor = '#94a3b8';
                    }

                    return (
                      <tr key={i}>
                        <td>
                          <strong style={{ color: 'white' }}>{l.article?.nom || `Art #${l.id_article}`}</strong>
                          {l.article?.reference && <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Réf: {l.article.reference}</div>}
                        </td>
                        <td style={{ textAlign: 'center' }}>{qty}</td>
                        <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>{qtyLivree} / {qty}</td>
                        <td style={{ textAlign: 'right' }}>{pu.toFixed(3)} TND</td>
                        <td style={{ textAlign: 'right', color: remisePct > 0 ? '#fbbf24' : '#64748b' }}>
                          {remisePct > 0 ? `-${remisePct}%` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{total.toFixed(3)} TND</td>
                        <td style={{ textAlign: 'center', color: livraisonColor, fontSize: '0.75rem', fontWeight: '600' }}>{livraisonIcon}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                {parseFloat(docFull.montant_remise) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>Sous-total Brut:</span>
                    <span>{parseFloat(docFull.montant_ttc_sans_remise).toFixed(3)} TND</span>
                  </div>
                )}
                {parseFloat(docFull.montant_remise) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fbbf24' }}>
                    <span>Remise Totale:</span>
                    <span>-{parseFloat(docFull.montant_remise).toFixed(3)} TND</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                  <span>Total TTC:</span>
                  <strong style={{ color: '#34d399' }}>{parseFloat(docFull.montant_ttc_final).toFixed(3)} TND</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#34d399', marginTop: '0.25rem' }}>
                  <span>Montant Payé:</span>
                  <span>{parseFloat(docFull.montant_paye).toFixed(3)} TND</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: parseFloat(docFull.montant_restant) > 0 ? '#fbbf24' : '#94a3b8', fontWeight: parseFloat(docFull.montant_restant) > 0 ? 'bold' : 'normal' }}>
                  <span>Reste à Payer:</span>
                  <strong>{parseFloat(docFull.montant_restant).toFixed(3)} TND</strong>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Ticket Print Modal */}
      <Modal
        isOpen={showPrintModal}
        onClose={() => { setShowPrintModal(false); setSelectedDocFull(null); }}
        title="Impression Ticket"
        maxWidth="400px"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowPrintModal(false)}>Fermer</button>
            <button className="btn btn-primary" onClick={() => window.print()}><Printer size={16} /> Imprimer</button>
          </>
        }
      >
        <TicketPrint document={selectedDocFull || selectedDoc} client={client} />
      </Modal>

      {/* Edit Document Modal */}
      <EditDocumentModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditDoc(null); }}
        document={editDoc}
        onSaved={(updated) => {
          fetchClientData();
        }}
        onConverted={() => {
          setShowEditModal(false);
          setEditDoc(null);
          fetchClientData();
        }}
      />

      {/* Payment Modal — Document or Facturation spécifique */}
      {selectedDocForPayment && (
        <PaymentModal
          isOpen={showDocPayment}
          onClose={() => { setShowDocPayment(false); setSelectedDocForPayment(null); }}
          document={{
            id_client: selectedDocForPayment.id_client ?? client.id_client,
            id_document: selectedDocForPayment._type === 'document' ? selectedDocForPayment.id_document : null,
            id_facturation: selectedDocForPayment._type === 'facturation' ? selectedDocForPayment.id_facturation : null,
            numero: selectedDocForPayment.numero,
            montant_restant: selectedDocForPayment.montant_restant,
            montant_ttc_final: selectedDocForPayment.montant_ttc_final,
            montant_paye: selectedDocForPayment.montant_paye,
          }}
          onPaymentCompleted={(reglement) => {
            fetchClientData();
            setShowDocPayment(false);
            setSelectedDocForPayment(null);
            if (reglement) {
              if (reglement.id_document) {
                api.getDocument(reglement.id_document)
                  .then(docData => {
                    setPrintedReglementDoc(docData);
                    setPrintedReglement(reglement);
                    setShowReglementPrint(true);
                  })
                  .catch(err => {
                    console.error(err);
                    setPrintedReglement(reglement);
                    setPrintedReglementDoc(null);
                    setShowReglementPrint(true);
                  });
              } else {
                setPrintedReglement(reglement);
                setPrintedReglementDoc(null);
                setShowReglementPrint(true);
              }
            }
          }}
        />
      )}

      {/* Retour Detail Modal */}
      <RetourDetailModal
        isOpen={showRetourDetail}
        onClose={() => setShowRetourDetail(false)}
        retourId={selectedRetourId}
      />

      {/* Edit Client Modal */}
      <EditClientModal
        isOpen={showEditClient}
        onClose={() => setShowEditClient(false)}
        client={client}
        onClientUpdated={(updatedClient) => {
          setClient(updatedClient);
        }}
      />

      {/* Règlement Print Modal */}
      <Modal
        isOpen={showReglementPrint}
        onClose={() => { setShowReglementPrint(false); setPrintedReglement(null); setPrintedReglementDoc(null); }}
        title="Impression Reçu de Règlement"
        maxWidth="400px"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => { setShowReglementPrint(false); setPrintedReglement(null); setPrintedReglementDoc(null); }}>Fermer</button>
            <button className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={16} /> Imprimer
            </button>
          </>
        }
      >
        <ReceiptPrint reglement={printedReglement} client={client} document={printedReglementDoc} />
      </Modal>
    </div>
  );
};
