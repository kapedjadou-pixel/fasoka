import { useEffect, useRef } from 'react';
import { Platform, BackHandler } from 'react-native';

// Fait en sorte que le bouton Retour (navigateur ou téléphone) ferme la sous-page ouverte
// au lieu de quitter l'application.
export default function useRetourEnArriere(actif, surRetour) {
  const entree = useRef(false);
  const surRetourRef = useRef(surRetour);
  surRetourRef.current = surRetour;

  // Web : une entrée d'historique est ajoutée à l'ouverture d'une sous-page
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (actif && !entree.current) {
      window.history.pushState({ fasokaVue: true }, '');
      entree.current = true;
    } else if (!actif && entree.current) {
      // Sous-page fermée par un bouton de l'app : on retire l'entrée d'historique ajoutée
      entree.current = false;
      window.history.back();
    }
  }, [actif]);

  // Web : le bouton Retour du navigateur ferme la sous-page
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const surPopState = () => {
      if (entree.current) {
        entree.current = false;
        surRetourRef.current();
      }
    };
    window.addEventListener('popstate', surPopState);
    return () => window.removeEventListener('popstate', surPopState);
  }, []);

  // Android : le bouton Retour du téléphone ferme la sous-page
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const abonnement = BackHandler.addEventListener('hardwareBackPress', () => {
      if (actif) {
        surRetourRef.current();
        return true;
      }
      return false;
    });
    return () => abonnement.remove();
  }, [actif]);
}
