import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Image, ActivityIndicator, Modal, StyleSheet, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { ApiClient, ApiException } from '../../api/apiClient';
import { useSpace } from '../../context/SpaceContext';
import { CATEGORIES_SUGGEREES } from '../../config/categories';
import ModaleConfirmation from '../../components/ModaleConfirmation';

const MAX_PHOTOS = 8;
const LONGUEUR_DESCRIPTION = 5000;

// Écran « Nouveau produit » (sans productId) et « Modifier le produit » (avec productId) :
// photos (ajouter, remplacer, supprimer, choisir la photo principale), informations, suppression du produit.
// En modification, les photos sont enregistrées tout de suite ; les informations le sont avec « Enregistrer ».
// En création, les photos sont envoyées une fois le produit créé.
export default function ProductEditScreen({ navigation, route }) {
  const { maBoutique } = useSpace();
  const productId = route.params && route.params.productId;
  const avertissement = route.params && route.params.avertissement;
  const modeEdition = Boolean(productId);

  const [chargement, setChargement] = useState(modeEdition);
  const [photos, setPhotos] = useState([]); // modification : { id, image_url } ; création : { cle, uri, asset }
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [categorie, setCategorie] = useState('');
  const [prix, setPrix] = useState('');
  const [stock, setStock] = useState('0');
  const [seuil, setSeuil] = useState('5');
  const [message, setMessage] = useState(avertissement || null);
  const [occupe, setOccupe] = useState(null); // texte affiché pendant un envoi de photos
  const [enregistrement, setEnregistrement] = useState(false);
  const [photoActive, setPhotoActive] = useState(null); // { index, photo } : menu d'actions d'une photo
  const [aSupprimer, setASupprimer] = useState(null); // photo en attente de confirmation
  const [suppressionProduit, setSuppressionProduit] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: modeEdition ? 'Modifier le produit' : 'Nouveau produit' });
  }, [navigation, modeEdition]);

  const charger = useCallback(async () => {
    if (!modeEdition) return;
    try {
      const p = await ApiClient.get(`/products/${productId}`);
      setNom(p.nom || '');
      setDescription(p.description || '');
      setCategorie(p.categorie || '');
      setPrix(String(Number(p.prix)));
      setStock(String(p.stock_quantite ?? 0));
      setSeuil(String(p.stock_alerte_seuil ?? 5));
      setPhotos(p.images || []);
    } catch (e) {
      setMessage(e instanceof ApiException ? e.message : 'Impossible de charger ce produit.');
    } finally {
      setChargement(false);
    }
  }, [modeEdition, productId]);

  useEffect(() => { charger(); }, [charger]);

  async function rechargerPhotos() {
    try {
      const p = await ApiClient.get(`/products/${productId}`);
      setPhotos(p.images || []);
    } catch (e) {
      // la liste sera rechargée au prochain essai
    }
  }

  async function autoriserPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage("Autorisez l'accès aux photos pour choisir une image.");
      return false;
    }
    return true;
  }

  // ----- Photos -----
  async function ajouterPhotos() {
    setMessage(null);
    const restant = MAX_PHOTOS - photos.length;
    if (restant <= 0) {
      setMessage(`Un produit peut avoir ${MAX_PHOTOS} photos au maximum.`);
      return;
    }
    try {
      if (!(await autoriserPhotos())) return;
      const resultat = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: restant,
        quality: 0.8,
      });
      if (resultat.canceled || !resultat.assets || resultat.assets.length === 0) return;
      const choisies = resultat.assets.slice(0, restant);

      if (!modeEdition) {
        setPhotos((prec) => [...prec, ...choisies.map((a) => ({ cle: a.uri + Math.random(), uri: a.uri, asset: a }))]);
        return;
      }
      let echecs = 0;
      for (let i = 0; i < choisies.length; i += 1) {
        setOccupe(`Envoi de la photo ${i + 1} sur ${choisies.length}…`);
        try {
          await ApiClient.uploadImage(`/products/${productId}/images`, choisies[i]);
        } catch (e) {
          echecs += 1;
          setMessage(e instanceof ApiException ? e.message : "Une photo n'a pas pu être envoyée.");
        }
      }
      await rechargerPhotos();
      if (echecs > 0 && echecs === choisies.length) setMessage((m) => m || "Les photos n'ont pas pu être envoyées.");
    } catch (e) {
      setMessage("Impossible d'ouvrir les photos.");
    } finally {
      setOccupe(null);
    }
  }

  async function remplacerPhoto(index, photo) {
    setPhotoActive(null);
    setMessage(null);
    try {
      if (!(await autoriserPhotos())) return;
      const resultat = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (resultat.canceled || !resultat.assets || !resultat.assets[0]) return;
      const asset = resultat.assets[0];

      if (!modeEdition) {
        setPhotos((prec) => prec.map((p, i) => (i === index ? { cle: asset.uri + Math.random(), uri: asset.uri, asset } : p)));
        return;
      }
      setOccupe('Remplacement de la photo…');
      await ApiClient.uploadImage(`/products/${productId}/images/${photo.id}`, asset, 'PUT');
      await rechargerPhotos();
    } catch (e) {
      setMessage(e instanceof ApiException ? e.message : 'Impossible de remplacer la photo.');
    } finally {
      setOccupe(null);
    }
  }

  async function definirPrincipale(index) {
    setPhotoActive(null);
    if (index <= 0) return;
    const nouvelOrdre = [photos[index], ...photos.filter((_, i) => i !== index)];
    setPhotos(nouvelOrdre);
    if (!modeEdition) return;
    try {
      await ApiClient.patch(`/products/${productId}/images/reorder`, { image_ids: nouvelOrdre.map((p) => p.id) });
    } catch (e) {
      setMessage("Impossible de changer la photo principale.");
      rechargerPhotos();
    }
  }

  async function confirmerSuppressionPhoto() {
    const { index, photo } = aSupprimer;
    setASupprimer(null);
    if (!modeEdition) {
      setPhotos((prec) => prec.filter((_, i) => i !== index));
      return;
    }
    setPhotos((prec) => prec.filter((p) => p.id !== photo.id)); // retrait immédiat, resynchronisé en cas d'échec
    try {
      await ApiClient.delete(`/products/${productId}/images/${photo.id}`);
    } catch (e) {
      setMessage('Impossible de supprimer la photo.');
      rechargerPhotos();
    }
  }

  // ----- Informations -----
  function verifier() {
    if (!nom.trim()) return 'Le nom du produit est obligatoire.';
    if (nom.trim().length > 200) return 'Le nom est trop long (200 caractères maximum).';
    const valeurPrix = Number(String(prix).replace(/\s/g, '').replace(',', '.'));
    if (!String(prix).trim() || !Number.isFinite(valeurPrix) || valeurPrix < 0) return 'Saisissez un prix valide (en F CFA).';
    if (!/^\d+$/.test(String(stock).trim() || '0')) return 'Le stock doit être un nombre entier (0 ou plus).';
    if (!/^\d+$/.test(String(seuil).trim() || '0')) return "Le seuil d'alerte doit être un nombre entier (0 ou plus).";
    if (description.length > LONGUEUR_DESCRIPTION) return 'La description est trop longue.';
    return null;
  }

  async function enregistrer() {
    setMessage(null);
    const probleme = verifier();
    if (probleme) {
      setMessage(probleme);
      return;
    }
    const corps = {
      nom: nom.trim(),
      description: description.trim(),
      categorie: categorie.trim(),
      prix: Number(String(prix).replace(/\s/g, '').replace(',', '.')),
      stock_quantite: parseInt(String(stock).trim() || '0', 10),
      stock_alerte_seuil: parseInt(String(seuil).trim() || '0', 10),
    };

    setEnregistrement(true);
    try {
      if (modeEdition) {
        await ApiClient.patch(`/products/${productId}`, corps);
        navigation.goBack();
        return;
      }
      const cree = await ApiClient.post(`/products/shop/${maBoutique.id}`, corps);
      let echecs = 0;
      for (let i = 0; i < photos.length; i += 1) {
        setOccupe(`Envoi de la photo ${i + 1} sur ${photos.length}…`);
        try {
          await ApiClient.uploadImage(`/products/${cree.id}/images`, photos[i].asset);
        } catch (e) {
          echecs += 1;
        }
      }
      if (echecs > 0) {
        navigation.replace('ProductEdit', {
          productId: cree.id,
          avertissement: `Le produit a été créé, mais ${echecs} photo${echecs > 1 ? 's' : ''} n'${echecs > 1 ? 'ont' : 'a'} pas pu être envoyée${echecs > 1 ? 's' : ''}. Ajoutez-les ci-dessous.`,
        });
      } else {
        navigation.goBack();
      }
    } catch (e) {
      setMessage(e instanceof ApiException ? e.message : "Impossible d'enregistrer le produit.");
    } finally {
      setEnregistrement(false);
      setOccupe(null);
    }
  }

  async function supprimerProduit() {
    setSuppressionEnCours(true);
    try {
      await ApiClient.delete(`/products/${productId}`);
      setSuppressionProduit(false);
      navigation.goBack();
    } catch (e) {
      setSuppressionProduit(false);
      setMessage(e instanceof ApiException ? e.message : 'Impossible de supprimer le produit.');
    } finally {
      setSuppressionEnCours(false);
    }
  }

  if (chargement) return <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.or} />;

  const categoriesAffichees = categorie && !CATEGORIES_SUGGEREES.includes(categorie) ? [categorie, ...CATEGORIES_SUGGEREES] : CATEGORIES_SUGGEREES;
  const urlPhoto = (p) => p.image_url || p.uri;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.creme }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {message ? (
        <TouchableOpacity onPress={() => setMessage(null)} style={styles.message} accessibilityLiveRegion="polite">
          <Ionicons name="information-circle" size={18} color={COLORS.rouge} style={{ marginRight: 8 }} />
          <Text style={styles.messageTexte}>{message}</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.titreSection}>Photos ({photos.length}/{MAX_PHOTOS})</Text>
      <Text style={styles.aide}>La première photo est celle qui s'affiche dans la liste des produits. Touchez une photo pour la changer.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
        {photos.map((photo, index) => (
          <TouchableOpacity
            key={photo.id || photo.cle}
            style={styles.tuile}
            onPress={() => setPhotoActive({ index, photo })}
            accessibilityRole="button"
            accessibilityLabel={`Photo ${index + 1}${index === 0 ? ', photo principale' : ''} : modifier`}
          >
            <Image source={{ uri: urlPhoto(photo) }} style={styles.tuileImage} />
            {index === 0 ? (
              <View style={styles.badgePrincipale}><Text style={styles.badgePrincipaleTexte}>Principale</Text></View>
            ) : null}
            <View style={styles.crayon}><Ionicons name="create-outline" size={14} color={COLORS.noir} /></View>
          </TouchableOpacity>
        ))}
        {photos.length < MAX_PHOTOS ? (
          <TouchableOpacity style={[styles.tuile, styles.tuileAjout]} onPress={ajouterPhotos} disabled={Boolean(occupe)} accessibilityRole="button" accessibilityLabel="Ajouter des photos">
            <Ionicons name="add-circle-outline" size={30} color={COLORS.orFonce} />
            <Text style={styles.tuileAjoutTexte}>Ajouter</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
      {occupe ? (
        <View style={styles.occupe}>
          <ActivityIndicator size="small" color={COLORS.noir} />
          <Text style={styles.occupeTexte}>{occupe}</Text>
        </View>
      ) : null}

      <Text style={[styles.titreSection, { marginTop: 18 }]}>Informations</Text>

      <Text style={styles.etiquette}>Nom du produit *</Text>
      <TextInput style={styles.champ} value={nom} onChangeText={setNom} placeholder="Ex : Sac en cuir marron" placeholderTextColor={COLORS.gris} maxLength={200} />

      <Text style={styles.etiquette}>Description</Text>
      <TextInput
        style={[styles.champ, styles.champLong]}
        value={description}
        onChangeText={setDescription}
        placeholder="Matière, taille, couleur, état, conditions de vente… Plus c'est précis, plus les clients ont confiance."
        placeholderTextColor={COLORS.gris}
        multiline
        maxLength={LONGUEUR_DESCRIPTION}
        textAlignVertical="top"
      />
      <Text style={styles.compteur}>{description.length} / {LONGUEUR_DESCRIPTION}</Text>

      <Text style={styles.etiquette}>Catégorie</Text>
      <TextInput style={styles.champ} value={categorie} onChangeText={setCategorie} placeholder="Choisissez ci-dessous ou écrivez la vôtre" placeholderTextColor={COLORS.gris} maxLength={100} />
      <View style={styles.puces}>
        {categoriesAffichees.map((c) => (
          <TouchableOpacity key={c} style={[styles.puce, categorie === c && styles.puceActive]} onPress={() => setCategorie(categorie === c ? '' : c)} accessibilityRole="button">
            <Text style={[styles.puceTexte, categorie === c && { color: COLORS.noir, fontWeight: '700' }]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.ligne3}>
        <View style={{ flex: 1.4 }}>
          <Text style={styles.etiquette}>Prix (F CFA) *</Text>
          <TextInput style={styles.champ} value={prix} onChangeText={setPrix} keyboardType="numeric" placeholder="5000" placeholderTextColor={COLORS.gris} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.etiquette}>Stock</Text>
          <TextInput style={styles.champ} value={stock} onChangeText={setStock} keyboardType="number-pad" placeholder="0" placeholderTextColor={COLORS.gris} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.etiquette}>Alerte à</Text>
          <TextInput style={styles.champ} value={seuil} onChangeText={setSeuil} keyboardType="number-pad" placeholder="5" placeholderTextColor={COLORS.gris} />
        </View>
      </View>
      <Text style={styles.aide}>« Alerte à » : vous êtes prévenu quand le stock descend à ce nombre ou en dessous.</Text>

      <TouchableOpacity style={[styles.boutonEnregistrer, (enregistrement || occupe) && { opacity: 0.7 }]} onPress={enregistrer} disabled={enregistrement || Boolean(occupe)} accessibilityRole="button">
        {enregistrement ? <ActivityIndicator color={COLORS.noir} /> : <Text style={styles.boutonEnregistrerTexte}>{modeEdition ? 'Enregistrer les modifications' : 'Ajouter le produit'}</Text>}
      </TouchableOpacity>

      {modeEdition ? (
        <TouchableOpacity style={styles.boutonSupprimer} onPress={() => setSuppressionProduit(true)} accessibilityRole="button">
          <Ionicons name="trash-outline" size={18} color={COLORS.rouge} />
          <Text style={styles.boutonSupprimerTexte}>Supprimer ce produit</Text>
        </TouchableOpacity>
      ) : null}

      {/* Actions sur une photo */}
      <Modal visible={Boolean(photoActive)} transparent animationType="fade" onRequestClose={() => setPhotoActive(null)}>
        <TouchableOpacity activeOpacity={1} style={styles.fondMenu} onPress={() => setPhotoActive(null)}>
          <View style={styles.menu}>
            {photoActive ? <Image source={{ uri: urlPhoto(photoActive.photo) }} style={styles.menuImage} /> : null}
            {photoActive && photoActive.index > 0 ? (
              <TouchableOpacity style={styles.menuLigne} onPress={() => definirPrincipale(photoActive.index)}>
                <Ionicons name="star-outline" size={20} color={COLORS.noir} />
                <Text style={styles.menuTexte}>Définir comme photo principale</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.menuLigne} onPress={() => remplacerPhoto(photoActive.index, photoActive.photo)}>
              <Ionicons name="swap-horizontal" size={20} color={COLORS.noir} />
              <Text style={styles.menuTexte}>Remplacer par une autre photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuLigne} onPress={() => { setASupprimer(photoActive); setPhotoActive(null); }}>
              <Ionicons name="trash-outline" size={20} color={COLORS.rouge} />
              <Text style={[styles.menuTexte, { color: COLORS.rouge }]}>Supprimer la photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuLigne, { justifyContent: 'center' }]} onPress={() => setPhotoActive(null)}>
              <Text style={[styles.menuTexte, { marginLeft: 0, color: COLORS.gris }]}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ModaleConfirmation
        visible={Boolean(aSupprimer)}
        titre="Supprimer cette photo ?"
        message="Cette action est définitive."
        libelleConfirmer="Supprimer"
        destructif
        onConfirmer={confirmerSuppressionPhoto}
        onAnnuler={() => setASupprimer(null)}
      />
      <ModaleConfirmation
        visible={suppressionProduit}
        titre="Supprimer ce produit ?"
        message={`« ${nom} » ne sera plus visible par les clients. Les commandes déjà passées sont conservées.`}
        libelleConfirmer="Supprimer"
        destructif
        enCours={suppressionEnCours}
        onConfirmer={supprimerProduit}
        onAnnuler={() => setSuppressionProduit(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },
  message: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDECEA', borderRadius: 10, padding: 12, marginBottom: 14 },
  messageTexte: { flex: 1, color: COLORS.rouge, fontSize: 13, lineHeight: 18 },
  titreSection: { fontSize: 16, fontWeight: '800', color: COLORS.noir },
  aide: { fontSize: 12, color: COLORS.gris, marginTop: 3, lineHeight: 17 },

  tuile: { width: 104, height: 104, borderRadius: 12, marginRight: 10, backgroundColor: COLORS.blanc, overflow: 'hidden' },
  tuileImage: { width: '100%', height: '100%' },
  tuileAjout: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.or, backgroundColor: '#FFFBEF' },
  tuileAjoutTexte: { fontSize: 12, fontWeight: '700', color: COLORS.orFonce, marginTop: 2 },
  badgePrincipale: { position: 'absolute', left: 6, top: 6, backgroundColor: COLORS.or, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  badgePrincipaleTexte: { fontSize: 10.5, fontWeight: '800', color: COLORS.noir },
  crayon: { position: 'absolute', right: 6, bottom: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  occupe: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF6DB', borderRadius: 10, padding: 10, marginTop: 4 },
  occupeTexte: { marginLeft: 8, fontSize: 13, color: COLORS.noir },

  etiquette: { fontSize: 12.5, fontWeight: '700', color: COLORS.noir, marginTop: 12, marginBottom: 6 },
  champ: { backgroundColor: COLORS.blanc, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14.5, color: COLORS.noir },
  champLong: { minHeight: 120 },
  compteur: { fontSize: 11, color: COLORS.gris, textAlign: 'right', marginTop: 3 },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  puce: { backgroundColor: COLORS.blanc, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#E6E2D8' },
  puceActive: { backgroundColor: COLORS.or, borderColor: COLORS.or },
  puceTexte: { fontSize: 12.5, color: COLORS.noir },
  ligne3: { flexDirection: 'row', gap: 10 },

  boutonEnregistrer: { backgroundColor: COLORS.or, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 22 },
  boutonEnregistrerTexte: { color: COLORS.noir, fontWeight: '800', fontSize: 15.5 },
  boutonSupprimer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: COLORS.rouge,
    borderRadius: 12, paddingVertical: 13, marginTop: 12,
  },
  boutonSupprimerTexte: { color: COLORS.rouge, fontWeight: '700', marginLeft: 8, fontSize: 14.5 },

  fondMenu: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  menu: { width: '100%', maxWidth: 360, backgroundColor: COLORS.blanc, borderRadius: 16, overflow: 'hidden' },
  menuImage: { width: '100%', height: 200, backgroundColor: COLORS.creme },
  menuLigne: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: '#F0EDE6' },
  menuTexte: { fontSize: 14.5, color: COLORS.noir, marginLeft: 12, fontWeight: '600' },
});
