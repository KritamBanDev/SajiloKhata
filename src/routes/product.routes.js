'use strict';

const router = require('express').Router();
const { verifyToken } = require('../middleware/auth.middleware');
const {
  getAllProducts, getProductById, createProduct, updateProduct, deleteProduct,
} = require('../controllers/product.controller');

router.use(verifyToken);

router.get('/',     getAllProducts);
router.get('/:id',  getProductById);
router.post('/',    createProduct);
router.put('/:id',  updateProduct);
router.delete('/:id', deleteProduct);

module.exports = router;
