import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { ApiException } from '../../api/apiClient';

export default function SignupScreen() {
  const { inscription } = useAuth();
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function creerCompte() {
    if (!nom || !prenom || !email || !motDePasse) {
      setErreur('Tous les champs sont obligatoires.');
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      await inscription({ nom: nom.trim(), prenom: prenom.trim(), email: email.trim(), motDePasse });
    } catch (e) {
      setErreur(e instanceof ApiException ? e.message : 'Impossible de créer le compte.');
    } finally {
      setChargement(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TextInput style={styles.input} placeholder="Prénom" value={prenom} onChangeText={setPrenom} />
      <TextInput style={styles.input} placeholder="Nom" value={nom} onChangeText={setNom} />
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Mot de passe" value={motDePasse} onChangeText={setMotDePasse} secureTextEntry />

      {erreur && <Text style={styles.erreur}>{erreur}</Text>}

      <TouchableOpacity style={styles.bouton} onPress={creerCompte} disabled={chargement}>
        {chargement ? <ActivityIndicator color={COLORS.noir} /> : <Text style={styles.boutonTexte}>Créer mon compte</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: 'white', flexGrow: 1, justifyContent: 'center' },
  input: { backgroundColor: COLORS.creme, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12 },
  erreur: { color: COLORS.rouge, marginBottom: 8 },
  bouton: { backgroundColor: COLORS.or, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  boutonTexte: { color: COLORS.noir, fontWeight: '700', fontSize: 16 },
});
