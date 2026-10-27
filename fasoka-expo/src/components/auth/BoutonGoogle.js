import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { COLORS } from '../../theme/colors';

// Identifiant client OAuth « Application Web » créé dans Google Cloud Console.
// Ce n'est pas un secret : il est visible dans toute page qui propose « Continuer avec Google ».
export const GOOGLE_CLIENT_ID = '712696140022-u1uumn8vha0hddv5omkn7dra0q30pl52.apps.googleusercontent.com';
const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

let promesseScript = null;
let initialise = false;
let rappelCourant = null; // fonction à appeler quand Google renvoie le jeton de connexion

// Charge (une seule fois) le script officiel « Se connecter avec Google »
function chargerScript() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Navigateur indisponible'));
  }
  if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
  if (!promesseScript) {
    promesseScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        promesseScript = null;
        reject(new Error('Chargement du script Google impossible'));
      };
      document.head.appendChild(script);
    });
  }
  return promesseScript;
}

function initialiserGoogle() {
  if (initialise) return;
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (reponse) => {
      if (rappelCourant && reponse && reponse.credential) rappelCourant(reponse.credential);
    },
  });
  initialise = true;
}

// Bouton officiel « Continuer avec Google » (version web uniquement pour l'instant : sur téléphone, il ne s'affiche pas).
// `onCredential(jeton)` est appelé quand la personne a choisi son compte Google.
export default function BoutonGoogle({ onCredential }) {
  const conteneur = useRef(null);
  const [largeur, setLargeur] = useState(0);
  const [indisponible, setIndisponible] = useState(false);

  // Garde toujours la dernière version de la fonction de rappel
  useEffect(() => {
    rappelCourant = onCredential;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || largeur === 0) return undefined;
    let annule = false;

    chargerScript()
      .then(() => {
        if (annule || !conteneur.current) return;
        initialiserGoogle();
        conteneur.current.innerHTML = '';
        window.google.accounts.id.renderButton(conteneur.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          locale: 'fr',
          width: Math.min(400, Math.max(200, largeur)),
        });
      })
      .catch(() => {
        if (!annule) setIndisponible(true);
      });

    return () => {
      annule = true;
    };
  }, [largeur]);

  if (Platform.OS !== 'web') return null;

  return (
    <View style={styles.zone} onLayout={(e) => setLargeur(Math.floor(e.nativeEvent.layout.width))}>
      <View ref={conteneur} style={styles.bouton} />
      {indisponible ? (
        <Text style={styles.indisponible}>La connexion avec Google n'est pas disponible pour le moment.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { width: '100%', marginBottom: 4 },
  bouton: { minHeight: 44, alignItems: 'center' },
  indisponible: { fontSize: 12.5, color: COLORS.gris, textAlign: 'center', marginTop: 6 },
});
