const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth, requireShopAccess } = require('../middleware/auth');
const { recevoirFichier } = require('../middleware/uploadMessagerie');
const {
  toucherPresence, ouvrirConversation, listerConversationsClient, listerConversationsBoutique,
  listerMessages, envoyerMessage, envoyerPieceJointe, signalerEcriture, nonLus,
} = require('../controllers/messagerieController');

const router = express.Router();

// La messagerie s'actualise toutes les quelques secondes : elle a ses propres limites, comptées par personne
// connectée (et non par adresse IP, partagée par beaucoup de téléphones sur un même réseau mobile).
const limiteLecture = rateLimit({
  windowMs: 60 * 1000,
  max: 150,
  keyGenerator: (req) => String(req.userId),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Patiente un instant.' },
});
const limiteEnvoi = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => String(req.userId),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Tu envoies trop de messages à la suite. Patiente un instant.' },
});
const limiteFichiers = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => String(req.userId),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Tu envoies trop de fichiers à la suite. Patiente un instant.' },
});

// Toute requête de messagerie compte comme une présence (« en ligne »)
router.use(requireAuth, toucherPresence, limiteLecture);

router.get('/non-lus', nonLus);
router.get('/conversations', listerConversationsClient);
router.post('/conversations', ouvrirConversation);
router.get('/conversations/:conversationId/messages', listerMessages);
router.post('/conversations/:conversationId/messages', limiteEnvoi, envoyerMessage);
router.post('/conversations/:conversationId/pieces-jointes', limiteFichiers, recevoirFichier, envoyerPieceJointe);
router.post('/conversations/:conversationId/ecriture', signalerEcriture);
router.get('/boutiques/:shopId/conversations', requireShopAccess, listerConversationsBoutique);

module.exports = router;
