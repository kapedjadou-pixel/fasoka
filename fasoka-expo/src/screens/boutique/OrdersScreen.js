import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../../theme/colors';
import { ApiClient, ApiException } from '../../api/apiClient';
import { useSpace } from '../../context/SpaceContext';

const PROCHAIN_STATUT = {
  en_attente: 'confirmee', confirmee: 'en_preparation', en_preparation: 'prete', prete: 'livree',
};
const LIBELLES = {
  en_attente: 'En attente', confirmee: 'Confirmée', en_preparation: 'En préparation',
  prete: 'Prête', livree: 'Livrée', annulee: 'Annulée',
};

export default function OrdersScreen() {
  const { maBoutique } = useSpace();
  const [commandes, setCommandes] = useState([]);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    if (!maBoutique) return;
    try {
      const data = await ApiClient.get(`/orders/shop/${maBoutique.id}`);
      setCommandes(data);
    } catch (e) {
      // silencieux
    } finally {
      setChargement(false);
    }
  }, [maBoutique]);

  useEffect(() => { charger(); }, [charger]);

  async function avancerStatut(commande) {
    const nouveauStatut = PROCHAIN_STATUT[commande.statut];
    if (!nouveauStatut) return;
    try {
      await ApiClient.patch(`/orders/${commande.id}/statut`, { statut: nouveauStatut });
      charger();
    } catch (e) {
      // signalé silencieusement, l'utilisateur peut réessayer
    }
  }

  if (chargement) return <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.or} />;
  if (commandes.length === 0) return <Text style={styles.message}>Aucune commande reçue.</Text>;

  return (
    <FlatList
      style={{ backgroundColor: COLORS.creme }}
      data={commandes}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 12 }}
      renderItem={({ item }) => {
        const peutAvancer = !!PROCHAIN_STATUT[item.statut];
        return (
          <View style={styles.carte}>
            <Text style={styles.nom}>{item.prenom} {item.nom}</Text>
            <Text style={styles.telephone}>{item.telephone || ''}</Text>
            <View style={styles.ligneMontant}>
              <Text style={styles.montant}>{Number(item.montant_total).toLocaleString('fr-FR')} F CFA</Text>
              <View style={styles.badge}><Text style={styles.badgeTexte}>{LIBELLES[item.statut] || item.statut}</Text></View>
            </View>
            {peutAvancer && (
              <TouchableOpacity style={styles.bouton} onPress={() => avancerStatut(item)}>
                <Text style={styles.boutonTexte}>Marquer comme "{LIBELLES[PROCHAIN_STATUT[item.statut]]}"</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  message: { textAlign: 'center', color: COLORS.gris, marginTop: 40 },
  carte: { backgroundColor: 'white', borderRadius: 12, padding: 12, marginBottom: 10 },
  nom: { fontWeight: '700', fontSize: 14 },
  telephone: { color: COLORS.gris, fontSize: 12 },
  ligneMontant: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },
  montant: { fontWeight: '700', color: COLORS.rouge },
  badge: { backgroundColor: COLORS.creme, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTexte: { fontSize: 11 },
  bouton: { borderWidth: 1.5, borderColor: COLORS.noir, borderRadius: 10, padding: 10, alignItems: 'center' },
  boutonTexte: { fontSize: 13, fontWeight: '600' },
});
