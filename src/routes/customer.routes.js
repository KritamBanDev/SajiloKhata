'use strict';
const router = require('express').Router();
const { verifyToken, requireAdmin, requireAnyRole } = require('../middleware/auth.middleware');
const c = require('../controllers/customer.controller');

router.use(verifyToken);
router.get('/',       requireAnyRole('Admin', 'Staff'), c.getAll);
router.get('/:id',    requireAnyRole('Admin', 'Staff'), c.getById);
router.post('/',      requireAdmin, c.create);
router.put('/:id',    requireAdmin, c.update);
router.delete('/:id', requireAdmin, c.remove);

module.exports = router;
