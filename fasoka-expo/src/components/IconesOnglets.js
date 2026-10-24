import React, { useEffect, useRef, useState } from 'react';
import { Image, View, Animated, Easing, AccessibilityInfo, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';

// ---------- Icône simple (utilisée par la barre de l'espace boutique) ----------
// Version contour quand l'onglet est inactif, version pleine quand il est actif.
// `nom` est le nom de base de l'icône Ionicons (ex : 'cart' → 'cart-outline' / 'cart').
export function IconeOnglet({ nom, focused, color, size }) {
  return <Ionicons name={focused ? nom : nom + '-outline'} size={size + 2} color={color} />;
}

// ---------- Pastille dorée animée (barre de l'espace client) ----------
export const DIAMETRE_PASTILLE = 32; // diamètre du cercle au repos
const ECHELLE_ACTIVE = 1.15; // agrandissement de l'onglet actif
const DUREE_ANIMATION = 220; // en millisecondes
const COULEUR_ICONE_REPOS = '#555555';
const TAILLE_ICONE = 19;

// Vrai si l'utilisateur a demandé de réduire les animations dans les réglages de son appareil
function useReduireAnimations() {
  const [reduire, setReduire] = useState(false);

  useEffect(() => {
    let actif = true;
    let abonnement = null;
    try {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((valeur) => { if (actif) setReduire(Boolean(valeur)); })
        .catch(() => {});
      abonnement = AccessibilityInfo.addEventListener('reduceMotionChanged', (valeur) => setReduire(Boolean(valeur)));
    } catch (e) {
      // non disponible sur cette plateforme : les animations restent activées
    }
    return () => {
      actif = false;
      if (abonnement && abonnement.remove) abonnement.remove();
    };
  }, []);

  return reduire;
}

// Cercle doré qui contient l'icône. `focused` vient de l'état réel de la navigation.
// - Repos : cercle discret (doré translucide + fin contour doré), icône gris foncé, taille normale.
// - Actif : cercle doré plein, icône noire, échelle 1 → 1,15 (animation douce).
// `rendu(couleur, actif)` dessine l'icône. Avec `fixe`, le contenu (ex : photo) n'est dessiné qu'une fois.
function PastilleOnglet({ focused, rendu, fixe = false }) {
  const reduire = useReduireAnimations();
  const progression = useRef(new Animated.Value(focused ? 1 : 0)).current; // 0 = repos, 1 = actif

  useEffect(() => {
    if (reduire) {
      progression.setValue(focused ? 1 : 0); // pas d'animation : changement immédiat
      return undefined;
    }
    const animation = Animated.timing(progression, {
      toValue: focused ? 1 : 0,
      duration: DUREE_ANIMATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [focused, reduire, progression]);

  const echelle = progression.interpolate({ inputRange: [0, 1], outputRange: [1, ECHELLE_ACTIVE] });
  const repos = progression.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  return (
    <Animated.View style={[styles.pastille, { transform: [{ scale: echelle }] }]}>
      <View style={[styles.calque, styles.fondDiscret]} />
      <Animated.View style={[styles.calque, styles.fondPlein, { opacity: progression }]} />
      {fixe ? (
        <View style={styles.calque}>{rendu(COLORS.noir, true)}</View>
      ) : (
        <>
          <Animated.View style={[styles.calque, { opacity: repos }]}>{rendu(COULEUR_ICONE_REPOS, false)}</Animated.View>
          <Animated.View style={[styles.calque, { opacity: progression }]}>{rendu(COLORS.noir, true)}</Animated.View>
        </>
      )}
    </Animated.View>
  );
}

// Onglet à icône Ionicons (nom de base, ex : 'cart')
export function IconePastille({ nom, focused }) {
  return (
    <PastilleOnglet
      focused={focused}
      rendu={(couleur, actif) => <Ionicons name={actif ? nom : nom + '-outline'} size={TAILLE_ICONE} color={couleur} />}
    />
  );
}

// Onglet Profil : la photo de profil du client remplace l'icône quand elle existe, sinon icône de personne.
export function IconeProfil({ focused }) {
  const { user } = useAuth();
  const photo = user && user.photo_profil_url ? user.photo_profil_url : null;

  return (
    <PastilleOnglet
      focused={focused}
      fixe={Boolean(photo)}
      rendu={(couleur, actif) =>
        photo ? (
          <Image source={{ uri: photo }} style={styles.photo} />
        ) : (
          <Ionicons name={actif ? 'person' : 'person-outline'} size={TAILLE_ICONE} color={couleur} />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  pastille: { width: DIAMETRE_PASTILLE, height: DIAMETRE_PASTILLE, borderRadius: DIAMETRE_PASTILLE / 2 },
  calque: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  fondDiscret: {
    borderRadius: DIAMETRE_PASTILLE / 2,
    backgroundColor: 'rgba(255, 198, 30, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 198, 30, 0.55)',
  },
  fondPlein: { borderRadius: DIAMETRE_PASTILLE / 2, backgroundColor: COLORS.or },
  photo: {
    width: DIAMETRE_PASTILLE - 6,
    height: DIAMETRE_PASTILLE - 6,
    borderRadius: (DIAMETRE_PASTILLE - 6) / 2,
    backgroundColor: COLORS.creme,
  },
});
