import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../theme/colors';
import { ApiClient, ApiException } from '../../api/apiClient';
import useActualisation from '../../hooks/useActualisation';
import { useMessagerie } from '../../context/MessagerieContext';
import Avatar from './Avatar';
import { heureCourte, libelleJour, jourDe } from './formatage';

const LONGUEUR_MAX = 2000;
const HAUTEUR_SAISIE_MIN = 40;
const HAUTEUR_SAISIE_MAX = 120;

// Les messages enregistrés ont un numéro (nombre) ; ceux en cours d'envoi ont un identifiant temporaire (texte).
function trier(liste) {
  const enregistres = liste.filter((m) => typeof m.id === 'number').sort((a, b) => a.id - b.id);
  const enAttente = liste.filter((m) => typeof m.id !== 'number');
  return [...enregistres, ...enAttente];
}

// Ajoute les messages reçus qu'on n'a pas encore (jamais de doublon)
function fusionner(existants, recus) {
  const connus = new Set(existants.filter((m) => typeof m.id === 'number').map((m) => m.id));
  const nouveaux = recus.filter((m) => !connus.has(m.id));
  return nouveaux.length === 0 ? existants : trier([...existants, ...nouveaux]);
}

// Une discussion : messages, saisie et envoi.
// `cote` : 'client' ou 'boutique' (de quel côté de la conversation on se trouve).
// `conversation` : { id, titre, avatar }. `brouillon` : texte pré-rempli dans la zone de saisie (non envoyé).
// `actif` : vrai quand l'écran est affiché ; les nouveaux messages sont récupérés toutes les 4 secondes.
export default function ChatConversation({ conversation, cote, onRetour, brouillon = '', actif = true }) {
  const insets = useSafeAreaInsets();
  const { rafraichirNonLus } = useMessagerie();

  const [messages, setMessages] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [plus, setPlus] = useState(false); // vrai s'il existe des messages plus anciens
  const [chargementPlus, setChargementPlus] = useState(false);
  const [texte, setTexte] = useState(brouillon);
  const [hauteurSaisie, setHauteurSaisie] = useState(HAUTEUR_SAISIE_MIN);

  const liste = useRef(null);
  const suivreFin = useRef(true); // vrai tant que la personne lit le bas de la discussion : on suit les nouveaux messages
  const dernierId = useRef(0);

  const chemin = `/messagerie/conversations/${conversation.id}/messages`;

  // Numéro du dernier message enregistré : sert à ne demander au serveur que les nouveautés
  useEffect(() => {
    const enregistres = messages.filter((m) => typeof m.id === 'number');
    dernierId.current = enregistres.length > 0 ? enregistres[enregistres.length - 1].id : 0;
  }, [messages]);

  const messageErreur = (e) =>
    e instanceof ApiException ? e.message : 'Connexion instable. Nous réessayons automatiquement.';

  const chargerDerniers = useCallback(async () => {
    try {
      const donnees = await ApiClient.get(chemin, { cote });
      setMessages((prec) => fusionner(prec, donnees.messages));
      setPlus(donnees.il_y_en_a_plus);
      setErreur(null);
      rafraichirNonLus();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setChargement(false);
    }
  }, [chemin, cote, rafraichirNonLus]);

  // Appelé à l'ouverture, puis toutes les 4 secondes
  const actualiser = useCallback(async () => {
    const apres = dernierId.current;
    if (!apres) {
      await chargerDerniers();
      return;
    }
    try {
      const donnees = await ApiClient.get(chemin, { cote, apres: String(apres) });
      if (donnees.messages.length > 0) {
        setMessages((prec) => fusionner(prec, donnees.messages));
        if (donnees.messages.some((m) => !m.est_moi)) rafraichirNonLus();
      }
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, [chemin, cote, chargerDerniers, rafraichirNonLus]);

  useActualisation(actualiser, 4000, actif);

  async function chargerAnciens() {
    const premier = messages.find((m) => typeof m.id === 'number');
    if (!premier || chargementPlus) return;
    setChargementPlus(true);
    suivreFin.current = false;
    try {
      const donnees = await ApiClient.get(chemin, { cote, avant: String(premier.id) });
      setMessages((prec) => fusionner(prec, donnees.messages));
      setPlus(donnees.il_y_en_a_plus);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setChargementPlus(false);
    }
  }

  // Envoi « optimiste » : le message apparaît tout de suite, puis est confirmé par le serveur.
  // En cas d'échec il reste affiché avec « Non envoyé » : toucher le message pour réessayer.
  async function envoyer(contenuBrut, idExistant) {
    const contenu = String(contenuBrut).trim();
    if (!contenu) return;
    const idTemporaire = idExistant || 'tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    suivreFin.current = true;
    setMessages((prec) => [
      ...prec.filter((m) => m.id !== idTemporaire),
      { id: idTemporaire, expediteur: cote, contenu, est_moi: true, created_at: new Date().toISOString(), envoi: true },
    ]);
    try {
      const enregistre = await ApiClient.post(chemin, { cote, contenu });
      setMessages((prec) => fusionner(prec.filter((m) => m.id !== idTemporaire), [enregistre]));
    } catch (e) {
      setMessages((prec) =>
        prec.map((m) =>
          m.id === idTemporaire
            ? { ...m, envoi: false, echec: true, messageEchec: e instanceof ApiException ? e.message : "L'envoi a échoué." }
            : m
        )
      );
    }
  }

  function surEnvoi() {
    if (!texte.trim()) return;
    const aEnvoyer = texte;
    setTexte('');
    setHauteurSaisie(HAUTEUR_SAISIE_MIN);
    envoyer(aEnvoyer);
  }

  // Ordinateur : Entrée envoie le message, Maj + Entrée passe à la ligne
  function surTouche(e) {
    if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
      e.preventDefault();
      surEnvoi();
    }
  }

  // Messages + séparateurs de jour
  const lignes = useMemo(() => {
    const resultat = [];
    let jourPrecedent = '';
    messages.forEach((m) => {
      const jour = jourDe(m.created_at);
      if (jour !== jourPrecedent) {
        resultat.push({ type: 'jour', cle: 'jour-' + jour, label: libelleJour(m.created_at) });
        jourPrecedent = jour;
      }
      resultat.push({ type: 'message', cle: 'message-' + m.id, m });
    });
    return resultat;
  }, [messages]);

  function ligne({ item }) {
    if (item.type === 'jour') {
      return (
        <View style={styles.jourZone}>
          <Text style={styles.jourTexte}>{item.label}</Text>
        </View>
      );
    }
    const m = item.m;
    return (
      <View style={[styles.ligneMessage, m.est_moi ? styles.alignDroite : styles.alignGauche]}>
        <TouchableOpacity
          activeOpacity={m.echec ? 0.7 : 1}
          disabled={!m.echec}
          onPress={() => envoyer(m.contenu, m.id)}
          style={[
            styles.bulle,
            m.est_moi ? styles.bulleMoi : styles.bulleAutre,
            m.envoi && { opacity: 0.6 },
            m.echec && styles.bulleEchec,
          ]}
        >
          <Text selectable style={styles.texteMessage}>{m.contenu}</Text>
          <Text style={styles.heureMessage}>{m.echec ? 'Non envoyé' : m.envoi ? 'Envoi…' : heureCourte(m.created_at)}</Text>
        </TouchableOpacity>
        {m.echec ? <Text style={styles.erreurMessage}>{m.messageEchec} Touchez le message pour réessayer.</Text> : null}
      </View>
    );
  }

  const peutEnvoyer = texte.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}
    >
      <View style={styles.entete}>
        <TouchableOpacity
          onPress={onRetour}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.boutonRetour}
          accessibilityRole="button"
          accessibilityLabel="Retour à la liste des discussions"
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.noir} />
        </TouchableOpacity>
        <Avatar uri={conversation.avatar} nom={conversation.titre} taille={36} />
        <Text numberOfLines={1} style={styles.enteteTitre}>{conversation.titre}</Text>
      </View>

      {erreur ? (
        <View style={styles.bandeauErreur}>
          <Text style={styles.bandeauErreurTexte}>{erreur}</Text>
        </View>
      ) : null}

      {chargement ? (
        <View style={styles.centre}>
          <ActivityIndicator color={COLORS.or} />
        </View>
      ) : (
        <FlatList
          ref={liste}
          data={lignes}
          keyExtractor={(item) => item.cle}
          renderItem={ligne}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 12, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={100}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            suivreFin.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < 120;
          }}
          onContentSizeChange={() => {
            if (suivreFin.current && liste.current) liste.current.scrollToEnd({ animated: false });
          }}
          ListHeaderComponent={
            plus ? (
              <TouchableOpacity onPress={chargerAnciens} disabled={chargementPlus} style={styles.boutonPlus}>
                {chargementPlus ? (
                  <ActivityIndicator size="small" color={COLORS.gris} />
                ) : (
                  <Text style={styles.boutonPlusTexte}>Voir les messages précédents</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centre}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color={COLORS.gris} />
              <Text style={styles.videTexte}>
                {cote === 'client'
                  ? `Écrivez votre premier message à ${conversation.titre}.`
                  : `Répondez à ${conversation.titre}.`}
              </Text>
            </View>
          }
        />
      )}

      <View style={styles.barreSaisie}>
        <TextInput
          style={[styles.saisie, { height: hauteurSaisie }, Platform.OS === 'web' && { outlineStyle: 'none' }]}
          value={texte}
          onChangeText={setTexte}
          placeholder="Écrivez votre message…"
          placeholderTextColor={COLORS.gris}
          multiline
          maxLength={LONGUEUR_MAX}
          onContentSizeChange={(e) =>
            setHauteurSaisie(
              Math.min(HAUTEUR_SAISIE_MAX, Math.max(HAUTEUR_SAISIE_MIN, Math.ceil(e.nativeEvent.contentSize.height) + 14))
            )
          }
          onKeyPress={surTouche}
          accessibilityLabel="Votre message"
        />
        <TouchableOpacity
          onPress={surEnvoi}
          disabled={!peutEnvoyer}
          style={[styles.boutonEnvoi, !peutEnvoyer && { opacity: 0.4 }]}
          accessibilityRole="button"
          accessibilityLabel="Envoyer le message"
        >
          <Ionicons name="send" size={18} color={COLORS.noir} />
        </TouchableOpacity>
      </View>
      {texte.length > LONGUEUR_MAX - 200 ? (
        <Text style={styles.compteur}>{texte.length} / {LONGUEUR_MAX}</Text>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.creme },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  videTexte: { fontSize: 14, color: COLORS.gris, marginTop: 10, textAlign: 'center', lineHeight: 20, maxWidth: 300 },

  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: COLORS.blanc,
    borderBottomWidth: 1,
    borderBottomColor: '#ECE9E2',
  },
  boutonRetour: { paddingHorizontal: 4 },
  enteteTitre: { flex: 1, marginLeft: 10, fontSize: 16, fontWeight: '800', color: COLORS.noir },

  bandeauErreur: { backgroundColor: '#FDECEA', paddingVertical: 6, paddingHorizontal: 12 },
  bandeauErreurTexte: { color: COLORS.rouge, fontSize: 12.5 },

  boutonPlus: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 14, marginBottom: 8 },
  boutonPlusTexte: { color: COLORS.orFonce, fontWeight: '700', fontSize: 13 },

  jourZone: { alignItems: 'center', marginVertical: 10 },
  jourTexte: {
    fontSize: 11.5,
    color: COLORS.gris,
    backgroundColor: '#E9E5DB',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
  },

  ligneMessage: { marginVertical: 3, maxWidth: '100%' },
  alignDroite: { alignItems: 'flex-end' },
  alignGauche: { alignItems: 'flex-start' },
  bulle: { maxWidth: '82%', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 5, borderRadius: 16 },
  bulleMoi: { backgroundColor: COLORS.or, borderBottomRightRadius: 4 },
  bulleAutre: { backgroundColor: COLORS.blanc, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#ECE9E2' },
  bulleEchec: { borderWidth: 1.5, borderColor: COLORS.rouge },
  texteMessage: { fontSize: 15, lineHeight: 21, color: COLORS.noir },
  heureMessage: { fontSize: 10.5, color: 'rgba(0,0,0,0.5)', marginTop: 2, alignSelf: 'flex-end' },
  erreurMessage: { fontSize: 11.5, color: COLORS.rouge, marginTop: 3, maxWidth: '82%', textAlign: 'right' },

  barreSaisie: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.blanc,
    borderTopWidth: 1,
    borderTopColor: '#ECE9E2',
  },
  saisie: {
    flex: 1,
    backgroundColor: COLORS.creme,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: COLORS.noir,
    textAlignVertical: 'top',
  },
  boutonEnvoi: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginLeft: 8,
    backgroundColor: COLORS.or,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compteur: { textAlign: 'right', fontSize: 11, color: COLORS.gris, paddingRight: 14, paddingBottom: 4, backgroundColor: COLORS.blanc },
});
