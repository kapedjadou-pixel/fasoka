import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { ApiClient, ApiException } from '../../api/apiClient';
import { useSpace } from '../../context/SpaceContext';
import { useAuth } from '../../context/AuthContext';
import { useMessagerie } from '../../context/MessagerieContext';
import useRetourEnArriere from '../../hooks/useRetourEnArriere';
import { STATUTS_COMMANDE } from '../../config/statuts';
import { horodatageListe } from '../../components/messagerie/formatage';
import SelecteurPeriode from '../../components/dashboard/SelecteurPeriode';
import GraphiqueVentes from '../../components/dashboard/GraphiqueVentes';
import CarteIndicateur from '../../components/dashboard/CarteIndicateur';
import ActionsRapides from '../../components/dashboard/ActionsRapides';
import PlansBoutique from '../../components/dashboard/PlansBoutique';
import { fcfa, jourComplet, pluriel } from '../../components/dashboard/format';
import MaBoutiqueScreen from './MaBoutiqueScreen';

const LARGEUR_MAX = 1100;

function Section({ titre, action, onAction, children, style }) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.sectionEntete}>
        <Text style={styles.sectionTitre}>{titre}</Text>
        {action ? (
          <TouchableOpacity onPress={onAction} accessibilityRole="button">
            <Text style={styles.sectionAction}>{action}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

// Tableau de bord de la boutique : ventes par période, état des commandes et du catalogue, graphique,
// produits les plus vendus, dernières commandes, actions rapides et formules. Tous les chiffres viennent du serveur
// (commandes, produits et avis réels) : rien n'est inventé, et ce qui n'existe pas encore est dit clairement.
export default function BoutiqueDashboardScreen({ navigation }) {
  const { maBoutique } = useSpace();
  const { user } = useAuth();
  const { nonLusBoutique } = useMessagerie();
  const { width } = useWindowDimensions();

  const [vue, setVue] = useState('tableau'); // 'tableau' | 'boutique'
  const [periode, setPeriode] = useState({ type: '7j' });
  const [donnees, setDonnees] = useState(null);
  const [premierChargement, setPremierChargement] = useState(true);
  const [actualisation, setActualisation] = useState(false);
  const [erreur, setErreur] = useState(null);
  const numeroRequete = useRef(0);
  const periodeRef = useRef(periode);
  periodeRef.current = periode;

  useRetourEnArriere(vue !== 'tableau', () => setVue('tableau'));

  const charger = useCallback(async (p) => {
    if (!maBoutique) return;
    const numero = ++numeroRequete.current; // seule la réponse la plus récente est gardée
    setActualisation(true);
    try {
      const parametres = { periode: p.type };
      if (p.type === 'perso') {
        parametres.du = p.du;
        parametres.au = p.au;
      }
      const reponse = await ApiClient.get(`/shops/${maBoutique.id}/dashboard`, parametres);
      if (numero !== numeroRequete.current) return;
      setDonnees(reponse);
      setErreur(null);
    } catch (e) {
      if (numero === numeroRequete.current) {
        setErreur(e instanceof ApiException ? e.message : 'Impossible de charger le tableau de bord.');
      }
    } finally {
      if (numero === numeroRequete.current) {
        setPremierChargement(false);
        setActualisation(false);
      }
    }
  }, [maBoutique]);

  useEffect(() => { charger(periode); }, [charger, periode]);

  // Chiffres à jour à chaque retour sur l'onglet
  useEffect(() => navigation.addListener('focus', () => charger(periodeRef.current)), [navigation, charger]);

  if (vue === 'boutique') return <MaBoutiqueScreen onRetour={() => setVue('tableau')} />;

  if (!maBoutique) {
    return <View style={styles.centre}><Text style={styles.texteVide}>Aucune boutique sélectionnée.</Text></View>;
  }

  if (premierChargement) {
    return <View style={styles.centre}><ActivityIndicator size="large" color={COLORS.or} /></View>;
  }

  if (!donnees) {
    return (
      <View style={styles.centre}>
        <Ionicons name="cloud-offline-outline" size={40} color={COLORS.gris} />
        <Text style={styles.texteVide}>{erreur || 'Impossible de charger le tableau de bord.'}</Text>
        <TouchableOpacity style={styles.reessayer} onPress={() => charger(periode)} accessibilityRole="button">
          <Text style={styles.reessayerTexte}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const d = donnees;
  const large = width >= 900;
  const colonnes = large ? 4 : width >= 560 ? 3 : 2;
  const contenu = Math.min(width, LARGEUR_MAX) - 32;
  const ecart = 10;
  const largeurCarte = Math.floor((contenu - ecart * (colonnes - 1)) / colonnes);
  const messagesNonLus = nonLusBoutique(maBoutique.id);

  const aller = (nom, parametres) => () => navigation.navigate(nom, parametres);

  const resumePeriode = d.periode.jours === 1
    ? `${d.periode.du === new Date().toISOString().slice(0, 10) ? "Aujourd'hui · " : ''}${jourComplet(d.periode.du)}`
    : `Du ${jourComplet(d.periode.du)} au ${jourComplet(d.periode.au)} · ${d.periode.jours} jours`;

  const actions = [
    {
      cle: 'produit', icone: 'add-circle', titre: 'Ajouter un produit', sousTitre: 'Photos, description, prix et stock',
      couleur: COLORS.orFonce, fond: '#FFF6DB', onPress: aller('Catalogue', { screen: 'ProductEdit', initial: false }),
    },
    {
      cle: 'catalogue', icone: 'pricetags', titre: 'Gérer le catalogue',
      sousTitre: d.catalogue.actifs > 0 ? `${pluriel(d.catalogue.actifs, 'produit')} en vente` : 'Aucun produit pour le moment',
      couleur: '#2563EB', fond: '#E8F0FF', onPress: aller('Catalogue', { screen: 'CatalogueListe' }),
    },
    {
      cle: 'commandes', icone: 'bag-check', titre: 'Consulter les commandes',
      sousTitre: d.commandes.en_attente > 0 ? `${d.commandes.en_attente} à traiter` : 'Aucune commande en attente',
      badge: d.commandes.en_attente, couleur: '#15803D', fond: '#DCFCE7', onPress: aller('Commandes'),
    },
    {
      cle: 'messages', icone: 'chatbubbles', titre: 'Ouvrir les messages',
      sousTitre: messagesNonLus > 0 ? `${messagesNonLus} non lu${messagesNonLus > 1 ? 's' : ''}` : 'Discuter avec vos clients',
      badge: messagesNonLus, couleur: '#6D28D9', fond: '#EDE9FE', onPress: aller('Messages'),
    },
    {
      cle: 'boutique', icone: 'storefront', titre: 'Gérer la boutique', sousTitre: 'Nom, description, ville et adresse',
      couleur: COLORS.noir, fond: '#EFECE4', onPress: () => setVue('boutique'),
    },
  ];

  const note = d.avis.nombre > 0
    ? { valeur: `${String(d.avis.note_moyenne).replace('.', ',')} / 5`, sous: pluriel(d.avis.nombre, 'avis', 'avis') }
    : { valeur: '—', sous: "Pas encore d'avis" };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.creme }}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={actualisation && !premierChargement} onRefresh={() => charger(periode)} tintColor={COLORS.or} />}
    >
      <View style={styles.contenu}>
        {/* En-tête de la boutique */}
        <View style={styles.entete}>
          <View style={styles.enteteLogo}>
            {d.boutique.logo_url ? (
              <Image source={{ uri: d.boutique.logo_url }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Ionicons name="storefront" size={26} color={COLORS.noir} />
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.salutation}>Bonjour{user && user.prenom ? ` ${user.prenom}` : ''}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.nomBoutique} numberOfLines={1}>{d.boutique.nom_boutique}</Text>
              {d.boutique.badge_verifie ? <Ionicons name="checkmark-circle" size={18} color="#60A5FA" style={{ marginLeft: 6 }} /> : null}
            </View>
            <Text style={styles.enteteDetails} numberOfLines={1}>
              {[d.boutique.ville, d.boutique.plan === 'pro' ? 'Fasoka Pro' : 'Plan Gratuit', d.boutique.abonnes > 0 ? pluriel(d.boutique.abonnes, 'abonné') : null]
                .filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>

        {erreur ? (
          <TouchableOpacity style={styles.bandeauErreur} onPress={() => charger(periode)} accessibilityRole="button">
            <Text style={styles.bandeauErreurTexte}>{erreur} Touchez pour réessayer.</Text>
          </TouchableOpacity>
        ) : null}

        {/* Période */}
        <View style={styles.blocPeriode}>
          <SelecteurPeriode periode={periode} onChange={setPeriode} chargement={actualisation} />
          <Text style={styles.resumePeriode}>{resumePeriode}</Text>
        </View>

        {/* Chiffre d'affaires */}
        <View style={styles.hero}>
          <Text style={styles.heroLibelle}>Chiffre d'affaires</Text>
          <Text style={styles.heroValeur}>{fcfa(d.ventes.chiffre_affaires)}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
            {typeof d.ventes.evolution_pct === 'number' ? (
              <Text style={[styles.heroEvolution, { color: d.ventes.evolution_pct >= 0 ? '#4ADE80' : '#F87171' }]}>
                {d.ventes.evolution_pct >= 0 ? '▲ +' : '▼ '}{d.ventes.evolution_pct} %
              </Text>
            ) : null}
            <Text style={styles.heroDetail}>
              {typeof d.ventes.evolution_pct === 'number' ? ' vs période précédente · ' : ''}
              {pluriel(d.ventes.commandes_livrees, 'commande livrée', 'commandes livrées')}
              {d.ventes.panier_moyen ? ` · panier moyen ${fcfa(d.ventes.panier_moyen)}` : ''}
            </Text>
          </View>
        </View>

        {/* Indicateurs */}
        <View style={styles.grille}>
          <CarteIndicateur
            style={{ width: largeurCarte }}
            icone="receipt" libelle="Commandes reçues" valeur={String(d.commandes.recues)}
            sousTexte={d.commandes.annulees > 0 ? `dont ${pluriel(d.commandes.annulees, 'annulée')}` : 'sur la période'}
          />
          <CarteIndicateur
            style={{ width: largeurCarte }}
            icone="checkmark-done" libelle="Commandes livrées" valeur={String(d.ventes.commandes_livrees)}
            couleurIcone="#15803D" fondIcone="#DCFCE7" sousTexte="sur la période"
          />
          <CarteIndicateur
            style={{ width: largeurCarte }}
            icone="time" libelle="Commandes en cours" valeur={String(d.commandes.en_cours)}
            couleurIcone="#B45309" fondIcone="#FEF3C7"
            sousTexte={d.commandes.en_attente > 0 ? `dont ${d.commandes.en_attente} en attente` : 'à ce jour'}
            onPress={aller('Commandes')}
          />
          <CarteIndicateur
            style={{ width: largeurCarte }}
            icone="pricetags" libelle="Produits actifs" valeur={String(d.catalogue.actifs)}
            couleurIcone="#2563EB" fondIcone="#E8F0FF" sousTexte="en vente"
            onPress={aller('Catalogue', { screen: 'CatalogueListe' })}
          />
          <CarteIndicateur
            style={{ width: largeurCarte }}
            icone="alert-circle" libelle="Ruptures de stock" valeur={String(d.catalogue.ruptures)}
            couleurIcone={d.catalogue.ruptures > 0 ? COLORS.rouge : COLORS.gris} fondIcone={d.catalogue.ruptures > 0 ? '#FEE2E2' : '#F3F0E9'}
            alerte={d.catalogue.ruptures > 0}
            sousTexte={d.catalogue.stock_faible > 0 ? `${pluriel(d.catalogue.stock_faible, 'produit')} en stock faible` : 'aucun stock faible'}
            onPress={aller('Catalogue', { screen: 'CatalogueListe' })}
          />
          <CarteIndicateur
            style={{ width: largeurCarte }}
            icone="star" libelle="Note moyenne" valeur={note.valeur}
            couleurIcone="#B8860A" fondIcone="#FFF6DB" sousTexte={note.sous}
          />
        </View>

        {/* Actions rapides */}
        <Section titre="Actions rapides">
          <ActionsRapides actions={actions} colonnes={large ? 5 : width >= 560 ? 3 : 2} />
        </Section>

        {/* Graphique et produits les plus vendus */}
        <View style={{ flexDirection: large ? 'row' : 'column', gap: large ? 12 : 0 }}>
          <Section titre="Évolution des ventes" style={{ flex: large ? 2 : undefined }}>
            <GraphiqueVentes serie={d.serie} />
          </Section>
          <Section titre="Produits les plus vendus" style={{ flex: large ? 1 : undefined }}>
            {d.plus_vendus.length === 0 ? (
              <Text style={styles.texteSection}>Aucune vente sur cette période.</Text>
            ) : (
              d.plus_vendus.map((p, i) => (
                <View key={p.id} style={styles.ligneProduit}>
                  <Text style={styles.rang}>{i + 1}</Text>
                  <View style={styles.miniature}>
                    {p.image ? <Image source={{ uri: p.image }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="cube-outline" size={18} color={COLORS.gris} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.produitNom}>{p.nom}</Text>
                    <Text style={styles.produitDetail}>{pluriel(p.quantite, 'vendu')} · {fcfa(p.montant)}</Text>
                  </View>
                </View>
              ))
            )}
          </Section>
        </View>

        {/* Dernières commandes */}
        <Section titre="Dernières commandes" action={d.dernieres_commandes.length > 0 ? 'Voir toutes' : null} onAction={aller('Commandes')}>
          {d.dernieres_commandes.length === 0 ? (
            <Text style={styles.texteSection}>Aucune commande pour le moment. Elles apparaîtront ici dès que vos clients commanderont.</Text>
          ) : (
            d.dernieres_commandes.map((o) => {
              const statut = STATUTS_COMMANDE[o.statut] || { libelle: o.statut, couleur: COLORS.noir, fond: '#EFECE4' };
              return (
                <TouchableOpacity key={o.id} style={styles.ligneCommande} onPress={aller('Commandes')} accessibilityRole="button" accessibilityLabel={`Commande de ${o.client}, ${statut.libelle}`}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.commandeClient}>{o.client}</Text>
                    <Text style={styles.commandeDetail}>{horodatageListe(o.created_at)} · {fcfa(o.montant_total)}</Text>
                  </View>
                  <View style={[styles.statut, { backgroundColor: statut.fond }]}>
                    <Text style={[styles.statutTexte, { color: statut.couleur }]}>{statut.libelle}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </Section>

        {/* Formules */}
        <Section titre="Votre formule">
          <PlansBoutique plan={d.boutique.plan} />
        </Section>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: COLORS.creme },
  texteVide: { fontSize: 14, color: COLORS.gris, textAlign: 'center', marginTop: 12, lineHeight: 20, maxWidth: 320 },
  reessayer: { backgroundColor: COLORS.or, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginTop: 14 },
  reessayerTexte: { fontWeight: '800', color: COLORS.noir },

  contenu: { width: '100%', maxWidth: LARGEUR_MAX, alignSelf: 'center', padding: 16 },
  entete: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.noir, borderRadius: 16, padding: 16 },
  enteteLogo: { width: 56, height: 56, borderRadius: 16, backgroundColor: COLORS.or, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  salutation: { fontSize: 12.5, color: 'rgba(255,255,255,0.7)' },
  nomBoutique: { fontSize: 20, fontWeight: '900', color: COLORS.blanc, flexShrink: 1 },
  enteteDetails: { fontSize: 12.5, color: COLORS.or, marginTop: 2 },
  bandeauErreur: { backgroundColor: '#FDECEA', borderRadius: 10, padding: 10, marginTop: 12 },
  bandeauErreurTexte: { color: COLORS.rouge, fontSize: 13 },

  blocPeriode: { marginTop: 16 },
  resumePeriode: { fontSize: 12.5, color: COLORS.gris, marginTop: 10 },

  hero: { backgroundColor: COLORS.blanc, borderRadius: 16, padding: 18, marginTop: 14, borderWidth: 1, borderColor: '#EFECE4', borderLeftWidth: 5, borderLeftColor: COLORS.or },
  heroLibelle: { fontSize: 13, fontWeight: '700', color: COLORS.gris },
  heroValeur: { fontSize: 32, fontWeight: '900', color: COLORS.noir, marginTop: 4 },
  heroEvolution: { fontSize: 13.5, fontWeight: '800' },
  heroDetail: { fontSize: 13, color: COLORS.gris },

  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },

  section: { backgroundColor: 'transparent', marginTop: 20 },
  sectionEntete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitre: { fontSize: 16, fontWeight: '900', color: COLORS.noir },
  sectionAction: { fontSize: 13, fontWeight: '700', color: COLORS.orFonce },
  texteSection: { fontSize: 13.5, color: COLORS.gris, lineHeight: 19, backgroundColor: COLORS.blanc, borderRadius: 14, padding: 16, overflow: 'hidden' },

  ligneProduit: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blanc, borderRadius: 12, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#EFECE4' },
  rang: { width: 22, fontSize: 14, fontWeight: '900', color: COLORS.orFonce },
  miniature: { width: 40, height: 40, borderRadius: 8, backgroundColor: COLORS.creme, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 10 },
  produitNom: { fontSize: 13.5, fontWeight: '700', color: COLORS.noir },
  produitDetail: { fontSize: 12, color: COLORS.gris, marginTop: 2 },

  ligneCommande: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blanc, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#EFECE4' },
  commandeClient: { fontSize: 14, fontWeight: '700', color: COLORS.noir },
  commandeDetail: { fontSize: 12, color: COLORS.gris, marginTop: 2 },
  statut: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 10 },
  statutTexte: { fontSize: 11.5, fontWeight: '800' },
});
