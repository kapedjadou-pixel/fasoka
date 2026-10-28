import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { ApiException } from '../../api/apiClient';
import CaseConditions from '../../components/auth/CaseConditions';

const LOGO = require('../../../assets/logo.png');
const LOGO_RATIO = 247 / 237; // largeur / hauteur du logo

// Écran affiché aux personnes déjà inscrites qui n'ont pas encore accepté la politique de confidentialité
// et les conditions d'utilisation : elles doivent les accepter pour continuer à utiliser FASOKA.
export default function ConditionsScreen() {
  const { user, accepterConditions, deconnexion } = useAuth();
  const insets = useSafeAreaInsets();
  const [accepte, setAccepte] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function continuer() {
    if (chargement) return;
    if (!accepte) {
      setErreur('Cochez la case pour accepter la politique de confidentialité et les conditions d\'utilisation.');
      return;
    }
    setErreur(null);
    setChargement(true);
    try {
      await accepterConditions();
      // L'écran disparaît tout seul : l'utilisateur est mis à jour et App.js affiche l'application
    } catch (e) {
      setErreur(e instanceof ApiException ? e.message : 'Impossible de contacter le serveur. Vérifiez votre connexion internet.');
      setChargement(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.creme }}
      contentContainerStyle={[styles.page, { paddingTop: 24 + insets.top, paddingBottom: 24 + insets.bottom }]}
    >
      <View style={styles.carte}>
        <View style={styles.entete}>
          <Image source={LOGO} style={{ height: 40, width: 40 * LOGO_RATIO }} resizeMode="contain" />
          <Text style={styles.marque}>FASOKA</Text>
        </View>

        <Text style={styles.titre}>Avant de continuer</Text>
        <Text style={styles.texte}>
          {user && user.prenom ? `${user.prenom}, pour` : 'Pour'} continuer à utiliser FASOKA, merci de lire et d'accepter notre
          politique de confidentialité et nos conditions d'utilisation.
        </Text>

        <CaseConditions accepte={accepte} onChange={setAccepte} />

        {erreur ? (
          <View style={styles.erreurBloc} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={18} color={COLORS.rouge} style={{ marginRight: 8 }} />
            <Text style={styles.erreurTexte}>{erreur}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.bouton, (!accepte || chargement) && { opacity: 0.6 }]}
          onPress={continuer}
          disabled={chargement}
          activeOpacity={0.85}
        >
          {chargement ? (
            <ActivityIndicator color={COLORS.noir} />
          ) : (
            <>
              <Text style={styles.boutonTexte}>Continuer</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.noir} style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={deconnexion} style={styles.deconnexion}>
          <Text style={styles.deconnexionTexte}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  carte: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: COLORS.blanc,
    borderRadius: 16,
    padding: 24,
  },
  entete: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  marque: { fontSize: 20, fontWeight: '900', letterSpacing: 2, color: COLORS.noir, marginLeft: 10 },
  titre: { fontSize: 22, fontWeight: '800', color: COLORS.noir, marginBottom: 8 },
  texte: { fontSize: 14, lineHeight: 21, color: COLORS.noir, marginBottom: 18 },
  erreurBloc: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDECEA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  erreurTexte: { flex: 1, color: COLORS.rouge, fontSize: 13, lineHeight: 18 },
  bouton: {
    flexDirection: 'row',
    backgroundColor: COLORS.or,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  boutonTexte: { color: COLORS.noir, fontWeight: '800', fontSize: 16 },
  deconnexion: { marginTop: 16, alignItems: 'center', paddingVertical: 4 },
  deconnexionTexte: { fontSize: 13.5, color: COLORS.gris, fontWeight: '600' },
});
