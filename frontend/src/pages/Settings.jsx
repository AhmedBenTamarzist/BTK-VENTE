import React, { useState, useEffect } from 'react';
import { toast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { Settings as SettingsIcon, Save, Building, Phone, Mail, FileText, CreditCard } from 'lucide-react';

export const Settings = () => {
  const [raisonSociale, setRaisonSociale] = useState('');
  const [matriculeFiscal, setMatriculeFiscal] = useState('');
  const [adresse, setAdresse] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [rib, setRib] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.getEnterprise()
      .then((ent) => {
        if (ent) {
          setRaisonSociale(ent.raison_sociale || '');
          setMatriculeFiscal(ent.matricule_fiscal || '');
          setAdresse(ent.adresse || '');
          setTelephone(ent.telephone || '');
          setEmail(ent.email || '');
          setRib(ent.rib || '');
        }
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    toast.error('');
    toast.success('');

    if (!raisonSociale.trim()) {
      setError('La raison sociale de l\'entreprise est obligatoire.');
      return;
    }

    try {
      setSaving(true);
      await api.updateEnterprise({
        raison_sociale: raisonSociale.trim(),
        matricule_fiscal: matriculeFiscal.trim() || null,
        adresse: adresse.trim() || null,
        telephone: telephone.trim() || null,
        email: email.trim() || null,
        rib: rib.trim() || null
      });

      setSuccess('Paramètres de l\'entreprise enregistrés avec succès ! Ces informations seront affichées sur tous les tickets et factures imprimés.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement des paramètres...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '800px' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Paramètres de l'Entreprise</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Informations de l'établissement imprimées sur les tickets de caisse et factures</p>
      </div>


      <div className="glass-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Raison Sociale / Nom de l'Enseigne *</label>
            <input className="form-input" value={raisonSociale} onChange={(e) => setRaisonSociale(e.target.value)} placeholder="ex: Quincaillerie Générale" required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Matricule Fiscal (MF)</label>
              <input className="form-input" value={matriculeFiscal} onChange={(e) => setMatriculeFiscal(e.target.value)} placeholder="ex: 1234567/A/M/000" />
            </div>

            <div className="form-group">
              <label className="form-label">Téléphone</label>
              <input className="form-input" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="ex: +216 71 000 000" />
            </div>

            <div className="form-group">
              <label className="form-label">Adresse Email</label>
              <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@quincaillerie.tn" />
            </div>

            <div className="form-group">
              <label className="form-label">RIB / Compte Bancaire</label>
              <input className="form-input" value={rib} onChange={(e) => setRib(e.target.value)} placeholder="ex: 03 000 0100012345678 99" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Adresse Physique (Imprimée)</label>
            <textarea className="form-textarea" rows={2} value={adresse} onChange={(e) => setAdresse(e.target.value)} placeholder="Avenue Habib Bourguiba, Tunis" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              <Save size={16} /> {saving ? 'Enregistrement...' : 'Enregistrer les Paramètres'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};