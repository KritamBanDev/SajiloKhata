'use strict';
const router = require('express').Router();
const { verifyToken } = require('../middleware/auth.middleware');
const b = require('../controllers/baki.controller');

router.use(verifyToken);
router.get('/summary', b.getSummary);
router.get('/',        b.getAll);
router.patch('/:id',   b.updateStatus);

module.exports = router;
