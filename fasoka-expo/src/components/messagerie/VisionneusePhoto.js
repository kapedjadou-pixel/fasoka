import React from 'react';
import { Modal, View, Image, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { ouvrirLien } from '../../config/liens';

// Photo affichée en grand, sur fond noir. « Ouvrir l'original » l'ouvre dans le navigateur (pour l'enregistrer).
export default function VisionneusePhoto({ photo, onFermer }) {
  return (
    <Modal visible={Boolean(photo)} transparent animationType="fade" onRequestClose={onFermer}>
      <View style={styles.fond}>
        {photo ? <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="contain" /> : null}
        <TouchableOpacity onPress={onFermer} style={styles.fermer} accessibilityRole="button" accessibilityLabel="Fermer la photo">
          <Ionicons name="close" size={28} color={COLORS.blanc} />
        </TouchableOpacity>
        {photo && photo.original ? (
          <TouchableOpacity onPress={() => ouvrirLien(photo.original)} style={styles.original}>
            <Ionicons name="open-outline" size={16} color={COLORS.blanc} />
            <Text style={styles.originalTexte}>Ouvrir l'original</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '85%' },
  fermer: { position: 'absolute', top: 36, right: 20, padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  original: {
    position: 'absolute',
    bottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  originalTexte: { color: COLORS.blanc, marginLeft: 6, fontSize: 13, fontWeight: '600' },
});
