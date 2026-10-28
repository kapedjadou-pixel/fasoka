import { Linking } from 'react-native';

// Liens vers les pages légales de FASOKA (sites externes).
// Pour les changer, il suffit de modifier les deux adresses ci-dessous : elles sont utilisées
// à la fois sur la page d'inscription et dans Profil > À propos.
export const LIENS = {
  confidentialite: 'https://fasoka-legal.onrender.com/politique-confidentialite/', // Politique de confidentialité
  conditions: 'https://fasoka-legal.onrender.com/conditions-utilisation/', // Conditions d'utilisation
};

// Bleu des liens cliquables (comme sur la plupart des plateformes)
export const COULEUR_LIEN = '#1A73E8';

// Ouvre un lien dans un nouvel onglet (web) ou dans le navigateur du téléphone.
// Si l'adresse n'est pas encore renseignée ou ne peut pas s'ouvrir, il ne se passe rien.
export async function ouvrirLien(url) {
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch (e) {
    // Rien à faire : le lien n'a pas pu s'ouvrir
  }
}
