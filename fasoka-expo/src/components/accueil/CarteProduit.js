import React, { useState } from 'react';
import { View, Text, Image, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { fcfa } from '../dashboard/format';
import { miniature } from '../messagerie/formatage';
import { SEUIL_POPULAIRE, JOURS_NOUVEAU } from '../../config/accueil';

const VERT = '#1E9E4A';

// Carte produit de l'accueil : photo carrée allégée, badges (Nouveau, Populaire, Rupture), nom, prix en F CFA,
// boutique (vérifiée ou non) et ville, disponibilité, bouton d'ajout au panier. Les badges viennent des données réelles.
export default function CarteProduit({ produit, largeur, onPress, onAjouter, onContacter, onBoutique, ajoute, peutContacter = true }) {
  const [survol, setSurvol] = useState(false);
  const stock = Number(produit.stock_quantite) || 0;
  const rupture = stock <= 0;
  const faible = !rupture && stock <= 5;
  const photos = (produit.images || []).filter((i) => typeof i === 'string');
  const nouveau = produit.created_at && Date.now() - new Date(produit.created_at).getTime() < JOURS_NOUVEAU * 86400000;
  const populaire = Number(produit.ventes_30j) >= SEUIL_POPULAIRE;
  const couleurStock = rupture ? COLORS.gris : faible ? COLORS.rouge : VERT;

  return (
    <Pressable
      onPress={() => onPress(produit)}
      onHoverIn={() => setSurvol(true)}
      onHoverOut={() => setSurvol(false)}
      style={[styles.carte, { width: largeur }, survol && styles.carteSurvol]}
      accessibilityRole="button"
      accessibilityLabel={`Voir ${produit.nom}, ${fcfa(produit.prix)}${rupture ? ', rupture de stock' : ''}`}
    >
      <View style={{ width: largeur, height: largeur, backgroundColor: COLORS.creme }}>
        {photos[0] ? (
          <Image source={{ uri: miniature(photos[0], 420) }} style={[styles.photo, rupture && { opacity: 0.45 }]} resizeMode="cover" />
        ) : (
          <View style={styles.sansPhoto}><Ionicons name="cube-outline" size={34} color={COLORS.gris} /></View>
        )}

        <View style={styles.badges}>
          {nouveau ? <Text style={[styles.badge, { backgroundColor: COLORS.rouge, color: COLORS.blanc }]}>Nouveau</Text> : null}
          {populaire ? <Text style={[styles.badge, { backgroundColor: COLORS.noir, color: COLORS.or }]}>Populaire</Text> : null}
          {rupture ? <Text style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.92)', color: COLORS.gris }]}>Rupture</Text> : null}
        </View>

        {photos.length > 1 ? (
          <View style={styles.nombrePhotos}>
            <Ionicons name="images-outline" size={11} color={COLORS.blanc} />
            <Text style={styles.nombrePhotosTexte}>{photos.length}</Text>
          </View>
        ) : null}

        {!rupture ? (
          <TouchableOpacity
            style={[styles.ajout, ajoute && { backgroundColor: VERT }]}
            onPress={() => onAjouter(produit)}
            accessibilityRole="button"
            accessibilityLabel={`Ajouter ${produit.nom} au panier`}
          >
            <Ionicons name={ajoute ? 'checkmark' : 'add'} size={22} color={ajoute ? COLORS.blanc : COLORS.noir} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.corps}>
        <Text numberOfLines={2} style={styles.nom}>{produit.nom}</Text>
        <Text style={styles.prix}>{fcfa(produit.prix)}</Text>

        <View style={styles.ligneBoutique}>
          <Ionicons name="storefront-outline" size={12} color={COLORS.gris} />
          <TouchableOpacity style={{ flexShrink: 1 }} disabled={!onBoutique || !produit.nom_boutique} onPress={() => onBoutique(produit)} accessibilityRole="link" accessibilityLabel={`Voir la boutique ${produit.nom_boutique || ''}`}>
            <Text numberOfLines={1} style={styles.boutique}>{produit.nom_boutique || 'Boutique'}</Text>
          </TouchableOpacity>
          {produit.badge_verifie ? <Ionicons name="checkmark-circle" size={13} color="#2563EB" style={{ marginLeft: 3 }} /> : null}
          <View style={{ flex: 1 }} />
          {peutContacter && onContacter ? (
            <TouchableOpacity onPress={() => onContacter(produit)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={`Écrire à ${produit.nom_boutique || 'la boutique'}`}>
              <Ionicons name="chatbubble-ellipses-outline" size={15} color={COLORS.orFonce} />
            </TouchableOpacity>
          ) : null}
        </View>
        {produit.ville ? (
          <View style={styles.ligneVille}>
            <Ionicons name="location-outline" size={12} color={COLORS.gris} />
            <Text numberOfLines={1} style={styles.ville}>{produit.ville}</Text>
          </View>
        ) : null}

        <View style={styles.ligneStock}>
          <View style={[styles.point, { backgroundColor: couleurStock }]} />
          <Text style={[styles.stock, { color: couleurStock }]}>
            {rupture ? 'Rupture de stock' : faible ? `Plus que ${stock}` : 'En stock'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  carte: { backgroundColor: COLORS.blanc, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#EFECE4' },
  carteSurvol: { borderColor: COLORS.or, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  photo: { width: '100%', height: '100%' },
  sansPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badges: { position: 'absolute', left: 8, top: 8, gap: 4, alignItems: 'flex-start' },
  badge: { fontSize: 10.5, fontWeight: '800', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  nombrePhotos: { position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3 },
  nombrePhotosTexte: { color: COLORS.blanc, fontSize: 10.5, fontWeight: '700', marginLeft: 3 },
  ajout: { position: 'absolute', right: 8, bottom: 8, width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.or, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  corps: { padding: 10 },
  nom: { fontSize: 13.5, fontWeight: '700', color: COLORS.noir, lineHeight: 18, minHeight: 36 },
  prix: { fontSize: 16.5, fontWeight: '900', color: COLORS.noir, marginTop: 4 },
  ligneBoutique: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  boutique: { fontSize: 11.5, color: COLORS.gris, fontWeight: '600' },
  ligneVille: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  ville: { fontSize: 11, color: COLORS.gris, flexShrink: 1 },
  ligneStock: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  point: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  stock: { fontSize: 11.5, fontWeight: '700' },
});
