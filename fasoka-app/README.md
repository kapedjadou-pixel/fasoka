# Fasoka — App Flutter

Application mobile Fasoka : marketplace fintech pour commerçants informels à Lomé.

## Installation

Prérequis : [Flutter SDK](https://docs.flutter.dev/get-started/install) installé sur ta machine.

```bash
flutter pub get
```

## Configuration

Dans `lib/core/api/api_config.dart`, régler `baseUrl` vers ton backend :
- Émulateur Android + backend en local : `http://10.0.2.2:4000/api` (déjà configuré)
- iPhone/Android physique : utiliser l'adresse IP locale de ton ordinateur, ou l'URL du serveur déployé

## Lancer l'app

```bash
flutter run
```

## Structure du projet

```
lib/
  core/
    theme/       -> couleurs et thème (palette Fasoka : noir/or/rouge)
    api/         -> client HTTP centralisé
  models/        -> User, Shop, Product, ShopOrder, CartItem
  providers/     -> AuthProvider, SpaceProvider (bascule client/boutique), CartProvider
  screens/
    auth/        -> connexion, inscription
    client/      -> accueil (fil produits), panier, historique, profil
    boutique/    -> création boutique, tableau de bord, catalogue, commandes
  widgets/
    space_switcher.dart -> le bouton clé qui bascule entre espace client et espace boutique
```

## Ce qui est fonctionnel

- Authentification complète (inscription/connexion, token JWT stocké localement)
- Bascule espace client ↔ espace boutique (comme profil/page Facebook)
- Création de boutique
- Fil d'accueil client avec recherche
- Panier + validation de commande (paiement en mode simulation côté backend)
- Historique des commandes (côté client)
- Gestion du catalogue (côté boutique) : ajout de produits avec photo (caméra ou galerie), galerie multi-photos par produit (ajout, suppression, réorganisation par glisser-déposer), alerte stock faible
- Gestion des commandes reçues (côté boutique) : faire avancer le statut

## Ce qu'il reste à développer

- Écran de détail produit (actuellement clic = ajout direct au panier)
- Score de confiance affiché (logique déjà prévue côté base de données)
- Avance de trésorerie (nécessite partenariat financier au préalable)
- Mode hors-ligne avec synchronisation
- Notifications push (nouvelle commande, changement de statut)
- Vrai choix de l'opérateur mobile money au moment du paiement (Mixx / Flooz)
- Tests unitaires et d'intégration
- Icônes et splash screen (les fichiers de logo sont déjà prêts dans le dossier branding)

## Note importante

Ce projet n'a pas pu être testé avec le SDK Flutter dans cet environnement (pas d'accès réseau
pour l'installer). Le code a été écrit avec soin et vérifié syntaxiquement (accolades/parenthèses
équilibrées), mais il faudra que ton développeur fasse un premier `flutter run` pour corriger
d'éventuelles erreurs mineures de compilation avant de continuer.
