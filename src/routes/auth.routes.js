'use strict';

const router    = require('express').Router();
const rateLimit = require('express-rate-limit');
const { signup, login } = require('../controllers/auth.controller');

// Stricter rate limit for auth endpoints (10 req / 15 min per IP)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many auth attempts. Try again later.' },
});

router.post('/signup', authLimiter, signup);
router.post('/login',  authLimiter, login);

module.exports = router;
