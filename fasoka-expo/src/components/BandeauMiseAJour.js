import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

const INTERVALLE_MS = 3 * 60 * 1000; // vérification toutes les 3 minutes, et à chaque retour sur l'onglet

// Site web : une page restée ouverte pendant plusieurs jours continue de tourner avec l'ancienne version de l'application
// (nouvelles fonctions absentes, messages reçus mal affichés...). Ce bandeau compare les fichiers de l'application chargés
// dans la page avec ceux publiés sur le site, et propose d'actualiser quand une nouvelle version est disponible.
export default function BandeauMiseAJour() {
  const [disponible, setDisponible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;

    const actuels = Array.from(document.querySelectorAll('script[src]'))
      .map((s) => s.getAttribute('src'))
      .filter((src) => src && src.includes('/_expo/static/js/'))
      .sort()
      .join('|');
    if (!actuels) return undefined; // pas un site publié (mode développement) : rien à comparer

    let arrete = false;

    async function verifier() {
      try {
        const reponse = await fetch('/', { cache: 'no-store' });
        if (!reponse.ok) return;
        const html = await reponse.text();
        const publies = Array.from(html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g))
          .map((m) => m[1])
          .filter((src) => src.includes('/_expo/static/js/'))
          .sort()
          .join('|');
        if (!arrete && publies && publies !== actuels) setDisponible(true);
      } catch (e) {
        // Pas de réseau : on réessaiera plus tard
      }
    }

    const minuteur = setInterval(verifier, INTERVALLE_MS);
    const surVisibilite = () => {
      if (document.visibilityState === 'visible') verifier();
    };
    document.addEventListener('visibilitychange', surVisibilite);
    verifier();

    return () => {
      arrete = true;
      clearInterval(minuteur);
      document.removeEventListener('visibilitychange', surVisibilite);
    };
  }, []);

  if (!disponible) return null;

  return (
    <View style={styles.bandeau} accessibilityLiveRegion="polite">
      <Text style={styles.texte}>Une nouvelle version de FASOKA est disponible.</Text>
      <TouchableOpacity onPress={() => window.location.reload()} style={styles.bouton} accessibilityRole="button">
        <Text style={styles.boutonTexte}>Actualiser</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bandeau: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.noir,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  texte: { color: COLORS.blanc, fontSize: 13.5, marginRight: 12 },
  bouton: { backgroundColor: COLORS.or, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14 },
  boutonTexte: { color: COLORS.noir, fontWeight: '800', fontSize: 13 },
});
