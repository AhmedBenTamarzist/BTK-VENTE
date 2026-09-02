import React, { useState, useEffect } from 'react';
import { toast } from '../../contexts/ToastContext';
import { Modal } from './Modal';
import { api } from '../../services/api';

export const EditClientModal = ({ isOpen, onClose, client, onClientUpdated }) => {
  const [typeClient, setTypeClient] = useState('physique');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [matriculeFiscal, setMatriculeFiscal] = useState('');
  const [plafondCredit, setPlafondCredit] = useState('0.000');
  const [delaiRelance, setDelaiRelance] = useState('30');
  const [adresse, setAdresse] = useState('');
  const [email, setEmail] = useState('');
  const [actif, setActif] = useState(true);
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (client && isOpen) {
      setTypeClient(client.type_client || 'physique');
      setNom(client.nom || '');
      setPrenom(client.prenom || '');
      setTelephone(client.telephone || '');
      setMatriculeFiscal(client.matricule_fiscal || '');
      setPlafondCredit(client.plafond_credit ? parseFloat(client.plafond_credit).toFixed(3) : '0.000');
      setDelaiRelance(client.delai_relance_jours?.toString() || '30');
      setAdresse(client.adresse || '');
      setEmail(client.email || '');
      setActif(client.actif ?? true);
    }
    // Ne dépend que de l'identité du client (pas de l'objet entier) : sinon
    // le rafraîchissement automatique en arrière-plan (usePolling) fournit un
    // nouvel objet `client` toutes les 20s et écrase ce que l'utilisateur est
    // en train de taper dans le formulaire, même sans changer de client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id_client, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nom.trim()) {
      toast.error('Le nom ou raison sociale est obligatoire.');
      return;
    }

    try {
      setLoading(true);
      const updatedClient = await api.updateClient(client.id_client, {
        type_client: typeClient,
        nom: nom.trim(),
        prenom: typeClient === 'physique' ? prenom.trim() : null,
        telephone: telephone.trim() || null,
        matricule_fiscal: matriculeFiscal.trim() || null,
        plafond_credit: parseFloat(plafondCredit) || 0,
        delai_relance_jours: parseInt(delaiRelance, 10) || 30,
        adresse: adresse.trim() || null,
        email: email.trim() || null,
        actif: actif
      });

      onClientUpdated(updatedClient);
      onClose();
      toast.success('Fiche client mise à jour avec succès.');
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
      title={`Modifier Client - ${client?.nom}`}
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose} type="button" disabled={loading}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} type="button" disabled={loading}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
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
          <input className="form-input" value={nom} onChange={(e) => setNom(e.target.value)} required />
        </div>

        {typeClient === 'physique' ? (
          <div className="form-group">
            <label className="form-label">Prénom</label>
            <input className="form-input" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">Matricule Fiscal (MF)</label>
            <input className="form-input" value={matriculeFiscal} onChange={(e) => setMatriculeFiscal(e.target.value)} />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Téléphone</label>
          <input className="form-input" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label className="form-label">Adresse Complète</label>
          <input className="form-input" value={adresse} onChange={(e) => setAdresse(e.target.value)} />
        </div>
        
        {typeClient === 'physique' && (
          <div className="form-group">
            <label className="form-label">Matricule Fiscal (MF)</label>
            <input className="form-input" value={matriculeFiscal} onChange={(e) => setMatriculeFiscal(e.target.value)} />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Plafond Crédit (TND)</label>
          <input className="form-input" type="number" step="1" value={plafondCredit} onChange={(e) => setPlafondCredit(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Délai Relance (Jours)</label>
          <input className="form-input" type="number" step="1" value={delaiRelance} onChange={(e) => setDelaiRelance(e.target.value)} />
        </div>
        
        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} />
            Compte Actif
          </label>
        </div>
      </div>
    </Modal>
  );
};
