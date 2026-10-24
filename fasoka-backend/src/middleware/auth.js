const db = require('../config/database');
const { verifyToken } = require('../utils/jwt');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Évite qu'un identifiant mal formé arrive jusqu'à PostgreSQL (erreur 22P02 → erreur 500)
function isUuid(valeur) {
  return typeof valeur === 'string' && UUID_REGEX.test(valeur);
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
}

// Vérifie que l'utilisateur connecté est bien propriétaire (ou membre d'équipe) de la boutique visée
async function requireShopAccess(req, res, next) {
  const shopId = req.params.shopId || (req.body && req.body.shop_id);
  if (!isUuid(shopId)) {
    return res.status(400).json({ error: 'Identifiant de boutique invalide.' });
  }
  try {
    const result = await db.query(
      `SELECT s.id FROM shops s
       LEFT JOIN shop_team_members tm ON tm.shop_id = s.id AND tm.user_id = $1
       WHERE s.id = $2 AND (s.owner_id = $1 OR tm.user_id = $1)`,
      [req.userId, shopId]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé à cette boutique.' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

// Vérifie que la commande visée (:orderId) a été passée à une boutique de l'utilisateur connecté.
// Réponse 404 dans tous les cas d'échec : on ne révèle pas l'existence d'une commande d'autrui.
async function requireOrderShopAccess(req, res, next) {
  const { orderId } = req.params;
  if (!isUuid(orderId)) {
    return res.status(404).json({ error: 'Commande introuvable.' });
  }
  try {
    const result = await db.query(
      `SELECT o.id, o.shop_id, o.statut FROM orders o
       JOIN shops s ON s.id = o.shop_id
       LEFT JOIN shop_team_members tm ON tm.shop_id = s.id AND tm.user_id = $1
       WHERE o.id = $2 AND (s.owner_id = $1 OR tm.user_id = $1)`,
      [req.userId, orderId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }
    req.order = result.rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

// Vérifie que le produit visé (:productId) appartient à une boutique de l'utilisateur connecté.
async function requireProductShopAccess(req, res, next) {
  const { productId } = req.params;
  if (!isUuid(productId)) {
    return res.status(404).json({ error: 'Produit introuvable.' });
  }
  try {
    const result = await db.query(
      `SELECT p.id, p.shop_id FROM products p
       JOIN shops s ON s.id = p.shop_id
       LEFT JOIN shop_team_members tm ON tm.shop_id = s.id AND tm.user_id = $1
       WHERE p.id = $2 AND (s.owner_id = $1 OR tm.user_id = $1)`,
      [req.userId, productId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Produit introuvable.' });
    }
    req.product = result.rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  isUuid,
  requireAuth,
  requireShopAccess,
  requireOrderShopAccess,
  requireProductShopAccess,
};
