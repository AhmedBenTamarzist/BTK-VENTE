import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { montantToWordsTnd } from '../../utils/numberToWords';

// Même style "contour" (sans aplat) que la facture — voir FacturePrint.jsx.
const INK = '#000000';
const MUTED = '#444444';
const BORDER = '#000000';
const FONT = "'Inter', 'Segoe UI', Arial, Helvetica, sans-serif";

// clientNom: string ; lignes: [{ id_article, nom, quantite, prix_unitaire_ttc, taux_tva }]
export const DevisPrint = React.forwardRef(({ clientNom, lignes = [], enterprise: initialEnterprise }, ref) => {
  const [enterprise, setEnterprise] = useState(initialEnterprise || null);

  useEffect(() => {
    if (!enterprise) {
      api.getEnterprise().then((data) => setEnterprise(data)).catch(() => {});
    }
  }, [enterprise]);

  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  let montantHt = 0;
  let montantTva = 0;
  let montantTtc = 0;
  const computedLignes = lignes.map((l) => {
    const qty = parseFloat(l.quantite) || 0;
    const puTtc = parseFloat(l.prix_unitaire_ttc) || 0;
    const tvaPct = parseFloat(l.taux_tva) || 0;
    const puHt = tvaPct > 0 ? puTtc / (1 + tvaPct / 100) : puTtc;
    const totalHt = qty * puHt;
    const totalTtc = qty * puTtc;
    montantHt += totalHt;
    montantTva += totalTtc - totalHt;
    montantTtc += totalTtc;
    return { ...l, qty, puHt, totalHt, tvaPct };
  });
  const tvaPctAffiche = computedLignes[0]?.tvaPct ?? 19;

  return (
    <div
      ref={ref}
      className="printable-facture"
      style={{ background: '#ffffff', color: INK, padding: '14mm', fontFamily: FONT, fontSize: '11px', lineHeight: 1.45 }}
    >
      {/* En-tête entreprise */}
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

      <div style={{ textAlign: 'center', fontSize: '17px', fontWeight: 800, margin: '16px 0' }}>DEVIS</div>

      {/* Bloc client */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', color: INK }}>
        <div>DOIT MR :&nbsp;&nbsp;&nbsp;{clientNom || '—'}</div>
        <div>LE : {dateStr}</div>
      </div>

      {/* Tableau des articles */}
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
          {computedLignes.map((l, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #bbbbbb' }}>
              <td style={{ padding: '5px 8px', textAlign: 'center', color: INK }}>{l.qty}</td>
              <td style={{ padding: '5px 8px', color: INK }}>{l.nom}</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', color: INK }}>{l.puHt.toFixed(3)}</td>
              <td style={{ padding: '5px 8px', textAlign: 'center', color: MUTED }}>{l.tvaPct}%</td>
              <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, color: INK }}>{l.totalHt.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totaux + montant en lettres : bloc solidaire, ne se coupe jamais entre deux pages */}
      <div className="facture-summary-block">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
          <div style={{ width: '250px', border: `1px solid ${BORDER}`, borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', color: INK }}>
              <span>Total H.T</span>
              <span>{montantHt.toFixed(3)} TND</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', color: INK, borderTop: '1px solid #bbbbbb' }}>
              <span>T.V.A {tvaPctAffiche}%</span>
              <span>{montantTva.toFixed(3)} TND</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderTop: `1.5px solid ${BORDER}`, color: INK, fontWeight: 800, fontSize: '12.5px' }}>
              <span>TOTAL T.T.C</span>
              <span>{montantTtc.toFixed(3)} TND</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '18px', paddingTop: '10px', borderTop: `1px solid ${BORDER}`, fontStyle: 'italic', color: INK, fontSize: '10.5px' }}>
          Arrêtée la présente devis à la somme de <strong>{montantToWordsTnd(montantTtc)}</strong>.
        </div>

        <div style={{ marginTop: '28px', paddingTop: '8px', borderTop: '1px solid #bbbbbb', textAlign: 'center', color: MUTED, fontSize: '9.5px' }}>
          Devis non contractuel, sujet à modification.
        </div>
      </div>
    </div>
  );
});
