import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, Easing, Platform, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';

// Animations natives sur téléphone ; sur le web le moteur natif n'existe pas
const NATIF = Platform.OS !== 'web';
const DUREE_SLIDE = 5500; // temps d'affichage de chaque message
const DUREE_FONDU = 800; // durée du fondu entre deux messages

const LOGO = require('../../../assets/logo.png');
const LOGO_RATIO = 247 / 237; // largeur / hauteur du logo

// Messages présentés aux visiteurs. Chaque message a une icône centrale, trois petites cartes qui flottent,
// et un texte. Pour utiliser une vraie photo en fond (elle bouge doucement en zoom), mettre le fichier dans
// fasoka-expo/assets/auth/ et remplacer `image: null` par : image: require('../../../assets/auth/boutique.jpg')
const SLIDES = [
  {
    id: 'vendre',
    icone: 'storefront',
    titreDebut: 'Ouvrez votre ',
    titreAccent: 'boutique',
    titreFin: ' en quelques minutes',
    texte: 'Créez votre boutique, publiez vos produits avec des photos et faites-vous découvrir par de nouveaux clients.',
    image: null,
    cartes: [
      { icone: 'camera', titre: 'Produit publié', detail: 'Sac en cuir · 12 500 F CFA', cote: 'gauche', y: '3%', couleur: COLORS.or },
      { icone: 'people', titre: 'Nouveaux clients', detail: 'Ils découvrent votre boutique', cote: 'droite', y: '18%', couleur: COLORS.rouge },
      { icone: 'pricetags', titre: 'Catalogue en ligne', detail: 'Vos produits, toujours visibles', cote: 'gauche', y: '74%', couleur: COLORS.or },
    ],
  },
  {
    id: 'decouvrir',
    icone: 'compass',
    titreDebut: 'Découvrez des produits ',
    titreAccent: 'près de chez vous',
    titreFin: '',
    texte: "Parcourez les produits de nombreuses boutiques, recherchez ce qu'il vous faut et ajoutez-le au panier.",
    image: null,
    cartes: [
      { icone: 'search', titre: 'Rechercher un produit', detail: 'Parmi toutes les boutiques', cote: 'droite', y: '3%', couleur: COLORS.or },
      { icone: 'location', titre: 'Près de chez vous', detail: 'Les boutiques de votre ville', cote: 'gauche', y: '18%', couleur: COLORS.rouge },
      { icone: 'heart', titre: 'Boutiques suivies', detail: 'Suivez vos préférées', cote: 'droite', y: '74%', couleur: COLORS.or },
    ],
  },
  {
    id: 'commander',
    icone: 'bag-handle',
    titreDebut: 'Commandez ',
    titreAccent: 'simplement',
    titreFin: ' et suivez vos achats',
    texte: 'Ajoutez vos articles au panier, validez votre commande et retrouvez tout votre historique au même endroit.',
    image: null,
    cartes: [
      { icone: 'cart', titre: 'Mon panier', detail: '3 articles · 18 500 F CFA', cote: 'gauche', y: '3%', couleur: COLORS.or },
      { icone: 'checkmark-circle', titre: 'Commande confirmée', detail: 'Retrait en boutique', cote: 'droite', y: '18%', couleur: COLORS.rouge },
      { icone: 'receipt', titre: 'Historique', detail: 'Toutes vos commandes', cote: 'gauche', y: '74%', couleur: COLORS.or },
    ],
  },
  {
    id: 'gerer',
    icone: 'stats-chart',
    titreDebut: 'Gardez le contrôle de ',
    titreAccent: 'vos ventes',
    titreFin: '',
    texte: "Suivez vos commandes, surveillez votre stock et soyez alerté quand un produit est presque épuisé.",
    image: null,
    cartes: [
      { icone: 'stats-chart', titre: 'Tableau de bord', detail: "Vos ventes en un coup d'œil", cote: 'droite', y: '3%', couleur: COLORS.or },
      { icone: 'alert-circle', titre: 'Stock faible', detail: 'Plus que 3 en stock', cote: 'gauche', y: '18%', couleur: COLORS.rouge },
      { icone: 'bag-check', titre: 'Nouvelle commande', detail: 'À traiter dans Commandes', cote: 'droite', y: '74%', couleur: COLORS.or },
    ],
  },
];

// Valeur animée qui va et vient entre 0 et 1 en boucle, uniquement tant que `actif` est vrai
function useVaEtVient(actif, duree) {
  const valeur = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!actif) {
      valeur.setValue(0);
      return undefined;
    }
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(valeur, { toValue: 1, duration: duree, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIF }),
        Animated.timing(valeur, { toValue: 0, duration: duree, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIF }),
      ])
    );
    boucle.start();
    return () => boucle.stop();
  }, [actif]);
  return valeur;
}

// Cercle qui grandit et s'efface autour de l'icône centrale (effet « onde »)
function Onde({ actif, taille, delai }) {
  const valeur = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!actif) {
      valeur.setValue(0);
      return undefined;
    }
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.delay(delai),
        Animated.timing(valeur, { toValue: 1, duration: 3600 - delai, easing: Easing.out(Easing.quad), useNativeDriver: NATIF }),
      ])
    );
    boucle.start();
    return () => boucle.stop();
  }, [actif]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: taille,
        height: taille,
        borderRadius: taille / 2,
        borderWidth: 2,
        borderColor: COLORS.or,
        opacity: valeur.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 0.4, 0] }),
        transform: [{ scale: valeur.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
      }}
    />
  );
}

// Petite carte qui flotte doucement de haut en bas
function CarteFlottante({ carte, actif, index }) {
  const valeur = useVaEtVient(actif, 2400 + index * 600);
  const y = valeur.interpolate({ inputRange: [0, 1], outputRange: [0, index % 2 === 0 ? -12 : 12] });
  const couleurIcone = carte.couleur === COLORS.rouge ? COLORS.blanc : COLORS.noir;

  return (
    <Animated.View
      style={[
        styles.carte,
        { top: carte.y, [carte.cote === 'droite' ? 'right' : 'left']: '4%', transform: [{ translateY: y }] },
      ]}
    >
      <View style={[styles.carteIcone, { backgroundColor: carte.couleur }]}>
        <Ionicons name={carte.icone} size={18} color={couleurIcone} />
      </View>
      <View style={{ marginLeft: 10, flexShrink: 1 }}>
        <Text style={styles.carteTitre} numberOfLines={1}>{carte.titre}</Text>
        <Text style={styles.carteDetail} numberOfLines={1}>{carte.detail}</Text>
      </View>
    </Animated.View>
  );
}

// Grand disque flou qui dérive lentement en arrière-plan
function Halo({ couleur, taille, position, duree, deplacement }) {
  const valeur = useVaEtVient(true, duree);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: taille,
          height: taille,
          borderRadius: taille / 2,
          backgroundColor: couleur,
          opacity: 0.13,
        },
        position,
        {
          transform: [
            { translateX: valeur.interpolate({ inputRange: [0, 1], outputRange: [0, deplacement] }) },
            { translateY: valeur.interpolate({ inputRange: [0, 1], outputRange: [0, -deplacement] }) },
          ],
        },
      ]}
    />
  );
}

function Slide({ slide, anim, actif, compact, hautDecalage }) {
  const monte = anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });

  // Icône centrale qui « respire »
  const respiration = useVaEtVient(actif, 2200);
  const echelle = respiration.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const tailleOrbe = compact ? 80 : 124;

  // Photo de fond (optionnelle) : zoom lent pendant que le message est affiché
  const zoom = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!slide.image || !actif) return;
    zoom.setValue(0);
    Animated.timing(zoom, {
      toValue: 1,
      duration: DUREE_SLIDE + DUREE_FONDU * 2,
      easing: Easing.linear,
      useNativeDriver: NATIF,
    }).start();
  }, [actif]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity: anim, paddingTop: hautDecalage }]}
    >
      {slide.image ? (
        <>
          <Animated.Image
            source={slide.image}
            resizeMode="cover"
            style={[
              StyleSheet.absoluteFill,
              { width: '100%', height: '100%', transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] },
            ]}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,10,10,0.6)' }]} />
        </>
      ) : null}

      <View style={styles.scene}>
        <Onde actif={actif} taille={tailleOrbe} delai={0} />
        <Onde actif={actif} taille={tailleOrbe} delai={1200} />
        <Animated.View
          style={[
            styles.orbe,
            { width: tailleOrbe, height: tailleOrbe, borderRadius: tailleOrbe / 2, transform: [{ scale: echelle }] },
          ]}
        >
          <Ionicons name={slide.icone} size={tailleOrbe * 0.45} color={COLORS.noir} />
        </Animated.View>

        {!compact
          ? slide.cartes.map((carte, i) => <CarteFlottante key={carte.titre} carte={carte} actif={actif} index={i} />)
          : null}
      </View>

      <Animated.View
        style={[
          compact ? styles.blocTexteCompact : styles.blocTexte,
          { transform: [{ translateY: monte }] },
        ]}
      >
        <Text style={compact ? styles.titreCompact : styles.titre}>
          {slide.titreDebut}
          <Text style={{ color: COLORS.or }}>{slide.titreAccent}</Text>
          {slide.titreFin}
        </Text>
        <Text style={compact ? styles.texteCompact : styles.texte} numberOfLines={compact ? 2 : undefined}>
          {slide.texte}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

// `compact` : version réduite pour téléphone (haut de la page de connexion)
// `hautDecalage` : espace à laisser en haut (zone d'encoche des téléphones)
export default function HeroCarousel({ compact = false, hautDecalage = 0 }) {
  const [actif, setActif] = useState(0);
  const anims = useRef(SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

  // Passe au message suivant toutes les quelques secondes (le compte à rebours repart à chaque changement)
  useEffect(() => {
    const minuteur = setTimeout(() => setActif((a) => (a + 1) % SLIDES.length), DUREE_SLIDE);
    return () => clearTimeout(minuteur);
  }, [actif]);

  // Fondu enchaîné : le message précédent s'efface pendant que le nouveau apparaît
  useEffect(() => {
    SLIDES.forEach((_, i) => {
      Animated.timing(anims[i], {
        toValue: i === actif ? 1 : 0,
        duration: DUREE_FONDU,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: NATIF,
      }).start();
    });
  }, [actif]);

  const margeLaterale = compact ? 22 : 36;
  const hautLogo = hautDecalage + (compact ? 16 : 28);

  return (
    <View style={styles.racine}>
      <Halo couleur={COLORS.or} taille={compact ? 260 : 420} position={{ top: -90, right: -90 }} duree={7000} deplacement={28} />
      <Halo couleur={COLORS.rouge} taille={compact ? 200 : 340} position={{ bottom: -80, left: -70 }} duree={9000} deplacement={24} />

      {SLIDES.map((slide, i) => (
        <Slide
          key={slide.id}
          slide={slide}
          anim={anims[i]}
          actif={i === actif}
          compact={compact}
          hautDecalage={hautDecalage + (compact ? 56 : 84)}
        />
      ))}

      <View style={[styles.logoLigne, { top: hautLogo, left: margeLaterale }]} pointerEvents="none">
        <Image source={LOGO} style={{ height: compact ? 28 : 34, width: (compact ? 28 : 34) * LOGO_RATIO }} resizeMode="contain" />
        <Text style={[styles.logoTexte, compact && { fontSize: 18 }]}>FASOKA</Text>
      </View>

      <View style={[styles.points, { left: margeLaterale, bottom: compact ? 38 : 34 }]}>
        {SLIDES.map((slide, i) => (
          <Pressable
            key={slide.id}
            onPress={() => setActif(i)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Message ${i + 1} sur ${SLIDES.length}`}
          >
            <View style={[styles.point, i === actif && styles.pointActif]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: COLORS.noir, overflow: 'hidden' },
  scene: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  orbe: {
    backgroundColor: COLORS.or,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.or,
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  carte: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 180,
    maxWidth: 240,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  carteIcone: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  carteTitre: { color: COLORS.blanc, fontSize: 13, fontWeight: '700' },
  carteDetail: { color: 'rgba(255,255,255,0.65)', fontSize: 11.5, marginTop: 1 },
  blocTexte: { paddingHorizontal: 36, paddingBottom: 76 },
  blocTexteCompact: { paddingHorizontal: 22, paddingBottom: 62 },
  titre: { color: COLORS.blanc, fontSize: 32, fontWeight: '800', lineHeight: 39, maxWidth: 480 },
  titreCompact: { color: COLORS.blanc, fontSize: 21, fontWeight: '800', lineHeight: 26 },
  texte: { color: 'rgba(255,255,255,0.72)', fontSize: 15.5, lineHeight: 23, marginTop: 12, maxWidth: 460 },
  texteCompact: { color: 'rgba(255,255,255,0.72)', fontSize: 13, lineHeight: 18, marginTop: 6 },
  logoLigne: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
  logoTexte: { color: COLORS.blanc, fontSize: 20, fontWeight: '900', letterSpacing: 2, marginLeft: 10 },
  points: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6 },
  point: { width: 8, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  pointActif: { width: 26, backgroundColor: COLORS.or },
});
