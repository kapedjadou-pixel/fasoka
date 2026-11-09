const db = require('../config/database');

// POST /api/shops - Créer une boutique (bascule vers l'espace boutique)
async function createShop(req, res, next) {
  try {
    const { nom_boutique, description, categorie, ville, adresse, logo_url } = req.body;
    if (!nom_boutique) {
      return res.status(400).json({ error: 'Le nom de la boutique est obligatoire.' });
    }

    const result = await db.query(
      `INSERT INTO shops (owner_id, nom_boutique, description, categorie, ville, adresse, logo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.userId, nom_boutique, description || null, categorie || null,
       ville || 'Lomé', adresse || null, logo_url || null]
    );

    // Le créateur devient automatiquement propriétaire dans l'équipe
    await db.query(
      `INSERT INTO shop_team_members (shop_id, user_id, role) VALUES ($1, $2, 'proprietaire')`,
      [result.rows[0].id, req.userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// GET /api/shops/mine - Boutiques que l'utilisateur possède ou gère
async function myShops(req, res, next) {
  try {
    const result = await db.query(
      `SELECT s.*, tm.role FROM shops s
       JOIN shop_team_members tm ON tm.shop_id = s.id
       WHERE tm.user_id = $1
       ORDER BY s.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/shops/:shopId - Détail public d'une boutique (pour l'espace client)
async function getShop(req, res, next) {
  try {
    const result = await db.query(`SELECT * FROM shops WHERE id = $1`, [req.params.shopId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Boutique introuvable.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/shops/:shopId - Modifier les infos boutique
// Contrôle des champs modifiables d'une boutique : renvoie un message d'erreur, ou null si tout est valide
function validerChampsBoutique({ nom_boutique, description, categorie, ville, adresse, logo_url }) {
  const texte = (valeur) => valeur === undefined || valeur === null || typeof valeur === 'string';
  if (![nom_boutique, description, categorie, ville, adresse, logo_url].every(texte)) {
    return 'Les informations de la boutique doivent être du texte.';
  }
  if (nom_boutique !== undefined && nom_boutique !== null) {
    if (!nom_boutique.trim()) return 'Le nom de la boutique est obligatoire.';
    if (nom_boutique.trim().length > 150) return 'Le nom de la boutique est trop long (150 caractères maximum).';
  }
  if (ville !== undefined && ville !== null) {
    if (!ville.trim()) return 'La ville est obligatoire.';
    if (ville.trim().length > 100) return 'La ville est trop longue (100 caractères maximum).';
  }
  if (description && description.length > 2000) return 'La description est trop longue (2000 caractères maximum).';
  if (categorie && categorie.length > 100) return 'La catégorie est trop longue (100 caractères maximum).';
  if (adresse && adresse.length > 300) return "L'adresse est trop longue (300 caractères maximum).";
  if (logo_url && (!/^https:\/\//.test(logo_url) || logo_url.length > 500)) return "L'adresse du logo n'est pas valide.";
  return null;
}

async function updateShop(req, res, next) {
  try {
    const { nom_boutique, description, categorie, ville, adresse, logo_url } = req.body;
    const erreur = validerChampsBoutique({ nom_boutique, description, categorie, ville, adresse, logo_url });
    if (erreur) return res.status(400).json({ error: erreur });

    // Une valeur absente laisse le champ inchangé ; une valeur vide efface la description, la catégorie ou l'adresse
    const result = await db.query(
      `UPDATE shops SET
        nom_boutique = COALESCE($1, nom_boutique),
        description = CASE WHEN $2::text IS NULL THEN description WHEN TRIM($2::text) = '' THEN NULL ELSE TRIM($2::text) END,
        categorie = CASE WHEN $3::text IS NULL THEN categorie WHEN TRIM($3::text) = '' THEN NULL ELSE TRIM($3::text) END,
        ville = COALESCE($4, ville),
        adresse = CASE WHEN $5::text IS NULL THEN adresse WHEN TRIM($5::text) = '' THEN NULL ELSE TRIM($5::text) END,
        logo_url = COALESCE($6, logo_url),
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [
        typeof nom_boutique === 'string' ? nom_boutique.trim() : nom_boutique,
        description, categorie,
        typeof ville === 'string' ? ville.trim() : ville,
        adresse, logo_url, req.params.shopId,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// POST /api/shops/:shopId/follow - Un client s'abonne à une boutique
async function followShop(req, res, next) {
  try {
    await db.query(
      `INSERT INTO shop_followers (shop_id, user_id) VALUES ($1, $2)
       ON CONFLICT (shop_id, user_id) DO NOTHING`,
      [req.params.shopId, req.userId]
    );
    await db.query(
      `UPDATE shops SET nombre_abonnes = (SELECT COUNT(*) FROM shop_followers WHERE shop_id = $1)
       WHERE id = $1`,
      [req.params.shopId]
    );
    res.json({ message: 'Abonnement réussi.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/shops/:shopId/stats - Stats simples pour le tableau de bord boutique
async function shopStats(req, res, next) {
  try {
    const shopId = req.params.shopId;
    const [ventes, produits, commandesEnCours, avis] = await Promise.all([
      db.query(
        `SELECT COALESCE(SUM(montant_total),0) AS total_ventes, COUNT(*) AS nombre_commandes
         FROM orders WHERE shop_id = $1 AND statut = 'livree'`, [shopId]),
      db.query(`SELECT COUNT(*) AS total_produits FROM products WHERE shop_id = $1 AND actif = TRUE`, [shopId]),
      db.query(
        `SELECT COUNT(*) AS commandes_en_cours FROM orders
         WHERE shop_id = $1 AND statut IN ('en_attente','confirmee','en_preparation')`, [shopId]),
      db.query(`SELECT COALESCE(AVG(note),0) AS note_moyenne, COUNT(*) AS nombre_avis FROM reviews WHERE shop_id = $1`, [shopId]),
    ]);

    res.json({
      total_ventes: ventes.rows[0].total_ventes,
      nombre_commandes_livrees: ventes.rows[0].nombre_commandes,
      total_produits: produits.rows[0].total_produits,
      commandes_en_cours: commandesEnCours.rows[0].commandes_en_cours,
      note_moyenne: parseFloat(avis.rows[0].note_moyenne).toFixed(1),
      nombre_avis: avis.rows[0].nombre_avis,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createShop, myShops, getShop, updateShop, followShop, shopStats };
