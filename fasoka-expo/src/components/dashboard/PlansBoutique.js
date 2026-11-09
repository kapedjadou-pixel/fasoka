import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { PLANS, CONTACT_PRO_LIEN } from '../../config/plans';
import { ouvrirLien } from '../../config/liens';

function CartePlan({ plan, actuel }) {
  const pro = plan === PLANS.pro;
  return (
    <View style={[styles.carte, pro && styles.cartePro, actuel && styles.carteActuelle]}>
      <View style={styles.entete}>
        <Text style={[styles.nom, pro && { color: COLORS.or }]}>{plan.nom}</Text>
        {actuel ? (
          <View style={styles.etiquetteActuelle}><Text style={styles.etiquetteActuelleTexte}>Votre plan</Text></View>
        ) : null}
        {!plan.disponible ? (
          <View style={styles.etiquetteBientot}><Text style={styles.etiquetteBientotTexte}>Bientôt</Text></View>
        ) : null}
      </View>
      <Text style={[styles.prix, pro && { color: COLORS.blanc }]}>{plan.prix}</Text>
      {plan.avantages.map((texte) => (
        <View key={texte} style={styles.ligne}>
          <Ionicons name="checkmark-circle" size={16} color={pro ? COLORS.or : '#15803D'} />
          <Text style={[styles.avantage, pro && { color: 'rgba(255,255,255,0.88)' }]}>{texte}</Text>
        </View>
      ))}
      {pro && CONTACT_PRO_LIEN ? (
        <TouchableOpacity style={styles.bouton} onPress={() => ouvrirLien(CONTACT_PRO_LIEN)} accessibilityRole="link">
          <Text style={styles.boutonTexte}>Demander Fasoka Pro</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// Comparaison des formules Gratuit et Pro, avec la formule actuelle de la boutique mise en évidence
export default function PlansBoutique({ plan }) {
  const { width } = useWindowDimensions();
  const cote = width >= 700;
  const actuel = plan === 'pro' ? 'pro' : 'gratuit';
  return (
    <View style={{ flexDirection: cote ? 'row' : 'column', gap: 12 }}>
      <View style={{ flex: 1 }}><CartePlan plan={PLANS.gratuit} actuel={actuel === 'gratuit'} /></View>
      <View style={{ flex: 1 }}><CartePlan plan={PLANS.pro} actuel={actuel === 'pro'} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { backgroundColor: COLORS.blanc, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#EFECE4', flex: 1 },
  cartePro: { backgroundColor: COLORS.noir, borderColor: COLORS.noir },
  carteActuelle: { borderColor: COLORS.or, borderWidth: 2 },
  entete: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  nom: { fontSize: 17, fontWeight: '900', color: COLORS.noir },
  prix: { fontSize: 13.5, fontWeight: '700', color: COLORS.gris, marginTop: 2, marginBottom: 12 },
  ligne: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 7 },
  avantage: { flex: 1, fontSize: 13, color: COLORS.noir, lineHeight: 18 },
  etiquetteActuelle: { backgroundColor: COLORS.or, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  etiquetteActuelleTexte: { fontSize: 11, fontWeight: '800', color: COLORS.noir },
  etiquetteBientot: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  etiquetteBientotTexte: { fontSize: 11, fontWeight: '700', color: COLORS.or },
  bouton: { backgroundColor: COLORS.or, borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 14 },
  boutonTexte: { fontWeight: '800', color: COLORS.noir },
});
