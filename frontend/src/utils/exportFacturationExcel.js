import { montantToWordsTnd } from './numberToWords';

// Style "contour" uniquement — pas d'aplat de couleur/gris (économie d'encre) :
// chaque zone est délimitée par un simple trait, la hiérarchie vient du gras
// et de la taille de police, jamais d'un fond rempli.
const BLACK = 'FF000000';
const MUTED = 'FF444444';
const THIN = { style: 'thin', color: { argb: 'FFBBBBBB' } };
const THICK = { style: 'medium', color: { argb: 'FF000000' } };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };

// Génère un classeur Excel reprenant le même design que la facture imprimée/PDF :
// en-tête entreprise, bloc facture, bloc client, tableau des articles avec
// en-tête colorée, et totaux encadrés (Total H.T / TVA / Timbre / Total T.T.C).
// exceljs est chargé à la demande (bibliothèque volumineuse, utilisée
// uniquement lors d'un export depuis la page de facturation).
export async function exportFacturationToExcel(facturation, enterprise) {
  const { default: ExcelJS } = await import('exceljs');
  const client = facturation.client;
  const montantHt = parseFloat(facturation.montant_ht) || 0;
  const montantTva = parseFloat(facturation.montant_tva) || 0;
  const montantTimbre = parseFloat(facturation.montant_timbre ?? 1) || 0;
  const montantTtc = parseFloat(facturation.montant_ttc) || 0;
  const tvaPct = facturation.lignes?.[0]?.taux_tva ? parseFloat(facturation.lignes[0].taux_tva) : 19;
  const lignes = facturation.lignes || [];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Facture', { pageSetup: { paperSize: 9, orientation: 'portrait', margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0, footer: 0 } } });
  ws.columns = [{ width: 10 }, { width: 42 }, { width: 13 }, { width: 8 }, { width: 14 }];

  let r = 1;

  // En-tête entreprise
  ws.getCell(`A${r}`).value = enterprise?.raison_sociale || 'QUINCAILLERIE';
  ws.getCell(`A${r}`).font = { bold: true, size: 15, color: { argb: BLACK } };
  r++;
  const infoLines = [
    enterprise?.adresse,
    enterprise?.telephone ? `Tél : ${enterprise.telephone}` : null,
    enterprise?.matricule_fiscal ? `Matricule Fiscal : ${enterprise.matricule_fiscal}` : null,
    enterprise?.rib ? `RIB : ${enterprise.rib}` : null,
  ].filter(Boolean);
  infoLines.forEach((line) => {
    ws.getCell(`A${r}`).value = line;
    ws.getCell(`A${r}`).font = { size: 10, color: { argb: MUTED } };
    r++;
  });

  // Bloc facture (aligné à droite)
  const dateStr = new Date(facturation.date_facturation).toLocaleDateString('fr-FR');
  const factRowStart = r - infoLines.length - 1;
  ws.getCell(`E${factRowStart}`).value = 'FACTURE';
  ws.getCell(`E${factRowStart}`).font = { bold: true, size: 9, color: { argb: BLACK } };
  ws.getCell(`E${factRowStart}`).alignment = { horizontal: 'right' };
  ws.getCell(`E${factRowStart + 1}`).value = `N° ${facturation.numero_facture}`;
  ws.getCell(`E${factRowStart + 1}`).font = { bold: true, size: 13, color: { argb: BLACK } };
  ws.getCell(`E${factRowStart + 1}`).alignment = { horizontal: 'right' };
  ws.getCell(`E${factRowStart + 2}`).value = `Date : ${dateStr}`;
  ws.getCell(`E${factRowStart + 2}`).font = { size: 10, color: { argb: MUTED } };
  ws.getCell(`E${factRowStart + 2}`).alignment = { horizontal: 'right' };

  r++;

  // Bloc client
  ws.getCell(`A${r}`).value = 'FACTURÉ À';
  ws.getCell(`A${r}`).font = { bold: true, size: 9, color: { argb: BLACK } };
  r++;
  ws.getCell(`A${r}`).value = client ? `${client.nom} ${client.prenom || ''}`.trim() : '—';
  ws.getCell(`A${r}`).font = { bold: true, size: 11, color: { argb: BLACK } };
  r++;
  ws.getCell(`A${r}`).value = `Matricule Fiscal : ${client?.matricule_fiscal || '—'}`;
  ws.getCell(`A${r}`).font = { size: 10, color: { argb: MUTED } };
  r++;
  r++;

  // Tableau : en-tête
  const headerRow = r;
  ['QTÉ', 'DÉSIGNATION', 'P.U. H.T', 'TVA', 'TOTAL H.T'].forEach((label, i) => {
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = label;
    cell.font = { bold: true, size: 10, color: { argb: BLACK } };
    cell.alignment = { horizontal: i === 1 ? 'left' : 'center' };
    cell.border = { top: THICK, bottom: THICK };
  });
  // Répète cette ligne d'en-tête sur chaque page si la facture est imprimée sur plusieurs pages A4
  ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
  r++;

  // Lignes articles
  lignes.forEach((l) => {
    const qty = parseFloat(l.quantite_totale) || 0;
    const puHt = parseFloat(l.prix_unitaire_moyen_ht) || 0;
    const totalHt = parseFloat(l.montant_ht ?? (qty * puHt));
    const ligneTva = l.taux_tva ? parseFloat(l.taux_tva) : tvaPct;

    ws.getCell(r, 1).value = qty;
    ws.getCell(r, 2).value = l.article?.nom || `Art #${l.id_article}`;
    ws.getCell(r, 3).value = puHt;
    ws.getCell(r, 4).value = `${ligneTva}%`;
    ws.getCell(r, 5).value = totalHt;

    for (let c = 1; c <= 5; c++) {
      const cell = ws.getCell(r, c);
      cell.font = { size: 10, color: { argb: c === 4 ? MUTED : BLACK } };
      cell.border = { bottom: THIN };
      if (c === 3 || c === 5) { cell.numFmt = '0.000'; cell.alignment = { horizontal: 'right' }; }
      else if (c === 1 || c === 4) cell.alignment = { horizontal: 'center' };
    }
    r++;
  });
  r++;

  // Totaux : encadrés, colonnes D/E
  const totals = [
    ['Total H.T', montantHt, false],
    [`T.V.A ${tvaPct}%`, montantTva, false],
    ['Timbre Fiscal', montantTimbre, false],
    ['TOTAL T.T.C', montantTtc, true],
  ];
  totals.forEach(([label, value, isGrandTotal]) => {
    const labelCell = ws.getCell(r, 4);
    const valueCell = ws.getCell(r, 5);
    ws.mergeCells(r, 4, r, 4);
    labelCell.value = label;
    valueCell.value = value;
    valueCell.numFmt = '0.000';
    valueCell.alignment = { horizontal: 'right' };
    if (isGrandTotal) {
      labelCell.font = { bold: true, size: 11, color: { argb: BLACK } };
      valueCell.font = { bold: true, size: 11, color: { argb: BLACK } };
      labelCell.border = { top: THICK, left: THIN, bottom: THIN, right: THIN };
      valueCell.border = { top: THICK, left: THIN, bottom: THIN, right: THIN };
    } else {
      labelCell.font = { size: 10, color: { argb: BLACK } };
      valueCell.font = { size: 10, color: { argb: BLACK } };
      labelCell.border = BOX;
      valueCell.border = BOX;
    }
    r++;
  });
  r++;

  // Montant en lettres
  const wordsRow = r;
  ws.mergeCells(`A${wordsRow}:E${wordsRow + 1}`);
  const wordsCell = ws.getCell(`A${wordsRow}`);
  wordsCell.value = `Arrêtée la présente facture à la somme de ${montantToWordsTnd(montantTtc)}.`;
  wordsCell.font = { italic: true, size: 10, color: { argb: BLACK } };
  wordsCell.alignment = { wrapText: true, vertical: 'top' };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Facture_${facturation.numero_facture.replace(/\//g, '-')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
