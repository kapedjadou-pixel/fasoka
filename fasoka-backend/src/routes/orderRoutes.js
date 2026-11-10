const express = require('express');
const router = express.Router();
const { requireAuth, requireShopAccess, requireOrderShopAccess } = require('../middleware/auth');
const {
  createOrder, myOrders, miseAJourCommandes, shopOrders, getOrder, updateOrderStatus,
} = require('../controllers/orderController');

router.post('/', requireAuth, createOrder);
router.get('/mine', requireAuth, myOrders);
router.get('/mine/mises-a-jour', requireAuth, miseAJourCommandes);
router.get('/shop/:shopId', requireAuth, requireShopAccess, shopOrders);
// Détail d'une commande (le client qui l'a passée ou l'équipe de la boutique : vérifié dans le contrôleur)
router.get('/:orderId', requireAuth, getOrder);
// Seule une personne de l'équipe de la boutique concernée peut faire avancer la commande
router.patch('/:orderId/statut', requireAuth, requireOrderShopAccess, updateOrderStatus);

module.exports = router;
