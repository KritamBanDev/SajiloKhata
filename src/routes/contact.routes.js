'use strict';

const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { createInquiry } = require('../controllers/contact.controller');

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many contact requests. Please try again shortly.' },
});

router.post('/', contactLimiter, createInquiry);

module.exports = router;
