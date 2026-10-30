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

// « 245 Ko », « 1,3 Mo »
export function tailleLisible(octets) {
  const n = Number(octets);
  if (!n || n < 0) return '';
  if (n < 1024) return n + ' o';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' Ko';
  return (n / (1024 * 1024)).toFixed(1).replace('.', ',') + ' Mo';
}

// Durée d'un message vocal : « 0:07 », « 2:30 »
export function dureeLisible(secondes) {
  const s = Math.max(0, Math.round(Number(secondes) || 0));
  return Math.floor(s / 60) + ':' + deuxChiffres(s % 60);
}

// Sous le nom, en haut de la discussion : « en ligne », « vu aujourd'hui à 14:05 », « vu hier à 21:30 »...
export function libelleVu(presence) {
  if (!presence) return '';
  if (presence.en_ligne) return 'en ligne';
  const d = enDate(presence.vu_le);
  if (!d) return '';
  const jour = memeJour(d, new Date())
    ? "aujourd'hui"
    : memeJour(d, hier())
      ? 'hier'
      : 'le ' + deuxChiffres(d.getDate()) + '/' + deuxChiffres(d.getMonth() + 1) + '/' + d.getFullYear();
  return 'vu ' + jour + ' à ' + heureCourte(d);
}

// Dernier message dans la liste des discussions (une photo, un vocal ou un document n'ont pas de texte)
export function apercuMessage({ type, contenu, nom_fichier, duree }) {
  if (type === 'image') return '📷 Photo';
  if (type === 'audio') return '🎤 Message vocal' + (duree ? ' (' + dureeLisible(duree) + ')' : '');
  if (type === 'document') return '📄 ' + (nom_fichier || 'Document');
  return apercu(contenu);
}

// Version allégée d'une photo hébergée chez Cloudinary (les discussions chargent vite, même avec une connexion lente)
export function miniature(url, largeur = 600) {
  if (typeof url === 'string' && url.includes('/image/upload/') && !url.includes('/upload/w_')) {
    return url.replace('/image/upload/', '/image/upload/w_' + largeur + ',c_limit,q_auto,f_auto/');
  }
  return url;
}
