import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiClient } from '../api/apiClient';
import { useAuth } from './AuthContext';
import useActualisation from '../hooks/useActualisation';

const CommandesContext = createContext({ misesAJour: 0, marquerVu: async () => null });

// Pastille « nouveautés » de l'onglet Historique : nombre de commandes dont le statut a changé depuis la dernière
// visite de l'historique. La date de dernière visite est gardée sur l'appareil (par compte).
export function CommandesProvider({ children }) {
  const { user } = useAuth();
  const cle = user ? `fasoka_historique_vu_${user.id}` : null;
  const [marqueur, setMarqueur] = useState(null); // date ISO de la dernière visite
  const [pret, setPret] = useState(false);
  const [misesAJour, setMisesAJour] = useState(0);

  // Lecture du marqueur ; à la toute première utilisation, il est fixé à maintenant (aucune fausse pastille)
  useEffect(() => {
    let annule = false;
    setPret(false);
    setMarqueur(null);
    setMisesAJour(0);
    if (!cle) return undefined;
    AsyncStorage.getItem(cle)
      .then(async (valeur) => {
        if (annule) return;
        if (valeur) {
          setMarqueur(valeur);
        } else {
          const maintenant = new Date().toISOString();
          await AsyncStorage.setItem(cle, maintenant).catch(() => {});
          if (!annule) setMarqueur(maintenant);
        }
      })
      .catch(() => { if (!annule) setMarqueur(new Date().toISOString()); })
      .finally(() => { if (!annule) setPret(true); });
    return () => { annule = true; };
  }, [cle]);

  const rafraichir = useCallback(async () => {
    if (!marqueur) return;
    try {
      const donnees = await ApiClient.get('/orders/mine/mises-a-jour', { depuis: marqueur });
      setMisesAJour(donnees.nombre || 0);
    } catch (e) {
      // la pastille garde sa valeur
    }
  }, [marqueur]);

  useActualisation(rafraichir, 60000, Boolean(user) && pret && Boolean(marqueur));

  // Appelé à l'ouverture de l'historique : renvoie l'ancienne date de visite (pour repérer les commandes mises à jour)
  const marquerVu = useCallback(async () => {
    const precedent = marqueur;
    const maintenant = new Date().toISOString();
    setMarqueur(maintenant);
    setMisesAJour(0);
    if (cle) await AsyncStorage.setItem(cle, maintenant).catch(() => {});
    return precedent;
  }, [marqueur, cle]);

  const valeur = useMemo(() => ({ misesAJour, marquerVu }), [misesAJour, marquerVu]);
  return <CommandesContext.Provider value={valeur}>{children}</CommandesContext.Provider>;
}

export function useCommandes() {
  return useContext(CommandesContext);
}
