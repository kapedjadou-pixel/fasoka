const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getMe, updateProfile, uploadAvatar, deleteAvatar, demanderCode, confirmerCode,
} = require('../controllers/accountController');

// Profil
router.get('/me', requireAuth, getMe);
router.patch('/profile', requireAuth, updateProfile);

// Photo de profil (champ multipart attendu : "image")
router.post('/avatar', requireAuth, upload.single('image'), uploadAvatar);
router.delete('/avatar', requireAuth, deleteAvatar);

// Sécurité : changement de mot de passe / d'email avec code envoyé à l'email actuel
router.post('/security/request', requireAuth, demanderCode);
router.post('/security/confirm', requireAuth, confirmerCode);

module.exports = router;
