import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { toast } from '../contexts/ToastContext';
import { MessageCircle, Search, Calendar, RefreshCcw, CalendarPlus, X } from 'lucide-react';
import { usePolling } from '../hooks/usePolling';
import { Modal } from '../components/common/Modal';

export const RelancesList = () => {
  const [relances, setRelances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sendingId, setSendingId] = useState(null);

  const fetchRelances = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await api.getRelances('', 'planifiee'); // backend filters by statut="planifiee"

      // On n'affiche que ce qui est dû aujourd'hui (ou en retard) ET dont le client a
      // toujours du crédit à ce jour — s'il a payé entre-temps, la relance ne s'affiche pas.
      const todayStr = new Date().toISOString().split('T')[0];
      const dueRelances = data.filter(r =>
        r.date_planifiee <= todayStr && parseFloat(r.client?.solde_compte || 0) < 0
      );

      setRelances(dueRelances);
    } catch (error) {
      if (!silent) toast.error('Erreur lors du chargement des relances: ' + error.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  usePolling(fetchRelances, []);

  // ── Fenêtre "après combien de jours renvoyer" — ouverte avant l'envoi WhatsApp ──
  const [sendModalRelance, setSendModalRelance] = useState(null);
  const [nextDelaiJours, setNextDelaiJours] = useState(30);

  const openSendModal = (relance) => {
    setSendModalRelance(relance);
    setNextDelaiJours(relance.client?.delai_relance_jours || 30);
  };

  const confirmSendWhatsapp = async () => {
    if (!sendModalRelance) return;
    const delai = parseInt(nextDelaiJours, 10);
    if (!delai || delai <= 0) {
      toast.error('Le délai doit être un nombre de jours supérieur à 0.');
      return;
    }
    try {
      setSendingId(sendModalRelance.id_relance);
      await api.sendWhatsappRelance(sendModalRelance.id_relance, { prochaine_relance_jours: delai });
      toast.success('Le message WhatsApp va s\'ouvrir dans un nouvel onglet...');
      setSendModalRelance(null);
      await fetchRelances();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSendingId(null);
    }
  };

  // ── Fenêtre "Planifier" — programmer une relance à une date précise pour un client ──
  const [showPlanifierModal, setShowPlanifierModal] = useState(false);
  const [planClientSearch, setPlanClientSearch] = useState('');
  const [planClientResults, setPlanClientResults] = useState([]);
  const [planSelectedClient, setPlanSelectedClient] = useState(null);
  const [planDate, setPlanDate] = useState('');
  const [planNotes, setPlanNotes] = useState('');
  const [planSaving, setPlanSaving] = useState(false);
  const planSearchTimeout = useRef(null);

  const openPlanifier = () => {
    setPlanClientSearch('');
    setPlanClientResults([]);
    setPlanSelectedClient(null);
    setPlanDate('');
    setPlanNotes('');
    setShowPlanifierModal(true);
  };

  useEffect(() => {
    if (!showPlanifierModal || planSelectedClient) return;
    clearTimeout(planSearchTimeout.current);
    const q = planClientSearch.trim();
    if (!q) { setPlanClientResults([]); return; }
    planSearchTimeout.current = setTimeout(async () => {
      try {
        const results = await api.getClients(q);
        setPlanClientResults(results.slice(0, 8));
      } catch { /* silencieux */ }
    }, 300);
    return () => clearTimeout(planSearchTimeout.current);
  }, [planClientSearch, showPlanifierModal, planSelectedClient]);

  const submitPlanifier = async () => {
    if (!planSelectedClient) {
      toast.error('Veuillez sélectionner un client.');
      return;
    }
    if (!planDate) {
      toast.error('Veuillez choisir une date.');
      return;
    }
    try {
      setPlanSaving(true);
      await api.createRelance({
        id_client: planSelectedClient.id_client,
        date_planifiee: planDate,
        canal_prevu: 'whatsapp',
        notes: planNotes.trim() || null,
      });
      toast.success(`Relance planifiée pour ${planSelectedClient.nom} le ${new Date(planDate).toLocaleDateString()}.`);
      setShowPlanifierModal(false);
      await fetchRelances();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPlanSaving(false);
    }
  };

  const filtered = relances.filter(r =>
    (r.client?.nom || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.client?.telephone || '').includes(search)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white' }}>Relances de Crédit à Effectuer</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary" onClick={openPlanifier}>
            <CalendarPlus size={16} /> Planifier
          </button>
          <button className="btn btn-outline" onClick={fetchRelances}>
            <RefreshCcw size={16} /> Actualiser
          </button>
        </div>
      </div>

      <div className="glass-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.5rem' }}
            placeholder="Rechercher par nom de client ou téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Téléphone</th>
              <th>Date Planifiée</th>
              <th>Montant Crédit</th>
              <th>Notes / Historique</th>
              <th style={{ width: '180px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Chargement...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Aucune relance prévue pour aujourd'hui.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id_relance}>
                  <td><strong>{r.client?.nom} {r.client?.prenom || ''}</strong></td>
                  <td>{r.client?.telephone || <span style={{ color: '#ef4444' }}>Non renseigné</span>}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#fbbf24' }}>
                      <Calendar size={14} />
                      {new Date(r.date_planifiee).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={{ color: '#f87171', fontWeight: 'bold' }}>
                    {parseFloat(Math.abs(r.client?.solde_compte || 0)).toFixed(3)} TND
                  </td>
                  <td style={{ whiteSpace: 'pre-line', fontSize: '0.8rem', color: '#cbd5e1' }}>
                    {r.notes || '-'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#25D366', color: 'white', border: 'none', marginLeft: 'auto' }}
                      onClick={() => openSendModal(r)}
                      disabled={sendingId === r.id_relance || !r.client?.telephone}
                      title={!r.client?.telephone ? 'Ce client n\'a pas de numéro de téléphone' : ''}
                    >
                      <MessageCircle size={14} />
                      {sendingId === r.id_relance ? 'Envoi...' : 'WhatsApp'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Fenêtre : après combien de jours renvoyer une relance, avant l'envoi WhatsApp */}
      <Modal
        isOpen={!!sendModalRelance}
        onClose={() => setSendModalRelance(null)}
        title="Envoyer la relance WhatsApp"
        maxWidth="420px"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setSendModalRelance(null)}>Annuler</button>
            <button
              className="btn btn-success"
              onClick={confirmSendWhatsapp}
              disabled={sendingId === sendModalRelance?.id_relance}
              style={{ background: '#25D366', border: 'none' }}
            >
              <MessageCircle size={16} /> {sendingId === sendModalRelance?.id_relance ? 'Envoi...' : 'Envoyer'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
            Client : <strong style={{ color: 'white' }}>{sendModalRelance?.client?.nom} {sendModalRelance?.client?.prenom || ''}</strong>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Si le crédit persiste, renvoyer une relance dans (jours)</label>
            <input
              type="number"
              min="1"
              step="1"
              className="form-input"
              value={nextDelaiJours}
              onChange={(e) => setNextDelaiJours(e.target.value)}
              autoFocus
            />
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            La relance actuelle sera marquée comme effectuée et la prochaine sera automatiquement programmée à cette échéance (si le client a toujours du crédit à ce moment-là).
          </div>
        </div>
      </Modal>

      {/* Fenêtre : Planifier une relance à une date précise pour un client */}
      <Modal
        isOpen={showPlanifierModal}
        onClose={() => setShowPlanifierModal(false)}
        title="Planifier une relance"
        maxWidth="460px"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowPlanifierModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={submitPlanifier} disabled={planSaving}>
              <CalendarPlus size={16} /> {planSaving ? 'Enregistrement...' : 'Planifier'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Client</label>
            {planSelectedClient ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.75rem', background: '#0f172a', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <span>{planSelectedClient.nom} {planSelectedClient.prenom || ''} {planSelectedClient.telephone ? `— ${planSelectedClient.telephone}` : ''}</span>
                <button
                  type="button"
                  onClick={() => { setPlanSelectedClient(null); setPlanClientSearch(''); }}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Rechercher un client par nom ou téléphone..."
                  value={planClientSearch}
                  onChange={(e) => setPlanClientSearch(e.target.value)}
                  autoFocus
                />
                {planClientResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '0.25rem', maxHeight: '220px', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                    {planClientResults.map((c) => (
                      <div
                        key={c.id_client}
                        onClick={() => { setPlanSelectedClient(c); setPlanClientResults([]); }}
                        style={{ padding: '0.55rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ color: 'white' }}>{c.nom} {c.prenom || ''}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{c.telephone || 'Sans téléphone'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Date d'envoi</label>
            <input
              type="date"
              className="form-input"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Notes (optionnel)</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={planNotes}
              onChange={(e) => setPlanNotes(e.target.value)}
              placeholder="Remarques éventuelles..."
            />
          </div>

          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Cette relance n'apparaîtra dans la liste "à effectuer" qu'à partir de la date choisie, et seulement si le client a encore du crédit à ce moment-là.
          </div>
        </div>
      </Modal>
    </div>
  );
};
