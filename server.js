'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { validateEnv } = require('./src/config/env');
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const path         = require('path');
const rateLimit    = require('express-rate-limit');
const { startDailyBackupJob } = require('./src/services/backup.service');
const { requestContext } = require('./src/middleware/requestContext.middleware');
const { apiResponse } = require('./src/middleware/apiResponse.middleware');

// Route imports
const authRoutes        = require('./src/routes/auth.routes');
const productRoutes     = require('./src/routes/product.routes');
const customerRoutes    = require('./src/routes/customer.routes');
const supplierRoutes    = require('./src/routes/supplier.routes');
const transactionRoutes = require('./src/routes/transaction.routes');
const expenseRoutes     = require('./src/routes/expense.routes');
const bakiRoutes        = require('./src/routes/baki.routes');
const reportRoutes      = require('./src/routes/report.routes');
const contactRoutes     = require('./src/routes/contact.routes');
const healthRoutes      = require('./src/routes/health.routes');

// Error handler
const { errorHandler } = require('./src/middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 5000;
const isVercel = ['1', 'true', 'TRUE'].includes(String(process.env.VERCEL || ''));

validateEnv();

// Ensure real client IP is respected when running behind reverse proxies (Vercel, CDN, LB).
app.set('trust proxy', 1);

// ── Security Middleware ──────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,   // set manually below
}));

// Set CSP header manually — allows onclick/onsubmit inline handlers
app.use((_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "script-src-attr 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "object-src 'none'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
    ].join('; ')
  );
  next();
});

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests and non-browser clients.
    if (!origin) return callback(null, true);

    // If no explicit allowlist is configured, permit all origins.
    // This avoids accidental production lockout from localhost-only defaults.
    if (allowedOrigins.length === 0) return callback(null, true);

    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS origin is not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
}));

// Global rate limiter (200 req / 15 min per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests, slow down.' },
});

// ── Body Parsing ─────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

// ── Request Context + Response Helpers ───────────────────────────
app.use(requestContext);
app.use(apiResponse);

app.use((req, res, next) => {
  res.on('finish', () => {
    const elapsedMs = Date.now() - (req.requestStartedAt || Date.now());
    console.log(`[REQ] ${req.method} ${req.originalUrl} ${res.statusCode} ${elapsedMs}ms id=${req.requestId}`);
  });
  next();
});

// ── Static Frontend ───────────────────────────────────────────────
// index:false so that '/' is NOT auto-served as public/index.html —
// we control the root route explicitly below.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ── API Routes ────────────────────────────────────────────────────
app.use('/api', globalLimiter);

app.use('/api/auth',         authRoutes);
app.use('/api/products',     productRoutes);
app.use('/api/customers',    customerRoutes);
app.use('/api/suppliers',    supplierRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/expenses',     expenseRoutes);
app.use('/api/baki',         bakiRoutes);
app.use('/api/reports',      reportRoutes);
app.use('/api/contact',      contactRoutes);
app.use('/api/health',       healthRoutes);

// Unknown API routes should return JSON, not SPA HTML
app.use('/api/{*path}', (_req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found.',
    meta: {
      request_id: _req.requestId,
      timestamp: new Date().toISOString(),
    },
  });
});

// ── Page Routes ─────────────────────────────────────────────────────
// Root '/' shows the public marketing homepage.
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'site', 'index.html'));
});

// '/login' and '/app' are canonical entry points for the auth/dashboard SPA.
app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/app', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── SPA Fallback ──────────────────────────────────────────────────
// Catch all remaining non-API paths (hash-router deep links, /index.html, etc.)
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Centralised Error Handler ─────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[SERVER] SajiloKhata running on http://localhost:${PORT}`);

    // Skip local filesystem backups on serverless runtimes.
    if (!isVercel) {
      startDailyBackupJob();
    }
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED_REJECTION]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[UNCAUGHT_EXCEPTION]', error);
});

module.exports = app;
