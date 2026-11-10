import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { ApiClient, ApiException } from '../../api/apiClient';
import { MODES_LIVRAISON, LIBELLES_ACTION } from '../../config/statuts';
import { ouvrirLien } from '../../config/liens';
import useActualisation from '../../hooks/useActualisation';
import ModaleConfirmation from '../ModaleConfirmation';
import Avatar from '../messagerie/Avatar';
import { fcfa, pluriel } from '../dashboard/format';
import BadgeStatut from './BadgeStatut';
import LigneArticle from './LigneArticle';
import SuiviStatut from './SuiviStatut';
import { dateHeure } from './format';

function Bloc({ titre, children }) {
  return (
    <View style={styles.bloc}>
      <Text style={styles.titreBloc}>{titre}</Text>
      {children}
    </View>
  );
}

// Détail d'une commande, pour le client (`cote="client"`) comme pour la boutique (`cote="boutique"`) :
// suivi par étapes, articles, réception, paiement, contact, et actions de traitement côté boutique.
// `onMaj` : appelé après un changement de statut (pour actualiser la liste) ; `onContacter(boutique)` : écrire à la boutique.
export default function DetailCommande({ orderId, cote, onRetour, onMaj, onContacter }) {
  const [commande, setCommande] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [annulation, setAnnulation] = useState(false);

  const charger = useCallback(async () => {
    try {
      const donnees = await ApiClient.get(`/orders/${orderId}`, { cote });
      setCommande(donnees);
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof ApiException ? e.message : 'Impossible de charger la commande.');
    } finally {
      setChargement(false);
    }
  }, [orderId, cote]);

  // Le suivi se met à jour tout seul tant que l'écran est ouvert
  useActualisation(charger, 20000, true);

  async function changerStatut(statut) {
    setEnCours(true);
    setErreur(null);
    try {
      await ApiClient.patch(`/orders/${orderId}/statut`, { statut });
      setAnnulation(false);
      await charger();
      if (onMaj) onMaj();
    } catch (e) {
      setAnnulation(false);
      setErreur(e instanceof ApiException ? e.message : 'Impossible de mettre à jour la commande.');
    } finally {
      setEnCours(false);
    }
  }

  const retour = (
    <TouchableOpacity onPress={onRetour} style={styles.retour} accessibilityRole="button" accessibilityLabel="Retour à la liste des commandes">
      <Ionicons name="chevron-back" size={20} color={COLORS.noir} />
      <Text style={styles.retourTexte}>Mes commandes</Text>
    </TouchableOpacity>
  );

  if (chargement) {
    return <View style={styles.page}><View style={styles.contenu}>{retour}<ActivityIndicator style={{ marginTop: 40 }} color={COLORS.or} /></View></View>;
  }
  if (!commande) {
    return (
      <View style={styles.page}>
        <View style={styles.contenu}>
          {retour}
          <Text style={styles.erreurPleine}>{erreur || 'Commande introuvable.'}</Text>
          <TouchableOpacity style={styles.bouton} onPress={charger}><Text style={styles.boutonTexte}>Réessayer</Text></TouchableOpacity>
        </View>
      </View>
    );
  }

  const c = commande;
  const prochaine = c.transitions_possibles.find((t) => t !== 'annulee') || null;
  const peutAnnuler = c.transitions_possibles.includes('annulee');
  const retrait = c.mode_livraison === 'retrait';
  const lieuRetrait = [c.boutique.adresse, c.boutique.ville].filter(Boolean).join(', ');

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={charger} tintColor={COLORS.or} />}
    >
      <View style={styles.contenu}>
        {retour}

        <View style={styles.entete}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titre}>Commande n° {c.numero}</Text>
            <Text style={styles.date}>Passée le {dateHeure(c.created_at)}</Text>
          </View>
          <BadgeStatut statut={c.statut} />
        </View>

        {erreur ? (
          <View style={styles.erreur} accessibilityLiveRegion="polite">
            <Ionicons name="alert-circle" size={18} color={COLORS.rouge} style={{ marginRight: 8 }} />
            <Text style={styles.erreurTexte}>{erreur}</Text>
          </View>
        ) : null}

        {cote === 'boutique' && (prochaine || peutAnnuler) ? (
          <View style={styles.actions}>
            {prochaine ? (
              <TouchableOpacity style={[styles.bouton, { flex: 1 }, enCours && { opacity: 0.6 }]} onPress={() => changerStatut(prochaine)} disabled={enCours} accessibilityRole="button">
                {enCours ? <ActivityIndicator color={COLORS.noir} /> : <Text style={styles.boutonTexte}>{LIBELLES_ACTION[prochaine] || prochaine}</Text>}
              </TouchableOpacity>
            ) : null}
            {peutAnnuler ? (
              <TouchableOpacity style={[styles.boutonAnnuler, enCours && { opacity: 0.6 }]} onPress={() => setAnnulation(true)} disabled={enCours} accessibilityRole="button">
                <Text style={styles.boutonAnnulerTexte}>Annuler la commande</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <Bloc titre="Suivi de la commande">
          <SuiviStatut statut={c.statut} historique={c.historique} creeLe={c.created_at} misAJourLe={c.updated_at} />
        </Bloc>

        <Bloc titre={`Articles (${c.nombre_articles})`}>
          {c.articles.map((a) => <LigneArticle key={a.id} article={a} />)}
          <View style={styles.totalLigne}>
            <Text style={styles.totalLibelle}>Total · {pluriel(c.nombre_articles, 'article')}</Text>
            <Text style={styles.totalValeur}>{fcfa(c.montant_total)}</Text>
          </View>
        </Bloc>

        <Bloc titre={retrait ? 'Retrait en boutique' : 'Livraison'}>
          <Text style={styles.texte}>{MODES_LIVRAISON[c.mode_livraison] || c.mode_livraison}</Text>
          {retrait ? (
            <Text style={styles.texteGris}>{lieuRetrait ? `À retirer chez ${c.boutique.nom} · ${lieuRetrait}` : `À retirer chez ${c.boutique.nom}`}</Text>
          ) : (
            <Text style={styles.texteGris}>{c.adresse_livraison ? `Adresse : ${c.adresse_livraison}` : 'Adresse non renseignée'}</Text>
          )}
          {!retrait ? <Text style={styles.texteGris}>Les frais de livraison sont à convenir avec le vendeur.</Text> : null}
        </Bloc>

        <Bloc titre="Paiement">
          <Text style={styles.texte}>
            {c.paiement.operateur === 'especes' ? 'Espèces, à la réception' : `${c.paiement.operateur} (paiement mobile non confirmé)`}
          </Text>
        </Bloc>

        {cote === 'boutique' && c.client ? (
          <Bloc titre="Client">
            <Text style={styles.texte}>{`${c.client.prenom || ''} ${c.client.nom || ''}`.trim() || 'Client'}</Text>
            {c.client.telephone ? (
              <TouchableOpacity style={styles.appel} onPress={() => ouvrirLien(`tel:${c.client.telephone}`)} accessibilityRole="link" accessibilityLabel={`Appeler ${c.client.telephone}`}>
                <Ionicons name="call" size={16} color={COLORS.noir} />
                <Text style={styles.appelTexte}>{c.client.telephone}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.texteGris}>Aucun numéro de téléphone enregistré.</Text>
            )}
          </Bloc>
        ) : (
          <Bloc titre="Boutique">
            <View style={styles.boutique}>
              <Avatar uri={c.boutique.logo_url} nom={c.boutique.nom} taille={44} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.texte}>{c.boutique.nom}</Text>
                {c.boutique.ville ? <Text style={styles.texteGris}>{c.boutique.ville}</Text> : null}
              </View>
              {onContacter ? (
                <TouchableOpacity style={styles.contact} onPress={() => onContacter(c.boutique)} accessibilityRole="button" accessibilityLabel={`Écrire à ${c.boutique.nom}`}>
                  <Ionicons name="chatbubble-ellipses-outline" size={17} color={COLORS.noir} />
                  <Text style={styles.contactTexte}>Écrire</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Bloc>
        )}
      </View>

      <ModaleConfirmation
        visible={annulation}
        titre="Annuler cette commande ?"
        message="Les articles seront remis en stock et le client sera prévenu par email s'il a une adresse email. Cette action est définitive."
        libelleConfirmer="Annuler la commande"
        destructif
        enCours={enCours}
        onConfirmer={() => changerStatut('annulee')}
        onAnnuler={() => setAnnulation(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.creme },
  contenu: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 16 },
  retour: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6 },
  retourTexte: { fontSize: 14, fontWeight: '700', color: COLORS.noir },
  entete: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  titre: { fontSize: 20, fontWeight: '900', color: COLORS.noir },
  date: { fontSize: 12.5, color: COLORS.gris, marginTop: 3 },
  erreur: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDECEA', borderRadius: 10, padding: 12, marginTop: 12 },
  erreurTexte: { flex: 1, color: COLORS.rouge, fontSize: 13, lineHeight: 18 },
  erreurPleine: { color: COLORS.rouge, textAlign: 'center', marginTop: 30, fontSize: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  bouton: { backgroundColor: COLORS.or, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', minWidth: 150 },
  boutonTexte: { fontWeight: '800', fontSize: 14.5, color: COLORS.noir },
  boutonAnnuler: { borderWidth: 1.5, borderColor: COLORS.rouge, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  boutonAnnulerTexte: { fontWeight: '700', color: COLORS.rouge, fontSize: 14 },
  bloc: { backgroundColor: COLORS.blanc, borderRadius: 14, padding: 16, marginTop: 14, borderWidth: 1, borderColor: '#EFECE4' },
  titreBloc: { fontSize: 14.5, fontWeight: '900', color: COLORS.noir, marginBottom: 12 },
  totalLigne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  totalLibelle: { fontSize: 13.5, color: COLORS.gris, fontWeight: '600' },
  totalValeur: { fontSize: 18, fontWeight: '900', color: COLORS.noir },
  texte: { fontSize: 14, fontWeight: '600', color: COLORS.noir },
  texteGris: { fontSize: 13, color: COLORS.gris, marginTop: 4, lineHeight: 18 },
  appel: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: COLORS.or, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, marginTop: 10 },
  appelTexte: { marginLeft: 8, fontWeight: '800', color: COLORS.noir, fontSize: 13.5 },
  boutique: { flexDirection: 'row', alignItems: 'center' },
  contact: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.or, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  contactTexte: { fontWeight: '800', color: COLORS.noir, marginLeft: 6, fontSize: 13 },
});
