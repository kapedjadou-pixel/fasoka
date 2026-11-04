import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { ApiClient, ApiException } from '../../api/apiClient';
import { useSpace } from '../../context/SpaceContext';
import ModaleConfirmation from '../../components/ModaleConfirmation';

// Catalogue de la boutique : liste des produits, avec modifier / supprimer, et « + » pour en ajouter un.
export default function CatalogScreen({ navigation }) {
  const { maBoutique } = useSpace();
  const [produits, setProduits] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [recherche, setRecherche] = useState('');
  const [aSupprimer, setASupprimer] = useState(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const charger = useCallback(async () => {
    if (!maBoutique) return;
    try {
      const data = await ApiClient.get(`/products/shop/${maBoutique.id}`);
      setProduits(data);
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof ApiException ? e.message : 'Impossible de charger le catalogue.');
    } finally {
      setChargement(false);
    }
  }, [maBoutique]);

  // Recharge à l'ouverture et à chaque retour sur cet écran (après avoir modifié ou ajouté un produit)
  useEffect(() => {
    charger();
    return navigation.addListener('focus', charger);
  }, [charger, navigation]);

  async function confirmerSuppression() {
    const produit = aSupprimer;
    setSuppressionEnCours(true);
    try {
      await ApiClient.delete(`/products/${produit.id}`);
      setProduits((prec) => prec.filter((p) => p.id !== produit.id));
      setASupprimer(null);
    } catch (e) {
      setASupprimer(null);
      setErreur(e instanceof ApiException ? e.message : 'Impossible de supprimer le produit.');
    } finally {
      setSuppressionEnCours(false);
    }
  }

  const terme = recherche.trim().toLowerCase();
  const visibles = terme ? produits.filter((p) => String(p.nom).toLowerCase().includes(terme) || String(p.categorie || '').toLowerCase().includes(terme)) : produits;

  function ligne({ item }) {
    const stock = Number(item.stock_quantite) || 0;
    const seuil = item.stock_alerte_seuil === null || item.stock_alerte_seuil === undefined ? 5 : Number(item.stock_alerte_seuil);
    const rupture = stock <= 0;
    const faible = !rupture && stock <= seuil;
    return (
      <TouchableOpacity
        style={styles.ligne}
        onPress={() => navigation.navigate('ProductEdit', { productId: item.id })}
        accessibilityRole="button"
        accessibilityLabel={`Modifier ${item.nom}`}
      >
        <View style={styles.miniature}>
          {item.images && item.images.length > 0 ? (
            <Image source={{ uri: item.images[0] }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Ionicons name="image-outline" size={22} color={COLORS.gris} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={styles.nom}>{item.nom}</Text>
          <Text style={styles.prix}>{Number(item.prix).toLocaleString('fr-FR')} F CFA</Text>
          <View style={styles.infosLigne}>
            <Text style={[styles.stock, rupture && { color: COLORS.rouge, fontWeight: '700' }, faible && { color: COLORS.orFonce, fontWeight: '700' }]}>
              {rupture ? 'Rupture de stock' : faible ? `Stock faible : ${stock}` : `Stock : ${stock}`}
            </Text>
            {item.categorie ? <Text numberOfLines={1} style={styles.categorie}>· {item.categorie}</Text> : null}
          </View>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('ProductEdit', { productId: item.id })}
          style={styles.action}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={`Modifier ${item.nom}`}
        >
          <Ionicons name="create-outline" size={20} color={COLORS.noir} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setASupprimer(item)}
          style={styles.action}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          accessibilityRole="button"
          accessibilityLabel={`Supprimer ${item.nom}`}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.rouge} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.creme }}>
      {erreur ? (
        <TouchableOpacity style={styles.bandeauErreur} onPress={() => setErreur(null)}>
          <Text style={styles.bandeauErreurTexte}>{erreur}</Text>
        </TouchableOpacity>
      ) : null}

      {chargement ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.or} />
      ) : produits.length === 0 ? (
        <View style={styles.vide}>
          <Ionicons name="pricetags-outline" size={44} color={COLORS.gris} />
          <Text style={styles.videTitre}>Votre catalogue est vide</Text>
          <Text style={styles.videTexte}>Ajoutez votre premier produit avec des photos, une description et un prix.</Text>
          <TouchableOpacity style={styles.videBouton} onPress={() => navigation.navigate('ProductEdit')}>
            <Text style={styles.videBoutonTexte}>Ajouter un produit</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visibles}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 90, width: '100%', maxWidth: 720, alignSelf: 'center' }}
          ListHeaderComponent={
            <View>
              {produits.length > 5 ? (
                <View style={styles.rechercheLigne}>
                  <Ionicons name="search" size={18} color={COLORS.gris} />
                  <TextInput
                    style={styles.rechercheInput}
                    placeholder="Rechercher dans mes produits"
                    placeholderTextColor={COLORS.gris}
                    value={recherche}
                    onChangeText={setRecherche}
                  />
                </View>
              ) : null}
              <Text style={styles.compte}>{produits.length} produit{produits.length > 1 ? 's' : ''} · touchez un produit pour le modifier</Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.videTexte}>Aucun produit ne correspond à « {recherche} ».</Text>}
          renderItem={ligne}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('ProductEdit')} accessibilityRole="button" accessibilityLabel="Ajouter un produit">
        <Ionicons name="add" size={28} color={COLORS.noir} />
      </TouchableOpacity>

      <ModaleConfirmation
        visible={Boolean(aSupprimer)}
        titre="Supprimer ce produit ?"
        message={aSupprimer ? `« ${aSupprimer.nom} » ne sera plus visible par les clients. Les commandes déjà passées sont conservées.` : ''}
        libelleConfirmer="Supprimer"
        destructif
        enCours={suppressionEnCours}
        onConfirmer={confirmerSuppression}
        onAnnuler={() => setASupprimer(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bandeauErreur: { backgroundColor: '#FDECEA', padding: 10, margin: 12, marginBottom: 0, borderRadius: 10 },
  bandeauErreurTexte: { color: COLORS.rouge, fontSize: 13 },
  vide: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  videTitre: { fontSize: 16, fontWeight: '800', color: COLORS.noir, marginTop: 12 },
  videTexte: { fontSize: 13.5, color: COLORS.gris, textAlign: 'center', marginTop: 6, lineHeight: 19, maxWidth: 320 },
  videBouton: { backgroundColor: COLORS.or, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 22, marginTop: 16 },
  videBoutonTexte: { fontWeight: '800', color: COLORS.noir },
  rechercheLigne: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blanc, borderRadius: 10, paddingHorizontal: 12, marginBottom: 8 },
  rechercheInput: { flex: 1, paddingVertical: 10, marginLeft: 8, fontSize: 14, color: COLORS.noir },
  compte: { fontSize: 12, color: COLORS.gris, marginBottom: 10 },
  ligne: { backgroundColor: COLORS.blanc, borderRadius: 12, padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  miniature: { width: 64, height: 64, borderRadius: 10, backgroundColor: COLORS.creme, alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' },
  nom: { fontWeight: '700', fontSize: 14, color: COLORS.noir },
  prix: { fontSize: 13.5, fontWeight: '800', color: COLORS.rouge, marginTop: 2 },
  infosLigne: { flexDirection: 'row', alignItems: 'center', marginTop: 3, flexWrap: 'wrap' },
  stock: { fontSize: 12, color: COLORS.gris },
  categorie: { fontSize: 12, color: COLORS.gris, marginLeft: 5, flexShrink: 1 },
  action: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.creme, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: COLORS.or, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 },
});
