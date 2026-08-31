import React from 'react';

export const StatusBadge = ({ status }) => {
  let badgeClass = 'badge-secondary';
  let label = status || 'N/A';

  switch (status) {
    case 'brouillon':
      badgeClass = 'badge-secondary';
      label = 'Brouillon';
      break;
    case 'valide':
    case 'validee':
    case 'effectuee':
    case 'paye':
    case 'payee':
    case 'encaisse':
    case 'livre':
      badgeClass = 'badge-success';
      label = status === 'paye' || status === 'payee' ? 'Payé' :
              status === 'livre' ? 'Livré' :
              status === 'encaisse' ? 'Encaissé' : 'Validé';
      break;
    case 'partiellement_paye':
    case 'partiellement_payee':
    case 'partiellement_livre':
    case 'en_attente':
    case 'planifiee':
      badgeClass = 'badge-warning';
      label = status.includes('paye') ? 'Part. Payé' :
              status === 'partiellement_livre' ? 'Part. Livré' :
              status === 'en_attente' ? 'En Attente' : 'Planifiée';
      break;
    case 'non_paye':
    case 'non_livre':
    case 'annule':
    case 'annulee':
    case 'rejete':
      badgeClass = 'badge-danger';
      label = status.includes('paye') ? 'Non Payé' :
              status === 'non_livre' ? 'Non Livré' :
              status === 'rejete' ? 'Rejeté' : 'Annulé';
      break;

    // Document types
    case 'devis':
      badgeClass = 'badge-info';
      label = 'Devis';
      break;
    case 'bon_livraison':
      badgeClass = 'badge-success';
      label = 'Bon de Livraison';
      break;
    case 'facture_rapide':
      badgeClass = 'badge-warning';
      label = 'Ticket de Caisse';
      break;
    default:
      break;
  }

  return <span className={`badge ${badgeClass}`}>{label}</span>;

};
