const express = require('express');
const router = express.Router();
const { requireAuth, requireShopAccess } = require('../middleware/auth');
const { dashboard } = require('../controllers/dashboardController');
const {
  createShop, myShops, getShop, updateShop, followShop, shopStats,
} = require('../controllers/shopController');

router.post('/', requireAuth, createShop);
router.get('/mine', requireAuth, myShops);
router.get('/:shopId', getShop);
router.patch('/:shopId', requireAuth, requireShopAccess, updateShop);
router.post('/:shopId/follow', requireAuth, followShop);
router.get('/:shopId/stats', requireAuth, requireShopAccess, shopStats);
// Tableau de bord par période (équipe de la boutique uniquement)
router.get('/:shopId/dashboard', requireAuth, requireShopAccess, dashboard);

module.exports = router;
