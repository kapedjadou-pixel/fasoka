const db = require('../config/database');
const { isUuid } = require('../middleware/auth');
const {
  classerFichier, cloudinaryConfigure, nettoyerNom, envoyerVersCloudinary,
} = require('../services/piecesJointes');

// Messagerie : discussions entre un client et une boutique.
//  - une conversation = un client + une boutique (une seule par couple) ;
//  - côté « boutique », tous les membres de l'équipe (propriétaire, gérant, employé) voient la même conversation ;
//  - « cote » vaut 'client' ou 'boutique' : il dit de quel côté de la conversation on parle. Le serveur vérifie
//    que la personne connectée a bien ce rôle, on ne fait jamais confiance au simple identifiant de conversation ;
//  - types de messages : texte, image, document, audio (message vocal) ;
//  - coches : « envoyé » (enregistré), « reçu » (l'autre côté a l'application ouverte), « lu » (il a ouvert la discussion) ;
//  - présence : « en ligne » = a utilisé l'application dans les 70 dernières secondes ; « est en train d'écrire ».

const LONGUEUR_MAX_MESSAGE = 2000;
const TAILLE_PAGE = 50;
const DUREE_MAX_VOCAL_SECONDES = 3600;
const DUREE_ECRITURE_MS = 6000;

async function initialiserMessagerie() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      dernier_message_le TIMESTAMP,
      -- Numéro du dernier message lu / reçu de chaque côté (les messages suivants de l'autre côté sont « non lus »)
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

  // Présence (« en ligne ») et accusés de réception (coches)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS derniere_activite TIMESTAMP`);
  await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS client_dernier_recu BIGINT NOT NULL DEFAULT 0`);
  await db.query(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS boutique_dernier_recu BIGINT NOT NULL DEFAULT 0`);

  // Pièces jointes : photos, vocaux, documents
  await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'texte'`);
  await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS piece_jointe_url TEXT`);
  await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS nom_fichier VARCHAR(255)`);
  await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS type_mime VARCHAR(100)`);
  await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS taille_octets INTEGER`);
  await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS duree_secondes INTEGER`);
  await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS largeur INTEGER`);
  await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS hauteur INTEGER`);
  await db.query(`ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_type_check`);
  await db.query(
    `ALTER TABLE messages ADD CONSTRAINT messages_type_check CHECK (type IN ('texte', 'image', 'document', 'audio'))`
  );
}

// Marque la personne connectée comme « en ligne » (au plus une écriture toutes les 25 secondes)
function toucherPresence(req, res, next) {
  db.query(
    `UPDATE users SET derniere_activite = NOW()
     WHERE id = $1 AND (derniere_activite IS NULL OR derniere_activite < NOW() - INTERVAL '25 seconds')`,
    [req.userId]
  ).catch(() => {});
  next();
}

// ---------- « est en train d'écrire » (gardé en mémoire : quelques secondes de vie, rien en base) ----------
const ecritures = new Map(); // « conversation:côté » -> { genre, jusqua }

function noterEcriture(conversationId, cote, genre) {
  if (ecritures.size > 5000) {
    const maintenant = Date.now();
    for (const [cle, e] of ecritures) if (e.jusqua < maintenant) ecritures.delete(cle);
  }
  ecritures.set(conversationId + ':' + cote, { genre, jusqua: Date.now() + DUREE_ECRITURE_MS });
}

function lireEcriture(conversationId, cote) {
  const cle = conversationId + ':' + cote;
  const e = ecritures.get(cle);
  if (!e) return null;
  if (e.jusqua < Date.now()) {
    ecritures.delete(cle);
    return null;
  }
  return e.genre;
}

function effacerEcriture(conversationId, cote) {
  ecritures.delete(conversationId + ':' + cote);
}

function entierPositif(valeur) {
  const n = Number.parseInt(valeur, 10);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function coteValide(cote) {
  return cote === 'client' || cote === 'boutique';
}

const COLONNES_MESSAGE =
  'id, type, expediteur, contenu, piece_jointe_url, nom_fichier, type_mime, taille_octets, duree_secondes, largeur, hauteur, created_at';

// Charge une conversation : qui est le client, quelle boutique, si la personne connectée est le client et/ou
// membre de la boutique, où en sont les coches, et si l'autre côté est « en ligne »
async function chargerConversation(conversationId, userId) {
  if (!isUuid(conversationId)) return null;
  const result = await db.query(
    `SELECT c.id, c.client_id, c.shop_id,
            c.client_dernier_lu, c.client_dernier_recu, c.boutique_dernier_lu, c.boutique_dernier_recu,
            s.nom_boutique, s.logo_url,
            u.prenom AS client_prenom, u.nom AS client_nom, u.photo_profil_url AS client_photo,
            u.derniere_activite AS client_vu_le,
            (u.derniere_activite > NOW() - INTERVAL '70 seconds') AS client_en_ligne,
            b.boutique_vu_le,
            (b.boutique_vu_le > NOW() - INTERVAL '70 seconds') AS boutique_en_ligne,
            (c.client_id = $2) AS est_client,
            (s.owner_id = $2 OR EXISTS (
               SELECT 1 FROM shop_team_members tm WHERE tm.shop_id = s.id AND tm.user_id = $2
            )) AS est_boutique
     FROM conversations c
     JOIN shops s ON s.id = c.shop_id
     JOIN users u ON u.id = c.client_id
     LEFT JOIN LATERAL (
       SELECT MAX(x.derniere_activite) AS boutique_vu_le FROM users x
       WHERE x.id = s.owner_id OR x.id IN (SELECT user_id FROM shop_team_members WHERE shop_id = s.id)
     ) b ON TRUE
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

// Présence et coches de l'AUTRE côté (celui avec qui on discute)
function infosAutreCote(conversation, cote) {
  const autre = cote === 'client' ? 'boutique' : 'client';
  const lu = Number(conversation[autre + '_dernier_lu']) || 0;
  const recu = Math.max(Number(conversation[autre + '_dernier_recu']) || 0, lu);
  return {
    presence: { en_ligne: Boolean(conversation[autre + '_en_ligne']), vu_le: conversation[autre + '_vu_le'] || null },
    pointeurs: { lu, recu },
    ecrit: lireEcriture(conversation.id, autre),
  };
}

async function marquerCommeLu(conversationId, cote) {
  // valeurs fixes : pas de saisie utilisateur dans le SQL
  const lu = cote === 'client' ? 'client_dernier_lu' : 'boutique_dernier_lu';
  const recu = cote === 'client' ? 'client_dernier_recu' : 'boutique_dernier_recu';
  await db.query(
    `UPDATE conversations c SET ${lu} = m.max_id, ${recu} = GREATEST(c.${recu}, m.max_id)
     FROM (SELECT COALESCE(MAX(id), 0) AS max_id FROM messages WHERE conversation_id = $1) m
     WHERE c.id = $1 AND (c.${lu} < m.max_id OR c.${recu} < m.max_id)`,
    [conversationId]
  );
}

function formaterMessage(ligne, cote) {
  return {
    id: Number(ligne.id),
    type: ligne.type || 'texte',
    expediteur: ligne.expediteur,
    contenu: ligne.contenu,
    piece_jointe_url: ligne.piece_jointe_url || null,
    nom_fichier: ligne.nom_fichier || null,
    type_mime: ligne.type_mime || null,
    taille_octets: ligne.taille_octets === null || ligne.taille_octets === undefined ? null : Number(ligne.taille_octets),
    duree_secondes: ligne.duree_secondes === null || ligne.duree_secondes === undefined ? null : Number(ligne.duree_secondes),
    largeur: ligne.largeur === null || ligne.largeur === undefined ? null : Number(ligne.largeur),
    hauteur: ligne.hauteur === null || ligne.hauteur === undefined ? null : Number(ligne.hauteur),
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
              lm.contenu AS dernier_contenu, lm.expediteur AS dernier_expediteur, lm.type AS dernier_type,
              lm.nom_fichier AS dernier_nom_fichier, lm.duree_secondes AS dernier_duree, c.dernier_message_le,
              (SELECT COUNT(*) FROM messages m
                WHERE m.conversation_id = c.id AND m.expediteur = 'boutique' AND m.id > c.client_dernier_lu)::int AS non_lus
       FROM conversations c
       JOIN shops s ON s.id = c.shop_id
       LEFT JOIN LATERAL (
         SELECT contenu, expediteur, type, nom_fichier, duree_secondes
         FROM messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1
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
              lm.contenu AS dernier_contenu, lm.expediteur AS dernier_expediteur, lm.type AS dernier_type,
              lm.nom_fichier AS dernier_nom_fichier, lm.duree_secondes AS dernier_duree, c.dernier_message_le,
              (SELECT COUNT(*) FROM messages m
                WHERE m.conversation_id = c.id AND m.expediteur = 'client' AND m.id > c.boutique_dernier_lu)::int AS non_lus
       FROM conversations c
       JOIN users u ON u.id = c.client_id
       LEFT JOIN LATERAL (
         SELECT contenu, expediteur, type, nom_fichier, duree_secondes
         FROM messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1
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
// La réponse contient aussi la présence de l'autre côté (« en ligne », dernière activité, « écrit… ») et ses
// pointeurs de lecture, qui permettent d'afficher les coches (envoyé / reçu / lu) de mes messages.
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
        `SELECT ${COLONNES_MESSAGE} FROM messages
         WHERE conversation_id = $1 AND id > $2 ORDER BY id ASC LIMIT 200`,
        [conversation.id, apres]
      );
    } else if (avant) {
      result = await db.query(
        `SELECT * FROM (
           SELECT ${COLONNES_MESSAGE} FROM messages
           WHERE conversation_id = $1 AND id < $2 ORDER BY id DESC LIMIT $3
         ) t ORDER BY id ASC`,
        [conversation.id, avant, TAILLE_PAGE]
      );
    } else {
      result = await db.query(
        `SELECT * FROM (
           SELECT ${COLONNES_MESSAGE} FROM messages
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
      ...infosAutreCote(conversation, cote),
    });
  } catch (err) {
    next(err);
  }
}

// Enregistre le message et remonte la conversation en haut de la liste, en un seul ordre SQL (tout ou rien)
async function enregistrerMessage({ conversationId, cote, userId, contenu, pieceJointe }) {
  const p = pieceJointe || {};
  const result = await db.query(
    `WITH nouveau AS (
       INSERT INTO messages (conversation_id, expediteur, auteur_id, contenu,
                             type, piece_jointe_url, nom_fichier, type_mime, taille_octets, duree_secondes, largeur, hauteur)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING ${COLONNES_MESSAGE}
     ), maj AS (
       UPDATE conversations SET dernier_message_le = NOW() WHERE id = $1
     )
     SELECT * FROM nouveau`,
    [
      conversationId, cote, userId, contenu,
      p.type || 'texte', p.url || null, p.nomFichier || null, p.typeMime || null,
      p.taille || null, p.duree || null, p.largeur || null, p.hauteur || null,
    ]
  );
  return result.rows[0];
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

    const ligne = await enregistrerMessage({ conversationId: conversation.id, cote, userId: req.userId, contenu: texte });
    effacerEcriture(conversation.id, cote);
    res.status(201).json(formaterMessage(ligne, cote));
  } catch (err) {
    next(err);
  }
}

// POST /api/messagerie/conversations/:conversationId/pieces-jointes
// multipart/form-data : fichier (photo, vocal ou document), cote, [duree en secondes pour un vocal], [legende]
async function envoyerPieceJointe(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucun fichier reçu.' });
    }
    const cote = req.body.cote;
    if (!coteValide(cote)) {
      return res.status(400).json({ error: 'Côté de la conversation invalide.' });
    }
    const classe = classerFichier(req.file.mimetype);
    if (!classe) {
      return res.status(400).json({ error: "Ce type de fichier n'est pas accepté." });
    }

    const conversation = await chargerConversation(req.params.conversationId, req.userId);
    if (!estAutorise(conversation, cote)) {
      return res.status(404).json({ error: 'Conversation introuvable.' });
    }
    if (!cloudinaryConfigure()) {
      return res.status(503).json({ error: "L'envoi de fichiers n'est pas disponible pour le moment." });
    }

    let duree = null;
    if (classe.type === 'audio') {
      duree = entierPositif(req.body.duree);
      if (duree && duree > DUREE_MAX_VOCAL_SECONDES) duree = DUREE_MAX_VOCAL_SECONDES;
    }
    const legende = typeof req.body.legende === 'string' ? req.body.legende.trim().slice(0, 1000) : '';

    const resultat = await envoyerVersCloudinary(req.file.buffer, classe);

    const ligne = await enregistrerMessage({
      conversationId: conversation.id,
      cote,
      userId: req.userId,
      contenu: legende,
      pieceJointe: {
        type: classe.type,
        url: resultat.secure_url,
        nomFichier: nettoyerNom(req.file.originalname, classe.extension),
        typeMime: String(req.file.mimetype).split(';')[0].trim().toLowerCase().slice(0, 100),
        taille: req.file.size,
        duree,
        largeur: classe.type === 'image' ? resultat.width : null,
        hauteur: classe.type === 'image' ? resultat.height : null,
      },
    });
    effacerEcriture(conversation.id, cote);
    res.status(201).json(formaterMessage(ligne, cote));
  } catch (err) {
    next(err);
  }
}

// POST /api/messagerie/conversations/:conversationId/ecriture   body: { cote, genre: 'texte' | 'audio' }
// Appelé toutes les 3 secondes pendant que la personne écrit ou enregistre un vocal
async function signalerEcriture(req, res, next) {
  try {
    const { cote, genre } = req.body;
    if (!coteValide(cote) || (genre !== 'texte' && genre !== 'audio')) {
      return res.status(400).json({ error: 'Requête invalide.' });
    }
    const conversation = await chargerConversation(req.params.conversationId, req.userId);
    if (!estAutorise(conversation, cote)) {
      return res.status(404).json({ error: 'Conversation introuvable.' });
    }
    noterEcriture(conversation.id, cote, genre);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// GET /api/messagerie/non-lus — compteurs pour les pastilles rouges des onglets
//   { client: nombre, boutiques: [{ shop_id, non_lus }] }
// Appelé régulièrement par l'application ouverte : c'est aussi ce qui marque les messages comme « reçus »
async function nonLus(req, res, next) {
  try {
    // Messages reçus (deuxième coche grise) : l'application de la personne est ouverte et a interrogé le serveur
    await db.query(
      `UPDATE conversations c SET client_dernier_recu = m.max_id
       FROM (
         SELECT conversation_id, MAX(id) AS max_id FROM messages
         WHERE conversation_id IN (SELECT id FROM conversations WHERE client_id = $1)
         GROUP BY conversation_id
       ) m
       WHERE c.id = m.conversation_id AND c.client_dernier_recu < m.max_id`,
      [req.userId]
    );
    await db.query(
      `UPDATE conversations c SET boutique_dernier_recu = m.max_id
       FROM (
         SELECT conversation_id, MAX(id) AS max_id FROM messages
         WHERE conversation_id IN (
           SELECT c2.id FROM conversations c2 JOIN shops s ON s.id = c2.shop_id
           WHERE s.owner_id = $1 OR EXISTS (
             SELECT 1 FROM shop_team_members tm WHERE tm.shop_id = s.id AND tm.user_id = $1
           )
         )
         GROUP BY conversation_id
       ) m
       WHERE c.id = m.conversation_id AND c.boutique_dernier_recu < m.max_id`,
      [req.userId]
    );

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
  toucherPresence,
  ouvrirConversation,
  listerConversationsClient,
  listerConversationsBoutique,
  listerMessages,
  envoyerMessage,
  envoyerPieceJointe,
  signalerEcriture,
  nonLus,
};
