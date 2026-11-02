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

## Quick Start (Development)

### Requirements

- Node.js 20 or newer and npm
- MySQL 8 / MariaDB 10.6+ running locally or reachable from this machine

### Install and configure

Run from repository root:

```bash
npm install
npm install --prefix fasty-api
npm install --prefix fasty-bill
```

Copy `fasty-api/.env.example` to `fasty-api/.env`, then set DB credentials and
secrets. PowerShell:

```powershell
Copy-Item fasty-api/.env.example fasty-api/.env
```

macOS/Linux:

```bash
cp fasty-api/.env.example fasty-api/.env
```

Frontend has no `.env.example`; its API URL defaults to `/api`. Create
`fasty-bill/.env` only when overriding `VITE_API_URL`, for example
`VITE_API_URL=http://localhost:3000/api`.

The MySQL database must already exist, and `DB_HOST` in `fasty-api/.env` must
reach it. Apply schema and seed once:

```bash
npm run db:migrate --prefix fasty-api
```

Start both services from repository root:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`

Start one service independently with `npm run dev --prefix fasty-api` or
`npm run dev --prefix fasty-bill`.

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
SUMODOP_API_KEY=your_sumopod_api_key
SUMODOP_WEBHOOK_SECRET=your_webhook_secret
SUMODOP_WEBHOOK_TOKEN=your_webhook_token

ENCRYPTION_KEY=your_32_byte_encryption_key
```

### Frontend .env example

```env
VITE_API_URL=http://localhost:3000/api
```

## Deployment (Docker Compose)

Production setup: MySQL, backend (`fasty-api`), frontend (`fasty-bill` via
nginx), WhatsApp gateway.

### Prerequisites

- Docker & Docker Compose installed
- Domain (recommended untuk HTTPS)

### Quick Start

1. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` — ubah nilai berikut (jangan gunakan default):

   | Variabel                  | Deskripsi                                                      |
   | ------------------------- | -------------------------------------------------------------- |
   | `MYSQL_ROOT_PASSWORD`     | MySQL root password (32+ chars, random)                        |
   | `DB_USER` / `DB_PASSWORD` | Kredensial aplikasi ke database                                |
   | `JWT_SECRET`              | JWT signing key (run: `openssl rand -base64 32`)               |
   | `ENCRYPTION_KEY`          | Data encryption key (32 chars, run: `openssl rand -base64 32`) |
   | `WA_BASIC_AUTH`           | WhatsApp gateway auth `user:password`                          |
   | `CORS_ORIGIN`             | Frontend URL (mis. `https://billing.yourdomain.com`)           |

2. **Start services**

   ```bash
   docker compose up -d --build
   ```

   Services & ports:

   | Service              | Port          | Akses                     |
   | -------------------- | ------------- | ------------------------- |
   | `fasty-bill` (nginx) | 80            | Frontend + API proxy      |
   | `fasty-api`          | internal 3000 | Backend (via nginx saja)  |
   | `mysql`              | internal 3306 | Database (tidak diexpose) |
   | `whatsapp`           | 5000          | WA gateway dashboard      |

   Migration runs automatically on first start (creates schema + default admin).

3. **Verify**
   - Frontend: `http://<server-ip>/`
   - API docs: `http://<server-ip>/api/docs`
   - Health: `http://<server-ip>/health`
   - WhatsApp: `http://<server-ip>:5000` (login: `WA_BASIC_AUTH`)

   Default admin: `admin` / `admin` — **change immediately**.

### Production notes

- **HTTPS**: Place Caddy/Nginx/Traefik in front port 80 with Let's Encrypt.
  Update `CORS_ORIGIN` to HTTPS domain.
- **Firewall**: Only expose ports 80 (frontend) and 443 (HTTPS). Keep 5000
  (WhatsApp) internal or restrict to admin IPs.
- **WhatsApp session**: Volume `whatsapp_storages` persists QR session — don't
  delete unless resetting. Set `WA_WEBHOOK` in `.env` for incoming message
  webhooks.
- **Backups**: Schedule `mysql_data` volume backups:
  `docker exec fasty-mysql mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" fasty_bill > backup.sql`
- **Updates**:
  ```bash
  git pull
  docker compose up -d --build
  ```

### Development mode (local debugging)

Uncomment in `docker-compose.yml` to expose ports directly:

```yaml
fasty-api:
  ports:
    - '3000:3000' # Direct API access (debugging)
mysql:
  ports:
    - '127.0.0.1:3306:3306' # Local MySQL client
```

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
Username: admin
Password: admin
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
