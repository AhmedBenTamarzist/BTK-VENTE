import React, { useState } from 'react';
import { toast } from '../contexts/ToastContext';
import { api } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';
import { usePolling } from '../hooks/usePolling';
import {
  ShoppingBag, Plus, RefreshCw, Eye, Edit3, Save, X,
  CreditCard, Package, FileText, Building2, Hash, StickyNote, CheckCircle
} from 'lucide-react';
import { QuickArticleModal } from '../components/common/QuickArticleModal';
import { SearchableSelect } from '../components/common/SearchableSelect';

// ── LignesTab ─────────────────────────────────────────────────────────────────
function LignesTab({ achat, articles, onUpdated }) {
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editLignes, setEditLignes] = useState([]);

  const startEdit = () => {
    setEditLignes(
      (achat.lignes || []).map(l => ({
        id_article: l.id_article,
        quantite: parseFloat(l.quantite),
        prix_achat_ttc: parseFloat(l.prix_achat_ttc),
        prix_achat_ht: parseFloat(l.prix_achat_ht),
        taux_tva_achat: parseFloat(l.taux_tva_achat),
        taux_taxe_supplementaire: parseFloat(l.taux_taxe_supplementaire) || 0,
        remise_pourcentage: parseFloat(l.remise_pourcentage),
        nouveau_prix_vente_ttc: l.nouveau_prix_vente_ttc ? parseFloat(l.nouveau_prix_vente_ttc) : '',
        nouvelle_remise_vente: l.nouvelle_remise_vente ? parseFloat(l.nouvelle_remise_vente) : '',
        _nom: l.article?.nom || `Article #${l.id_article}`,
        _ref: l.article?.reference || '',
      }))
    );
    setEditMode(true);
  };

  // Calcul HT <-> TTC : TTC = HT x (1+TVA%) x (1-Remise%) x (1+Taxe Suppl.%), dans cet ordre.
  // Le champ qu'on vient de modifier garde exactement sa valeur saisie ; l'autre est recalculé.
  // HT reste la référence quand on change juste un taux (TVA/Remise/Taxe Suppl.).
  const handleLineChange = (index, field, value) => {
    const updated = [...editLignes];
    const line = { ...updated[index], [field]: value };
    const tva = parseFloat(line.taux_tva_achat) || 0;
    const taxeSuppl = parseFloat(line.taux_taxe_supplementaire) || 0;
    const remise = parseFloat(line.remise_pourcentage) || 0;
    const multiplicateur = (1 + tva / 100) * (1 - remise / 100) * (1 + taxeSuppl / 100);

    if (field === 'prix_achat_ht') {
      const ht = parseFloat(value) || 0;
      line.prix_achat_ttc = (ht * multiplicateur).toFixed(3);
    } else if (field === 'prix_achat_ttc') {
      const ttc = parseFloat(value) || 0;
      line.prix_achat_ht = multiplicateur > 0 ? (ttc / multiplicateur).toFixed(3) : '0.000';
    } else if (field === 'taux_tva_achat' || field === 'taux_taxe_supplementaire' || field === 'remise_pourcentage') {
      const ht = parseFloat(line.prix_achat_ht) || 0;
      line.prix_achat_ttc = (ht * multiplicateur).toFixed(3);
    }

    updated[index] = line;
    setEditLignes(updated);
  };

  const handleAddLine = () => {
    if (!articles.length) return;
    const a = articles[0];
    setEditLignes([...editLignes, {
      id_article: a.id_article,
      quantite: 1,
      prix_achat_ttc: 0,
      prix_achat_ht: 0,
      taux_tva_achat: 19,
      taux_taxe_supplementaire: 0,
      remise_pourcentage: 0,
      nouveau_prix_vente_ttc: parseFloat(a.prix_vente_ttc) || '',
      nouvelle_remise_vente: '',
      _nom: a.nom,
      _ref: a.reference || '',
    }]);
  };

  const handleArticleChange = (index, artId) => {
    const art = articles.find(a => a.id_article === parseInt(artId));
    if (!art) return;
    const updated = [...editLignes];
    updated[index] = {
      ...updated[index],
      id_article: art.id_article,
      nouveau_prix_vente_ttc: parseFloat(art.prix_vente_ttc) || '',
      nouvelle_remise_vente: parseFloat(art.remise_max_pourcentage) || '',
      _nom: art.nom,
      _ref: art.reference || '',
    };
    setEditLignes(updated);
  };

  const handleSave = async () => {
    if (!editLignes.length) { toast.error('Au moins une ligne requise.'); return; }
    setSaving(true);
    try {
      const payload = editLignes.map(l => ({
        id_article: parseInt(l.id_article),
        quantite: parseFloat(l.quantite) || 0,
        prix_achat_ht: parseFloat(l.prix_achat_ht) || 0,
        prix_achat_ttc: parseFloat(l.prix_achat_ttc) || 0,
        taux_tva_achat: parseFloat(l.taux_tva_achat) || 19,
        taux_taxe_supplementaire: parseFloat(l.taux_taxe_supplementaire) || 0,
        remise_pourcentage: parseFloat(l.remise_pourcentage) || 0,
        nouveau_prix_vente_ttc: l.nouveau_prix_vente_ttc !== '' ? parseFloat(l.nouveau_prix_vente_ttc) : null,
        nouvelle_remise_vente: l.nouvelle_remise_vente !== '' ? parseFloat(l.nouvelle_remise_vente) : null,
      }));
      const updated = await api.updateLignesAchat(achat.id_achat, payload);
      onUpdated(updated);
      setEditMode(false);
      toast.success('Articles mis à jour. Stock et prix recalculés.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const lignes = achat.lignes || [];
  const INP = { className: 'form-input', style: { padding: '0.3rem 0.5rem', fontSize: '0.8rem', minWidth: 0 } };

  if (!editMode) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
          <button className="btn btn-outline btn-sm" onClick={startEdit}><Edit3 size={14} /> Modifier les Articles</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {lignes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucune ligne.</div>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Réf.</th>
                  <th style={{ textAlign: 'center' }}>Qté</th>
                  <th style={{ textAlign: 'right' }} title="Prix hors taxes, avant TVA / remise / taxe suppl.">Prix Achat HT</th>
                  <th style={{ textAlign: 'right' }} title="Toutes taxes et remise comprises (TVA, remise, taxe suppl.)">Prix Achat TTC</th>
                  <th style={{ textAlign: 'center' }}>TVA</th>
                  <th style={{ textAlign: 'center' }}>Taxe Suppl.</th>
                  <th style={{ textAlign: 'center' }}>Remise</th>
                  <th style={{ textAlign: 'right' }}>Total TTC</th>
                  <th style={{ textAlign: 'right', color: '#60a5fa' }}>Prix Vente TTC</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l, i) => (
                  <tr key={i}>
                    <td><strong style={{ color: 'var(--text-main)' }}>{l.article?.nom || `Art #${l.id_article}`}</strong></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{l.article?.reference || '-'}</td>
                    <td style={{ textAlign: 'center' }}>{parseFloat(l.quantite)}</td>
                    <td style={{ textAlign: 'right' }}>{parseFloat(l.prix_achat_ht).toFixed(3)} TND</td>
                    <td style={{ textAlign: 'right' }}>{parseFloat(l.prix_achat_ttc).toFixed(3)} TND</td>
                    <td style={{ textAlign: 'center' }}>{parseFloat(l.taux_tva_achat)}%</td>
                    <td style={{ textAlign: 'center' }}>{parseFloat(l.taux_taxe_supplementaire) > 0 ? `${parseFloat(l.taux_taxe_supplementaire)}%` : '-'}</td>
                    <td style={{ textAlign: 'center' }}>{parseFloat(l.remise_pourcentage) > 0 ? `${parseFloat(l.remise_pourcentage)}%` : '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: '#34d399' }}>{parseFloat(l.montant_ligne_ttc).toFixed(3)} TND</td>
                    <td style={{ textAlign: 'right', color: '#60a5fa' }}>
                      {l.nouveau_prix_vente_ttc ? `${parseFloat(l.nouveau_prix_vente_ttc).toFixed(3)} TND` : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8} style={{ textAlign: 'right', fontWeight: '700', color: 'var(--text-muted)', padding: '0.5rem 0.75rem' }}>TOTAL TTC</td>
                  <td style={{ textAlign: 'right', fontWeight: '700', color: '#34d399', padding: '0.5rem 0.75rem' }}>
                    {lignes.reduce((s, l) => s + parseFloat(l.montant_ligne_ttc || 0), 0).toFixed(3)} TND
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    );
  }

  // ── Edit Mode ──
  // Calcul TTC-first : le total part directement du prix TTC saisi (pas du HT arrondi),
  // pour éviter une dérive d'arrondi entre l'aperçu et le total réellement enregistré.
  const totTtc = editLignes.reduce((s, l) => {
    const qty = parseFloat(l.quantite) || 0;
    const ttc = parseFloat(l.prix_achat_ttc) || 0;
    const rem = parseFloat(l.remise_pourcentage) || 0;
    return s + qty * ttc * (1 - rem / 100);
  }, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline btn-sm" style={{ color: '#f87171', borderColor: '#f87171' }} onClick={() => setEditMode(false)}><X size={14} /> Annuler</button>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}><Save size={14} /> {saving ? 'Sauvegarde...' : 'Sauvegarder'}</button>
        </div>
        <button className="btn btn-outline btn-sm" style={{ color: '#34d399', borderColor: '#34d399' }} onClick={handleAddLine}><Plus size={14} /> Ajouter Ligne</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {editLignes.map((l, i) => {
          const qty = parseFloat(l.quantite) || 0;
          const ttc = parseFloat(l.prix_achat_ttc) || 0;
          // Le TTC est déjà net (remise et taxes incluses) : le total de ligne s'obtient directement.
          const lineTtc = qty * ttc;
          return (
            <div key={i} style={{ background: 'var(--bg-primary)', border: '1px solid #334155', borderRadius: '10px', padding: '0.75rem', position: 'relative' }}>
              <button
                style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '0.2rem' }}
                onClick={() => setEditLignes(editLignes.filter((_, j) => j !== i))}
                title="Supprimer ligne"
              ><X size={14} /></button>

              {/* Row 1: Article + Qté + Remise */}
              <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 0.8fr 0.8fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Article</div>
                  <select
                    className="form-select"
                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                    value={l.id_article}
                    onChange={e => handleArticleChange(i, e.target.value)}
                  >
                    {articles.map(a => (
                      <option key={a.id_article} value={a.id_article}>{a.nom}{a.reference ? ` (${a.reference})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Qté</div>
                  <input {...INP} type="number" step="1" min="0.001" value={l.quantite} onChange={e => handleLineChange(i, 'quantite', e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Remise %</div>
                  <input {...INP} type="number" step="0.1" value={l.remise_pourcentage} onChange={e => handleLineChange(i, 'remise_pourcentage', e.target.value)} />
                </div>
              </div>

              {/* Row 2: Prix HT/TTC + TVA + Taxe Suppl. (calcul bidirectionnel HT <-> TTC) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.7fr 0.9fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#34d399', marginBottom: '0.2rem' }} title="Prix hors taxes, avant TVA / remise / taxe suppl.">Prix Achat HT</div>
                  <input {...INP} type="number" step="0.001" value={l.prix_achat_ht} onChange={e => handleLineChange(i, 'prix_achat_ht', e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#fbbf24', marginBottom: '0.2rem' }} title="Toutes taxes et remise comprises (TVA, remise, taxe suppl.)">Prix Achat TTC</div>
                  <input {...INP} type="number" step="0.001" value={l.prix_achat_ttc} onChange={e => handleLineChange(i, 'prix_achat_ttc', e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>TVA %</div>
                  <input {...INP} type="number" step="1" value={l.taux_tva_achat} onChange={e => handleLineChange(i, 'taux_tva_achat', e.target.value)} />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#c084fc', marginBottom: '0.2rem' }}>Taxe Suppl. %</div>
                  <input {...INP} type="number" step="0.1" value={l.taux_taxe_supplementaire} onChange={e => handleLineChange(i, 'taux_taxe_supplementaire', e.target.value)} placeholder="0" />
                </div>
              </div>

              {/* Row 2: Vente fields + total */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '0.5rem', background: 'rgba(59,130,246,0.05)', borderRadius: '6px', padding: '0.4rem 0.5rem', border: '1px solid rgba(59,130,246,0.1)' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#60a5fa', marginBottom: '0.2rem' }}>Prix Vente TTC (mise à jour article)</div>
                  <input {...INP} type="number" step="0.001" value={l.nouveau_prix_vente_ttc} onChange={e => handleLineChange(i, 'nouveau_prix_vente_ttc', e.target.value)} placeholder="Optionnel" />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#60a5fa', marginBottom: '0.2rem' }}>Remise Vente %</div>
                  <input {...INP} type="number" step="0.1" value={l.nouvelle_remise_vente} onChange={e => handleLineChange(i, 'nouvelle_remise_vente', e.target.value)} placeholder="Optionnel" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total Ligne TTC</div>
                  <strong style={{ color: '#34d399', fontSize: '0.95rem' }}>{lineTtc.toFixed(3)} TND</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {editLignes.length > 0 && (
        <div style={{ marginTop: '0.75rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem 1rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>TOTAL TTC (modifié) :</span>
          <strong style={{ color: '#34d399' }}>{totTtc.toFixed(3)} TND</strong>
        </div>
      )}
    </div>
  );
}

// ── Detail/Edit Modal ─────────────────────────────────────────────────────────
function AchatDetailModal({ achat: initialAchat, fournisseurs, articles, onClose, onUpdated }) {
  const [achat, setAchat] = useState(initialAchat);
  const [tab, setTab] = useState('infos');
  const [editMode, setEditMode] = useState(false);

  // Edit fields
  const [numFacture, setNumFacture] = useState(initialAchat.numero_facture_fournisseur || '');
  const [dateAchat, setDateAchat] = useState(initialAchat.date_achat || '');
  const [notes, setNotes] = useState(initialAchat.notes || '');

  // Payment fields
  const [montantPaiement, setMontantPaiement] = useState('');
  const [modePaiement, setModePaiement] = useState('especes');
  const [refPaiement, setRefPaiement] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  const fournisseur = fournisseurs.find(f => f.id_fournisseur === achat.id_fournisseur)
    || achat.fournisseur;
  const fournisseurNom = fournisseur?.nom || `Fournisseur #${achat.id_fournisseur}`;

  const statColor = {
    paye: '#22c55e', partiellement_paye: '#f59e0b', non_paye: '#ef4444'
  };

  const handleSaveEdit = async () => {
    try {
      const updated = await api.updateAchat(achat.id_achat, {
        numero_facture_fournisseur: numFacture.trim() || null,
        date_achat: dateAchat || null,
        notes: notes.trim() || null,
      });
      setAchat(updated);
      setEditMode(false);
      onUpdated(updated);
      toast.success('Facture mise à jour.');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handlePay = async () => {
    const m = parseFloat(montantPaiement);
    if (!m || m <= 0) { toast.error('Montant invalide.'); return; }
    setPayLoading(true);
    try {
      const updated = await api.addPaiementAchat(achat.id_achat, {
        montant: m,
        mode_paiement: modePaiement,
        reference_paiement: refPaiement.trim() || null,
      });
      setAchat(updated);
      onUpdated(updated);
      setMontantPaiement('');
      setRefPaiement('');
      toast.success(`Paiement de ${m.toFixed(3)} TND enregistré.`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPayLoading(false);
    }
  };

  const lignes = achat.lignes || [];
  const resteAPayer = parseFloat(achat.montant_restant) || 0;
  const montantTtc = parseFloat(achat.montant_ttc) || 0;
  const montantPaye = parseFloat(achat.montant_paye) || 0;

  const TAB = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setTab(id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        padding: '0.5rem 1rem', borderRadius: '8px',
        background: tab === id ? 'rgba(99,102,241,0.2)' : 'transparent',
        border: tab === id ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
        color: tab === id ? '#a5b4fc' : 'var(--text-muted)',
        cursor: 'pointer', fontSize: '0.85rem', fontWeight: tab === id ? '600' : '400',
        transition: 'all 0.15s',
      }}
    >
      <Icon size={14} />{label}
    </button>
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Facture Achat #${achat.id_achat}`}
      maxWidth="860px"
      footer={
        <button className="btn btn-outline" onClick={onClose}>Fermer</button>
      }
    >
      {/* ── Header summary ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.75rem',
        marginBottom: '1.25rem',
      }}>
        {[
          { label: 'Total TTC', value: `${montantTtc.toFixed(3)} TND`, color: '#34d399' },
          { label: 'Montant Payé', value: `${montantPaye.toFixed(3)} TND`, color: '#60a5fa' },
          { label: 'Reste à Payer', value: `${resteAPayer.toFixed(3)} TND`, color: resteAPayer > 0 ? '#fbbf24' : 'var(--text-muted)' },
          { label: 'Statut', value: achat.statut_paiement?.replace(/_/g,' ') || '-', color: statColor[achat.statut_paiement] || 'var(--text-muted)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{label}</div>
            <div style={{ fontSize: '1rem', fontWeight: '700', color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {montantTtc > 0 && (
        <div style={{ background: 'var(--bg-surface)', borderRadius: '6px', height: '6px', marginBottom: '1.25rem', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, (montantPaye / montantTtc) * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#6366f1,#22c55e)', borderRadius: '6px', transition: 'width 0.4s ease' }} />
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <TAB id="infos" icon={FileText} label="Informations" />
        <TAB id="lignes" icon={Package} label={`Articles (${lignes.length})`} />
        <TAB id="paiement" icon={CreditCard} label="Enregistrer Paiement" />
      </div>

      {/* ── Infos Tab ── */}
      {tab === 'infos' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            {!editMode ? (
              <button className="btn btn-outline btn-sm" onClick={() => setEditMode(true)}>
                <Edit3 size={14} /> Modifier
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-outline btn-sm" onClick={() => setEditMode(false)}><X size={14} /> Annuler</button>
                <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}><Save size={14} /> Sauvegarder</button>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Fournisseur */}
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Building2 size={16} style={{ color: '#6366f1' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fournisseur</span>
              </div>
              <div style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{fournisseurNom}</div>
              {fournisseur?.telephone && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>📞 {fournisseur.telephone}</div>}
              {fournisseur?.email && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>✉️ {fournisseur.email}</div>}
              {fournisseur?.adresse && <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>📍 {fournisseur.adresse}</div>}
            </div>

            {/* Identifiants */}
            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Hash size={16} style={{ color: '#0ea5e9' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Identifiants</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>N° Facture Fournisseur</div>
                  {editMode ? (
                    <input className="form-input" style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      value={numFacture} onChange={e => setNumFacture(e.target.value)} placeholder="ex: FF-2026-89" />
                  ) : (
                    <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>{achat.numero_facture_fournisseur || <span style={{ color: 'var(--text-muted)' }}>Non renseigné</span>}</span>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Date d'Achat</div>
                  {editMode ? (
                    <input className="form-input" type="date" style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      value={dateAchat} onChange={e => setDateAchat(e.target.value)} />
                  ) : (
                    <span style={{ color: 'var(--text-main)', fontWeight: '600' }}>
                      {achat.date_achat ? new Date(achat.date_achat).toLocaleDateString('fr-FR') : '-'}
                    </span>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Date de Création</div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    {new Date(achat.date_creation).toLocaleString('fr-FR')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div style={{ marginTop: '1rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <StickyNote size={15} style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</span>
            </div>
            {editMode ? (
              <textarea className="form-input" rows={3} style={{ fontSize: '0.85rem', resize: 'vertical' }}
                value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes internes..." />
            ) : (
              <p style={{ color: achat.notes ? 'var(--text-muted)' : 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                {achat.notes || 'Aucune note.'}
              </p>
            )}
          </div>

          {/* Récap financier */}
          <div style={{ marginTop: '1rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Récapitulatif Financier</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {[
                ['Montant HT', parseFloat(achat.montant_ht).toFixed(3)],
                ['TVA', parseFloat(achat.montant_tva).toFixed(3)],
                ['Montant TTC', parseFloat(achat.montant_ttc).toFixed(3), '#34d399', true],
                ['Montant Payé', parseFloat(achat.montant_paye).toFixed(3), '#60a5fa'],
                ['Reste à Payer', parseFloat(achat.montant_restant).toFixed(3), resteAPayer > 0 ? '#fbbf24' : 'var(--text-muted)'],
              ].map(([label, val, color, bold]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{label}</span>
                  <span style={{ color: color || 'white', fontWeight: bold ? '700' : '500', fontSize: '0.85rem' }}>{val} TND</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Lignes Tab ── */}
      {tab === 'lignes' && <LignesTab achat={achat} articles={articles} onUpdated={(u) => { setAchat(u); onUpdated(u); }} />}

      {/* ── Paiement Tab ── */}
      {tab === 'paiement' && (
        <div>
          {resteAPayer <= 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <CheckCircle size={48} style={{ color: '#22c55e', marginBottom: '0.5rem' }} />
              <div style={{ color: '#22c55e', fontWeight: '700', fontSize: '1.1rem' }}>Facture intégralement payée</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>Montant payé : {montantPaye.toFixed(3)} TND</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#fca5a5', display: 'flex', justifyContent: 'space-between' }}>
                <span>Reste à payer :</span>
                <strong style={{ fontSize: '1.05rem' }}>{resteAPayer.toFixed(3)} TND</strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Montant à Payer (TND) *</label>
                  <input className="form-input" type="number" step="0.001" min="0.001"
                    value={montantPaiement} onChange={e => setMontantPaiement(e.target.value)}
                    placeholder={`Max: ${resteAPayer.toFixed(3)}`} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Mode de Paiement</label>
                  <select className="form-select" value={modePaiement} onChange={e => setModePaiement(e.target.value)}>
                    <option value="especes">💵 Espèces</option>
                    <option value="cheque">🏦 Chèque</option>
                    <option value="virement">🔄 Virement</option>
                    <option value="traite">📋 Traite</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
              </div>

              {['cheque', 'virement', 'traite'].includes(modePaiement) && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Référence / N° {modePaiement}</label>
                  <input className="form-input" value={refPaiement} onChange={e => setRefPaiement(e.target.value)} placeholder="N° chèque, référence virement..." />
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button className="btn btn-outline" onClick={() => setMontantPaiement(resteAPayer.toFixed(3))}>
                  Solde total ({resteAPayer.toFixed(3)} TND)
                </button>
                <button className="btn btn-primary" onClick={handlePay} disabled={payLoading}>
                  <CreditCard size={15} />
                  {payLoading ? 'Enregistrement...' : 'Valider le Paiement'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export const AchatsList = () => {
  const [achats, setAchats] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // New Purchase Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedFournisseurId, setSelectedFournisseurId] = useState('');
  const [numFactureFournisseur, setNumFactureFournisseur] = useState('');
  const [dateAchat, setDateAchat] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [lignes, setLignes] = useState([]);

  // Detail Modal
  const [selectedAchat, setSelectedAchat] = useState(null);

  const [showQuickArticle, setShowQuickArticle] = useState(false);

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [achs, fourn, arts] = await Promise.all([
        api.getAchats(),
        api.getFournisseurs(''),
        api.getArticles('')
      ]);
      setAchats(achs);
      setFournisseurs(fourn);
      setArticles(arts);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  usePolling(fetchData, []);

  const handleAchatUpdated = (updated) => {
    setAchats(prev => prev.map(a => a.id_achat === updated.id_achat ? updated : a));
    setSelectedAchat(updated);
  };

  const handleArticleSelect = (index, artId) => {
    const art = articles.find(a => a.id_article === parseInt(artId));
    if (!art) return;
    const updated = [...lignes];
    updated[index] = {
      ...updated[index],
      id_article: art.id_article,
      nouveau_prix_vente_ttc: parseFloat(art.prix_vente_ttc) || 0,
      nouvelle_remise_vente: parseFloat(art.remise_max_pourcentage) || 0
    };
    setLignes(updated);
  };

  const handleAddLine = () => {
    if (articles.length === 0) return;
    const firstArt = articles[0];
    setLignes([...lignes, {
      id_article: firstArt.id_article,
      quantite: 1,
      prix_achat_ttc: 0,
      prix_achat_ht: 0,
      taux_tva_achat: 19.0,
      taux_taxe_supplementaire: 0,
      remise_pourcentage: 0,
      nouveau_prix_vente_ttc: parseFloat(firstArt.prix_vente_ttc) || 0,
      nouvelle_remise_vente: parseFloat(firstArt.remise_max_pourcentage) || 0
    }]);
  };

  // Calcul HT <-> TTC : TTC = HT x (1+TVA%) x (1-Remise%) x (1+Taxe Suppl.%), dans cet ordre.
  // Le champ qu'on vient de modifier garde exactement sa valeur saisie ; l'autre est recalculé.
  // HT reste la référence quand on change juste un taux (TVA/Remise/Taxe Suppl.).
  const handleLineChange = (index, field, value) => {
    const updated = [...lignes];
    const line = { ...updated[index], [field]: value };
    const tva = parseFloat(line.taux_tva_achat) || 0;
    const taxeSuppl = parseFloat(line.taux_taxe_supplementaire) || 0;
    const remise = parseFloat(line.remise_pourcentage) || 0;
    const multiplicateur = (1 + tva / 100) * (1 - remise / 100) * (1 + taxeSuppl / 100);

    if (field === 'prix_achat_ht') {
      const ht = parseFloat(value) || 0;
      line.prix_achat_ttc = (ht * multiplicateur).toFixed(3);
    } else if (field === 'prix_achat_ttc') {
      const ttc = parseFloat(value) || 0;
      line.prix_achat_ht = multiplicateur > 0 ? (ttc / multiplicateur).toFixed(3) : '0.000';
    } else if (field === 'taux_tva_achat' || field === 'taux_taxe_supplementaire' || field === 'remise_pourcentage') {
      const ht = parseFloat(line.prix_achat_ht) || 0;
      line.prix_achat_ttc = (ht * multiplicateur).toFixed(3);
    }

    updated[index] = line;
    setLignes(updated);
  };

  const handleRemoveLine = (index) => setLignes(lignes.filter((_, i) => i !== index));

  const calculateTotals = () => {
    // Le Total TTC part directement du prix TTC saisi/calculé (déjà net : remise et taxes
    // incluses), pour correspondre exactement à ce qui sera enregistré côté serveur.
    // Le détail HT/TVA/Taxe Suppl. est informatif (calculé dans le même ordre que le prix
    // unitaire : +TVA, -Remise, +Taxe Suppl.).
    let totHt = 0, totTva = 0, totTaxeSuppl = 0, totTtc = 0;
    lignes.forEach((l) => {
      const qty = parseFloat(l.quantite) || 0;
      const ht = parseFloat(l.prix_achat_ht) || 0;
      const ttc = parseFloat(l.prix_achat_ttc) || 0;
      const tvaPct = parseFloat(l.taux_tva_achat) || 0;
      const remisePct = parseFloat(l.remise_pourcentage) || 0;
      const taxeSupplPct = parseFloat(l.taux_taxe_supplementaire) || 0;

      const lineHt = qty * ht;
      const apresTva = lineHt * (1 + tvaPct / 100);
      const apresRemise = apresTva * (1 - remisePct / 100);
      const apresTaxeSuppl = apresRemise * (1 + taxeSupplPct / 100);

      totHt += lineHt;
      totTva += apresTva - lineHt;
      totTaxeSuppl += apresTaxeSuppl - apresRemise;
      totTtc += qty * ttc;
    });
    return { totHt, totTva, totTaxeSuppl, totTtc };
  };

  const totals = calculateTotals();

  const handleSubmitAchat = async () => {
    if (!selectedFournisseurId) { toast.error('Veuillez sélectionner un fournisseur.'); return; }
    if (lignes.length === 0) { toast.error("Veuillez ajouter au moins un article."); return; }
    try {
      await api.createAchat({
        id_fournisseur: parseInt(selectedFournisseurId),
        numero_facture_fournisseur: numFactureFournisseur.trim() || null,
        date_achat: dateAchat,
        notes: notes.trim() || null,
        lignes: lignes.map((l) => ({
          id_article: parseInt(l.id_article),
          quantite: parseFloat(l.quantite) || 0,
          prix_achat_ht: parseFloat(l.prix_achat_ht) || 0,
          prix_achat_ttc: parseFloat(l.prix_achat_ttc) || 0,
          taux_tva_achat: parseFloat(l.taux_tva_achat) || 19.0,
          taux_taxe_supplementaire: parseFloat(l.taux_taxe_supplementaire) || 0,
          remise_pourcentage: parseFloat(l.remise_pourcentage) || 0,
          nouveau_prix_vente_ttc: parseFloat(l.nouveau_prix_vente_ttc) || null,
          nouvelle_remise_vente: parseFloat(l.nouvelle_remise_vente) || null
        }))
      });
      toast.success("Facture d'achat enregistrée ! Stock et prix mis à jour.");
      setShowAddModal(false);
      setLignes([]);
      setSelectedFournisseurId('');
      setNumFactureFournisseur('');
      setNotes('');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Filtration intelligente multi-mots
  const filteredAchats = achats.filter(a => {
    if (!search.trim()) return true;
    const words = search.toLowerCase().trim().split(/\s+/);
    const f = fournisseurs.find(f => f.id_fournisseur === a.id_fournisseur);
    const hay = [
      a.numero_facture_fournisseur || '',
      f?.nom || '',
      a.statut_paiement || '',
      a.notes || ''
    ].join(' ').toLowerCase();
    return words.every(w => hay.includes(w));
  });

  const statsPaye = achats.filter(a => a.statut_paiement === 'paye').length;
  const statsNonPaye = achats.filter(a => a.statut_paiement === 'non_paye').length;
  const statsPartiel = achats.filter(a => a.statut_paiement === 'partiellement_paye').length;
  const totalRestant = achats.reduce((s, a) => s + parseFloat(a.montant_restant || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Achats & Factures Fournisseur</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>Enregistrement des factures d'achat fournisseur et approvisionnement</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline btn-sm" onClick={fetchData}><RefreshCw size={14} /></button>
          <button className="btn btn-primary" onClick={() => { setLignes([]); handleAddLine(); setShowAddModal(true); }}>
            <Plus size={16} /> Nouvel Achat Fournisseur
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Total Factures', value: achats.length, color: '#6366f1' },
          { label: 'Payées', value: statsPaye, color: '#22c55e' },
          { label: 'Partiellement Payées', value: statsPartiel, color: '#f59e0b' },
          { label: 'Reste Global à Payer', value: `${totalRestant.toFixed(3)} TND`, color: '#ef4444' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-card" style={{ padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '800', color, marginTop: '0.2rem' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: '400px' }}>
        <input
          className="form-input"
          style={{ paddingLeft: '2.5rem' }}
          placeholder="Rechercher par fournisseur, n° facture, statut..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <ShoppingBag size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
      </div>

      {/* Table */}
      <div className="glass-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Fournisseur</th>
                <th>N° Facture Fournisseur</th>
                <th>Date Achat</th>
                <th style={{ textAlign: 'right' }}>Montant HT</th>
                <th style={{ textAlign: 'right' }}>Montant TTC</th>
                <th style={{ textAlign: 'right' }}>Reste à Payer</th>
                <th style={{ textAlign: 'center' }}>Statut</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>Chargement...</td></tr>
              ) : filteredAchats.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucun achat trouvé.</td></tr>
              ) : filteredAchats.map((a) => {
                const f = fournisseurs.find(fourn => fourn.id_fournisseur === a.id_fournisseur);
                const restant = parseFloat(a.montant_restant) || 0;
                return (
                  <tr key={a.id_achat}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>#{a.id_achat}</td>
                    <td><strong style={{ color: 'var(--text-main)' }}>{f ? f.nom : `Fournisseur #${a.id_fournisseur}`}</strong></td>
                    <td style={{ color: 'var(--text-muted)' }}>{a.numero_facture_fournisseur || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                    <td>{new Date(a.date_achat).toLocaleDateString('fr-FR')}</td>
                    <td style={{ textAlign: 'right' }}>{parseFloat(a.montant_ht).toFixed(3)} TND</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#34d399' }}>{parseFloat(a.montant_ttc).toFixed(3)} TND</td>
                    <td style={{ textAlign: 'right', color: restant > 0 ? '#fbbf24' : 'var(--text-muted)', fontWeight: restant > 0 ? '600' : '400' }}>
                      {restant.toFixed(3)} TND
                    </td>
                    <td style={{ textAlign: 'center' }}><StatusBadge status={a.statut_paiement} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setSelectedAchat(a)}>
                        <Eye size={14} /> Détail
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Purchase Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Enregistrer un Achat / Facture Fournisseur"
        maxWidth="1000px"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowAddModal(false)}>Annuler</button>
            <button className="btn btn-primary" onClick={handleSubmitAchat}>Valider l'Achat</button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Fournisseur *</label>
            <select className="form-select" value={selectedFournisseurId} onChange={(e) => setSelectedFournisseurId(e.target.value)}>
              <option value="">-- Sélectionner Fournisseur --</option>
              {fournisseurs.map((f) => (
                <option key={f.id_fournisseur} value={f.id_fournisseur}>{f.nom}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">N° Facture Fournisseur</label>
            <input className="form-input" value={numFactureFournisseur} onChange={(e) => setNumFactureFournisseur(e.target.value)} placeholder="ex: FF-2026-89" />
          </div>
          <div className="form-group">
            <label className="form-label">Date d'Achat</label>
            <input className="form-input" type="date" value={dateAchat} onChange={(e) => setDateAchat(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1rem 0 0.5rem 0' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#3b82f6' }}>Articles Achetés & Mise à jour des Prix</h4>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-outline btn-sm" onClick={() => setShowQuickArticle(true)}>+ Nouvel Article</button>
            <button className="btn btn-primary btn-sm" onClick={handleAddLine}>+ Ajouter Ligne</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          {lignes.map((l, index) => {
            const qty = parseFloat(l.quantite) || 0;
            const pTtc = parseFloat(l.prix_achat_ttc) || 0;
            // Le TTC est déjà net (remise et taxes incluses) : le total de ligne s'obtient directement.
            const lineTtc = qty * pTtc;
            const pVenteTtc = parseFloat(l.nouveau_prix_vente_ttc) || 0;
            const remVente = parseFloat(l.nouvelle_remise_vente) || 0;
            const pVenteFinal = pVenteTtc * (1 - remVente / 100);

            return (
              <div key={index} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem', position: 'relative' }}>
                <button
                  className="btn btn-outline btn-sm"
                  style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', color: '#f87171', borderColor: '#f87171' }}
                  onClick={() => handleRemoveLine(index)}
                >✕</button>

                <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Article</label>
                    <SearchableSelect
                      options={articles.map(a => ({ value: a.id_article, label: a.nom + (a.reference ? ` (${a.reference})` : '') }))}
                      value={l.id_article}
                      onChange={(val) => handleArticleSelect(index, val)}
                      placeholder="Rechercher article..."
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Qté</label>
                    <input type="number" step="1" min="1" className="form-input form-input-sm" value={l.quantite} onChange={(e) => handleLineChange(index, 'quantite', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Remise %</label>
                    <input type="number" step="1" className="form-input form-input-sm" value={l.remise_pourcentage} onChange={(e) => handleLineChange(index, 'remise_pourcentage', e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.7fr 0.9fr', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', color: '#34d399' }} title="Prix hors taxes, avant TVA / remise / taxe suppl.">Prix Achat HT</label>
                    <input type="number" step="0.001" className="form-input form-input-sm" value={l.prix_achat_ht} onChange={(e) => handleLineChange(index, 'prix_achat_ht', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', color: '#fbbf24' }} title="Toutes taxes et remise comprises (TVA, remise, taxe suppl.)">Prix Achat TTC</label>
                    <input type="number" step="0.001" className="form-input form-input-sm" value={l.prix_achat_ttc} onChange={(e) => handleLineChange(index, 'prix_achat_ttc', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>TVA %</label>
                    <input type="number" step="1" className="form-input form-input-sm" value={l.taux_tva_achat} onChange={(e) => handleLineChange(index, 'taux_tva_achat', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', color: '#c084fc' }}>Taxe Suppl. %</label>
                    <input type="number" step="0.1" className="form-input form-input-sm" value={l.taux_taxe_supplementaire} onChange={(e) => handleLineChange(index, 'taux_taxe_supplementaire', e.target.value)} placeholder="0" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem', background: 'rgba(59,130,246,0.05)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.1)' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', color: '#60a5fa' }}>Prix Vente TTC</label>
                    <input type="number" step="0.001" className="form-input form-input-sm" value={l.nouveau_prix_vente_ttc} onChange={(e) => handleLineChange(index, 'nouveau_prix_vente_ttc', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', color: '#60a5fa' }}>Remise Client %</label>
                    <input type="number" step="0.1" className="form-input form-input-sm" value={l.nouvelle_remise_vente} onChange={(e) => handleLineChange(index, 'nouvelle_remise_vente', e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>P. Vente Final TTC</span>
                    <strong style={{ color: '#38bdf8' }}>{pVenteFinal.toFixed(3)} TND</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Ligne TTC</span>
                    <strong style={{ color: '#34d399' }}>{lineTtc.toFixed(3)} TND</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background: 'var(--bg-primary)', padding: '0.75rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', border: '1px solid var(--border-color)' }}>
          <span>Total HT: <strong>{totals.totHt.toFixed(3)} TND</strong></span>
          <span>TVA: <strong>{totals.totTva.toFixed(3)} TND</strong></span>
          {totals.totTaxeSuppl > 0 && (
            <span style={{ color: '#c084fc' }}>Taxe Suppl.: <strong>{totals.totTaxeSuppl.toFixed(3)} TND</strong></span>
          )}
          <span style={{ color: '#34d399', fontWeight: 'bold' }}>TOTAL TTC: {totals.totTtc.toFixed(3)} TND</span>
        </div>
      </Modal>

      {/* Detail Modal */}
      {selectedAchat && (
        <AchatDetailModal
          achat={selectedAchat}
          fournisseurs={fournisseurs}
          articles={articles}
          onClose={() => setSelectedAchat(null)}
          onUpdated={handleAchatUpdated}
        />
      )}

      {/* Quick Article Modal */}
      <QuickArticleModal
        isOpen={showQuickArticle}
        onClose={() => setShowQuickArticle(false)}
        onArticleCreated={(newArticle) => {
          setArticles([newArticle, ...articles]);
          setLignes([...lignes, {
            id_article: newArticle.id_article,
            quantite: 1,
            prix_achat_ttc: 0,
            prix_achat_ht: 0,
            taux_tva_achat: 19.0,
            taux_taxe_supplementaire: 0,
            remise_pourcentage: 0,
            nouveau_prix_vente_ttc: parseFloat(newArticle.prix_vente_ttc) || 0,
            nouvelle_remise_vente: parseFloat(newArticle.remise_max_pourcentage) || 0
          }]);
          setShowQuickArticle(false);
        }}
      />
    </div>
  );
};