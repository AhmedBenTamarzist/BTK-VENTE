export function getFacturationLineUnitPriceHt(line) {
  const quantity = parseFloat(line.quantite_totale) || 0;
  const totalHt = parseFloat(line.montant_ht);
  const storedUnitPrice = parseFloat(line.prix_unitaire_moyen_ht) || 0;

  if (quantity <= 0 || !Number.isFinite(totalHt)) {
    return storedUnitPrice;
  }

  return totalHt / quantity;
}

export function getFacturationLineDisplayedTotalHt(line) {
  const quantity = parseFloat(line.quantite_totale) || 0;
  const puHt = Number(getFacturationLineUnitPriceHt(line).toFixed(3));
  const totalHt = quantity * puHt;

  return Math.round((totalHt + Number.EPSILON) * 1000) / 1000;
}

export function getFacturationDisplayedTotalHt(lines = []) {
  const totalMillimes = lines.reduce(
    (sum, line) => sum + Math.round(getFacturationLineDisplayedTotalHt(line) * 1000),
    0
  );

  return totalMillimes / 1000;
}

export function getFacturationDisplayedVat(totalHt, rate = 19) {
  const totalHtMillimes = Math.round((totalHt + Number.EPSILON) * 1000);
  const vatMillimes = Math.round((totalHtMillimes * rate) / 100);

  return vatMillimes / 1000;
}

export function getFacturationDisplayedTotalTtc(totalHt, vat, stampDuty) {
  const totalMillimes = [totalHt, vat, stampDuty].reduce(
    (sum, amount) => sum + Math.round((amount + Number.EPSILON) * 1000),
    0
  );

  return totalMillimes / 1000;
}