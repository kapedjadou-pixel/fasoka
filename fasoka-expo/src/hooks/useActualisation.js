import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

// Appelle `fonction` tout de suite, puis toutes les `delaiMs` millisecondes, tant que `actif` est vrai.
//  - rien n'est demandé quand l'application est en arrière-plan (onglet du navigateur masqué, téléphone verrouillé) ;
//  - dès qu'on revient dans l'application, une actualisation est lancée immédiatement ;
//  - jamais deux appels en même temps (si le serveur est lent, on attend la fin du précédent).
export default function useActualisation(fonction, delaiMs, actif = true) {
  const fonctionRef = useRef(fonction);
  fonctionRef.current = fonction;

  useEffect(() => {
    if (!actif) return undefined;
    let arrete = false;
    let enCours = false;

    async function tour() {
      if (arrete || enCours) return;
      if (AppState.currentState && AppState.currentState !== 'active') return;
      enCours = true;
      try {
        await fonctionRef.current();
      } catch (e) {
        // Les erreurs sont gérées par la fonction appelée ; on réessaiera au prochain tour
      } finally {
        enCours = false;
      }
    }

    tour();
    const minuteur = setInterval(tour, delaiMs);
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') tour();
    });

    return () => {
      arrete = true;
      clearInterval(minuteur);
      if (abonnement && abonnement.remove) abonnement.remove();
    };
  }, [delaiMs, actif]);
}
