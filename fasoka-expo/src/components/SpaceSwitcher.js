import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useSpace } from '../context/SpaceContext';

/**
 * Bouton d'en-tête permettant de basculer entre l'espace client et l'espace boutique.
 * `onSelectClient` et `onSelectBoutique` sont fournis par l'écran parent pour piloter la navigation racine.
 */
export default function SpaceSwitcher({ onSelectClient, onSelectBoutique }) {
  const { aUneBoutique } = useSpace();
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <TouchableOpacity onPress={() => setOuvert(true)} style={{ paddingHorizontal: 8 }}>
        <Ionicons name="swap-horizontal" size={24} color={COLORS.or} />
      </TouchableOpacity>

      <Modal visible={ouvert} transparent animationType="fade" onRequestClose={() => setOuvert(false)}>
        <TouchableOpacity style={styles.fond} activeOpacity={1} onPress={() => setOuvert(false)}>
          <View style={styles.menu}>
            <TouchableOpacity style={styles.option} onPress={() => { setOuvert(false); onSelectClient(); }}>
              <Ionicons name="person-outline" size={18} color={COLORS.noir} />
              <Text style={styles.optionTexte}>Espace Client</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.option} onPress={() => { setOuvert(false); onSelectBoutique(); }}>
              <Ionicons name={aUneBoutique ? 'storefront-outline' : 'add-circle-outline'} size={18} color={COLORS.noir} />
              <Text style={styles.optionTexte}>{aUneBoutique ? 'Espace Boutique' : 'Créer ma boutique'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 60, paddingRight: 12 },
  menu: { backgroundColor: 'white', borderRadius: 10, overflow: 'hidden', minWidth: 190 },
  option: { paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', alignItems: 'center' },
  optionTexte: { fontSize: 14, color: COLORS.noir, marginLeft: 10 },
});
