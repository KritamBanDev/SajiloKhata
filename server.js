'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const path         = require('path');
const rateLimit    = require('express-rate-limit');

// Route imports
const authRoutes        = require('./src/routes/auth.routes');
const productRoutes     = require('./src/routes/product.routes');
const customerRoutes    = require('./src/routes/customer.routes');
const supplierRoutes    = require('./src/routes/supplier.routes');
const transactionRoutes = require('./src/routes/transaction.routes');
const expenseRoutes     = require('./src/routes/expense.routes');
const bakiRoutes        = require('./src/routes/baki.routes');
const reportRoutes      = require('./src/routes/report.routes');

// Error handler
const { errorHandler } = require('./src/middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security Middleware ──────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:'],
    },
  },
}));

app.use(cors({
  origin:      process.env.CORS_ORIGIN || 'http://localhost:5000',
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));

// Global rate limiter (200 req / 15 min per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests, slow down.' },
});
app.use(globalLimiter);

// ── Body Parsing ─────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

// ── Static Frontend ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/products',     productRoutes);
app.use('/api/customers',    customerRoutes);
app.use('/api/suppliers',    supplierRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/expenses',     expenseRoutes);
app.use('/api/baki',         bakiRoutes);
app.use('/api/reports',      reportRoutes);

// ── SPA Fallback ──────────────────────────────────────────────────
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Centralised Error Handler ─────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[SERVER] SajiloKhata running on http://localhost:${PORT}`);
});

module.exports = app;
