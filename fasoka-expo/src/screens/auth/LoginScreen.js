import React, { useState, useRef, useEffect, forwardRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable, ActivityIndicator, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Animated, Easing, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { ApiClient, ApiException } from '../../api/apiClient';
import HeroCarousel from '../../components/auth/HeroCarousel';
import BoutonGoogle from '../../components/auth/BoutonGoogle';

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
  const { connexion, inscription, connexionGoogle } = useAuth();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const deuxColonnes = width >= LARGEUR_DEUX_COLONNES;

  const [mode, setMode] = useState(modeInitial); // 'connexion' | 'inscription' | 'oubli'
  const [etapeOubli, setEtapeOubli] = useState(1); // 1 : saisir son email, 2 : saisir le code reçu et le nouveau mot de passe
  const [identifiant, setIdentifiant] = useState('');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [code, setCode] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [info, setInfo] = useState(null);

  const refNom = useRef(null);
  const refEmail = useRef(null);
  const refMotDePasse = useRef(null);

  const estConnexion = mode === 'connexion';
  const estOubli = mode === 'oubli';

  function changerMode(nouveauMode) {
    if (nouveauMode === mode) return;
    // Si le visiteur a déjà tapé son email, on le reporte dans l'autre formulaire
    if (nouveauMode === 'inscription' && !email && identifiant.includes('@')) setEmail(identifiant.trim());
    if (nouveauMode === 'connexion' && !identifiant && email) setIdentifiant(email.trim());
    setMotDePasse('');
    setCode('');
    setErreur(null);
    setInfo(null);
    setEtapeOubli(1);
    setMode(nouveauMode);
  }

  function ouvrirOubli() {
    if (!email && identifiant.includes('@')) setEmail(identifiant.trim());
    setMotDePasse('');
    setCode('');
    setErreur(null);
    setInfo(null);
    setEtapeOubli(1);
    setMode('oubli');
  }

  function messageErreur(e, defaut) {
    return e instanceof ApiException ? e.message : defaut;
  }

  // Mot de passe oublié : étape 1 (envoi du code par email), étape 2 (code + nouveau mot de passe)
  async function validerOubli() {
    const adresse = email.trim();
    if (!EMAIL_REGEX.test(adresse)) {
      setErreur("Saisissez l'adresse email de votre compte.");
      return;
    }
    if (etapeOubli === 2) {
      if (!/^\d{6}$/.test(code.trim())) {
        setErreur('Saisissez le code à 6 chiffres reçu par email.');
        return;
      }
      if (motDePasse.length < 8) {
        setErreur('Le mot de passe doit contenir au moins 8 caractères.');
        return;
      }
    }

    setChargement(true);
    try {
      if (etapeOubli === 1) {
        await ApiClient.post('/auth/forgot-password', { email: adresse });
        setCode('');
        setMotDePasse('');
        setEtapeOubli(2);
      } else {
        await ApiClient.post('/auth/reset-password', {
          email: adresse,
          code: code.trim(),
          nouveau_mot_de_passe: motDePasse,
        });
        // Retour à la connexion, avec l'email déjà rempli
        setIdentifiant(adresse);
        setMotDePasse('');
        setCode('');
        setEtapeOubli(1);
        setMode('connexion');
        setInfo('Mot de passe modifié. Vous pouvez maintenant vous connecter.');
      }
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de contacter le serveur. Vérifiez votre connexion internet.'));
    } finally {
      setChargement(false);
    }
  }

  async function renvoyerCode() {
    if (chargement) return;
    setErreur(null);
    setInfo(null);
    setChargement(true);
    try {
      await ApiClient.post('/auth/forgot-password', { email: email.trim() });
      setInfo("Si un compte existe avec cette adresse, un nouveau code vient d'être envoyé.");
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de contacter le serveur. Vérifiez votre connexion internet.'));
    } finally {
      setChargement(false);
    }
  }

  // Connexion / inscription avec Google : le bouton officiel nous remet un jeton, vérifié ensuite par notre serveur
  async function connecterGoogle(credential) {
    if (chargement) return;
    setErreur(null);
    setInfo(null);
    setChargement(true);
    try {
      await connexionGoogle(credential);
      // La navigation racine bascule automatiquement une fois `user` défini (voir App.js)
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de se connecter avec Google. Vérifiez votre connexion internet.'));
    } finally {
      setChargement(false);
    }
  }

  async function valider() {
    if (chargement) return;
    setErreur(null);
    setInfo(null);

    if (estOubli) {
      await validerOubli();
      return;
    }

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
        messageErreur(
          e,
          estConnexion
            ? 'Impossible de se connecter. Vérifiez votre connexion internet.'
            : 'Impossible de créer le compte. Vérifiez votre connexion internet.'
        )
      );
    } finally {
      setChargement(false);
    }
  }

  const titre = estOubli ? 'Mot de passe oublié' : estConnexion ? 'Content de vous revoir' : 'Créez votre compte';
  const sousTitre = estOubli
    ? etapeOubli === 1
      ? "Saisissez l'email de votre compte : nous vous enverrons un code pour choisir un nouveau mot de passe."
      : `Si un compte existe avec ${email.trim()}, un code à 6 chiffres vient de lui être envoyé (pensez à vérifier vos spams). Il est valable 10 minutes.`
    : estConnexion
      ? 'Connectez-vous pour acheter et vendre sur FASOKA.'
      : 'Rejoignez FASOKA : achetez et vendez en quelques minutes.';
  const libelleBouton = estOubli
    ? etapeOubli === 1 ? 'Envoyer le code' : 'Modifier mon mot de passe'
    : estConnexion ? 'Se connecter' : 'Créer mon compte';

  const formulaire = (
    <View style={styles.formulaire}>
      {estOubli ? (
        <TouchableOpacity onPress={() => changerMode('connexion')} style={styles.retour}>
          <Ionicons name="arrow-back" size={18} color={COLORS.noir} />
          <Text style={styles.retourTexte}>Retour à la connexion</Text>
        </TouchableOpacity>
      ) : (
        <Onglets mode={mode} onChange={changerMode} />
      )}

      <Text style={styles.titreForm}>{titre}</Text>
      <Text style={styles.sousTitreForm}>{sousTitre}</Text>

      {!estOubli && Platform.OS === 'web' ? (
        <>
          <BoutonGoogle onCredential={connecterGoogle} />
          <View style={styles.separateur}>
            <View style={styles.separateurTrait} />
            <Text style={styles.separateurTexte}>ou avec votre email</Text>
            <View style={styles.separateurTrait} />
          </View>
        </>
      ) : null}

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
          <TouchableOpacity onPress={ouvrirOubli} style={styles.lienOubli}>
            <Text style={styles.lienOubliTexte}>Mot de passe oublié ?</Text>
          </TouchableOpacity>
        </>
      ) : estOubli ? (
        etapeOubli === 1 ? (
          <>
            <Text style={styles.etiquette}>Email</Text>
            <Champ
              icone="mail-outline"
              placeholder="vous@exemple.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="go"
              onSubmitEditing={valider}
            />
          </>
        ) : (
          <>
            <Text style={styles.etiquette}>Code reçu par email</Text>
            <Champ
              icone="keypad-outline"
              placeholder="6 chiffres"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType="next"
              onSubmitEditing={() => refMotDePasse.current && refMotDePasse.current.focus()}
            />
            <Text style={styles.etiquette}>Nouveau mot de passe</Text>
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
        )
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

      {info ? (
        <View style={styles.infoBloc} accessibilityLiveRegion="polite">
          <Ionicons name="checkmark-circle" size={18} color="#2E7D32" style={{ marginRight: 8 }} />
          <Text style={styles.infoTexte}>{info}</Text>
        </View>
      ) : null}

      {erreur ? (
        <View style={styles.erreurBloc} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={18} color={COLORS.rouge} style={{ marginRight: 8 }} />
          <Text style={styles.erreurTexte}>{erreur}</Text>
        </View>
      ) : null}

              {estOubli && etapeOubli === 2 ? (
        <View style={styles.astuceBloc}>
          <Ionicons name="mail-unread-outline" size={18} color={COLORS.orFonce} style={{ marginRight: 8 }} />
          <Text style={styles.astuceTexte}>
            Rien reçu ? Regardez dans vos courriers indésirables (spam), puis utilisez « Renvoyer le code ».
          </Text>
        </View>
      ) : null}
        
      <TouchableOpacity style={[styles.bouton, chargement && { opacity: 0.7 }]} onPress={valider} disabled={chargement} activeOpacity={0.85}>
        {chargement ? (
          <ActivityIndicator color={COLORS.noir} />
        ) : (
          <>
            <Text style={styles.boutonTexte}>{libelleBouton}</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.noir} style={{ marginLeft: 8 }} />
          </>
        )}
      </TouchableOpacity>

      {estOubli && etapeOubli === 2 ? (
        <View style={styles.liensEtape}>
          <TouchableOpacity onPress={renvoyerCode} disabled={chargement}>
            <Text style={styles.basculeLien}>Renvoyer le code</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setErreur(null);
              setInfo(null);
              setEtapeOubli(1);
            }}
          >
            <Text style={styles.basculeLien}>Changer d'adresse email</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {!estOubli ? (
        <TouchableOpacity onPress={() => changerMode(estConnexion ? 'inscription' : 'connexion')} style={styles.bascule}>
          <Text style={styles.basculeTexte}>
            {estConnexion ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
            <Text style={styles.basculeLien}>{estConnexion ? 'Créer un compte' : 'Se connecter'}</Text>
          </Text>
        </TouchableOpacity>
      ) : null}
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

  retour: { flexDirection: 'row', alignItems: 'center', marginBottom: 22, paddingVertical: 4 },
  retourTexte: { fontSize: 14, fontWeight: '700', color: COLORS.noir, marginLeft: 8 },
  lienOubli: { alignSelf: 'flex-end', marginTop: -6, marginBottom: 6, paddingVertical: 4 },
  lienOubliTexte: { fontSize: 13, fontWeight: '700', color: COLORS.orFonce },
  liensEtape: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  infoBloc: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  infoTexte: { flex: 1, color: '#1B5E20', fontSize: 13, lineHeight: 18 },
    astuceBloc: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF6DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  astuceTexte: { flex: 1, color: COLORS.noir, fontSize: 13, lineHeight: 18 },

  separateur: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 18 },
  separateurTrait: { flex: 1, height: 1, backgroundColor: '#E6E2D8' },
  separateurTexte: { marginHorizontal: 12, fontSize: 12.5, color: COLORS.gris },
});
