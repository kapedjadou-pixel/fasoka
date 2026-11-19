import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, ScrollView, TouchableOpacity, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { TRIS, TRANCHES_PRIX, PUBLICATIONS, FILTRES_VIDES } from '../../config/accueil';

function Puce({ libelle, actif, onPress }) {
  return (
    <TouchableOpacity style={[styles.puce, actif && styles.puceActive]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: actif }}>
      <Text style={[styles.puceTexte, actif && styles.puceTexteActive]}>{libelle}</Text>
    </TouchableOpacity>
  );
}

// Panneau de filtres : tri, catégorie, prix, ville, date de publication, disponibilité.
// Les choix sont appliqués seulement avec « Voir les résultats ».
export default function PanneauFiltres({ visible, filtres, categories, villes, onAppliquer, onFermer }) {
  const { width } = useWindowDimensions();
  const centre = width >= 700;
  const [brouillon, setBrouillon] = useState(filtres);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    if (visible) {
      setBrouillon(filtres);
      setErreur(null);
    }
  }, [visible]);

  const modifier = (changement) => setBrouillon((b) => ({ ...b, ...changement }));
  const chiffres = (t) => t.replace(/[^0-9]/g, '').slice(0, 9);

  function appliquer() {
    if (brouillon.prixMin !== '' && brouillon.prixMax !== '' && Number(brouillon.prixMin) > Number(brouillon.prixMax)) {
      setErreur('Le prix minimum dépasse le prix maximum.');
      return;
    }
    onAppliquer(brouillon);
  }

  return (
    <Modal visible={Boolean(visible)} transparent animationType="fade" onRequestClose={onFermer}>
      <Pressable style={[styles.fond, { justifyContent: centre ? 'center' : 'flex-end' }]} onPress={onFermer}>
        <Pressable style={[styles.feuille, centre && styles.feuilleCentree]} onPress={() => {}}>
          <View style={styles.entete}>
            <Text style={styles.titre}>Filtres</Text>
            <TouchableOpacity onPress={onFermer} accessibilityRole="button" accessibilityLabel="Fermer les filtres">
              <Ionicons name="close" size={24} color={COLORS.noir} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.section}>Trier par</Text>
            <View style={styles.puces}>
              {TRIS.map(([cle, libelle]) => <Puce key={cle} libelle={libelle} actif={brouillon.tri === cle} onPress={() => modifier({ tri: cle })} />)}
            </View>

            {categories.length > 0 ? (
              <>
                <Text style={styles.section}>Catégorie</Text>
                <View style={styles.puces}>
                  <Puce libelle="Toutes" actif={!brouillon.categorie} onPress={() => modifier({ categorie: '' })} />
                  {categories.slice(0, 16).map((c) => (
                    <Puce key={c.nom} libelle={c.nom} actif={brouillon.categorie === c.nom} onPress={() => modifier({ categorie: c.nom })} />
                  ))}
                </View>
              </>
            ) : null}

            <Text style={styles.section}>Prix (F CFA)</Text>
            <View style={styles.prix}>
              <TextInput style={styles.champ} value={brouillon.prixMin} onChangeText={(t) => modifier({ prixMin: chiffres(t) })} keyboardType="number-pad" placeholder="Minimum" placeholderTextColor={COLORS.gris} accessibilityLabel="Prix minimum" />
              <Text style={{ color: COLORS.gris }}>à</Text>
              <TextInput style={styles.champ} value={brouillon.prixMax} onChangeText={(t) => modifier({ prixMax: chiffres(t) })} keyboardType="number-pad" placeholder="Maximum" placeholderTextColor={COLORS.gris} accessibilityLabel="Prix maximum" />
            </View>
            <View style={[styles.puces, { marginTop: 10 }]}>
              {TRANCHES_PRIX.map(([min, max, libelle]) => {
                const valeurMin = min ? String(min) : '';
                const valeurMax = max ? String(max) : '';
                return (
                  <Puce
                    key={libelle}
                    libelle={libelle}
                    actif={brouillon.prixMin === valeurMin && brouillon.prixMax === valeurMax}
                    onPress={() => modifier({ prixMin: valeurMin, prixMax: valeurMax })}
                  />
                );
              })}
            </View>

            {villes.length > 0 ? (
              <>
                <Text style={styles.section}>Ville de la boutique</Text>
                <View style={styles.puces}>
                  <Puce libelle="Toutes" actif={!brouillon.ville} onPress={() => modifier({ ville: '' })} />
                  {villes.map((v) => <Puce key={v.nom} libelle={`${v.nom} (${v.nombre})`} actif={brouillon.ville === v.nom} onPress={() => modifier({ ville: v.nom })} />)}
                </View>
              </>
            ) : null}

            <Text style={styles.section}>Date de publication</Text>
            <View style={styles.puces}>
              {PUBLICATIONS.map(([jours, libelle]) => <Puce key={libelle} libelle={libelle} actif={brouillon.publieDepuis === jours} onPress={() => modifier({ publieDepuis: jours })} />)}
            </View>

            <TouchableOpacity style={styles.casier} onPress={() => modifier({ enStock: !brouillon.enStock })} accessibilityRole="checkbox" accessibilityState={{ checked: brouillon.enStock }}>
              <Ionicons name={brouillon.enStock ? 'checkbox' : 'square-outline'} size={24} color={brouillon.enStock ? COLORS.orFonce : COLORS.gris} />
              <Text style={styles.casierTexte}>Afficher uniquement les produits en stock</Text>
            </TouchableOpacity>
          </ScrollView>

          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
          <View style={styles.pied}>
            <TouchableOpacity style={styles.reinitialiser} onPress={() => { setBrouillon({ ...FILTRES_VIDES }); setErreur(null); }} accessibilityRole="button">
              <Text style={styles.reinitialiserTexte}>Réinitialiser</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.appliquer} onPress={appliquer} accessibilityRole="button">
              <Text style={styles.appliquerTexte}>Voir les résultats</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center' },
  feuille: { width: '100%', maxWidth: 560, maxHeight: '88%', backgroundColor: COLORS.blanc, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18 },
  feuilleCentree: { borderRadius: 20 },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  titre: { fontSize: 19, fontWeight: '900', color: COLORS.noir },
  section: { fontSize: 13.5, fontWeight: '800', color: COLORS.noir, marginTop: 18, marginBottom: 10 },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  puce: { backgroundColor: COLORS.creme, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#E6E2D8' },
  puceActive: { backgroundColor: COLORS.noir, borderColor: COLORS.noir },
  puceTexte: { fontSize: 13, color: COLORS.noir, fontWeight: '600' },
  puceTexteActive: { color: COLORS.or, fontWeight: '800' },
  prix: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  champ: { flex: 1, backgroundColor: COLORS.creme, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14.5, color: COLORS.noir },
  casier: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  casierTexte: { fontSize: 14, color: COLORS.noir, flex: 1 },
  erreur: { color: COLORS.rouge, fontSize: 13, marginTop: 6 },
  pied: { flexDirection: 'row', gap: 10, marginTop: 12 },
  reinitialiser: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1.5, borderColor: '#E6E2D8', alignItems: 'center', justifyContent: 'center' },
  reinitialiserTexte: { fontWeight: '700', color: COLORS.noir, fontSize: 14 },
  appliquer: { flex: 1, backgroundColor: COLORS.or, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  appliquerTexte: { fontWeight: '800', color: COLORS.noir, fontSize: 15 },
});
