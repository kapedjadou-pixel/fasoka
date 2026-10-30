import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { ouvrirLien } from '../../config/liens';
import Coches from './Coches';
import LecteurAudio from './LecteurAudio';
import { heureCourte, miniature, tailleLisible } from './formatage';

const LARGEUR_PHOTO = 230;

function iconeDocument(mime, nom) {
  const texte = (String(mime || '') + ' ' + String(nom || '')).toLowerCase();
  if (texte.includes('pdf')) return 'document-text';
  if (texte.includes('sheet') || texte.includes('excel') || texte.includes('.xls') || texte.includes('csv')) return 'grid';
  if (texte.includes('presentation') || texte.includes('powerpoint') || texte.includes('.ppt')) return 'easel';
  return 'document';
}

// Une bulle de discussion : texte, photo, message vocal ou document. `statut` : coches de mes messages
// ('attente' | 'echec' | 'envoye' | 'recu' | 'lu'), absent pour les messages reçus.
export default function BulleMessage({ m, statut, onReessayer, onOuvrirPhoto }) {
  const urlPhoto = m.piece_jointe_url || m.uriLocale;
  const ratio = m.largeur && m.hauteur ? Math.min(1.8, Math.max(0.6, m.largeur / m.hauteur)) : 1;
  const sourceAudio = m.piece_jointe_url || m.uriLocale;

  return (
    <View style={[styles.ligneMessage, m.est_moi ? styles.alignDroite : styles.alignGauche]}>
      <TouchableOpacity
        activeOpacity={m.echec ? 0.7 : 1}
        disabled={!m.echec}
        onPress={() => onReessayer(m)}
        style={[
          styles.bulle,
          m.est_moi ? styles.bulleMoi : styles.bulleAutre,
          m.type === 'image' && styles.bulleImage,
          m.envoi && { opacity: 0.7 },
          m.echec && styles.bulleEchec,
        ]}
      >
        {m.type === 'image' && urlPhoto ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onOuvrirPhoto({ uri: miniature(urlPhoto, 1400), original: m.piece_jointe_url })}
            accessibilityRole="imagebutton"
            accessibilityLabel="Ouvrir la photo"
          >
            <Image
              source={{ uri: miniature(urlPhoto) }}
              style={{ width: LARGEUR_PHOTO, height: LARGEUR_PHOTO / ratio, borderRadius: 12, backgroundColor: COLORS.creme }}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ) : null}

        {m.type === 'audio' && sourceAudio ? <LecteurAudio uri={sourceAudio} duree={m.duree_secondes} /> : null}

        {m.type === 'document' ? (
          <TouchableOpacity
            disabled={!m.piece_jointe_url}
            onPress={() => ouvrirLien(m.piece_jointe_url)}
            style={styles.document}
            accessibilityRole="link"
            accessibilityLabel={`Ouvrir le document ${m.nom_fichier || ''}`}
          >
            <View style={styles.documentIcone}>
              <Ionicons name={iconeDocument(m.type_mime, m.nom_fichier)} size={22} color={COLORS.noir} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={styles.documentNom}>{m.nom_fichier || 'Document'}</Text>
              {m.taille_octets ? <Text style={styles.documentTaille}>{tailleLisible(m.taille_octets)}</Text> : null}
            </View>
          </TouchableOpacity>
        ) : null}

        {m.contenu ? (
          <Text selectable style={[styles.texteMessage, m.type !== 'texte' && { marginTop: 6 }]}>{m.contenu}</Text>
        ) : null}

        <View style={styles.pied}>
          <Text style={styles.heureMessage}>{m.echec ? 'Non envoyé' : m.envoi ? 'Envoi…' : heureCourte(m.created_at)}</Text>
          {statut ? (
            <View style={{ marginLeft: 4 }}>
              <Coches statut={statut} />
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
      {m.echec ? <Text style={styles.erreurMessage}>{m.messageEchec} Touchez le message pour réessayer.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ligneMessage: { marginVertical: 3, maxWidth: '100%' },
  alignDroite: { alignItems: 'flex-end' },
  alignGauche: { alignItems: 'flex-start' },
  bulle: { maxWidth: '82%', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 5, borderRadius: 16 },
  bulleImage: { padding: 4, paddingBottom: 5 },
  bulleMoi: { backgroundColor: COLORS.or, borderBottomRightRadius: 4 },
  bulleAutre: { backgroundColor: COLORS.blanc, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#ECE9E2' },
  bulleEchec: { borderWidth: 1.5, borderColor: COLORS.rouge },
  texteMessage: { fontSize: 15, lineHeight: 21, color: COLORS.noir },
  pied: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 2, paddingRight: 4 },
  heureMessage: { fontSize: 10.5, color: 'rgba(0,0,0,0.5)' },
  erreurMessage: { fontSize: 11.5, color: COLORS.rouge, marginTop: 3, maxWidth: '82%', textAlign: 'right' },

  document: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.07)',
  },
  documentIcone: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  documentNom: { fontSize: 14, fontWeight: '600', color: COLORS.noir },
  documentTaille: { fontSize: 11.5, color: 'rgba(0,0,0,0.55)', marginTop: 2 },
});
