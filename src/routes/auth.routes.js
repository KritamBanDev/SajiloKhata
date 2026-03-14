'use strict';

const router    = require('express').Router();
const rateLimit = require('express-rate-limit');
const { signup, login } = require('../controllers/auth.controller');

const isLocalAddress = (ip = '') => {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
};

// Auth limiter should block brute-force attempts without locking normal local/dev usage.
const authLimiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'production' ? 10 * 60 * 1000 : 60 * 1000,
  max:      process.env.NODE_ENV === 'production' ? 60 : 1000,
  standardHeaders: true,
  legacyHeaders:   false,
  skipSuccessfulRequests: true,
  skip: (req) => process.env.NODE_ENV !== 'production' || isLocalAddress(req.ip),
  handler: (req, res) => {
    const resetAt = req.rateLimit?.resetTime ? new Date(req.rateLimit.resetTime).getTime() : Date.now() + 60_000;
    const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

    res.status(429).json({
      success: false,
      message: 'Too many auth attempts. Please try again shortly.',
      meta: {
        retry_after_seconds: retryAfter,
      },
    });
  },
});

router.post('/signup', authLimiter, signup);
router.post('/login',  authLimiter, login);

module.exports = router;
