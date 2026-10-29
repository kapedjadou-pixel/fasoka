const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { verifierConfigurationJwt } = require('./utils/jwt');
// Échec immédiat si JWT_SECRET est absent ou faible
verifierConfigurationJwt();

const authRoutes = require('./routes/authRoutes');
const shopRoutes = require('./routes/shopRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const accountRoutes = require('./routes/accountRoutes');
const messagerieRoutes = require('./routes/messagerieRoutes');
const { initialiserTables } = require('./controllers/accountController');
const { initialiserMessagerie } = require('./controllers/messagerieController');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Derrière le proxy de l'hébergeur (Railway, etc.), req.ip doit être l'IP du client et non celle
// du proxy, sinon la limitation de débit bloquerait tout le monde d'un coup.
// Désactiver avec TRUST_PROXY=0 si le serveur est exposé directement.
if (process.env.TRUST_PROXY !== '0') {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Limite générale par IP
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  // La messagerie (actualisation toutes les quelques secondes) a ses propres limites, par personne connectée
  skip: (req) => req.path.startsWith('/messagerie'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessaie dans quelques minutes.' },
}));

// Limites strictes sur l'authentification (force brute sur mot de passe et codes)
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion. Réessaie dans 15 minutes.' },
});
const limiteInscription = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop d\'inscriptions depuis cette connexion. Réessaie plus tard.' },
});
const limiteCodes = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de demandes de code. Réessaie dans quelques minutes.' },
});

app.use('/api/auth/login', limiteLogin);
app.use('/api/auth/signup', limiteInscription);
app.use('/api/auth/confirm', limiteCodes);
app.use('/api/auth/resend-code', limiteCodes);
app.use('/api/auth/forgot-password', limiteCodes);
app.use('/api/auth/reset-password', limiteCodes);
app.use('/api/account/security', limiteCodes);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/messagerie', messagerieRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'fasoka-backend' });
});

// Gestion des routes inconnues
app.use((req, res) => {
  res.status(404).json({ error: 'Route introuvable.' });
});

// Gestionnaire d'erreurs global (doit être en dernier)
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Fasoka backend démarré sur le port ${PORT}`);
  // Crée/met à jour les tables annexes (codes de confirmation) si nécessaire
  initialiserTables().catch((err) =>
    console.error('Initialisation des tables impossible :', err.message)
  );
  // Tables de la messagerie (conversations et messages)
  initialiserMessagerie().catch((err) =>
    console.error('Initialisation de la messagerie impossible :', err.message)
  );
});

module.exports = app;
