const db = require('../config/database');
const { envoyerEmail, emailConfigure } = require('./emailService');

// Email envoyé au client quand sa commande change de statut.
// Seuls les statuts importants sont notifiés (pas « en préparation », pour ne pas multiplier les messages), et seulement
// si le client a une adresse email. Un échec d'envoi n'a jamais d'effet sur la commande.

const SITE = process.env.SITE_URL || 'https://fasoka-web.onrender.com';

function echapperHtml(texte) {
  const remplacements = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(texte).replace(/[&<>"']/g, (c) => remplacements[c]);
}

// Texte de la phrase principale selon le statut et le mode de réception
function phrase(statut, { numero, boutique, modeLivraison }) {
  switch (statut) {
    case 'confirmee':
      return `Votre commande n° ${numero} chez ${boutique} a été confirmée. La boutique va la préparer.`;
    case 'prete':
      return modeLivraison === 'livraison_vendeur'
        ? `Votre commande n° ${numero} chez ${boutique} est prête : elle va vous être livrée.`
        : `Votre commande n° ${numero} chez ${boutique} est prête : vous pouvez venir la retirer en boutique.`;
    case 'livree':
      return `Votre commande n° ${numero} chez ${boutique} a été livrée. Merci pour votre achat !`;
    case 'annulee':
      return `Votre commande n° ${numero} chez ${boutique} a été annulée par la boutique. Les articles ont été remis en stock. Vous pouvez écrire à la boutique depuis l'application pour en savoir plus.`;
    default:
      return null;
  }
}

const SUJETS = {
  confirmee: 'Commande confirmée',
  prete: 'Commande prête',
  livree: 'Commande livrée',
  annulee: 'Commande annulée',
};

function construireEmail(statut, infos) {
  const message = phrase(statut, infos);
  const text = `Bonjour ${infos.prenom || ''},\n\n${message}\n\nSuivez vos commandes sur ${SITE}\n`;
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#F5F3EE;padding:24px;">
    <div style="background:#0A0A0A;color:#FFC61E;font-weight:900;font-size:22px;letter-spacing:2px;text-align:center;padding:16px;border-radius:12px 12px 0 0;">FASOKA</div>
    <div style="background:#ffffff;padding:24px;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 12px;">Bonjour ${echapperHtml(infos.prenom || '')},</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:22px;">${echapperHtml(message)}</p>
      <p style="margin:0;font-size:13px;color:#8A8A8A;"><a href="${echapperHtml(SITE)}" style="color:#B8860A;">Suivre mes commandes sur FASOKA</a></p>
    </div>
  </div>`;
  return { text, html };
}

async function notifierChangementStatut(orderId, statut) {
  if (!SUJETS[statut]) return;
  if (!emailConfigure() && process.env.EMAIL_SIMULATION !== 'true') return;

  const result = await db.query(
    `SELECT o.id, o.mode_livraison, u.email, u.prenom, s.nom_boutique
     FROM orders o
     JOIN users u ON u.id = o.client_id
     JOIN shops s ON s.id = o.shop_id
     WHERE o.id = $1`,
    [orderId]
  );
  const commande = result.rows[0];
  if (!commande || !commande.email) return;

  const infos = {
    numero: String(commande.id).slice(0, 8).toUpperCase(),
    boutique: commande.nom_boutique,
    modeLivraison: commande.mode_livraison,
    prenom: commande.prenom,
  };
  const contenu = construireEmail(statut, infos);
  await envoyerEmail({
    to: commande.email,
    subject: `Fasoka — ${SUJETS[statut]} (n° ${infos.numero})`,
    text: contenu.text,
    html: contenu.html,
  });
}

module.exports = { notifierChangementStatut };
