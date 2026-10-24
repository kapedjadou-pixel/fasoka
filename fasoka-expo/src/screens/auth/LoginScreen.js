import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { ApiException } from '../../api/apiClient';

export default function LoginScreen({ navigation }) {
  const { connexion } = useAuth();
  const [identifiant, setIdentifiant] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function seConnecter() {
    setChargement(true);
    setErreur(null);
    try {
      await connexion({ identifiant: identifiant.trim(), motDePasse });
      // La navigation racine bascule automatiquement une fois `user` défini (voir App.js)
    } catch (e) {
      setErreur(e instanceof ApiException ? e.message : 'Impossible de se connecter. Vérifie ta connexion internet.');
    } finally {
      setChargement(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titre}>FASOKA</Text>
      <Text style={styles.sousTitre}>Vendez et achetez, simplement.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email ou téléphone"
        placeholderTextColor={COLORS.gris}
        value={identifiant}
        onChangeText={setIdentifiant}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor={COLORS.gris}
        value={motDePasse}
        onChangeText={setMotDePasse}
        secureTextEntry
      />

      {erreur && <Text style={styles.erreur}>{erreur}</Text>}

      <TouchableOpacity style={styles.bouton} onPress={seConnecter} disabled={chargement}>
        {chargement ? <ActivityIndicator color={COLORS.noir} /> : <Text style={styles.boutonTexte}>Se connecter</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
        <Text style={styles.lien}>Pas de compte ? Créer un compte</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.noir, padding: 24, justifyContent: 'center' },
  titre: { color: COLORS.or, fontSize: 38, fontWeight: '900', textAlign: 'center', letterSpacing: 2 },
  sousTitre: { color: '#ffffffaa', fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 40 },
  input: { backgroundColor: 'white', borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12 },
  erreur: { color: COLORS.rouge, marginBottom: 8 },
  bouton: { backgroundColor: COLORS.or, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  boutonTexte: { color: COLORS.noir, fontWeight: '700', fontSize: 16 },
  lien: { color: COLORS.or, textAlign: 'center', marginTop: 18 },
});
