'use strict';

const router = require('express').Router();
const { verifyToken, requireAnyRole } = require('../middleware/auth.middleware');
const { getHealth } = require('../controllers/health.controller');

router.get('/', verifyToken, requireAnyRole('Admin', 'Staff'), getHealth);

module.exports = router;
