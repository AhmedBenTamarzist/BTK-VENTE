// Conversion d'un nombre entier (0 - 999999) en toutes lettres françaises,
// dans le style observé sur les factures papier du client : mots séparés par
// des espaces (pas de tirets), ex. "QUATRE CENT TRENTE SEPT" et non
// "quatre-cent-trente-sept".
const UNITS = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix sept', 'dix huit', 'dix neuf'];
const TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre vingt', 'quatre vingt'];

function twoDigitsToWords(n) {
  if (n < 20) return UNITS[n];
  const ten = Math.floor(n / 10);
  const unit = n % 10;

  if (ten === 7 || ten === 9) {
    // soixante-dix (70-79) / quatre-vingt-dix (90-99)
    const rest = 10 + unit;
    if (unit === 1 && ten === 7) return `${TENS[ten]} et ${twoDigitsToWords(rest)}`;
    return `${TENS[ten]} ${twoDigitsToWords(rest)}`;
  }

  if (unit === 0) return TENS[ten] + (ten === 8 ? 's' : '');
  if (unit === 1 && ten !== 8) return `${TENS[ten]} et un`;
  return `${TENS[ten]} ${UNITS[unit]}`;
}

function threeDigitsToWords(n) {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  let word = '';
  if (hundred > 0) {
    word += hundred === 1 ? 'cent' : `${UNITS[hundred]} cent`;
    if (rest === 0 && hundred > 1) word += 's';
  }
  if (rest > 0) {
    if (word) word += ' ';
    word += twoDigitsToWords(rest);
  }
  return word;
}

export function integerToWordsFr(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'zéro';

  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;

  let word = '';
  if (thousands > 0) {
    word += thousands === 1 ? 'mille' : `${threeDigitsToWords(thousands)} mille`;
  }
  if (rest > 0) {
    if (word) word += ' ';
    word += threeDigitsToWords(rest);
  }
  return word;
}

// Montant en Dinars/Millimes (3 décimales, format monétaire tunisien) -> texte français.
// Les millimes sont affichés en chiffres (ex. "175 MILLIMES"), comme sur les factures modèles.
export function montantToWordsTnd(amount) {
  const value = Math.round((parseFloat(amount) || 0) * 1000); // total en millimes
  const dinars = Math.floor(value / 1000);
  const millimes = value % 1000;

  const dinarsWords = integerToWordsFr(dinars);
  let text = `${dinarsWords.charAt(0).toUpperCase()}${dinarsWords.slice(1)} Dinar${dinars > 1 ? 's' : ''}`;
  if (millimes > 0) {
    text += ` ${String(millimes).padStart(3, '0')} Millime${millimes > 1 ? 's' : ''}`;
  }
  return text;
}
