'use strict';
const router = require('express').Router();
const { verifyToken, requireAdmin } = require('../middleware/auth.middleware');
const e = require('../controllers/expense.controller');

router.use(verifyToken);
router.get('/',       requireAdmin, e.getAll);
router.post('/',      requireAdmin, e.create);
router.delete('/:id', requireAdmin, e.remove);

module.exports = router;
