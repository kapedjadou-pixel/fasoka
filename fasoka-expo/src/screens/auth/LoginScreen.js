import React, { useState, useRef, useEffect, forwardRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable, ActivityIndicator, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Animated, Easing, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { ApiException } from '../../api/apiClient';
import HeroCarousel from '../../components/auth/HeroCarousel';

const NATIF = Platform.OS !== 'web';
const LARGEUR_DEUX_COLONNES = 900; // à partir de cette largeur : images animées à gauche, formulaire à droite
const HAUTEUR_HERO_TELEPHONE = 364;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Champ de saisie avec icône à gauche, et bouton « afficher / masquer » pour les mots de passe
const Champ = forwardRef(function Champ({ icone, secure, style, ...reste }, ref) {
  const [focus, setFocus] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.champ, focus && styles.champFocus, style]}>
      <Ionicons name={icone} size={18} color={focus ? COLORS.orFonce : COLORS.gris} style={{ marginRight: 10 }} />
      <TextInput
        ref={ref}
        style={[styles.champInput, Platform.OS === 'web' && { outlineStyle: 'none' }]}
        placeholderTextColor={COLORS.gris}
        secureTextEntry={secure && !visible}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        {...reste}
      />
      {secure ? (
        <TouchableOpacity
          onPress={() => setVisible((v) => !v)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.gris} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

// Sélecteur « Connexion | Inscription » avec une pastille qui glisse d'un côté à l'autre
function Onglets({ mode, onChange }) {
  const [largeur, setLargeur] = useState(0);
  const position = useRef(new Animated.Value(mode === 'connexion' ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(position, {
      toValue: mode === 'connexion' ? 0 : 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIF,
    }).start();
  }, [mode]);

  const moitie = largeur / 2;

  return (
    <View style={styles.onglets} onLayout={(e) => setLargeur(e.nativeEvent.layout.width - 8)}>
      <Animated.View
        style={[
          styles.pastille,
          {
            width: moitie,
            transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, moitie] }) }],
          },
        ]}
      />
      <Pressable style={styles.onglet} onPress={() => onChange('connexion')} accessibilityRole="tab">
        <Text style={[styles.ongletTexte, mode === 'connexion' && styles.ongletTexteActif]}>Connexion</Text>
      </Pressable>
      <Pressable style={styles.onglet} onPress={() => onChange('inscription')} accessibilityRole="tab">
        <Text style={[styles.ongletTexte, mode === 'inscription' && styles.ongletTexteActif]}>Inscription</Text>
      </Pressable>
    </View>
  );
}

// `modeInitial` : 'connexion' (par défaut) ou 'inscription'
export default function LoginScreen({ modeInitial = 'connexion' }) {
  const { connexion, inscription } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const deuxColonnes = width >= LARGEUR_DEUX_COLONNES;

  const [mode, setMode] = useState(modeInitial);
  const [identifiant, setIdentifiant] = useState('');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);

  const refNom = useRef(null);
  const refEmail = useRef(null);
  const refMotDePasse = useRef(null);

  const estConnexion = mode === 'connexion';

  function changerMode(nouveauMode) {
    if (nouveauMode === mode) return;
    // Si le visiteur a déjà tapé son email, on le reporte dans l'autre formulaire
    if (nouveauMode === 'inscription' && !email && identifiant.includes('@')) setEmail(identifiant.trim());
    if (nouveauMode === 'connexion' && !identifiant && email) setIdentifiant(email.trim());
    setMotDePasse('');
    setErreur(null);
    setMode(nouveauMode);
  }

  async function valider() {
    if (chargement) return;
    setErreur(null);

    if (estConnexion) {
      if (!identifiant.trim() || !motDePasse) {
        setErreur('Saisissez votre email (ou téléphone) et votre mot de passe.');
        return;
      }
    } else {
      if (!prenom.trim() || !nom.trim() || !email.trim() || !motDePasse) {
        setErreur('Tous les champs sont obligatoires.');
        return;
      }
      if (!EMAIL_REGEX.test(email.trim())) {
        setErreur("Cette adresse email n'est pas valide.");
        return;
      }
      if (motDePasse.length < 8) {
        setErreur('Le mot de passe doit contenir au moins 8 caractères.');
        return;
      }
    }

    setChargement(true);
    try {
      if (estConnexion) {
        await connexion({ identifiant: identifiant.trim(), motDePasse });
      } else {
        await inscription({ nom: nom.trim(), prenom: prenom.trim(), email: email.trim(), motDePasse });
      }
      // La navigation racine bascule automatiquement une fois `user` défini (voir App.js)
    } catch (e) {
      setErreur(
        e instanceof ApiException
          ? e.message
          : estConnexion
            ? 'Impossible de se connecter. Vérifiez votre connexion internet.'
            : 'Impossible de créer le compte. Vérifiez votre connexion internet.'
      );
    } finally {
      setChargement(false);
    }
  }

  const formulaire = (
    <View style={styles.formulaire}>
      <Onglets mode={mode} onChange={changerMode} />

      <Text style={styles.titreForm}>{estConnexion ? 'Content de vous revoir' : 'Créez votre compte'}</Text>
      <Text style={styles.sousTitreForm}>
        {estConnexion
          ? 'Connectez-vous pour acheter et vendre sur FASOKA.'
          : 'Rejoignez FASOKA : achetez et vendez en quelques minutes.'}
      </Text>

      {estConnexion ? (
        <>
          <Text style={styles.etiquette}>Email ou téléphone</Text>
          <Champ
            icone="person-outline"
            placeholder="vous@exemple.com"
            value={identifiant}
            onChangeText={setIdentifiant}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => refMotDePasse.current && refMotDePasse.current.focus()}
          />
          <Text style={styles.etiquette}>Mot de passe</Text>
          <Champ
            ref={refMotDePasse}
            icone="lock-closed-outline"
            placeholder="Votre mot de passe"
            value={motDePasse}
            onChangeText={setMotDePasse}
            secure
            returnKeyType="go"
            onSubmitEditing={valider}
          />
        </>
      ) : (
        <>
          <View style={styles.ligneDeux}>
            <View style={{ flex: 1 }}>
              <Text style={styles.etiquette}>Prénom</Text>
              <Champ
                icone="person-outline"
                placeholder="Prénom"
                value={prenom}
                onChangeText={setPrenom}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => refNom.current && refNom.current.focus()}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.etiquette}>Nom</Text>
              <Champ
                ref={refNom}
                icone="person-outline"
                placeholder="Nom"
                value={nom}
                onChangeText={setNom}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => refEmail.current && refEmail.current.focus()}
              />
            </View>
          </View>
          <Text style={styles.etiquette}>Email</Text>
          <Champ
            ref={refEmail}
            icone="mail-outline"
            placeholder="vous@exemple.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => refMotDePasse.current && refMotDePasse.current.focus()}
          />
          <Text style={styles.etiquette}>Mot de passe</Text>
          <Champ
            ref={refMotDePasse}
            icone="lock-closed-outline"
            placeholder="8 caractères minimum"
            value={motDePasse}
            onChangeText={setMotDePasse}
            secure
            returnKeyType="go"
            onSubmitEditing={valider}
          />
        </>
      )}

      {erreur ? (
        <View style={styles.erreurBloc} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={18} color={COLORS.rouge} style={{ marginRight: 8 }} />
          <Text style={styles.erreurTexte}>{erreur}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={[styles.bouton, chargement && { opacity: 0.7 }]} onPress={valider} disabled={chargement} activeOpacity={0.85}>
        {chargement ? (
          <ActivityIndicator color={COLORS.noir} />
        ) : (
          <>
            <Text style={styles.boutonTexte}>{estConnexion ? 'Se connecter' : 'Créer mon compte'}</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.noir} style={{ marginLeft: 8 }} />
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => changerMode(estConnexion ? 'inscription' : 'connexion')} style={styles.bascule}>
        <Text style={styles.basculeTexte}>
          {estConnexion ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
          <Text style={styles.basculeLien}>{estConnexion ? 'Créer un compte' : 'Se connecter'}</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (deuxColonnes) {
    return (
      <View style={styles.pageDeuxColonnes}>
        <View style={{ flex: 1.1 }}>
          <HeroCarousel />
        </View>
        <ScrollView
          style={styles.panneau}
          contentContainerStyle={styles.panneauContenu}
          keyboardShouldPersistTaps="handled"
        >
          {formulaire}
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: COLORS.noir }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={{ height: HAUTEUR_HERO_TELEPHONE + insets.top }}>
          <HeroCarousel compact hautDecalage={insets.top} />
        </View>
        <View style={styles.feuille}>{formulaire}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pageDeuxColonnes: { flex: 1, flexDirection: 'row', backgroundColor: COLORS.noir },
  panneau: { flex: 1, backgroundColor: COLORS.blanc },
  panneauContenu: { flexGrow: 1, justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 40 },
  feuille: {
    flexGrow: 1,
    backgroundColor: COLORS.blanc,
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 32,
  },
  formulaire: { width: '100%', maxWidth: 420, alignSelf: 'center' },

  onglets: {
    flexDirection: 'row',
    backgroundColor: COLORS.creme,
    borderRadius: 14,
    padding: 4,
    marginBottom: 22,
  },
  pastille: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: 11,
    backgroundColor: COLORS.or,
  },
  onglet: { flex: 1, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  ongletTexte: { fontSize: 14, fontWeight: '700', color: COLORS.gris },
  ongletTexteActif: { color: COLORS.noir },

  titreForm: { fontSize: 24, fontWeight: '800', color: COLORS.noir },
  sousTitreForm: { fontSize: 13.5, color: COLORS.gris, marginTop: 4, marginBottom: 18, lineHeight: 19 },

  ligneDeux: { flexDirection: 'row', gap: 10 },
  etiquette: { fontSize: 12.5, fontWeight: '700', color: COLORS.noir, marginBottom: 6 },
  champ: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.creme,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  champFocus: { borderColor: COLORS.or, backgroundColor: COLORS.blanc },
  champInput: { flex: 1, paddingVertical: 13, fontSize: 15, color: COLORS.noir },

  erreurBloc: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDECEA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  erreurTexte: { flex: 1, color: COLORS.rouge, fontSize: 13, lineHeight: 18 },

  bouton: {
    flexDirection: 'row',
    backgroundColor: COLORS.or,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  boutonTexte: { color: COLORS.noir, fontWeight: '800', fontSize: 16 },

  bascule: { marginTop: 18, alignItems: 'center', paddingVertical: 4 },
  basculeTexte: { fontSize: 13.5, color: COLORS.gris },
  basculeLien: { color: COLORS.orFonce, fontWeight: '700' },
});
