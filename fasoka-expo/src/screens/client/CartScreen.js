import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { useCart } from '../../context/CartContext';
import { ApiClient, ApiException } from '../../api/apiClient';

export default function CartScreen() {
  const { items, shopId, changerQuantite, vider, total } = useCart();
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  async function validerCommande() {
    if (items.length === 0) return;
    setEnvoiEnCours(true);
    setMessage(null);
    try {
      await ApiClient.post('/orders', {
        shop_id: shopId,
        mode_livraison: 'retrait',
        operateur: 'especes',
        items: items.map((i) => ({ product_id: i.product.id, quantite: i.qte })),
      });
      vider();
      setMessage('Commande passée avec succès !');
    } catch (e) {
      setMessage(e instanceof ApiException ? e.message : 'Erreur lors de la commande.');
    } finally {
      setEnvoiEnCours(false);
    }
  }

  if (items.length === 0) {
    return (
      <View style={styles.centre}>
        <Text style={{ color: COLORS.gris }}>Ton panier est vide.</Text>
        {message && <Text style={{ color: COLORS.or, marginTop: 12 }}>{message}</Text>}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.creme }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.product.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => (
          <View style={styles.ligne}>
            <View>
              <Text style={styles.nom}>{item.product.nom}</Text>
              <Text style={styles.prix}>{Number(item.product.prix).toLocaleString('fr-FR')} F</Text>
            </View>
            <View style={styles.quantite}>
              <TouchableOpacity style={styles.boutonQte} onPress={() => changerQuantite(item.product.id, item.qte - 1)}>
                <Ionicons name="remove" size={16} color={COLORS.noir} />
              </TouchableOpacity>
              <Text style={{ marginHorizontal: 10 }}>{item.qte}</Text>
              <TouchableOpacity style={styles.boutonQte} onPress={() => changerQuantite(item.product.id, item.qte + 1)}>
                <Ionicons name="add" size={16} color={COLORS.noir} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
      <View style={styles.bas}>
        {message && <Text style={{ color: COLORS.or, marginBottom: 8, textAlign: 'center' }}>{message}</Text>}
        <View style={styles.total}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>Total</Text>
          <Text style={{ fontWeight: '700', fontSize: 16, color: COLORS.rouge }}>
            {total.toLocaleString('fr-FR')} F
          </Text>
        </View>
        <TouchableOpacity style={styles.boutonValider} onPress={validerCommande} disabled={envoiEnCours}>
          {envoiEnCours ? <ActivityIndicator color={COLORS.noir} /> : <Text style={styles.boutonTexte}>Valider la commande</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ligne: { backgroundColor: 'white', borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nom: { fontWeight: '600', fontSize: 14 },
  prix: { color: COLORS.gris, fontSize: 12 },
  quantite: { flexDirection: 'row', alignItems: 'center' },
  boutonQte: { backgroundColor: COLORS.creme, borderRadius: 13, width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  bas: { backgroundColor: 'white', padding: 16 },
  total: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  boutonValider: { backgroundColor: COLORS.or, borderRadius: 12, padding: 14, alignItems: 'center' },
  boutonTexte: { color: COLORS.noir, fontWeight: '700', fontSize: 15 },
});
