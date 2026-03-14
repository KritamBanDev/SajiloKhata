# SajiloKhata

SajiloKhata is a full-stack business management web app for shops and SMEs. It helps teams manage inventory, customers, suppliers, transactions, baki ledger, expenses, and reports from one dashboard.

This README is written for all levels of developers, including beginners.

## What You Get

- Product and stock management
- Customer and supplier management
- Sales and purchase transactions with item-level lines
- Baki ledger tracking (customer debit and supplier credit)
- Expense tracking
- Reports (sales, cash flow, inventory, profit/loss)
- Role-based auth (Admin and Staff)
- PDF invoice generation

## Tech Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js + Express (MVC structure)
- Database: MySQL
- Deployment target: Vercel (app) + managed MySQL (database)

## Project Structure

```text
sajilokhata_project/
  public/                  # Frontend assets and SPA files
  src/
    config/                # DB + env configuration
    controllers/           # Business logic
    middleware/            # Auth, error, request helpers
    routes/                # API route definitions
    services/              # Backup + PDF service
  migrations/              # SQL migration scripts
  scripts/                 # Utility scripts
  schema.sql               # Database schema
  server.js                # Express entrypoint
  vercel.json              # Vercel routing/build config
```

## Prerequisites

Install these first:

1. Node.js 18+ (or newer)
2. MySQL 8+
3. Git

Optional but helpful:

1. VS Code
2. MySQL Workbench or any SQL client

## Quick Start (Local Development)

### Step 1. Clone the repository

```bash
git clone https://github.com/<your-username>/sajilokhata.git
cd sajilokhata/sajilokhata_project
```

### Step 2. Install dependencies

```bash
npm install
```

### Step 3. Create environment file

Copy `.env.example` to `.env`:

```bash
# PowerShell
Copy-Item .env.example .env

# macOS/Linux
cp .env.example .env
```

Example `.env` values:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=sajilokhata_db
JWT_SECRET=replace_with_a_very_long_random_secret
CORS_ORIGIN=http://localhost:5000
ENABLE_DAILY_BACKUP=true
BACKUP_INTERVAL_HOURS=24
MYSQLDUMP_PATH=mysqldump
```

### Step 4. Create database and import schema

```bash
mysql -u your_mysql_user -p -e "CREATE DATABASE IF NOT EXISTS sajilokhata_db;"
mysql -u your_mysql_user -p -D sajilokhata_db -e "source schema.sql"
```

Note for PowerShell users: use `-e "source schema.sql"` as shown above.

### Step 5. Start the app

```bash
npm start
```

Open:

```text
http://localhost:5000
```

## Common Local Commands

```bash
# Start normally
npm start

# Start in watch mode
npm run dev

# Basic syntax check examples
node --check server.js
node --check public/js/app.js
```

## Environment Variables

### Required

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`

### Optional

- `PORT` (local only)
- `CORS_ORIGIN` (recommended for production)
- `ENABLE_DAILY_BACKUP` (`false` recommended on serverless)
- `BACKUP_INTERVAL_HOURS`
- `MYSQLDUMP_PATH`

## Deployment Guide (Vercel + Managed MySQL)

## Overview

You deploy two parts:

1. App (Node/Express) on Vercel
2. Database on a managed MySQL provider

Suggested MySQL providers: PlanetScale, Aiven, Railway MySQL, TiDB Serverless, AWS RDS, etc.

## Step-by-step Deployment

### Step 1. Push code to GitHub

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### Step 2. Create a MySQL database in cloud

In your DB provider:

1. Create a MySQL database instance
2. Create database `sajilokhata_db` (or any name)
3. Create a database user/password
4. Allow Vercel/network access according to provider docs
5. Copy host, port, username, password, and database name

### Step 3. Import schema into cloud DB

```bash
mysql -h <host> -P <port> -u <user> -p -D <database> -e "source schema.sql"
```

### Step 4. Import project into Vercel

1. Go to Vercel dashboard
2. Click Add New Project
3. Import your GitHub repository
4. Keep default framework settings (this repo already has `vercel.json`)

### Step 5. Configure environment variables in Vercel

Add these in Project Settings > Environment Variables:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `CORS_ORIGIN` = your deployed app URL (for example `https://your-app.vercel.app`)
- `ENABLE_DAILY_BACKUP=false`

### Step 6. Deploy

Click Deploy (or Redeploy after env changes).

### Step 7. Post-deploy smoke test

Verify:

1. Home page loads
2. Login works
3. Dashboard loads data
4. Product create/edit works
5. Transaction submit works
6. Invoice download works
7. Reports load

## Troubleshooting

### App loads but API fails

- Check Vercel env variables
- Check database host/port/user/password/database values
- Ensure cloud DB allows incoming connections from Vercel

### Login fails with token/auth issues

- Confirm `JWT_SECRET` is set in Vercel
- Redeploy after env changes

### CORS errors in browser

- Set `CORS_ORIGIN` to your exact production URL
- Redeploy after changing `CORS_ORIGIN`

### Rate limit response shown unexpectedly

- API is rate-limited by design
- Wait a moment and retry, or reduce repeated automated calls

### Invoice download not working

- Ensure user is logged in
- Ensure transaction exists and API returns `200`
- Check browser download permission/pop-up settings

## Security Best Practices

1. Never commit `.env` files
2. Use a long random `JWT_SECRET`
3. Use least-privilege database users
4. Rotate credentials if exposed
5. Keep dependencies updated

## License

ISC