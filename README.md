# Fastify Billing

A web-based billing and network management application consisting of:

- Backend API built with Fastify + TypeScript
- Frontend admin dashboard and customer portal built with React + Vite +
  shadcn/ui
- Payment integration with SumoPod
- Management for customers, packages, routers, invoices, bills, tickets,
  dashboard, and notifications

## Tech Stack

### Backend

- Node.js 20+
- Fastify 5
- TypeScript
- MySQL / MariaDB
- JWT Authentication
- Swagger/OpenAPI

### Frontend

- React 18+
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Router
- Axios

## Project Structure

```bash
Fastify Billing/
├── README.md
├── Backend.PRD.md
├── Frontend.md
├── PRD.MD
├── fasty-api/
│   ├── .env.example
│   ├── package.json
│   ├── README.md
│   ├── sql/
│   └── src/
├── fasty-bill/
│   ├── .env.example
│   ├── package.json
│   ├── README.md
│   └── src/
└── .gitignore
```

## Prerequisites

- Node.js 20 or newer
- MySQL 8 / MariaDB 10.6+
- Git
- Browser for frontend access

## Quick Start

Install dependencies for the root runner and both applications:

```bash
npm install
npm install --prefix fasty-api
npm install --prefix fasty-bill
```

Configure `fasty-api/.env` and `fasty-bill/.env` using the respective
`.env.example` files, then run both applications from this directory:

```bash
npm run dev
```

For a production-style run, build both applications and start them together:

```bash
npm run start
```

The API is available at `http://localhost:3000` and the Vite development server
at `http://localhost:5173`. The production-style frontend preview is available
at `http://localhost:4173`.

## Backend Setup

1. Copy the environment file:

```bash
cp fasty-api/.env.example fasty-api/.env
```

2. Update the values in `fasty-api/.env` according to your local database and
   credentials.

3. Run database migration and seed:

```bash
npm run db:migrate --prefix fasty-api
```

3. Start both servers from the project root with `npm run dev`.

The backend can still be started independently from `fasty-api` when needed:

```bash
npm run dev --prefix fasty-api
```

The API will run at:

- http://localhost:3000
- Swagger docs: http://localhost:3000/docs

## Frontend Setup

1. Copy the environment file:

```bash
cp fasty-bill/.env.example fasty-bill/.env
```

2. The frontend starts automatically with the backend when running `npm run dev`
   from the project root.

The frontend can still be started independently from the project root when
needed:

```bash
npm run dev --prefix fasty-bill
```

The frontend will run at:

- http://localhost:5173

## Environment Variables

### Backend .env example

```env
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=
DB_NAME=fasty_bill

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=8h

CORS_ORIGIN=http://localhost:5173

SUMODOP_BASE_URL=https://api-pay-sandbox.sumopod.com
SUMODOP_WEBHOOK_SECRET=your_webhook_secret
SUMODOP_WEBHOOK_TOKEN=your_webhook_token

ENCRYPTION_KEY=your_32_byte_encryption_key
```

### Frontend .env example

```env
VITE_API_URL=http://localhost:3000/api
```

## Deployment (Docker Compose)

Setup produksi siap pakai menggunakan Docker Compose: MySQL, backend
(`fasty-api`), frontend (`fasty-bill` via nginx), dan gateway WhatsApp
([go-whatsapp-web-multidevice](https://github.com/aldinokemal/go-whatsapp-web-multidevice)).

### Struktur file deploy

```bash
Fastify-Billing/
├── docker-compose.yml          # orkestrasi 4 service
├── .env.example                # contoh variabel environment
├── fasty-api/
│   ├── Dockerfile              # multi-stage Node 20 Alpine
│   └── sql/migration_production.sql  # skema + admin default (data kosong)
└── fasty-bill/
    ├── Dockerfile              # Vite build + nginx
    └── nginx.conf              # reverse proxy /api -> backend
```

### Langkah deploy

1. **Siapkan environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` dan ubah minimal nilai berikut (jangan pakai default):

   | Variabel | Keterangan |
   | --- | --- |
   | `MYSQL_ROOT_PASSWORD` | Password root MySQL |
   | `DB_USER` / `DB_PASS` | Kredensial aplikasi ke DB |
   | `JWT_SECRET` | Secret JWT (acak, panjang) |
   | `ENCRYPTION_KEY` | Kunci enkripsi (32 karakter) |
   | `WA_BASIC_AUTH` | `user:password` dashboard & API gateway WA |
   | `CORS_ORIGIN` | Origin frontend (mis. `https://billing.domain.com`) |

2. **Build & jalankan semua service**

   ```bash
   docker compose up -d --build
   ```

   Service yang berjalan:

   | Service | Port | Keterangan |
   | --- | --- | --- |
   | `fasty-bill` (nginx) | `80` | Frontend + proxy `/api` ke backend |
   | `fasty-api` | internal `3000` | Backend API (tidak diexpose publik) |
   | `mysql` | `127.0.0.1:3306` | DB (hanya localhost) |
   | `whatsapp` | `3000` | Dashboard gateway WA (ubah ke `127.0.0.1` jika tak perlu publik) |

3. **Migrasi database** (buat skema + user admin default)

   ```bash
   # Opsi A — via script npm (jalankan schema + seed + upsert admin)
   docker compose exec fasty-api npm run db:migrate

   # Opsi B — import file migrasi produksi langsung ke MySQL
   docker compose exec -T mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" fasty_bill \
     < fasty-api/sql/migration_production.sql
   ```

   Login admin default: `admin@rtrw.net` / `admin123` (segera ganti password).

4. **Verifikasi**

   - Frontend: buka `http://<server-ip>/` (atau domain Anda)
   - Swagger API: `http://<server-ip>/docs`
   - Health backend: `http://<server-ip>/health`
   - WhatsApp gateway: `http://<server-ip>:3000` (login pakai `WA_BASIC_AUTH`)

### Catatan produksi

- **HTTPS**: compose ini belum menyertakan TLS. Pasang reverse proxy (Caddy/Nginx/Traefik)
  di depan `fasty-bill:80` dengan sertifikat Let's Encrypt, atau set `CORS_ORIGIN`
  ke domain HTTPS Anda.
- **WhatsApp session**: volume `whatsapp_storages` menyimpan session QR — jangan hapus
  agar tidak perlu scan ulang. Untuk webhook pesan masuk, isi `WA_WEBHOOK` di `.env`
  dengan endpoint backend Anda.
- **Keamanan**: ganti semua password/default, jangan expose port MySQL & `fasty-api`
  ke publik (sudah dibatasi `127.0.0.1` di compose).
- **Update image WA**: `docker compose pull whatsapp && docker compose up -d whatsapp`.

## Main Features

- Admin dashboard
- Customer management
- Package and pricing management
- Router management
- Invoice and payment processing
- Payment review and approval flow
- Ticket management
- Notification system
- Activity log tracking
- Customer self-service portal

## Default Admin Login

After migration, the default login credentials are usually:

```text
Email: admin@rtrw.net
Password: admin123
```

## Scripts

### Backend scripts

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm run db:migrate
```

### Frontend scripts

```bash
npm run dev
npm run build
npm run preview
```

## Notes

- Keep your real `.env` file local and never commit it to Git.
- Use `.env.example` as a template for other developers.
- Use the project docs in [Backend.PRD.md](Backend.PRD.md) and [PRD.MD](PRD.MD)
  for business rules and requirements.

## License

This project is intended for internal or project-specific use unless a separate
license is provided.
