const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/database');
const { envoyerEmail, emailConfigure } = require('../services/emailService');

// « Mot de passe oublié » : on envoie un code à 6 chiffres par email, puis on applique le nouveau mot de passe.
// Le code est stocké haché dans la table verification_codes (type « reinitialisation »), comme les autres codes.

const TYPE = 'reinitialisation';
const DUREE_CODE_MINUTES = 10;
const MAX_TENTATIVES = 5;
const DELAI_RENVOI_SECONDES = 60;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Même réponse que le compte existe ou non : on ne révèle pas quelles adresses sont inscrites
const MESSAGE_GENERIQUE = "Si un compte existe avec cette adresse, un code de réinitialisation vient d'être envoyé.";
const MESSAGE_CODE_INVALIDE = 'Code invalide ou expiré. Vérifie le code ou demande-en un nouveau.';

// Hash factice : on dépense le même temps de calcul quand l'adresse ou le code n'existe pas
const HASH_FACTICE = bcrypt.hashSync('code-factice', 10);

function echapperHtml(texte) {
  const remplacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(texte).replace(/[&<>"']/g, (c) => remplacements[c]);
}

function construireEmailCode({ prenom, code }) {
  const text =
    `Bonjour ${prenom || ''},\n\n` +
    `Tu as demandé à réinitialiser ton mot de passe Fasoka.\n` +
    `Ton code est : ${code}\n\n` +
    `Il est valable ${DUREE_CODE_MINUTES} minutes. Si ce n'est pas toi, ignore ce message : ton mot de passe ne sera pas modifié.\n`;

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#F5F3EE;padding:24px;">
    <div style="background:#0A0A0A;color:#FFC61E;font-weight:900;font-size:22px;letter-spacing:2px;text-align:center;padding:16px;border-radius:12px 12px 0 0;">FASOKA</div>
    <div style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 12px;">Bonjour ${echapperHtml(prenom || '')},</p>
      <p style="margin:0 0 16px;">Tu as demandé à réinitialiser ton mot de passe. Voici ton code :</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;background:#F5F3EE;border-radius:8px;padding:16px;margin-bottom:16px;">${code}</div>
      <p style="margin:0;font-size:13px;color:#8A8A8A;">Ce code est valable ${DUREE_CODE_MINUTES} minutes. Si ce n'est pas toi, ignore ce message : ton mot de passe ne sera pas modifié.</p>
    </div>
  </div>`;

  return { text, html };
}

// POST /api/auth/forgot-password
// body: { email }  → envoie un code si un compte existe avec cette adresse
async function forgotPassword(req, res, next) {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Saisis une adresse email valide.' });
    }

    // Sans service d'envoi d'emails, on le dit franchement (sauf en simulation : le code s'affiche alors dans les logs)
    if (!emailConfigure() && process.env.EMAIL_SIMULATION !== 'true') {
      return res.status(503).json({
        error: "L'envoi des codes par email n'est pas encore activé. Cette fonction sera disponible prochainement.",
      });
    }

    const trouve = await db.query(`SELECT id, prenom, email FROM users WHERE LOWER(email) = $1`, [email]);
    const utilisateur = trouve.rows[0];

    if (!utilisateur) {
      await bcrypt.hash(String(crypto.randomInt(100000, 1000000)), 10);
      return res.json({ message: MESSAGE_GENERIQUE });
    }

    // Anti-spam : un seul code par minute et par compte (le code déjà envoyé reste valable)
    const recent = await db.query(
      `SELECT 1 FROM verification_codes
       WHERE user_id = $1 AND type = $2 AND created_at > NOW() - INTERVAL '${DELAI_RENVOI_SECONDES} seconds'`,
      [utilisateur.id, TYPE]
    );
    if (recent.rows.length > 0) {
      return res.json({ message: MESSAGE_GENERIQUE });
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = await bcrypt.hash(code, 10);

    await db.query(`DELETE FROM verification_codes WHERE user_id = $1 AND type = $2`, [utilisateur.id, TYPE]);
    await db.query(
      `INSERT INTO verification_codes (user_id, type, code_hash, nouvelle_valeur, expire_le)
       VALUES ($1, $2, $3, '', NOW() + INTERVAL '${DUREE_CODE_MINUTES} minutes')`,
      [utilisateur.id, TYPE, codeHash]
    );

    // L'email part en arrière-plan : la réponse arrive aussi vite que pour une adresse inconnue
    const contenu = construireEmailCode({ prenom: utilisateur.prenom, code });
    envoyerEmail({
      to: utilisateur.email,
      subject: 'Fasoka — réinitialisation de ton mot de passe',
      text: contenu.text,
      html: contenu.html,
    }).catch((e) => console.error('Email de réinitialisation non envoyé :', e.message));

    res.json({ message: MESSAGE_GENERIQUE });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/reset-password
// body: { email, code, nouveau_mot_de_passe }  → applique le nouveau mot de passe si le code est bon
async function resetPassword(req, res, next) {
  try {
    const { email, code, nouveau_mot_de_passe } = req.body;
    const adresse = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!EMAIL_REGEX.test(adresse) || typeof code !== 'string' || !code.trim() || typeof nouveau_mot_de_passe !== 'string') {
      return res.status(400).json({ error: 'Email, code et nouveau mot de passe sont obligatoires.' });
    }
    if (nouveau_mot_de_passe.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }
    // bcrypt ignore silencieusement tout ce qui dépasse 72 octets
    if (Buffer.byteLength(nouveau_mot_de_passe, 'utf8') > 72) {
      return res.status(400).json({ error: 'Le mot de passe est trop long (72 caractères maximum).' });
    }

    const trouve = await db.query(
      `SELECT u.id, u.prenom, u.email, c.id AS code_id, c.code_hash, c.tentatives
       FROM users u
       JOIN verification_codes c ON c.user_id = u.id AND c.type = $2 AND c.expire_le > NOW()
       WHERE LOWER(u.email) = $1`,
      [adresse, TYPE]
    );
    const ligne = trouve.rows[0];

    if (!ligne) {
      await bcrypt.compare(code.trim(), HASH_FACTICE);
      return res.status(400).json({ error: MESSAGE_CODE_INVALIDE });
    }

    if (ligne.tentatives >= MAX_TENTATIVES) {
      await db.query(`DELETE FROM verification_codes WHERE id = $1`, [ligne.code_id]);
      return res.status(400).json({ error: MESSAGE_CODE_INVALIDE });
    }

    const valide = await bcrypt.compare(code.trim(), ligne.code_hash);
    if (!valide) {
      // Même message qu'un code inexistant : on ne révèle pas si un code est en attente pour cette adresse
      await db.query(`UPDATE verification_codes SET tentatives = tentatives + 1 WHERE id = $1`, [ligne.code_id]);
      return res.status(400).json({ error: MESSAGE_CODE_INVALIDE });
    }

    const nouveauHash = await bcrypt.hash(nouveau_mot_de_passe, 10);
    await db.query(`UPDATE users SET mot_de_passe_hash = $1, updated_at = NOW() WHERE id = $2`, [nouveauHash, ligne.id]);
    // On supprime tous les codes en attente de ce compte (y compris une éventuelle demande de changement en cours)
    await db.query(`DELETE FROM verification_codes WHERE user_id = $1`, [ligne.id]);

    // Prévient le propriétaire du compte (échec silencieux)
    const texte =
      `Bonjour ${ligne.prenom || ''},\n\nTon mot de passe Fasoka vient d'être modifié.\n` +
      `Si ce n'est pas toi, contacte-nous au plus vite.\n`;
    const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <p>Bonjour ${echapperHtml(ligne.prenom || '')},</p>
      <p>Ton mot de passe Fasoka vient d'être modifié.</p>
      <p style="color:#8A8A8A;font-size:13px;">Si ce n'est pas toi, contacte-nous au plus vite.</p>
    </div>`;
    envoyerEmail({ to: ligne.email, subject: 'Fasoka — mot de passe modifié', text: texte, html }).catch((e) =>
      console.error('Notification de changement non envoyée :', e.message)
    );

    res.json({ message: 'Mot de passe modifié. Tu peux maintenant te connecter.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { forgotPassword, resetPassword };
