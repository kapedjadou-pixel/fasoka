const db = require('../config/database');
const { isUuid } = require('../middleware/auth');
const { notifierChangementStatut } = require('../services/commandeNotifications');
require('dotenv').config();

const OPERATEURS_VALIDES = ['mixx', 'flooz', 'especes'];
const MODES_LIVRAISON_VALIDES = ['retrait', 'livraison_vendeur'];
const MAX_LIGNES_PAR_COMMANDE = 50;
const MAX_QUANTITE_PAR_LIGNE = 1000;

// Historique des statuts : une ligne par changement, avec sa date (permet d'afficher le suivi de la commande)
async function initialiserCommandes() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS order_status_history (
      id BIGSERIAL PRIMARY KEY,
      order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      statut VARCHAR(30) NOT NULL,
      auteur_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id, id)`);
}

// Note un statut dans l'historique, à l'intérieur de la transaction de la commande. Un point de sauvegarde garantit
// qu'un souci avec l'historique (table pas encore créée...) n'empêche jamais de passer ou de faire avancer une commande.
async function noterHistorique(client, orderId, statut, auteurId) {
  await client.query('SAVEPOINT historique_commande');
  try {
    await client.query(
      `INSERT INTO order_status_history (order_id, statut, auteur_id) VALUES ($1, $2, $3)`,
      [orderId, statut, auteurId]
    );
    await client.query('RELEASE SAVEPOINT historique_commande');
  } catch (e) {
    await client.query('ROLLBACK TO SAVEPOINT historique_commande').catch(() => {});
    console.error("Historique de commande non enregistré :", e.message);
  }
}

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
    await noterHistorique(client, order.id, 'en_attente', req.userId);

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

// Aperçu des articles d'une commande dans les listes : nombre total d'articles et les 3 premiers (nom, photo, quantité)
const APERCU_ARTICLES_SQL = `
  LEFT JOIN LATERAL (
    SELECT COALESCE(json_agg(json_build_object('nom', t.nom, 'image', t.image, 'quantite', t.quantite) ORDER BY t.nom), '[]') AS apercu,
           (SELECT COALESCE(SUM(quantite), 0)::int FROM order_items WHERE order_id = o.id) AS nombre_articles
    FROM (
      SELECT p.nom, oi.quantite,
             (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY ordre, id LIMIT 1) AS image
      FROM order_items oi JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = o.id ORDER BY p.nom, oi.id LIMIT 3
    ) t
  ) a ON TRUE`;

// GET /api/orders/mine - Commandes du client connecté
async function myOrders(req, res, next) {
  try {
    const result = await db.query(
      `SELECT o.*, s.nom_boutique, s.logo_url, a.apercu, a.nombre_articles
       FROM orders o JOIN shops s ON s.id = o.shop_id
       ${APERCU_ARTICLES_SQL}
       WHERE o.client_id = $1 ORDER BY o.created_at DESC LIMIT 200`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/orders/mine/mises-a-jour?depuis=<date ISO> - Nombre de commandes dont le statut a changé depuis cette date
// (pastille « nouveauté » de l'onglet Historique)
async function miseAJourCommandes(req, res, next) {
  try {
    const depuis = new Date(String(req.query.depuis || ''));
    if (Number.isNaN(depuis.getTime())) {
      return res.status(400).json({ error: 'Date invalide.' });
    }
    // Toute évolution d'une commande la fait sortir de « en_attente » : ce statut seul signifie « aucun changement »
    const result = await db.query(
      `SELECT COUNT(*)::int AS nombre FROM orders
       WHERE client_id = $1 AND statut <> 'en_attente' AND updated_at > $2`,
      [req.userId, depuis.toISOString()]
    );
    res.json({ nombre: result.rows[0].nombre });
  } catch (err) {
    next(err);
  }
}

// GET /api/orders/shop/:shopId - Commandes d'une boutique (filtre ?statut= possible)
async function shopOrders(req, res, next) {
  try {
    const { statut } = req.query;
    let query = `SELECT o.*, u.nom, u.prenom, u.telephone, a.apercu, a.nombre_articles
                 FROM orders o
                 JOIN users u ON u.id = o.client_id
                 ${APERCU_ARTICLES_SQL}
                 WHERE o.shop_id = $1`;
    const params = [req.params.shopId];
    if (statut) {
      params.push(statut);
      query += ` AND o.statut = $${params.length}`;
    }
    query += ` ORDER BY o.created_at DESC LIMIT 300`;
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/orders/:orderId[?cote=client|boutique] - Détail d'une commande : articles, suivi, livraison, paiement.
// Visible par le client qui l'a passée et par l'équipe de la boutique ; seule la boutique voit les coordonnées du client.
async function getOrder(req, res, next) {
  try {
    const { orderId } = req.params;
    if (!isUuid(orderId)) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }

    const commande = await db.query(
      `SELECT o.*, s.nom_boutique, s.logo_url, s.ville AS boutique_ville, s.adresse AS boutique_adresse,
              u.prenom AS client_prenom, u.nom AS client_nom, u.telephone AS client_telephone,
              (o.client_id = $2) AS est_client,
              (s.owner_id = $2 OR EXISTS (
                 SELECT 1 FROM shop_team_members tm WHERE tm.shop_id = s.id AND tm.user_id = $2
              )) AS est_boutique
       FROM orders o
       JOIN shops s ON s.id = o.shop_id
       JOIN users u ON u.id = o.client_id
       WHERE o.id = $1`,
      [orderId, req.userId]
    );
    const o = commande.rows[0];
    if (!o || (!o.est_client && !o.est_boutique)) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }

    // Quelqu'un qui est à la fois client et membre de la boutique choisit son point de vue avec ?cote=
    const cote = req.query.cote === 'boutique' && o.est_boutique
      ? 'boutique'
      : req.query.cote === 'client' && o.est_client
        ? 'client'
        : (o.est_client ? 'client' : 'boutique');

    const [articles, historique, paiement] = await Promise.all([
      db.query(
        `SELECT oi.id, oi.product_id, oi.quantite, oi.prix_unitaire, p.nom, p.actif,
                (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY ordre, id LIMIT 1) AS image
         FROM order_items oi JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = $1 ORDER BY p.nom, oi.id`,
        [orderId]
      ),
      db.query(`SELECT statut, created_at FROM order_status_history WHERE order_id = $1 ORDER BY id`, [orderId])
        .catch(() => ({ rows: [] })), // table d'historique pas encore créée : on affiche le suivi sans dates
      db.query(`SELECT operateur FROM transactions WHERE order_id = $1 ORDER BY created_at LIMIT 1`, [orderId]),
    ]);

    res.json({
      id: o.id,
      numero: String(o.id).slice(0, 8).toUpperCase(),
      cote,
      statut: o.statut,
      montant_total: Number(o.montant_total),
      mode_livraison: o.mode_livraison,
      adresse_livraison: o.adresse_livraison,
      created_at: o.created_at,
      updated_at: o.updated_at,
      boutique: { id: o.shop_id, nom: o.nom_boutique, logo_url: o.logo_url, ville: o.boutique_ville, adresse: o.boutique_adresse },
      client: cote === 'boutique'
        ? { prenom: o.client_prenom, nom: o.client_nom, telephone: o.client_telephone }
        : null,
      articles: articles.rows.map((a) => ({
        id: a.id,
        product_id: a.product_id,
        nom: a.nom,
        image: a.image || null,
        quantite: Number(a.quantite),
        prix_unitaire: Number(a.prix_unitaire),
        sous_total: Math.round(Number(a.prix_unitaire) * Number(a.quantite) * 100) / 100,
        disponible: Boolean(a.actif),
      })),
      nombre_articles: articles.rows.reduce((somme, a) => somme + Number(a.quantite), 0),
      historique: historique.rows.map((h) => ({ statut: h.statut, date: h.created_at })),
      // Seul le mode de paiement est indiqué : Mixx et Flooz sont simulés, on ne présente pas de « paiement réussi »
      paiement: { operateur: paiement.rows[0] ? paiement.rows[0].operateur : 'especes' },
      transitions_possibles: cote === 'boutique' ? TRANSITIONS_STATUT[o.statut] || [] : [],
    });
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

    await noterHistorique(client, req.order.id, statut, req.userId);

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

    // Email au client (en arrière-plan, sans effet sur la commande en cas d'échec)
    notifierChangementStatut(req.order.id, statut).catch((e) =>
      console.error('Email de changement de statut non envoyé :', e.message)
    );
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
}

module.exports = {
  initialiserCommandes, createOrder, myOrders, miseAJourCommandes, shopOrders, getOrder, updateOrderStatus,
};
