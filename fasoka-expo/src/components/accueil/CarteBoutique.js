import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import Avatar from '../messagerie/Avatar';
import { pluriel } from '../dashboard/format';

// Carte d'une boutique (sections « Boutiques vérifiées » et « Boutiques à découvrir ») : ouvre sa page
export default function CarteBoutique({ boutique, onPress }) {
  return (
    <TouchableOpacity
      style={styles.carte}
      onPress={() => onPress(boutique)}
      accessibilityRole="button"
      accessibilityLabel={`Voir la boutique ${boutique.nom_boutique}`}
    >
      <Avatar uri={boutique.logo_url} nom={boutique.nom_boutique} taille={56} />
      <View style={styles.nomLigne}>
        <Text numberOfLines={1} style={styles.nom}>{boutique.nom_boutique}</Text>
        {boutique.badge_verifie ? <Ionicons name="checkmark-circle" size={15} color="#2563EB" style={{ marginLeft: 4 }} /> : null}
      </View>
      {boutique.ville ? (
        <View style={styles.villeLigne}>
          <Ionicons name="location-outline" size={12} color={COLORS.gris} />
          <Text numberOfLines={1} style={styles.ville}>{boutique.ville}</Text>
        </View>
      ) : null}
      <Text style={styles.produits}>{pluriel(Number(boutique.nombre_produits) || 0, 'produit')}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  carte: { width: 160, backgroundColor: COLORS.blanc, borderRadius: 14, borderWidth: 1, borderColor: '#EFECE4', padding: 14, alignItems: 'center' },
  nomLigne: { flexDirection: 'row', alignItems: 'center', marginTop: 10, maxWidth: '100%' },
  nom: { fontSize: 14, fontWeight: '800', color: COLORS.noir, flexShrink: 1 },
  villeLigne: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  ville: { fontSize: 12, color: COLORS.gris, flexShrink: 1 },
  produits: { fontSize: 11.5, fontWeight: '700', color: COLORS.orFonce, marginTop: 8 },
});
