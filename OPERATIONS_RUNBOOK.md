# SajiloKhata Operations Runbook

## A. Start Service
1. Ensure `.env` is configured.
2. Run: `node server.js`.
3. Verify startup logs show:
- server running URL
- database connection established

## B. Health Verification
1. Without token:
- `GET /api/health` should return `401` JSON.
2. With valid token:
- `GET /api/health` should return `200` with `data.status = healthy`.
3. Check `X-Request-Id` header in responses.

## C. Backup Operations
1. Trigger backup job manually if needed via service helper.
2. Verify file appears under `backups/`.
3. If backup fails with permission errors, ensure mysqldump uses:
- `--single-transaction`
- `--skip-lock-tables`
- `--no-tablespaces`

## D. Common Incidents

### 1. API returns HTML for endpoint
- Cause: wrong route or server mismatch.
- Action: verify target server port and route registration.

### 2. Port 5000 already occupied
- Action: run temporary instance with alternate port:
- PowerShell: `$env:PORT='5051'; node server.js`

### 3. Login failing unexpectedly
- Verify JWT_SECRET and DB connectivity.
- Confirm user exists and role mapping is valid.

### 4. Missing request metadata
- Verify `requestContext` middleware is registered before routes.
- Verify auth/error middleware include response `meta`.

## E. Rollback Procedure
1. Stop current process.
2. Revert to previous stable app build.
3. Restore previous database snapshot if schema/data corruption occurred.
4. Re-run health checks and smoke tests before reopening traffic.

## F. Post-release Monitoring (first 24h)
1. Watch server logs for repeated 5xx errors.
2. Monitor backup job completion logs.
3. Monitor slow endpoints and DB failures.
4. Validate business-critical user flows every few hours.
