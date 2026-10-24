import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { ApiClient, ApiException } from '../../api/apiClient';

export default function EditProfileScreen({ onRetour }) {
  const { user, mettreAJourUtilisateur } = useAuth();
  const [prenom, setPrenom] = useState(user && user.prenom ? user.prenom : '');
  const [nom, setNom] = useState(user && user.nom ? user.nom : '');
  const [telephone, setTelephone] = useState(user && user.telephone ? user.telephone : '');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(false);

  async function enregistrer() {
    setSucces(false);
    if (!prenom.trim() || !nom.trim()) {
      setErreur('Le prénom et le nom sont obligatoires.');
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      const maj = await ApiClient.patch('/account/profile', {
        prenom: prenom.trim(),
        nom: nom.trim(),
        telephone: telephone.trim(),
      });
      await mettreAJourUtilisateur(maj);
      setSucces(true);
    } catch (e) {
      setErreur(e instanceof ApiException ? e.message : 'Impossible de joindre le serveur. Vérifie ta connexion.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: COLORS.creme }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity onPress={onRetour} style={styles.retour}>
        <Ionicons name="chevron-back" size={18} color={COLORS.rouge} />
        <Text style={styles.retourTexte}>Retour</Text>
      </TouchableOpacity>
      <Text style={styles.titre}>Modifier mon profil</Text>

      <Text style={styles.label}>Prénom</Text>
      <TextInput style={styles.input} value={prenom} onChangeText={setPrenom} />

      <Text style={styles.label}>Nom</Text>
      <TextInput style={styles.input} value={nom} onChangeText={setNom} />

      <Text style={styles.label}>Téléphone</Text>
      <TextInput
        style={styles.input}
        value={telephone}
        onChangeText={setTelephone}
        keyboardType="phone-pad"
        placeholder="Ex : +228 90 00 00 00"
        placeholderTextColor={COLORS.gris}
      />

      <Text style={styles.label}>Email de connexion</Text>
      <View style={[styles.input, styles.inputLectureSeule]}>
        <Text style={{ color: COLORS.gris }}>{user && user.email ? user.email : 'Aucun email'}</Text>
      </View>
      <Text style={styles.aide}>
        Pour modifier ton email ou ton mot de passe, va dans « Sécurité » : un code de confirmation te sera envoyé.
      </Text>

      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
      {succes ? (
        <View style={styles.ligneSucces}>
          <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
          <Text style={styles.succes}>Profil mis à jour</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.bouton} onPress={enregistrer} disabled={envoi}>
        {envoi ? <ActivityIndicator color={COLORS.noir} /> : <Text style={styles.boutonTexte}>Enregistrer</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, width: '100%', maxWidth: 520, alignSelf: 'center' },
  retour: { paddingVertical: 6, marginBottom: 6, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center' },
  retourTexte: { fontSize: 15, color: COLORS.rouge, fontWeight: '600' },
  titre: { fontSize: 20, fontWeight: '800', marginBottom: 16, color: COLORS.noir },
  label: { fontSize: 12, color: COLORS.gris, marginBottom: 4, marginTop: 10 },
  input: { backgroundColor: 'white', borderRadius: 12, padding: 14, fontSize: 14 },
  inputLectureSeule: { backgroundColor: '#ECEAE4' },
  aide: { fontSize: 12, color: COLORS.gris, marginTop: 8 },
  erreur: { color: COLORS.rouge, marginTop: 14 },
  ligneSucces: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  succes: { color: '#16A34A', fontWeight: '600', marginLeft: 6 },
  bouton: { backgroundColor: COLORS.or, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 20 },
  boutonTexte: { color: COLORS.noir, fontWeight: '700', fontSize: 15 },
});
