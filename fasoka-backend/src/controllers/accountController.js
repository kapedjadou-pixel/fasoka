const bcrypt = require('bcrypt');
const crypto = require('crypto');
const streamifier = require('streamifier');
const db = require('../config/database');
const cloudinary = require('../config/cloudinary');
const { envoyerEmail, emailConfigure } = require('../services/emailService');
const DUREE_CODE_MINUTES = 10;
const MAX_TENTATIVES = 5;
const DELAI_RENVOI_SECONDES = 60;
const TYPES_VALIDES = ['mot_de_passe', 'email'];

// Champs du compte renvoyés à l'app (jamais le mot de passe ni les codes)
const CHAMPS_UTILISATEUR = 'id, nom, prenom, email, telephone, compte_verifie, photo_profil_url, created_at';

// ---------- Table des codes de confirmation (créée automatiquement au démarrage) ----------
async function initialiserTables() {
  // Migration idempotente pour les bases créées avant le durcissement de la confirmation de compte :
  // le code est désormais stocké haché (bcrypt, 60 caractères) avec expiration et compteur d'essais.
  await db.query(`ALTER TABLE users ALTER COLUMN code_confirmation TYPE VARCHAR(255)`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS code_expire_le TIMESTAMP`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS code_tentatives INTEGER DEFAULT 0`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS code_envoye_le TIMESTAMP`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS verification_codes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(30) NOT NULL CHECK (type IN ('mot_de_passe', 'email')),
      code_hash VARCHAR(255) NOT NULL,
      nouvelle_valeur TEXT NOT NULL,
      tentatives INTEGER DEFAULT 0,
      expire_le TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_verification_codes_user ON verification_codes(user_id, type)`
  );
       // Autorise le type « reinitialisation » (mot de passe oublié) dans les bases déjà créées
     await db.query(`ALTER TABLE verification_codes DROP CONSTRAINT IF EXISTS verification_codes_type_check`);
     await db.query(
       `ALTER TABLE verification_codes ADD CONSTRAINT verification_codes_type_check
        CHECK (type IN ('mot_de_passe', 'email', 'reinitialisation'))`
     );
}

// ---------- Utilitaires ----------
function masquerEmail(email) {
  const [local, domaine] = email.split('@');
  return local.charAt(0) + '***@' + domaine;
}

function echapperHtml(texte) {
  const remplacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(texte).replace(/[&<>"']/g, (c) => remplacements[c]);
}

function construireEmailCode({ prenom, code, action }) {
  const text =
    `Bonjour ${prenom || ''},\n\n` +
    `Tu as demandé à ${action}.\n` +
    `Ton code de confirmation Fasoka est : ${code}\n\n` +
    `Il est valable ${DUREE_CODE_MINUTES} minutes. Si ce n'est pas toi, ignore ce message : rien ne sera modifié.\n`;

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#F5F3EE;padding:24px;">
    <div style="background:#0A0A0A;color:#FFC61E;font-weight:900;font-size:22px;letter-spacing:2px;text-align:center;padding:16px;border-radius:12px 12px 0 0;">FASOKA</div>
    <div style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 12px;">Bonjour ${echapperHtml(prenom || '')},</p>
      <p style="margin:0 0 16px;">Tu as demandé à ${echapperHtml(action)}. Voici ton code de confirmation :</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;background:#F5F3EE;border-radius:8px;padding:16px;margin-bottom:16px;">${code}</div>
      <p style="margin:0;font-size:13px;color:#8A8A8A;">Ce code est valable ${DUREE_CODE_MINUTES} minutes. Si ce n'est pas toi, ignore ce message : rien ne sera modifié.</p>
    </div>
  </div>`;

  return { text, html };
}

// Prévient l'ancien email qu'une modification vient d'avoir lieu (échec silencieux)
function notifierChangement({ to, prenom, message }) {
  const text = `Bonjour ${prenom || ''},\n\n${message}\nSi ce n'est pas toi, contacte-nous au plus vite.\n`;
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
    <p>Bonjour ${echapperHtml(prenom || '')},</p>
    <p>${echapperHtml(message)}</p>
    <p style="color:#8A8A8A;font-size:13px;">Si ce n'est pas toi, contacte-nous au plus vite.</p>
  </div>`;
  envoyerEmail({ to, subject: 'Fasoka — modification de ton compte', text, html }).catch((e) =>
    console.error('Notification de changement non envoyée :', e.message)
  );
}

// ---------- Profil ----------

// GET /api/account/me
async function getMe(req, res, next) {
  try {
    const result = await db.query(`SELECT ${CHAMPS_UTILISATEUR} FROM users WHERE id = $1`, [req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Compte introuvable.' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/account/profile  — prénom, nom, téléphone (pas de code requis)
async function updateProfile(req, res, next) {
  try {
    const { prenom, nom, telephone } = req.body;

    const actuel = await db.query(`SELECT email FROM users WHERE id = $1`, [req.userId]);
    if (actuel.rows.length === 0) return res.status(404).json({ error: 'Compte introuvable.' });

    const champs = [];
    const valeurs = [];

    if (prenom !== undefined) {
      if (!String(prenom).trim()) return res.status(400).json({ error: 'Le prénom ne peut pas être vide.' });
      valeurs.push(String(prenom).trim());
      champs.push(`prenom = $${valeurs.length}`);
    }
    if (nom !== undefined) {
      if (!String(nom).trim()) return res.status(400).json({ error: 'Le nom ne peut pas être vide.' });
      valeurs.push(String(nom).trim());
      champs.push(`nom = $${valeurs.length}`);
    }
    if (telephone !== undefined) {
      const tel = String(telephone).trim();
      if (!tel && !actuel.rows[0].email) {
        return res.status(400).json({ error: 'Tu dois garder au moins un téléphone ou un email.' });
      }
      valeurs.push(tel || null);
      champs.push(`telephone = $${valeurs.length}`);
    }

    if (champs.length === 0) return res.status(400).json({ error: 'Aucune modification à enregistrer.' });

    valeurs.push(req.userId);
    const result = await db.query(
      `UPDATE users SET ${champs.join(', ')}, updated_at = NOW()
       WHERE id = $${valeurs.length} RETURNING ${CHAMPS_UTILISATEUR}`,
      valeurs
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ce numéro de téléphone est déjà utilisé par un autre compte.' });
    }
    next(err);
  }
}

// ---------- Photo de profil ----------

function envoyerAvatar(buffer) {
  return new Promise((resolve, reject) => {
    const flux = cloudinary.uploader.upload_stream(
      {
        folder: 'fasoka/avatars',
        transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'auto', quality: 'auto' }],
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(flux);
  });
}

async function supprimerFichierAvatar(url) {
  if (!url) return;
  const correspondance = url.match(/fasoka\/avatars\/[^./]+/);
  if (correspondance) {
    await cloudinary.uploader.destroy(correspondance[0]).catch(() => {});
  }
}

// POST /api/account/avatar  (multipart/form-data, champ "image")
async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucune image reçue.' });

    const ancien = await db.query(`SELECT photo_profil_url FROM users WHERE id = $1`, [req.userId]);
    const resultat = await envoyerAvatar(req.file.buffer);

    const maj = await db.query(
      `UPDATE users SET photo_profil_url = $1, updated_at = NOW()
       WHERE id = $2 RETURNING ${CHAMPS_UTILISATEUR}`,
      [resultat.secure_url, req.userId]
    );

    await supprimerFichierAvatar(ancien.rows[0] && ancien.rows[0].photo_profil_url);
    res.json(maj.rows[0]);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/account/avatar
async function deleteAvatar(req, res, next) {
  try {
    const ancien = await db.query(`SELECT photo_profil_url FROM users WHERE id = $1`, [req.userId]);
    const maj = await db.query(
      `UPDATE users SET photo_profil_url = NULL, updated_at = NOW()
       WHERE id = $1 RETURNING ${CHAMPS_UTILISATEUR}`,
      [req.userId]
    );
    await supprimerFichierAvatar(ancien.rows[0] && ancien.rows[0].photo_profil_url);
    res.json(maj.rows[0]);
  } catch (err) {
    next(err);
  }
}

// ---------- Sécurité : changement de mot de passe / d'email avec code de confirmation ----------

// POST /api/account/security/request
// body: { type: 'mot_de_passe', nouveau_mot_de_passe } ou { type: 'email', nouvel_email }
// Envoie un code à 6 chiffres à l'email ACTUEL du compte.
async function demanderCode(req, res, next) {
  try {
    const { type, nouveau_mot_de_passe, nouvel_email } = req.body;
    if (!TYPES_VALIDES.includes(type)) {
      return res.status(400).json({ error: 'Type de modification invalide.' });
    }

    // Récupère le compte connecté : `utilisateur` était utilisé plus bas sans jamais être défini
    // (ReferenceError → erreur 500 à chaque demande de code).
    const compte = await db.query(`SELECT id, prenom, email FROM users WHERE id = $1`, [req.userId]);
    const utilisateur = compte.rows[0];
    if (!utilisateur) {
      return res.status(404).json({ error: 'Compte introuvable.' });
    }
    // Le code est envoyé à l'email ACTUEL : un compte créé avec un téléphone seul n'en a pas.
    if (!utilisateur.email) {
      return res.status(400).json({
        error: "Aucun email n'est associé à ton compte : impossible d'envoyer un code de confirmation.",
      });
    }

    // Tant qu'aucun service d'envoi d'emails n'est configuré, on refuse proprement
    // (au lieu de faire semblant d'envoyer un code). Pour tester sans envoi réel, ajouter la
    // variable EMAIL_SIMULATION=true : le code s'affiche alors dans les logs du serveur.
    if (!emailConfigure() && process.env.EMAIL_SIMULATION !== 'true') {
      return res.status(503).json({
        error: "L'envoi des codes par email n'est pas encore activé. Cette fonction sera disponible prochainement.",
      });
    }

    // Anti-spam : un seul code par minute
    const recent = await db.query(
      `SELECT 1 FROM verification_codes
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${DELAI_RENVOI_SECONDES} seconds'`,
      [req.userId]
    );
    if (recent.rows.length > 0) {
      return res.status(429).json({ error: "Un code vient d'être envoyé. Patiente une minute avant d'en demander un nouveau." });
    }

    // Valide et prépare la nouvelle valeur (stockée telle quelle jusqu'à confirmation du code)
    let nouvelleValeur;
    if (type === 'mot_de_passe') {
      if (typeof nouveau_mot_de_passe !== 'string' || nouveau_mot_de_passe.length < 8) {
        return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
      }
      // bcrypt ignore silencieusement tout ce qui dépasse 72 octets
      if (Buffer.byteLength(nouveau_mot_de_passe, 'utf8') > 72) {
        return res.status(400).json({ error: 'Le mot de passe est trop long (72 caractères maximum).' });
      }
      nouvelleValeur = await bcrypt.hash(nouveau_mot_de_passe, 10);
    } else {
      const email = String(nouvel_email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Adresse email invalide.' });
      }
      if (email === utilisateur.email.toLowerCase()) {
        return res.status(400).json({ error: "C'est déjà ton adresse email actuelle." });
      }
      const dejaPris = await db.query(`SELECT 1 FROM users WHERE LOWER(email) = $1`, [email]);
      if (dejaPris.rows.length > 0) {
        return res.status(409).json({ error: 'Cette adresse email est déjà utilisée par un autre compte.' });
      }
      nouvelleValeur = email;
    }

    // Génère le code (6 chiffres) et ne conserve que son empreinte
    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = await bcrypt.hash(code, 10);

    await db.query(`DELETE FROM verification_codes WHERE user_id = $1 AND type = $2`, [req.userId, type]);
    const insere = await db.query(
      `INSERT INTO verification_codes (user_id, type, code_hash, nouvelle_valeur, expire_le)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${DUREE_CODE_MINUTES} minutes') RETURNING id`,
      [req.userId, type, codeHash, nouvelleValeur]
    );

    const action =
      type === 'mot_de_passe'
        ? 'changer ton mot de passe'
        : `changer ton email de connexion vers ${nouvelleValeur}`;
    const contenu = construireEmailCode({ prenom: utilisateur.prenom, code, action });

    try {
      await envoyerEmail({
        to: utilisateur.email,
        subject: 'Fasoka — ton code de confirmation',
        text: contenu.text,
        html: contenu.html,
      });
    } catch (e) {
      console.error(e.message);
      await db.query(`DELETE FROM verification_codes WHERE id = $1`, [insere.rows[0].id]);
      return res.status(502).json({ error: "Impossible d'envoyer l'email pour le moment. Réessaie dans quelques instants." });
    }

    res.json({
      message: 'Un code de confirmation a été envoyé à ' + masquerEmail(utilisateur.email) + '.',
      email_masque: masquerEmail(utilisateur.email),
      expire_dans_minutes: DUREE_CODE_MINUTES,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/account/security/confirm
// body: { type, code }  → applique la modification si le code est bon
async function confirmerCode(req, res, next) {
  try {
    const { type, code } = req.body;
    if (!TYPES_VALIDES.includes(type) || !code) {
      return res.status(400).json({ error: 'Type ou code manquant.' });
    }

    const trouve = await db.query(
      `SELECT * FROM verification_codes
       WHERE user_id = $1 AND type = $2 AND expire_le > NOW()`,
      [req.userId, type]
    );
    const ligne = trouve.rows[0];
    if (!ligne) {
      return res.status(400).json({ error: 'Code expiré ou introuvable. Demande un nouveau code.' });
    }

    if (ligne.tentatives >= MAX_TENTATIVES) {
      await db.query(`DELETE FROM verification_codes WHERE id = $1`, [ligne.id]);
      return res.status(429).json({ error: 'Trop de tentatives. Demande un nouveau code.' });
    }

    const valide = await bcrypt.compare(String(code).trim(), ligne.code_hash);
    if (!valide) {
      await db.query(`UPDATE verification_codes SET tentatives = tentatives + 1 WHERE id = $1`, [ligne.id]);
      const restants = MAX_TENTATIVES - (ligne.tentatives + 1);
      return res.status(400).json({
        error: restants > 0
          ? 'Code incorrect. Il te reste ' + restants + ' essai(s).'
          : 'Code incorrect. Demande un nouveau code.',
      });
    }

    // Code correct : on applique la modification
    const avant = await db.query(`SELECT prenom, email FROM users WHERE id = $1`, [req.userId]);
    let maj;
    if (type === 'mot_de_passe') {
      maj = await db.query(
        `UPDATE users SET mot_de_passe_hash = $1, updated_at = NOW()
         WHERE id = $2 RETURNING ${CHAMPS_UTILISATEUR}`,
        [ligne.nouvelle_valeur, req.userId]
      );
    } else {
      maj = await db.query(
        `UPDATE users SET email = $1, updated_at = NOW()
         WHERE id = $2 RETURNING ${CHAMPS_UTILISATEUR}`,
        [ligne.nouvelle_valeur, req.userId]
      );
    }
    await db.query(`DELETE FROM verification_codes WHERE id = $1`, [ligne.id]);

    if (avant.rows[0] && avant.rows[0].email) {
      notifierChangement({
        to: avant.rows[0].email,
        prenom: avant.rows[0].prenom,
        message: type === 'mot_de_passe'
          ? 'Ton mot de passe Fasoka vient d\'être modifié.'
          : 'Ton email de connexion Fasoka vient d\'être remplacé par ' + ligne.nouvelle_valeur + '.',
      });
    }

    res.json({
      message: type === 'mot_de_passe' ? 'Mot de passe modifié.' : 'Email de connexion modifié.',
      user: maj.rows[0],
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Cette adresse email est déjà utilisée par un autre compte.' });
    }
    next(err);
  }
}

module.exports = {
  initialiserTables, getMe, updateProfile, uploadAvatar, deleteAvatar, demanderCode, confirmerCode,
};
