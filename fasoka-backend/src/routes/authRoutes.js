const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { signup, confirmAccount, resendCode, login } = require('../controllers/authController');
const { forgotPassword, resetPassword } = require('../controllers/passwordResetController');
const { loginGoogle } = require('../controllers/googleController');

router.post('/signup', signup);
// Confirmation et renvoi : il faut être connecté (le token donne l'identité du compte à confirmer)
router.post('/confirm', requireAuth, confirmAccount);
router.post('/resend-code', requireAuth, resendCode);
router.post('/login', login);
// Connexion / inscription avec Google
router.post('/google', loginGoogle);
// Mot de passe oublié : pas besoin d'être connecté
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
