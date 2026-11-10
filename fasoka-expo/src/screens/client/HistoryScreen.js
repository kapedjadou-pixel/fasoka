import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { COLORS } from '../../theme/colors';
import { ApiClient, ApiException } from '../../api/apiClient';
import { useCommandes } from '../../context/CommandesContext';
import useActualisation from '../../hooks/useActualisation';
import useRetourEnArriere from '../../hooks/useRetourEnArriere';
import CarteCommande from '../../components/commandes/CarteCommande';
import DetailCommande from '../../components/commandes/DetailCommande';

const EN_COURS = ['en_attente', 'confirmee', 'en_preparation', 'prete'];
const FILTRES = [
  ['toutes', 'Toutes', () => true],
  ['en_cours', 'En cours', (c) => EN_COURS.includes(c.statut)],
  ['livrees', 'Livrées', (c) => c.statut === 'livree'],
  ['annulees', 'Annulées', (c) => c.statut === 'annulee'],
];

// Historique des commandes du client : liste filtrable avec statuts colorés, détail avec suivi par étapes.
// Une pastille « Mis à jour » repère les commandes dont le statut a changé depuis la dernière visite.
export default function HistoryScreen({ navigation, route }) {
  const estAffiche = useIsFocused();
  const { marquerVu } = useCommandes();
  const [commandes, setCommandes] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [filtre, setFiltre] = useState('toutes');
  const [ouverte, setOuverte] = useState(null); // numéro de la commande affichée en détail
  const [derniereVisite, setDerniereVisite] = useState(null);
  const [actualisation, setActualisation] = useState(false);
  const demandeTraitee = useRef(null);

  useRetourEnArriere(ouverte !== null, () => setOuverte(null));

  // À chaque arrivée sur l'écran : on retient la visite précédente (pour repérer les nouveautés), puis la pastille repart à zéro
  useEffect(() => {
    if (!estAffiche) return;
    marquerVu().then(setDerniereVisite).catch(() => {});
  }, [estAffiche]);

  // Ouverture directe d'une commande (après l'envoi d'une commande depuis le panier)
  const demande = route && route.params && route.params.ouvrir;
  const cleDemande = route && route.params && route.params.cle;
  useEffect(() => {
    if (!demande || demandeTraitee.current === cleDemande) return;
    demandeTraitee.current = cleDemande;
    setOuverte(demande);
  }, [demande, cleDemande]);

  const charger = useCallback(async () => {
    try {
      const donnees = await ApiClient.get('/orders/mine');
      setCommandes(donnees);
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof ApiException ? e.message : 'Impossible de charger vos commandes.');
    }
  }, []);

  useActualisation(charger, 30000, estAffiche);

  async function actualiser() {
    setActualisation(true);
    await charger();
    setActualisation(false);
  }

  if (ouverte) {
    return (
      <DetailCommande
        key={ouverte}
        orderId={ouverte}
        cote="client"
        onRetour={() => setOuverte(null)}
        onMaj={charger}
        onContacter={(boutique) => {
          setOuverte(null);
          navigation.navigate('Messages', { ouvrir: { shop_id: boutique.id, cle: Date.now() } });
        }}
      />
    );
  }

  if (commandes === null && !erreur) {
    return <View style={styles.centre}><ActivityIndicator size="large" color={COLORS.or} /></View>;
  }
  if (commandes === null) {
    return (
      <View style={styles.centre}>
        <Ionicons name="cloud-offline-outline" size={40} color={COLORS.gris} />
        <Text style={styles.videTexte}>{erreur}</Text>
        <TouchableOpacity style={styles.bouton} onPress={charger} accessibilityRole="button"><Text style={styles.boutonTexte}>Réessayer</Text></TouchableOpacity>
      </View>
    );
  }

  const critere = FILTRES.find((f) => f[0] === filtre)[2];
  const visibles = commandes.filter(critere);
  const estNouveau = (c) =>
    Boolean(derniereVisite) && c.statut !== 'en_attente' && new Date(c.updated_at).getTime() > new Date(derniereVisite).getTime();

  return (
    <View style={styles.page}>
      <FlatList
        data={visibles}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.liste}
        refreshing={actualisation}
        onRefresh={actualiser}
        ListHeaderComponent={
          <View>
            <Text style={styles.titre}>Mes commandes</Text>
            {erreur ? (
              <TouchableOpacity style={styles.bandeauErreur} onPress={charger} accessibilityRole="button">
                <Text style={styles.bandeauErreurTexte}>{erreur} Touchez pour réessayer.</Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.filtres}>
              {FILTRES.map(([cle, libelle, test]) => {
                const nombre = commandes.filter(test).length;
                const actif = filtre === cle;
                return (
                  <TouchableOpacity key={cle} style={[styles.puce, actif && styles.puceActive]} onPress={() => setFiltre(cle)} accessibilityRole="button" accessibilityState={{ selected: actif }}>
                    <Text style={[styles.puceTexte, actif && styles.puceTexteActive]}>{libelle} ({nombre})</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.vide}>
            <Ionicons name="receipt-outline" size={48} color={COLORS.gris} />
            <Text style={styles.videTitre}>{commandes.length === 0 ? 'Aucune commande pour le moment' : 'Aucune commande dans cette catégorie'}</Text>
            <Text style={styles.videTexte}>
              {commandes.length === 0 ? 'Vos commandes apparaîtront ici, avec leur suivi étape par étape.' : 'Choisissez un autre filtre pour voir vos autres commandes.'}
            </Text>
            {commandes.length === 0 ? (
              <TouchableOpacity style={styles.bouton} onPress={() => navigation.navigate('Accueil')} accessibilityRole="button"><Text style={styles.boutonTexte}>Voir les produits</Text></TouchableOpacity>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <CarteCommande
            commande={item}
            titre={item.nom_boutique}
            nouveau={estNouveau(item)}
            onPress={() => setOuverte(item.id)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.creme },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: COLORS.creme },
  liste: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 16, paddingBottom: 40, flexGrow: 1 },
  titre: { fontSize: 22, fontWeight: '900', color: COLORS.noir, marginBottom: 12 },
  bandeauErreur: { backgroundColor: '#FDECEA', borderRadius: 10, padding: 10, marginBottom: 12 },
  bandeauErreurTexte: { color: COLORS.rouge, fontSize: 13 },
  filtres: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  puce: { backgroundColor: COLORS.blanc, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#E6E2D8' },
  puceActive: { backgroundColor: COLORS.noir, borderColor: COLORS.noir },
  puceTexte: { fontSize: 13, fontWeight: '600', color: COLORS.noir },
  puceTexteActive: { color: COLORS.or, fontWeight: '800' },
  vide: { alignItems: 'center', paddingTop: 50 },
  videTitre: { fontSize: 16, fontWeight: '800', color: COLORS.noir, marginTop: 12, textAlign: 'center' },
  videTexte: { fontSize: 13.5, color: COLORS.gris, textAlign: 'center', marginTop: 6, maxWidth: 300, lineHeight: 19 },
  bouton: { backgroundColor: COLORS.or, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 22, marginTop: 16 },
  boutonTexte: { fontWeight: '800', color: COLORS.noir, fontSize: 14.5 },
});
