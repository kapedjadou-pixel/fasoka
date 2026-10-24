import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { COLORS } from '../theme/colors';
import { useSpace } from '../context/SpaceContext';
import SpaceSwitcher from '../components/SpaceSwitcher';
import { IconeOnglet } from '../components/IconesOnglets';
import BoutiqueDashboardScreen from '../screens/boutique/BoutiqueDashboardScreen';
import CatalogScreen from '../screens/boutique/CatalogScreen';
import OrdersScreen from '../screens/boutique/OrdersScreen';
import ProductGalleryScreen from '../screens/boutique/ProductGalleryScreen';

const Tab = createBottomTabNavigator();
const CatalogStack = createNativeStackNavigator();

// Noms de base des icônes Ionicons (version contour quand inactif, version pleine quand actif)
const ICONES = { 'Tableau de bord': 'stats-chart', Catalogue: 'pricetags', Commandes: 'bag-check' };

// Le catalogue a besoin de sa propre pile de navigation pour pouvoir ouvrir la galerie photos
function CatalogStackScreen() {
  return (
    <CatalogStack.Navigator>
      <CatalogStack.Screen name="CatalogueListe" component={CatalogScreen} options={{ headerShown: false }} />
      <CatalogStack.Screen
        name="ProductGallery"
        component={ProductGalleryScreen}
        options={({ route }) => ({ title: `Photos — ${route.params.productNom}`, headerStyle: { backgroundColor: COLORS.noir }, headerTintColor: 'white' })}
      />
    </CatalogStack.Navigator>
  );
}

export default function BoutiqueTabs({ onSelectClient }) {
  const { maBoutique } = useSpace();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: COLORS.noir },
        headerTintColor: COLORS.or,
        headerTitle: maBoutique?.nom_boutique || 'Ma Boutique',
        headerRight: () => <SpaceSwitcher onSelectClient={onSelectClient} onSelectBoutique={() => {}} />,
        tabBarActiveTintColor: COLORS.rouge,
        tabBarInactiveTintColor: COLORS.gris,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => (
          <IconeOnglet nom={ICONES[route.name]} focused={focused} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen name="Tableau de bord" component={BoutiqueDashboardScreen} />
      <Tab.Screen name="Catalogue" component={CatalogStackScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Commandes" component={OrdersScreen} />
    </Tab.Navigator>
  );
}
