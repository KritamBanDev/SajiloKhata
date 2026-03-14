'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const buildSslConfig = () => {
  if (String(process.env.DB_SSL || '').toLowerCase() !== 'true') return null;

  const rejectUnauthorized = String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false';
  const caPath = process.env.DB_SSL_CA_PATH;

  if (caPath) {
    try {
      return {
        rejectUnauthorized,
        ca: fs.readFileSync(path.resolve(caPath), 'utf8'),
      };
    } catch (error) {
      console.warn(`[DB] Failed to read DB_SSL_CA_PATH (${caPath}): ${error.message}`);
      console.warn('[DB] Falling back to TLS without custom CA file.');
    }
  }

  return { rejectUnauthorized };
};

const ssl = buildSslConfig();

const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  port:               parseInt(process.env.DB_PORT, 10) || 3306,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4',
  timezone:           '+00:00',
  ...(ssl ? { ssl } : {}),
});

// Validate connectivity at startup
pool.getConnection()
  .then(conn => {
    console.log('[DB] MySQL connection pool established.');
    conn.release();
  })
  .catch(err => {
    console.error('[DB] Failed to connect to MySQL:', err.message);
    process.exit(1);
  });

module.exports = pool;
