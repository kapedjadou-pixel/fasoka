# Fasoka — App Expo / React Native

Version React Native de l'application Fasoka, permettant de builder un APK via EAS (Expo Application Services).

## 1. Installation locale

Prérequis : [Node.js](https://nodejs.org) et un compte [Expo](https://expo.dev) (gratuit).

```bash
npm install
npx expo start
```

Scanne le QR code avec l'app **Expo Go** (Android/iOS) pour tester immédiatement sur ton téléphone,
sans même builder d'APK.

## 2. Configuration du backend

Dans `src/api/config.js`, régler `API_BASE_URL` :
- Émulateur Android : `http://10.0.2.2:4000/api` (déjà configuré)
- Test avec Expo Go sur téléphone physique : remplacer par l'IP locale de ton ordinateur
  (ex: `http://192.168.1.20:4000/api`) — téléphone et ordi doivent être sur le même WiFi
- Production : URL du serveur déployé

## 3. Générer un vrai fichier APK (installable sans Expo Go)

C'est ici qu'intervient EAS Build — la seule façon fiable d'obtenir un `.apk` sans avoir
Android Studio installé.

```bash
npm install -g eas-cli
eas login                    # connecte ton compte Expo
eas init                     # crée le projet sur expo.dev, génère un projectId
eas build -p android --profile preview
```

Le profil `preview` (défini dans `eas.json`) est configuré pour produire un **.apk** directement
installable (le profil `production` par défaut produit un `.aab`, réservé au Play Store).

Le build se fait sur les serveurs Expo (gratuit avec quota mensuel sur le plan gratuit) ;
un lien de téléchargement de l'APK est fourni à la fin (10-20 minutes en général).

## 4. Connecter GitHub (nécessaire pour déclencher un build à distance)

Si tu veux que je déclenche moi-même un build via l'outil Expo connecté à cette conversation :
1. Pousse ce code sur un dépôt GitHub
2. Sur [expo.dev](https://expo.dev), dans les réglages du projet → connecte le dépôt GitHub
3. Donne-moi l'`appId` (visible dans `app.json` après `eas init`, champ `extra.eas.projectId`)
   ou le nom complet `@ton-compte/fasoka`
4. Je peux alors lancer `eas build` à distance et suivre son statut

Sans cette connexion GitHub, la commande `eas build` doit être lancée localement (étape 3 ci-dessus) —
ce qui reste la méthode la plus simple et rapide de toute façon.

## Structure du projet

```
App.js                 -> point d'entrée, bascule connexion / espace client / espace boutique
src/
  theme/colors.js       -> palette de marque Fasoka
  api/                  -> client HTTP (avec upload multipart d'images)
  context/               -> Auth, Space (bascule client/boutique), Cart
  navigation/            -> onglets bas pour chaque espace
  screens/
    auth/                -> connexion, inscription
    client/              -> accueil, panier, historique, profil
    boutique/             -> création boutique, dashboard, catalogue, commandes, galerie photos
  components/
    SpaceSwitcher.js      -> bouton de bascule client ↔ boutique
```

## Ce qui est fonctionnel

Même périmètre que la version Flutter précédente : authentification, bascule d'espace,
création de boutique, fil produits avec recherche, panier/commande, historique, gestion du
catalogue avec photo à la création, galerie multi-photos (ajout/suppression/réorganisation).

## Ce qu'il reste à développer

- Écran de détail produit
- Score de confiance, avance de trésorerie (nécessitent partenariat financier au préalable)
- Vraie intégration Mixx/Flooz (actuellement mode simulation côté backend)
- Notifications push
- Mode hors-ligne

## Note importante sur la vérification

Je n'ai pas pu exécuter `npm install` ni de compilateur JSX dans mon environnement de travail
(pas de connexion réseau). J'ai vérifié à la main l'équilibre des accolades/parenthèses sur les
21 fichiers, mais un premier `npx expo start` sera nécessaire pour repérer d'éventuelles erreurs
de compilation avant de lancer un vrai build EAS.
