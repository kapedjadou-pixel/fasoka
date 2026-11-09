// Statuts des commandes : libellé et couleurs (texte + fond), pour que chaque statut soit reconnaissable d'un coup d'œil
// dans tous les écrans (tableau de bord, commandes, historique).
export const STATUTS_COMMANDE = {
  en_attente: { libelle: 'En attente', couleur: '#B45309', fond: '#FEF3C7' },
  confirmee: { libelle: 'Confirmée', couleur: '#1D4ED8', fond: '#DBEAFE' },
  en_preparation: { libelle: 'En préparation', couleur: '#6D28D9', fond: '#EDE9FE' },
  prete: { libelle: 'Prête', couleur: '#0E7490', fond: '#CFFAFE' },
  livree: { libelle: 'Livrée', couleur: '#15803D', fond: '#DCFCE7' },
  annulee: { libelle: 'Annulée', couleur: '#B91C1C', fond: '#FEE2E2' },
};

export const MODES_LIVRAISON = {
  retrait: 'Retrait en boutique',
  livraison_vendeur: 'Livraison par le vendeur',
};
