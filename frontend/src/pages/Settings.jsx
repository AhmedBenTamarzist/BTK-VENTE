import React, { useState, useEffect } from 'react';
import { toast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { Settings as SettingsIcon, Save, Building, Phone, Mail, FileText, CreditCard, DatabaseBackup, PlayCircle } from 'lucide-react';

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

  // Sauvegardes automatiques
  const [backupActif, setBackupActif] = useState(false);
  const [heureEnvoi, setHeureEnvoi] = useState('22:00');
  const [smtpEmail, setSmtpEmail] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpPasswordDefini, setSmtpPasswordDefini] = useState(false);
  const [emailDestinataire, setEmailDestinataire] = useState('');
  const [derniereSauvegarde, setDerniereSauvegarde] = useState(null);
  const [dernierStatut, setDernierStatut] = useState(null);
  const [dernierMessage, setDernierMessage] = useState(null);
  const [backupLoading, setBackupLoading] = useState(true);
  const [backupSaving, setBackupSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);

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

    loadBackupSettings();
  }, []);

  const loadBackupSettings = () => {
    setBackupLoading(true);
    api.getBackupSettings()
      .then((b) => {
        setBackupActif(b.actif);
        setHeureEnvoi(b.heure_envoi || '22:00');
        setSmtpEmail(b.smtp_email || '');
        setSmtpPasswordDefini(b.smtp_password_defini);
        setEmailDestinataire(b.email_destinataire || '');
        setDerniereSauvegarde(b.derniere_sauvegarde);
        setDernierStatut(b.dernier_statut);
        setDernierMessage(b.dernier_message);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setBackupLoading(false));
  };

  const handleSaveBackup = async (e) => {
    e.preventDefault();
    try {
      setBackupSaving(true);
      const payload = {
        actif: backupActif,
        heure_envoi: heureEnvoi,
        smtp_email: smtpEmail.trim() || null,
        email_destinataire: emailDestinataire.trim() || null,
      };
      if (smtpPassword.trim()) payload.smtp_password = smtpPassword.trim();

      const updated = await api.updateBackupSettings(payload);
      setSmtpPasswordDefini(updated.smtp_password_defini);
      setSmtpPassword('');
      toast.success('Paramètres de sauvegarde enregistrés.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBackupSaving(false);
    }
  };

  const handleRunNow = async () => {
    try {
      setRunningNow(true);
      const result = await api.runBackupNow();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
      loadBackupSettings();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRunningNow(false);
    }
  };

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
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Informations de l'établissement imprimées sur les tickets de caisse et factures</p>
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

      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <DatabaseBackup size={22} /> Sauvegardes Automatiques
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sauvegarde quotidienne de la base de données, envoyée par email</p>
      </div>

      <div className="glass-card">
        {backupLoading ? (
          <div style={{ textAlign: 'center', padding: '1rem' }}>Chargement...</div>
        ) : (
          <form onSubmit={handleSaveBackup}>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <input
                type="checkbox"
                id="backup-actif"
                checked={backupActif}
                onChange={(e) => setBackupActif(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <label htmlFor="backup-actif" className="form-label" style={{ margin: 0 }}>
                Activer la sauvegarde automatique quotidienne
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Heure d'envoi</label>
                <input className="form-input" type="time" value={heureEnvoi} onChange={(e) => setHeureEnvoi(e.target.value)} />
              </div>

              <div className="form-group">
                <label className="form-label">Email destinataire</label>
                <input className="form-input" type="email" value={emailDestinataire} onChange={(e) => setEmailDestinataire(e.target.value)} placeholder="ex: abentamarzist@gmail.com" />
              </div>

              <div className="form-group">
                <label className="form-label">Email d'envoi (compte Gmail)</label>
                <input className="form-input" type="email" value={smtpEmail} onChange={(e) => setSmtpEmail(e.target.value)} placeholder="ex: monentreprise@gmail.com" />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Mot de passe d'application {smtpPasswordDefini && <span style={{ color: '#34d399', fontWeight: 400 }}>(déjà configuré)</span>}
                </label>
                <input
                  className="form-input"
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder={smtpPasswordDefini ? '••••••••••••••••' : 'Mot de passe d\'application Google'}
                />
              </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '-0.25rem' }}>
              Le mot de passe normal du compte Gmail ne fonctionne pas — il faut générer un
              "mot de passe d'application" (myaccount.google.com/apppasswords), avec la validation
              en 2 étapes activée sur ce compte Google.
            </p>

            {dernierMessage && (
              <div style={{
                marginTop: '0.5rem', padding: '0.6rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem',
                background: dernierStatut === 'succes' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)',
                color: dernierStatut === 'succes' ? '#34d399' : '#f87171',
                border: `1px solid ${dernierStatut === 'succes' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)'}`
              }}>
                <strong>Dernière sauvegarde</strong> {derniereSauvegarde ? `(${new Date(derniereSauvegarde).toLocaleString('fr-FR')})` : ''} : {dernierMessage}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn btn-outline" type="button" onClick={handleRunNow} disabled={runningNow}>
                <PlayCircle size={16} /> {runningNow ? 'Sauvegarde en cours...' : 'Sauvegarder maintenant'}
              </button>
              <button className="btn btn-primary" type="submit" disabled={backupSaving}>
                <Save size={16} /> {backupSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};