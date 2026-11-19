import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Platform, BackHandler, StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../theme/colors';
import { ApiClient, ApiException } from '../../api/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useSpace } from '../../context/SpaceContext';
import { useAjoutPanier } from '../../context/CartContext';
import useRetourEnArriere from '../../hooks/useRetourEnArriere';
import { FILTRES_VIDES, TAILLE_PAGE, TRIS, nombreFiltresActifs, parametresFiltres, mesureGrille } from '../../config/accueil';
import { fcfa } from '../../components/dashboard/format';
import ProductDetail from '../../components/ProductDetail';
import BoutiquePage from '../../components/BoutiquePage';
import BarreRecherche from '../../components/accueil/BarreRecherche';
import PanneauFiltres from '../../components/accueil/PanneauFiltres';
import PanneauCategories from '../../components/accueil/PanneauCategories';
import CarteProduit from '../../components/accueil/CarteProduit';
import CarteBoutique from '../../components/accueil/CarteBoutique';
import RangeeHorizontale from '../../components/accueil/RangeeHorizontale';
import SqueletteCartes from '../../components/accueil/SqueletteCartes';

const CLE_RECENTES = 'fasoka_recherches_recentes';
const MAX_RECENTES = 5;

// Nouvelle graine de mélange : une valeur au hasard donne un nouvel ordre des produits
function nouvelleGraine() {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

// Accueil client : salutation, recherche avec suggestions, filtres, catégories, sections (Nouveautés, Tendances, Boutiques),
// puis les produits (mélangés entre boutiques par défaut) par pages de 24. La fiche produit et la page boutique s'ouvrent
// par-dessus l'accueil (une seule à la fois) ; le bouton Retour les referme.
export default function ClientHomeScreen({ navigation }) {
  const { user } = useAuth();
  const { maBoutique } = useSpace();
  const { width } = useWindowDimensions();
  const { demanderAjout, modale: modaleAjout } = useAjoutPanier();
  const grille = mesureGrille(width);

  const [produits, setProduits] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [chargementPlus, setChargementPlus] = useState(false);
  const [aPlus, setAPlus] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [actualisation, setActualisation] = useState(false);
  const [recherche, setRecherche] = useState(''); // texte tapé dans la barre
  const [termeActif, setTermeActif] = useState(''); // recherche lancée
  const [filtres, setFiltres] = useState(FILTRES_VIDES);
  const [sections, setSections] = useState(null);
  const [categories, setCategories] = useState([]);
  const [villes, setVilles] = useState([]);
  const [recentes, setRecentes] = useState([]);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [categoriesOuvertes, setCategoriesOuvertes] = useState(false);
  const [vue, setVue] = useState(null); // { type: 'produit', produit } | { type: 'boutique', id, apercu }
  const [dernierAjout, setDernierAjout] = useState(null);

  const graine = useRef(nouvelleGraine());
  const page = useRef(1);
  const numeroRequete = useRef(0);
  const termeRef = useRef('');
  const filtresRef = useRef(FILTRES_VIDES);
  const vueRef = useRef(null);
  vueRef.current = vue;
  const entreeRecherche = useRef(false); // vrai si une entrée a été ajoutée à l'historique du navigateur (recherche active)

  // Le bouton Retour (navigateur ou téléphone) ferme d'abord la fiche produit / la page boutique
  useRetourEnArriere(vue !== null, () => setVue(null));

  // ----- Chargement -----
  const charger = useCallback(async (options = {}) => {
    const texte = options.texte !== undefined ? options.texte : termeRef.current;
    const f = options.filtres || filtresRef.current;
    const numero = ++numeroRequete.current; // seule la réponse la plus récente est gardée
    setChargement(true);
    setErreur(null);
    try {
      const parametres = { seed: graine.current, page: 1, ...parametresFiltres(f) };
      if (texte) parametres.recherche = texte;
      const donnees = await ApiClient.get('/products/feed', parametres);
      if (numero !== numeroRequete.current) return;
      page.current = 1;
      setProduits(donnees);
      setAPlus(donnees.length >= TAILLE_PAGE);
    } catch (e) {
      if (numero === numeroRequete.current) {
        setErreur(e instanceof ApiException ? e.message : 'Impossible de charger les produits.');
      }
    } finally {
      if (numero === numeroRequete.current) {
        setChargement(false);
        setActualisation(false);
      }
    }
  }, []);

  async function chargerPlus() {
    if (chargementPlus || !aPlus) return;
    setChargementPlus(true);
    const suivante = page.current + 1;
    try {
      const parametres = { seed: graine.current, page: suivante, ...parametresFiltres(filtresRef.current) };
      if (termeRef.current) parametres.recherche = termeRef.current;
      const donnees = await ApiClient.get('/products/feed', parametres);
      page.current = suivante;
      setProduits((prec) => {
        const connus = new Set(prec.map((p) => p.id));
        return [...prec, ...donnees.filter((p) => !connus.has(p.id))];
      });
      setAPlus(donnees.length >= TAILLE_PAGE);
    } catch (e) {
      setErreur(e instanceof ApiException ? e.message : 'Impossible de charger plus de produits.');
    } finally {
      setChargementPlus(false);
    }
  }

  const chargerSections = useCallback(() => {
    ApiClient.get('/products/accueil', { seed: graine.current }).then(setSections).catch(() => {});
  }, []);

  useEffect(() => {
    charger();
    chargerSections();
    ApiClient.get('/products/categories').then(setCategories).catch(() => {});
    ApiClient.get('/products/villes').then(setVilles).catch(() => {});
    AsyncStorage.getItem(CLE_RECENTES).then((v) => { if (v) setRecentes(JSON.parse(v)); }).catch(() => {});
  }, [charger, chargerSections]);

  // Tirer l'écran vers le bas : nouvel ordre des produits
  function rafraichir() {
    graine.current = nouvelleGraine();
    setActualisation(true);
    charger();
    chargerSections();
  }

  // ----- Recherche (avec l'entrée d'historique du navigateur : Retour efface la recherche) -----
  function ajouterEntreeHistorique() {
    if (Platform.OS === 'web' && !entreeRecherche.current) {
      window.history.pushState({ fasokaRecherche: true }, '');
      entreeRecherche.current = true;
    }
  }

  function retirerEntreeHistorique() {
    if (Platform.OS === 'web' && entreeRecherche.current) {
      entreeRecherche.current = false;
      window.history.back();
    }
  }

  function memoriserRecherche(texte) {
    setRecentes((prec) => {
      const suivantes = [texte, ...prec.filter((t) => t.toLowerCase() !== texte.toLowerCase())].slice(0, MAX_RECENTES);
      AsyncStorage.setItem(CLE_RECENTES, JSON.stringify(suivantes)).catch(() => {});
      return suivantes;
    });
  }

  function effacerRecentes() {
    setRecentes([]);
    AsyncStorage.removeItem(CLE_RECENTES).catch(() => {});
  }

  function lancerRecherche(texteBrut) {
    const texte = String(texteBrut || '').trim();
    if (!texte) return;
    setRecherche(texte);
    setTermeActif(texte);
    termeRef.current = texte;
    memoriserRecherche(texte);
    ajouterEntreeHistorique();
    charger({ texte });
  }

  // Efface la recherche (les filtres restent). `retirerEntree` : faux quand c'est le bouton Retour qui l'a déjà fait.
  function reinitialiserRecherche(retirerEntree = true) {
    setRecherche('');
    setTermeActif('');
    termeRef.current = '';
    charger({ texte: '' });
    if (retirerEntree) retirerEntreeHistorique();
  }

  // Efface la recherche ET les filtres
  function toutReinitialiser() {
    filtresRef.current = FILTRES_VIDES;
    setFiltres(FILTRES_VIDES);
    reinitialiserRecherche();
  }

  // Web : le bouton Retour du navigateur efface la recherche (sauf s'il ne fait que refermer la fiche produit / la boutique)
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const surRetour = () => {
      const etat = window.history.state || {};
      if (entreeRecherche.current && !etat.fasokaRecherche && !etat.fasokaVue) {
        entreeRecherche.current = false;
        reinitialiserRecherche(false);
      }
    };
    window.addEventListener('popstate', surRetour);
    return () => window.removeEventListener('popstate', surRetour);
  }, []);

  // Android : le bouton Retour efface la recherche au lieu de quitter l'accueil
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const abonnement = BackHandler.addEventListener('hardwareBackPress', () => {
      if (termeRef.current && navigation.isFocused() && !vueRef.current) {
        reinitialiserRecherche();
        return true;
      }
      return false;
    });
    return () => abonnement.remove();
  }, [navigation]);

  // ----- Filtres -----
  function appliquerFiltres(nouveaux) {
    filtresRef.current = nouveaux;
    setFiltres(nouveaux);
    setFiltresOuverts(false);
    setCategoriesOuvertes(false);
    charger({ filtres: nouveaux });
  }

  const choisirCategorie = (nom) => appliquerFiltres({ ...filtresRef.current, categorie: nom });

  // Filtres actifs affichés sous la recherche, chacun avec sa croix
  const puces = [];
  if (filtres.categorie) puces.push({ cle: 'categorie', libelle: filtres.categorie, retirer: { categorie: '' } });
  if (filtres.prixMin !== '' || filtres.prixMax !== '') {
    const libelle = filtres.prixMin !== '' && filtres.prixMax !== ''
      ? `${fcfa(filtres.prixMin)} à ${fcfa(filtres.prixMax)}`
      : filtres.prixMin !== '' ? `Dès ${fcfa(filtres.prixMin)}` : `Jusqu'à ${fcfa(filtres.prixMax)}`;
    puces.push({ cle: 'prix', libelle, retirer: { prixMin: '', prixMax: '' } });
  }
  if (filtres.ville) puces.push({ cle: 'ville', libelle: filtres.ville, retirer: { ville: '' } });
  if (filtres.publieDepuis) puces.push({ cle: 'date', libelle: `Publiés depuis ${filtres.publieDepuis} jours`, retirer: { publieDepuis: null } });
  if (filtres.enStock) puces.push({ cle: 'stock', libelle: 'En stock', retirer: { enStock: false } });
  if (filtres.tri !== 'melange') {
    const tri = TRIS.find((t) => t[0] === filtres.tri);
    puces.push({ cle: 'tri', libelle: `Tri : ${tri ? tri[1] : filtres.tri}`, retirer: { tri: 'melange' } });
  }

  const modeResultats = Boolean(termeActif) || puces.length > 0;

  // ----- Actions sur les produits -----
  const ouvrirProduit = (produit) => setVue({ type: 'produit', produit });
  const ouvrirBoutique = (id, apercu) => setVue({ type: 'boutique', id, apercu });

  function ajouterAuPanier(produit) {
    demanderAjout(produit, 1, () => {
      setDernierAjout(produit.id);
      setTimeout(() => setDernierAjout(null), 1200);
    });
  }

  // Ouvre une discussion avec la boutique du produit (onglet Messages), avec un message proposé
  function contacterBoutique(produit) {
    navigation.navigate('Messages', {
      ouvrir: { shop_id: produit.shop_id, produit_nom: produit.nom, cle: Date.now() },
    });
  }

  const apercuBoutique = (p) => ({ id: p.shop_id, nom_boutique: p.nom_boutique, logo_url: p.boutique_logo, ville: p.ville, badge_verifie: p.badge_verifie });
  const largeurRangee = Math.max(150, Math.min(grille.largeurCarte, 200));

  const carte = (p, largeur) => (
    <CarteProduit
      key={p.id}
      produit={p}
      largeur={largeur}
      ajoute={dernierAjout === p.id}
      onPress={ouvrirProduit}
      onAjouter={ajouterAuPanier}
      onContacter={!maBoutique || maBoutique.id !== p.shop_id ? contacterBoutique : null}
      onBoutique={(produit) => ouvrirBoutique(produit.shop_id, apercuBoutique(produit))}
    />
  );

  const heure = new Date().getHours();
  const salut = heure >= 18 || heure < 4 ? 'Bonsoir' : 'Bonjour';
  const aDesSections = !modeResultats && sections &&
    (sections.nouveautes.length + sections.tendances.length + sections.boutiques_verifiees.length + sections.boutiques.length) > 0;

  return (
    <View style={styles.page}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={actualisation} onRefresh={rafraichir} tintColor={COLORS.or} />}
      >
        <View style={[styles.contenu, { paddingHorizontal: grille.marge }]}>
          {/* Salutation et recherche */}
          <View style={styles.salutation}>
            <Text style={styles.salut}>{salut}{user && user.prenom ? `, ${user.prenom}` : ''}</Text>
            <Text style={styles.salutSous}>Que cherchez-vous aujourd’hui ?</Text>
          </View>

          <BarreRecherche
            valeur={recherche}
            onChangeText={setRecherche}
            onSubmit={lancerRecherche}
            recentes={recentes}
            onEffacerRecentes={effacerRecentes}
            onChoisirRecente={lancerRecherche}
            onChoisirProduit={(p) => ouvrirProduit({ id: p.id, nom: p.nom, prix: p.prix, shop_id: p.shop_id, images: p.image ? [p.image] : [] })}
            onChoisirCategorie={choisirCategorie}
            onChoisirBoutique={(b) => ouvrirBoutique(b.id, b)}
            nombreFiltres={nombreFiltresActifs(filtres)}
            onOuvrirFiltres={() => setFiltresOuverts(true)}
          />

          {/* Catégories */}
          {categories.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity style={[styles.puce, !filtres.categorie && styles.puceActive]} onPress={() => choisirCategorie('')} accessibilityRole="button" accessibilityState={{ selected: !filtres.categorie }}>
                <Text style={[styles.puceTexte, !filtres.categorie && styles.puceTexteActive]}>Tous</Text>
              </TouchableOpacity>
              {categories.slice(0, 10).map((c) => (
                <TouchableOpacity key={c.nom} style={[styles.puce, filtres.categorie === c.nom && styles.puceActive]} onPress={() => choisirCategorie(c.nom)} accessibilityRole="button" accessibilityState={{ selected: filtres.categorie === c.nom }}>
                  <Text style={[styles.puceTexte, filtres.categorie === c.nom && styles.puceTexteActive]}>{c.nom} ({c.nombre})</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.puceToutes} onPress={() => setCategoriesOuvertes(true)} accessibilityRole="button" accessibilityLabel="Voir toutes les catégories">
                <Ionicons name="grid-outline" size={15} color={COLORS.noir} />
                <Text style={styles.puceTexte}>Toutes les catégories</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : null}

          {/* Filtres actifs */}
          {puces.length > 0 ? (
            <View style={styles.actifs}>
              {puces.map((p) => (
                <TouchableOpacity key={p.cle} style={styles.puceActifFiltre} onPress={() => appliquerFiltres({ ...filtresRef.current, ...p.retirer })} accessibilityRole="button" accessibilityLabel={`Retirer le filtre ${p.libelle}`}>
                  <Text style={styles.puceActifFiltreTexte} numberOfLines={1}>{p.libelle}</Text>
                  <Ionicons name="close" size={14} color={COLORS.noir} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={toutReinitialiser} accessibilityRole="button"><Text style={styles.toutEffacer}>Tout effacer</Text></TouchableOpacity>
            </View>
          ) : null}

          {/* Sections */}
          {aDesSections ? (
            <>
              {sections.nouveautes.length > 0 ? (
                <RangeeHorizontale titre="Nouveautés" sousTitre="Publiés ces 14 derniers jours">
                  {sections.nouveautes.map((p) => carte(p, largeurRangee))}
                </RangeeHorizontale>
              ) : null}
              {sections.tendances.length > 0 ? (
                <RangeeHorizontale titre="Produits tendances" sousTitre="Les plus vendus ces 30 derniers jours">
                  {sections.tendances.map((p) => carte(p, largeurRangee))}
                </RangeeHorizontale>
              ) : null}
              {sections.boutiques_verifiees.length > 0 ? (
                <RangeeHorizontale titre="Boutiques vérifiées" sousTitre="Des vendeurs dont l'identité a été vérifiée">
                  {sections.boutiques_verifiees.map((b) => <CarteBoutique key={b.id} boutique={b} onPress={(boutique) => ouvrirBoutique(boutique.id, boutique)} />)}
                </RangeeHorizontale>
              ) : null}
              {sections.boutiques.length > 0 ? (
                <RangeeHorizontale titre="Boutiques à découvrir" sousTitre="Touchez une boutique pour voir tous ses produits">
                  {sections.boutiques.map((b) => <CarteBoutique key={b.id} boutique={b} onPress={(boutique) => ouvrirBoutique(boutique.id, boutique)} />)}
                </RangeeHorizontale>
              ) : null}
            </>
          ) : null}

          {/* Produits */}
          <View style={styles.titreLigne}>
            <Text style={styles.titreSection}>
              {termeActif ? `Résultats pour « ${termeActif} »` : filtres.categorie ? filtres.categorie : modeResultats ? 'Résultats' : 'Produits à découvrir'}
            </Text>
            {termeActif ? (
              <TouchableOpacity onPress={() => reinitialiserRecherche()} accessibilityRole="button"><Text style={styles.lien}>Effacer la recherche</Text></TouchableOpacity>
            ) : null}
          </View>

          {erreur ? (
            <TouchableOpacity style={styles.erreur} onPress={() => charger()} accessibilityRole="button">
              <Ionicons name="cloud-offline-outline" size={18} color={COLORS.rouge} />
              <Text style={styles.erreurTexte}>{erreur} Touchez pour réessayer.</Text>
            </TouchableOpacity>
          ) : null}

          {chargement && produits.length === 0 && !erreur ? (
            <SqueletteCartes nombre={grille.colonnes * 2} largeur={grille.largeurCarte} ecart={grille.ecart} />
          ) : produits.length === 0 && !erreur ? (
            <View style={styles.vide}>
              <Ionicons name="search-outline" size={46} color={COLORS.gris} />
              <Text style={styles.videTitre}>Aucun produit trouvé</Text>
              <Text style={styles.videTexte}>
                {modeResultats ? 'Essayez d’autres mots, ou retirez un filtre pour élargir la recherche.' : 'Les produits des boutiques apparaîtront ici.'}
              </Text>
              {modeResultats ? (
                <TouchableOpacity style={styles.boutonVide} onPress={toutReinitialiser} accessibilityRole="button">
                  <Text style={styles.boutonVideTexte}>Tout réinitialiser</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: grille.ecart }}>
              {produits.map((p) => carte(p, grille.largeurCarte))}
            </View>
          )}

          {aPlus && produits.length > 0 ? (
            <TouchableOpacity style={[styles.voirPlus, chargementPlus && { opacity: 0.7 }]} onPress={chargerPlus} disabled={chargementPlus} accessibilityRole="button">
              {chargementPlus ? <ActivityIndicator color={COLORS.noir} /> : <Text style={styles.voirPlusTexte}>Voir plus de produits</Text>}
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      <PanneauFiltres visible={filtresOuverts} filtres={filtres} categories={categories} villes={villes} onAppliquer={appliquerFiltres} onFermer={() => setFiltresOuverts(false)} />
      <PanneauCategories visible={categoriesOuvertes} categories={categories} active={filtres.categorie} onChoisir={choisirCategorie} onFermer={() => setCategoriesOuvertes(false)} />

      {modaleAjout}

      {vue && vue.type === 'produit' ? (
        <ProductDetail
          key={vue.produit.id}
          produit={vue.produit}
          maBoutiqueId={maBoutique ? maBoutique.id : null}
          onFermer={() => setVue(null)}
          onContacter={(produit) => { setVue(null); contacterBoutique(produit); }}
          onVoirPanier={() => { setVue(null); navigation.navigate('Panier'); }}
          onOuvrirAutre={(produit) => setVue({ type: 'produit', produit })}
          onOuvrirBoutique={(id, apercu) => ouvrirBoutique(id, apercu)}
        />
      ) : null}

      {vue && vue.type === 'boutique' ? (
        <BoutiquePage
          key={vue.id}
          boutiqueId={vue.id}
          apercu={vue.apercu}
          maBoutiqueId={maBoutique ? maBoutique.id : null}
          onFermer={() => setVue(null)}
          onOuvrirProduit={ouvrirProduit}
          onContacter={(boutique) => {
            setVue(null);
            navigation.navigate('Messages', { ouvrir: { shop_id: boutique.id, cle: Date.now() } });
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.creme },
  contenu: { width: '100%', maxWidth: 1400, alignSelf: 'center', paddingTop: 16 },
  salutation: { marginBottom: 12 },
  salut: { fontSize: 24, fontWeight: '900', color: COLORS.noir },
  salutSous: { fontSize: 14, color: COLORS.gris, marginTop: 2 },

  puce: { backgroundColor: COLORS.blanc, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#E6E2D8' },
  puceActive: { backgroundColor: COLORS.noir, borderColor: COLORS.noir },
  puceTexte: { fontSize: 13, fontWeight: '600', color: COLORS.noir },
  puceTexteActive: { color: COLORS.or, fontWeight: '800' },
  puceToutes: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF6DB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.or },

  actifs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 },
  puceActifFiltre: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.or, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, maxWidth: 260 },
  puceActifFiltreTexte: { fontSize: 12.5, fontWeight: '700', color: COLORS.noir, flexShrink: 1 },
  toutEffacer: { fontSize: 13, fontWeight: '700', color: COLORS.rouge },

  titreLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 12, gap: 10 },
  titreSection: { fontSize: 19, fontWeight: '900', color: COLORS.noir, flexShrink: 1 },
  lien: { fontSize: 13, fontWeight: '700', color: COLORS.orFonce },

  erreur: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FDECEA', borderRadius: 10, padding: 12, marginBottom: 12 },
  erreurTexte: { flex: 1, color: COLORS.rouge, fontSize: 13, lineHeight: 18 },

  vide: { alignItems: 'center', paddingVertical: 50 },
  videTitre: { fontSize: 17, fontWeight: '800', color: COLORS.noir, marginTop: 12 },
  videTexte: { fontSize: 13.5, color: COLORS.gris, textAlign: 'center', marginTop: 6, maxWidth: 320, lineHeight: 19 },
  boutonVide: { backgroundColor: COLORS.or, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 22, marginTop: 16 },
  boutonVideTexte: { fontWeight: '800', color: COLORS.noir },

  voirPlus: { alignSelf: 'center', minWidth: 240, backgroundColor: COLORS.blanc, borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.noir, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  voirPlusTexte: { fontWeight: '800', color: COLORS.noir, fontSize: 14.5 },
});
