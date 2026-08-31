import React, { useState, useEffect } from 'react';
import { toast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { UserCheck, Plus, Edit, RefreshCw } from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('vendeur'); // admin, vendeur, caissier, gestionnaire_stock
  const [telephone, setTelephone] = useState('');
  const [actif, setActif] = useState(true);
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenModal = (u) => {
    setSelectedUser(u);
    if (u) {
      setNom(u.nom);
      setPrenom(u.prenom || '');
      setEmail(u.email);
      setPassword(''); // keep blank unless changing
      setRole(u.role);
      setTelephone(u.telephone || '');
      setActif(u.actif);
    } else {
      setNom('');
      setPrenom('');
      setEmail('');
      setPassword('');
      setRole('vendeur');
      setTelephone('');
      setActif(true);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    toast.error('');
    if (!nom.trim() || !email.trim()) {
      setError('Le nom et l\'adresse email sont obligatoires.');
      return;
    }
    if (!selectedUser && !password) {
      setError('Le mot de passe est obligatoire pour la création d\'un utilisateur.');
      return;
    }

    try {
      const payload = {
        nom: nom.trim(),
        prenom: prenom.trim() || null,
        email: email.trim(),
        role,
        telephone: telephone.trim() || null,
        actif
      };
      if (password) {
        payload.mot_de_passe = password;
      }

      if (selectedUser) {
        await api.updateUser(selectedUser.id_utilisateur, payload);
      } else {
        await api.createUser({ ...payload, mot_de_passe: password });
      }

      setShowModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Gestion des Utilisateurs & Accès</h2>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Administration des comptes vendeurs, caissiers et gestionnaires de stock</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal(null)}>
          <Plus size={16} /> + Nouvel Utilisateur
        </button>
      </div>

      <div className="glass-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Nom & Prénom</th>
                <th>Adresse Email</th>
                <th>Rôle</th>
                <th>Téléphone</th>
                <th style={{ textAlign: 'center' }}>Statut</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Chargement des utilisateurs...</td></tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id_utilisateur}>
                    <td><strong style={{ color: 'white' }}>{u.nom} {u.prenom || ''}</strong></td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-danger' : u.role === 'caissier' ? 'badge-warning' : 'badge-info'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>{u.telephone || 'N/A'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${u.actif ? 'badge-success' : 'badge-secondary'}`}>
                        {u.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => handleOpenModal(u)}>
                        <Edit size={14} /> Modifier
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
        title={selectedUser ? `Modifier Utilisateur - ${selectedUser.nom}` : 'Nouveau Compte Utilisateur'}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSave}>Enregistrer</button>
          </>
        }
      >

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Nom *</label>
            <input className="form-input" value={nom} onChange={(e) => setNom(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Prénom</label>
            <input className="form-input" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Adresse Email *</label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Mot de Passe {selectedUser && '(Laisser vide pour conserver)'}</label>
            <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          <div className="form-group">
            <label className="form-label">Rôle Système *</label>
            <select className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="vendeur">Vendeur</option>
              <option value="caissier">Caissier</option>
              <option value="gestionnaire_stock">Gestionnaire de Stock</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Téléphone</label>
            <input className="form-input" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} /> Compte Actif
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
};