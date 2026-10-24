const express = require('express');
const router = express.Router();
const { requireAuth, requireShopAccess, requireProductShopAccess } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  createProduct, listShopProducts, getProduct, feed, updateProduct, stockAlerts, deleteProduct,
} = require('../controllers/productController');
const { uploadProductImage, deleteProductImage, reorderProductImages } = require('../controllers/imageController');

router.get('/feed', feed);
router.get('/shop/:shopId', listShopProducts);
router.post('/shop/:shopId', requireAuth, requireShopAccess, createProduct);
router.get('/shop/:shopId/alertes-stock', requireAuth, requireShopAccess, stockAlerts);
router.get('/:productId', getProduct);
// Modifier / désactiver un produit : réservé à l'équipe de la boutique qui le possède
router.patch('/:productId', requireAuth, requireProductShopAccess, updateProduct);
router.delete('/:productId', requireAuth, requireProductShopAccess, deleteProduct);

// Photos produit (champ multipart attendu : "image")
router.post('/:productId/images', requireAuth, upload.single('image'), uploadProductImage);
router.patch('/:productId/images/reorder', requireAuth, reorderProductImages);
router.delete('/:productId/images/:imageId', requireAuth, deleteProductImage);

module.exports = router;
