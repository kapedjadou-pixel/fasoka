// Réglages de l'accueil client : seuils des badges, tailles de page, options de filtres et mesures de la grille.

export const SEUIL_POPULAIRE = 3; // unités vendues sur 30 jours (commandes livrées) pour afficher « Populaire »
export const JOURS_NOUVEAU = 7; // un produit est « Nouveau » pendant ce nombre de jours
export const TAILLE_PAGE = 24; // produits chargés à chaque page (identique au serveur)

export const TRIS = [
  ['melange', 'Mélange (boutiques alternées)'],
  ['recents', 'Plus récents'],
  ['prix_asc', 'Prix croissant'],
  ['prix_desc', 'Prix décroissant'],
  ['populaires', 'Les plus vendus'],
];

// [minimum, maximum, libellé] : tranches de prix proposées (en F CFA)
export const TRANCHES_PRIX = [
  [0, 5000, 'Moins de 5 000'],
  [5000, 20000, '5 000 à 20 000'],
  [20000, 50000, '20 000 à 50 000'],
  [50000, null, 'Plus de 50 000'],
];

export const PUBLICATIONS = [
  [null, 'Toutes les dates'],
  [7, '7 derniers jours'],
  [30, '30 derniers jours'],
];

export const FILTRES_VIDES = { categorie: '', prixMin: '', prixMax: '', ville: '', publieDepuis: null, enStock: false, tri: 'melange' };

// Nombre de filtres actifs (affiché sur le bouton « Filtres »)
export function nombreFiltresActifs(f) {
  return [f.categorie, f.prixMin !== '', f.prixMax !== '', f.ville, f.publieDepuis, f.enStock, f.tri !== 'melange'].filter(Boolean).length;
}

// Paramètres envoyés au serveur pour le fil de produits
export function parametresFiltres(f) {
  const p = {};
  if (f.categorie) p.categorie = f.categorie;
  if (f.ville) p.ville = f.ville;
  if (f.prixMin !== '') p.prix_min = f.prixMin;
  if (f.prixMax !== '') p.prix_max = f.prixMax;
  if (f.publieDepuis) p.publie_depuis = f.publieDepuis;
  if (f.enStock) p.en_stock = '1';
  if (f.tri && f.tri !== 'melange') p.tri = f.tri;
  return p;
}

// Mesures de la grille selon la largeur de l'écran : 2 colonnes sur téléphone, jusqu'à 6 sur grand écran
// (contenu limité à 1400 px et centré pour ne pas laisser de grands vides).
export function mesureGrille(largeurEcran) {
  const large = largeurEcran >= 900;
  const marge = large ? 24 : 12;
  const ecart = large ? 16 : 10;
  const colonnes = largeurEcran >= 1400 ? 6 : largeurEcran >= 1100 ? 5 : largeurEcran >= 800 ? 4 : largeurEcran >= 560 ? 3 : 2;
  const contenu = Math.min(largeurEcran, 1400) - marge * 2;
  const largeurCarte = Math.floor((contenu - ecart * (colonnes - 1)) / colonnes);
  return { colonnes, largeurCarte, marge, ecart, contenu, large };
}
