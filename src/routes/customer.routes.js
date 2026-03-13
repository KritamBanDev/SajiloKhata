'use strict';
const router = require('express').Router();
const { verifyToken } = require('../middleware/auth.middleware');
const c = require('../controllers/customer.controller');

router.use(verifyToken);
router.get('/',       c.getAll);
router.get('/:id',    c.getById);
router.post('/',      c.create);
router.put('/:id',    c.update);
router.delete('/:id', c.remove);

module.exports = router;
