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
async function updateShop(req, res, next) {
  try {
    const { nom_boutique, description, categorie, ville, adresse, logo_url } = req.body;
    const result = await db.query(
      `UPDATE shops SET
        nom_boutique = COALESCE($1, nom_boutique),
        description = COALESCE($2, description),
        categorie = COALESCE($3, categorie),
        ville = COALESCE($4, ville),
        adresse = COALESCE($5, adresse),
        logo_url = COALESCE($6, logo_url),
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [nom_boutique, description, categorie, ville, adresse, logo_url, req.params.shopId]
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
