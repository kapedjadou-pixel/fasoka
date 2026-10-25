const db = require('../config/database');

// Contrôle les champs fournis (ceux qui sont undefined/null sont ignorés).
// Retourne un message d'erreur, ou null si tout est valide.
// Un prix ou un stock négatif fausserait les totaux de commande et le stock.
function validerChampsProduit({ nom, prix, stock_quantite, stock_alerte_seuil }) {
  if (nom !== undefined && nom !== null && (typeof nom !== 'string' || !nom.trim() || nom.length > 200)) {
    return 'Nom invalide (1 à 200 caractères).';
  }
  if (prix !== undefined && prix !== null) {
    const p = Number(prix);
    if (typeof prix === 'boolean' || prix === '' || !Number.isFinite(p) || p < 0 || p > 9999999999) {
      return 'Le prix doit être un nombre positif ou nul.';
    }
  }
  for (const [valeur, libelle] of [[stock_quantite, 'Le stock'], [stock_alerte_seuil, "Le seuil d'alerte"]]) {
    if (valeur !== undefined && valeur !== null && (!Number.isInteger(valeur) || valeur < 0 || valeur > 1000000)) {
      return `${libelle} doit être un entier positif ou nul.`;
    }
  }
  return null;
}

// POST /api/shops/:shopId/products - Ajouter un produit (espace boutique)
async function createProduct(req, res, next) {
  try {
    const { nom, description, prix, stock_quantite, stock_alerte_seuil, categorie } = req.body;
    if (typeof nom !== 'string' || !nom.trim() || prix === undefined || prix === null) {
      return res.status(400).json({ error: 'Nom et prix sont obligatoires.' });
    }
    const erreurChamps = validerChampsProduit({ nom, prix, stock_quantite, stock_alerte_seuil });
    if (erreurChamps) return res.status(400).json({ error: erreurChamps });

    const result = await db.query(
      `INSERT INTO products (shop_id, nom, description, prix, stock_quantite, stock_alerte_seuil, categorie)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.shopId, nom.trim(), description || null, prix,
       stock_quantite || 0, stock_alerte_seuil || 5, categorie || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// GET /api/shops/:shopId/products - Catalogue d'une boutique (public, espace client + gestion boutique)
async function listShopProducts(req, res, next) {
  try {
    const result = await db.query(
      `SELECT p.*, COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
       FROM products p
       LEFT JOIN product_images pi ON pi.product_id = p.id
       WHERE p.shop_id = $1 AND p.actif = TRUE
       GROUP BY p.id ORDER BY p.mis_en_avant DESC, p.created_at DESC`,
      [req.params.shopId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/products/:productId - Détail d'un produit, avec les photos sous forme d'objets {id, image_url, ordre}
// (utilisé pour l'écran de gestion de galerie, où on a besoin de l'id de chaque image pour la supprimer/réordonner)
async function getProduct(req, res, next) {
  try {
    const produit = await db.query(`SELECT * FROM products WHERE id = $1`, [req.params.productId]);
    if (produit.rows.length === 0) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }
    const images = await db.query(
      `SELECT id, image_url, ordre FROM product_images WHERE product_id = $1 ORDER BY ordre ASC`,
      [req.params.productId]
    );
    res.json({ ...produit.rows[0], images: images.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/products/feed - Fil d'accueil client (tous produits, avec recherche/filtre)
//
// L'ordre est MÉLANGÉ à chaque visite, comme sur les grandes plateformes de commerce :
//  - l'app envoie une « graine » (seed) tirée au hasard à chaque visite ; la même graine donne
//    toujours le même ordre (la liste ne saute pas quand on revient d'une recherche),
//    une nouvelle graine donne un nouvel ordre ;
//  - les produits sont alternés entre boutiques (un produit de chaque boutique, puis un deuxième
//    de chaque boutique...) : une boutique qui a beaucoup de produits ne monopolise pas le haut de la page ;
//  - les produits « mis en avant » restent au-dessus des autres (ils sont aussi mélangés entre eux).
// Sans graine valide, le serveur en tire une au hasard : l'ordre change alors à chaque appel.
const GRAINE_VALIDE = /^[A-Za-z0-9_-]{1,64}$/;

async function feed(req, res, next) {
  try {
    const { recherche, categorie, ville, seed } = req.query;
    const graine = typeof seed === 'string' && GRAINE_VALIDE.test(seed)
      ? seed
      : crypto.randomBytes(8).toString('hex');

    const params = [graine];
    let filtres = '';

    if (typeof recherche === 'string' && recherche.trim()) {
      // Les caractères spéciaux de LIKE (% _ \) saisis par le client sont traités comme du texte simple
      params.push(`%${recherche.trim().replace(/[\\%_]/g, '\\$&')}%`);
      filtres += ` AND p.nom ILIKE $${params.length}`;
    }
    if (typeof categorie === 'string' && categorie) {
      params.push(categorie);
      filtres += ` AND p.categorie = $${params.length}`;
    }
    if (typeof ville === 'string' && ville) {
      params.push(ville);
      filtres += ` AND s.ville = $${params.length}`;
    }

    const query = `
      WITH produits_feed AS (
        SELECT p.*, s.nom_boutique, s.ville, s.badge_verifie,
               COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
        FROM products p
        JOIN shops s ON s.id = p.shop_id
        LEFT JOIN product_images pi ON pi.product_id = p.id
        WHERE p.actif = TRUE${filtres}
        GROUP BY p.id, s.id
      )
      SELECT t.* FROM (
        SELECT f.*,
               ROW_NUMBER() OVER (PARTITION BY f.shop_id ORDER BY md5(f.id::text || $1::text)) AS rang_boutique
        FROM produits_feed f
      ) t
      ORDER BY t.mis_en_avant DESC, t.rang_boutique ASC, md5(t.id::text || $1::text) ASC
      LIMIT 50`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/products/:productId - Modifier un produit
async function updateProduct(req, res, next) {
  try {
    const { nom, description, prix, stock_quantite, stock_alerte_seuil, categorie, actif } = req.body;
    const erreurChamps = validerChampsProduit({ nom, prix, stock_quantite, stock_alerte_seuil });
    if (erreurChamps) return res.status(400).json({ error: erreurChamps });
    if (actif !== undefined && actif !== null && typeof actif !== 'boolean') {
      return res.status(400).json({ error: 'Le champ actif doit être un booléen.' });
    }
    // (l'appartenance du produit à une boutique de l'utilisateur est vérifiée par requireProductShopAccess)
    const result = await db.query(
      `UPDATE products SET
        nom = COALESCE($1, nom), description = COALESCE($2, description),
        prix = COALESCE($3, prix), stock_quantite = COALESCE($4, stock_quantite),
        stock_alerte_seuil = COALESCE($5, stock_alerte_seuil), categorie = COALESCE($6, categorie),
        actif = COALESCE($7, actif), updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [nom, description, prix, stock_quantite, stock_alerte_seuil, categorie, actif, req.params.productId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// GET /api/shops/:shopId/products/alertes-stock - Produits sous le seuil d'alerte
async function stockAlerts(req, res, next) {
  try {
    const result = await db.query(
      `SELECT * FROM products WHERE shop_id = $1 AND stock_quantite <= stock_alerte_seuil AND actif = TRUE`,
      [req.params.shopId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/products/:productId
async function deleteProduct(req, res, next) {
  try {
    await db.query(`UPDATE products SET actif = FALSE WHERE id = $1`, [req.params.productId]);
    res.json({ message: 'Produit désactivé.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createProduct, listShopProducts, getProduct, feed, updateProduct, stockAlerts, deleteProduct,
};
