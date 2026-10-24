import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiClient } from '../api/apiClient';
import { API_BASE_URL } from '../api/config';

const AuthContext = createContext(null);

// On ne garde (en mémoire et dans le navigateur) que les informations utiles à l'affichage
function nettoyerUtilisateur(u) {
  return {
    id: u.id,
    nom: u.nom,
    prenom: u.prenom,
    email: u.email || null,
    telephone: u.telephone || null,
    compte_verifie: u.compte_verifie,
    photo_profil_url: u.photo_profil_url || null,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [chargementSession, setChargementSession] = useState(true);

  // Au démarrage de l'app (ou à l'actualisation de la page), on tente de retrouver la session enregistrée
  useEffect(() => {
    let actif = true;

    async function restaurerSession() {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const userJson = await AsyncStorage.getItem('auth_user');
        if (!token || !userJson) return;

        // Vérifie que le token est encore valide (il expire au bout de 7 jours)
        try {
          const reponse = await fetch(API_BASE_URL + '/shops/mine', {
            headers: { Authorization: 'Bearer ' + token },
          });
          if (reponse.status === 401) {
            await AsyncStorage.removeItem('auth_token');
            await AsyncStorage.removeItem('auth_user');
            return;
          }
        } catch (e) {
          // Pas de réseau pour le moment : on garde la session et on réessaiera plus tard
        }

        if (actif) setUser(nettoyerUtilisateur(JSON.parse(userJson)));
      } catch (e) {
        // Lecture impossible : on reste simplement déconnecté
      } finally {
        if (actif) setChargementSession(false);
      }
    }

    restaurerSession();
    return () => { actif = false; };
  }, []);

  const sauvegarderSession = useCallback(async (data) => {
    const propre = nettoyerUtilisateur(data.user);
    await AsyncStorage.setItem('auth_token', data.token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(propre));
    setUser(propre);
  }, []);

  // Met à jour les informations du compte affichées (après modification du profil, de la photo, de l'email...)
  const mettreAJourUtilisateur = useCallback(async (nouvelUtilisateur) => {
    const propre = nettoyerUtilisateur(nouvelUtilisateur);
    await AsyncStorage.setItem('auth_user', JSON.stringify(propre));
    setUser(propre);
  }, []);

  const inscription = useCallback(async ({ nom, prenom, email, telephone, motDePasse }) => {
    const data = await ApiClient.post('/auth/signup', {
      nom, prenom, email, telephone, mot_de_passe: motDePasse,
    });
    await sauvegarderSession(data);
  }, [sauvegarderSession]);

  const connexion = useCallback(async ({ identifiant, motDePasse }) => {
    const data = await ApiClient.post('/auth/login', {
      identifiant, mot_de_passe: motDePasse,
    });
    await sauvegarderSession(data);
  }, [sauvegarderSession]);

  const deconnexion = useCallback(async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, chargementSession, inscription, connexion, deconnexion, mettreAJourUtilisateur }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
