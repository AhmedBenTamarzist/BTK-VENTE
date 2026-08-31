import React, { useState } from 'react';
import { toast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { Truck, Plus, Search, Eye, RefreshCw } from 'lucide-react';
import { Modal } from '../components/common/Modal';
import { usePolling } from '../hooks/usePolling';

export const FournisseursList = () => {
  const [fournisseurs, setFournisseurs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedFournisseur, setSelectedFournisseur] = useState(null);
  const [nom, setNom] = useState('');
  const [matriculeFiscal, setMatriculeFiscal] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [adresse, setAdresse] = useState('');
  const [error, setError] = useState('');

  const fetchFournisseurs = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await api.getFournisseurs(search);
      setFournisseurs(data);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  usePolling(fetchFournisseurs, [search]);

  const handleOpenModal = (f) => {
    setSelectedFournisseur(f);
    if (f) {
      setNom(f.nom);
      setMatriculeFiscal(f.matricule_fiscal || '');
      setTelephone(f.telephone || '');
      setEmail(f.email || '');
      setAdresse(f.adresse || '');
    } else {
      setNom('');
      setMatriculeFiscal('');
      setTelephone('');
      setEmail('');
      setAdresse('');
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    toast.error('');
    if (!nom.trim()) {
      toast.error('Le nom du fournisseur est obligatoire.');
      return;
    }

    try {
      const payload = {
        nom: nom.trim(),
        matricule_fiscal: matriculeFiscal.trim() || null,
        telephone: telephone.trim() || null,
        email: email.trim() || null,
        adresse: adresse.trim() || null
      };

      if (selectedFournisseur) {
        await api.updateFournisseur(selectedFournisseur.id_fournisseur, payload);
      } else {
        await api.createFournisseur(payload);
      }

      setShowModal(false);
      fetchFournisseurs();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Gestion des Fournisseurs</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Répertoire des fournisseurs et partenaires d'approvisionnement</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal(null)}>
          <Plus size={16} /> + Nouveau Fournisseur
        </button>
      </div>

      <div className="glass-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '2.5rem' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou téléphone..."
          />
        </div>
        <button className="btn btn-outline" onClick={fetchFournisseurs}>
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="glass-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Fournisseur</th>
                <th>Matricule Fiscal</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th>Adresse</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Chargement des fournisseurs...</td></tr>
              ) : fournisseurs.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Aucun fournisseur trouvé.</td></tr>
              ) : (
                fournisseurs.map((f) => (
                  <tr key={f.id_fournisseur}>
                    <td><strong style={{ color: 'white' }}>{f.nom}</strong></td>
                    <td>{f.matricule_fiscal || 'N/A'}</td>
                    <td>{f.telephone || 'N/A'}</td>
                    <td>{f.email || 'N/A'}</td>
                    <td>{f.adresse || 'N/A'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => handleOpenModal(f)}>
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={selectedFournisseur ? `Modifier - ${selectedFournisseur.nom}` : 'Nouveau Fournisseur'}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave}>Enregistrer</button>
          </>
        }
      >

        <div className="form-group">
          <label className="form-label">Nom du Fournisseur *</label>
          <input className="form-input" value={nom} onChange={(e) => setNom(e.target.value)} required />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Matricule Fiscal</label>
            <input className="form-input" value={matriculeFiscal} onChange={(e) => setMatriculeFiscal(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Téléphone</label>
            <input className="form-input" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Adresse Email</label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Adresse Physique</label>
            <input className="form-input" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
};