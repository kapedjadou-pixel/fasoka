import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../../theme/colors';
import { ApiClient } from '../../api/apiClient';

const STATUTS = {
  en_attente: { label: 'En attente', couleur: '#F59E0B' },
  confirmee: { label: 'Confirmée', couleur: COLORS.or },
  en_preparation: { label: 'En préparation', couleur: COLORS.or },
  prete: { label: 'Prête', couleur: '#3B82F6' },
  livree: { label: 'Livrée', couleur: '#22C55E' },
  annulee: { label: 'Annulée', couleur: COLORS.rouge },
};

export default function HistoryScreen() {
  const [commandes, setCommandes] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    ApiClient.get('/orders/mine')
      .then(setCommandes)
      .catch(() => {})
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.or} />;
  if (commandes.length === 0) {
    return <Text style={styles.message}>Aucune commande pour le moment.</Text>;
  }

  return (
    <FlatList
      style={{ backgroundColor: COLORS.creme }}
      data={commandes}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 12 }}
      renderItem={({ item }) => {
        const statut = STATUTS[item.statut] || { label: item.statut, couleur: COLORS.gris };
        return (
          <View style={styles.ligne}>
            <View>
              <Text style={styles.nom}>{item.nom_boutique}</Text>
              <Text style={styles.detail}>{Number(item.montant_total).toLocaleString('fr-FR')} F CFA</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: statut.couleur }]}>
              <Text style={styles.badgeTexte}>{statut.label}</Text>
            </View>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  message: { textAlign: 'center', color: COLORS.gris, marginTop: 40 },
  ligne: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nom: { fontWeight: '600', fontSize: 14 },
  detail: { fontSize: 12, color: COLORS.gris },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTexte: { color: 'white', fontSize: 11, fontWeight: '700' },
});
