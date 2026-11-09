import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { ApiClient, ApiException } from '../../api/apiClient';
import { useSpace } from '../../context/SpaceContext';
import { CATEGORIES_SUGGEREES } from '../../config/categories';

// « Gérer la boutique » : nom, description, catégorie, ville et adresse. Ouvert depuis le tableau de bord.
export default function MaBoutiqueScreen({ onRetour }) {
  const { maBoutique, setMaBoutique } = useSpace();
  const [chargement, setChargement] = useState(true);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [categorie, setCategorie] = useState('');
  const [ville, setVille] = useState('');
  const [adresse, setAdresse] = useState('');
  const [boutique, setBoutique] = useState(null);
  const [message, setMessage] = useState(null); // { type: 'erreur' | 'succes', texte }
  const [enregistrement, setEnregistrement] = useState(false);

  useEffect(() => {
    let annule = false;
    ApiClient.get(`/shops/${maBoutique.id}`)
      .then((b) => {
        if (annule) return;
        setBoutique(b);
        setNom(b.nom_boutique || '');
        setDescription(b.description || '');
        setCategorie(b.categorie || '');
        setVille(b.ville || '');
        setAdresse(b.adresse || '');
      })
      .catch((e) => {
        if (!annule) setMessage({ type: 'erreur', texte: e instanceof ApiException ? e.message : 'Impossible de charger la boutique.' });
      })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [maBoutique.id]);

  async function enregistrer() {
    setMessage(null);
    if (!nom.trim()) return setMessage({ type: 'erreur', texte: 'Le nom de la boutique est obligatoire.' });
    if (!ville.trim()) return setMessage({ type: 'erreur', texte: 'La ville est obligatoire.' });

    setEnregistrement(true);
    try {
      const maj = await ApiClient.patch(`/shops/${maBoutique.id}`, {
        nom_boutique: nom.trim(),
        description: description.trim(),
        categorie: categorie.trim(),
        ville: ville.trim(),
        adresse: adresse.trim(),
      });
      setBoutique(maj);
      setMaBoutique({ ...maBoutique, ...maj }); // le nom affiché partout dans l'application est mis à jour
      setMessage({ type: 'succes', texte: 'Modifications enregistrées.' });
    } catch (e) {
      setMessage({ type: 'erreur', texte: e instanceof ApiException ? e.message : "Impossible d'enregistrer les modifications." });
    } finally {
      setEnregistrement(false);
    }
  }

  const categories = categorie && !CATEGORIES_SUGGEREES.includes(categorie) ? [categorie, ...CATEGORIES_SUGGEREES] : CATEGORIES_SUGGEREES;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.creme }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={onRetour} style={styles.retour} accessibilityRole="button" accessibilityLabel="Retour au tableau de bord">
        <Ionicons name="chevron-back" size={20} color={COLORS.noir} />
        <Text style={styles.retourTexte}>Tableau de bord</Text>
      </TouchableOpacity>
      <Text style={styles.titre}>Ma boutique</Text>

      {chargement ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={COLORS.or} />
      ) : (
        <>
          {message ? (
            <View style={[styles.message, message.type === 'succes' ? styles.messageSucces : styles.messageErreur]} accessibilityLiveRegion="polite">
              <Ionicons
                name={message.type === 'succes' ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={message.type === 'succes' ? '#15803D' : COLORS.rouge}
                style={{ marginRight: 8 }}
              />
              <Text style={{ flex: 1, fontSize: 13, color: message.type === 'succes' ? '#15803D' : COLORS.rouge }}>{message.texte}</Text>
            </View>
          ) : null}

          {boutique ? (
            <View style={styles.infos}>
              <View style={styles.infoLigne}>
                <Text style={styles.infoLibelle}>Formule</Text>
                <Text style={styles.infoValeur}>{boutique.plan === 'pro' ? 'Fasoka Pro' : 'Gratuit'}</Text>
              </View>
              <View style={styles.infoLigne}>
                <Text style={styles.infoLibelle}>Badge « boutique vérifiée »</Text>
                <Text style={styles.infoValeur}>{boutique.badge_verifie ? 'Oui' : 'Non'}</Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.etiquette}>Nom de la boutique *</Text>
          <TextInput style={styles.champ} value={nom} onChangeText={setNom} maxLength={150} placeholder="Nom de votre boutique" placeholderTextColor={COLORS.gris} />

          <Text style={styles.etiquette}>Description</Text>
          <TextInput
            style={[styles.champ, { minHeight: 100 }]}
            value={description}
            onChangeText={setDescription}
            maxLength={2000}
            multiline
            textAlignVertical="top"
            placeholder="Présentez votre boutique, vos produits et vos conditions de vente."
            placeholderTextColor={COLORS.gris}
          />

          <Text style={styles.etiquette}>Catégorie</Text>
          <TextInput style={styles.champ} value={categorie} onChangeText={setCategorie} maxLength={100} placeholder="Choisissez ci-dessous ou écrivez la vôtre" placeholderTextColor={COLORS.gris} />
          <View style={styles.puces}>
            {categories.map((c) => (
              <TouchableOpacity key={c} style={[styles.puce, categorie === c && styles.puceActive]} onPress={() => setCategorie(categorie === c ? '' : c)} accessibilityRole="button">
                <Text style={[styles.puceTexte, categorie === c && { fontWeight: '700' }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.etiquette}>Ville *</Text>
          <TextInput style={styles.champ} value={ville} onChangeText={setVille} maxLength={100} placeholder="Ex : Lomé" placeholderTextColor={COLORS.gris} />

          <Text style={styles.etiquette}>Adresse</Text>
          <TextInput style={styles.champ} value={adresse} onChangeText={setAdresse} maxLength={300} placeholder="Quartier, rue, repère" placeholderTextColor={COLORS.gris} />

          <TouchableOpacity style={[styles.bouton, enregistrement && { opacity: 0.7 }]} onPress={enregistrer} disabled={enregistrement} accessibilityRole="button">
            {enregistrement ? <ActivityIndicator color={COLORS.noir} /> : <Text style={styles.boutonTexte}>Enregistrer</Text>}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },
  retour: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6 },
  retourTexte: { fontSize: 14, fontWeight: '700', color: COLORS.noir },
  titre: { fontSize: 22, fontWeight: '900', color: COLORS.noir, marginTop: 4, marginBottom: 12 },
  message: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 12, marginBottom: 12 },
  messageErreur: { backgroundColor: '#FDECEA' },
  messageSucces: { backgroundColor: '#E8F5E9' },
  infos: { backgroundColor: COLORS.blanc, borderRadius: 12, paddingHorizontal: 14, marginBottom: 6 },
  infoLigne: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F3F0E9' },
  infoLibelle: { fontSize: 13.5, color: COLORS.gris },
  infoValeur: { fontSize: 13.5, fontWeight: '700', color: COLORS.noir },
  etiquette: { fontSize: 12.5, fontWeight: '700', color: COLORS.noir, marginTop: 14, marginBottom: 6 },
  champ: { backgroundColor: COLORS.blanc, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14.5, color: COLORS.noir },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  puce: { backgroundColor: COLORS.blanc, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#E6E2D8' },
  puceActive: { backgroundColor: COLORS.or, borderColor: COLORS.or },
  puceTexte: { fontSize: 12.5, color: COLORS.noir },
  bouton: { backgroundColor: COLORS.or, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 24 },
  boutonTexte: { fontWeight: '800', fontSize: 15.5, color: COLORS.noir },
});
