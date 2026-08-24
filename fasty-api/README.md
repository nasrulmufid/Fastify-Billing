# fasty-api — Backend Billing RT/RW Net

Backend REST API (Fastify 5 + TypeScript + MySQL/MariaDB) sesuai `Backend.PRD.md`.

## Persyaratan
- Node.js 20+
- MySQL 8 / MariaDB 10.6+ berjalan lokal

## Setup

```bash
# 1. Konfigurasi environment (salin .env.example -> .env, sesuaikan kredensial DB)
cp .env.example .env

# 2. Install dependency
npm install

# 3. Migrasi database (buat skema + seed + user admin)
npm run db:migrate
#   Login admin: admin@rtrw.net / admin123

# 4. Jalankan dev server (tsx watch, port 3000)
npm run dev
```

## Script
| Script | Keterangan |
|---|---|
| `npm run dev` | Dev server (auto-reload) |
| `npm run build` | Compile TypeScript ke `dist/` |
| `npm run start` | Jalankan hasil build |
| `npm run typecheck` | Type-check tanpa emit |
| `npm run db:migrate` | Jalankan `sql/schema.sql` + `sql/seed.sql` + upsert admin |
| `npx tsx src/scripts/smoke.ts` | Smoke test Fase 1 (auth, users, packages, routers, customers) |
| `npx tsx src/scripts/smoke2.ts` | Smoke test Fase 2 (invoice mark-paid, payment approve/reject, webhook SumoPod) |
| `npx tsx src/scripts/smoke3.ts` | Smoke test Fase 3 (tickets, hotspot, WA, notifikasi, dashboard) |

> Smoke test membutuhkan DB fresh (drop + migrate ulang) karena mengubah data.

## Endpoint (prefix `/api`)
- Auth: `POST /auth/login`, `GET/PUT /auth/me`, `PUT /auth/me/password`, dll.
- Users, Packages, Routers, Customers (CRUD + expiry/extend/isolir)
- Invoices (CRUD + `POST /:id/mark-paid`), Payments (approve/reject/resend)
- Webhook SumoPod: `POST /webhook/payment` (raw body, Svix signature / X-Webhook-Token)
- Payment Gateway config: `GET/PUT /payment-gateway/config`, `POST /test`, `POST /create-payment`
- Tickets (+timeline), Hotspot (profiles/users/vouchers/templates/settings)
- WA Gateway (templates/config/send/logs), Notifications, Activity Logs, Settings, Dashboard

Dokumentasi OpenAPI/Swagger: `http://localhost:3000/docs`

## Struktur
```
sql/            schema.sql + seed.sql
src/
  plugins/      db (mysql2 pool + transaksi), jwt (auth+RBAC), cors, error-handler, swagger
  routes/       satu file per modul
  services/     payment.service (transaksi mark-paid/approve/webhook)
  utils/        codegen (kode max+1), date (format id-ID), phone (62), crypto (AES), sumopod (client+verify)
  jobs/         scheduler node-cron (invoice, overdue, isolir, reminder, voucher expired) — production only
  scripts/      migrate.ts, smoke.ts, smoke2.ts, smoke3.ts
```

## Catatan
- Frontend `fasty-bill` memakai `VITE_API_URL` (default `http://localhost:3000/api`) dan interceptor 401 → logout.
- Webhook SumoPod: wajib raw body, balas 2xx ≤ 10 detik, idempotent per `payment_id`.
- Secret disimpan terenkripsi (AES-256-GCM, `ENCRYPTION_KEY`); GET config mengembalikan masked.
