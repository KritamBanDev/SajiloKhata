'use strict';
const router = require('express').Router();
const { verifyToken } = require('../middleware/auth.middleware');
const s = require('../controllers/supplier.controller');

router.use(verifyToken);
router.get('/',       s.getAll);
router.get('/:id',    s.getById);
router.post('/',      s.create);
router.put('/:id',    s.update);
router.delete('/:id', s.remove);

module.exports = router;
