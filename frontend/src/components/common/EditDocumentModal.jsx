import React, { useState, useEffect } from 'react';
import { toast } from '../../contexts/ToastContext';
import { api } from '../../services/api';
import { Modal } from './Modal';
import { Search, X, ArrowRightLeft, Save, Users } from 'lucide-react';

/**
 * EditDocumentModal — Modale de modification complète d'un document (devis, BL, facture_rapide).
 * Props:
 *   isOpen       : bool
 *   onClose      : () => void
 *   document     : DocumentOut object (le document à modifier)
 *   onSaved      : (updatedDoc) => void  — appelé après sauvegarde réussie
 *   onConverted  : (newDoc) => void      — appelé après conversion (BL ou Facture)
 */
export const EditDocumentModal = ({ isOpen, onClose, document: doc, onSaved, onConverted }) => {
  const [lignes, setLignes] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [passageClient, setPassageClient] = useState(null);
  const [articleSearch, setArticleSearch] = useState('');
  const [articleResults, setArticleResults] = useState([]);
  const [showArticleDropdown, setShowArticleDropdown] = useState(false);
  const [notes, setNotes] = useState('');
  const [vendeurNom, setVendeurNom] = useState('');
  const [convertTarget, setConvertTarget] = useState('devis'); // 'devis' | 'bon_livraison' | 'facture_rapide'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load passage client + full doc on open
  useEffect(() => {
    if (!isOpen || !doc) return;

    toast.error('');
    toast.success('');
    setConvertTarget('devis'); // reset le select à chaque ouverture
    // Extraire vendeur et notes pures
    const vendeurMatch = doc.notes?.match(/^Vendeur:\s*([^.]+)/);
    setVendeurNom(vendeurMatch ? vendeurMatch[1].trim() : '');
    setNotes(doc.notes?.replace(/^Vendeur:\s*[^.]+\.\s*/, '').trim() || '');
    setClientSearch('');

    api.getPassageClient().then(setPassageClient).catch(() => {});

    // Load client
    api.getClients('', false).then((cls) => {
      const found = cls.find((c) => c.id_client === doc.id_client);
      setSelectedClient(found || null);
    }).catch(() => {});

    // Load full doc with article names
    api.getDocument(doc.id_document).then((fullDoc) => {
      setLignes(
        (fullDoc.lignes || []).map((l) => ({
          id_article: l.id_article,
          nom_article: l.article?.nom || `Article #${l.id_article}`,
          reference: l.article?.reference || '',
          quantite: parseFloat(l.quantite),
          quantite_livree: parseFloat(l.quantite_livree) || 0,
          prix_unitaire_ttc: parseFloat(l.prix_unitaire_ttc),
          remise_pourcentage: parseFloat(l.remise_pourcentage) || 0,
          remise_max: parseFloat(l.article?.remise_max_pourcentage) || 100,
        }))
      );
    }).catch(() => {
      setLignes(
        (doc.lignes || []).map((l) => ({
          id_article: l.id_article,
          nom_article: `Article #${l.id_article}`,
          reference: '',
          quantite: parseFloat(l.quantite),
          quantite_livree: parseFloat(l.quantite_livree) || 0,
          prix_unitaire_ttc: parseFloat(l.prix_unitaire_ttc),
          remise_pourcentage: parseFloat(l.remise_pourcentage) || 0,
          remise_max: 100,
        }))
      );
    });
    // Ne dépend que de l'id du document : un nouvel objet `doc` fourni par le
    // rafraîchissement automatique en arrière-plan ne doit pas réinitialiser
    // le formulaire pendant que l'utilisateur modifie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, doc?.id_document]);

  // Client search
  useEffect(() => {
    if (clientSearch.trim().length >= 1) {
      api.getClients(clientSearch).then(setClientResults).catch(() => setClientResults([]));
      setShowClientDropdown(true);
    } else {
      setClientResults([]);
      setShowClientDropdown(false);
    }
  }, [clientSearch]);

  // Article search
  useEffect(() => {
    if (articleSearch.trim().length >= 1) {
      api.getArticles(articleSearch).then(setArticleResults).catch(() => setArticleResults([]));
      setShowArticleDropdown(true);
    } else {
      setArticleResults([]);
      setShowArticleDropdown(false);
    }
  }, [articleSearch]);

  const isPassageClient = selectedClient && passageClient && selectedClient.id_client === passageClient.id_client;

  const handleSelectClient = (c) => {
    setSelectedClient(c);
    setClientSearch('');
    setShowClientDropdown(false);
  };

  const handleSelectPassage = () => {
    if (passageClient) {
      setSelectedClient(passageClient);
      setClientSearch('');
    }
  };

  const handleAddArticle = (art) => {
    setLignes((prev) => [
      ...prev,
      {
        id_article: art.id_article,
        nom_article: art.nom,
        reference: art.reference || '',
        quantite: 1,
        quantite_livree: doc?.type_document !== 'devis' ? 1 : 0,
        prix_unitaire_ttc: parseFloat(art.prix_vente_ttc),
        remise_pourcentage: 0,
        remise_max: parseFloat(art.remise_max_pourcentage) || 100,
      },
    ]);
    setArticleSearch('');
    setShowArticleDropdown(false);
  };

  const handleLineChange = (index, field, value) => {
    setLignes((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveLine = (index) => {
    setLignes((prev) => prev.filter((_, i) => i !== index));
  };

  const totals = lignes.reduce(
    (acc, l) => {
      const qty = parseFloat(l.quantite) || 0;
      const pu = parseFloat(l.prix_unitaire_ttc) || 0;
      const remise = parseFloat(l.remise_pourcentage) || 0;
      acc.brut += qty * pu;
      acc.net += qty * pu * (1 - remise / 100);
      return acc;
    },
    { brut: 0, net: 0 }
  );

  const buildPayload = () => ({
    type_document: doc.type_document,
    id_client: (isPassageClient || !selectedClient) ? null : selectedClient.id_client,
    notes: vendeurNom.trim()
      ? `Vendeur: ${vendeurNom.trim()}. ${notes}`
      : notes,
    lignes: lignes.map((l) => ({
      id_article: l.id_article,
      quantite: parseFloat(l.quantite),
      quantite_livree: Math.min(parseFloat(l.quantite_livree) || 0, parseFloat(l.quantite) || 0),
      prix_unitaire_ttc: parseFloat(l.prix_unitaire_ttc),
      remise_pourcentage: parseFloat(l.remise_pourcentage) || 0,
    })),
  });

  const handleSave = async () => {
    toast.error('');
    toast.success('');
    if (lignes.length === 0) { toast.error('Ajoutez au moins un article.'); return; }
    try {
      setLoading(true);
      const updated = await api.updateDocument(doc.id_document, buildPayload());
      toast.success(`Document N° ${updated.numero} modifié avec succès !`);
      if (onSaved) onSaved(updated);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async () => {
    if (convertTarget === 'devis') return; // rien à faire
    const labels = { bon_livraison: 'Bon de Livraison', facture_rapide: 'Ticket de Caisse' };

    // BL : le Client Passage est interdit
    const isPassage = !selectedClient || (passageClient && selectedClient.id_client === passageClient.id_client);
    if (convertTarget === 'bon_livraison' && isPassage) {
      toast.error("⚠️ Un Bon de Livraison doit être associé à un client identifié. Veuillez d'abord sélectionner un client avant de convertir.");
      return;
    }

    if (!window.confirm(`Convertir ce devis en ${labels[convertTarget]} ?`)) return;
    toast.error('');
    try {
      setLoading(true);
      let newDoc;
      if (convertTarget === 'bon_livraison') {
        newDoc = await api.convertDevisToBl(doc.id_document);
      } else {
        newDoc = await api.convertDevisToFacture(doc.id_document);
      }
      toast.success(`${labels[convertTarget]} N° ${newDoc.numero} créé avec succès !`);
      if (onConverted) onConverted(newDoc);
      setTimeout(onClose, 1200);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!doc) return null;

  const typeLabel = { devis: 'Devis', bon_livraison: 'Bon de Livraison', facture_rapide: 'Ticket de Caisse' }[doc.type_document] || doc.type_document;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`✏️ Modifier ${typeLabel} N° ${doc.numero}`}
      maxWidth="880px"
      footer={
        <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={loading}>Annuler</button>

          {doc.type_document === 'devis' && (
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginRight: 'auto' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Convertir en :</label>
              <select
                className="form-select"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem', minWidth: '170px' }}
                value={convertTarget}
                onChange={(e) => setConvertTarget(e.target.value)}
                disabled={loading}
              >
                <option value="devis">— Garder comme Devis —</option>
                <option value="bon_livraison">Bon de Livraison (BL)</option>
                <option value="facture_rapide">Ticket de Caisse</option>
              </select>
              {convertTarget !== 'devis' && (
                <button
                  className="btn btn-success btn-sm"
                  onClick={handleConvert}
                  disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <ArrowRightLeft size={14} /> Appliquer
                </button>
              )}
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Save size={14} /> {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Alerts */}

        {/* Client selector */}
        <div className="form-group" style={{ margin: 0, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
            <label className="form-label" style={{ margin: 0 }}>
              Client
              {isPassageClient && (
                <span style={{ marginLeft: '0.5rem', background: 'rgba(251,191,36,0.2)', color: '#fbbf24', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid #fbbf24' }}>
                  👤 Passage
                </span>
              )}
            </label>
            <button
              type="button"
              onClick={handleSelectPassage}
              style={{
                background: isPassageClient ? 'rgba(251,191,36,0.2)' : 'none',
                border: isPassageClient ? '1px solid #fbbf24' : 'none',
                color: '#fbbf24', fontSize: '0.75rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                borderRadius: '4px', padding: '0.1rem 0.5rem'
              }}
            >
              <Users size={12} /> Client Passage
            </button>
          </div>
          <input
            className="form-input"
            value={isPassageClient ? '' : (clientSearch || (selectedClient ? `${selectedClient.nom} ${selectedClient.prenom || ''}`.trim() : ''))}
            onChange={(e) => {
              if (isPassageClient) setSelectedClient(null);
              setClientSearch(e.target.value);
            }}
            placeholder={isPassageClient ? '👤 Client Passage (vente anonyme)' : 'Changer de client...'}
            style={{ fontStyle: isPassageClient ? 'italic' : 'normal' }}
          />
          {showClientDropdown && clientResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 200, maxHeight: '180px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              {clientResults.map((c) => (
                <div key={c.id_client} onClick={() => handleSelectClient(c)}
                  style={{ padding: '0.45rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}>
                  <strong style={{ color: 'var(--text-main)' }}>{c.nom} {c.prenom || ''}</strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>Tél: {c.telephone || 'N/A'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Article search */}
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '2.2rem' }}
            value={articleSearch}
            onChange={(e) => setArticleSearch(e.target.value)}
            placeholder="Ajouter un article (nom ou référence)..."
          />
          {showArticleDropdown && articleResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 200, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              {articleResults.map((art) => (
                <div key={art.id_article} onClick={() => handleAddArticle(art)}
                  style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>
                    <strong style={{ color: 'var(--text-main)' }}>{art.nom}</strong>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>Réf: {art.reference || '—'}</span>
                  </span>
                  <span style={{ color: '#34d399', fontWeight: 'bold' }}>{parseFloat(art.prix_vente_ttc).toFixed(3)} TND</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lines table */}
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <table className="custom-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Article</th>
                <th style={{ width: '80px' }}>Qté</th>
                <th style={{ width: '110px' }}>Qté Livrée</th>
                <th style={{ width: '120px' }}>P.U TTC</th>
                <th style={{ width: '90px' }}>Remise %</th>
                <th style={{ width: '115px', textAlign: 'right' }}>Total Ligne</th>
                <th style={{ width: '38px' }}></th>
              </tr>
            </thead>
            <tbody>
              {lignes.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                    Aucun article — utilisez la recherche ci-dessus pour en ajouter.
                  </td>
                </tr>
              ) : (
                lignes.map((l, i) => {
                  const qty = parseFloat(l.quantite) || 0;
                  const pu = parseFloat(l.prix_unitaire_ttc) || 0;
                  const remise = parseFloat(l.remise_pourcentage) || 0;
                  const qtyLivree = parseFloat(l.quantite_livree) || 0;
                  const totalLine = qty * pu * (1 - remise / 100);
                  const exceeds = remise > (l.remise_max || 0) && l.remise_max > 0;
                  const isPartial = qtyLivree > 0 && qtyLivree < qty;
                  const isFullyDelivered = qtyLivree >= qty && qty > 0;
                  return (
                    <tr key={i}>
                      <td>
                        <strong style={{ color: 'var(--text-main)', fontSize: '0.88rem' }}>{l.nom_article}</strong>
                        {l.reference && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Réf: {l.reference}</div>}
                      </td>
                      <td>
                        <input type="number" min="0.001" step="1" className="form-input"
                          style={{ padding: '0.2rem 0.35rem', textAlign: 'center' }}
                          value={l.quantite}
                          onChange={(e) => {
                            const newQty = parseFloat(e.target.value) || 1;
                            handleLineChange(i, 'quantite', newQty);
                            if ((parseFloat(l.quantite_livree) || 0) > newQty) {
                              handleLineChange(i, 'quantite_livree', newQty);
                            }
                          }} />
                      </td>
                      {/* Qté livrée */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <input type="number" min="0" step="1" max={qty} className="form-input"
                            style={{
                              padding: '0.2rem 0.35rem', textAlign: 'center', flex: 1,
                              borderColor: isFullyDelivered ? '#10b981' : isPartial ? '#f59e0b' : undefined
                            }}
                            value={qtyLivree}
                            onChange={(e) => {
                              const val = Math.min(parseFloat(e.target.value) || 0, qty);
                              handleLineChange(i, 'quantite_livree', val);
                            }} />
                          <span style={{ fontSize: '0.68rem', color: isFullyDelivered ? '#34d399' : isPartial ? '#fbbf24' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {isFullyDelivered ? '✓' : isPartial ? '◑' : '✗'}/{qty}
                          </span>
                        </div>
                      </td>
                      <td>
                        <input type="number" min="0" step="0.001" className="form-input"
                          style={{ padding: '0.2rem 0.35rem', textAlign: 'right' }}
                          value={l.prix_unitaire_ttc}
                          onChange={(e) => handleLineChange(i, 'prix_unitaire_ttc', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" min="0" max="100" step="1" className="form-input"
                          style={{ padding: '0.2rem 0.35rem', textAlign: 'center', borderColor: exceeds ? '#f59e0b' : undefined }}
                          value={l.remise_pourcentage}
                          onChange={(e) => handleLineChange(i, 'remise_pourcentage', e.target.value)} />
                      </td>
                      <td style={{ textAlign: 'right', color: '#34d399', fontWeight: 'bold', fontSize: '0.9rem' }}>
                        {totalLine.toFixed(3)}
                      </td>
                      <td>
                        <button className="btn btn-outline btn-sm" style={{ padding: '0.15rem' }} onClick={() => handleRemoveLine(i)}>
                          <X size={13} color="#f87171" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        {lignes.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '2rem', background: 'var(--bg-primary)', padding: '0.65rem 1rem', borderRadius: '8px', fontSize: '0.88rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Total Brut: <strong style={{ color: 'var(--text-main)' }}>{totals.brut.toFixed(3)} TND</strong>
            </span>
            <span style={{ color: '#fbbf24' }}>
              Remise: <strong>-{(totals.brut - totals.net).toFixed(3)} TND</strong>
            </span>
            <span style={{ color: '#34d399', fontSize: '1rem', fontWeight: 'bold' }}>
              TOTAL TTC: {totals.net.toFixed(3)} TND
            </span>
          </div>
        )}

        {/* Vendeur + Notes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Nom Vendeur</label>
            <input
              className="form-input"
              value={vendeurNom}
              onChange={(e) => setVendeurNom(e.target.value)}
              placeholder="ex: Mohamed"
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Notes / Remarques</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Consignes, mode de livraison..."
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};