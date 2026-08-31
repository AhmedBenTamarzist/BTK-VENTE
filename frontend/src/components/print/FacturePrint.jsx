import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { montantToWordsTnd } from '../../utils/numberToWords';

// Style "contour" uniquement — pas d'aplat de couleur/gris : chaque zone est
// délimitée par un simple trait, jamais par un fond rempli. Objectif : rester
// lisible et propre à l'impression noir & blanc sans consommer d'encre.
const INK = '#000000';
const MUTED = '#444444';
const BORDER = '#000000';
const FONT = "'Inter', 'Segoe UI', Arial, Helvetica, sans-serif";

export const FacturePrint = React.forwardRef(({ facturation, client: initialClient, enterprise: initialEnterprise }, ref) => {
  const [enterprise, setEnterprise] = useState(initialEnterprise || null);

  useEffect(() => {
    if (!enterprise) {
      api.getEnterprise().then((data) => setEnterprise(data)).catch(() => {});
    }
  }, [enterprise]);

  if (!facturation) return null;

  const client = facturation.client || initialClient;
  const montantHt = parseFloat(facturation.montant_ht) || 0;
  const montantTva = parseFloat(facturation.montant_tva) || 0;
  const montantTimbre = parseFloat(facturation.montant_timbre ?? 1) || 0;
  const montantTtc = parseFloat(facturation.montant_ttc) || 0;
  const tvaPct = facturation.lignes?.[0]?.taux_tva ? parseFloat(facturation.lignes[0].taux_tva) : 19;
  const lignes = facturation.lignes || [];

  const dateStr = new Date(facturation.date_facturation).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div
      ref={ref}
      className="printable-facture"
      style={{ background: '#ffffff', color: INK, padding: '14mm', fontFamily: FONT, fontSize: '11px', lineHeight: 1.45 }}
    >
      {/* En-tête : identité entreprise + bloc facture */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ color: INK }}>
          <div style={{ fontSize: '19px', fontWeight: 800, letterSpacing: '-0.01em', color: INK }}>
            {enterprise?.raison_sociale || 'QUINCAILLERIE'}
          </div>
          <div style={{ marginTop: '6px', color: MUTED, fontSize: '10.5px' }}>
            {enterprise?.adresse && <div>{enterprise.adresse}</div>}
            {enterprise?.telephone && <div>Tél : {enterprise.telephone}</div>}
            {enterprise?.matricule_fiscal && <div>Matricule Fiscal : {enterprise.matricule_fiscal}</div>}
            {enterprise?.rib && <div>RIB : {enterprise.rib}</div>}
          </div>
        </div>

        <div style={{ textAlign: 'right', border: `1.5px solid ${BORDER}`, borderRadius: '6px', padding: '10px 16px', minWidth: '180px', color: INK }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: INK }}>FACTURE</div>
          <div style={{ fontSize: '17px', fontWeight: 800, margin: '2px 0', color: INK }}>N° {facturation.numero_facture}</div>
          <div style={{ fontSize: '10.5px', color: MUTED }}>Date : {dateStr}</div>
        </div>
      </div>

      <div style={{ borderTop: `1.5px solid ${BORDER}`, margin: '14px 0' }} />

      {/* Bloc client */}
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '10px 14px', display: 'inline-block', minWidth: '260px', marginBottom: '16px' }}>
        <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.08em', color: INK, marginBottom: '3px' }}>FACTURÉ À</div>
        <div style={{ fontWeight: 700, fontSize: '12px', color: INK }}>
          {client ? `${client.nom} ${client.prenom || ''}`.trim() : '—'}
        </div>
        <div style={{ color: MUTED, fontSize: '10.5px' }}>Matricule Fiscal : {client?.matricule_fiscal || '—'}</div>
        {client?.adresse && <div style={{ color: MUTED, fontSize: '10.5px' }}>{client.adresse}</div>}
      </div>

      {/* Tableau des articles — l'en-tête se répète sur chaque page, les lignes ne sont jamais coupées */}
      <table className="facture-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
        <colgroup>
          <col style={{ width: '10%' }} />
          <col style={{ width: '48%' }} />
          <col style={{ width: '15%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.03em', borderTop: `1.5px solid ${BORDER}`, borderBottom: `1.5px solid ${BORDER}`, color: INK }}>QTÉ</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, letterSpacing: '0.03em', borderTop: `1.5px solid ${BORDER}`, borderBottom: `1.5px solid ${BORDER}`, color: INK }}>DÉSIGNATION</th>
            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, letterSpacing: '0.03em', borderTop: `1.5px solid ${BORDER}`, borderBottom: `1.5px solid ${BORDER}`, color: INK }}>P.U. H.T</th>
            <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, letterSpacing: '0.03em', borderTop: `1.5px solid ${BORDER}`, borderBottom: `1.5px solid ${BORDER}`, color: INK }}>TVA</th>
            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, letterSpacing: '0.03em', borderTop: `1.5px solid ${BORDER}`, borderBottom: `1.5px solid ${BORDER}`, color: INK }}>TOTAL H.T</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => {
            const qty = parseFloat(l.quantite_totale) || 0;
            const puHt = parseFloat(l.prix_unitaire_moyen_ht) || 0;
            const totalHt = parseFloat(l.montant_ht ?? (qty * puHt));
            const ligneTva = l.taux_tva ? parseFloat(l.taux_tva) : tvaPct;
            return (
              <tr key={i} style={{ borderBottom: '1px solid #bbbbbb' }}>
                <td style={{ padding: '5px 8px', textAlign: 'center', color: INK }}>{qty}</td>
                <td style={{ padding: '5px 8px', color: INK }}>{l.article?.nom || `Art #${l.id_article}`}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: INK }}>{puHt.toFixed(3)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'center', color: MUTED }}>{ligneTva}%</td>
                <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, color: INK }}>{totalHt.toFixed(3)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totaux + montant en lettres + pied de page : bloc solidaire, ne se coupe jamais entre deux pages */}
      <div className="facture-summary-block">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
          <div style={{ width: '250px', border: `1px solid ${BORDER}`, borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', color: INK }}>
              <span>Total H.T</span>
              <span>{montantHt.toFixed(3)} TND</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', color: INK, borderTop: '1px solid #bbbbbb' }}>
              <span>T.V.A {tvaPct}%</span>
              <span>{montantTva.toFixed(3)} TND</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', color: INK, borderTop: '1px solid #bbbbbb' }}>
              <span>Timbre Fiscal</span>
              <span>{montantTimbre.toFixed(3)} TND</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderTop: `1.5px solid ${BORDER}`, color: INK, fontWeight: 800, fontSize: '12.5px' }}>
              <span>TOTAL T.T.C</span>
              <span>{montantTtc.toFixed(3)} TND</span>
            </div>
          </div>
        </div>

        {/* Montant en lettres */}
        <div style={{ marginTop: '18px', paddingTop: '10px', borderTop: `1px solid ${BORDER}`, fontStyle: 'italic', color: INK, fontSize: '10.5px' }}>
          Arrêtée la présente facture à la somme de <strong>{montantToWordsTnd(montantTtc)}</strong>.
        </div>

        {/* Pied de page */}
        <div style={{ marginTop: '28px', paddingTop: '8px', borderTop: '1px solid #bbbbbb', textAlign: 'center', color: MUTED, fontSize: '9.5px' }}>
          {enterprise?.raison_sociale || ''}{enterprise?.matricule_fiscal ? ` — MF ${enterprise.matricule_fiscal}` : ''} — Merci de votre confiance
        </div>
      </div>
    </div>
  );
});
