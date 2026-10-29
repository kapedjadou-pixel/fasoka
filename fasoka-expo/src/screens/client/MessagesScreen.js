import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { COLORS } from '../../theme/colors';
import { ApiClient, ApiException } from '../../api/apiClient';
import useRetourEnArriere from '../../hooks/useRetourEnArriere';
import ListeConversations from '../../components/messagerie/ListeConversations';
import ChatConversation from '../../components/messagerie/ChatConversation';

// Onglet « Messages » du client : liste de ses discussions avec les boutiques, et la discussion ouverte.
// Depuis l'accueil, la petite bulle d'un produit ouvre directement une discussion avec sa boutique :
//   navigation.navigate('Messages', { ouvrir: { shop_id, produit_nom, cle } })
export default function MessagesScreen({ navigation, route }) {
  const estAffiche = useIsFocused();
  const [ouverte, setOuverte] = useState(null); // { conversation: { id, titre, avatar }, brouillon }
  const [ouvertureEnCours, setOuvertureEnCours] = useState(false);
  const [problemeOuverture, setProblemeOuverture] = useState(null);
  const demandeTraitee = useRef(null);

  useRetourEnArriere(ouverte !== null, () => setOuverte(null));

  const demande = route && route.params && route.params.ouvrir;
  useEffect(() => {
    if (!demande || demandeTraitee.current === demande.cle) return;
    demandeTraitee.current = demande.cle;

    setOuvertureEnCours(true);
    setProblemeOuverture(null);
    ApiClient.post('/messagerie/conversations', { shop_id: demande.shop_id })
      .then((conversation) => {
        setOuverte({
          conversation,
          // Message proposé (mais pas envoyé) : le client peut le modifier avant d'envoyer
          brouillon: demande.produit_nom
            ? `Bonjour, je suis intéressé(e) par « ${demande.produit_nom} ». Est-il disponible ?`
            : '',
        });
      })
      .catch((e) => {
        setProblemeOuverture(e instanceof ApiException ? e.message : "Impossible d'ouvrir la discussion.");
      })
      .finally(() => setOuvertureEnCours(false));
  }, [demande && demande.cle]);

  if (ouverte) {
    return (
      <ChatConversation
        key={ouverte.conversation.id}
        conversation={ouverte.conversation}
        cote="client"
        brouillon={ouverte.brouillon}
        onRetour={() => setOuverte(null)}
        actif={estAffiche}
      />
    );
  }

  return (
    <View style={styles.page}>
      <Text style={styles.titre}>Messages</Text>
      {ouvertureEnCours ? (
        <View style={styles.bandeau}>
          <ActivityIndicator size="small" color={COLORS.noir} />
          <Text style={styles.bandeauTexte}>Ouverture de la discussion…</Text>
        </View>
      ) : null}
      {problemeOuverture ? (
        <View style={[styles.bandeau, { backgroundColor: '#FDECEA' }]}>
          <Text style={[styles.bandeauTexte, { color: COLORS.rouge, marginLeft: 0 }]}>{problemeOuverture}</Text>
        </View>
      ) : null}
      <ListeConversations
        cote="client"
        onOuvrir={(conversation) => setOuverte({ conversation, brouillon: '' })}
        actif={estAffiche}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.creme },
  titre: { fontSize: 20, fontWeight: '800', color: COLORS.noir, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
  bandeau: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF6DB',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  bandeauTexte: { marginLeft: 8, fontSize: 13, color: COLORS.noir },
});
