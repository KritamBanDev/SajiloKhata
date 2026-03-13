'use strict';
const router = require('express').Router();
const { verifyToken } = require('../middleware/auth.middleware');
const t = require('../controllers/transaction.controller');

router.use(verifyToken);
router.get('/',    t.getAllTransactions);
router.get('/:id', t.getTransactionById);
router.post('/',   t.createTransaction);

module.exports = router;
