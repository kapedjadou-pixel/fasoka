import React from 'react';
import LoginScreen from './LoginScreen';

// L'inscription est désormais un onglet de la page de connexion.
// Cet écran est conservé pour que la route « Signup » déclarée dans App.js continue de fonctionner.
export default function SignupScreen(props) {
  return <LoginScreen {...props} modeInitial="inscription" />;
}
