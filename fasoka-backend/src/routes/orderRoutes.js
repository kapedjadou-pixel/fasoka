const express = require('express');
const router = express.Router();
const { requireAuth, requireShopAccess, requireOrderShopAccess } = require('../middleware/auth');
const {
  createOrder, myOrders, shopOrders, updateOrderStatus,
} = require('../controllers/orderController');

router.post('/', requireAuth, createOrder);
router.get('/mine', requireAuth, myOrders);
router.get('/shop/:shopId', requireAuth, requireShopAccess, shopOrders);
// Seule une personne de l'équipe de la boutique concernée peut faire avancer la commande
router.patch('/:orderId/statut', requireAuth, requireOrderShopAccess, updateOrderStatus);

module.exports = router;
