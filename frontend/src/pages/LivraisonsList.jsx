import React, { useState } from 'react';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { EditDocumentModal } from '../components/common/EditDocumentModal';
import { Truck, RefreshCw, Eye, Search, Pencil, X } from 'lucide-react';
import { usePolling } from '../hooks/usePolling';

export const LivraisonsList = () => {
  const [documents, setDocuments] = useState([]);
  const [clientsMap, setClientsMap] = useState({});
  const [search, setSearch] = useState('');
  const [statutLivraisonFilter, setStatutLivraisonFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedDocFull, setSelectedDocFull] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const openDetail = async (doc) => {
    setSelectedDoc(doc);
    setSelectedDocFull(null);
    setShowDetailModal(true);
    try {
      const full = await api.getDocument(doc.id_document);
      setSelectedDocFull(full);
    } catch (e) {
      setSelectedDocFull(doc);
    }
  };

  const fetchDocuments = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const docs = await api.getDocuments();
      // Documents pas totalement livrés, hors documents annulés
      const incomplets = docs.filter((d) => d.statut_livraison !== 'livre' && d.statut !== 'annule');
      setDocuments(incomplets);

      const clients = await api.getClients('', false);
      const cMap = {};
      clients.forEach((c) => { cMap[c.id_client] = c; });
      setClientsMap(cMap);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  usePolling(fetchDocuments, []);

  const filteredDocs = documents.filter((d) => {
    if (statutLivraisonFilter && d.statut_livraison !== statutLivraisonFilter) return false;
    if (!search.trim()) return true;
    const words = search.toLowerCase().trim().split(/\s+/);
    const client = clientsMap[d.id_client];
    const haystack = [d.numero || '', client?.nom || '', client?.prenom || '', d.type_document || ''].join(' ').toLowerCase();
    return words.every((w) => haystack.includes(w));
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={22} /> À Livrer
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Documents dont la livraison n'est pas terminée (non livrés ou partiellement livrés)</p>
        </div>
        <button className="btn btn-outline" onClick={() => fetchDocuments()}>
          <RefreshCw size={16} /> Actualiser
        </button>
      </div>

      <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '2.5rem', paddingRight: search ? '2.5rem' : undefined }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher : N° document, nom client..."
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', padding: 0 }}>
              <X size={14} />
            </button>
          )}
        </div>

        <select className="form-select" value={statutLivraisonFilter} onChange={(e) => setStatutLivraisonFilter(e.target.value)}>
          <option value="">Non livrés + Partiellement livrés</option>
          <option value="non_livre">Non livrés uniquement</option>
          <option value="partiellement_livre">Partiellement livrés uniquement</option>
        </select>
      </div>

      <div className="glass-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Numéro</th>
                <th>Date</th>
                <th>Client</th>
                <th style={{ textAlign: 'center' }}>Livraison</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Chargement...</td></tr>
              ) : filteredDocs.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Rien à livrer — tout est à jour.</td></tr>
              ) : (
                filteredDocs.map((doc) => {
                  const client = clientsMap[doc.id_client];
                  return (
                    <tr key={doc.id_document}>
                      <td><StatusBadge status={doc.type_document} /></td>
                      <td><strong style={{ color: 'white' }}>{doc.numero}</strong></td>
                      <td>{new Date(doc.date_document).toLocaleDateString('fr-FR')}</td>
                      <td>{client ? `${client.nom} ${client.prenom || ''}`.trim() : `Client #${doc.id_client}`}</td>
                      <td style={{ textAlign: 'center' }}><StatusBadge status={doc.statut_livraison} /></td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                          <button className="btn btn-outline btn-sm" title="Voir détail" onClick={() => openDetail(doc)}>
                            <Eye size={14} />
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            title="Modifier la livraison"
                            onClick={() => { setEditDoc(doc); setShowEditModal(true); }}
                            style={{ color: '#38bdf8', borderColor: '#38bdf8' }}
                          >
                            <Pencil size={14} />
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

      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedDocFull(null); }}
        title={`Détail Document N° ${selectedDoc?.numero}`}
        maxWidth="700px"
      >
        {selectedDoc && (() => {
          const docFull = selectedDocFull || selectedDoc;
          return (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                <div><strong>Type:</strong> <StatusBadge status={docFull.type_document} /></div>
                <div><strong>Livraison:</strong> <StatusBadge status={docFull.statut_livraison} /></div>
                <div><strong>Client:</strong> {clientsMap[docFull.id_client]?.nom || `#${docFull.id_client}`}</div>
                <div><strong>Date:</strong> {new Date(docFull.date_document).toLocaleString('fr-FR')}</div>
              </div>

              <table className="custom-table" style={{ marginBottom: '1rem' }}>
                <thead>
                  <tr>
                    <th>Article</th>
                    <th style={{ textAlign: 'center' }}>Qté</th>
                    <th style={{ textAlign: 'center' }}>Livré</th>
                    <th style={{ textAlign: 'center' }}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {(docFull.lignes || []).map((l, i) => {
                    const qty = parseFloat(l.quantite);
                    const qtyLivree = parseFloat(l.quantite_livree ?? 0);
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
                        <td style={{ textAlign: 'center', color: livraisonColor, fontSize: '0.75rem', fontWeight: '600' }}>{livraisonIcon}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => { setShowDetailModal(false); setEditDoc(selectedDoc); setShowEditModal(true); }}
                >
                  <Pencil size={14} /> Modifier la livraison
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <EditDocumentModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditDoc(null); }}
        document={editDoc}
        onSaved={() => { setShowEditModal(false); setEditDoc(null); fetchDocuments(); }}
        onConverted={() => { setShowEditModal(false); setEditDoc(null); fetchDocuments(); }}
      />
    </div>
  );
};
