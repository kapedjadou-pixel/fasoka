const db = require('../config/database');
const { isUuid } = require('../middleware/auth');
require('dotenv').config();

const OPERATEURS_VALIDES = ['mixx', 'flooz', 'especes'];
const MODES_LIVRAISON_VALIDES = ['retrait', 'livraison_vendeur'];
const MAX_LIGNES_PAR_COMMANDE = 50;
const MAX_QUANTITE_PAR_LIGNE = 1000;

// Petit utilitaire : lève une erreur « métier » interceptée plus bas pour répondre avec le bon code HTTP
function erreur(status, message) {
  return { status, message };
}

// POST /api/orders - Créer une commande (checkout panier)
// body: { shop_id, mode_livraison, adresse_livraison, items: [{product_id, variant_id, quantite}], operateur }
async function createOrder(req, res, next) {
  const client = await db.pool.connect();
  try {
    const { shop_id, mode_livraison, adresse_livraison, items, operateur } = req.body;

    // ---------- Validation des données reçues (rien n'est digne de confiance côté client) ----------
    if (!isUuid(shop_id)) {
      return res.status(400).json({ error: 'Boutique invalide.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Le panier est vide.' });
    }
    if (items.length > MAX_LIGNES_PAR_COMMANDE) {
      return res.status(400).json({ error: `Le panier ne peut pas dépasser ${MAX_LIGNES_PAR_COMMANDE} lignes.` });
    }

    const modeLivraison = mode_livraison === undefined || mode_livraison === null ? 'retrait' : mode_livraison;
    if (!MODES_LIVRAISON_VALIDES.includes(modeLivraison)) {
      return res.status(400).json({ error: 'Mode de livraison invalide.' });
    }
    if (modeLivraison === 'livraison_vendeur' && !(typeof adresse_livraison === 'string' && adresse_livraison.trim())) {
      return res.status(400).json({ error: 'Une adresse de livraison est obligatoire pour la livraison.' });
    }

    const operateurChoisi = operateur === undefined || operateur === null ? 'especes' : operateur;
    if (!OPERATEURS_VALIDES.includes(operateurChoisi)) {
      return res.status(400).json({ error: 'Opérateur de paiement invalide.' });
    }

    // Chaque ligne : product_id valide, quantité ENTIÈRE et POSITIVE (une quantité négative
    // faisait baisser le total et remonter le stock), variant_id facultatif mais valide.
    // Les lignes qui répètent le même produit/variante sont fusionnées (sinon la vérification
    // du stock ligne par ligne pouvait être contournée en répétant le produit).
    const lignesFusionnees = new Map();
    for (const item of items) {
      if (!item || !isUuid(item.product_id)) {
        return res.status(400).json({ error: 'Produit invalide dans le panier.' });
      }
      const variantId = item.variant_id === undefined || item.variant_id === null ? null : item.variant_id;
      if (variantId !== null && !isUuid(variantId)) {
        return res.status(400).json({ error: 'Variante invalide dans le panier.' });
      }
      if (!Number.isInteger(item.quantite) || item.quantite < 1 || item.quantite > MAX_QUANTITE_PAR_LIGNE) {
        return res.status(400).json({
          error: `La quantité doit être un entier compris entre 1 et ${MAX_QUANTITE_PAR_LIGNE}.`,
        });
      }
      const cle = `${item.product_id}|${variantId || ''}`;
      const existante = lignesFusionnees.get(cle);
      if (existante) {
        existante.quantite += item.quantite;
        if (existante.quantite > MAX_QUANTITE_PAR_LIGNE) {
          return res.status(400).json({
            error: `La quantité d'un produit ne peut pas dépasser ${MAX_QUANTITE_PAR_LIGNE}.`,
          });
        }
      } else {
        lignesFusionnees.set(cle, { product_id: item.product_id, variant_id: variantId, quantite: item.quantite });
      }
    }
    const lignes = [...lignesFusionnees.values()];

    await client.query('BEGIN');

    // La boutique doit exister
    const boutique = await client.query(`SELECT id FROM shops WHERE id = $1`, [shop_id]);
    if (boutique.rows.length === 0) throw erreur(404, 'Boutique introuvable.');

    // Verrouille les produits du panier. Triés par id : deux commandes simultanées
    // verrouillent dans le même ordre et ne peuvent pas se bloquer mutuellement (deadlock).
    const idsProduits = [...new Set(lignes.map((l) => l.product_id))].sort();
    const produitsResult = await client.query(
      `SELECT id, shop_id, prix, stock_quantite, actif FROM products
       WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE`,
      [idsProduits]
    );
    const produits = new Map(produitsResult.rows.map((p) => [p.id, p]));

    // Une variante donnée doit appartenir au produit commandé
    const idsVariantes = [...new Set(lignes.filter((l) => l.variant_id).map((l) => l.variant_id))];
    const variantes = new Map();
    if (idsVariantes.length > 0) {
      const variantesResult = await client.query(
        `SELECT id, product_id FROM product_variants WHERE id = ANY($1::uuid[])`,
        [idsVariantes]
      );
      variantesResult.rows.forEach((v) => variantes.set(v.id, v));
    }

    // Stock demandé par produit (toutes variantes confondues)
    const quantiteParProduit = new Map();
    for (const ligne of lignes) {
      quantiteParProduit.set(ligne.product_id, (quantiteParProduit.get(ligne.product_id) || 0) + ligne.quantite);
    }

    for (const ligne of lignes) {
      const produit = produits.get(ligne.product_id);
      if (!produit) throw erreur(404, 'Un des produits du panier est introuvable.');
      if (produit.shop_id !== shop_id) {
        throw erreur(400, "Tous les produits d'une commande doivent appartenir à la même boutique.");
      }
      if (!produit.actif) throw erreur(400, "Un des produits du panier n'est plus disponible.");
      if (ligne.variant_id) {
        const variante = variantes.get(ligne.variant_id);
        if (!variante || variante.product_id !== ligne.product_id) {
          throw erreur(400, 'Variante invalide pour ce produit.');
        }
      }
    }
    for (const [productId, quantite] of quantiteParProduit) {
      if (produits.get(productId).stock_quantite < quantite) {
        throw erreur(400, 'Stock insuffisant pour un des produits.');
      }
    }

    // Calcul du montant total à partir des prix réels en base (jamais faire confiance au client).
    // Calcul en centimes entiers pour éviter les erreurs d'arrondi des nombres décimaux.
    let totalCentimes = 0;
    const lignesValidees = lignes.map((ligne) => {
      const prix = Number(produits.get(ligne.product_id).prix);
      if (!Number.isFinite(prix) || prix < 0) throw erreur(400, 'Prix invalide pour un des produits.');
      totalCentimes += Math.round(prix * 100) * ligne.quantite;
      return { ...ligne, prix_unitaire: prix };
    });
    const montant_total = totalCentimes / 100;

    const orderResult = await client.query(
      `INSERT INTO orders (client_id, shop_id, mode_livraison, adresse_livraison, montant_total)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.userId, shop_id, modeLivraison, adresse_livraison ? String(adresse_livraison).trim() : null, montant_total]
    );
    const order = orderResult.rows[0];

    for (const ligne of lignesValidees) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, quantite, prix_unitaire)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, ligne.product_id, ligne.variant_id, ligne.quantite, ligne.prix_unitaire]
      );
    }
    // Décrément du stock, par produit, avec une condition de sécurité supplémentaire
    for (const [productId, quantite] of quantiteParProduit) {
      const maj = await client.query(
        `UPDATE products SET stock_quantite = stock_quantite - $1
         WHERE id = $2 AND stock_quantite >= $1`,
        [quantite, productId]
      );
      if (maj.rowCount === 0) throw erreur(400, 'Stock insuffisant pour un des produits.');
    }

    // Paiement — en mode simulation tant que Mixx/Flooz ne sont pas branchés en vrai
    const simulation = process.env.PAYMENT_SIMULATION_MODE === 'true';
    const transactionResult = await client.query(
      `INSERT INTO transactions (order_id, shop_id, montant, operateur, statut, reference_externe)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        order.id, shop_id, montant_total, operateurChoisi,
        simulation ? 'reussie' : 'en_attente',
        simulation ? `SIM-${Date.now()}` : null,
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({ order, transaction: transactionResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
    next(err);
  } finally {
    client.release();
  }
}

// GET /api/orders/mine - Historique des commandes du client
async function myOrders(req, res, next) {
  try {
    const result = await db.query(
      `SELECT o.*, s.nom_boutique, s.logo_url
       FROM orders o JOIN shops s ON s.id = o.shop_id
       WHERE o.client_id = $1 ORDER BY o.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/shops/:shopId/orders - Commandes reçues par la boutique
async function shopOrders(req, res, next) {
  try {
    const { statut } = req.query;
    let query = `SELECT o.*, u.nom, u.prenom, u.telephone FROM orders o
                 JOIN users u ON u.id = o.client_id WHERE o.shop_id = $1`;
    const params = [req.params.shopId];
    if (statut) {
      params.push(statut);
      query += ` AND o.statut = $${params.length}`;
    }
    query += ` ORDER BY o.created_at DESC`;
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// Transitions de statut autorisées : une commande avance d'une étape à la fois,
// peut être annulée tant qu'elle n'est pas livrée, et 'livree' / 'annulee' sont définitifs.
const TRANSITIONS_STATUT = {
  en_attente: ['confirmee', 'annulee'],
  confirmee: ['en_preparation', 'annulee'],
  en_preparation: ['prete', 'annulee'],
  prete: ['livree', 'annulee'],
  livree: [],
  annulee: [],
};

// PATCH /api/orders/:orderId/statut - Le vendeur fait avancer la commande
// (l'accès à la boutique de la commande est déjà vérifié par requireOrderShopAccess, qui place req.order)
async function updateOrderStatus(req, res, next) {
  const client = await db.pool.connect();
  try {
    const { statut } = req.body;
    if (typeof statut !== 'string' || !Object.prototype.hasOwnProperty.call(TRANSITIONS_STATUT, statut)) {
      return res.status(400).json({ error: 'Statut invalide.' });
    }

    await client.query('BEGIN');

    // Verrouille la ligne : deux requêtes simultanées ne peuvent pas toutes les deux « livrer » la commande
    const courant = await client.query(`SELECT statut, shop_id FROM orders WHERE id = $1 FOR UPDATE`, [req.order.id]);
    if (courant.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Commande introuvable.' });
    }
    const { statut: statutActuel, shop_id } = courant.rows[0];

    if (!TRANSITIONS_STATUT[statutActuel].includes(statut)) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Transition impossible : une commande « ${statutActuel} » ne peut pas passer à « ${statut} ».`,
      });
    }

    const result = await client.query(
      `UPDATE orders SET statut = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [statut, req.order.id]
    );

        // Une commande annulée rend les articles au stock (le stock est décrémenté à la création).
    // Grâce aux transitions, une commande ne peut être annulée qu'une seule fois : pas de double remise en stock.
    if (statut === 'annulee') {
      await client.query(
        `UPDATE products p SET stock_quantite = p.stock_quantite + t.quantite
         FROM (
           SELECT product_id, SUM(quantite)::int AS quantite
           FROM order_items WHERE order_id = $1 GROUP BY product_id
         ) t
         WHERE p.id = t.product_id`,
        [req.order.id]
      );
    }
    
    // Quand une commande est livrée, on incrémente le compteur de ventes de la boutique.
    // Grâce aux transitions, cela ne peut arriver qu'une seule fois par commande.
    if (statut === 'livree') {
      await client.query(`UPDATE shops SET nombre_ventes = nombre_ventes + 1 WHERE id = $1`, [shop_id]);
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

module.exports = { createOrder, myOrders, shopOrders, updateOrderStatus };
