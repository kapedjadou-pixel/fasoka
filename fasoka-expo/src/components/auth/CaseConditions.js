import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { LIENS, COULEUR_LIEN, ouvrirLien } from '../../config/liens';

// Texte bleu et souligné qui ouvre une page légale (dans un nouvel onglet sur le web)
export function LienLegal({ url, children }) {
  return (
    <Text style={styles.lien} onPress={() => ouvrirLien(url)} accessibilityRole="link">
      {children}
    </Text>
  );
}

// Case à cocher « J'ai lu et j'accepte la politique de confidentialité et les conditions d'utilisation »
export default function CaseConditions({ accepte, onChange }) {
  return (
    <View style={styles.ligne}>
      <TouchableOpacity
        onPress={() => onChange(!accepte)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepte }}
        accessibilityLabel="Accepter la politique de confidentialité et les conditions d'utilisation"
      >
        <Ionicons
          name={accepte ? 'checkbox' : 'square-outline'}
          size={24}
          color={accepte ? COLORS.orFonce : COLORS.gris}
        />
      </TouchableOpacity>
      <Text style={styles.texte}>
        J'ai lu et j'accepte la <LienLegal url={LIENS.confidentialite}>politique de confidentialité</LienLegal> et
        les <LienLegal url={LIENS.conditions}>conditions d'utilisation</LienLegal>.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 2, marginBottom: 6 },
  texte: { flex: 1, marginLeft: 10, fontSize: 13, lineHeight: 19, color: COLORS.noir },
  lien: { color: COULEUR_LIEN, textDecorationLine: 'underline', fontWeight: '600' },
});
