# Fasoka Backend

API REST pour l'application Fasoka (Node.js + Express + PostgreSQL).

## Installation

```bash
npm install
cp .env.example .env
# Remplir .env avec tes vraies infos de base de données et secrets
```

## Base de données

Créer une base PostgreSQL (`fasoka`), puis lancer la migration :

```bash
npm run migrate
```

Cela applique `src/db/schema.sql` (utilisateurs, boutiques, produits, commandes, transactions, avis, favoris).

## Lancer le serveur

```bash
npm run dev     # avec redémarrage automatique (nodemon)
npm start        # en production
```

Le serveur démarre sur `http://localhost:4000` par défaut.

## Endpoints principaux

### Authentification
- `POST /api/auth/signup` — créer un compte
- `POST /api/auth/confirm` — confirmer le compte avec le code reçu
- `POST /api/auth/login` — connexion

### Boutiques (espace boutique)
- `POST /api/shops` — créer une boutique
- `GET /api/shops/mine` — mes boutiques
- `GET /api/shops/:shopId` — infos publiques d'une boutique
- `GET /api/shops/:shopId/stats` — tableau de bord

### Produits
- `GET /api/products/feed` — fil d'accueil client (recherche/filtres)
- `GET /api/products/shop/:shopId` — catalogue d'une boutique
- `POST /api/products/shop/:shopId` — ajouter un produit

### Commandes
- `POST /api/orders` — passer commande (checkout)
- `GET /api/orders/mine` — historique client
- `GET /api/orders/shop/:shopId` — commandes reçues par la boutique
- `PATCH /api/orders/:orderId/statut` — faire avancer une commande

## Photos produit

Les images sont stockées sur [Cloudinary](https://cloudinary.com) (compte gratuit largement suffisant
pour démarrer — 25 crédits/mois inclus).

1. Créer un compte sur cloudinary.com
2. Récupérer `Cloud name`, `API Key`, `API Secret` depuis le tableau de bord
3. Les renseigner dans `.env` (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)

Endpoints :
- `POST /api/products/:productId/images` — envoyer une photo (multipart/form-data, champ `image`, max 5 Mo, JPEG/PNG/WEBP)
- `DELETE /api/products/:productId/images/:imageId` — supprimer une photo

Les images sont automatiquement redimensionnées (max 1000x1000) et compressées par Cloudinary.

## Paiement mobile money — IMPORTANT

Le champ `PAYMENT_SIMULATION_MODE=true` dans `.env` permet de tester tout le flux de commande
**sans connexion réelle à Mixx by Yas ou Flooz**. Toute commande est automatiquement marquée
comme payée.

Une fois le partenariat signé avec ces opérateurs, il faudra :
1. Remplir `MIXX_API_KEY`, `FLOOZ_API_KEY` etc. dans `.env`
2. Créer un fichier `src/services/paymentService.js` qui appelle leurs vraies APIs
3. Remplacer la logique simulée dans `orderController.js` (fonction `createOrder`) par un vrai appel
4. Passer `PAYMENT_SIMULATION_MODE=false`

## Ce qui est fait vs à compléter

**Fait** : auth (signup/login/JWT), gestion boutique, catalogue produits, panier/commandes,
gestion de stock, avis, favoris, abonnement aux boutiques, statistiques boutique de base.

**À compléter par le développeur** : upload réel d'images (actuellement juste un champ URL),
notifications push, intégration paiement réelle, score de confiance (algorithme à définir),
avance de trésorerie (nécessite partenariat financier), mode hors-ligne.
