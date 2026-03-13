'use strict';
const router = require('express').Router();
const { verifyToken } = require('../middleware/auth.middleware');
const e = require('../controllers/expense.controller');

router.use(verifyToken);
router.get('/',       e.getAll);
router.post('/',      e.create);
router.delete('/:id', e.remove);

module.exports = router;
