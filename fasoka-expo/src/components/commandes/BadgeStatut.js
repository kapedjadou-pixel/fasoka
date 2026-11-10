import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../theme/colors';
import { STATUTS_COMMANDE } from '../../config/statuts';

// Pastille colorée du statut d'une commande
export default function BadgeStatut({ statut, style }) {
  const s = STATUTS_COMMANDE[statut] || { libelle: statut, couleur: COLORS.noir, fond: '#EFECE4' };
  return (
    <View style={[styles.pastille, { backgroundColor: s.fond }, style]} accessibilityLabel={`Statut : ${s.libelle}`}>
      <Text style={[styles.texte, { color: s.couleur }]}>{s.libelle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pastille: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  texte: { fontSize: 11.5, fontWeight: '800' },
});
