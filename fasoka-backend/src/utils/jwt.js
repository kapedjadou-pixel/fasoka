const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRETS_INTERDITS = ['change_this_to_a_long_random_string', 'secret', 'changeme'];

// Appelée au démarrage du serveur : mieux vaut refuser de démarrer que signer des tokens
// avec un secret absent, trop court ou resté à la valeur d'exemple de .env.example.
function verifierConfigurationJwt() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET est absent : renseigne-le dans .env (chaîne aléatoire de 32 caractères minimum).');
  }
  if (secret.length < 32 || SECRETS_INTERDITS.includes(secret)) {
    throw new Error('JWT_SECRET est trop court ou égal à la valeur d\'exemple : utilise une chaîne aléatoire de 32 caractères minimum.');
  }
}

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function verifyToken(token) {
  // L'algorithme est imposé pour refuser tout token signé autrement
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
}

module.exports = { generateToken, verifyToken, verifierConfigurationJwt };
