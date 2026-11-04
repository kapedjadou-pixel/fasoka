import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, Image, ScrollView, FlatList, TouchableOpacity, StyleSheet, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { ApiClient } from '../api/apiClient';
import Avatar from './messagerie/Avatar';

const VERT = '#1E9E4A';
const LARGEUR_MAX = 720;

const prixFormate = (n) => Number(n).toLocaleString('fr-FR') + ' F CFA';
const deuxChiffres = (n) => String(n).padStart(2, '0');

function datePublication(valeur) {
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return null;
  return { texte: deuxChiffres(d.getDate()) + '/' + deuxChiffres(d.getMonth() + 1) + '/' + d.getFullYear(), nouveau: Date.now() - d.getTime() < 7 * 24 * 3600 * 1000 };
}

// Fiche détaillée d'un produit : photos, prix, disponibilité, description complète, boutique, autres produits de la boutique.
// `produit` : produit tel que reçu dans la liste (affiché tout de suite) ; la fiche complète est chargée ensuite.
export default function ProductDetail({ produit, maBoutiqueId, onFermer, onAjouter, onContacter, onVoirPanier, onOuvrirAutre }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState(null);
  const [autres, setAutres] = useState([]);
  const [indexPhoto, setIndexPhoto] = useState(0);
  const [quantite, setQuantite] = useState(1);
  const [ajoute, setAjoute] = useState(false);

  useEffect(() => {
    let annule = false;
    ApiClient.get(`/products/${produit.id}`).then((d) => { if (!annule) setDetail(d); }).catch(() => {});
    ApiClient.get(`/products/shop/${produit.shop_id}`)
      .then((liste) => { if (!annule) setAutres(liste.filter((p) => p.id !== produit.id && Number(p.stock_quantite) > 0).slice(0, 10)); })
      .catch(() => {});
    return () => { annule = true; };
  }, [produit.id, produit.shop_id]);

  // Photos : celles de la fiche complète (dans l'ordre choisi par la boutique), sinon celles de la liste
  const photos = detail && detail.images ? detail.images.map((i) => i.image_url) : (produit.images || []).filter((i) => typeof i === 'string');
  const p = { ...produit, ...(detail || {}) };
  const stock = Number(p.stock_quantite) || 0;
  const rupture = stock <= 0;
  const maxQuantite = Math.max(1, Math.min(stock, 99));
  const quantiteEffective = Math.min(quantite, maxQuantite);
  const pub = datePublication(p.created_at);
  const estMaBoutique = Boolean(maBoutiqueId) && maBoutiqueId === p.shop_id;

  const largeurContenu = Math.min(width, LARGEUR_MAX);
  const hauteurPhoto = Math.min(largeurContenu, 440);

  function precedente() { setIndexPhoto((i) => (i - 1 + photos.length) % photos.length); }
  function suivante() { setIndexPhoto((i) => (i + 1) % photos.length); }

  function ajouter() {
    onAjouter({ ...p, images: photos }, quantiteEffective);
    setAjoute(true);
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onFermer}>
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <View style={styles.barre}>
          <TouchableOpacity onPress={onFermer} style={styles.retour} accessibilityRole="button" accessibilityLabel="Retour aux produits">
            <Ionicons name="chevron-back" size={22} color={COLORS.noir} />
            <Text style={styles.retourTexte}>Retour</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={{ width: largeurContenu, alignSelf: 'center' }}>
            {/* Photos */}
            <View style={[styles.galerie, { height: hauteurPhoto }]}>
              {photos.length > 0 ? (
                <Image source={{ uri: photos[Math.min(indexPhoto, photos.length - 1)] }} style={styles.photo} resizeMode="contain" />
              ) : (
                <View style={styles.sansPhoto}>
                  <Ionicons name="cube-outline" size={64} color={COLORS.gris} />
                  <Text style={styles.sansPhotoTexte}>Pas de photo</Text>
                </View>
              )}
              {photos.length > 1 ? (
                <>
                  <TouchableOpacity onPress={precedente} style={[styles.fleche, { left: 8 }]} accessibilityRole="button" accessibilityLabel="Photo précédente">
                    <Ionicons name="chevron-back" size={22} color={COLORS.noir} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={suivante} style={[styles.fleche, { right: 8 }]} accessibilityRole="button" accessibilityLabel="Photo suivante">
                    <Ionicons name="chevron-forward" size={22} color={COLORS.noir} />
                  </TouchableOpacity>
                  <View style={styles.compteurPhotos}>
                    <Text style={styles.compteurPhotosTexte}>{Math.min(indexPhoto, photos.length - 1) + 1} / {photos.length}</Text>
                  </View>
                </>
              ) : null}
            </View>
            {photos.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vignettes}>
                {photos.map((url, i) => (
                  <TouchableOpacity key={url + i} onPress={() => setIndexPhoto(i)} accessibilityRole="button" accessibilityLabel={`Voir la photo ${i + 1}`}>
                    <Image source={{ uri: url }} style={[styles.vignette, i === indexPhoto && styles.vignetteActive]} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}

            {/* Titre, prix, disponibilité */}
            <View style={styles.bloc}>
              <View style={styles.etiquettes}>
                {pub && pub.nouveau ? <Text style={styles.etiquetteNouveau}>Nouveau</Text> : null}
                {p.categorie ? <Text style={styles.etiquetteCategorie}>{p.categorie}</Text> : null}
              </View>
              <Text style={styles.nom}>{p.nom}</Text>
              <Text style={styles.prix}>{prixFormate(p.prix)}</Text>
              <View style={styles.ligneStock}>
                <Ionicons name={rupture ? 'close-circle' : 'checkmark-circle'} size={16} color={rupture ? COLORS.gris : stock <= 5 ? COLORS.rouge : VERT} />
                <Text style={[styles.stock, { color: rupture ? COLORS.gris : stock <= 5 ? COLORS.rouge : VERT }]}>
                  {rupture ? 'Rupture de stock' : stock <= 5 ? `Plus que ${stock} en stock` : 'En stock'}
                </Text>
              </View>
            </View>

            {/* Description */}
            <View style={styles.bloc}>
              <Text style={styles.titreBloc}>Description</Text>
              <Text selectable style={p.description ? styles.description : styles.descriptionVide}>
                {p.description || "Le vendeur n'a pas encore ajouté de description. Posez-lui vos questions par message."}
              </Text>
            </View>

            {/* Détails */}
            <View style={styles.bloc}>
              <Text style={styles.titreBloc}>Détails</Text>
              {[
                ['Catégorie', p.categorie],
                ['Disponibilité', rupture ? 'Indisponible' : stock <= 20 ? `${stock} disponible${stock > 1 ? 's' : ''}` : 'Plus de 20 disponibles'],
                ['Boutique', p.nom_boutique],
                ['Ville', p.ville],
                ['Publié le', pub ? pub.texte : null],
              ].filter(([, valeur]) => Boolean(valeur)).map(([libelle, valeur]) => (
                <View key={libelle} style={styles.ligneDetail}>
                  <Text style={styles.detailLibelle}>{libelle}</Text>
                  <Text style={styles.detailValeur}>{valeur}</Text>
                </View>
              ))}
            </View>

            {/* Boutique */}
            {p.nom_boutique ? (
              <View style={styles.bloc}>
                <Text style={styles.titreBloc}>Vendu par</Text>
                <View style={styles.boutique}>
                  <Avatar uri={p.boutique_logo} nom={p.nom_boutique} taille={46} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text numberOfLines={1} style={styles.boutiqueNom}>{p.nom_boutique}</Text>
                      {p.badge_verifie ? <Ionicons name="checkmark-circle" size={16} color="#2563EB" style={{ marginLeft: 5 }} /> : null}
                    </View>
                    {p.ville ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Ionicons name="location-outline" size={13} color={COLORS.gris} />
                        <Text style={styles.boutiqueVille}>{p.ville}</Text>
                      </View>
                    ) : null}
                  </View>
                  {!estMaBoutique ? (
                    <TouchableOpacity onPress={() => onContacter(p)} style={styles.boutonContacter} accessibilityRole="button" accessibilityLabel={`Écrire à ${p.nom_boutique}`}>
                      <Ionicons name="chatbubble-ellipses-outline" size={17} color={COLORS.noir} />
                      <Text style={styles.boutonContacterTexte}>Écrire</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Autres produits de la boutique */}
            {autres.length > 0 ? (
              <View style={styles.bloc}>
                <Text style={styles.titreBloc}>Autres produits de cette boutique</Text>
                <FlatList
                  horizontal
                  data={autres}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.autre} onPress={() => onOuvrirAutre(item)} accessibilityRole="button" accessibilityLabel={item.nom}>
                      <View style={styles.autreImage}>
                        {item.images && item.images.length > 0 ? (
                          <Image source={{ uri: item.images[0] }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <Ionicons name="cube-outline" size={28} color={COLORS.gris} />
                        )}
                      </View>
                      <Text numberOfLines={2} style={styles.autreNom}>{item.nom}</Text>
                      <Text style={styles.autrePrix}>{prixFormate(item.prix)}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            ) : null}
          </View>
        </ScrollView>

        {/* Barre d'achat : toujours visible en bas */}
        <View style={[styles.barreAchat, { paddingBottom: 10 + insets.bottom }]}>
          <View style={{ width: largeurContenu, alignSelf: 'center', flexDirection: 'row', alignItems: 'center' }}>
            {ajoute ? (
              <>
                <View style={styles.ajoute}>
                  <Ionicons name="checkmark-circle" size={20} color={VERT} />
                  <Text style={styles.ajouteTexte}>Ajouté au panier</Text>
                </View>
                <TouchableOpacity style={styles.boutonPanier} onPress={onVoirPanier} accessibilityRole="button">
                  <Text style={styles.boutonPanierTexte}>Voir le panier</Text>
                </TouchableOpacity>
              </>
            ) : rupture ? (
              <View style={[styles.boutonPanier, styles.boutonInactif, { flex: 1 }]}>
                <Text style={[styles.boutonPanierTexte, { color: COLORS.gris }]}>Rupture de stock</Text>
              </View>
            ) : (
              <>
                <View style={styles.quantite}>
                  <TouchableOpacity onPress={() => setQuantite(Math.max(1, quantiteEffective - 1))} style={styles.quantiteBouton} accessibilityRole="button" accessibilityLabel="Diminuer la quantité">
                    <Ionicons name="remove" size={18} color={COLORS.noir} />
                  </TouchableOpacity>
                  <Text style={styles.quantiteValeur}>{quantiteEffective}</Text>
                  <TouchableOpacity onPress={() => setQuantite(Math.min(maxQuantite, quantiteEffective + 1))} style={styles.quantiteBouton} accessibilityRole="button" accessibilityLabel="Augmenter la quantité">
                    <Ionicons name="add" size={18} color={COLORS.noir} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={[styles.boutonPanier, { flex: 1 }]} onPress={ajouter} accessibilityRole="button">
                  <Text style={styles.boutonPanierTexte}>Ajouter au panier · {prixFormate(Number(p.prix) * quantiteEffective)}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.creme },
  barre: { backgroundColor: COLORS.blanc, borderBottomWidth: 1, borderBottomColor: '#ECE9E2', paddingHorizontal: 8 },
  retour: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, alignSelf: 'flex-start' },
  retourTexte: { fontSize: 15, fontWeight: '700', color: COLORS.noir },

  galerie: { backgroundColor: COLORS.blanc, alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
  sansPhoto: { alignItems: 'center' },
  sansPhotoTexte: { color: COLORS.gris, marginTop: 6, fontSize: 13 },
  fleche: { position: 'absolute', top: '45%', width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  compteurPhotos: { position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  compteurPhotosTexte: { color: COLORS.blanc, fontSize: 11.5, fontWeight: '700' },
  vignettes: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.blanc },
  vignette: { width: 56, height: 56, borderRadius: 8, marginRight: 8, borderWidth: 2, borderColor: 'transparent', backgroundColor: COLORS.creme },
  vignetteActive: { borderColor: COLORS.or },

  bloc: { backgroundColor: COLORS.blanc, borderRadius: 14, padding: 16, marginHorizontal: 12, marginTop: 12 },
  etiquettes: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  etiquetteNouveau: { backgroundColor: COLORS.rouge, color: COLORS.blanc, fontSize: 11, fontWeight: '800', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  etiquetteCategorie: { backgroundColor: '#FFF6DB', color: COLORS.orFonce, fontSize: 11.5, fontWeight: '700', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  nom: { fontSize: 20, fontWeight: '800', color: COLORS.noir, lineHeight: 26 },
  prix: { fontSize: 26, fontWeight: '900', color: COLORS.rouge, marginTop: 6 },
  ligneStock: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  stock: { fontSize: 13.5, fontWeight: '700', marginLeft: 6 },

  titreBloc: { fontSize: 15, fontWeight: '800', color: COLORS.noir, marginBottom: 8 },
  description: { fontSize: 14.5, lineHeight: 22, color: COLORS.noir },
  descriptionVide: { fontSize: 13.5, lineHeight: 20, color: COLORS.gris, fontStyle: 'italic' },
  ligneDetail: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F0E9' },
  detailLibelle: { fontSize: 13.5, color: COLORS.gris },
  detailValeur: { fontSize: 13.5, color: COLORS.noir, fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: 12 },

  boutique: { flexDirection: 'row', alignItems: 'center' },
  boutiqueNom: { fontSize: 15, fontWeight: '800', color: COLORS.noir, flexShrink: 1 },
  boutiqueVille: { fontSize: 12.5, color: COLORS.gris, marginLeft: 3 },
  boutonContacter: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.or, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  boutonContacterTexte: { fontWeight: '800', color: COLORS.noir, marginLeft: 6, fontSize: 13 },

  autre: { width: 128, marginRight: 10 },
  autreImage: { width: 128, height: 128, borderRadius: 10, backgroundColor: COLORS.creme, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  autreNom: { fontSize: 12.5, color: COLORS.noir, marginTop: 6, lineHeight: 16 },
  autrePrix: { fontSize: 13, fontWeight: '800', color: COLORS.rouge, marginTop: 2 },

  barreAchat: { backgroundColor: COLORS.blanc, borderTopWidth: 1, borderTopColor: '#ECE9E2', paddingHorizontal: 12, paddingTop: 10 },
  quantite: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.creme, borderRadius: 12, marginRight: 10 },
  quantiteBouton: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  quantiteValeur: { minWidth: 26, textAlign: 'center', fontSize: 16, fontWeight: '800', color: COLORS.noir },
  boutonPanier: { backgroundColor: COLORS.or, borderRadius: 12, height: 46, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  boutonPanierTexte: { fontWeight: '800', color: COLORS.noir, fontSize: 14.5 },
  boutonInactif: { backgroundColor: '#E4E1D9' },
  ajoute: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  ajouteTexte: { fontSize: 14.5, fontWeight: '700', color: VERT, marginLeft: 8 },
});
