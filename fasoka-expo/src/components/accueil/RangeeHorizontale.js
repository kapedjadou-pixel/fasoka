import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';

// Rangée de cartes qui défile horizontalement, avec un titre. Sur ordinateur, des flèches font défiler (en plus du trackpad).
export default function RangeeHorizontale({ titre, sousTitre, children }) {
  const defilement = useRef(null);
  const decalage = useRef(0);
  const [afficherFleches] = useState(Platform.OS === 'web');

  function defiler(sens) {
    if (!defilement.current) return;
    const x = Math.max(0, decalage.current + sens * 520);
    defilement.current.scrollTo({ x, animated: true });
  }

  return (
    <View style={styles.bloc}>
      <View style={styles.entete}>
        <View style={{ flex: 1 }}>
          <Text style={styles.titre}>{titre}</Text>
          {sousTitre ? <Text style={styles.sousTitre}>{sousTitre}</Text> : null}
        </View>
        {afficherFleches ? (
          <View style={styles.fleches}>
            <TouchableOpacity style={styles.fleche} onPress={() => defiler(-1)} accessibilityRole="button" accessibilityLabel="Défiler vers la gauche">
              <Ionicons name="chevron-back" size={18} color={COLORS.noir} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.fleche} onPress={() => defiler(1)} accessibilityRole="button" accessibilityLabel="Défiler vers la droite">
              <Ionicons name="chevron-forward" size={18} color={COLORS.noir} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
      <ScrollView
        ref={defilement}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={64}
        onScroll={(e) => { decalage.current = e.nativeEvent.contentOffset.x; }}
        contentContainerStyle={styles.contenu}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { marginTop: 22 },
  entete: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  titre: { fontSize: 17, fontWeight: '900', color: COLORS.noir },
  sousTitre: { fontSize: 12.5, color: COLORS.gris, marginTop: 2 },
  fleches: { flexDirection: 'row', gap: 8 },
  fleche: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: '#E6E2D8', alignItems: 'center', justifyContent: 'center' },
  contenu: { gap: 12, paddingBottom: 4 },
});
