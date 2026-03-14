'use strict';

const db = require('../config/db');

const getHealth = async (_req, res, next) => {
  try {
    const startedAt = process.uptime();
    const [[dbPing]] = await db.query('SELECT 1 AS ok');

    res.apiSuccess({
      message: 'System health retrieved.',
      data: {
        status: 'healthy',
        uptime_seconds: Math.floor(startedAt),
        database: dbPing?.ok === 1 ? 'connected' : 'degraded',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getHealth };
