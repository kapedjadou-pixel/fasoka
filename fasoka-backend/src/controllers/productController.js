const crypto = require('crypto');
const db = require('../config/database');

// Contrôle les champs fournis (ceux qui sont undefined/null sont ignorés).
// Retourne un message d'erreur, ou null si tout est valide.
// Un prix ou un stock négatif fausserait les totaux de commande et le stock.
function validerChampsProduit({ nom, prix, stock_quantite, stock_alerte_seuil, description, categorie }) {
  if (nom !== undefined && nom !== null && (typeof nom !== 'string' || !nom.trim() || nom.length > 200)) {
    return 'Nom invalide (1 à 200 caractères).';
  }
  if (prix !== undefined && prix !== null) {
    const p = Number(prix);
    if (typeof prix === 'boolean' || prix === '' || !Number.isFinite(p) || p < 0 || p > 9999999999) {
      return 'Le prix doit être un nombre positif ou nul.';
    }
  }
  if (description !== undefined && description !== null && (typeof description !== 'string' || description.length > 5000)) {
    return 'La description est trop longue (5000 caractères maximum).';
  }
  if (categorie !== undefined && categorie !== null && (typeof categorie !== 'string' || categorie.length > 100)) {
    return 'La catégorie est trop longue (100 caractères maximum).';
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
    const erreurChamps = validerChampsProduit({ nom, prix, stock_quantite, stock_alerte_seuil, description, categorie });
    if (erreurChamps) return res.status(400).json({ error: erreurChamps });

    const result = await db.query(
      `INSERT INTO products (shop_id, nom, description, prix, stock_quantite, stock_alerte_seuil, categorie)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.shopId, nom.trim(), (description || '').trim() || null, prix,
       stock_quantite || 0, Number.isInteger(stock_alerte_seuil) ? stock_alerte_seuil : 5, (categorie || '').trim() || null]
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
      `SELECT p.*, COALESCE(json_agg(pi.image_url ORDER BY pi.ordre, pi.id) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images
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

// GET /api/products/:productId - Fiche d'un produit : informations, boutique (nom, ville, badge, logo) et photos
// sous forme d'objets {id, image_url, ordre} dans l'ordre choisi par la boutique (la première est la photo principale).
// Un produit supprimé n'est plus accessible.
async function getProduct(req, res, next) {
  try {
    const produit = await db.query(
      `SELECT p.*, s.nom_boutique, s.ville, s.badge_verifie, s.logo_url AS boutique_logo
       FROM products p JOIN shops s ON s.id = p.shop_id
       WHERE p.id = $1 AND p.actif = TRUE`,
      [req.params.productId]
    );
    if (produit.rows.length === 0) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }
    const images = await db.query(
      `SELECT id, image_url, ordre FROM product_images WHERE product_id = $1 ORDER BY ordre ASC, id ASC`,
      [req.params.productId]
    );
    res.json({ ...produit.rows[0], images: images.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/products/categories - Catégories utilisées par les produits en vente, les plus fournies d'abord
async function categories(req, res, next) {
  try {
    const result = await db.query(
      `SELECT categorie AS nom, COUNT(*)::int AS nombre
       FROM products
       WHERE actif = TRUE AND categorie IS NOT NULL AND TRIM(categorie) <> ''
       GROUP BY categorie
       ORDER BY nombre DESC, categorie ASC
       LIMIT 30`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// ---------- Fil des produits de l'accueil ----------

// Requête commune : produit + boutique + photos (dans l'ordre choisi) + ventes des 30 derniers jours (commandes livrées)
const SELECT_PRODUIT = `
  SELECT p.*, s.nom_boutique, s.ville, s.badge_verifie, s.logo_url AS boutique_logo,
         COALESCE(json_agg(pi.image_url ORDER BY pi.ordre, pi.id) FILTER (WHERE pi.image_url IS NOT NULL), '[]') AS images,
         v.ventes_30j
  FROM products p
  JOIN shops s ON s.id = p.shop_id
  LEFT JOIN product_images pi ON pi.product_id = p.id
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(oi.quantite), 0)::int AS ventes_30j
    FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE oi.product_id = p.id AND o.statut = 'livree' AND o.updated_at > NOW() - INTERVAL '30 days'
  ) v ON TRUE`;
const GROUPE_PRODUIT = 'GROUP BY p.id, s.id, v.ventes_30j';

const GRAINE_VALIDE = /^[A-Za-z0-9_-]{1,64}$/;
const TRIS = ['melange', 'recents', 'prix_asc', 'prix_desc', 'populaires'];
const TAILLE_PAGE_DEFAUT = 24;
const TAILLE_PAGE_MAX = 48;

// Ordres de tri : le mélange (défaut) alterne les boutiques ; les autres suivent le critère choisi
const ORDRES = {
  melange: 't.mis_en_avant DESC, t.rang_boutique ASC, md5(t.id::text || $1::text) ASC',
  recents: 't.created_at DESC, t.id ASC',
  prix_asc: 't.prix ASC, t.id ASC',
  prix_desc: 't.prix DESC, t.id ASC',
  populaires: 't.ventes_30j DESC, t.created_at DESC, t.id ASC',
};

// Erreur de paramètre : renvoyée telle quelle au client avec le code 400
function erreurRequete(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}

function nombreOuNull(valeur, libelle) {
  if (valeur === undefined || valeur === null || valeur === '') return null;
  const n = Number(valeur);
  if (typeof valeur === 'object' || !Number.isFinite(n) || n < 0 || n > 1e9) throw erreurRequete(`${libelle} invalide.`);
  return n;
}

function entierDans(valeur, min, max, defaut, libelle) {
  if (valeur === undefined || valeur === null || valeur === '') return defaut;
  const n = Number(valeur);
  if (typeof valeur === 'object' || !Number.isInteger(n) || n < min || n > max) throw erreurRequete(`${libelle} invalide.`);
  return n;
}

// Les caractères spéciaux de LIKE (% _ \) saisis par le client sont traités comme du texte simple
const echapperLike = (texte) => texte.replace(/[\\%_]/g, '\\$&');

// GET /api/products/feed - Fil d'accueil client (tous produits, avec recherche, filtres, tri et pages)
//
// Par défaut l'ordre est MÉLANGÉ à chaque visite, comme sur les grandes plateformes de commerce :
//  - l'app envoie une « graine » (seed) tirée au hasard à chaque visite ; la même graine donne toujours le même ordre
//    (la liste ne saute pas quand on revient d'une recherche ni d'une page à l'autre), une nouvelle graine un nouvel ordre ;
//  - les produits sont alternés entre boutiques (un produit de chaque boutique, puis un deuxième de chaque boutique...) ;
//  - les produits « mis en avant » restent au-dessus des autres.
// Paramètres facultatifs : recherche, categorie, ville, prix_min, prix_max, publie_depuis (jours), en_stock=1,
// tri (melange | recents | prix_asc | prix_desc | populaires), page (24 produits par page), seed.
async function feed(req, res, next) {
  try {
    const { recherche, categorie, ville, seed, tri, en_stock } = req.query;
    const graine = typeof seed === 'string' && GRAINE_VALIDE.test(seed)
      ? seed
      : crypto.randomBytes(8).toString('hex');

    const prixMin = nombreOuNull(req.query.prix_min, 'Le prix minimum');
    const prixMax = nombreOuNull(req.query.prix_max, 'Le prix maximum');
    if (prixMin !== null && prixMax !== null && prixMin > prixMax) {
      throw erreurRequete('Le prix minimum dépasse le prix maximum.');
    }
    const jours = entierDans(req.query.publie_depuis, 1, 365, null, 'La période de publication');
    const page = entierDans(req.query.page, 1, 500, 1, 'La page');
    const taille = entierDans(req.query.limite, 1, TAILLE_PAGE_MAX, TAILLE_PAGE_DEFAUT, 'La taille de page');
    const triChoisi = tri === undefined || tri === '' ? 'melange' : tri;
    if (typeof triChoisi !== 'string' || !TRIS.includes(triChoisi)) throw erreurRequete('Tri invalide.');

    const params = [graine];
    let filtres = '';

    if (typeof recherche === 'string' && recherche.trim()) {
      params.push(`%${echapperLike(recherche.trim())}%`);
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
    if (prixMin !== null) {
      params.push(prixMin);
      filtres += ` AND p.prix >= $${params.length}`;
    }
    if (prixMax !== null) {
      params.push(prixMax);
      filtres += ` AND p.prix <= $${params.length}`;
    }
    if (jours !== null) {
      params.push(jours);
      filtres += ` AND p.created_at > NOW() - make_interval(days => $${params.length}::int)`;
    }
    if (en_stock === '1' || en_stock === 'true') {
      filtres += ' AND p.stock_quantite > 0';
    }

    // `taille` et `decalage` sont des entiers validés plus haut : sans risque dans la requête
    const decalage = (page - 1) * taille;
    const query = `
      WITH produits_feed AS (
        ${SELECT_PRODUIT}
        WHERE p.actif = TRUE${filtres}
        ${GROUPE_PRODUIT}
      )
      SELECT t.* FROM (
        SELECT f.*,
               ROW_NUMBER() OVER (PARTITION BY f.shop_id ORDER BY md5(f.id::text || $1::text)) AS rang_boutique
        FROM produits_feed f
      ) t
      ORDER BY ${ORDRES[triChoisi]}
      LIMIT ${taille} OFFSET ${decalage}`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
}

// GET /api/products/accueil?seed= - Sections de l'accueil : nouveautés, tendances, boutiques vérifiées, boutiques à découvrir.
// Chaque section ne contient que de vraies données (une section sans données est simplement vide).
async function accueil(req, res, next) {
  try {
    const graine = typeof req.query.seed === 'string' && GRAINE_VALIDE.test(req.query.seed)
      ? req.query.seed
      : crypto.randomBytes(8).toString('hex');

    const SELECT_BOUTIQUE = `
      SELECT s.id, s.nom_boutique, s.logo_url, s.ville, s.badge_verifie, s.description, s.nombre_abonnes, s.nombre_ventes,
             (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id AND p.actif = TRUE)::int AS nombre_produits
      FROM shops s
      WHERE EXISTS (SELECT 1 FROM products p WHERE p.shop_id = s.id AND p.actif = TRUE)`;

    const [nouveautes, tendances, verifiees, decouvrir] = await Promise.all([
      db.query(
        `${SELECT_PRODUIT}
         WHERE p.actif = TRUE AND p.created_at > NOW() - INTERVAL '14 days'
         ${GROUPE_PRODUIT}
         ORDER BY p.created_at DESC LIMIT 10`
      ),
      db.query(
        `${SELECT_PRODUIT}
         WHERE p.actif = TRUE AND v.ventes_30j > 0
         ${GROUPE_PRODUIT}
         ORDER BY v.ventes_30j DESC, p.created_at DESC LIMIT 10`
      ),
      db.query(`${SELECT_BOUTIQUE} AND s.badge_verifie = TRUE ORDER BY s.nombre_ventes DESC, s.nom_boutique ASC LIMIT 10`),
      db.query(
        `${SELECT_BOUTIQUE} AND s.badge_verifie IS NOT TRUE ORDER BY md5(s.id::text || $1::text) ASC LIMIT 12`,
        [graine]
      ),
    ]);

    res.json({
      nouveautes: nouveautes.rows,
      tendances: tendances.rows,
      boutiques_verifiees: verifiees.rows,
      boutiques: decouvrir.rows,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/products/suggestions?q= - Suggestions pendant la saisie : produits, catégories et boutiques correspondants
async function suggestions(req, res, next) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2) return res.json({ produits: [], categories: [], boutiques: [] });
    if (q.length > 60) return res.status(400).json({ error: 'Recherche trop longue.' });

    const contient = `%${echapperLike(q)}%`;
    const commence = `${echapperLike(q)}%`;

    const [produits, categoriesTrouvees, boutiques] = await Promise.all([
      db.query(
        `SELECT p.id, p.nom, p.prix, p.shop_id,
                (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY ordre, id LIMIT 1) AS image
         FROM products p
         WHERE p.actif = TRUE AND p.nom ILIKE $1
         ORDER BY (p.nom ILIKE $2) DESC, p.nom ASC LIMIT 4`,
        [contient, commence]
      ),
      db.query(
        `SELECT categorie AS nom, COUNT(*)::int AS nombre FROM products
         WHERE actif = TRUE AND categorie ILIKE $1
         GROUP BY categorie ORDER BY nombre DESC, categorie ASC LIMIT 3`,
        [contient]
      ),
      db.query(
        `SELECT s.id, s.nom_boutique, s.logo_url, s.ville, s.badge_verifie FROM shops s
         WHERE s.nom_boutique ILIKE $1
           AND EXISTS (SELECT 1 FROM products p WHERE p.shop_id = s.id AND p.actif = TRUE)
         ORDER BY (s.nom_boutique ILIKE $2) DESC, s.nom_boutique ASC LIMIT 3`,
        [contient, commence]
      ),
    ]);

    res.json({ produits: produits.rows, categories: categoriesTrouvees.rows, boutiques: boutiques.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/products/villes - Villes des boutiques qui ont des produits en vente, avec le nombre de produits
async function villes(req, res, next) {
  try {
    const result = await db.query(
      `SELECT s.ville AS nom, COUNT(p.id)::int AS nombre
       FROM shops s JOIN products p ON p.shop_id = s.id AND p.actif = TRUE
       WHERE s.ville IS NOT NULL AND TRIM(s.ville) <> ''
       GROUP BY s.ville ORDER BY nombre DESC, s.ville ASC LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/products/:productId - Modifier un produit
async function updateProduct(req, res, next) {
  try {
    const { nom, description, prix, stock_quantite, stock_alerte_seuil, categorie, actif } = req.body;
    const erreurChamps = validerChampsProduit({ nom, prix, stock_quantite, stock_alerte_seuil, description, categorie });
    if (erreurChamps) return res.status(400).json({ error: erreurChamps });
    if (actif !== undefined && actif !== null && typeof actif !== 'boolean') {
      return res.status(400).json({ error: 'Le champ actif doit être un booléen.' });
    }
    // (l'appartenance du produit à une boutique de l'utilisateur est vérifiée par requireProductShopAccess)
    const result = await db.query(
      `UPDATE products SET
        nom = COALESCE($1, nom),
        description = CASE WHEN $2::text IS NULL THEN description WHEN TRIM($2::text) = '' THEN NULL ELSE TRIM($2::text) END,
        prix = COALESCE($3, prix), stock_quantite = COALESCE($4, stock_quantite),
        stock_alerte_seuil = COALESCE($5, stock_alerte_seuil),
        categorie = CASE WHEN $6::text IS NULL THEN categorie WHEN TRIM($6::text) = '' THEN NULL ELSE TRIM($6::text) END,
        actif = COALESCE($7, actif), updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [typeof nom === 'string' ? nom.trim() : nom, description, prix, stock_quantite, stock_alerte_seuil, categorie, actif, req.params.productId]
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
  createProduct, listShopProducts, getProduct, categories, feed, accueil, suggestions, villes, updateProduct, stockAlerts, deleteProduct,
};
