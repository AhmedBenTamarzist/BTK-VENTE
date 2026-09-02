import React, { useState } from 'react';
import { api } from '../services/api';
import { Search, History, Award, TrendingDown } from 'lucide-react';
import { usePolling } from '../hooks/usePolling';

export const ArticlePurchases = () => {
  const [articles, setArticles] = useState([]);
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [bestPrice, setBestPrice] = useState(null);
  const [achats, setAchats] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchArticlesList = async () => {
    try {
      const arts = await api.getArticles('');
      setArticles(arts);
      // Ne présélectionne le premier article que si rien n'est déjà choisi (évite de
      // réinitialiser la sélection de l'utilisateur à chaque rafraîchissement silencieux)
      setSelectedArticleId((prev) => prev || (arts.length > 0 ? String(arts[0].id_article) : ''));
    } catch (err) {
      console.error(err);
    }
  };

  usePolling(fetchArticlesList, []);

  const fetchPurchaseHistory = async (silent = false) => {
    if (!selectedArticleId) return;
    try {
      if (!silent) setLoading(true);
      const [bestData, allAchats] = await Promise.all([
        api.getBestSupplierPrice(selectedArticleId),
        api.getAchats()
      ]);
      setBestPrice(bestData.id_article ? bestData : null);

      // Filter purchase history for this article
      const artAchats = [];
      allAchats.forEach((a) => {
        (a.lignes || []).forEach((l) => {
          if (String(l.id_article) === String(selectedArticleId)) {
            artAchats.push({
              ...l,
              achat: a
            });
          }
        });
      });
      setAchats(artAchats);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  usePolling(fetchPurchaseHistory, [selectedArticleId]);

  const selectedArt = articles.find((a) => String(a.id_article) === String(selectedArticleId));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Historique d'Achat par Article & Comparateur</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Analyse des offres fournisseurs et comparaison des meilleurs prix d'achat par article</p>
        </div>
      </div>

      {/* Article Selector */}
      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <label className="form-label" style={{ margin: 0 }}>Sélectionner un Article :</label>
        <select
          className="form-select"
          style={{ maxWidth: '400px' }}
          value={selectedArticleId}
          onChange={(e) => setSelectedArticleId(e.target.value)}
        >
          {articles.map((a) => (
            <option key={a.id_article} value={a.id_article}>{a.nom} (Réf: {a.reference || 'N/A'})</option>
          ))}
        </select>
      </div>

      {selectedArt && (
        <>
          {/* Best Supplier Price Card */}
          <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(14, 165, 233, 0.15) 100%)', border: '1px solid #10b981', borderRadius: '12px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#34d399', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              <Award size={22} />
              <span>Fournisseur Le Moins Cher Actuellement :</span>
            </div>

            {bestPrice ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.4rem', margin: '0 0 0.25rem 0', color: 'var(--text-main)' }}>{bestPrice.nom_fournisseur}</h3>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Dernière offre reçue le : {new Date(bestPrice.date_derniere_offre).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#34d399' }}>
                    {parseFloat(bestPrice.prix_achat_ttc).toFixed(3)} TND TTC
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Prix d'achat TTC unitaire</div>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Aucune offre d'achat enregistrée pour cet article. Enregistrez un achat fournisseur pour alimenter le comparateur.
              </div>
            )}
          </div>

          {/* Full Purchase History Table */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
              <History size={18} inline style={{ marginRight: '0.5rem' }} />
              Historique des Achats de cet Article
            </h3>

            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Fournisseur</th>
                    <th>N° Facture Fournisseur</th>
                    <th>Date d'Achat</th>
                    <th style={{ textAlign: 'right' }}>Quantité Achetée</th>
                    <th style={{ textAlign: 'right' }}>Prix Achat HT</th>
                    <th style={{ textAlign: 'right' }}>Prix Achat TTC</th>
                    <th style={{ textAlign: 'right' }}>Montant Ligne TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>Chargement de l'historique...</td></tr>
                  ) : achats.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucun achat trouvé pour cet article.</td></tr>
                  ) : (
                    achats.map((item, idx) => (
                      <tr key={idx}>
                        <td><strong style={{ color: 'var(--text-main)' }}>{item.achat?.fournisseur?.nom || `Fournisseur #${item.achat?.id_fournisseur}`}</strong></td>
                        <td>{item.achat?.numero_facture_fournisseur || 'N/A'}</td>
                        <td>{new Date(item.achat?.date_achat).toLocaleDateString('fr-FR')}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{parseFloat(item.quantite)}</td>
                        <td style={{ textAlign: 'right' }}>{parseFloat(item.prix_achat_ht).toFixed(3)} TND</td>
                        <td style={{ textAlign: 'right', color: '#34d399', fontWeight: 'bold' }}>{parseFloat(item.prix_achat_ttc).toFixed(3)} TND</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{parseFloat(item.montant_ligne_ttc).toFixed(3)} TND</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
