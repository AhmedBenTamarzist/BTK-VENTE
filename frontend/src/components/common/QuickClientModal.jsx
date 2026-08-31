import React, { useState } from 'react';
import { toast } from '../../contexts/ToastContext';
import { Modal } from './Modal';
import { api } from '../../services/api';

export const QuickClientModal = ({ isOpen, onClose, onClientCreated }) => {
  const [typeClient, setTypeClient] = useState('physique');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [matriculeFiscal, setMatriculeFiscal] = useState('');
  const [plafondCredit, setPlafondCredit] = useState('0.000');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    toast.error('');

    if (!nom.trim()) {
      toast.error('Le nom ou raison sociale est obligatoire.');
      return;
    }

    try {
      setLoading(true);
      const newClient = await api.createClient({
        type_client: typeClient,
        nom: nom.trim(),
        prenom: typeClient === 'physique' ? prenom.trim() : null,
        telephone: telephone.trim() || null,
        matricule_fiscal: matriculeFiscal.trim() || null,
        plafond_credit: parseFloat(plafondCredit) || 0,
        delai_relance_jours: 30
      });

      onClientCreated(newClient);
      onClose();
      // Reset form
      setNom('');
      setPrenom('');
      setTelephone('');
      setMatriculeFiscal('');
      setPlafondCredit('0.000');
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
      title="Nouveau Client Rapide"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose} type="button" disabled={loading}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} type="button" disabled={loading}>
            {loading ? 'Création...' : 'Créer Client'}
          </button>
        </>
      }
    >

      <div className="form-group">
        <label className="form-label">Type de Client</label>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input type="radio" value="physique" checked={typeClient === 'physique'} onChange={(e) => setTypeClient(e.target.value)} /> Particular / Physique
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input type="radio" value="societe" checked={typeClient === 'societe'} onChange={(e) => setTypeClient(e.target.value)} /> Société / Entreprise
          </label>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label className="form-label">{typeClient === 'physique' ? 'Nom *' : 'Raison Sociale *'}</label>
          <input className="form-input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder={typeClient === 'physique' ? 'ex: Ben Ali' : 'ex: STE Tomazi'} required />
        </div>

        {typeClient === 'physique' && (
          <div className="form-group">
            <label className="form-label">Prénom</label>
            <input className="form-input" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="ex: Mohamed" />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Téléphone</label>
          <input className="form-input" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="ex: 20 123 456" />
        </div>

        <div className="form-group">
          <label className="form-label">Matricule Fiscal (MF)</label>
          <input className="form-input" value={matriculeFiscal} onChange={(e) => setMatriculeFiscal(e.target.value)} placeholder="ex: 1234567/A" />
        </div>

        <div className="form-group">
          <label className="form-label">Plafond Crédit (TND)</label>
          <input className="form-input" type="number" step="100" value={plafondCredit} onChange={(e) => setPlafondCredit(e.target.value)} placeholder="0.000" />
        </div>
      </div>
    </Modal>
  );
};