import React, { useState, useEffect } from 'react';
import { toast } from '../../contexts/ToastContext';
import { api } from '../../services/api';
import { Search, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Modal } from './Modal';

export const CreateRetourModal = ({ isOpen, onClose, onSuccess }) => {
  const [clients, setClients] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [articles, setArticles] = useState([]);

  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [motif, setMotif] = useState('');
  const [modeRemboursement, setModeRemboursement] = useState('');
  
  const [lignes, setLignes] = useState([]);
  const [documentArticlesIds, setDocumentArticlesIds] = useState([]);
  const [documentLignes, setDocumentLignes] = useState([]);
  const [clientArticlesIds, setClientArticlesIds] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sendWhatsapp, setSendWhatsapp] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
      resetForm();
    }
  }, [isOpen]);

  const loadInitialData = async () => {
    try {
      const [cls, arts] = await Promise.all([
        api.getClients(''),
        api.getArticles('')
      ]);
      setClients(cls);
      setArticles(arts);
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setSelectedClientId('');
    setSelectedDocId('');
    setMotif('');
    setModeRemboursement('');
    setLignes([]);
    setDocuments([]);
    setDocumentArticlesIds([]);
    setDocumentLignes([]);
    setClientArticlesIds([]);
    setSendWhatsapp(true);
    toast.error('');
  };

  useEffect(() => {
    if (selectedClientId) {
      api.getDocumentsByClient(selectedClientId)
        .then(docs => {
          setDocuments(docs.filter(d => ['bon_livraison', 'facture_rapide'].includes(d.type_document)));
        })
        .catch(console.error);

      api.getArticlesAchetesClient(selectedClientId)
        .then(ids => {
          setClientArticlesIds(ids);
        })
        .catch(console.error);
    } else {
      setDocuments([]);
      setSelectedDocId('');
      setClientArticlesIds([]);
    }
  }, [selectedClientId]);

  useEffect(() => {
    if (selectedDocId) {
      api.getDocument(selectedDocId)
        .then(doc => {
           if (doc && doc.lignes) {
             setDocumentArticlesIds(doc.lignes.map(l => l.id_article));
             setDocumentLignes(doc.lignes);
           }
        })
        .catch(console.error);
    } else {
      setDocumentArticlesIds([]);
      setDocumentLignes([]);
    }
  }, [selectedDocId]);

  const handleAddLine = (type) => {
    setLignes([
      ...lignes,
      { type_ligne: type, id_article: '', search_text: '', quantite: 1, quantite_max: 0, prix_unitaire_ttc: 0, warning: '' }
    ]);
  };

  const handleLineChange = async (index, field, value) => {
    const updated = [...lignes];
    
    if (field === 'quantite') {
      let val = parseFloat(value) || 0;
      if (updated[index].quantite_max && val > updated[index].quantite_max) {
        val = updated[index].quantite_max;
      }
      updated[index][field] = val;
    } else {
      updated[index][field] = value;
    }

    if (field === 'id_article' && value) {
      if (selectedClientId) {
        try {
          const hist = await api.getHistoriqueArticleClient(selectedClientId, parseInt(value));
          if (hist.trouve) {
            let qmax = 0;
            let dejaRetourne = 0;
            // Les prix multiples ne concernent que le mode "historique agrégé" (pas de document
            // précis sélectionné) : quand un document est choisi, son prix de ligne fait foi.
            let prixHistoriques = [];
            if (selectedDocId) {
               const lDoc = documentLignes.find(l => l.id_article === parseInt(value));
               if (lDoc) {
                 dejaRetourne = parseFloat(lDoc.quantite_retournee || 0);
                 qmax = Math.max(0, parseFloat(lDoc.quantite) - dejaRetourne);
               }
            } else {
               dejaRetourne = parseFloat(hist.quantite_deja_retournee || 0);
               qmax = parseFloat(hist.quantite_max || 0);
               if (hist.prix_multiples) {
                 prixHistoriques = hist.prix_historiques || [];
               }
            }
            updated[index].quantite_max = qmax;
            updated[index].deja_retourne = dejaRetourne;
            updated[index].prix_historiques = prixHistoriques;
            updated[index].prix_unitaire_ttc = parseFloat(hist.prix_unitaire_apres_remise || hist.prix_unitaire_ttc);
            updated[index].warning = qmax <= 0
              ? "Cet article a déjà été intégralement retourné pour cet historique."
              : '';
          } else {
            updated[index].warning = "Cet article n'a jamais été acheté par ce client (historique introuvable).";
            updated[index].quantite_max = 0;
            updated[index].prix_historiques = [];
            const art = articles.find(a => a.id_article === parseInt(value));
            if (art) {
              updated[index].prix_unitaire_ttc = parseFloat(art.prix_vente_ttc);
            }
          }
        } catch (err) {
           console.error(err);
           updated[index].quantite_max = 0;
           const art = articles.find(a => a.id_article === parseInt(value));
           if (art) updated[index].prix_unitaire_ttc = parseFloat(art.prix_vente_ttc);
        }
      } else {
        updated[index].warning = "Veuillez sélectionner un client pour vérifier l'historique.";
      }
    } else if (field === 'id_article' && !value) {
        updated[index].prix_unitaire_ttc = 0;
        updated[index].quantite_max = 0;
        updated[index].warning = '';
    }

    setLignes(updated);
  };

  const handleRemoveLine = (index) => {
    setLignes(lignes.filter((_, i) => i !== index));
  };

  const calculateTotal = () => {
    return lignes.reduce((sum, l) => sum + (parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire_ttc) || 0), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    toast.error('');

    if (!selectedClientId) {
      toast.error('Veuillez sélectionner un client.');
      return;
    }
    if (lignes.length === 0) {
      toast.error('Veuillez ajouter au moins un article à retourner.');
      return;
    }

    for (const l of lignes) {
      if (!l.id_article) {
        toast.error('Veuillez sélectionner un article pour chaque ligne.');
        return;
      }
      if (parseFloat(l.quantite) <= 0) {
        toast.error('La quantité doit être supérieure à 0.');
        return;
      }
    }

    try {
      setLoading(true);
      const created = await api.createRetour({
        id_client: parseInt(selectedClientId),
        id_document: selectedDocId ? parseInt(selectedDocId) : null,
        motif: motif.trim() || null,
        mode_remboursement: modeRemboursement,
        lignes: lignes.map((l) => ({
          id_article: parseInt(l.id_article),
          quantite: parseFloat(l.quantite),
          prix_unitaire_ttc: parseFloat(l.prix_unitaire_ttc)
        })),
        send_whatsapp: sendWhatsapp
      });

      onSuccess(created);
      onClose();
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du bon de retour');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const total = calculateTotal();
  const docArticles = articles.filter(a => documentArticlesIds.includes(a.id_article));
  const boughtArticles = articles.filter(a => clientArticlesIds.includes(a.id_article));

  return (
    <Modal title="Créer un Bon de Retour" isOpen={isOpen} onClose={onClose} maxWidth="850px">
      <form onSubmit={handleSubmit}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Client <span style={{ color: '#f87171' }}>*</span></label>
            <select
              className="form-select"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              required
            >
              <option value="">-- Sélectionner un client --</option>
              {clients.map(c => (
                <option key={c.id_client} value={c.id_client}>{c.nom} {c.prenom}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Document d'origine (Optionnel)</label>
            <select
              className="form-select"
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              disabled={!selectedClientId || documents.length === 0}
            >
              <option value="">-- Aucun document spécifique --</option>
              {documents.map(d => (
                <option key={d.id_document} value={d.id_document}>{d.numero} (Net: {d.montant_ttc_final} TND)</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Motif</label>
          <input
            type="text"
            className="form-input"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex: Produit défectueux, Erreur de commande..."
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: '600', color: 'white', margin: 0 }}>Articles Retournés</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAddLine('historic')}>
                <Plus size={16} /> Ajouter Article Acheté
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => handleAddLine('catalog')}>
                <Search size={16} /> Autre Article
              </button>
            </div>
          </div>
          
          {lignes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: '#1e293b', borderRadius: '0.375rem', color: '#94a3b8' }}>
              Aucun article ajouté. Utilisez les boutons ci-dessus pour commencer.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {lignes.map((ligne, index) => {
                const listId = `articles-list-${index}`;
                return (
                  <div key={index} style={{ padding: '1rem', backgroundColor: '#1e293b', borderRadius: '0.375rem', border: ligne.warning ? '1px solid #fbbf24' : '1px solid #334155' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                      
                      {ligne.type_ligne === 'historic' ? (
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">
                            {selectedDocId ? "Article du Document" : "Article Acheté"}
                          </label>
                          <select
                            className="form-select"
                            value={ligne.id_article}
                            onChange={(e) => handleLineChange(index, 'id_article', e.target.value)}
                            required
                          >
                            <option value="">-- Choisir --</option>
                            {(selectedDocId ? docArticles : boughtArticles).map(a => (
                              <option key={a.id_article} value={a.id_article}>{a.reference ? a.reference + ' - ' : ''}{a.nom}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label">
                            Article du Catalogue (Saisie)
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            list={listId}
                            value={ligne.search_text || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const updated = [...lignes];
                              updated[index].search_text = val;
                              setLignes(updated);
                              
                              const art = articles.find(a => `${a.reference ? a.reference + ' - ' : ''}${a.nom}` === val);
                              if (art) {
                                handleLineChange(index, 'id_article', art.id_article);
                              } else {
                                handleLineChange(index, 'id_article', '');
                              }
                            }}
                            placeholder="Rechercher par nom ou réf..."
                            required
                          />
                          <datalist id={listId}>
                            {articles.map(a => (
                              <option key={a.id_article} value={`${a.reference ? a.reference + ' - ' : ''}${a.nom}`} />
                            ))}
                          </datalist>
                        </div>
                      )}

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">
                          Quantité {ligne.quantite_max > 0 ? `(Max: ${ligne.quantite_max})` : ''}
                        </label>
                        <input
                          type="number"
                          className="form-input"
                          min="0.1"
                          step="0.1"
                          max={ligne.quantite_max || ''}
                          value={ligne.quantite}
                          onChange={(e) => handleLineChange(index, 'quantite', e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Prix Unitaire TTC</label>
                        <input
                          type="number"
                          className="form-input"
                          min="0"
                          step="0.001"
                          value={ligne.prix_unitaire_ttc}
                          onChange={(e) => handleLineChange(index, 'prix_unitaire_ttc', e.target.value)}
                          required
                        />
                      </div>
                      <button type="button" className="btn btn-outline" style={{ color: '#f87171', borderColor: '#f87171' }} onClick={() => handleRemoveLine(index)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    {ligne.warning && (
                      <div style={{ marginTop: '0.5rem', color: '#fbbf24', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <AlertCircle size={14} /> {ligne.warning}
                      </div>
                    )}
                    {ligne.id_article && !ligne.warning && ligne.type_ligne === 'historic' && (
                      <div style={{ marginTop: '0.5rem', color: '#34d399', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Search size={14} /> Prix historique récupéré avec succès. Quantité restante retournable: {ligne.quantite_max}
                        {ligne.deja_retourne > 0 ? ` (déjà retourné: ${ligne.deja_retourne})` : ''}.
                      </div>
                    )}
                    {ligne.prix_historiques && ligne.prix_historiques.length > 1 && (
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: '0.375rem' }}>
                        <div style={{ color: '#fbbf24', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.4rem' }}>
                          <AlertCircle size={14} /> Cet article a été vendu à ce client à plusieurs prix différents. Vérifiez le prix à rembourser :
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {ligne.prix_historiques.map((p, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => handleLineChange(index, 'prix_unitaire_ttc', p.prix_unitaire_apres_remise)}
                              style={{
                                fontSize: '0.8rem',
                                borderColor: parseFloat(ligne.prix_unitaire_ttc) === parseFloat(p.prix_unitaire_apres_remise) ? '#34d399' : undefined,
                                color: parseFloat(ligne.prix_unitaire_ttc) === parseFloat(p.prix_unitaire_apres_remise) ? '#34d399' : undefined
                              }}
                            >
                              {parseFloat(p.prix_unitaire_apres_remise).toFixed(3)} TND (x{p.quantite})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {ligne.id_article && !ligne.warning && ligne.type_ligne === 'catalog' && (
                      <div style={{ marginTop: '0.5rem', color: '#60a5fa', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        Article sélectionné avec succès.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '1.5rem', backgroundColor: '#1e293b', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', color: '#94a3b8' }}>Méthode de remboursement</h4>
              
              {selectedClientId && total > 0 && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '0.375rem', fontSize: '0.875rem', color: '#38bdf8' }}>
                  {(() => {
                    const client = clients.find(c => c.id_client === parseInt(selectedClientId));
                    const solde = client ? parseFloat(client.solde_compte) : 0;
                    const dette = solde < 0 ? Math.abs(solde) : 0;
                    
                    if (dette > 0) {
                      if (dette >= total) {
                        return `Le client a une dette de ${dette.toFixed(3)} TND. Ce retour ( ${total.toFixed(3)} TND ) servira intégralement à éponger sa dette. Le remboursement en espèces n'est pas disponible.`;
                      } else {
                        const reste = total - dette;
                        return `Le client a une dette de ${dette.toFixed(3)} TND. Le retour couvrira d'abord cette dette, et il restera ${reste.toFixed(3)} TND à rembourser (au choix : crédit ou espèces).`;
                      }
                    } else {
                      return `Le client n'a aucune dette (Solde en sa faveur : ${solde.toFixed(3)} TND). Le montant total de ${total.toFixed(3)} TND peut être ajouté en crédit ou rendu en espèces.`;
                    }
                  })()}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="modeRemboursement"
                    value="credit"
                    checked={modeRemboursement === 'credit'}
                    onChange={(e) => setModeRemboursement(e.target.value)}
                  />
                  Créditer le compte (ou régler factures)
                </label>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  cursor: (() => {
                    const client = clients.find(c => c.id_client === parseInt(selectedClientId));
                    const solde = client ? parseFloat(client.solde_compte) : 0;
                    const dette = solde < 0 ? Math.abs(solde) : 0;
                    return (dette > 0 && dette >= total) ? 'not-allowed' : 'pointer';
                  })(),
                  opacity: (() => {
                    const client = clients.find(c => c.id_client === parseInt(selectedClientId));
                    const solde = client ? parseFloat(client.solde_compte) : 0;
                    const dette = solde < 0 ? Math.abs(solde) : 0;
                    return (dette > 0 && dette >= total) ? 0.5 : 1;
                  })()
                }}>
                  <input
                    type="radio"
                    name="modeRemboursement"
                    value="especes"
                    checked={modeRemboursement === 'especes'}
                    onChange={(e) => setModeRemboursement(e.target.value)}
                    disabled={(() => {
                      const client = clients.find(c => c.id_client === parseInt(selectedClientId));
                      const solde = client ? parseFloat(client.solde_compte) : 0;
                      const dette = solde < 0 ? Math.abs(solde) : 0;
                      return (dette > 0 && dette >= total);
                    })()}
                  />
                  Rembourser en Espèces
                </label>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Montant Total à Retourner</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f87171' }}>
                {total.toFixed(3)} TND
              </div>
            </div>
          </div>
        </div>
        
        {/* WhatsApp Checkbox */}
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-start' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
            <input type="checkbox" checked={sendWhatsapp} onChange={(e) => setSendWhatsapp(e.target.checked)} />
            Envoyer une notification WhatsApp
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading || lignes.length === 0 || !selectedClientId || !modeRemboursement}>
            {loading ? 'Création...' : 'Valider le Retour'}
          </button>
        </div>
      </form>
    </Modal>
  );
};