// Formats d'affichage du tableau de bord (indépendants des réglages du téléphone ou du navigateur)

const ESPACE = '\u00A0'; // espace insécable : un montant ne se coupe jamais en deux lignes

function grouper(n) {
  return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE);
}

// 12500 -> « 12 500 F CFA »
export function fcfa(valeur) {
  const n = Number(valeur) || 0;
  return (n < 0 ? '-' : '') + grouper(n) + ESPACE + 'F CFA';
}

// 12500 -> « 12,5 k », 1200000 -> « 1,2 M » (axes du graphique)
export function fcfaCourt(valeur) {
  const n = Number(valeur) || 0;
  const un = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  if (n >= 1000000) return un(n / 1000000) + ' M';
  if (n >= 1000) return un(n / 1000) + ' k';
  return String(Math.round(n));
}

// '2026-11-08' -> « 08/11/2026 »
export function jourComplet(iso) {
  if (!iso) return '';
  const [a, m, j] = String(iso).slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
}

// Date du jour au format AAAA-MM-JJ (en UTC, comme le serveur : c'est l'heure du Togo)
export function aujourdhuiIso() {
  return new Date().toISOString().slice(0, 10);
}

export function ajouterJoursIso(iso, n) {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j + n)).toISOString().slice(0, 10);
}

export function nombreJoursIso(du, au) {
  const [a1, m1, j1] = du.split('-').map(Number);
  const [a2, m2, j2] = au.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, j2) - Date.UTC(a1, m1 - 1, j1)) / 86400000) + 1;
}

export const pluriel = (n, singulier, plurielTexte) => `${n} ${n > 1 ? plurielTexte || singulier + 's' : singulier}`;
