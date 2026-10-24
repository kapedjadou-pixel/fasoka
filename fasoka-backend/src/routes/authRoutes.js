const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { signup, confirmAccount, resendCode, login } = require('../controllers/authController');

router.post('/signup', signup);
// Confirmation et renvoi : il faut être connecté (le token donne l'identité du compte à confirmer)
router.post('/confirm', requireAuth, confirmAccount);
router.post('/resend-code', requireAuth, resendCode);
router.post('/login', login);

module.exports = router;
