const db = require('../config/database');
const { isUuid } = require('../middleware/auth');

// Messagerie : discussions entre un client et une boutique.
//  - une conversation = un client + une boutique (une seule par couple) ;
//  - côté « boutique », tous les membres de l'équipe (propriétaire, gérant, employé) voient la même conversation ;
//  - « cote » vaut 'client' ou 'boutique' : il dit de quel côté de la conversation on parle. Le serveur vérifie
//    que la personne connectée a bien ce rôle, on ne fait jamais confiance au simple identifiant de conversation.

const LONGUEUR_MAX_MESSAGE = 2000;
const TAILLE_PAGE = 50;

async function initialiserMessagerie() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      dernier_message_le TIMESTAMP,
      -- Numéro du dernier message lu de chaque côté (les messages suivants de l'autre côté sont « non lus »)
      client_dernier_lu BIGINT NOT NULL DEFAULT 0,
      boutique_dernier_lu BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (client_id, shop_id)
    )`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      expediteur VARCHAR(10) NOT NULL CHECK (expediteur IN ('client', 'boutique')),
      auteur_id UUID REFERENCES users(id) ON DELETE SET NULL,
      contenu TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_conversations_client ON conversations(client_id, dernier_message_le DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_conversations_boutique ON conversations(shop_id, dernier_message_le DESC)`);
}

function entierPositif(valeur) {
  const n = Number.parseInt(valeur, 10);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function coteValide(cote) {
  return cote === 'client' || cote === 'boutique';
}

// Charge une conversation et indique si la personne connectée est le client et/ou membre de la boutique
async function chargerConversation(conversationId, userId) {
  if (!isUuid(conversationId)) return null;
  const result = await db.query(
    `SELECT c.id, c.client_id, c.shop_id,
            s.nom_boutique, s.logo_url,
            u.prenom AS client_prenom, u.nom AS client_nom, u.photo_profil_url AS client_photo,
            (c.client_id = $2) AS est_client,
            (s.owner_id = $2 OR EXISTS (
               SELECT 1 FROM shop_team_members tm WHERE tm.shop_id = s.id AND tm.user_id = $2
            )) AS est_boutique
     FROM conversations c
     JOIN shops s ON s.id = c.shop_id
     JOIN users u ON u.id = c.client_id
     WHERE c.id = $1`,
    [conversationId, userId]
  );
  return result.rows[0] || null;
}

function estAutorise(conversation, cote) {
  if (!conversation) return false;
  return (cote === 'client' && conversation.est_client) || (cote === 'boutique' && conversation.est_boutique);
}

// Titre et photo affichés : le client voit la boutique, la boutique voit le client
function decrire(conversation, cote) {
  if (cote === 'client') {
    return { id: conversation.id, shop_id: conversation.shop_id, titre: conversation.nom_boutique, avatar: conversation.logo_url };
  }
  const nom = `${conversation.client_prenom || ''} ${conversation.client_nom || ''}`.trim();
  return { id: conversation.id, shop_id: conversation.shop_id, titre: nom || 'Client', avatar: conversation.client_photo };
}

async function marquerCommeLu(conversationId, cote) {
  const colonne = cote === 'client' ? 'client_dernier_lu' : 'boutique_dernier_lu'; // valeurs fixes : pas de saisie utilisateur
  await db.query(
    `UPDATE conversations c SET ${colonne} = m.max_id
     FROM (SELECT COALESCE(MAX(id), 0) AS max_id FROM messages WHERE conversation_id = $1) m
     WHERE c.id = $1 AND c.${colonne} < m.max_id`,
    [conversationId]
  );
}

function formaterMessage(ligne, cote) {
  return {
    id: Number(ligne.id),
    expediteur: ligne.expediteur,
    contenu: ligne.contenu,
    created_at: ligne.created_at,
    est_moi: ligne.expediteur === cote,
  };
}

// POST /api/messagerie/conversations   body: { shop_id }
// Ouvre (ou retrouve) la conversation du client connecté avec une boutique
async function ouvrirConversation(req, res, next) {
  try {
    const { shop_id } = req.body;
    if (!isUuid(shop_id)) {
      return res.status(400).json({ error: 'Identifiant de boutique invalide.' });
    }

    const boutique = await db.query(
      `SELECT s.id, s.nom_boutique, s.logo_url,
              (s.owner_id = $2 OR EXISTS (
                 SELECT 1 FROM shop_team_members tm WHERE tm.shop_id = s.id AND tm.user_id = $2
              )) AS est_equipe
       FROM shops s WHERE s.id = $1`,
      [shop_id, req.userId]
    );
    if (boutique.rows.length === 0) {
      return res.status(404).json({ error: 'Boutique introuvable.' });
    }
    if (boutique.rows[0].est_equipe) {
      return res.status(403).json({ error: 'Tu ne peux pas discuter avec ta propre boutique.' });
    }

    const conversation = await db.query(
      `INSERT INTO conversations (client_id, shop_id) VALUES ($1, $2)
       ON CONFLICT (client_id, shop_id) DO UPDATE SET client_id = EXCLUDED.client_id
       RETURNING id`,
      [req.userId, shop_id]
    );
    res.json({
      id: conversation.rows[0].id,
      shop_id,
      titre: boutique.rows[0].nom_boutique,
      avatar: boutique.rows[0].logo_url,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/messagerie/conversations — discussions du client connecté
async function listerConversationsClient(req, res, next) {
  try {
    const result = await db.query(
      `SELECT c.id, c.shop_id, s.nom_boutique AS titre, s.logo_url AS avatar,
              lm.contenu AS dernier_contenu, lm.expediteur AS dernier_expediteur, c.dernier_message_le,
              (SELECT COUNT(*) FROM messages m
                WHERE m.conversation_id = c.id AND m.expediteur = 'boutique' AND m.id > c.client_dernier_lu)::int AS non_lus
       FROM conversations c
       JOIN shops s ON s.id = c.shop_id
       LEFT JOIN LATERAL (
         SELECT contenu, expediteur FROM messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1
       ) lm ON TRUE
       WHERE c.client_id = $1 AND c.dernier_message_le IS NOT NULL
       ORDER BY c.dernier_message_le DESC
       LIMIT 100`,
      [req.userId]
    );
    res.json(result.rows.map((r) => ({ ...r, dernier_est_moi: r.dernier_expediteur === 'client' })));
  } catch (err) {
    next(err);
  }
}

// GET /api/messagerie/boutiques/:shopId/conversations — discussions d'une boutique (accès équipe vérifié avant)
async function listerConversationsBoutique(req, res, next) {
  try {
    const result = await db.query(
      `SELECT c.id, c.shop_id,
              COALESCE(NULLIF(TRIM(u.prenom || ' ' || u.nom), ''), 'Client') AS titre,
              u.photo_profil_url AS avatar,
              lm.contenu AS dernier_contenu, lm.expediteur AS dernier_expediteur, c.dernier_message_le,
              (SELECT COUNT(*) FROM messages m
                WHERE m.conversation_id = c.id AND m.expediteur = 'client' AND m.id > c.boutique_dernier_lu)::int AS non_lus
       FROM conversations c
       JOIN users u ON u.id = c.client_id
       LEFT JOIN LATERAL (
         SELECT contenu, expediteur FROM messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1
       ) lm ON TRUE
       WHERE c.shop_id = $1 AND c.dernier_message_le IS NOT NULL
       ORDER BY c.dernier_message_le DESC
       LIMIT 100`,
      [req.params.shopId]
    );
    res.json(result.rows.map((r) => ({ ...r, dernier_est_moi: r.dernier_expediteur === 'boutique' })));
  } catch (err) {
    next(err);
  }
}

// GET /api/messagerie/conversations/:conversationId/messages?cote=client|boutique[&apres=ID | &avant=ID]
//  - sans paramètre : les derniers messages ;
//  - apres : les messages arrivés depuis (actualisation régulière) ;
//  - avant : l'historique plus ancien.
// Les messages reçus sont marqués comme lus (sauf quand on remonte l'historique).
async function listerMessages(req, res, next) {
  try {
    const cote = req.query.cote;
    if (!coteValide(cote)) {
      return res.status(400).json({ error: 'Côté de la conversation invalide.' });
    }
    const conversation = await chargerConversation(req.params.conversationId, req.userId);
    if (!estAutorise(conversation, cote)) {
      return res.status(404).json({ error: 'Conversation introuvable.' });
    }

    const apres = entierPositif(req.query.apres);
    const avant = entierPositif(req.query.avant);
    let result;
    if (apres) {
      result = await db.query(
        `SELECT id, expediteur, contenu, created_at FROM messages
         WHERE conversation_id = $1 AND id > $2 ORDER BY id ASC LIMIT 200`,
        [conversation.id, apres]
      );
    } else if (avant) {
      result = await db.query(
        `SELECT * FROM (
           SELECT id, expediteur, contenu, created_at FROM messages
           WHERE conversation_id = $1 AND id < $2 ORDER BY id DESC LIMIT $3
         ) t ORDER BY id ASC`,
        [conversation.id, avant, TAILLE_PAGE]
      );
    } else {
      result = await db.query(
        `SELECT * FROM (
           SELECT id, expediteur, contenu, created_at FROM messages
           WHERE conversation_id = $1 ORDER BY id DESC LIMIT $2
         ) t ORDER BY id ASC`,
        [conversation.id, TAILLE_PAGE]
      );
    }

    if (!avant) await marquerCommeLu(conversation.id, cote);

    res.json({
      conversation: decrire(conversation, cote),
      messages: result.rows.map((ligne) => formaterMessage(ligne, cote)),
      il_y_en_a_plus: !apres && result.rows.length === TAILLE_PAGE,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/messagerie/conversations/:conversationId/messages   body: { cote, contenu }
async function envoyerMessage(req, res, next) {
  try {
    const { cote, contenu } = req.body;
    if (!coteValide(cote)) {
      return res.status(400).json({ error: 'Côté de la conversation invalide.' });
    }
    if (typeof contenu !== 'string' || !contenu.trim()) {
      return res.status(400).json({ error: 'Écris un message avant de l\'envoyer.' });
    }
    const texte = contenu.trim();
    if (texte.length > LONGUEUR_MAX_MESSAGE) {
      return res.status(400).json({ error: `Le message est trop long (${LONGUEUR_MAX_MESSAGE} caractères maximum).` });
    }

    const conversation = await chargerConversation(req.params.conversationId, req.userId);
    if (!estAutorise(conversation, cote)) {
      return res.status(404).json({ error: 'Conversation introuvable.' });
    }

    // Un seul ordre SQL : le message est enregistré et la conversation remontée en haut de la liste, ou rien
    const result = await db.query(
      `WITH nouveau AS (
         INSERT INTO messages (conversation_id, expediteur, auteur_id, contenu)
         VALUES ($1, $2, $3, $4)
         RETURNING id, expediteur, contenu, created_at
       ), maj AS (
         UPDATE conversations SET dernier_message_le = NOW() WHERE id = $1
       )
       SELECT * FROM nouveau`,
      [conversation.id, cote, req.userId, texte]
    );
    res.status(201).json(formaterMessage(result.rows[0], cote));
  } catch (err) {
    next(err);
  }
}

// GET /api/messagerie/non-lus — compteurs pour les pastilles rouges des onglets
//   { client: nombre, boutiques: [{ shop_id, non_lus }] }
async function nonLus(req, res, next) {
  try {
    const client = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE c.client_id = $1 AND m.expediteur = 'boutique' AND m.id > c.client_dernier_lu`,
      [req.userId]
    );
    const boutiques = await db.query(
      `SELECT c.shop_id, COUNT(*)::int AS non_lus
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       JOIN shops s ON s.id = c.shop_id
       WHERE m.expediteur = 'client' AND m.id > c.boutique_dernier_lu
         AND (s.owner_id = $1 OR EXISTS (
               SELECT 1 FROM shop_team_members tm WHERE tm.shop_id = s.id AND tm.user_id = $1
             ))
       GROUP BY c.shop_id`,
      [req.userId]
    );
    res.json({ client: client.rows[0].total, boutiques: boutiques.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  initialiserMessagerie,
  ouvrirConversation,
  listerConversationsClient,
  listerConversationsBoutique,
  listerMessages,
  envoyerMessage,
  nonLus,
};
