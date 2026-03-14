'use strict';
const router = require('express').Router();
const { verifyToken, requireAdmin, requireAnyRole } = require('../middleware/auth.middleware');
const s = require('../controllers/supplier.controller');

router.use(verifyToken);
router.get('/',       requireAnyRole('Admin', 'Staff'), s.getAll);
router.get('/:id',    requireAnyRole('Admin', 'Staff'), s.getById);
router.post('/',      requireAdmin, s.create);
router.put('/:id',    requireAdmin, s.update);
router.delete('/:id', requireAdmin, s.remove);

module.exports = router;
