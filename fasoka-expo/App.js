import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SpaceProvider, useSpace } from './src/context/SpaceContext';
import { CartProvider } from './src/context/CartContext';
import { ApiClient } from './src/api/apiClient';

import LoginScreen from './src/screens/auth/LoginScreen';
import SignupScreen from './src/screens/auth/SignupScreen';
import ShopCreationScreen from './src/screens/boutique/ShopCreationScreen';
import ClientTabs from './src/navigation/ClientTabs';
import BoutiqueTabs from './src/navigation/BoutiqueTabs';
import { COLORS } from './src/theme/colors';

const AuthStack = createNativeStackNavigator();

function EcranAuth() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} options={{ headerShown: true, title: 'Créer un compte' }} />
    </AuthStack.Navigator>
  );
}

// Racine de navigation : bascule entre connexion / espace client / création boutique / espace boutique.
function RacineApp() {
  const { user, chargementSession } = useAuth();
  const { aUneBoutique, setMaBoutique } = useSpace();
  const [espaceActif, setEspaceActif] = useState('client'); // 'client' | 'creation-boutique' | 'boutique'

  // Après connexion (ou restauration de session), on retrouve la boutique existante de l'utilisateur
  useEffect(() => {
    if (user && !aUneBoutique) {
      ApiClient.get('/shops/mine')
        .then((boutiques) => {
          if (boutiques && boutiques.length > 0) {
            setMaBoutique(boutiques[0]);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  // Pendant qu'on cherche une session enregistrée, on affiche un écran d'attente
  // (sinon l'écran de connexion clignoterait à chaque actualisation de la page)
  if (chargementSession) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.noir, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.or} />
      </View>
    );
  }

  if (!user) return <EcranAuth />;

  if (espaceActif === 'creation-boutique') {
    return <ShopCreationScreen onCree={() => setEspaceActif('boutique')} />;
  }

  if (espaceActif === 'boutique' && aUneBoutique) {
    return <BoutiqueTabs onSelectClient={() => setEspaceActif('client')} />;
  }

  return (
    <ClientTabs
      onSelectBoutique={() => setEspaceActif(aUneBoutique ? 'boutique' : 'creation-boutique')}
    />
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SpaceProvider>
          <CartProvider>
            <NavigationContainer>
              <StatusBar style="light" backgroundColor={COLORS.noir} />
              <RacineApp />
            </NavigationContainer>
          </CartProvider>
        </SpaceProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
