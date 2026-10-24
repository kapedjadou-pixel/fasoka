import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../../theme/colors';
import { ApiClient, ApiException } from '../../api/apiClient';
import { useSpace } from '../../context/SpaceContext';

export default function ShopCreationScreen({ onCree }) {
  const { setMaBoutique } = useSpace();
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function creerBoutique() {
    if (!nom.trim()) {
      setErreur('Le nom de la boutique est obligatoire.');
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      const shop = await ApiClient.post('/shops', { nom_boutique: nom.trim(), description: description.trim() });
      setMaBoutique(shop);
      onCree && onCree();
    } catch (e) {
      setErreur(e instanceof ApiException ? e.message : 'Impossible de créer la boutique.');
    } finally {
      setChargement(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titre}>Créer ma boutique</Text>
      <Text style={styles.sousTitre}>Donne un nom à ta boutique pour commencer à vendre sur Fasoka.</Text>

      <TextInput style={styles.input} placeholder="Nom de la boutique *" value={nom} onChangeText={setNom} />
      <TextInput
        style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
        placeholder="Description (optionnel)"
        value={description}
        onChangeText={setDescription}
        multiline
      />

      {erreur && <Text style={styles.erreur}>{erreur}</Text>}

      <TouchableOpacity style={styles.bouton} onPress={creerBoutique} disabled={chargement}>
        {chargement ? <ActivityIndicator color={COLORS.noir} /> : <Text style={styles.boutonTexte}>Créer ma boutique</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', padding: 24, justifyContent: 'center' },
  titre: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  sousTitre: { color: COLORS.gris, fontSize: 13, marginBottom: 20 },
  input: { backgroundColor: COLORS.creme, borderRadius: 12, padding: 14, fontSize: 14, marginBottom: 12 },
  erreur: { color: COLORS.rouge, marginBottom: 8 },
  bouton: { backgroundColor: COLORS.or, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  boutonTexte: { color: COLORS.noir, fontWeight: '700', fontSize: 15 },
});
