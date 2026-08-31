import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

export const ReceiptPrint = ({ reglement, client, document, enterprise: initialEnterprise }) => {
  const [enterprise, setEnterprise] = useState(initialEnterprise || null);

  useEffect(() => {
    if (!enterprise) {
      api.getEnterprise()
        .then((data) => setEnterprise(data))
        .catch(() => {});
    }
  }, [enterprise]);

  if (!reglement) return null;

  const modeLabels = {
    espece: 'Espèce (Comptant)',
    cheque: 'Chèque',
    virement: 'Virement Bancaire',
    traite: 'Traite'
  };

  const clientName = client ? `${client.nom} ${client.prenom || ''}` : `Client #${reglement.id_client}`;
  const clientSolde = client ? parseFloat(client.solde_compte) : 0;
  const resteGlobalClient = clientSolde < 0 ? Math.abs(clientSolde) : 0;

  return (
    <div className="printable-receipt" style={{ background: 'white', color: 'black', padding: '15px', fontFamily: 'sans-serif', fontSize: '13px', width: '100%', maxWidth: '500px', margin: '0 auto', border: '1px solid #ddd', borderRadius: '8px' }}>
      {/* Enterprise Header */}
      <div style={{ textAlign: 'center', marginBottom: '12px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>
          {enterprise?.raison_sociale || 'QUINCAILLERIE GENERALE'}
        </h2>
        {enterprise?.matricule_fiscal && <div>MF: {enterprise.matricule_fiscal}</div>}
        {enterprise?.telephone && <div>Tél: {enterprise.telephone}</div>}
        {enterprise?.adresse && <div style={{ fontSize: '11px', color: '#555' }}>{enterprise.adresse}</div>}
      </div>

      {/* Receipt Voucher Header */}
      <div style={{ textAlign: 'center', background: '#f1f5f9', padding: '8px', borderRadius: '6px', marginBottom: '12px', border: '1px solid #cbd5e1' }}>
        <h3 style={{ margin: 0, fontSize: '16px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0f172a' }}>
          REÇU DE RÈGLEMENT N° {reglement.numero}
        </h3>
        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
          Date: {new Date(reglement.date_reglement || Date.now()).toLocaleString('fr-FR')}
        </div>
      </div>

      {/* Client Info */}
      <div style={{ marginBottom: '12px', background: '#fafafa', padding: '8px', borderRadius: '4px', border: '1px solid #eee' }}>
        <div><strong>REÇU DE :</strong> <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{clientName}</span></div>
        {client?.telephone && <div>Tél Client: {client.telephone}</div>}
        {client?.matricule_fiscal && <div>MF Client: {client.matricule_fiscal}</div>}
      </div>

      {/* Encashment Details Box */}
      <div style={{ border: '2px solid #10b981', borderRadius: '8px', padding: '12px', marginBottom: '12px', background: '#f0fdf4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#065f46' }}>MONTANT ENCAISSÉ :</span>
          <span style={{ fontSize: '20px', fontWeight: '900', color: '#047857' }}>
            {parseFloat(reglement.montant).toFixed(3)} TND
          </span>
        </div>

        <div style={{ fontSize: '12px', color: '#047857', borderTop: '1px dashed #6ee7b7', paddingTop: '6px' }}>
          <div>Mode de Règlement: <strong>{modeLabels[reglement.mode_paiement] || reglement.mode_paiement}</strong></div>
          {reglement.reference_paiement && <div>N° Référence / Chèque: <strong>{reglement.reference_paiement}</strong></div>}
          {reglement.date_echeance && <div>Date d'Échéance: <strong>{new Date(reglement.date_echeance).toLocaleDateString('fr-FR')}</strong></div>}
        </div>
      </div>

      {/* Breakdown Scope */}
      <div style={{ marginBottom: '14px', fontSize: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}>
        {document ? (
          <>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
              Affectation au Document N° {document.numero} :
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Total Document TTC:</span>
              <span>{parseFloat(document.montant_ttc_final).toFixed(3)} TND</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#047857' }}>
              <span>Payé sur ce document:</span>
              <span>{parseFloat(reglement.montant).toFixed(3)} TND</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: parseFloat(document.montant_restant) > 0 ? '#b45309' : '#047857' }}>
              <span>Reste à payer sur ce document:</span>
              <span>{parseFloat(document.montant_restant).toFixed(3)} TND</span>
            </div>
          </>
        ) : (
          <div style={{ fontWeight: 'bold', color: '#1e293b' }}>
            Affectation: <span>Règlement / Avance sur Compte Client Global</span>
          </div>
        )}

        <div style={{ borderTop: '1px dashed #cbd5e1', marginTop: '8px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
          <span>RESTE Dû GLOBAL CLIENT :</span>
          <span style={{ color: resteGlobalClient > 0 ? '#dc2626' : '#047857' }}>
            {resteGlobalClient.toFixed(3)} TND
          </span>
        </div>
      </div>

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '10px', borderTop: '1px solid #ccc', fontSize: '11px', color: '#64748b' }}>
        <div style={{ textAlign: 'center', width: '45%' }}>
          <div>Signature & Cachet Caisse</div>
          <div style={{ height: '40px' }}></div>
        </div>
        <div style={{ textAlign: 'center', width: '45%' }}>
          <div>Signature Client</div>
          <div style={{ height: '40px' }}></div>
        </div>
      </div>
    </div>
  );
};
