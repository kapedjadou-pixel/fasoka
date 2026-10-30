import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiClient } from '../api/apiClient';
import { useAuth } from './AuthContext';
import useActualisation from '../hooks/useActualisation';

const MessagerieContext = createContext({
  nonLusClient: 0,
  nonLusBoutique: () => 0,
  rafraichirNonLus: () => {},
});

// Nombre de messages non lus, pour les pastilles rouges des onglets « Messages »
// (côté client : toutes les boutiques ; côté boutique : une valeur par boutique). Actualisé toutes les 20 secondes (c'est aussi ce qui indique que la personne est « en ligne »).
export function MessagerieProvider({ children }) {
  const { user } = useAuth();
  const [nonLusClient, setNonLusClient] = useState(0);
  const [parBoutique, setParBoutique] = useState({});

  const rafraichirNonLus = useCallback(async () => {
    try {
      const donnees = await ApiClient.get('/messagerie/non-lus');
      setNonLusClient(donnees.client || 0);
      const compteurs = {};
      (donnees.boutiques || []).forEach((b) => {
        compteurs[b.shop_id] = b.non_lus;
      });
      setParBoutique(compteurs);
    } catch (e) {
      // Pas grave : la pastille garde sa valeur et sera actualisée au prochain tour
    }
  }, []);

  useActualisation(rafraichirNonLus, 20000, Boolean(user));

  // À la déconnexion, on efface les compteurs
  useEffect(() => {
    if (!user) {
      setNonLusClient(0);
      setParBoutique({});
    }
  }, [user]);

  const valeur = useMemo(
    () => ({
      nonLusClient,
      nonLusBoutique: (shopId) => parBoutique[shopId] || 0,
      rafraichirNonLus,
    }),
    [nonLusClient, parBoutique, rafraichirNonLus]
  );

  return <MessagerieContext.Provider value={valeur}>{children}</MessagerieContext.Provider>;
}

export function useMessagerie() {
  return useContext(MessagerieContext);
}
