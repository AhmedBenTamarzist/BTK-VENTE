import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

export const RetourPrint = ({ retour, client, enterprise: initialEnterprise }) => {
  const [enterprise, setEnterprise] = useState(initialEnterprise || null);

  useEffect(() => {
    if (!enterprise) {
      api.getEnterprise()
        .then((data) => setEnterprise(data))
        .catch(() => {});
    }
  }, [enterprise]);

  if (!retour) return null;

  const modeLabels = {
    credit: 'Crédité au Compte Client',
    especes: 'Remboursé en Espèces'
  };

  return (
    <div className="printable-ticket" style={{ background: 'white', color: 'black', padding: '10px', fontFamily: 'monospace', fontSize: '12px' }}>
      {/* Header Enterprise Info */}
      <div style={{ textAlign: 'center', marginBottom: '10px', borderBottom: '1px dashed #000', paddingBottom: '8px' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 'bold' }}>
          {enterprise?.raison_sociale || 'QUINCAILLERIE GENERALE'}
        </h3>
        {enterprise?.matricule_fiscal && <div>MF: {enterprise.matricule_fiscal}</div>}
        {enterprise?.telephone && <div>Tél: {enterprise.telephone}</div>}
        {enterprise?.adresse && <div style={{ fontSize: '10px' }}>{enterprise.adresse}</div>}
      </div>

      {/* Document Info */}
      <div style={{ marginBottom: '8px', borderBottom: '1px dashed #000', paddingBottom: '6px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '13px' }}>BON DE RETOUR N° {retour.numero}</div>
        <div>Date: {new Date(retour.date_retour || Date.now()).toLocaleString('fr-FR')}</div>
        {client && <div>Client: {client.nom} {client.prenom || ''}</div>}
        {retour.numero_document && <div>Document Lié: {retour.numero_document}</div>}
        {retour.motif && <div>Motif: {retour.motif}</div>}
      </div>

      {/* Articles Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '11px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000', textAlign: 'left' }}>
            <th>Article</th>
            <th style={{ textAlign: 'center' }}>Qté</th>
            <th style={{ textAlign: 'right' }}>P.U TTC</th>
            <th style={{ textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {(retour.lignes || []).map((l, index) => {
            const artName = l.article?.nom || `Art #${l.id_article}`;
            const artRef = l.article?.reference || null;
            const pu = parseFloat(l.prix_unitaire_ttc);
            const qty = parseFloat(l.quantite);
            const lineTotal = pu * qty;

            return (
              <tr key={index} style={{ borderBottom: '1px dotted #ccc' }}>
                <td style={{ padding: '3px 0' }}>
                  <div style={{ fontWeight: 'bold' }}>{artName}</div>
                  {artRef && (
                    <div style={{ fontSize: '10px', color: '#555' }}>Réf: {artRef}</div>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>{qty}</td>
                <td style={{ textAlign: 'right' }}>{pu.toFixed(3)}</td>
                <td style={{ textAlign: 'right' }}>{lineTotal.toFixed(3)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Refund details & Totals */}
      <div style={{ borderTop: '1px dashed #000', paddingTop: '6px', fontSize: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', margin: '4px 0' }}>
          <span>TOTAL RETOURNÉ:</span>
          <span>{parseFloat(retour.montant_ttc).toFixed(3)} TND</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span>Mode Remboursement:</span>
          <span style={{ fontWeight: 'bold', fontSize: '11px' }}>
            {modeLabels[retour.mode_remboursement] || retour.mode_remboursement || 'Crédit'}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '10px', borderTop: '1px dashed #000', paddingTop: '6px' }}>
        Bon de retour validé.
      </div>
    </div>
  );
};
