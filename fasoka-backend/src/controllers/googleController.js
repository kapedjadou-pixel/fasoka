const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { OAuth2Client } = require('google-auth-library');
const db = require('../config/database');
const { generateToken } = require('../utils/jwt');

// Identifiant client OAuth « Application Web » créé dans Google Cloud Console.
// Ce n'est pas un secret (il figure aussi dans le site). On peut le remplacer sur Render avec la variable GOOGLE_CLIENT_ID.
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || '712696140022-u1uumn8vha0hddv5omkn7dra0q30pl52.apps.googleusercontent.com';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// Mêmes champs que la connexion classique : jamais le hash du mot de passe ni les codes
const CHAMPS_UTILISATEUR = 'id, nom, prenom, email, telephone, compte_verifie, photo_profil_url, created_at';

function extraireNoms(payload, email) {
  const complet = (payload.name || '').trim();
  const prenom = (payload.given_name || complet.split(/\s+/)[0] || email.split('@')[0] || 'Utilisateur').trim();
  let nom = (payload.family_name || '').trim();
  if (!nom) nom = complet.split(/\s+/).slice(1).join(' ') || '-';
  return { prenom: prenom.slice(0, 100), nom: nom.slice(0, 100) };
}

// POST /api/auth/google
// body: { credential }  → « credential » est le jeton (ID token) remis par Google au navigateur.
// Le serveur vérifie sa signature, sa destination (notre identifiant client) et sa validité chez Google,
// puis connecte, relie ou crée le compte.
async function loginGoogle(req, res, next) {
  try {
    const { credential } = req.body;
    if (typeof credential !== 'string' || credential.length < 20 || credential.length > 4096) {
      return res.status(400).json({ error: 'Connexion Google invalide.' });
    }

    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch (e) {
      return res.status(401).json({ error: 'Connexion Google refusée. Réessaie.' });
    }

    if (!payload || !payload.sub || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({ error: "L'adresse email de ce compte Google n'est pas vérifiée." });
    }

    const email = payload.email.trim().toLowerCase();
    const googleId = payload.sub;

    // 1) Compte déjà relié à ce compte Google : simple connexion
    const lie = await db.query(`SELECT ${CHAMPS_UTILISATEUR} FROM users WHERE google_id = $1`, [googleId]);
    if (lie.rows[0]) {
      return res.json({ user: lie.rows[0], token: generateToken(lie.rows[0].id) });
    }

    // 2) Un compte existe déjà avec cet email
    const existant = await db.query(`SELECT id, compte_verifie FROM users WHERE LOWER(email) = $1`, [email]);
    if (existant.rows[0]) {
      const compte = existant.rows[0];

      // Si l'email de ce compte n'a jamais été confirmé, on ne le relie pas : quelqu'un aurait pu l'ouvrir
      // avec l'adresse d'une autre personne en connaissant le mot de passe. Il faut d'abord se connecter normalement.
      if (!compte.compte_verifie) {
        return res.status(409).json({
          error: 'Un compte existe déjà avec cette adresse email. Connecte-toi avec ton mot de passe (ou utilise « Mot de passe oublié »).',
        });
      }

      const maj = await db.query(
        `UPDATE users SET google_id = $1, updated_at = NOW() WHERE id = $2 AND google_id IS NULL
         RETURNING ${CHAMPS_UTILISATEUR}`,
        [googleId, compte.id]
      );
      if (!maj.rows[0]) {
        return res.status(409).json({ error: 'Ce compte est déjà relié à un autre compte Google.' });
      }
      return res.json({ user: maj.rows[0], token: generateToken(maj.rows[0].id) });
    }

    // 3) Nouveau compte : l'email est vérifié par Google, le compte est donc créé « vérifié ».
    // Le mot de passe est un secret aléatoire que personne ne connaît : la connexion par mot de passe reste fermée
    // tant que la personne n'a pas utilisé « Mot de passe oublié » pour en choisir un.
    const { prenom, nom } = extraireNoms(payload, email);
    const motDePasseInutilisable = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const photo = typeof payload.picture === 'string' && payload.picture.startsWith('https://') ? payload.picture : null;

    const cree = await db.query(
      `INSERT INTO users (nom, prenom, email, mot_de_passe_hash, compte_verifie, google_id, photo_profil_url)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6)
       RETURNING ${CHAMPS_UTILISATEUR}`,
      [nom, prenom, email, motDePasseInutilisable, googleId, photo]
    );
    res.status(201).json({ user: cree.rows[0], token: generateToken(cree.rows[0].id) });
  } catch (err) {
    next(err);
  }
}

module.exports = { loginGoogle };
