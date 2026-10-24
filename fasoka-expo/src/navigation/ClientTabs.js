import React from 'react';
import { View, Text, Image, Pressable, Platform, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CommonActions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { COLORS } from '../theme/colors';
import { useCart } from '../context/CartContext';
import SpaceSwitcher from '../components/SpaceSwitcher';
import { IconePastille, IconeProfil } from '../components/IconesOnglets';
import ClientHomeScreen from '../screens/client/ClientHomeScreen';
import CartScreen from '../screens/client/CartScreen';
import HistoryScreen from '../screens/client/HistoryScreen';
import ProfileScreen from '../screens/client/ProfileScreen';

const Tab = createBottomTabNavigator();

// Couleur de fond de la barre supérieure
const COULEUR_BARRE = COLORS.blanc;

// Noms de base des icônes Ionicons (l'onglet Profil affiche la photo du client, voir IconesOnglets.js)
const ICONES = { Accueil: 'storefront', Panier: 'cart', Historique: 'receipt' };

const COULEUR_LIBELLE_REPOS = '#6B6B6B'; // gris foncé : lisible sur fond blanc

// ---------- Logo FASOKA ----------
// Le projet ne contient pas encore de fichier logo dans un dossier assets : le logo officiel
// (monogramme F doré + pastille rouge, fichier fasoka-logomark.svg) est donc redessiné ici avec ses
// proportions exactes. Pour utiliser un fichier image à la place, ajouter-le dans fasoka-expo/assets/
// (ex : logo.png) et remplacer null ci-dessous par : require('../../assets/logo.png')
const LOGO_IMAGE = require('../../assets/logo.png')

// Dimensions et formes du logo officiel, en unités du fichier SVG d'origine
const LOGO_LARGEUR = 247;
const LOGO_HAUTEUR = 237;
const FORMES_F = [
  { gauche: 0, haut: 15, largeur: 58, hauteur: 222, rayon: 16 }, // montant vertical
  { gauche: 0, haut: 15, largeur: 176, hauteur: 58, rayon: 16 }, // barre du haut
  { gauche: 0, haut: 127, largeur: 136, hauteur: 54, rayon: 15 }, // barre du milieu
];
const PASTILLE = { gauche: 161, haut: 0, diametre: 86, bordure: 10 }; // pastille rouge cerclée de noir

// `couleurFond` : couleur du liseré autour de la pastille rouge (doit être celle du fond sur lequel le logo est posé)
function LogoFasoka({ hauteur = 30, couleurFond = COLORS.noir }) {
  if (LOGO_IMAGE) {
    return (
      <Image
        source={LOGO_IMAGE}
        style={{ height: hauteur, width: hauteur * (LOGO_LARGEUR / LOGO_HAUTEUR) }}
        resizeMode="contain"
      />
    );
  }

  const u = hauteur / LOGO_HAUTEUR; // échelle : unités SVG → pixels
  return (
    <View style={{ width: LOGO_LARGEUR * u, height: hauteur }}>
      {FORMES_F.map((forme, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: forme.gauche * u,
            top: forme.haut * u,
            width: forme.largeur * u,
            height: forme.hauteur * u,
            borderRadius: forme.rayon * u,
            backgroundColor: COLORS.or,
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          left: PASTILLE.gauche * u,
          top: PASTILLE.haut * u,
          width: PASTILLE.diametre * u,
          height: PASTILLE.diametre * u,
          borderRadius: (PASTILLE.diametre * u) / 2,
          borderWidth: PASTILLE.bordure * u,
          borderColor: couleurFond,
          backgroundColor: COLORS.rouge,
        }}
      />
    </View>
  );
}

// Titre de la barre supérieure : logo + nom de l'application
function TitreMarque() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityRole="header" accessibilityLabel="FASOKA">
      <LogoFasoka hauteur={28} couleurFond={COULEUR_BARRE} />
      <Text numberOfLines={1} style={{ color: COLORS.noir, fontSize: 19, fontWeight: '900', letterSpacing: 2, marginLeft: 10 }}>
        FASOKA
      </Text>
    </View>
  );
}

// ---------- Barre d'onglets inférieure ----------
// Barre personnalisée branchée sur le navigateur existant (même routes, même écrans) : elle reçoit l'état réel
// de la navigation (`state.index`) et reproduit le comportement standard des onglets :
// événement « tabPress » (utilisé par l'écran d'accueil), navigation vers l'écran, appui long.
export function BarreOnglets({ state, descriptors, navigation, insets }) {
  return (
    <View
      style={[
        styles.barre,
        {
          paddingBottom: Math.max(insets.bottom, 6), // zone de sécurité du téléphone
          paddingHorizontal: Math.max(insets.left, insets.right),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index; // l'onglet actif est celui réellement affiché
        const libelle =
          typeof options.tabBarLabel === 'string'
            ? options.tabBarLabel
            : options.title !== undefined
              ? options.title
              : route.name;
        const badge = options.tabBarBadge; // compteur du panier (valeur réelle, définie dans ClientTabs)

        const surAppui = () => {
          const evenement = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !evenement.defaultPrevented) {
            navigation.dispatch({
              ...CommonActions.navigate({ name: route.name, merge: true }),
              target: state.key,
            });
          }
        };
        const surAppuiLong = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole={Platform.select({ ios: 'button', default: 'tab' })}
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={
              options.tabBarAccessibilityLabel || libelle + ', onglet ' + (index + 1) + ' sur ' + state.routes.length
            }
            testID={options.tabBarTestID}
            onPress={surAppui}
            onLongPress={surAppuiLong}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.zoneIcone}>
              {route.name === 'Profil' ? (
                <IconeProfil focused={focused} />
              ) : (
                <IconePastille nom={ICONES[route.name]} focused={focused} />
              )}
              {badge != null ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeTexte}>{typeof badge === 'number' && badge > 99 ? '99+' : badge}</Text>
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              style={[styles.libelle, { color: focused ? COLORS.noir : COULEUR_LIBELLE_REPOS }]}
            >
              {libelle}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barre: {
    flexDirection: 'row',
    backgroundColor: COLORS.blanc,
    borderTopWidth: 1,
    borderTopColor: '#ECE9E2',
    paddingTop: 6,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', minHeight: 56 },
  // Zone réservée à l'icône : elle laisse la place à l'agrandissement du cercle sans toucher le libellé
  zoneIcone: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  libelle: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: COLORS.rouge,
    borderWidth: 1.5,
    borderColor: COLORS.blanc,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTexte: { color: 'white', fontSize: 10, fontWeight: '800', lineHeight: 12 },
});

export default function ClientTabs({ onSelectBoutique }) {
  const { nombreArticles } = useCart();

  return (
    <>
    {/* Barre blanche : icônes de la barre d'état en sombre (retour automatique au style global en quittant l'espace client) */}
    <StatusBar style="dark" />
    <Tab.Navigator
      tabBar={(props) => <BarreOnglets {...props} />}
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: COULEUR_BARRE },
        headerTintColor: COLORS.noir,
        headerTitle: () => <TitreMarque />,
        headerTitleAlign: 'left',
        headerRight: () => (
          <SpaceSwitcher couleur={COLORS.noir} onSelectClient={() => {}} onSelectBoutique={onSelectBoutique} />
        ),
        // Compteur du panier : valeur réelle (nombre d'articles), affichée par la barre personnalisée
        tabBarBadge: route.name === 'Panier' && nombreArticles > 0 ? nombreArticles : undefined,
        tabBarAccessibilityLabel:
          route.name === 'Panier' && nombreArticles > 0
            ? 'Panier, ' + nombreArticles + (nombreArticles > 1 ? ' articles' : ' article')
            : undefined,
      })}
    >
      <Tab.Screen name="Accueil" component={ClientHomeScreen} />
      <Tab.Screen name="Panier" component={CartScreen} />
      <Tab.Screen name="Historique" component={HistoryScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
    </>
  );
}
