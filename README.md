# Fastify Billing

Aplikasi billing dan manajemen jaringan berbasis web yang terdiri dari:

- Backend API menggunakan Fastify + TypeScript
- Frontend dashboard/admin dan portal pelanggan menggunakan React + Vite + shadcn/ui
- Integrasi pembayaran menggunakan SumoPod
- Manajemen pelanggan, paket, router, invoice, tagihan, tiket, dashboard, dan notifikasi

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
- Browser for frontend

## Backend Setup

1. Open folder backend:

```bash
cd fasty-api
```

2. Copy environment file:

```bash
cp .env.example .env
```

3. Update values in `.env` according to your local database and credentials.

4. Install dependencies:

```bash
npm install
```

5. Run database migration and seed:

```bash
npm run db:migrate
```

6. Start development server:

```bash
npm run dev
```

The API will run at:

- http://localhost:3000
- Swagger docs: http://localhost:3000/docs

## Frontend Setup

1. Open folder frontend:

```bash
cd fasty-bill
```

2. Copy environment file:

```bash
cp .env.example .env
```

3. Install dependencies:

```bash
npm install
```

4. Run frontend:

```bash
npm run dev
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

## Main Features

- Admin dashboard
- Customer management
- Package and pricing management
- Router and hotspot management
- Invoice and payment processing
- Payment review/approval flow
- Ticket management
- Notification system
- Activity log tracking
- Portal for customer self-service

## Default Admin Login

After migration, default login credentials are usually:

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
- Use the project docs in [Backend.PRD.md](Backend.PRD.md) and [PRD.MD](PRD.MD) for business rules and requirements.

## License

This project is for internal/project use unless a separate license is provided.
