# Client Ledger Management System — Backend

A working Node.js/Express/MongoDB backend for the Client Ledger blueprint: role-based
auth, client/subclient ledgers, transactions, reports, and an admin seeder — implementing
the security requirements from the blueprint (Helmet, CORS, rate limiting, RBAC, audit
logs, soft delete, JWT rotation, bcrypt hashing).

## 1. Install

```bash
cd backend
npm install
```

## 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set real values — **never commit this file**:

- `MONGO_URI` — your MongoDB connection string (Atlas or local)
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — two different long random strings
- `COOKIE_SECRET` — another long random string
- `CORS_ORIGIN` — your frontend URL (e.g. `http://localhost:5173`)
- `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` — used **only** by the seeder below

Generate strong secrets quickly:

```bash
node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex') + '\n')"
```

## 3. Create the first Super Admin (the seeder)

```bash
npm run seed:admin
```

What it does:

- Reads `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`
- Refuses to run if `ADMIN_PASSWORD` is missing, too short, or still the placeholder value
- If no user exists with that email, creates a new **Super Admin** (password is bcrypt-hashed
  by the User model — the plain password is never stored or logged)
- If a user with that email **already exists**, it only updates their name/role/active
  status — it will **never** silently overwrite an existing password. This makes the
  script safe to re-run (e.g. in a deploy pipeline) without accidentally resetting credentials
- If `NODE_ENV=production`, it asks for an interactive "yes" confirmation before writing
  anything, so it can't run unattended against production by accident

Log in with the email/password you put in `.env`, then immediately use
`POST /api/auth/change-password` to set a password only you know.

### Optional: demo data

```bash
npm run seed:demo
```

Seeds one sample site ("Delhi Arhat") with its three subclients and a few transactions,
taken directly from the blueprint's own example — useful for testing the API immediately
after seeding the admin.

## 4. Run the server

```bash
npm run dev     # nodemon, auto-restarts on changes
npm start       # plain node, for production
```

Health check: `GET /api/health`

## API surface

| Area | Routes |
|---|---|
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/refresh`, `GET /api/auth/me`, `POST /api/auth/change-password` |
| Users (Super Admin only) | `GET/POST /api/users`, `PUT/DELETE /api/users/:id` |
| Clients | `GET/POST /api/clients`, `GET/PUT /api/clients/:id`, `DELETE /api/clients/:id` (Super Admin), `POST /api/clients/:id/restore` (Super Admin) |
| Transactions | `GET/POST /api/clients/:id/transactions`, `GET/PUT /api/transactions/:id`, `DELETE /api/transactions/:id` (Super Admin) |
| Reports | `GET /api/reports/summary`, `GET /api/reports/client/:id` |

All routes except `/api/auth/login`, `/api/auth/refresh`, and `/api/health` require a
valid `accessToken` cookie, set automatically on login.

## Security implemented

- Helmet, locked-down CORS, `express-mongo-sanitize`, `hpp`, response compression
- Global + login-specific rate limiting; account lockout after 5 failed logins (15 min)
- JWT access (15m) + refresh (7d) tokens in httpOnly cookies; production uses
  `Secure` + `SameSite=None` for hosted cross-site frontend/backend sessions. The backend
  also enables those cookie flags when `CORS_ORIGIN` is an HTTPS URL, and refresh
  tokens are versioned so logout/password-change instantly invalidates old sessions
- bcrypt password hashing (cost factor 12); passwords/tokens are never logged
- Role-based access control (`super_admin` / `admin`) plus per-admin client assignment
- Every create/update/delete on Clients and Transactions writes an `AuditLog` entry
  (who, when, old value, new value, IP)
- Soft delete everywhere financial data is involved — nothing is hard-deleted via the API
- Centralized error handler that never leaks stack traces or DB errors to the client
- `express-validator` on every write endpoint

## Ledger integrity

- **Denormalized running balance.** `Client.cachedTotalCredit` / `cachedTotalDebit` /
  `cachedTransactionCount` are the read path — the dashboard and client list read these
  directly instead of re-summing every transaction on every request. They're updated via
  `applyLedgerDelta()` (`src/utils/ledger.js`) using MongoDB's atomic `$inc`, so two admins
  posting transactions for the same client at the same instant can't lose an update to a
  race condition — no in-app locking or multi-document transaction required.
- **Idempotency keys.** `POST /api/clients/:id/transactions` accepts an optional
  `Idempotency-Key` header. Send the same key on a retried request (timeout, flaky mobile
  network, double-tapped submit) and you get the original response replayed instead of a
  duplicate transaction. Omit the header and the endpoint behaves exactly as before —
  this is opt-in protection, not a required contract change.
- **Reconciliation.** `npm run reconcile` (add `-- --dry` to only report) recomputes every
  client's cached totals from the actual transaction log and fixes any drift. Aggregation
  is deliberately kept out of the hot read path but still exists here — and in the reports
  endpoints — as the ground-truth check.

## What's not included yet

This is the backend only. Not built here: file upload for bills (Cloudinary/Multer wiring),
Excel/PDF/CSV export, and the frontend. All are called out in the blueprint's Phase 6 and
"Additional Recommended Features" — happy to build any of them next.
