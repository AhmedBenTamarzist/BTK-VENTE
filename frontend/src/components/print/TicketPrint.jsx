import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

export const TicketPrint = ({ document, client, enterprise: initialEnterprise }) => {
  const [enterprise, setEnterprise] = useState(initialEnterprise || null);

  useEffect(() => {
    if (!enterprise) {
      api.getEnterprise()
        .then((data) => setEnterprise(data))
        .catch(() => {});
    }
  }, [enterprise]);

  if (!document) return null;

  const docTypeLabel =
    document.type_document === 'devis' ? 'DEVIS' :
    document.type_document === 'bon_livraison' ? 'BON DE LIVRAISON' : 'TICKET DE CAISSE';

  const isBonLivraison = document.type_document === 'bon_livraison';

  const renderCopy = (copyLabel) => (
    <>
      {/* Copy banner (only shown when printing a BL in two exemplaires) */}
      {copyLabel && (
        <div style={{
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '11px',
          letterSpacing: '0.05em',
          border: '1px solid #000',
          borderRadius: '3px',
          padding: '2px 0',
          marginBottom: '8px'
        }}>
          {copyLabel === 'client' ? 'EXEMPLAIRE CLIENT' : 'EXEMPLAIRE MAGASIN'}
        </div>
      )}

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
        <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{docTypeLabel} N° {document.numero}</div>
        <div>Date: {new Date(document.date_document).toLocaleString('fr-FR')}</div>
        {client && <div>Client: {client.nom} {client.prenom || ''}</div>}
        {(() => {
          // Extraire le vendeur depuis les notes (format: "Vendeur: Nom. reste...")
          const vendeurMatch = document.notes?.match(/^Vendeur:\s*([^.]+)/);
          const vendeurNom = vendeurMatch ? vendeurMatch[1].trim() : document.vendeur_nom || null;
          return vendeurNom ? <div>Vendeur: {vendeurNom}</div> : null;
        })()}
      </div>

      {/* Articles Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '11px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000', textAlign: 'left' }}>
            <th>Article</th>
            <th style={{ textAlign: 'center' }}>Qté</th>
            <th style={{ textAlign: 'right' }}>P.U</th>
            <th style={{ textAlign: 'right' }}>Total</th>
            <th style={{ textAlign: 'center' }}>Livré</th>
          </tr>
        </thead>
        <tbody>
          {(document.lignes || []).map((l, index) => {
            // Support double source: l.article.nom (API) ou l.nom_article (local state)
            const art = l.article || {};
            const artName = art.nom || l.nom_article || `Art #${l.id_article}`;
            const artRef = art.reference || l.reference || null;
            const pu = parseFloat(l.prix_unitaire_apres_remise || l.prix_unitaire_ttc);
            const qty = parseFloat(l.quantite);
            const qtyLivree = parseFloat(l.quantite_livree ?? (l.is_livre ? qty : 0));
            const lineTotal = pu * qty;

            // Déterminer le statut de livraison de la ligne
            let livraisonIcon, livraisonStyle;
            const statutLivraison = l.statut_livraison ||
              (l.is_livre === true ? 'livre' : l.is_livre === false ? 'non_livre' : null);
            if (statutLivraison === 'livre' || qtyLivree >= qty) {
              livraisonIcon = '✓';
              livraisonStyle = { color: '#000', fontWeight: 'bold' };
            } else if (statutLivraison === 'partiellement_livre' || (qtyLivree > 0 && qtyLivree < qty)) {
              livraisonIcon = '◑';
              livraisonStyle = { color: '#555' };
            } else {
              livraisonIcon = '✗';
              livraisonStyle = { color: '#888' };
            }

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
                <td style={{ textAlign: 'center', ...livraisonStyle, fontSize: '10px' }}>
                  {livraisonIcon} {qtyLivree}/{qty}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Statut global livraison */}
      {document.statut_livraison && (
        <div style={{ fontSize: '10px', marginBottom: '6px', display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{
            padding: '1px 6px',
            borderRadius: '3px',
            border: '1px solid #000',
            fontWeight: 'bold'
          }}>
            Livraison :
            {document.statut_livraison === 'livre' ? '✓ Livré' :
             document.statut_livraison === 'partiellement_livre' ? '◑ Partielle' :
             '✗ Non livré'}
          </span>
        </div>
      )}

      {/* Totals */}
      <div style={{ borderTop: '1px dashed #000', paddingTop: '6px', fontSize: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Sous-total:</span>
          <span>{parseFloat(document.montant_ttc_sans_remise || document.montant_ttc_final).toFixed(3)} TND</span>
        </div>
        {parseFloat(document.montant_remise) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Remise Totale:</span>
            <span>-{parseFloat(document.montant_remise).toFixed(3)} TND</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', margin: '4px 0', borderTop: '1px solid #000', paddingTop: '4px' }}>
          <span>TOTAL TTC:</span>
          <span>{parseFloat(document.montant_ttc_final).toFixed(3)} TND</span>
        </div>

        {/* Mode de paiement */}
        {document.mode_paiement && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span>Mode de paiement:</span>
            <span style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
              {document.mode_paiement === 'espece' ? 'ESPÈCE' :
               document.mode_paiement === 'cheque' ? 'CHÈQUE' :
               document.mode_paiement === 'virement' ? 'VIREMENT' :
               document.mode_paiement === 'carte' ? 'CARTE' :
               document.mode_paiement?.toUpperCase() || '—'}
            </span>
          </div>
        )}

        {/* Montant payé */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
          <span>Montant Encaissé:</span>
          <span style={{ fontWeight: 'bold' }}>{parseFloat(document.montant_encaisse || document.montant_paye || 0).toFixed(3)} TND</span>
        </div>

        {/* Monnaie rendue */}
        {parseFloat(document.monnaie_rendue || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', marginTop: '2px' }}>
            <span>🪙 Monnaie Rendue:</span>
            <span>{parseFloat(document.monnaie_rendue).toFixed(3)} TND</span>
          </div>
        )}

        {/* Reste à payer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '2px', color: parseFloat(document.montant_restant) > 0 ? '#c00' : '#000' }}>
          <span>Reste à Payer:</span>
          <span>{parseFloat(document.montant_restant || 0).toFixed(3)} TND</span>
        </div>
      </div>

      {/* Cachet / Signature box (BL uniquement) */}
      {copyLabel && (
        <div style={{ marginTop: '14px', border: '1px solid #000', borderRadius: '4px', padding: '6px 8px 34px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 'bold' }}>
            {copyLabel === 'client'
              ? `Cachet ${enterprise?.raison_sociale || 'Entreprise'}`
              : 'Cachet / Signature Client'}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '10px', borderTop: '1px dashed #000', paddingTop: '6px' }}>
        Merci pour votre visite !
      </div>
    </>
  );

  return (
    <div className="printable-ticket" style={{ background: 'white', color: 'black', padding: '10px', fontFamily: 'monospace', fontSize: '12px' }}>
      {isBonLivraison ? (
        <>
          {renderCopy('client')}
          <div style={{ textAlign: 'center', fontSize: '10px', margin: '16px 0', borderTop: '1px dashed #000', paddingTop: '8px' }}>
            ✂ - - - - - - - - - - - - COUPER ICI - - - - - - - - - - - - ✂
          </div>
          {renderCopy('magasin')}
        </>
      ) : (
        renderCopy(null)
      )}
    </div>
  );
};
