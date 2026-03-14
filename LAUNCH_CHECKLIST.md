# SajiloKhata Launch Checklist

## 1. Security Gate
- [ ] `.env` has all required variables: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET.
- [ ] Auth rate limiting works on `/api/auth/login` and `/api/auth/signup`.
- [ ] Role restrictions verified for Admin and Staff on all protected routes.
- [ ] API responses include `X-Request-Id` header.
- [ ] Error payloads include `meta.request_id` and `meta.timestamp`.

## 2. Data and Migration Gate
- [ ] Latest migration scripts applied in staging and production.
- [ ] `Transaction_Items`, `Roles`, `Audit_Logs` tables exist and are queryable.
- [ ] Backup command runs successfully and creates `.sql` file.
- [ ] Backup restore test performed once on a staging copy.

## 3. API and Contract Gate
- [ ] Core endpoints return consistent shape: `success`, `message`, `data`, `meta`.
- [ ] List endpoints tested with pagination/filter parameters.
- [ ] 401/403/404/500 responses verified for contract consistency.
- [ ] `/api/health` returns 401 without token and 200 with valid token.

## 4. Frontend Quality Gate
- [ ] Login/signup flow works with updated response shape.
- [ ] Dashboard loads health badge and updates every 30s.
- [ ] Hash routing works: refresh, deep-link, back/forward.
- [ ] Staff view hides Admin-only sections and actions.
- [ ] No browser-native alert/confirm/prompt dialogs remain.

## 5. Business Flow Gate
- [ ] Create product/customer/supplier works.
- [ ] Create Sale and Purchase transactions works.
- [ ] Stock updates and rollback on transaction delete works.
- [ ] Baki status update flow works.
- [ ] Reports render with generated data.

## 6. Pre-release Commands
- [ ] `node --check server.js`
- [ ] `node --check public/js/app.js`
- [ ] `node --check src/controllers/*.js` (run for changed controllers)

## 7. Go-Live Decision
- [ ] All critical checks green.
- [ ] Rollback plan ready.
- [ ] Team sign-off complete.
