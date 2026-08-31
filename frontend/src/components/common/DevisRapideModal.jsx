import React, { useState, useEffect, useRef } from 'react';
import { toast } from '../../contexts/ToastContext';
import { api } from '../../services/api';
import { Modal } from './Modal';
import { DevisPrint } from '../print/DevisPrint';
import { generateFacturePdf } from '../../utils/generateFacturePdf';
import { Search, Trash2, Printer, FileText } from 'lucide-react';

// Devis rapide : rien n'est sauvegardé en base — sert uniquement à composer
// une liste de vrais articles avec de vraies quantités (choisies par
// l'utilisateur) pour obtenir un aperçu imprimable. Le total est calculé à
// partir des lignes, jamais l'inverse.
export const DevisRapideModal = ({ isOpen, onClose }) => {
  const [clientNom, setClientNom] = useState('');
  const [articleSearch, setArticleSearch] = useState('');
  const [articleResults, setArticleResults] = useState([]);
  const [lignes, setLignes] = useState([]);
  const [montantCible, setMontantCible] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const searchTimeout = useRef(null);
  const printRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setClientNom('');
      setArticleSearch('');
      setArticleResults([]);
      setLignes([]);
      setMontantCible('');
    }
  }, [isOpen]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    const q = articleSearch.trim();
    if (!q) { setArticleResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await api.getArticles(q);
        setArticleResults(results.slice(0, 8));
      } catch { /* silencieux */ }
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [articleSearch]);

  const addArticle = (art) => {
    setLignes((prev) => {
      const existing = prev.find((l) => l.id_article === art.id_article);
      if (existing) {
        return prev.map((l) => l.id_article === art.id_article ? { ...l, quantite: l.quantite + 1 } : l);
      }
      return [...prev, {
        id_article: art.id_article,
        nom: art.nom,
        quantite: 1,
        prix_unitaire_ttc: parseFloat(art.prix_vente_ttc) || 0,
        taux_tva: parseFloat(art.taux_tva_vente) || 19,
      }];
    });
    setArticleSearch('');
    setArticleResults([]);
  };

  const updateLigne = (idArticle, field, value) => {
    setLignes((prev) => prev.map((l) => l.id_article === idArticle ? { ...l, [field]: value } : l));
  };

  const removeLigne = (idArticle) => {
    setLignes((prev) => prev.filter((l) => l.id_article !== idArticle));
  };

  const handleGenerateTarget = async () => {
    if (!montantCible || parseFloat(montantCible) <= 0) {
      toast.error('Veuillez saisir un montant cible valide.');
      return;
    }
    try {
      setIsGenerating(true);
      const articles = await api.getArticles('');
      const validArticles = articles.filter(a => parseFloat(a.prix_vente_ttc) > 0);

      if (validArticles.length === 0) {
        toast.error('Aucun article valide trouvé pour la génération.');
        return;
      }

      const target = parseFloat(montantCible);

      // Mélanger et choisir jusqu'à 10 articles différents
      const shuffled = [...validArticles].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.min(10, shuffled.length));

      // Allouer une part du budget à chaque article sélectionné
      const partBudget = target / selected.length;
      const newLignes = [];
      let currentTotal = 0;

      for (const art of selected) {
        const prix = parseFloat(art.prix_vente_ttc);
        const remaining = target - currentTotal;
        if (remaining < prix) continue;

        // Quantité pour atteindre approximativement la part allouée
        const idealQty = partBudget / prix;
        // On prend entre 1 et l'idéal, avec un peu de variété
        const variation = 0.7 + Math.random() * 0.6; // 0.7x à 1.3x
        let qty = Math.max(1, Math.floor(idealQty * variation));

        // Ne pas dépasser le budget restant
        qty = Math.min(qty, Math.floor(remaining / prix));
        if (qty < 1) continue;

        newLignes.push({
          id_article: art.id_article,
          nom: art.nom,
          quantite: qty,
          prix_unitaire_ttc: prix,
          taux_tva: parseFloat(art.taux_tva_vente) || 19,
        });
        currentTotal += qty * prix;
      }

      // 2e passe : remplir le reste avec l'article le moins cher disponible
      const remaining = target - currentTotal;
      if (remaining >= 0.001) {
        // Trouver l'article avec le prix le plus proche du reste
        const sortedByPrice = [...validArticles].sort((a, b) => parseFloat(b.prix_vente_ttc) - parseFloat(a.prix_vente_ttc));
        for (const art of sortedByPrice) {
          const prix = parseFloat(art.prix_vente_ttc);
          const rem = target - currentTotal;
          if (prix > rem) continue;
          const qty = Math.floor(rem / prix);
          if (qty < 1) continue;
          // Chercher si l'article est déjà dans la liste
          const existing = newLignes.find(l => l.id_article === art.id_article);
          if (existing) {
            existing.quantite += qty;
          } else {
            newLignes.push({
              id_article: art.id_article,
              nom: art.nom,
              quantite: qty,
              prix_unitaire_ttc: prix,
              taux_tva: parseFloat(art.taux_tva_vente) || 19,
            });
          }
          currentTotal += qty * prix;
          break;
        }
      }

      if (newLignes.length === 0) {
        toast.error('Impossible de générer des articles pour ce montant (articles trop chers ?).');
        return;
      }

      setLignes(newLignes);
      const diff = Math.abs(target - currentTotal);
      toast.success(`Articles générés ! Total : ${currentTotal.toFixed(3)} TND (écart : ${diff.toFixed(3)} TND)`);
    } catch (err) {
      toast.error('Erreur lors de la génération: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const totalTtc = lignes.reduce((s, l) => s + (parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire_ttc) || 0), 0);

  const handlePrint = () => {
    if (!clientNom.trim()) {
      toast.error('Veuillez indiquer le nom du client.');
      return;
    }
    if (lignes.length === 0) {
      toast.error('Veuillez ajouter au moins un article.');
      return;
    }
    setShowPrintModal(true);
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    try {
      setGeneratingPdf(true);
      await generateFacturePdf(printRef.current, `Devis_${clientNom.trim().replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      toast.error('Erreur lors de la génération du PDF: ' + err.message);
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Devis Rapide"
        maxWidth="700px"
        footer={
          <>
            <button className="btn btn-outline" onClick={onClose}>Fermer</button>
            <button className="btn btn-primary" onClick={handlePrint}>
              <Printer size={16} /> Aperçu & Impression
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Nom du Client</label>
            <input
              type="text"
              className="form-input"
              placeholder="ex: Ahmed Ben Salah"
              value={clientNom}
              onChange={(e) => setClientNom(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Générer selon un montant (Optionnel)</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="number"
                min="0"
                step="0.001"
                className="form-input"
                placeholder="Montant Cible (TND)"
                value={montantCible}
                onChange={(e) => setMontantCible(e.target.value)}
              />
              <button 
                className="btn btn-outline" 
                onClick={handleGenerateTarget}
                disabled={isGenerating}
                style={{ flexShrink: 0 }}
              >
                {isGenerating ? '...' : 'Générer'}
              </button>
            </div>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Ajouter un article</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.5rem' }}
                placeholder="Rechercher un article..."
                value={articleSearch}
                onChange={(e) => setArticleSearch(e.target.value)}
              />
              {articleResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '0.25rem', maxHeight: '220px', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                  {articleResults.map((art) => (
                    <div
                      key={art.id_article}
                      onClick={() => addArticle(art)}
                      style={{ padding: '0.55rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span>{art.nom}</span>
                      <span style={{ color: '#94a3b8' }}>{parseFloat(art.prix_vente_ttc).toFixed(3)} TND</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {lignes.length > 0 && (
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th style={{ width: '90px' }}>Qté</th>
                    <th style={{ width: '110px' }}>P.U TTC</th>
                    <th style={{ width: '110px' }}>Total TTC</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.id_article}>
                      <td>{l.nom}</td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          className="form-input"
                          style={{ padding: '0.25rem 0.4rem', textAlign: 'center' }}
                          value={l.quantite}
                          onChange={(e) => updateLigne(l.id_article, 'quantite', e.target.value === '' ? '' : parseFloat(e.target.value))}
                          onBlur={(e) => { if (!e.target.value || parseFloat(e.target.value) < 1) updateLigne(l.id_article, 'quantite', 1); }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          className="form-input"
                          style={{ padding: '0.25rem 0.4rem', textAlign: 'right' }}
                          value={l.prix_unitaire_ttc}
                          onChange={(e) => updateLigne(l.id_article, 'prix_unitaire_ttc', e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        {((parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire_ttc) || 0)).toFixed(3)} TND
                      </td>
                      <td>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ color: '#f87171', borderColor: '#f87171', padding: '0.25rem 0.4rem' }}
                          onClick={() => removeLigne(l.id_article)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {lignes.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '1.05rem', fontWeight: 'bold', color: '#34d399' }}>
              TOTAL TTC : {totalTtc.toFixed(3)} TND
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Aperçu du Devis"
        maxWidth="820px"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowPrintModal(false)}>Fermer</button>
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
          <DevisPrint ref={printRef} clientNom={clientNom} lignes={lignes} />
        </div>
      </Modal>
    </>
  );
};
