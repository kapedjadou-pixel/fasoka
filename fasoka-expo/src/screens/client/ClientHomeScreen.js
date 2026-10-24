import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, Image, TouchableOpacity,
  ActivityIndicator, StyleSheet, useWindowDimensions, Platform, BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { ApiClient } from '../../api/apiClient';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';

const LARGEUR_MAX = 1200; // largeur maximale du contenu sur grand écran
const ECART = 10; // espace entre les cartes
const MARGE = 12; // marge à gauche et à droite

// Nombre de colonnes selon la largeur disponible : 2 sur téléphone, jusqu'à 5 sur grand écran
function nombreColonnes(largeur) {
  if (largeur >= 1100) return 5;
  if (largeur >= 800) return 4;
  if (largeur >= 560) return 3;
  return 2;
}

// Prénom à afficher : celui du client connecté (à défaut, son nom). Un prénom saisi tout en majuscules
// ou tout en minuscules est remis en forme (ex : « KOMI » devient « Komi », « jean-pierre » devient « Jean-Pierre »).
function prenomAffichable(user) {
  if (!user) return null;
  const brut = String(user.prenom || user.nom || '').trim();
  if (!brut) return null;
  if (brut !== brut.toUpperCase() && brut !== brut.toLowerCase()) return brut;
  return brut
    .toLowerCase()
    .split(/([\s'-]+)/)
    .map((morceau) => morceau.charAt(0).toUpperCase() + morceau.slice(1))
    .join('');
}

export default function ClientHomeScreen({ navigation }) {
  const { ajouter } = useCart();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [produits, setProduits] = useState([]);
  const [recherche, setRecherche] = useState(''); // texte tapé dans la barre de recherche
  const [termeActif, setTermeActif] = useState(''); // recherche actuellement affichée ('' = tous les produits)
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [dernierAjout, setDernierAjout] = useState(null);
  const entreeHistorique = useRef(false); // vrai si une entrée a été ajoutée à l'historique du navigateur

  const largeurContenu = Math.min(width, LARGEUR_MAX);
  const colonnes = nombreColonnes(largeurContenu);
  // Largeur fixe calculée pour chaque carte : une carte seule ne s'étire plus sur toute la ligne
  const largeurCarte = (largeurContenu - MARGE * 2 - ECART * (colonnes - 1)) / colonnes;

  const charger = useCallback(async (texte) => {
    setChargement(true);
    setErreur(null);
    try {
      const data = await ApiClient.get('/products/feed', texte ? { recherche: texte } : undefined);
      setProduits(data);
    } catch (e) {
      setErreur('Impossible de charger les produits.');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Revient à la liste complète des produits (aucune recherche)
  const afficherTout = useCallback(() => {
    entreeHistorique.current = false;
    setRecherche('');
    setTermeActif('');
    charger();
  }, [charger]);

  // Lance une recherche. Sur le web, on ajoute UNE entrée dans l'historique du navigateur :
  // ainsi le bouton Retour ramène à la liste complète au lieu de quitter le site.
  function lancerRecherche() {
    const texte = recherche.trim();
    if (!texte) {
      quitterRecherche();
      return;
    }
    if (Platform.OS === 'web' && !entreeHistorique.current) {
      window.history.pushState({ fasokaRecherche: true }, '');
      entreeHistorique.current = true;
    }
    setTermeActif(texte);
    charger(texte);
  }

  // Sort de la recherche. Sur le web, on passe par le retour arrière du navigateur
  // (qui déclenche 'popstate', géré plus bas) pour garder un historique propre.
  function quitterRecherche() {
    if (Platform.OS === 'web' && entreeHistorique.current) {
      window.history.back();
    } else {
      afficherTout();
    }
  }

  // Web : le bouton Retour du navigateur ramène à la liste complète
  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    const surRetour = () => {
      if (entreeHistorique.current) afficherTout();
    };
    window.addEventListener('popstate', surRetour);
    return () => window.removeEventListener('popstate', surRetour);
  }, [afficherTout]);

  // Android : le bouton Retour du téléphone sort de la recherche au lieu de fermer l'app
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const abonnement = BackHandler.addEventListener('hardwareBackPress', () => {
      if (termeActif && navigation.isFocused()) {
        afficherTout();
        return true;
      }
      return false;
    });
    return () => abonnement.remove();
  }, [termeActif, afficherTout, navigation]);

  // Un appui sur l'onglet "Accueil" (déjà affiché) ramène à la liste complète
  useEffect(() => {
    const desabonner = navigation.addListener('tabPress', () => {
      if (termeActif && navigation.isFocused()) quitterRecherche();
    });
    return desabonner;
  }, [navigation, termeActif]);

  function ajouterAuPanier(produit) {
    ajouter(produit);
    setDernierAjout(produit.id);
    setTimeout(() => setDernierAjout(null), 1200);
  }

  function carteProduit({ item }) {
    const stock = Number(item.stock_quantite) || 0;
    const rupture = stock <= 0;
    const photo = item.images && item.images.length > 0 ? item.images[0] : null;

    return (
      <View style={[styles.carte, { width: largeurCarte }]}>
        <View style={styles.imageZone}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.image} resizeMode="cover" />
          ) : (
            <Ionicons name="cube-outline" size={40} color={COLORS.gris} />
          )}
          <TouchableOpacity
            style={[styles.boutonAjout, rupture && styles.boutonDesactive]}
            disabled={rupture}
            onPress={() => ajouterAuPanier(item)}
          >
            <Ionicons name={dernierAjout === item.id ? 'checkmark' : 'add'} size={20} color={COLORS.noir} />
          </TouchableOpacity>
        </View>

        <View style={styles.infos}>
          <Text numberOfLines={2} style={styles.nom}>{item.nom}</Text>
          <Text style={styles.prix}>{Number(item.prix).toLocaleString('fr-FR')} F CFA</Text>
          <View style={styles.ligneBoutique}>
            {item.badge_verifie ? (
              <Ionicons name="checkmark-circle" size={13} color="#2563EB" style={{ marginRight: 3 }} />
            ) : null}
            <Text numberOfLines={1} style={styles.boutique}>{item.nom_boutique}</Text>
          </View>
          {item.ville ? (
            <View style={styles.ligneVille}>
              <Ionicons name="location-outline" size={12} color={COLORS.gris} />
              <Text numberOfLines={1} style={styles.ville}>{item.ville}</Text>
            </View>
          ) : null}
          {rupture ? (
            <Text style={styles.rupture}>Rupture de stock</Text>
          ) : stock <= 5 ? (
            <Text style={styles.stockFaible}>Plus que {stock} en stock</Text>
          ) : null}
        </View>
      </View>
    );
  }

  // Message de bienvenue : prénom du client connecté, ou message neutre si le profil n'est pas (encore) disponible
  const prenom = prenomAffichable(user);
  const messageBienvenue = prenom ? 'Bienvenue, ' + prenom + ' !' : 'Bienvenue sur FASOKA !';

  const entete = (
    <View style={{ paddingHorizontal: MARGE, paddingTop: 14 }}>
      <View style={styles.bienvenue}>
        <Text style={styles.bienvenueTitre} numberOfLines={2}>{messageBienvenue}</Text>
        <Text style={styles.bienvenueSousTitre}>Découvrez les produits et boutiques près de chez vous.</Text>
      </View>

      <View style={styles.rechercheLigne}>
        <TextInput
          style={styles.rechercheInput}
          placeholder="Rechercher un produit..."
          placeholderTextColor={COLORS.gris}
          value={recherche}
          onChangeText={setRecherche}
          onSubmitEditing={lancerRecherche}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.rechercheBouton} onPress={lancerRecherche}>
          <Text style={styles.rechercheBoutonTexte}>Rechercher</Text>
        </TouchableOpacity>
      </View>

      {termeActif ? (
        <View style={styles.barreResultats}>
          <Text style={styles.resultatsTexte} numberOfLines={1}>Résultats pour « {termeActif} »</Text>
          <TouchableOpacity onPress={quitterRecherche} style={styles.resultatsLienLigne}>
            <Ionicons name="close-circle" size={15} color={COLORS.rouge} />
            <Text style={styles.resultatsLien}>Voir tous les produits</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.titreLigne}>
        <Text style={styles.titreSection}>{termeActif ? 'Résultats' : 'Produits à découvrir'}</Text>
        {!chargement && !erreur ? (
          <Text style={styles.compteur}>{produits.length} produit{produits.length > 1 ? 's' : ''}</Text>
        ) : null}
      </View>
    </View>
  );

  const messageVide = termeActif
    ? 'Aucun résultat pour « ' + termeActif + ' ».'
    : 'Aucun produit trouvé.';

  const vide = chargement ? (
    <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.or} />
  ) : (
    <Text style={styles.message}>{erreur || messageVide}</Text>
  );

  return (
    <View style={styles.page}>
      <View style={{ flex: 1, width: largeurContenu }}>
        <FlatList
          key={colonnes}
          data={chargement ? [] : produits}
          keyExtractor={(item) => item.id}
          numColumns={colonnes}
          columnWrapperStyle={{ gap: ECART, paddingHorizontal: MARGE }}
          ListHeaderComponent={entete}
          ListEmptyComponent={vide}
          renderItem={carteProduit}
          refreshing={false}
          onRefresh={() => charger(termeActif)}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.creme, alignItems: 'center' },
  bienvenue: { borderLeftWidth: 3, borderLeftColor: COLORS.or, paddingLeft: 10, marginBottom: 14 },
  bienvenueTitre: { fontSize: 20, fontWeight: '800', color: COLORS.noir },
  bienvenueSousTitre: { fontSize: 12.5, color: COLORS.gris, marginTop: 2, lineHeight: 17 },
  rechercheLigne: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
    borderRadius: 24, borderWidth: 2, borderColor: COLORS.or, paddingLeft: 14, overflow: 'hidden',
  },
  rechercheInput: { flex: 1, paddingVertical: 10, fontSize: 14 },
  rechercheBouton: { backgroundColor: COLORS.or, paddingHorizontal: 18, paddingVertical: 12 },
  rechercheBoutonTexte: { color: COLORS.noir, fontWeight: '700', fontSize: 13 },
  barreResultats: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, backgroundColor: '#FFF6D6', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, gap: 8,
  },
  resultatsTexte: { flex: 1, fontSize: 12, color: COLORS.noir },
  resultatsLienLigne: { flexDirection: 'row', alignItems: 'center' },
  resultatsLien: { fontSize: 12, fontWeight: '700', color: COLORS.rouge, marginLeft: 4 },
  titreLigne: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    marginTop: 18, marginBottom: 10,
  },
  titreSection: { fontSize: 17, fontWeight: '800', color: COLORS.noir },
  compteur: { fontSize: 12, color: COLORS.gris },
  message: { textAlign: 'center', color: COLORS.gris, marginTop: 40, paddingHorizontal: 20 },
  carte: { backgroundColor: 'white', borderRadius: 12, overflow: 'hidden', marginBottom: ECART },
  imageZone: {
    width: '100%', aspectRatio: 1, backgroundColor: COLORS.creme,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  boutonAjout: {
    position: 'absolute', right: 8, bottom: 8, width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.or, alignItems: 'center', justifyContent: 'center', elevation: 3,
  },
  boutonDesactive: { backgroundColor: '#dddddd' },
  infos: { padding: 10 },
  nom: { fontSize: 13, color: COLORS.noir, minHeight: 36, lineHeight: 18 },
  prix: { fontSize: 16, fontWeight: '800', color: COLORS.rouge, marginTop: 4 },
  ligneBoutique: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  boutique: { fontSize: 11, color: COLORS.gris, flexShrink: 1 },
  ligneVille: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  ville: { fontSize: 11, color: COLORS.gris, marginLeft: 3, flexShrink: 1 },
  stockFaible: { fontSize: 11, color: COLORS.rouge, marginTop: 4, fontWeight: '600' },
  rupture: { fontSize: 11, color: COLORS.gris, marginTop: 4, fontWeight: '600' },
});
