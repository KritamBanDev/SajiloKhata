'use strict';
const router = require('express').Router();
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const r = require('../controllers/report.controller');

router.use(verifyToken);
router.get('/sales',            requireAdmin, r.salesReport);
router.get('/inventory',        requireAdmin, r.inventoryReport);
router.get('/profit-loss',      requireAdmin, r.profitLossReport);
router.get('/cash-flow',        requireAdmin, r.cashFlowReport);
router.get('/ledger',           requireAdmin, r.ledgerReport);
router.get('/sales-trend',      requireAdmin, r.salesTrend7Day);
router.get('/stock-value-pie',  requireAdmin, r.stockValuePie);
router.get('/customer-risk',    requireAdmin, r.customerRiskProfile);

module.exports = router;
