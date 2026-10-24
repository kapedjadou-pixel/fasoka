// Envoi d'emails par API web (HTTPS). On n'utilise PAS le protocole SMTP car Railway
// le bloque sur les plans Free / Trial / Hobby.
//
// Fournisseurs gratuits pris en charge (un seul suffit) :
//
//   Brevo    BREVO_API_KEY
//   Mailjet  MAILJET_API_KEY + MAILJET_SECRET_KEY
//   Resend   RESEND_API_KEY   (nécessite un nom de domaine vérifié pour écrire à d'autres personnes)
//
// Variables communes :
//   EMAIL_FROM       adresse d'expéditeur validée chez le fournisseur
//   EMAIL_FROM_NAME  nom affiché (par défaut : Fasoka)
//   EMAIL_PROVIDER   (facultatif) 'brevo', 'mailjet' ou 'resend'. Sinon le premier fournisseur configuré est utilisé.
//
// Si aucun fournisseur n'est configuré, on passe en MODE SIMULATION : l'email n'est pas envoyé,
// son contenu (donc le code de confirmation) s'affiche dans les logs du serveur.

async function requete(nomFournisseur, url, entetes, corps) {
  const reponse = await fetch(url, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', ...entetes },
    body: JSON.stringify(corps),
    signal: AbortSignal.timeout(10000),
  });
  if (!reponse.ok) {
    const detail = await reponse.text();
    throw new Error('Envoi email échoué via ' + nomFournisseur + ' (' + reponse.status + ') : ' + detail);
  }
}

const FOURNISSEURS = {
  brevo: {
    configure: () => Boolean(process.env.BREVO_API_KEY),
    envoyer: ({ to, subject, html, text, expediteur, nom }) =>
      requete('Brevo', 'https://api.brevo.com/v3/smtp/email', { 'api-key': process.env.BREVO_API_KEY }, {
        sender: { name: nom, email: expediteur },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
  },

  mailjet: {
    configure: () => Boolean(process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY),
    envoyer: ({ to, subject, html, text, expediteur, nom }) => {
      const identifiants = Buffer.from(
        process.env.MAILJET_API_KEY + ':' + process.env.MAILJET_SECRET_KEY
      ).toString('base64');
      return requete('Mailjet', 'https://api.mailjet.com/v3.1/send', { Authorization: 'Basic ' + identifiants }, {
        Messages: [{
          From: { Email: expediteur, Name: nom },
          To: [{ Email: to }],
          Subject: subject,
          TextPart: text,
          HTMLPart: html,
        }],
      });
    },
  },

  resend: {
    configure: () => Boolean(process.env.RESEND_API_KEY),
    envoyer: ({ to, subject, html, text, expediteur, nom }) =>
      requete('Resend', 'https://api.resend.com/emails', { Authorization: 'Bearer ' + process.env.RESEND_API_KEY }, {
        from: nom + ' <' + expediteur + '>',
        to: [to],
        subject,
        html,
        text,
      }),
  },
};

// Détermine le fournisseur à utiliser (null = aucun configuré → mode simulation)
function fournisseurActif() {
  if (!process.env.EMAIL_FROM) return null;
  const demande = (process.env.EMAIL_PROVIDER || '').toLowerCase();
  if (demande) {
    return FOURNISSEURS[demande] && FOURNISSEURS[demande].configure() ? demande : null;
  }
  return Object.keys(FOURNISSEURS).find((nom) => FOURNISSEURS[nom].configure()) || null;
}

function emailConfigure() {
  return fournisseurActif() !== null;
}

async function envoyerEmail({ to, subject, html, text }) {
  const fournisseur = fournisseurActif();
  if (!fournisseur) {
    console.log('[EMAIL SIMULÉ] Destinataire : ' + to + ' | Objet : ' + subject + '\n' + text);
    return { simule: true };
  }
  await FOURNISSEURS[fournisseur].envoyer({
    to, subject, html, text,
    expediteur: process.env.EMAIL_FROM,
    nom: process.env.EMAIL_FROM_NAME || 'Fasoka',
  });
  return { simule: false, fournisseur };
}

module.exports = { envoyerEmail, emailConfigure };
