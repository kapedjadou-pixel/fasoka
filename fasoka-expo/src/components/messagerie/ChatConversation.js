import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../theme/colors';
import { ApiClient, ApiException } from '../../api/apiClient';
import useActualisation from '../../hooks/useActualisation';
import useEnregistreurVocal from '../../hooks/useEnregistreurVocal';
import { useMessagerie } from '../../context/MessagerieContext';
import Avatar from './Avatar';
import BulleMessage from './BulleMessage';
import VisionneusePhoto from './VisionneusePhoto';
import { libelleJour, jourDe, libelleVu, dureeLisible } from './formatage';

const LONGUEUR_MAX = 2000;
const TAILLE_MAX_FICHIER = 10 * 1024 * 1024; // 10 Mo, comme sur le serveur
const HAUTEUR_SAISIE_MIN = 40;
const HAUTEUR_SAISIE_MAX = 120;
const VERT_EN_LIGNE = '#1E9E4A';

const TYPES_DOCUMENTS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/rtf',
  'text/plain',
  'text/csv',
];

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

// Coches de mes messages : envoi en cours, échec, envoyé, reçu, lu
function statutDe(m, pointeurs) {
  if (m.echec) return 'echec';
  if (m.envoi) return 'attente';
  if (m.id <= pointeurs.lu) return 'lu';
  if (m.id <= pointeurs.recu) return 'recu';
  return 'envoye';
}

function nomParDefaut(uri, secours) {
  const nom = String(uri || '').split('?')[0].split('/').pop();
  return nom && nom.includes('.') ? nom : secours;
}

// Une discussion : messages, photos, vocaux, documents, coches (envoyé / reçu / lu) et présence (« en ligne »).
// `cote` : 'client' ou 'boutique' (de quel côté de la conversation on se trouve).
// `conversation` : { id, titre, avatar }. `brouillon` : texte pré-rempli dans la zone de saisie (non envoyé).
// `actif` : vrai quand l'écran est affiché ; les nouveautés sont récupérées toutes les 4 secondes.
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
  const [presence, setPresence] = useState(null); // { en_ligne, vu_le } de l'autre côté
  const [pointeurs, setPointeurs] = useState({ lu: 0, recu: 0 }); // jusqu'où l'autre côté a reçu / lu
  const [ecrit, setEcrit] = useState(null); // null | 'texte' | 'audio' : l'autre côté écrit ou enregistre
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [photoOuverte, setPhotoOuverte] = useState(null);
  const [alerte, setAlerte] = useState(null);

  const liste = useRef(null);
  const suivreFin = useRef(true); // vrai tant que la personne lit le bas de la discussion : on suit les nouveaux messages
  const dernierId = useRef(0);
  const dernierSignal = useRef(0);

  const chemin = `/messagerie/conversations/${conversation.id}`;
  const enregistreur = useEnregistreurVocal({ surDureeMax: () => envoyerVocal() });

  // Numéro du dernier message enregistré : sert à ne demander au serveur que les nouveautés
  useEffect(() => {
    const enregistres = messages.filter((m) => typeof m.id === 'number');
    dernierId.current = enregistres.length > 0 ? enregistres[enregistres.length - 1].id : 0;
  }, [messages]);

  const messageErreur = (e) =>
    e instanceof ApiException ? e.message : 'Connexion instable. Nous réessayons automatiquement.';

  // Présence, coches et « écrit… » de l'autre côté : renvoyés à chaque actualisation
  function appliquerEtatAutreCote(donnees) {
    if (donnees.presence) setPresence(donnees.presence);
    if (donnees.pointeurs) setPointeurs(donnees.pointeurs);
    setEcrit(donnees.ecrit || null);
  }

  const chargerDerniers = useCallback(async () => {
    try {
      const donnees = await ApiClient.get(`${chemin}/messages`, { cote });
      setMessages((prec) => fusionner(prec, donnees.messages));
      setPlus(donnees.il_y_en_a_plus);
      appliquerEtatAutreCote(donnees);
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
      const donnees = await ApiClient.get(`${chemin}/messages`, { cote, apres: String(apres) });
      if (donnees.messages.length > 0) {
        setMessages((prec) => fusionner(prec, donnees.messages));
        if (donnees.messages.some((m) => !m.est_moi)) rafraichirNonLus();
      }
      appliquerEtatAutreCote(donnees);
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
      const donnees = await ApiClient.get(`${chemin}/messages`, { cote, avant: String(premier.id) });
      setMessages((prec) => fusionner(prec, donnees.messages));
      setPlus(donnees.il_y_en_a_plus);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setChargementPlus(false);
    }
  }

  // Prévient l'autre côté qu'on écrit (ou qu'on enregistre un vocal) : « est en train d'écrire… »
  function signaler(genre) {
    const maintenant = Date.now();
    if (maintenant - dernierSignal.current < 2500) return;
    dernierSignal.current = maintenant;
    ApiClient.post(`${chemin}/ecriture`, { cote, genre }).catch(() => {});
  }

  useEffect(() => {
    if (!enregistreur.actif) return undefined;
    signaler('audio');
    const minuteur = setInterval(() => signaler('audio'), 3000);
    return () => clearInterval(minuteur);
  }, [enregistreur.actif]);

  // Envoi « optimiste » d'un texte : le message apparaît tout de suite, puis est confirmé par le serveur.
  // En cas d'échec il reste affiché avec « Non envoyé » : toucher le message pour réessayer.
  async function envoyer(contenuBrut, idExistant) {
    const contenu = String(contenuBrut).trim();
    if (!contenu) return;
    const idTemporaire = idExistant || 'tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    suivreFin.current = true;
    setMessages((prec) => [
      ...prec.filter((m) => m.id !== idTemporaire),
      { id: idTemporaire, type: 'texte', expediteur: cote, contenu, est_moi: true, created_at: new Date().toISOString(), envoi: true },
    ]);
    try {
      const enregistre = await ApiClient.post(`${chemin}/messages`, { cote, contenu });
      setMessages((prec) => fusionner(prec.filter((m) => m.id !== idTemporaire), [enregistre]));
    } catch (e) {
      marquerEchec(idTemporaire, e);
    }
  }

  // Envoi d'une photo, d'un vocal ou d'un document (même principe : affiché tout de suite, confirmé ensuite)
  async function envoyerFichier(fichier, type, duree, idExistant) {
    const idTemporaire = idExistant || 'tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    suivreFin.current = true;
    setMessages((prec) => [
      ...prec.filter((m) => m.id !== idTemporaire),
      {
        id: idTemporaire, type, expediteur: cote, contenu: '', est_moi: true, created_at: new Date().toISOString(),
        envoi: true, uriLocale: fichier.uri, nom_fichier: fichier.name, taille_octets: fichier.taille || null,
        duree_secondes: duree || null, fichierLocal: fichier,
      },
    ]);
    try {
      const enregistre = await ApiClient.uploadFichier(`${chemin}/pieces-jointes`, { cote, duree }, fichier);
      setMessages((prec) => fusionner(prec.filter((m) => m.id !== idTemporaire), [enregistre]));
    } catch (e) {
      marquerEchec(idTemporaire, e);
    }
  }

  function marquerEchec(idTemporaire, e) {
    setMessages((prec) =>
      prec.map((m) =>
        m.id === idTemporaire
          ? { ...m, envoi: false, echec: true, messageEchec: e instanceof ApiException ? e.message : "L'envoi a échoué." }
          : m
      )
    );
  }

  function reessayer(m) {
    if (m.fichierLocal) envoyerFichier(m.fichierLocal, m.type, m.duree_secondes, m.id);
    else envoyer(m.contenu, m.id);
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

  // ---------- Photos, documents, vocaux ----------
  async function choisirPhoto(source) {
    setMenuOuvert(false);
    setAlerte(null);
    try {
      let resultat;
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setAlerte("Autorisez l'appareil photo pour prendre une photo.");
          return;
        }
        resultat = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      } else {
        resultat = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
      }
      if (resultat.canceled || !resultat.assets || !resultat.assets[0]) return;
      const a = resultat.assets[0];
      if (a.fileSize && a.fileSize > TAILLE_MAX_FICHIER) {
        setAlerte('Cette photo est trop lourde (10 Mo maximum).');
        return;
      }
      envoyerFichier(
        { uri: a.uri, name: a.fileName || nomParDefaut(a.uri, 'photo.jpg'), type: a.mimeType || 'image/jpeg', file: a.file, taille: a.fileSize },
        'image'
      );
    } catch (e) {
      setAlerte("Impossible d'ouvrir les photos.");
    }
  }

  async function choisirDocument() {
    setMenuOuvert(false);
    setAlerte(null);
    try {
      const resultat = await DocumentPicker.getDocumentAsync({ type: TYPES_DOCUMENTS, copyToCacheDirectory: true });
      if (resultat.canceled || !resultat.assets || !resultat.assets[0]) return;
      const a = resultat.assets[0];
      if (a.size && a.size > TAILLE_MAX_FICHIER) {
        setAlerte('Ce document est trop lourd (10 Mo maximum).');
        return;
      }
      envoyerFichier(
        { uri: a.uri, name: a.name || 'document', type: a.mimeType || 'application/octet-stream', file: a.file, taille: a.size },
        'document'
      );
    } catch (e) {
      setAlerte("Impossible d'ouvrir les documents.");
    }
  }

  async function demarrerVocal() {
    setMenuOuvert(false);
    setAlerte(null);
    await enregistreur.demarrer();
  }

  async function envoyerVocal() {
    const resultat = await enregistreur.terminer();
    if (!resultat) {
      setAlerte("L'enregistrement a échoué. Réessayez.");
      return;
    }
    const web = Platform.OS === 'web';
    envoyerFichier(
      { uri: resultat.uri, name: web ? 'vocal.webm' : 'vocal.m4a', type: web ? 'audio/webm' : 'audio/mp4' },
      'audio',
      resultat.duree
    );
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
      <BulleMessage
        m={m}
        statut={m.est_moi ? statutDe(m, pointeurs) : null}
        onReessayer={reessayer}
        onOuvrirPhoto={setPhotoOuverte}
      />
    );
  }

  const peutEnvoyer = texte.trim().length > 0;
  const messageAlerte = alerte || enregistreur.erreur;
  const sousTitre =
    ecrit === 'audio' ? 'enregistre un message vocal…' : ecrit === 'texte' ? "est en train d'écrire…" : libelleVu(presence);
  const sousTitreVert = Boolean(ecrit) || Boolean(presence && presence.en_ligne);

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
        <Avatar uri={conversation.avatar} nom={conversation.titre} taille={38} />
        <View style={styles.enteteTextes}>
          <Text numberOfLines={1} style={styles.enteteTitre}>{conversation.titre}</Text>
          {sousTitre ? (
            <Text numberOfLines={1} style={[styles.enteteSousTitre, sousTitreVert && { color: VERT_EN_LIGNE, fontWeight: '600' }]}>
              {sousTitre}
            </Text>
          ) : null}
        </View>
      </View>

      {erreur ? (
        <View style={styles.bandeauErreur}>
          <Text style={styles.bandeauErreurTexte}>{erreur}</Text>
        </View>
      ) : null}
      {messageAlerte ? (
        <TouchableOpacity
          style={styles.bandeauAlerte}
          onPress={() => {
            setAlerte(null);
            enregistreur.effacerErreur();
          }}
        >
          <Text style={styles.bandeauAlerteTexte}>{messageAlerte}</Text>
        </TouchableOpacity>
      ) : null}

      {chargement ? (
        <View style={styles.centre}>
          <ActivityIndicator color={COLORS.or} />
        </View>
      ) : (
        <FlatList
          ref={liste}
          data={lignes}
          extraData={pointeurs}
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

      {menuOuvert && !enregistreur.actif ? (
        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuChoix} onPress={() => choisirPhoto('galerie')} accessibilityRole="button">
            <View style={[styles.menuIcone, { backgroundColor: '#E8F0FF' }]}>
              <Ionicons name="image" size={22} color="#2563EB" />
            </View>
            <Text style={styles.menuTexte}>Photo</Text>
          </TouchableOpacity>
          {Platform.OS !== 'web' ? (
            <TouchableOpacity style={styles.menuChoix} onPress={() => choisirPhoto('camera')} accessibilityRole="button">
              <View style={[styles.menuIcone, { backgroundColor: '#FDECEA' }]}>
                <Ionicons name="camera" size={22} color={COLORS.rouge} />
              </View>
              <Text style={styles.menuTexte}>Appareil photo</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.menuChoix} onPress={choisirDocument} accessibilityRole="button">
            <View style={[styles.menuIcone, { backgroundColor: '#FFF6DB' }]}>
              <Ionicons name="document-text" size={22} color={COLORS.orFonce} />
            </View>
            <Text style={styles.menuTexte}>Document</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {enregistreur.actif ? (
        <View style={styles.barreSaisie}>
          <TouchableOpacity
            onPress={enregistreur.annuler}
            style={styles.boutonRond}
            accessibilityRole="button"
            accessibilityLabel="Annuler l'enregistrement"
          >
            <Ionicons name="trash-outline" size={22} color={COLORS.rouge} />
          </TouchableOpacity>
          <View style={styles.enregistrement}>
            <View style={styles.pointRouge} />
            <Text style={styles.chrono}>{dureeLisible(enregistreur.secondes)}</Text>
            <Text style={styles.enregistrementTexte}>Enregistrement…</Text>
          </View>
          <TouchableOpacity
            onPress={envoyerVocal}
            style={styles.boutonEnvoi}
            accessibilityRole="button"
            accessibilityLabel="Envoyer le message vocal"
          >
            <Ionicons name="send" size={18} color={COLORS.noir} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.barreSaisie}>
          <TouchableOpacity
            onPress={() => setMenuOuvert((v) => !v)}
            style={styles.boutonRond}
            accessibilityRole="button"
            accessibilityLabel="Joindre une photo ou un document"
          >
            <Ionicons name={menuOuvert ? 'close' : 'attach'} size={26} color={COLORS.gris} />
          </TouchableOpacity>
          <TextInput
            style={[styles.saisie, { height: hauteurSaisie }, Platform.OS === 'web' && { outlineStyle: 'none' }]}
            value={texte}
            onChangeText={(t) => {
              setTexte(t);
              if (t.trim()) signaler('texte');
            }}
            placeholder="Écrivez votre message…"
            placeholderTextColor={COLORS.gris}
            multiline
            maxLength={LONGUEUR_MAX}
            onFocus={() => setMenuOuvert(false)}
            onContentSizeChange={(e) =>
              setHauteurSaisie(
                Math.min(HAUTEUR_SAISIE_MAX, Math.max(HAUTEUR_SAISIE_MIN, Math.ceil(e.nativeEvent.contentSize.height) + 14))
              )
            }
            onKeyPress={surTouche}
            accessibilityLabel="Votre message"
          />
          {peutEnvoyer ? (
            <TouchableOpacity
              onPress={surEnvoi}
              style={styles.boutonEnvoi}
              accessibilityRole="button"
              accessibilityLabel="Envoyer le message"
            >
              <Ionicons name="send" size={18} color={COLORS.noir} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={demarrerVocal}
              style={styles.boutonEnvoi}
              accessibilityRole="button"
              accessibilityLabel="Enregistrer un message vocal"
            >
              <Ionicons name="mic" size={22} color={COLORS.noir} />
            </TouchableOpacity>
          )}
        </View>
      )}
      {texte.length > LONGUEUR_MAX - 200 ? (
        <Text style={styles.compteur}>{texte.length} / {LONGUEUR_MAX}</Text>
      ) : null}

      <VisionneusePhoto photo={photoOuverte} onFermer={() => setPhotoOuverte(null)} />
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
  enteteTextes: { flex: 1, marginLeft: 10 },
  enteteTitre: { fontSize: 16, fontWeight: '800', color: COLORS.noir },
  enteteSousTitre: { fontSize: 12, color: COLORS.gris, marginTop: 1 },

  bandeauErreur: { backgroundColor: '#FDECEA', paddingVertical: 6, paddingHorizontal: 12 },
  bandeauErreurTexte: { color: COLORS.rouge, fontSize: 12.5 },
  bandeauAlerte: { backgroundColor: '#FFF6DB', paddingVertical: 8, paddingHorizontal: 12 },
  bandeauAlerteTexte: { color: COLORS.noir, fontSize: 12.5 },

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

  menu: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.blanc,
    borderTopWidth: 1,
    borderTopColor: '#ECE9E2',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  menuChoix: { alignItems: 'center', minWidth: 80 },
  menuIcone: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  menuTexte: { fontSize: 12, color: COLORS.noir, marginTop: 6, fontWeight: '600' },

  barreSaisie: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: COLORS.blanc,
    borderTopWidth: 1,
    borderTopColor: '#ECE9E2',
  },
  boutonRond: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
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
  enregistrement: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 42, paddingLeft: 6 },
  pointRouge: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.rouge, marginRight: 8 },
  chrono: { fontSize: 16, fontWeight: '700', color: COLORS.noir, marginRight: 10 },
  enregistrementTexte: { fontSize: 13, color: COLORS.gris },
  compteur: { textAlign: 'right', fontSize: 11, color: COLORS.gris, paddingRight: 14, paddingBottom: 4, backgroundColor: COLORS.blanc },
});
