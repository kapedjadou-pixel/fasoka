/// Configuration de l'API backend.
/// Change [baseUrl] selon ton environnement (local, staging, production).
class ApiConfig {
  // En développement local avec un émulateur Android : 10.0.2.2 pointe vers localhost de la machine hôte.
  // Sur un vrai téléphone / production : remplacer par l'URL réelle du serveur déployé.
  static const String baseUrl = 'http://10.0.2.2:4000/api';
}
