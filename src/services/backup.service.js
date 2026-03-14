'use strict';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const runBackupNow = () => {
  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '3306';
  const dbUser = process.env.DB_USER;
  const dbPass = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME;

  if (!dbUser || !dbName) {
    return;
  }

  const backupsDir = path.join(__dirname, '../../backups');
  fs.mkdirSync(backupsDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(backupsDir, `sajilokhata-${stamp}.sql`);

  const cmd = `"${process.env.MYSQLDUMP_PATH || 'mysqldump'}" ` +
    `--single-transaction --skip-lock-tables --no-tablespaces --quick ` +
    `-h ${dbHost} -P ${dbPort} -u ${dbUser} -p${dbPass} ${dbName} > "${file}"`;

  exec(cmd, { windowsHide: true }, (err) => {
    if (err) {
      // Keep non-fatal to preserve app availability.
      console.error('[BACKUP] Failed:', err.message);
      return;
    }
    console.log(`[BACKUP] Created: ${file}`);
  });
};

const startDailyBackupJob = () => {
  if ((process.env.ENABLE_DAILY_BACKUP || 'true') !== 'true') return;

  const hours = Number(process.env.BACKUP_INTERVAL_HOURS || 24);
  const intervalMs = Math.max(1, hours) * 60 * 60 * 1000;

  setTimeout(runBackupNow, 15 * 1000);
  setInterval(runBackupNow, intervalMs);
};

module.exports = { startDailyBackupJob, runBackupNow };
