import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { ApiClient, ApiException } from '../../api/apiClient';

export default function ProductGalleryScreen({ route }) {
  const { productId, productNom } = route.params;
  const [images, setImages] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  const charger = useCallback(async () => {
    try {
      const data = await ApiClient.get(`/products/${productId}`);
      setImages(data.images || []);
    } catch (e) {
      // silencieux
    } finally {
      setChargement(false);
    }
  }, [productId]);

  useEffect(() => { charger(); }, [charger]);

  async function ajouterPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const resultat = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true });
    if (resultat.canceled) return;

    setEnvoiEnCours(true);
    try {
      await ApiClient.uploadImage(`/products/${productId}/images`, resultat.assets[0]);
      await charger();
    } catch (e) {
      Alert.alert('Erreur', e instanceof ApiException ? e.message : 'Impossible d\'envoyer la photo.');
    } finally {
      setEnvoiEnCours(false);
    }
  }

  function confirmerSuppression(image) {
    Alert.alert('Supprimer cette photo ?', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => supprimerPhoto(image) },
    ]);
  }

  async function supprimerPhoto(image) {
    setImages((prev) => prev.filter((i) => i.id !== image.id)); // retrait optimiste
    try {
      await ApiClient.delete(`/products/${productId}/images/${image.id}`);
    } catch (e) {
      charger(); // resynchronise en cas d'échec
    }
  }

  async function deplacer(index, direction) {
    const nouvelIndex = index + direction;
    if (nouvelIndex < 0 || nouvelIndex >= images.length) return;
    const nouvellesImages = [...images];
    [nouvellesImages[index], nouvellesImages[nouvelIndex]] = [nouvellesImages[nouvelIndex], nouvellesImages[index]];
    setImages(nouvellesImages);
    try {
      await ApiClient.patch(`/products/${productId}/images/reorder`, {
        image_ids: nouvellesImages.map((i) => i.id),
      });
    } catch (e) {
      // pas bloquant pour l'utilisateur
    }
  }

  if (chargement) return <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.or} />;

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      {images.length > 0 && (
        <Text style={styles.info}>
          La première photo est celle affichée dans le catalogue. Utilise les flèches pour changer l'ordre.
        </Text>
      )}

      {images.length === 0 ? (
        <Text style={styles.message}>Aucune photo pour ce produit.</Text>
      ) : (
        <FlatList
          data={images}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item, index }) => (
            <View style={styles.ligne}>
              <Image source={{ uri: item.image_url }} style={styles.miniature} />
              <Text style={{ flex: 1, fontSize: 13, fontWeight: '600' }}>
                {index === 0 ? 'Photo principale' : `Photo ${index + 1}`}
              </Text>
              <TouchableOpacity disabled={index === 0} onPress={() => deplacer(index, -1)} style={styles.boutonRond}>
                <Ionicons name="arrow-up" size={16} color={COLORS.noir} style={{ opacity: index === 0 ? 0.3 : 1 }} />
              </TouchableOpacity>
              <TouchableOpacity disabled={index === images.length - 1} onPress={() => deplacer(index, 1)} style={styles.boutonRond}>
                <Ionicons name="arrow-down" size={16} color={COLORS.noir} style={{ opacity: index === images.length - 1 ? 0.3 : 1 }} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmerSuppression(item)} style={styles.boutonRond}>
                <Ionicons name="trash-outline" size={16} color={COLORS.rouge} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={ajouterPhoto} disabled={envoiEnCours}>
        {envoiEnCours ? <ActivityIndicator color={COLORS.noir} /> : <Ionicons name="camera" size={22} color={COLORS.noir} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  info: { fontSize: 12, color: COLORS.gris, padding: 16, paddingBottom: 0 },
  message: { textAlign: 'center', color: COLORS.gris, marginTop: 40 },
  ligne: { backgroundColor: COLORS.creme, borderRadius: 12, padding: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  miniature: { width: 52, height: 52, borderRadius: 8, marginRight: 12 },
  boutonRond: { backgroundColor: 'white', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: COLORS.or, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', elevation: 4 },
});
