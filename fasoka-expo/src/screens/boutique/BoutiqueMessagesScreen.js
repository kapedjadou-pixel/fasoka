import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { COLORS } from '../../theme/colors';
import { useSpace } from '../../context/SpaceContext';
import useRetourEnArriere from '../../hooks/useRetourEnArriere';
import ListeConversations from '../../components/messagerie/ListeConversations';
import ChatConversation from '../../components/messagerie/ChatConversation';

// Onglet « Messages » de l'espace boutique : discussions avec les clients.
// Toute l'équipe de la boutique voit les mêmes discussions et peut répondre.
export default function BoutiqueMessagesScreen() {
  const { maBoutique } = useSpace();
  const estAffiche = useIsFocused();
  const [ouverte, setOuverte] = useState(null); // { id, titre, avatar }

  useRetourEnArriere(ouverte !== null, () => setOuverte(null));

  if (ouverte) {
    return (
      <ChatConversation
        key={ouverte.id}
        conversation={ouverte}
        cote="boutique"
        onRetour={() => setOuverte(null)}
        actif={estAffiche}
      />
    );
  }

  return (
    <View style={styles.page}>
      <Text style={styles.titre}>Messages de vos clients</Text>
      <ListeConversations
        cote="boutique"
        shopId={maBoutique ? maBoutique.id : null}
        onOuvrir={setOuverte}
        actif={estAffiche}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.creme },
  titre: { fontSize: 20, fontWeight: '800', color: COLORS.noir, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10 },
});
