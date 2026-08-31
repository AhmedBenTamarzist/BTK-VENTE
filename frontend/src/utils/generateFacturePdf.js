// Capture le rendu HTML de la facture (déjà mis en forme au format papier A4)
// et le convertit en PDF téléchargeable, sans passer par la boîte de dialogue
// d'impression du navigateur.
// jsPDF/html2canvas sont chargés à la demande : inutile d'alourdir le bundle
// principal (chargé par tous les postes) pour une fonctionnalité utilisée
// seulement sur la page de facturation.
//
// On utilise jsPDF.html() (pagination "autoPaging: text") plutôt qu'une simple
// capture canvas découpée à intervalles fixes : une facture avec beaucoup
// d'articles qui dépasse une page A4 doit être répartie sur plusieurs pages
// sans couper une ligne du tableau en deux — jsPDF.html() évite ça en se
// basant sur les nœuds de texte plutôt que sur des pixels bruts.
export async function generateFacturePdf(node, filename) {
  const { jsPDF } = await import('jspdf');

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidthMm = pdf.internal.pageSize.getWidth();

  await pdf.html(node, {
    html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: node.scrollWidth },
    autoPaging: 'text',
    width: pageWidthMm,
    windowWidth: node.scrollWidth,
    margin: 0,
    x: 0,
    y: 0,
  });

  pdf.save(filename);
}
