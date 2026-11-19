import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { regrouperCategories } from '../../config/categoriesFamilles';

// Panneau « Toutes les catégories » : les catégories réellement utilisées, regroupées par familles, avec le nombre de produits
export default function PanneauCategories({ visible, categories, active, onChoisir, onFermer }) {
  const { width } = useWindowDimensions();
  const centre = width >= 700;
  const familles = regrouperCategories(categories);

  return (
    <Modal visible={Boolean(visible)} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable style={[styles.fond, { justifyContent: centre ? 'center' : 'flex-end' }]} onPress={onFermer}>
        <Pressable style={[styles.feuille, centre && { borderRadius: 20 }]} onPress={() => {}}>
          <View style={styles.entete}>
            <Text style={styles.titre}>Catégories</Text>
            <TouchableOpacity onPress={onFermer} accessibilityRole="button" accessibilityLabel="Fermer les catégories">
              <Ionicons name="close" size={24} color={COLORS.noir} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
            <TouchableOpacity style={[styles.toutes, !active && styles.toutesActive]} onPress={() => onChoisir('')} accessibilityRole="button">
              <Ionicons name="grid-outline" size={20} color={COLORS.noir} />
              <Text style={styles.toutesTexte}>Tous les produits</Text>
            </TouchableOpacity>

            {familles.length === 0 ? (
              <Text style={styles.vide}>Les catégories apparaîtront ici dès que les boutiques en auront renseigné pour leurs produits.</Text>
            ) : null}

            {familles.map((f) => (
              <View key={f.nom} style={styles.famille}>
                <View style={styles.familleEntete}>
                  <Ionicons name={f.icone} size={19} color={COLORS.orFonce} />
                  <Text style={styles.familleNom}>{f.nom}</Text>
                  <Text style={styles.familleTotal}>{f.total}</Text>
                </View>
                <View style={styles.puces}>
                  {f.categories.map((c) => (
                    <TouchableOpacity key={c.nom} style={[styles.puce, active === c.nom && styles.puceActive]} onPress={() => onChoisir(c.nom)} accessibilityRole="button" accessibilityState={{ selected: active === c.nom }}>
                      <Text style={[styles.puceTexte, active === c.nom && styles.puceTexteActive]}>{c.nom} ({c.nombre})</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center' },
  feuille: { width: '100%', maxWidth: 560, maxHeight: '86%', backgroundColor: COLORS.blanc, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18 },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  titre: { fontSize: 19, fontWeight: '900', color: COLORS.noir },
  toutes: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.creme, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: 'transparent' },
  toutesActive: { borderColor: COLORS.or, backgroundColor: '#FFFBEF' },
  toutesTexte: { fontSize: 14.5, fontWeight: '800', color: COLORS.noir },
  vide: { fontSize: 13.5, color: COLORS.gris, lineHeight: 19, marginTop: 16 },
  famille: { marginTop: 18 },
  familleEntete: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  familleNom: { flex: 1, fontSize: 15, fontWeight: '900', color: COLORS.noir },
  familleTotal: { fontSize: 12.5, color: COLORS.gris, fontWeight: '700' },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  puce: { backgroundColor: COLORS.creme, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#E6E2D8' },
  puceActive: { backgroundColor: COLORS.noir, borderColor: COLORS.noir },
  puceTexte: { fontSize: 13, color: COLORS.noir, fontWeight: '600' },
  puceTexteActive: { color: COLORS.or, fontWeight: '800' },
});
