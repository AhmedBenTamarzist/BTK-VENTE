import React, { useState } from 'react';
import { toast } from '../../contexts/ToastContext';
import { Modal } from './Modal';
import { api } from '../../services/api';

export const QuickArticleModal = ({ isOpen, onClose, onArticleCreated, initialName = '' }) => {
  const generateRefFromName = (name) => {
    const suffix = Date.now().toString().slice(-4);
    if (!name || !name.trim()) return `ART-${suffix}`;
    const prefix = name
      .trim()
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .map(w => w.slice(0, 4))
      .join('-');
    return `${prefix}-${suffix}`;
  };

  const [nom, setNom] = useState(initialName);
  const [description, setDescription] = useState('');
  const [prixVenteTtc, setPrixVenteTtc] = useState('');
  const [reference, setReference] = useState(() => generateRefFromName(initialName));
  const [remiseMax, setRemiseMax] = useState('0');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNomChange = (e) => {
    const val = e.target.value;
    setNom(val);
    setReference(generateRefFromName(val));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    toast.error('');

    if (!nom.trim() || !prixVenteTtc) {
      toast.error('Le nom et le prix de vente TTC sont obligatoires.');
      return;
    }

    try {
      setLoading(true);
      const newArticle = await api.createArticle({
        nom: nom.trim(),
        prix_vente_ttc: parseFloat(prixVenteTtc),
        reference: reference.trim() || null,
        description: description.trim() || null,
        remise_max_pourcentage: parseFloat(remiseMax) || 0,
        taux_tva_vente: 19.0,
        unite: 'piece',
        quantite_stock: 0,
        seuil_alerte_stock: 0
      });

      onArticleCreated(newArticle);
      onClose();
      // Reset form
      setNom('');
      setDescription('');
      setPrixVenteTtc('');
      setReference(generateRefFromName(''));
      setRemiseMax('0');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Créer un Article Rapide"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose} type="button" disabled={loading}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} type="button" disabled={loading}>
            {loading ? 'Création...' : 'Créer & Ajouter'}
          </button>
        </>
      }
    >

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label className="form-label">Nom de l'article *</label>
          <input className="form-input" value={nom} onChange={handleNomChange} placeholder="ex: Clé à molette 10 pouces" required />
        </div>

        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label className="form-label">Description (Optionnel)</label>
          <textarea 
            className="form-textarea" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            placeholder="Détails de l'article..."
            rows={2} 
          />
        </div>

        <div className="form-group">
          <label className="form-label">Prix de vente TTC (TND) *</label>
          <input className="form-input" type="number" step="0.001" value={prixVenteTtc} onChange={(e) => setPrixVenteTtc(e.target.value)} placeholder="0.000" required />
        </div>

        <div className="form-group">
          <label className="form-label">Référence / SKU</label>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input
              className="form-input"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="ex: CLE-010"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setReference(generateRefFromName(nom))}
              title="Regénérer la référence à partir du nom"
              style={{ whiteSpace: 'nowrap', padding: '0.35rem 0.6rem' }}
            >
              🔄
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Remise Max Autorisée (%)</label>
          <input className="form-input" type="number" step="1" value={remiseMax} onChange={(e) => setRemiseMax(e.target.value)} placeholder="0" />
        </div>
      </div>
    </Modal>
  );
};