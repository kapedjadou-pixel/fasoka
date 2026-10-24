const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/database');
const { generateToken } = require('../utils/jwt');
const { envoyerEmail, emailConfigure } = require('../services/emailService');

const DUREE_CODE_MINUTES = 10;
const MAX_TENTATIVES = 5;
const DELAI_RENVOI_SECONDES = 60;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Champs renvoyés à l'app : jamais le hash du mot de passe ni le code de confirmation
// (le login faisait `SELECT *` et renvoyait donc code_confirmation au client).
const CHAMPS_UTILISATEUR = 'id, nom, prenom, email, telephone, compte_verifie, photo_profil_url, created_at';

// Hash factice : permet de dépenser le même temps de calcul quand l'identifiant n'existe pas,
// pour ne pas révéler par le temps de réponse si un compte existe.
const HASH_FACTICE = bcrypt.hashSync('mot-de-passe-factice', 10);

// Code à 6 chiffres issu d'un générateur cryptographique (Math.random est prévisible)
function generateConfirmationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function estTexte(valeur) {
  return typeof valeur === 'string' && valeur.trim().length > 0;
}

// Génère un code, enregistre uniquement son empreinte, puis l'envoie par email si le compte en a un.
// Aucun SMS n'est branché : un compte « téléphone seul » ne reçoit donc pas de code pour le moment.
async function emettreCode(user) {
  const code = generateConfirmationCode();
  const codeHash = await bcrypt.hash(code, 10);
  await db.query(
    `UPDATE users
     SET code_confirmation = $1,
         code_expire_le = NOW() + INTERVAL '${DUREE_CODE_MINUTES} minutes',
         code_tentatives = 0,
         code_envoye_le = NOW()
     WHERE id = $2`,
    [codeHash, user.id]
  );

  if (!user.email) return { envoye: false };

  // Sans fournisseur d'email configuré, emailService écrirait le code en clair dans les logs.
  // On n'envoie donc rien, sauf en simulation explicite (EMAIL_SIMULATION=true, pour le développement).
  if (!emailConfigure() && process.env.EMAIL_SIMULATION !== 'true') return { envoye: false };

  const text =
    `Bonjour ${user.prenom || ''},\n\n` +
    `Ton code de confirmation Fasoka est : ${code}\n` +
    `Il est valable ${DUREE_CODE_MINUTES} minutes. Si ce n'est pas toi, ignore ce message.\n`;
  try {
    await envoyerEmail({ to: user.email, subject: 'Fasoka — confirme ton compte', text });
    return { envoye: true };
  } catch (e) {
    // L'inscription ne doit pas échouer parce que l'email n'est pas parti : l'utilisateur
    // pourra redemander un code via POST /api/auth/resend-code. Le code n'est jamais journalisé.
    console.error('Email de confirmation non envoyé :', e.message);
    return { envoye: false };
  }
}

// POST /api/auth/signup
async function signup(req, res, next) {
  try {
    const { nom, prenom, email, telephone, mot_de_passe } = req.body;

    if (!estTexte(nom) || !estTexte(prenom) || typeof mot_de_passe !== 'string' || (!estTexte(email) && !estTexte(telephone))) {
      return res.status(400).json({
        error: 'Nom, prénom, mot de passe et (email ou téléphone) sont obligatoires.',
      });
    }
    if (nom.trim().length > 100 || prenom.trim().length > 100) {
      return res.status(400).json({ error: 'Nom et prénom : 100 caractères maximum.' });
    }
    if (mot_de_passe.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }
    // bcrypt ignore silencieusement tout ce qui dépasse 72 octets
    if (Buffer.byteLength(mot_de_passe, 'utf8') > 72) {
      return res.status(400).json({ error: 'Le mot de passe est trop long (72 caractères maximum).' });
    }

    const emailNormalise = estTexte(email) ? email.trim().toLowerCase() : null;
    if (emailNormalise && (!EMAIL_REGEX.test(emailNormalise) || emailNormalise.length > 255)) {
      return res.status(400).json({ error: 'Adresse email invalide.' });
    }
    const telephoneNormalise = estTexte(telephone) ? telephone.trim() : null;
    if (telephoneNormalise && telephoneNormalise.length > 20) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide (20 caractères maximum).' });
    }

    const mot_de_passe_hash = await bcrypt.hash(mot_de_passe, 10);

    // Un doublon email/téléphone lève l'erreur PostgreSQL 23505, convertie en 409 par errorHandler
    const result = await db.query(
      `INSERT INTO users (nom, prenom, email, telephone, mot_de_passe_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${CHAMPS_UTILISATEUR}`,
      [nom.trim(), prenom.trim(), emailNormalise, telephoneNormalise, mot_de_passe_hash]
    );
    const user = result.rows[0];

    await emettreCode(user);

    const token = generateToken(user.id);
    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/confirm  (connecté) — body: { code }
// L'identité vient désormais du token, plus d'un `user_id` fourni par le client :
// on ne peut plus tenter de deviner le code d'un autre compte.
async function confirmAccount(req, res, next) {
  try {
    const { code } = req.body;
    if (typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return res.status(400).json({ error: 'Le code doit contenir 6 chiffres.' });
    }

    const etat = await db.query(
      `SELECT compte_verifie, code_confirmation, code_expire_le FROM users WHERE id = $1`,
      [req.userId]
    );
    const ligne = etat.rows[0];
    if (!ligne) return res.status(404).json({ error: 'Compte introuvable.' });
    if (ligne.compte_verifie) return res.json({ message: 'Compte déjà confirmé.' });

    if (!ligne.code_confirmation || !ligne.code_expire_le || new Date(ligne.code_expire_le) < new Date()) {
      return res.status(400).json({ error: 'Code expiré ou introuvable. Demande un nouveau code.' });
    }

    // Le compteur est incrémenté AVANT la comparaison et de façon atomique : des requêtes
    // simultanées ne peuvent pas dépasser MAX_TENTATIVES.
    const tentative = await db.query(
      `UPDATE users SET code_tentatives = COALESCE(code_tentatives, 0) + 1
       WHERE id = $1 AND COALESCE(code_tentatives, 0) < $2
       RETURNING code_confirmation, code_tentatives`,
      [req.userId, MAX_TENTATIVES]
    );
    if (tentative.rows.length === 0) {
      return res.status(429).json({ error: 'Trop de tentatives. Demande un nouveau code.' });
    }

    const valide = await bcrypt.compare(code.trim(), tentative.rows[0].code_confirmation);
    if (!valide) {
      const restants = MAX_TENTATIVES - tentative.rows[0].code_tentatives;
      return res.status(400).json({
        error: restants > 0
          ? `Code incorrect. Il te reste ${restants} essai(s).`
          : 'Code incorrect. Demande un nouveau code.',
      });
    }

    const result = await db.query(
      `UPDATE users
       SET compte_verifie = TRUE, code_confirmation = NULL, code_expire_le = NULL, code_tentatives = 0
       WHERE id = $1
       RETURNING id, compte_verifie`,
      [req.userId]
    );
    res.json({ message: 'Compte confirmé avec succès.', user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/resend-code  (connecté) — nouveau code, au plus un par minute
async function resendCode(req, res, next) {
  try {
    const result = await db.query(
      `SELECT id, prenom, email, compte_verifie, code_envoye_le FROM users WHERE id = $1`,
      [req.userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Compte introuvable.' });
    if (user.compte_verifie) return res.json({ message: 'Compte déjà confirmé.' });
    if (!user.email) {
      return res.status(400).json({ error: "Aucun email n'est associé à ton compte : impossible d'envoyer un code." });
    }
    if (user.code_envoye_le && Date.now() - new Date(user.code_envoye_le).getTime() < DELAI_RENVOI_SECONDS * 1000) {
      return res.status(429).json({ error: "Un code vient d'être envoyé. Patiente une minute avant d'en demander un nouveau." });
    }

    const envoi = await emettreCode(user);
    if (!envoi.envoye) {
      return res.status(502).json({ error: "Impossible d'envoyer l'email pour le moment. Réessaie dans quelques instants." });
    }
    res.json({ message: 'Un nouveau code a été envoyé.', expire_dans_minutes: DUREE_CODE_MINUTES });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { identifiant, mot_de_passe } = req.body; // identifiant = email ou téléphone

    if (!estTexte(identifiant) || typeof mot_de_passe !== 'string' || mot_de_passe.length === 0) {
      return res.status(400).json({ error: 'Identifiant et mot de passe obligatoires.' });
    }
    // Garde-fou : bcrypt ne lit que 72 octets, inutile de faire travailler le serveur sur un texte géant
    if (identifiant.length > 255 || Buffer.byteLength(mot_de_passe, 'utf8') > 72) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const id = identifiant.trim();
    const result = await db.query(
      `SELECT ${CHAMPS_UTILISATEUR}, mot_de_passe_hash FROM users
       WHERE LOWER(email) = LOWER($1) OR telephone = $1`,
      [id]
    );
    const user = result.rows[0];

    // Toujours exécuter un bcrypt.compare, même sans compte, pour un temps de réponse comparable
    const motDePasseValide = await bcrypt.compare(mot_de_passe, user ? user.mot_de_passe_hash : HASH_FACTICE);
    if (!user || !motDePasseValide) {
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    const token = generateToken(user.id);
    delete user.mot_de_passe_hash;
    res.json({ user, token });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, confirmAccount, resendCode, login };
