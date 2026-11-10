import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { COLORS } from '../../theme/colors';
import { ApiClient, ApiException } from '../../api/apiClient';
import { useSpace } from '../../context/SpaceContext';
import { TRANSITIONS_STATUT, LIBELLES_ACTION } from '../../config/statuts';
import { ouvrirLien } from '../../config/liens';
import useActualisation from '../../hooks/useActualisation';
import useRetourEnArriere from '../../hooks/useRetourEnArriere';
import ModaleConfirmation from '../../components/ModaleConfirmation';
import CarteCommande from '../../components/commandes/CarteCommande';
import DetailCommande from '../../components/commandes/DetailCommande';

const EN_COURS = ['confirmee', 'en_preparation', 'prete'];
const ONGLETS = [
  ['a_traiter', 'À traiter', (c) => c.statut === 'en_attente'],
  ['en_cours', 'En cours', (c) => EN_COURS.includes(c.statut)],
  ['livrees', 'Livrées', (c) => c.statut === 'livree'],
  ['annulees', 'Annulées', (c) => c.statut === 'annulee'],
  ['toutes', 'Toutes', () => true],
];

// Commandes reçues par la boutique : onglets avec compteurs, traitement en un geste (confirmer, préparer, prête, livrée),
// annulation avec confirmation, appel du client, détail complet. Actualisation automatique toutes les 30 secondes.
export default function OrdersScreen() {
  const { maBoutique } = useSpace();
  const estAffiche = useIsFocused();
  const [commandes, setCommandes] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [onglet, setOnglet] = useState('a_traiter');
  const [ouverte, setOuverte] = useState(null);
  const [enCours, setEnCours] = useState(null); // commande en cours de mise à jour
  const [aAnnuler, setAAnnuler] = useState(null);
  const [actualisation, setActualisation] = useState(false);

  useRetourEnArriere(ouverte !== null, () => setOuverte(null));

  const charger = useCallback(async () => {
    if (!maBoutique) return;
    try {
      const donnees = await ApiClient.get(`/orders/shop/${maBoutique.id}`);
      setCommandes(donnees);
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof ApiException ? e.message : 'Impossible de charger les commandes.');
    }
  }, [maBoutique]);

  useActualisation(charger, 30000, estAffiche && Boolean(maBoutique));

  async function actualiser() {
    setActualisation(true);
    await charger();
    setActualisation(false);
  }

  async function changer(commande, statut) {
    setEnCours(commande.id);
    setErreur(null);
    try {
      await ApiClient.patch(`/orders/${commande.id}/statut`, { statut });
      setCommandes((liste) => liste.map((c) => (c.id === commande.id ? { ...c, statut } : c)));
      charger();
    } catch (e) {
      setErreur(e instanceof ApiException ? e.message : 'Impossible de mettre à jour la commande.');
    } finally {
      setEnCours(null);
      setAAnnuler(null);
    }
  }

  if (!maBoutique) {
    return <View style={styles.centre}><Text style={styles.videTexte}>Aucune boutique sélectionnée.</Text></View>;
  }

  if (ouverte) {
    return <DetailCommande key={ouverte} orderId={ouverte} cote="boutique" onRetour={() => setOuverte(null)} onMaj={charger} />;
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

  const test = ONGLETS.find((o) => o[0] === onglet)[2];
  const visibles = commandes.filter(test);

  function pied(c) {
    const transitions = TRANSITIONS_STATUT[c.statut] || [];
    const suivante = transitions.find((t) => t !== 'annulee');
    const occupee = enCours === c.id;
    return (
      <>
        {suivante ? (
          <TouchableOpacity style={[styles.action, occupee && { opacity: 0.6 }]} onPress={() => changer(c, suivante)} disabled={occupee} accessibilityRole="button">
            {occupee ? <ActivityIndicator size="small" color={COLORS.noir} /> : <Text style={styles.actionTexte}>{LIBELLES_ACTION[suivante] || suivante}</Text>}
          </TouchableOpacity>
        ) : null}
        {transitions.includes('annulee') ? (
          <TouchableOpacity style={styles.annuler} onPress={() => setAAnnuler(c)} disabled={occupee} accessibilityRole="button">
            <Text style={styles.annulerTexte}>Annuler</Text>
          </TouchableOpacity>
        ) : null}
        {c.telephone ? (
          <TouchableOpacity style={styles.appel} onPress={() => ouvrirLien(`tel:${c.telephone}`)} accessibilityRole="link" accessibilityLabel={`Appeler ${c.prenom || ''} ${c.nom || ''}`}>
            <Ionicons name="call" size={16} color={COLORS.noir} />
          </TouchableOpacity>
        ) : null}
      </>
    );
  }

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
            <Text style={styles.titre}>Commandes</Text>
            {erreur ? (
              <TouchableOpacity style={styles.bandeauErreur} onPress={() => setErreur(null)} accessibilityRole="button">
                <Ionicons name="alert-circle" size={16} color={COLORS.rouge} style={{ marginRight: 8 }} />
                <Text style={styles.bandeauErreurTexte}>{erreur}</Text>
              </TouchableOpacity>
            ) : null}
            <View style={styles.onglets}>
              {ONGLETS.map(([cle, libelle, critere]) => {
                const nombre = commandes.filter(critere).length;
                const actif = onglet === cle;
                const urgent = cle === 'a_traiter' && nombre > 0;
                return (
                  <TouchableOpacity key={cle} style={[styles.puce, actif && styles.puceActive]} onPress={() => setOnglet(cle)} accessibilityRole="button" accessibilityState={{ selected: actif }}>
                    <Text style={[styles.puceTexte, actif && styles.puceTexteActive]}>{libelle}</Text>
                    <View style={[styles.compteur, urgent && !actif && { backgroundColor: COLORS.rouge }, actif && { backgroundColor: COLORS.or }]}>
                      <Text style={[styles.compteurTexte, (urgent && !actif) && { color: COLORS.blanc }]}>{nombre}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.vide}>
            <Ionicons name="bag-check-outline" size={48} color={COLORS.gris} />
            <Text style={styles.videTitre}>{commandes.length === 0 ? 'Aucune commande pour le moment' : 'Rien dans cette catégorie'}</Text>
            <Text style={styles.videTexte}>
              {commandes.length === 0
                ? 'Les commandes de vos clients apparaîtront ici dès qu’ils passeront commande.'
                : onglet === 'a_traiter' ? 'Toutes vos commandes ont été traitées.' : 'Aucune commande ne correspond à ce filtre.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <CarteCommande
            commande={item}
            titre={`${item.prenom || ''} ${item.nom || ''}`.trim() || 'Client'}
            sousTitre={item.telephone || null}
            nouveau={item.statut === 'en_attente'}
            etiquetteNouveau="À traiter"
            onPress={() => setOuverte(item.id)}
            pied={pied(item)}
          />
        )}
      />

      <ModaleConfirmation
        visible={Boolean(aAnnuler)}
        titre="Annuler cette commande ?"
        message="Les articles seront remis en stock et le client sera prévenu par email s'il a une adresse email. Cette action est définitive."
        libelleConfirmer="Annuler la commande"
        destructif
        enCours={Boolean(aAnnuler) && enCours === aAnnuler.id}
        onConfirmer={() => changer(aAnnuler, 'annulee')}
        onAnnuler={() => setAAnnuler(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.creme },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: COLORS.creme },
  liste: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 16, paddingBottom: 40, flexGrow: 1 },
  titre: { fontSize: 22, fontWeight: '900', color: COLORS.noir, marginBottom: 12 },
  bandeauErreur: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDECEA', borderRadius: 10, padding: 10, marginBottom: 12 },
  bandeauErreurTexte: { flex: 1, color: COLORS.rouge, fontSize: 13 },
  onglets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  puce: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blanc, borderRadius: 20, paddingLeft: 14, paddingRight: 8, paddingVertical: 7, borderWidth: 1, borderColor: '#E6E2D8' },
  puceActive: { backgroundColor: COLORS.noir, borderColor: COLORS.noir },
  puceTexte: { fontSize: 13, fontWeight: '600', color: COLORS.noir },
  puceTexteActive: { color: COLORS.or, fontWeight: '800' },
  compteur: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, marginLeft: 8, backgroundColor: '#EFECE4', alignItems: 'center', justifyContent: 'center' },
  compteurTexte: { fontSize: 11.5, fontWeight: '800', color: COLORS.noir },
  vide: { alignItems: 'center', paddingTop: 50 },
  videTitre: { fontSize: 16, fontWeight: '800', color: COLORS.noir, marginTop: 12, textAlign: 'center' },
  videTexte: { fontSize: 13.5, color: COLORS.gris, textAlign: 'center', marginTop: 6, maxWidth: 320, lineHeight: 19 },
  bouton: { backgroundColor: COLORS.or, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 22, marginTop: 16 },
  boutonTexte: { fontWeight: '800', color: COLORS.noir, fontSize: 14.5 },
  action: { flex: 1, minWidth: 150, backgroundColor: COLORS.or, borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  actionTexte: { fontWeight: '800', color: COLORS.noir, fontSize: 13.5 },
  annuler: { borderWidth: 1.5, borderColor: COLORS.rouge, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  annulerTexte: { fontWeight: '700', color: COLORS.rouge, fontSize: 13.5 },
  appel: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.creme, alignItems: 'center', justifyContent: 'center' },
});
