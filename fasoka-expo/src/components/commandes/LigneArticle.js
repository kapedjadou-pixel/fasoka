import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { fcfa } from '../dashboard/format';

// Un article d'une commande : photo, nom, quantité × prix unitaire, sous-total
export default function LigneArticle({ article }) {
  return (
    <View style={styles.ligne}>
      <View style={styles.photo}>
        {article.image ? (
          <Image source={{ uri: article.image }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Ionicons name="cube-outline" size={22} color={COLORS.gris} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={styles.nom}>{article.nom}</Text>
        <Text style={styles.detail}>{article.quantite} × {fcfa(article.prix_unitaire)}</Text>
        {article.disponible === false ? <Text style={styles.retire}>Produit retiré de la vente</Text> : null}
      </View>
      <Text style={styles.sousTotal}>{fcfa(article.sous_total)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F0E9' },
  photo: { width: 52, height: 52, borderRadius: 10, backgroundColor: COLORS.creme, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12 },
  nom: { fontSize: 14, fontWeight: '700', color: COLORS.noir },
  detail: { fontSize: 12.5, color: COLORS.gris, marginTop: 2 },
  retire: { fontSize: 11.5, color: COLORS.rouge, marginTop: 2 },
  sousTotal: { fontSize: 13.5, fontWeight: '800', color: COLORS.noir, marginLeft: 8 },
});
