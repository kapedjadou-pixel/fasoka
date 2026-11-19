import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, Platform, StyleSheet } from 'react-native';
import { COLORS } from '../../theme/colors';

const NATIF = Platform.OS !== 'web';

// Cartes grises qui pulsent pendant le chargement des produits (évite l'écran vide)
export default function SqueletteCartes({ nombre = 8, largeur, ecart }) {
  const opacite = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(opacite, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIF }),
        Animated.timing(opacite, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIF }),
      ])
    );
    boucle.start();
    return () => boucle.stop();
  }, []);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ecart }}>
      {Array.from({ length: nombre }).map((_, i) => (
        <Animated.View key={i} style={[styles.carte, { width: largeur, opacity: opacite }]} accessibilityElementsHidden>
          <View style={{ width: largeur, height: largeur, backgroundColor: '#ECE9E2' }} />
          <View style={{ padding: 10 }}>
            <View style={[styles.ligne, { width: '90%' }]} />
            <View style={[styles.ligne, { width: '60%', marginTop: 6 }]} />
            <View style={[styles.ligne, { width: '45%', height: 14, marginTop: 10 }]} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { backgroundColor: COLORS.blanc, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#EFECE4' },
  ligne: { height: 11, borderRadius: 6, backgroundColor: '#ECE9E2' },
});
