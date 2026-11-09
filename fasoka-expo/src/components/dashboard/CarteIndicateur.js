import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';

const VERT = '#15803D';

// Une carte de chiffre : icône, valeur, libellé, précision et (facultatif) évolution. Cliquable si `onPress` est fourni.
export default function CarteIndicateur({
  icone, libelle, valeur, sousTexte, evolution, onPress, couleurIcone = COLORS.orFonce, fondIcone = '#FFF6DB',
  alerte = false, style,
}) {
  const contenu = (
    <>
      <View style={styles.entete}>
        <View style={[styles.icone, { backgroundColor: fondIcone }]}>
          <Ionicons name={icone} size={18} color={couleurIcone} />
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={16} color={COLORS.gris} /> : null}
      </View>
      <Text style={[styles.valeur, alerte && { color: COLORS.rouge }]} numberOfLines={1}>{valeur}</Text>
      <Text style={styles.libelle}>{libelle}</Text>
      {sousTexte ? <Text style={styles.sousTexte}>{sousTexte}</Text> : null}
      {typeof evolution === 'number' ? (
        <Text style={[styles.evolution, { color: evolution >= 0 ? VERT : COLORS.rouge }]}>
          {evolution >= 0 ? '▲ +' : '▼ '}{evolution} % <Text style={styles.evolutionNote}>vs période précédente</Text>
        </Text>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.carte, style]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${libelle} : ${valeur}`}
      >
        {contenu}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.carte, style]}>{contenu}</View>;
}

const styles = StyleSheet.create({
  carte: { backgroundColor: COLORS.blanc, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#EFECE4' },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icone: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  valeur: { fontSize: 22, fontWeight: '800', color: COLORS.noir, marginTop: 10 },
  libelle: { fontSize: 12.5, color: COLORS.gris, marginTop: 2, fontWeight: '600' },
  sousTexte: { fontSize: 11.5, color: COLORS.gris, marginTop: 4 },
  evolution: { fontSize: 11.5, fontWeight: '800', marginTop: 4 },
  evolutionNote: { fontWeight: '500', color: COLORS.gris },
});
