import React from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

// Fenêtre de confirmation qui fonctionne partout (téléphone et site web : Alert.alert n'affiche rien sur le web).
export default function ModaleConfirmation({
  visible, titre, message, libelleConfirmer = 'Confirmer', destructif = false, enCours = false, onConfirmer, onAnnuler,
}) {
  return (
    <Modal visible={Boolean(visible)} transparent animationType="fade" onRequestClose={onAnnuler}>
      <View style={styles.fond}>
        <View style={styles.boite}>
          <Text style={styles.titre}>{titre}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.boutons}>
            <TouchableOpacity style={[styles.bouton, styles.boutonAnnuler]} onPress={onAnnuler} disabled={enCours} accessibilityRole="button">
              <Text style={styles.annulerTexte}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bouton, destructif ? styles.boutonDestructif : styles.boutonConfirmer, enCours && { opacity: 0.7 }]}
              onPress={onConfirmer}
              disabled={enCours}
              accessibilityRole="button"
            >
              {enCours ? (
                <ActivityIndicator color={destructif ? COLORS.blanc : COLORS.noir} />
              ) : (
                <Text style={destructif ? styles.destructifTexte : styles.confirmerTexte}>{libelleConfirmer}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  boite: { width: '100%', maxWidth: 400, backgroundColor: COLORS.blanc, borderRadius: 16, padding: 20 },
  titre: { fontSize: 17, fontWeight: '800', color: COLORS.noir },
  message: { fontSize: 14, lineHeight: 20, color: COLORS.noir, marginTop: 8 },
  boutons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 10 },
  bouton: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10, minWidth: 96, alignItems: 'center' },
  boutonAnnuler: { backgroundColor: COLORS.creme },
  annulerTexte: { color: COLORS.noir, fontWeight: '700' },
  boutonConfirmer: { backgroundColor: COLORS.or },
  confirmerTexte: { color: COLORS.noir, fontWeight: '800' },
  boutonDestructif: { backgroundColor: COLORS.rouge },
  destructifTexte: { color: COLORS.blanc, fontWeight: '800' },
});
