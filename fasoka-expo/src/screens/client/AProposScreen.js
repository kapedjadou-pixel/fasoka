import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { LIENS, ouvrirLien } from '../../config/liens';

const LOGO = require('../../../assets/logo.png');
const LOGO_RATIO = 247 / 237; // largeur / hauteur du logo

function LigneLien({ libelle, icone, url, derniere }) {
  return (
    <TouchableOpacity
      onPress={() => ouvrirLien(url)}
      style={[styles.ligne, derniere && { borderBottomWidth: 0 }]}
      accessibilityRole="link"
      accessibilityLabel={libelle}
    >
      <View style={styles.ligneGauche}>
        <Ionicons name={icone} size={20} color={COLORS.noir} />
        <Text style={styles.ligneTexte}>{libelle}</Text>
      </View>
      <Ionicons name="open-outline" size={18} color={COLORS.gris} />
    </TouchableOpacity>
  );
}

// Profil > À propos : présentation de FASOKA et liens vers les informations légales
export default function AProposScreen({ onRetour }) {
  return (
    <ScrollView style={{ backgroundColor: COLORS.creme }} contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={onRetour} style={styles.retour}>
        <Ionicons name="chevron-back" size={18} color={COLORS.rouge} />
        <Text style={styles.retourTexte}>Retour</Text>
      </TouchableOpacity>
      <Text style={styles.titre}>À propos</Text>

      <View style={styles.carteMarque}>
        <Image source={LOGO} style={{ height: 56, width: 56 * LOGO_RATIO }} resizeMode="contain" />
        <Text style={styles.nomMarque}>FASOKA</Text>
        <Text style={styles.slogan}>Achetez et vendez près de chez vous.</Text>
      </View>

      <Text style={styles.description}>
        FASOKA permet à chacun d'ouvrir sa boutique en ligne, de publier ses produits avec des photos et de
        vendre à des clients de sa ville. Les clients parcourent les produits de nombreuses boutiques, passent
        commande et suivent leurs achats au même endroit.
      </Text>

      <Text style={styles.titreSection}>Informations légales</Text>
      <View style={styles.liste}>
        <LigneLien libelle="Politique de confidentialité" icone="shield-checkmark-outline" url={LIENS.confidentialite} />
        <LigneLien libelle="Conditions d'utilisation" icone="document-text-outline" url={LIENS.conditions} derniere />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, width: '100%', maxWidth: 520, alignSelf: 'center' },
  retour: { paddingVertical: 6, marginBottom: 6, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center' },
  retourTexte: { fontSize: 15, color: COLORS.rouge, fontWeight: '600' },
  titre: { fontSize: 20, fontWeight: '800', marginBottom: 16, color: COLORS.noir },

  carteMarque: {
    backgroundColor: COLORS.noir,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  nomMarque: { color: COLORS.or, fontSize: 22, fontWeight: '900', letterSpacing: 3, marginTop: 10 },
  slogan: { color: 'rgba(255,255,255,0.75)', fontSize: 13.5, marginTop: 4, textAlign: 'center' },

  description: { fontSize: 14, color: COLORS.noir, lineHeight: 21, marginBottom: 22 },
  titreSection: { fontSize: 13, fontWeight: '700', color: COLORS.gris, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  liste: { backgroundColor: 'white', borderRadius: 12, overflow: 'hidden' },
  ligne: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ligneGauche: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  ligneTexte: { fontSize: 14, color: COLORS.noir, marginLeft: 12, flexShrink: 1 },
});
