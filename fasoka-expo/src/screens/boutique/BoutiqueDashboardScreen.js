import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { ApiClient } from '../../api/apiClient';
import { useSpace } from '../../context/SpaceContext';

function Tuile({ label, valeur }) {
  return (
    <View style={styles.tuile}>
      <Text style={styles.tuileValeur}>{valeur}</Text>
      <Text style={styles.tuileLabel}>{label}</Text>
    </View>
  );
}

export default function BoutiqueDashboardScreen() {
  const { maBoutique } = useSpace();
  const [stats, setStats] = useState(null);
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    if (!maBoutique) return;
    try {
      const data = await ApiClient.get(`/shops/${maBoutique.id}/stats`);
      setStats(data);
    } catch (e) {
      // non bloquant
    } finally {
      setChargement(false);
    }
  }, [maBoutique]);

  useEffect(() => { charger(); }, [charger]);

  if (chargement) return <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.or} />;

  return (
    <ScrollView
      style={{ backgroundColor: COLORS.creme }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={charger} />}
    >
      <Text style={styles.nomBoutique}>{maBoutique?.nom_boutique}</Text>
      <Text style={styles.plan}>{maBoutique?.plan === 'pro' ? 'Plan Pro' : 'Plan Gratuit'}</Text>

      <View style={styles.ligne}>
        <Tuile label="Ventes totales" valeur={`${stats?.total_ventes ?? 0} F`} />
        <Tuile label="Commandes en cours" valeur={stats?.commandes_en_cours ?? 0} />
      </View>
      <View style={styles.ligne}>
        <Tuile label="Produits actifs" valeur={stats?.total_produits ?? 0} />
        <Tuile label="Note moyenne" valeur={<>{stats?.note_moyenne ?? '0.0'} <Ionicons name="star" size={16} color={COLORS.or} /></>} />
      </View>

      {maBoutique?.plan !== 'pro' && (
        <View style={styles.promo}>
          <Text style={styles.promoTexte}>Passe à Fasoka Pro pour des produits illimités et plus de visibilité.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  nomBoutique: { fontSize: 22, fontWeight: '700' },
  plan: { color: COLORS.gris, marginBottom: 16 },
  ligne: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  tuile: { flex: 1, backgroundColor: 'white', borderRadius: 12, padding: 14 },
  tuileValeur: { fontSize: 20, fontWeight: '700', marginTop: 8 },
  tuileLabel: { fontSize: 11, color: COLORS.gris },
  promo: { backgroundColor: COLORS.noir, borderRadius: 12, padding: 16, marginTop: 10 },
  promoTexte: { color: 'white', fontSize: 13 },
});
