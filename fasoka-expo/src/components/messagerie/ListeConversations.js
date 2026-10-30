import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { ApiClient, ApiException } from '../../api/apiClient';
import useActualisation from '../../hooks/useActualisation';
import { useMessagerie } from '../../context/MessagerieContext';
import Avatar from './Avatar';
import { apercuMessage, horodatageListe } from './formatage';

// Liste des discussions. `cote` : 'client' (mes discussions avec des boutiques) ou 'boutique' (discussions avec
// les clients de la boutique `shopId`). `actif` : vrai quand l'écran est affiché (l'actualisation s'arrête sinon).
export default function ListeConversations({ cote, shopId, onOuvrir, actif = true }) {
  const [conversations, setConversations] = useState(null); // null = premier chargement en cours
  const [erreur, setErreur] = useState(null);
  const { rafraichirNonLus } = useMessagerie();

  const charger = useCallback(async () => {
    try {
      const chemin = cote === 'client' ? '/messagerie/conversations' : `/messagerie/boutiques/${shopId}/conversations`;
      const donnees = await ApiClient.get(chemin);
      setConversations(donnees);
      setErreur(null);
      rafraichirNonLus();
    } catch (e) {
      setErreur(e instanceof ApiException ? e.message : 'Impossible de charger les discussions.');
    }
  }, [cote, shopId, rafraichirNonLus]);

  useActualisation(charger, 10000, actif && (cote === 'client' || Boolean(shopId)));

  if (conversations === null && !erreur) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={COLORS.or} />
      </View>
    );
  }

  if (conversations === null && erreur) {
    return (
      <View style={styles.centre}>
        <Ionicons name="cloud-offline-outline" size={36} color={COLORS.gris} />
        <Text style={styles.videTitre}>{erreur}</Text>
        <TouchableOpacity onPress={charger} style={styles.reessayer}>
          <Text style={styles.reessayerTexte}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function ligne({ item }) {
    const nonLus = item.non_lus || 0;
    return (
      <TouchableOpacity
        style={styles.ligne}
        onPress={() => onOuvrir({ id: item.id, shop_id: item.shop_id, titre: item.titre, avatar: item.avatar })}
        accessibilityRole="button"
        accessibilityLabel={`Discussion avec ${item.titre}${nonLus > 0 ? ', ' + nonLus + ' message(s) non lu(s)' : ''}`}
      >
        <Avatar uri={item.avatar} nom={item.titre} taille={48} />
        <View style={styles.milieu}>
          <Text numberOfLines={1} style={[styles.titre, nonLus > 0 && { color: COLORS.noir }]}>{item.titre}</Text>
          <Text numberOfLines={1} style={[styles.apercu, nonLus > 0 && styles.apercuNonLu]}>
            {item.dernier_est_moi ? 'Vous : ' : ''}
            {apercuMessage({
              type: item.dernier_type,
              contenu: item.dernier_contenu,
              nom_fichier: item.dernier_nom_fichier,
              duree: item.dernier_duree,
            })}
          </Text>
        </View>
        <View style={styles.droite}>
          <Text style={[styles.heure, nonLus > 0 && { color: COLORS.rouge, fontWeight: '700' }]}>
            {horodatageListe(item.dernier_message_le)}
          </Text>
          {nonLus > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeTexte}>{nonLus > 99 ? '99+' : nonLus}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item.id}
      renderItem={ligne}
      contentContainerStyle={conversations.length === 0 ? { flexGrow: 1 } : { paddingBottom: 16 }}
      ListHeaderComponent={
        erreur ? (
          <View style={styles.bandeauErreur}>
            <Text style={styles.bandeauErreurTexte}>{erreur}</Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.centre}>
          <Ionicons name="chatbubbles-outline" size={44} color={COLORS.gris} />
          <Text style={styles.videTitre}>
            {cote === 'client' ? 'Aucune discussion pour le moment' : 'Aucun message de client pour le moment'}
          </Text>
          <Text style={styles.videTexte}>
            {cote === 'client'
              ? "Touchez la petite bulle à côté du nom d'une boutique, sur l'accueil, pour lui écrire."
              : "Quand un client vous écrira, la discussion apparaîtra ici."}
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  videTitre: { fontSize: 15, fontWeight: '700', color: COLORS.noir, marginTop: 12, textAlign: 'center' },
  videTexte: { fontSize: 13.5, color: COLORS.gris, marginTop: 6, textAlign: 'center', lineHeight: 19, maxWidth: 320 },
  reessayer: { marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.or },
  reessayerTexte: { fontWeight: '800', color: COLORS.noir },
  bandeauErreur: { backgroundColor: '#FDECEA', padding: 10, margin: 12, borderRadius: 10 },
  bandeauErreurTexte: { color: COLORS.rouge, fontSize: 13 },

  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.blanc,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EDE6',
  },
  milieu: { flex: 1, marginHorizontal: 12 },
  titre: { fontSize: 15, fontWeight: '700', color: COLORS.noir },
  apercu: { fontSize: 13.5, color: COLORS.gris, marginTop: 3 },
  apercuNonLu: { color: COLORS.noir, fontWeight: '600' },
  droite: { alignItems: 'flex-end', minWidth: 48 },
  heure: { fontSize: 11.5, color: COLORS.gris },
  badge: {
    marginTop: 6,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: COLORS.rouge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTexte: { color: COLORS.blanc, fontSize: 11, fontWeight: '800' },
});
