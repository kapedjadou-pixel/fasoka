import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';

// Grandes cartes d'accès direct aux opérations courantes.
// `actions` : [{ cle, icone, titre, sousTitre, badge?, couleur, fond, onPress }]
export default function ActionsRapides({ actions, colonnes }) {
  const largeur = `${100 / colonnes}%`;
  return (
    <View style={styles.grille}>
      {actions.map((a) => (
        <View key={a.cle} style={{ width: largeur, padding: 4 }}>
          <TouchableOpacity
            style={styles.carte}
            onPress={a.onPress}
            accessibilityRole="button"
            accessibilityLabel={a.titre + (a.badge ? `, ${a.badge} en attente` : '')}
          >
            <View style={[styles.icone, { backgroundColor: a.fond }]}>
              <Ionicons name={a.icone} size={24} color={a.couleur} />
              {a.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeTexte}>{a.badge > 99 ? '99+' : a.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.titre} numberOfLines={2}>{a.titre}</Text>
            <Text style={styles.sousTitre} numberOfLines={2}>{a.sousTitre}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grille: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  carte: { flex: 1, backgroundColor: COLORS.blanc, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#EFECE4', minHeight: 132 },
  icone: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: COLORS.rouge, alignItems: 'center', justifyContent: 'center',
  },
  badgeTexte: { color: COLORS.blanc, fontSize: 11, fontWeight: '800' },
  titre: { fontSize: 14, fontWeight: '800', color: COLORS.noir, marginTop: 12 },
  sousTitre: { fontSize: 11.5, color: COLORS.gris, marginTop: 3, lineHeight: 15 },
});
