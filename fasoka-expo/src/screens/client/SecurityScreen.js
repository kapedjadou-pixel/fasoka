import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { ApiClient, ApiException } from '../../api/apiClient';

const DELAI_RENVOI = 60; // secondes avant de pouvoir redemander un code
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function messageErreur(e) {
  return e instanceof ApiException ? e.message : 'Impossible de joindre le serveur. Vérifie ta connexion.';
}

export default function SecurityScreen({ onRetour }) {
  const { user, mettreAJourUtilisateur } = useAuth();
  const [etape, setEtape] = useState('menu'); // 'menu' | 'formulaire' | 'code' | 'succes'
  const [type, setType] = useState(null); // 'mot_de_passe' | 'email'
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [confirmationMdp, setConfirmationMdp] = useState('');
  const [nouvelEmail, setNouvelEmail] = useState('');
  const [code, setCode] = useState('');
  const [emailMasque, setEmailMasque] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [info, setInfo] = useState(null);
  const [secondesRestantes, setSecondesRestantes] = useState(0);

  // Compte à rebours avant de pouvoir renvoyer un code
  useEffect(() => {
    if (secondesRestantes <= 0) return undefined;
    const minuteur = setTimeout(() => setSecondesRestantes((s) => s - 1), 1000);
    return () => clearTimeout(minuteur);
  }, [secondesRestantes]);

  function ouvrir(typeChoisi) {
    setType(typeChoisi);
    setNouveauMdp('');
    setConfirmationMdp('');
    setNouvelEmail('');
    setCode('');
    setErreur(null);
    setInfo(null);
    setEtape('formulaire');
  }

  function retour() {
    setErreur(null);
    setInfo(null);
    if (etape === 'menu') onRetour();
    else if (etape === 'formulaire') setEtape('menu');
    else if (etape === 'code') setEtape('formulaire');
    else setEtape('menu');
  }

  // Vérifie le formulaire avant d'envoyer la demande
  function verifierFormulaire() {
    if (type === 'mot_de_passe') {
      if (nouveauMdp.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
      if (nouveauMdp !== confirmationMdp) return 'Les deux mots de passe ne sont pas identiques.';
    } else if (!REGEX_EMAIL.test(nouvelEmail.trim())) {
      return 'Adresse email invalide.';
    }
    return null;
  }

  // Demande l'envoi d'un code à l'email ACTUEL du compte
  async function demanderCode(renvoi) {
    const probleme = verifierFormulaire();
    if (probleme) {
      setErreur(probleme);
      return;
    }
    setChargement(true);
    setErreur(null);
    setInfo(null);
    try {
      const corps = type === 'mot_de_passe'
        ? { type, nouveau_mot_de_passe: nouveauMdp }
        : { type, nouvel_email: nouvelEmail.trim() };
      const reponse = await ApiClient.post('/account/security/request', corps);
      setEmailMasque(reponse.email_masque);
      setCode('');
      setEtape('code');
      setSecondesRestantes(DELAI_RENVOI);
      if (renvoi) setInfo("Un nouveau code vient d'être envoyé.");
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setChargement(false);
    }
  }

  async function confirmer() {
    if (code.length !== 6) {
      setErreur('Entre le code à 6 chiffres reçu par email.');
      return;
    }
    setChargement(true);
    setErreur(null);
    setInfo(null);
    try {
      const reponse = await ApiClient.post('/account/security/confirm', { type, code });
      if (type === 'email' && reponse.user) {
        await mettreAJourUtilisateur(reponse.user);
      }
      setNouveauMdp('');
      setConfirmationMdp('');
      setCode('');
      setEtape('succes');
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setChargement(false);
    }
  }

  let titre = 'Sécurité';
  if (etape === 'formulaire') titre = type === 'mot_de_passe' ? 'Changer le mot de passe' : "Changer l'email de connexion";
  if (etape === 'code') titre = 'Confirmation';
  if (etape === 'succes') titre = "C'est fait";

  return (
    <ScrollView
      style={{ backgroundColor: COLORS.creme }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity onPress={retour} style={styles.retour}>
        <Ionicons name="chevron-back" size={18} color={COLORS.rouge} />
        <Text style={styles.retourTexte}>Retour</Text>
      </TouchableOpacity>
      <Text style={styles.titre}>{titre}</Text>

      {etape === 'menu' && (
        <View>
          <View style={styles.liste}>
            <TouchableOpacity style={styles.ligne} onPress={() => ouvrir('mot_de_passe')}>
              <View style={styles.ligneGauche}>
                <Ionicons name="key-outline" size={20} color={COLORS.noir} />
                <Text style={[styles.ligneTexte, { marginLeft: 12 }]}>Changer le mot de passe</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.gris} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.ligne, { borderBottomWidth: 0 }]} onPress={() => ouvrir('email')}>
              <View style={[styles.ligneGauche, { flex: 1 }]}>
                <Ionicons name="mail-outline" size={20} color={COLORS.noir} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.ligneTexte}>Changer l'email de connexion</Text>
                  <Text style={styles.ligneSousTexte}>{user && user.email ? user.email : 'Aucun email'}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.gris} />
            </TouchableOpacity>
          </View>
          <Text style={styles.aide}>
            Pour ta sécurité, chaque modification demande un code de confirmation envoyé à ton email actuel.
          </Text>
        </View>
      )}

      {etape === 'formulaire' && (
        <View>
          {type === 'mot_de_passe' ? (
            <View>
              <Text style={styles.label}>Nouveau mot de passe</Text>
              <TextInput
                style={styles.input}
                value={nouveauMdp}
                onChangeText={setNouveauMdp}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Au moins 8 caractères"
                placeholderTextColor={COLORS.gris}
              />
              <Text style={styles.label}>Confirmer le nouveau mot de passe</Text>
              <TextInput
                style={styles.input}
                value={confirmationMdp}
                onChangeText={setConfirmationMdp}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          ) : (
            <View>
              <Text style={styles.label}>Email actuel</Text>
              <View style={[styles.input, styles.inputLectureSeule]}>
                <Text style={{ color: COLORS.gris }}>{user && user.email ? user.email : 'Aucun email'}</Text>
              </View>
              <Text style={styles.label}>Nouvel email</Text>
              <TextInput
                style={styles.input}
                value={nouvelEmail}
                onChangeText={setNouvelEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="nouvelle.adresse@exemple.com"
                placeholderTextColor={COLORS.gris}
              />
            </View>
          )}

          <Text style={styles.aide}>
            Un code de confirmation sera envoyé à ton email actuel pour vérifier que c'est bien toi.
          </Text>
          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

          <TouchableOpacity style={styles.bouton} onPress={() => demanderCode(false)} disabled={chargement}>
            {chargement ? <ActivityIndicator color={COLORS.noir} /> : <Text style={styles.boutonTexte}>Recevoir le code par email</Text>}
          </TouchableOpacity>
        </View>
      )}

      {etape === 'code' && (
        <View>
          <Text style={styles.texte}>
            Nous avons envoyé un code à 6 chiffres à {emailMasque} (ton email actuel). Il est valable 10 minutes.
            Pense à vérifier tes spams.
          </Text>

          <TextInput
            style={styles.inputCode}
            value={code}
            onChangeText={(t) => setCode(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="______"
            placeholderTextColor={COLORS.gris}
          />

          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
          {info ? <Text style={styles.succes}>{info}</Text> : null}

          <TouchableOpacity style={styles.bouton} onPress={confirmer} disabled={chargement}>
            {chargement ? <ActivityIndicator color={COLORS.noir} /> : <Text style={styles.boutonTexte}>Confirmer</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => demanderCode(true)}
            disabled={chargement || secondesRestantes > 0}
            style={{ marginTop: 16, alignSelf: 'center' }}
          >
            <Text style={[styles.lien, secondesRestantes > 0 && { color: COLORS.gris }]}>
              {secondesRestantes > 0 ? 'Renvoyer le code (' + secondesRestantes + ' s)' : 'Renvoyer le code'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {etape === 'succes' && (
        <View>
          <Ionicons name="checkmark-circle" size={64} color="#16A34A" style={{ alignSelf: 'center', marginBottom: 8 }} />
          <Text style={styles.texte}>
            {type === 'mot_de_passe'
              ? 'Ton mot de passe a été modifié. Utilise-le lors de ta prochaine connexion.'
              : 'Ton email de connexion a été modifié. Tu te connecteras désormais avec ' + (user && user.email ? user.email : 'ta nouvelle adresse') + '.'}
          </Text>
          <TouchableOpacity style={styles.bouton} onPress={onRetour}>
            <Text style={styles.boutonTexte}>Retour au profil</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, width: '100%', maxWidth: 520, alignSelf: 'center' },
  retour: { paddingVertical: 6, marginBottom: 6, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center' },
  retourTexte: { fontSize: 15, color: COLORS.rouge, fontWeight: '600' },
  titre: { fontSize: 20, fontWeight: '800', marginBottom: 16, color: COLORS.noir },
  liste: { backgroundColor: 'white', borderRadius: 12, overflow: 'hidden' },
  ligne: {
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  ligneTexte: { fontSize: 14, color: COLORS.noir },
  ligneSousTexte: { fontSize: 12, color: COLORS.gris, marginTop: 2 },
  ligneGauche: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 12, color: COLORS.gris, marginBottom: 4, marginTop: 10 },
  input: { backgroundColor: 'white', borderRadius: 12, padding: 14, fontSize: 14 },
  inputLectureSeule: { backgroundColor: '#ECEAE4' },
  inputCode: {
    backgroundColor: 'white', borderRadius: 12, padding: 14, fontSize: 26, fontWeight: '700',
    textAlign: 'center', letterSpacing: 10, marginTop: 16,
  },
  aide: { fontSize: 12, color: COLORS.gris, marginTop: 12 },
  texte: { fontSize: 14, color: COLORS.noir, lineHeight: 20 },
  erreur: { color: COLORS.rouge, marginTop: 14 },
  succes: { color: '#16A34A', marginTop: 12, fontWeight: '600' },
  bouton: { backgroundColor: COLORS.or, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 20 },
  boutonTexte: { color: COLORS.noir, fontWeight: '700', fontSize: 15 },
  lien: { color: COLORS.rouge, fontWeight: '600', fontSize: 13 },
});
