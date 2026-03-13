'use strict';
const router = require('express').Router();
const { verifyToken } = require('../middleware/auth.middleware');
const r = require('../controllers/report.controller');

router.use(verifyToken);
router.get('/sales',        r.salesReport);
router.get('/inventory',    r.inventoryReport);
router.get('/profit-loss',  r.profitLossReport);
router.get('/cash-flow',    r.cashFlowReport);
router.get('/ledger',       r.ledgerReport);

module.exports = router;
