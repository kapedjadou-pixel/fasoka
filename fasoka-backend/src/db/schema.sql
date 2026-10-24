-- ============================================
-- Fasoka - Schéma de base de données PostgreSQL
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------- UTILISATEURS ----------
-- Un compte unique peut avoir un espace client (toujours) et un espace boutique (optionnel)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    telephone VARCHAR(20) UNIQUE,
    mot_de_passe_hash VARCHAR(255) NOT NULL,
    -- Empreinte bcrypt du code à 6 chiffres (jamais le code en clair)
    code_confirmation VARCHAR(255),
    code_expire_le TIMESTAMP,
    code_tentatives INTEGER DEFAULT 0,
    code_envoye_le TIMESTAMP,
    compte_verifie BOOLEAN DEFAULT FALSE,
    photo_profil_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT email_ou_telephone CHECK (email IS NOT NULL OR telephone IS NOT NULL)
);

-- ---------- BOUTIQUES ----------
CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom_boutique VARCHAR(150) NOT NULL,
    logo_url TEXT,
    description TEXT,
    categorie VARCHAR(100),
    ville VARCHAR(100) DEFAULT 'Lomé',
    adresse TEXT,
    qr_code_token VARCHAR(64) UNIQUE DEFAULT uuid_generate_v4(),
    plan VARCHAR(20) DEFAULT 'gratuit' CHECK (plan IN ('gratuit', 'pro')),
    plan_expire_le TIMESTAMP,
    badge_verifie BOOLEAN DEFAULT FALSE,
    score_confiance DECIMAL(3,2) DEFAULT 0.00 CHECK (score_confiance BETWEEN 0 AND 5),
    nombre_ventes INTEGER DEFAULT 0,
    nombre_abonnes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Membres d'équipe pouvant accéder à l'espace boutique (accès employé)
CREATE TABLE shop_team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'employe' CHECK (role IN ('proprietaire', 'gerant', 'employe')),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(shop_id, user_id)
);

-- Abonnements des clients aux boutiques ("follow shop")
CREATE TABLE shop_followers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(shop_id, user_id)
);

-- ---------- PRODUITS ----------
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    nom VARCHAR(200) NOT NULL,
    description TEXT,
    prix DECIMAL(12,2) NOT NULL,
    devise VARCHAR(10) DEFAULT 'XOF',
    stock_quantite INTEGER DEFAULT 0,
    stock_alerte_seuil INTEGER DEFAULT 5,
    categorie VARCHAR(100),
    actif BOOLEAN DEFAULT TRUE,
    mis_en_avant BOOLEAN DEFAULT FALSE,
    mis_en_avant_jusqua TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    ordre INTEGER DEFAULT 0
);

CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    nom_variante VARCHAR(100) NOT NULL, -- ex: "Taille M", "Couleur rouge"
    stock_quantite INTEGER DEFAULT 0,
    prix_supplement DECIMAL(12,2) DEFAULT 0
);

-- ---------- COMMANDES ----------
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES users(id),
    shop_id UUID NOT NULL REFERENCES shops(id),
    statut VARCHAR(30) DEFAULT 'en_attente' CHECK (statut IN
        ('en_attente', 'confirmee', 'en_preparation', 'prete', 'livree', 'annulee')),
    mode_livraison VARCHAR(20) DEFAULT 'retrait' CHECK (mode_livraison IN ('retrait', 'livraison_vendeur')),
    adresse_livraison TEXT,
    montant_total DECIMAL(12,2) NOT NULL,
    note_client TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    quantite INTEGER NOT NULL,
    prix_unitaire DECIMAL(12,2) NOT NULL
);

-- ---------- TRANSACTIONS / PAIEMENTS ----------
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id),
    shop_id UUID NOT NULL REFERENCES shops(id),
    montant DECIMAL(12,2) NOT NULL,
    operateur VARCHAR(20) CHECK (operateur IN ('mixx', 'flooz', 'especes')),
    reference_externe VARCHAR(100), -- ID transaction côté opérateur mobile money
    statut VARCHAR(20) DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'reussie', 'echouee')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ---------- AVIS ----------
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES users(id),
    order_id UUID REFERENCES orders(id),
    note INTEGER NOT NULL CHECK (note BETWEEN 1 AND 5),
    commentaire TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ---------- FAVORIS ----------
CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- ---------- Index utiles pour la performance ----------
CREATE INDEX idx_products_shop ON products(shop_id);
CREATE INDEX idx_orders_client ON orders(client_id);
CREATE INDEX idx_orders_shop ON orders(shop_id);
CREATE INDEX idx_transactions_shop ON transactions(shop_id);
CREATE INDEX idx_shop_followers_user ON shop_followers(user_id);
