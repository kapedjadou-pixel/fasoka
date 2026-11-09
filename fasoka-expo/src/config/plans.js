// Présentation des formules de boutique. Les textes se modifient ici.
// Fasoka Pro n'est pas encore en vente : aucun paiement n'existe dans l'application. Quand ce sera le cas,
// mettre `disponible: true` pour le plan Pro, et renseigner CONTACT_PRO_LIEN pour afficher un bouton de demande
// (par exemple 'https://wa.me/228XXXXXXXX' ou 'mailto:contact@exemple.com').
export const CONTACT_PRO_LIEN = '';

export const PLANS = {
  gratuit: {
    nom: 'Gratuit',
    prix: '0 F CFA',
    disponible: true,
    avantages: [
      'Boutique en ligne et catalogue de produits',
      "Jusqu'à 8 photos par produit",
      'Commandes avec suivi des statuts',
      'Messagerie avec vos clients',
      'Tableau de bord des ventes',
    ],
  },
  pro: {
    nom: 'Fasoka Pro',
    prix: 'Bientôt disponible',
    disponible: false,
    avantages: [
      'Tout ce qui est inclus dans le plan Gratuit',
      'Produits illimités',
      'Plus de visibilité auprès des clients',
    ],
  },
};
