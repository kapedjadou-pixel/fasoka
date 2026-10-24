import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, Image,
  ActivityIndicator, StyleSheet, Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { ApiClient, ApiException } from '../../api/apiClient';
import { useSpace } from '../../context/SpaceContext';

export default function CatalogScreen({ navigation }) {
  const { maBoutique } = useSpace();
  const [produits, setProduits] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [modalOuvert, setModalOuvert] = useState(false);

  const charger = useCallback(async () => {
    if (!maBoutique) return;
    try {
      const data = await ApiClient.get(`/products/shop/${maBoutique.id}`);
      setProduits(data);
    } catch (e) {
      // silencieux
    } finally {
      setChargement(false);
    }
  }, [maBoutique]);

  useEffect(() => { charger(); }, [charger]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.creme }}>
      {chargement ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.or} />
      ) : produits.length === 0 ? (
        <Text style={styles.message}>Aucun produit. Ajoute ton premier article !</Text>
      ) : (
        <FlatList
          data={produits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.ligne}
              onPress={() => navigation.navigate('ProductGallery', { productId: item.id, productNom: item.nom })}
            >
              <View style={styles.miniature}>
                {item.images && item.images.length > 0 ? (
                  <Image source={{ uri: item.images[0] }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Ionicons name="image-outline" size={20} color={COLORS.gris} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nom}>{item.nom}</Text>
                <Text style={styles.detail}>{Number(item.prix).toLocaleString('fr-FR')} F CFA · Stock: {item.stock_quantite}</Text>
              </View>
              {item.stock_quantite <= 5 && <Ionicons name="warning" size={18} color={COLORS.rouge} />}
              <Ionicons name="chevron-forward" size={18} color={COLORS.gris} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setModalOuvert(true)}>
        <Ionicons name="add" size={28} color={COLORS.noir} />
      </TouchableOpacity>

      <FormulaireAjoutProduit
        visible={modalOuvert}
        shopId={maBoutique?.id}
        onFermer={() => setModalOuvert(false)}
        onCree={() => { setModalOuvert(false); charger(); }}
      />
    </View>
  );
}

function FormulaireAjoutProduit({ visible, shopId, onFermer, onCree }) {
  const [nom, setNom] = useState('');
  const [prix, setPrix] = useState('');
  const [stock, setStock] = useState('');
  const [photo, setPhoto] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function choisirPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const resultat = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true });
    if (!resultat.canceled) setPhoto(resultat.assets[0]);
  }

  async function soumettre() {
    if (!nom.trim() || !prix) {
      setErreur('Le nom et le prix sont obligatoires.');
      return;
    }
    setEnvoiEnCours(true);
    setErreur(null);
    try {
      const produitCree = await ApiClient.post(`/products/shop/${shopId}`, {
        nom: nom.trim(), prix: Number(prix), stock_quantite: Number(stock) || 0,
      });
      if (photo) {
        await ApiClient.uploadImage(`/products/${produitCree.id}/images`, photo);
      }
      setNom(''); setPrix(''); setStock(''); setPhoto(null);
      onCree();
    } catch (e) {
      setErreur(e instanceof ApiException ? e.message : 'Une erreur est survenue.');
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onFermer}>
      <View style={styles.modalFond}>
        <View style={styles.modalContenu}>
          <View style={styles.modalEntete}>
            <Text style={{ fontWeight: '700', fontSize: 16 }}>Nouveau produit</Text>
            <TouchableOpacity onPress={onFermer}><Ionicons name="close" size={24} color={COLORS.noir} /></TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.zonePhoto} onPress={choisirPhoto}>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Ionicons name="camera-outline" size={28} color={COLORS.gris} />
                <Text style={{ color: COLORS.gris, marginTop: 4 }}>Ajouter une photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <TextInput style={styles.input} placeholder="Nom du produit" value={nom} onChangeText={setNom} />
          <TextInput style={styles.input} placeholder="Prix (F CFA)" value={prix} onChangeText={setPrix} keyboardType="numeric" />
          <TextInput style={styles.input} placeholder="Quantité en stock" value={stock} onChangeText={setStock} keyboardType="numeric" />

          {erreur && <Text style={{ color: COLORS.rouge, marginBottom: 8 }}>{erreur}</Text>}

          <TouchableOpacity style={styles.bouton} onPress={soumettre} disabled={envoiEnCours}>
            {envoiEnCours ? <ActivityIndicator color={COLORS.noir} /> : <Text style={styles.boutonTexte}>Ajouter</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  message: { textAlign: 'center', color: COLORS.gris, marginTop: 40 },
  ligne: { backgroundColor: 'white', borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  miniature: { width: 44, height: 44, borderRadius: 8, backgroundColor: COLORS.creme, alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' },
  nom: { fontWeight: '600', fontSize: 14 },
  detail: { fontSize: 12, color: COLORS.gris },
  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: COLORS.or, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  modalFond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContenu: { backgroundColor: 'white', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalEntete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  zonePhoto: { height: 140, borderRadius: 12, backgroundColor: COLORS.creme, alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden' },
  input: { backgroundColor: COLORS.creme, borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 10 },
  bouton: { backgroundColor: COLORS.or, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 6 },
  boutonTexte: { color: COLORS.noir, fontWeight: '700' },
});
