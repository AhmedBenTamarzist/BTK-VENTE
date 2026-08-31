import React, { useState } from 'react';
import { toast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { Package, Plus, Search, Edit, History, AlertTriangle, RefreshCw } from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { usePolling } from '../hooks/usePolling';

export const ArticlesCatalog = () => {
  const { user } = useAuth();
  const canEdit = user?.role !== 'vendeur' && user?.role !== 'caissier';
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edit / Price History modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);

  // Edit form state
  const [nom, setNom] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [prixVenteTtc, setPrixVenteTtc] = useState('');
  const [remiseMax, setRemiseMax] = useState('0');
  const [idCategorie, setIdCategorie] = useState('');
  const [error, setError] = useState('');

  const fetchArticles = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [arts, cats] = await Promise.all([
        api.getArticles(search, selectedCat, lowStockOnly),
        api.getCategories()
      ]);
      setArticles(arts);
      setCategories(cats);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  usePolling(fetchArticles, [search, selectedCat, lowStockOnly]);

  const handleOpenEdit = (art) => {
    setSelectedArticle(art);
    if (art) {
      setNom(art.nom);
      setReference(art.reference || '');
      setDescription(art.description || '');
      setPrixVenteTtc(String(art.prix_vente_ttc));
      setRemiseMax(String(art.remise_max_pourcentage || 0));
      setIdCategorie(art.id_categorie ? String(art.id_categorie) : '');
    } else {
      setNom('');
      setReference('');
      setDescription('');
      setPrixVenteTtc('');
      setRemiseMax('0');
      setIdCategorie('');
    }
    setShowEditModal(true);
  };

  const handleSaveArticle = async () => {
    toast.error('');
    if (!nom.trim() || !prixVenteTtc) {
      toast.error('Le nom et le prix de vente TTC sont obligatoires.');
      return;
    }

    try {
      const payload = {
        nom: nom.trim(),
        prix_vente_ttc: parseFloat(prixVenteTtc),
        reference: reference.trim() || null,
        description: description.trim() || null,
        remise_max_pourcentage: parseFloat(remiseMax) || 0,
        id_categorie: idCategorie ? parseInt(idCategorie) : null
      };

      if (selectedArticle) {
        await api.updateArticle(selectedArticle.id_article, payload);
      } else {
        await api.createArticle(payload);
      }

      setShowEditModal(false);
      fetchArticles();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleViewHistory = async (art) => {
    try {
      setSelectedArticle(art);
      const hist = await api.getPriceHistory(art.id_article);
      setPriceHistory(hist);
      setShowHistoryModal(true);
    } catch (err) {
      alert(`Erreur: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Catalogue des Articles</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Gestion du catalogue d'articles, prix de vente TTC et remises autorisées</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenEdit(null)} style={{ display: canEdit ? '' : 'none' }}>
          <Plus size={16} /> + Nouvel Article
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-card" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.5fr', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '2.5rem' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou référence..."
          />
        </div>

        <select className="form-select" value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)}>
          <option value="">Toutes les Catégories</option>
          {categories.map((c) => (
            <option key={c.id_categorie} value={c.id_categorie}>{c.nom}</option>
          ))}
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} /> Stock Faible
        </label>

        <button className="btn btn-outline" onClick={fetchArticles}>
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Table */}
      <div className="glass-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Nom de l'Article</th>
                <th>Catégorie</th>
                <th style={{ textAlign: 'right' }}>Prix Vente TTC</th>
                <th style={{ textAlign: 'center' }}>TVA %</th>
                <th style={{ textAlign: 'center' }}>Remise Max %</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>Chargement des articles...</td></tr>
              ) : articles.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Aucun article trouvé.</td></tr>
              ) : (
                articles.map((art) => {
                  const cat = categories.find((c) => c.id_categorie === art.id_categorie);
                  return (
                    <tr key={art.id_article}>
                      <td><strong style={{ color: 'white' }}>{art.reference || 'N/A'}</strong></td>
                      <td>{art.nom}</td>
                      <td>{cat ? cat.nom : '-'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#34d399' }}>
                        {parseFloat(art.prix_vente_ttc).toFixed(3)} TND
                      </td>
                      <td style={{ textAlign: 'center' }}>{parseFloat(art.taux_tva_vente)}%</td>
                      <td style={{ textAlign: 'center' }}>{parseFloat(art.remise_max_pourcentage)}%</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                          <button className="btn btn-outline btn-sm" title="Historique des prix" onClick={() => handleViewHistory(art)}>
                            <History size={14} />
                          </button>
                          {canEdit && <button className="btn btn-outline btn-sm" title="Modifier l'article" onClick={() => handleOpenEdit(art)}>
                            <Edit size={14} />
                          </button>}
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

      {/* Edit / Create Article Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={selectedArticle ? `Modifier Article - ${selectedArticle.nom}` : 'Créer un Article'}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowEditModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSaveArticle}>Enregistrer</button>
          </>
        }
      >

        <div className="form-group">
          <label className="form-label">Nom de l'Article *</label>
          <input className="form-input" value={nom} onChange={(e) => setNom(e.target.value)} required />
        </div>

        <div className="form-group">
          <label className="form-label">Description (Détails, Spécifications...)</label>
          <textarea 
            className="form-textarea" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            placeholder="Informations complémentaires, dimensions, couleur, etc."
            rows={2}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Référence / SKU</label>
            <input className="form-input" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Catégorie</label>
            <select className="form-select" value={idCategorie} onChange={(e) => setIdCategorie(e.target.value)}>
              <option value="">-- Aucune --</option>
              {categories.map((c) => (
                <option key={c.id_categorie} value={c.id_categorie}>{c.nom}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Prix Vente TTC (TND) *</label>
            <input className="form-input" type="number" step="0.001" value={prixVenteTtc} onChange={(e) => setPrixVenteTtc(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Remise Max Autorisée (%)</label>
            <input className="form-input" type="number" step="1" value={remiseMax} onChange={(e) => setRemiseMax(e.target.value)} />
          </div>
        </div>
      </Modal>

      {/* Price History Modal */}
      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title={`Historique des Prix de Vente - ${selectedArticle?.nom}`}
      >
        <table className="custom-table">
          <thead>
            <tr>
              <th>Date d'effet</th>
              <th>Prix Vente TTC</th>
              <th>Taux TVA</th>
            </tr>
          </thead>
          <tbody>
            {priceHistory.length === 0 ? (
              <tr><td colSpan={3} style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>Aucun changement de prix enregistré.</td></tr>
            ) : (
              priceHistory.map((h, i) => (
                <tr key={i}>
                  <td>{new Date(h.date_effet).toLocaleString('fr-FR')}</td>
                  <td style={{ fontWeight: 'bold', color: '#34d399' }}>{parseFloat(h.prix_ttc).toFixed(3)} TND</td>
                  <td>{parseFloat(h.taux_tva)}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Modal>
    </div>
  );
};