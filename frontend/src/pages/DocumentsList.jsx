import React, { useState } from 'react';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { TicketPrint } from '../components/print/TicketPrint';
import { EditDocumentModal } from '../components/common/EditDocumentModal';
import { Printer, RefreshCw, Eye, ArrowRightLeft, Search, Pencil, X } from 'lucide-react';
import { usePolling } from '../hooks/usePolling';

export const DocumentsList = () => {
  const [documents, setDocuments] = useState([]);
  const [clientsMap, setClientsMap] = useState({});
  const [passageClientId, setPassageClientId] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [statutFilter, setStatutFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Detail / Print / Edit Modal State
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedDocFull, setSelectedDocFull] = useState(null);  // doc enrichi avec articles
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const openDetailOrPrint = async (doc, mode) => {
    setSelectedDoc(doc);
    setSelectedDocFull(null);
    if (mode === 'detail') setShowDetailModal(true);
    else setShowPrintModal(true);
    // Charger la version complète avec articles
    try {
      const full = await api.getDocument(doc.id_document);
      setSelectedDocFull(full);
    } catch (e) {
      setSelectedDocFull(doc); // fallback
    }
  };

  const fetchDocuments = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const docs = await api.getDocuments(typeFilter, '', statutFilter);
      setDocuments(docs);

      // Fetch clients map for display
      const clients = await api.getClients('', false);
      const cMap = {};
      clients.forEach((c) => { cMap[c.id_client] = c; });
      setClientsMap(cMap);

      // Get passage client id
      api.getPassageClient().then((p) => setPassageClientId(p.id_client)).catch(() => {});
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  usePolling(fetchDocuments, [typeFilter, statutFilter]);

  const handleConvertDevis = async (docId) => {
    if (!window.confirm('Voulez-vous vraiment convertir ce Devis en Bon de Livraison ?')) return;

    try {
      const bl = await api.convertDevisToBl(docId);
      alert(`Bon de Livraison N° ${bl.numero} créé avec succès !`);
      fetchDocuments();
    } catch (err) {
      alert(`Erreur: ${err.message}`);
    }
  };

  // Filtration intelligente multi-mots
  const filteredDocs = documents.filter((d) => {
    if (!search.trim()) return true;
    const words = search.toLowerCase().trim().split(/\s+/);
    const client = clientsMap[d.id_client];
    // numericOnly: match "20260004" against "BL20260004" or "F20260004"
    const numericNumero = (d.numero || '').replace(/\D/g, '');
    const haystack = [
      d.numero || '',
      numericNumero,
      client?.nom || '',
      client?.prenom || '',
      d.type_document || '',
      d.statut || ''
    ].join(' ').toLowerCase();
    return words.every(w => haystack.includes(w));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Page Title & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Documents de Vente</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Historique et gestion des Devis, Bons de Livraison et Factures Rapides</p>
        </div>
        <button className="btn btn-outline" onClick={fetchDocuments}>
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      {/* Filters Bar */}
      <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '2.5rem', paddingRight: search ? '2.5rem' : undefined }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher : N° document, nom client, type..."
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>

        <select className="form-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Tous les Types (Devis, BL, Facture)</option>
          <option value="devis">Devis</option>
          <option value="bon_livraison">Bon de Livraison (BL)</option>
          <option value="facture_rapide">Ticket de Caisse</option>
        </select>

        <select className="form-select" value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)}>
          <option value="">Tous les Statuts</option>
          <option value="brouillon">Brouillon</option>
          <option value="valide">Validé</option>
          <option value="partiellement_paye">Partiellement Payé</option>
          <option value="paye">Payé</option>
          <option value="annule">Annulé</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Numéro</th>
                <th>Date</th>
                <th>Client</th>
                <th style={{ textAlign: 'right' }}>Total TTC</th>
                <th style={{ textAlign: 'right' }}>Reste à Payer</th>
                <th style={{ textAlign: 'center' }}>Statut Vente</th>
                <th style={{ textAlign: 'center' }}>Livraison</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>Chargement des documents...</td></tr>
              ) : filteredDocs.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucun document trouvé.</td></tr>
              ) : (
                filteredDocs.map((doc) => {
                  const client = clientsMap[doc.id_client];
                  return (
                    <tr key={doc.id_document}>
                      <td><StatusBadge status={doc.type_document} /></td>
                      <td><strong style={{ color: 'var(--text-main)' }}>{doc.numero}</strong></td>
                      <td>{new Date(doc.date_document).toLocaleDateString('fr-FR')}</td>
                      <td>
                        {doc.id_client === passageClientId
                          ? <span style={{ color: '#fbbf24', fontStyle: 'italic', fontSize: '0.85rem' }}>👤 Client Passage</span>
                          : (clientsMap[doc.id_client] ? `${clientsMap[doc.id_client].nom} ${clientsMap[doc.id_client].prenom || ''}`.trim() : `Client #${doc.id_client}`)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {parseFloat(doc.montant_retourne) > 0 ? (
                          <div style={{ fontSize: '0.85rem', lineHeight: '1.2' }}>
                            <div style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                              TTC: {parseFloat(doc.montant_ttc_final).toFixed(3)}
                            </div>
                            <div style={{ color: '#f87171' }}>
                              Ret: -{parseFloat(doc.montant_retourne).toFixed(3)}
                            </div>
                            <div style={{ fontWeight: 'bold', color: '#34d399' }}>
                              Net: {(parseFloat(doc.montant_ttc_final) - parseFloat(doc.montant_retourne)).toFixed(3)} TND
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontWeight: 'bold', color: '#34d399' }}>{parseFloat(doc.montant_ttc_final).toFixed(3)} TND</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', color: parseFloat(doc.montant_restant) > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                        {parseFloat(doc.montant_restant).toFixed(3)} TND
                      </td>
                      <td style={{ textAlign: 'center' }}><StatusBadge status={doc.statut} /></td>
                      <td style={{ textAlign: 'center' }}><StatusBadge status={doc.statut_livraison} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            title="Voir détail"
                            onClick={() => openDetailOrPrint(doc, 'detail')}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            title="Imprimer ticket"
                            onClick={() => openDetailOrPrint(doc, 'print')}
                          >
                            <Printer size={14} />
                          </button>

                          {doc.statut !== 'annule' && (
                            <button
                              className="btn btn-outline btn-sm"
                              title="Modifier le document"
                              onClick={() => { setEditDoc(doc); setShowEditModal(true); }}
                              style={{ color: '#38bdf8', borderColor: '#38bdf8' }}
                            >
                              <Pencil size={14} />
                            </button>
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

      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedDocFull(null); }}
        title={`Détail Document N° ${selectedDoc?.numero}`}
        maxWidth="700px"
      >
        {selectedDoc && (() => {
          const docFull = selectedDocFull || selectedDoc;
          // Extraire le vendeur depuis les notes
          const vendeurMatch = docFull.notes?.match(/^Vendeur:\s*([^.]+)/);
          const vendeurNom = vendeurMatch ? vendeurMatch[1].trim() : null;
          const notesTexte = docFull.notes?.replace(/^Vendeur:\s*[^.]+\.\s*/, '').trim() || '';
          return (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                <div><strong>Type:</strong> <StatusBadge status={docFull.type_document} /></div>
                <div><strong>Statut Vente:</strong> <StatusBadge status={docFull.statut} /></div>
                <div><strong>Client:</strong> {clientsMap[docFull.id_client]?.nom || `#${docFull.id_client}`}</div>
                <div><strong>Date:</strong> {new Date(docFull.date_document).toLocaleString('fr-FR')}</div>
                {vendeurNom && <div style={{ gridColumn: 'span 2' }}><strong>Vendeur:</strong> {vendeurNom}</div>}
                {notesTexte && <div style={{ gridColumn: 'span 2', color: 'var(--text-muted)' }}><strong>Notes:</strong> {notesTexte}</div>}
              </div>

              <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Articles Vendus</span>
                {docFull.statut_livraison && (
                  <span style={{
                    fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '5px', fontWeight: '600',
                    background: docFull.statut_livraison === 'livre' ? 'rgba(16,185,129,0.15)' :
                                docFull.statut_livraison === 'partiellement_livre' ? 'rgba(251,191,36,0.15)' : 'rgba(100,116,139,0.15)',
                    color: docFull.statut_livraison === 'livre' ? '#34d399' :
                           docFull.statut_livraison === 'partiellement_livre' ? '#fbbf24' : 'var(--text-muted)',
                    border: '1px solid',
                    borderColor: docFull.statut_livraison === 'livre' ? '#10b981' :
                                 docFull.statut_livraison === 'partiellement_livre' ? '#fbbf24' : 'var(--text-muted)',
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
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>Chargement...</td></tr>
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
                      livraisonIcon = '✗ Non livré'; livraisonColor = 'var(--text-muted)';
                    }

                    return (
                      <tr key={i}>
                        <td>
                          <strong style={{ color: 'var(--text-main)' }}>{l.article?.nom || `Art #${l.id_article}`}</strong>
                          {l.article?.reference && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Réf: {l.article.reference}</div>}
                        </td>
                        <td style={{ textAlign: 'center' }}>{qty}</td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{qtyLivree} / {qty}</td>
                        <td style={{ textAlign: 'right' }}>{pu.toFixed(3)} TND</td>
                        <td style={{ textAlign: 'right', color: remisePct > 0 ? '#fbbf24' : 'var(--text-muted)' }}>
                          {remisePct > 0 ? `-${remisePct}%` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{total.toFixed(3)} TND</td>
                        <td style={{ textAlign: 'center', color: livraisonColor, fontSize: '0.75rem', fontWeight: '600' }}>{livraisonIcon}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                {parseFloat(docFull.montant_remise) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', color: parseFloat(docFull.montant_restant) > 0 ? '#fbbf24' : 'var(--text-muted)', fontWeight: parseFloat(docFull.montant_restant) > 0 ? 'bold' : 'normal' }}>
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
        <TicketPrint document={selectedDocFull || selectedDoc} client={clientsMap[selectedDoc?.id_client]} />
      </Modal>

      {/* Edit Document Modal */}
      <EditDocumentModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditDoc(null); }}
        document={editDoc}
        onSaved={(updated) => {
          // Update document in local list
          setDocuments((prev) => prev.map((d) => d.id_document === updated.id_document ? updated : d));
        }}
        onConverted={() => {
          setShowEditModal(false);
          setEditDoc(null);
          fetchDocuments();
        }}
      />
    </div>
  );
};
