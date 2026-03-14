'use strict';
const router = require('express').Router();
const { verifyToken, requireAdmin, requireAnyRole } = require('../middleware/auth.middleware');
const t = require('../controllers/transaction.controller');

router.use(verifyToken);
router.get('/',            requireAnyRole('Admin', 'Staff'), t.getAllTransactions);
router.get('/:id/invoice', requireAnyRole('Admin', 'Staff'), t.downloadInvoice);
router.get('/:id',         requireAnyRole('Admin', 'Staff'), t.getTransactionById);
router.post('/',           requireAnyRole('Admin', 'Staff'), t.createTransaction);
router.put('/:id/meta',    requireAdmin, t.updateTransactionMeta);
router.delete('/:id',      requireAdmin, t.deleteTransaction);

module.exports = router;
