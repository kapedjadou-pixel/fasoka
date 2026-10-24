import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet,
  ScrollView, Platform, BackHandler,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { ApiClient, ApiException } from '../../api/apiClient';
import EditProfileScreen from './EditProfileScreen';
import SecurityScreen from './SecurityScreen';

// Fait en sorte que le bouton Retour (navigateur ou téléphone) ferme la sous-page ouverte
// au lieu de quitter l'application.
function useRetourEnArriere(actif, surRetour) {
  const entree = useRef(false);
  const surRetourRef = useRef(surRetour);
  surRetourRef.current = surRetour;

  // Web : une entrée d'historique est ajoutée à l'ouverture d'une sous-page
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (actif && !entree.current) {
      window.history.pushState({ fasokaVue: true }, '');
      entree.current = true;
    } else if (!actif && entree.current) {
      // Sous-page fermée par un bouton de l'app : on retire l'entrée d'historique ajoutée
      entree.current = false;
      window.history.back();
    }
  }, [actif]);

  // Web : le bouton Retour du navigateur ferme la sous-page
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const surPopState = () => {
      if (entree.current) {
        entree.current = false;
        surRetourRef.current();
      }
    };
    window.addEventListener('popstate', surPopState);
    return () => window.removeEventListener('popstate', surPopState);
  }, []);

  // Android : le bouton Retour du téléphone ferme la sous-page
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const abonnement = BackHandler.addEventListener('hardwareBackPress', () => {
      if (actif) {
        surRetourRef.current();
        return true;
      }
      return false;
    });
    return () => abonnement.remove();
  }, [actif]);
}

function LigneMenu({ libelle, icone, onPress, derniere }) {
  const contenu = (
    <View style={[styles.ligneListe, derniere && { borderBottomWidth: 0 }]}>
      <View style={styles.ligneGauche}>
        <Ionicons name={icone} size={20} color={COLORS.noir} />
        <Text style={styles.ligneTexte}>{libelle}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={COLORS.gris} /> : null}
    </View>
  );
  return onPress ? <TouchableOpacity onPress={onPress}>{contenu}</TouchableOpacity> : contenu;
}

export default function ProfileScreen() {
  const { user, deconnexion, mettreAJourUtilisateur } = useAuth();
  const [vue, setVue] = useState('accueil'); // 'accueil' | 'modifier' | 'securite'
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const [erreurPhoto, setErreurPhoto] = useState(null);

  useRetourEnArriere(vue !== 'accueil', () => setVue('accueil'));

  async function changerPhoto() {
    setErreurPhoto(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErreurPhoto("Autorise l'accès aux photos pour choisir une image.");
      return;
    }
    const resultat = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8, allowsEditing: true, aspect: [1, 1],
    });
    if (resultat.canceled) return;

    setEnvoiPhoto(true);
    try {
      const maj = await ApiClient.uploadImage('/account/avatar', resultat.assets[0]);
      await mettreAJourUtilisateur(maj);
    } catch (e) {
      setErreurPhoto(e instanceof ApiException ? e.message : "Impossible d'envoyer la photo.");
    } finally {
      setEnvoiPhoto(false);
    }
  }

  async function supprimerPhoto() {
    setErreurPhoto(null);
    setEnvoiPhoto(true);
    try {
      const maj = await ApiClient.delete('/account/avatar');
      await mettreAJourUtilisateur(maj);
    } catch (e) {
      setErreurPhoto(e instanceof ApiException ? e.message : 'Impossible de supprimer la photo.');
    } finally {
      setEnvoiPhoto(false);
    }
  }

  if (vue === 'modifier') return <EditProfileScreen onRetour={() => setVue('accueil')} />;
  if (vue === 'securite') return <SecurityScreen onRetour={() => setVue('accueil')} />;

  const lettre = user && user.prenom ? user.prenom.charAt(0).toUpperCase() : '?';

  return (
    <ScrollView style={{ backgroundColor: COLORS.creme }} contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={changerPhoto} disabled={envoiPhoto} style={styles.avatarZone}>
        {user && user.photo_profil_url ? (
          <Image source={{ uri: user.photo_profil_url }} style={styles.avatarImage} resizeMode="cover" />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarLettre}>{lettre}</Text>
          </View>
        )}
        <View style={styles.badgeCamera}>
          {envoiPhoto ? <ActivityIndicator size="small" color={COLORS.noir} /> : <Ionicons name="camera" size={16} color={COLORS.noir} />}
        </View>
      </TouchableOpacity>

      {erreurPhoto ? <Text style={styles.erreur}>{erreurPhoto}</Text> : null}
      {user && user.photo_profil_url ? (
        <TouchableOpacity onPress={supprimerPhoto} disabled={envoiPhoto}>
          <Text style={styles.lienDiscret}>Supprimer la photo</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.nom}>{user ? user.prenom + ' ' + user.nom : ''}</Text>
      {user && user.email ? <Text style={styles.contact}>{user.email}</Text> : null}
      {user && user.telephone ? <Text style={styles.contact}>{user.telephone}</Text> : null}

      <TouchableOpacity style={styles.boutonModifier} onPress={() => setVue('modifier')}>
        <Ionicons name="create-outline" size={16} color={COLORS.noir} />
        <Text style={styles.boutonModifierTexte}>Modifier mon profil</Text>
      </TouchableOpacity>

      <View style={styles.liste}>
        <LigneMenu libelle="Mes favoris" icone="heart-outline" />
        <LigneMenu libelle="Sécurité" icone="shield-checkmark-outline" onPress={() => setVue('securite')} />
        <LigneMenu libelle="Notifications" icone="notifications-outline" />
        <LigneMenu libelle="Aide" icone="help-circle-outline" derniere />
      </View>

      <TouchableOpacity onPress={deconnexion} style={{ marginTop: 20 }}>
        <Text style={styles.deconnexion}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 24, width: '100%', maxWidth: 520, alignSelf: 'center' },
  avatarZone: { width: 96, height: 96, marginBottom: 10 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.or, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.creme },
  avatarLettre: { fontSize: 38, fontWeight: '700', color: COLORS.noir },
  badgeCamera: {
    position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.or, borderWidth: 2, borderColor: COLORS.creme,
    alignItems: 'center', justifyContent: 'center',
  },
  erreur: { color: COLORS.rouge, fontSize: 12, textAlign: 'center', marginBottom: 6 },
  lienDiscret: { color: COLORS.gris, fontSize: 12, marginBottom: 6, textDecorationLine: 'underline' },
  nom: { fontSize: 18, fontWeight: '700', marginTop: 6 },
  contact: { color: COLORS.gris, fontSize: 13, marginTop: 2 },
  boutonModifier: {
    marginTop: 16, marginBottom: 20, paddingVertical: 10, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.noir, backgroundColor: 'white',
  },
  boutonModifierTexte: { fontSize: 13, fontWeight: '600', color: COLORS.noir, marginLeft: 6 },
  liste: { backgroundColor: 'white', borderRadius: 12, width: '100%', overflow: 'hidden' },
  ligneListe: {
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  ligneGauche: { flexDirection: 'row', alignItems: 'center' },
  ligneTexte: { fontSize: 14, color: COLORS.noir, marginLeft: 12 },
  deconnexion: { color: COLORS.rouge, fontWeight: '600', fontSize: 14 },
});
