'use strict';

const router = require('express').Router();
const { verifyToken, requireAdmin, requireAnyRole } = require('../middleware/auth.middleware');
const {
  getAllProducts, getProductById, createProduct, updateProduct, deleteProduct, getLowStockProducts,
} = require('../controllers/product.controller');

router.use(verifyToken);

router.get('/',     requireAnyRole('Admin', 'Staff'), getAllProducts);
router.get('/low-stock', requireAnyRole('Admin', 'Staff'), getLowStockProducts);
router.get('/:id',  requireAnyRole('Admin', 'Staff'), getProductById);
router.post('/',    requireAdmin, createProduct);
router.put('/:id',  requireAdmin, updateProduct);
router.delete('/:id', requireAdmin, deleteProduct);

module.exports = router;
