// Petits utilitaires d'affichage pour la messagerie (dates et heures en français, sans dépendre de Intl)

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const deuxChiffres = (n) => String(n).padStart(2, '0');

function enDate(valeur) {
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? null : d;
}

function memeJour(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function hier() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
}

// « 14:05 »
export function heureCourte(valeur) {
  const d = enDate(valeur);
  return d ? deuxChiffres(d.getHours()) + ':' + deuxChiffres(d.getMinutes()) : '';
}

// Séparateur de jour dans une discussion : « Aujourd'hui », « Hier », « mardi 12 octobre »
export function libelleJour(valeur) {
  const d = enDate(valeur);
  if (!d) return '';
  if (memeJour(d, new Date())) return "Aujourd'hui";
  if (memeJour(d, hier())) return 'Hier';
  const base = JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()];
  return d.getFullYear() === new Date().getFullYear() ? base : base + ' ' + d.getFullYear();
}

// Dans la liste des discussions : l'heure si c'est aujourd'hui, « Hier », sinon « 12/10/2026 »
export function horodatageListe(valeur) {
  const d = enDate(valeur);
  if (!d) return '';
  if (memeJour(d, new Date())) return heureCourte(d);
  if (memeJour(d, hier())) return 'Hier';
  return deuxChiffres(d.getDate()) + '/' + deuxChiffres(d.getMonth() + 1) + '/' + d.getFullYear();
}

export function jourDe(valeur) {
  const d = enDate(valeur);
  return d ? d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate() : '';
}

// Dernier message affiché sur une seule ligne
export function apercu(texte) {
  return String(texte || '').replace(/\s+/g, ' ').trim();
}
