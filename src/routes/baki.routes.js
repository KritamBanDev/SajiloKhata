'use strict';
const router = require('express').Router();
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const b = require('../controllers/baki.controller');

router.use(verifyToken);
router.get('/summary',       requireAdmin, b.getSummary);
router.get('/risk-profile',  requireAdmin, b.getRiskProfile);
router.get('/reminder/:id',  requireAdmin, b.getReminderLink);
router.get('/',              requireAdmin, b.getAll);
router.patch('/:id',         requireAdmin, b.updateStatus);

module.exports = router;
