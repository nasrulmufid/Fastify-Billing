# Product Requirements Document (PRD)
## Backend API — Aplikasi Billing RT/RW Net

---

## 1. Document Control

| Item | Detail |
|---|---|
| Judul Dokumen | PRD Backend REST API — Billing RT/RW Net |
| Versi | 1.0 |
| Tech Stack | Fastify 5, TypeScript, MySQL/MariaDB, JWT |
| Frontend API | Vite React SPA (sesuai Frontend PRD) — `http://localhost:3000/api` |
| Skema Database | `database-schema.md` (17 tabel MySQL/MariaDB — termasuk `payment_gateway_config`) |
| Author / Owner | Backend Engineering Team |

---

## 2. Overview / Executive Summary

**Nama Produk:** Backend API RTRW-Billing

**Ringkasan:** Dokumen ini merupakan spesifikasi kebutuhan backend REST API untuk aplikasi Billing RT/RW Net. Backend dibangun dengan **Fastify** dan **TypeScript**, menggunakan **MySQL/MariaDB** sebagai penyimpanan data. API ini melayani seluruh modul yang sudah dibangun di frontend: autentikasi & user, pelanggan, paket, invoice, pembayaran (QRIS gateway + Tunai), tiket gangguan, router/jaringan, hotspot voucher, WA Gateway, notifikasi, log aktivitas, dan pengaturan.

**Prinsip selaras dengan frontend:**
1. **Endpoint** = apa yang dipanggil halaman/query hook frontend (1:1).
2. **Status enum** = persis dengan literal type frontend (`Active/Isolated/Pending`, `Paid/Unpaid/Overdue`, `Sukses/Pending/Ditolak`, `Dibuka/Diproses/Selesai`, dll).
3. **Kode human-readable** = pola yang sama (`CUST-1001`, `PKG-01`, `INV-1038`, `PY-1011`, `TCK-1042`, `NT-1012`, `TPL-001`).
4. **Flow transaksi** (QRIS/Tunai → perpanjang masa aktif) = 1 endpoint backend yang memuat beberapa langkah store frontend menjadi satu transaksi atomik.

---

## 3. Tech Stack & Library

### 3.1 Core Framework
- **Framework:** Fastify 5
- **Bahasa:** TypeScript (Strict Mode)
- **Runtime:** Node.js 20 LTS+

### 3.2 Database & ORM
- **DBMS:** MySQL 8 / MariaDB 10.6+
- **Driver:** `mysql2` (pool)
- **Akses data:** Repository pattern (query SQL langsung, tanpa ORM berat)

### 3.3 Auth & Keamanan
- **Auth:** `@fastify/jwt` (JWT Bearer, exp 8 jam)
- **Password:** `bcryptjs` (hash, tidak pernah plaintext)
- **CORS:** `@fastify/cors` (origin dikonfigurasi via env)
- **Rate limit:** `@fastify/rate-limit` (login & endpoint sensitif)

### 3.4 Validasi & Dokumentasi
- **Validasi:** `zod` + `fastify-type-provider-zod` (schema body/params/query di setiap route)
- **Dokumentasi API:** `@fastify/swagger` + `@fastify/swagger-ui` (OpenAPI di `/docs`)

### 3.5 Utilitas
- **Error handling:** `@fastify/sensible`
- **Logging:** Pino (built-in Fastify)
- **Scheduler:** `node-cron` (auto-invoice, auto-isolir, reminder, expired voucher)
- **Webhook:** handler bawaan Fastify (POST `/webhook/payment`)
- **Timezone:** Asia/Jakarta (WIB, UTC+7)

---

## 4. Arsitektur & Struktur Folder

Struktur berbasis fitur (feature-based), konsisten dengan gaya modular frontend:

```text
src/
├── server.ts              # Bootstrap: build app, listen
├── app.ts                 # Build Fastify instance (register plugin & routes)
├── plugins/               # Fastify plugins global
│   ├── cors.ts
│   ├── jwt.ts
│   ├── db.ts              # mysql2 pool
│   ├── error-handler.ts   # response envelope error
│   └── swagger.ts
├── routes/                # Route definitions per modul (1 file per modul)
│   ├── auth.routes.ts
│   ├── users.routes.ts
│   ├── customers.routes.ts
│   ├── packages.routes.ts
│   ├── routers.routes.ts
│   ├── invoices.routes.ts
│   ├── payments.routes.ts
│   ├── tickets.routes.ts
│   ├── hotspot.routes.ts
│   ├── wa-gateway.routes.ts
│   ├── notifications.routes.ts
│   ├── activity-logs.routes.ts
│   ├── settings.routes.ts
│   ├── dashboard.routes.ts
│   └── webhook.routes.ts
├── schemas/               # zod schemas (shared types)
│   ├── auth.schema.ts
│   ├── customer.schema.ts
│   └── ...
├── services/              # Business logic (transaksi, generate kode, dll)
│   ├── payment.service.ts      # QRIS/Tunai transaksi + extend expiry
│   ├── invoice.service.ts      # mark-paid, auto-generate
│   ├── voucher.service.ts      # generate voucher hotspot
│   ├── notification.service.ts # tulis notification_logs + kirim WA/Telegram
│   └── router.service.ts       # test koneksi / sync ke Mikrotik
├── repositories/          # Akses SQL per entitas
│   ├── customer.repo.ts
│   ├── invoice.repo.ts
│   └── ...
├── jobs/                  # node-cron schedulers
│   ├── invoice.job.ts
│   ├── isolir.job.ts
│   ├── reminder.job.ts
│   └── voucher.job.ts
├── utils/
│   ├── codegen.ts         # CUST-xxxx / INV-xxxx / PY-xxxx (max+1, aman transaksi)
│   ├── date.ts            # format id-ID, addMonthsToExpiry, timezone WIB
│   └── phone.ts           # normalisasi WA (0/62 → 62)
└── models/                # TypeScript interfaces (cermin database-schema.md)
```

**Plugin Lifecycle:**
- `onRequest` → auth check (kecuali route public: `/auth/login`, `/webhook/*`).
- `preHandler` → RBAC check per route (role yang diizinkan).
- Route handler → validasi zod → service → repository → response envelope.

---

## 5. Autentikasi & RBAC

### 5.1 Autentikasi
- Login → verifikasi `users.email` + `users.password_hash` (bcrypt compare) → issue JWT `{ sub: userId, role }`.
- Semua request (kecuali public) wajib header `Authorization: Bearer <token>`.
- **401** → frontend interceptor `axios.ts` otomatis `logout()` + redirect `/login` (sudah ada di sisi frontend).

### 5.2 Peran (Role)
| Role | Keterangan |
|---|---|
| `super_admin` | Akses penuh, termasuk Pengaturan & WA Gateway |
| `admin` | Operasional harian (pelanggan, paket, invoice, pembayaran, tiket) |
| `finance` | Invoice & pembayaran |
| `teknisi` | Router/jaringan & tiket |

### 5.3 Matriks Akses (diselaraskan dengan menu frontend)

| Route group | super_admin | admin | finance | teknisi |
|---|---|---|---|---|
| `/auth/*` | ✅ | ✅ | ✅ | ✅ |
| `/users` | ✅ | — | — | — |
| `/packages` | ✅ | ✅ | — | — |
| `/customers` | ✅ | ✅ | — | — |
| `/routers` + `/network/isolir` | ✅ | ✅ | — | ✅ |
| `/invoices` | ✅ | ✅ | ✅ | — |
| `/payments` | ✅ | ✅ | ✅ | — |
| `/tickets` | ✅ | ✅ | — | ✅ |
| `/hotspot/*` | ✅ | ✅ | — | ✅ |
| `/wa-gateway/*` | ✅ | — | — | — |
| `/notifications` | ✅ | ✅ | ✅ | ✅ |
| `/activity-logs` | ✅ | ✅ | — | ✅ |
| `/settings` | ✅ | ✅ | — | — |
| `/dashboard/*` | ✅ | ✅ | ✅ | ✅ |
| `/webhook/*` | Public (signature) | — | — | — |

---

## 6. Konvensi API & Response Envelope

### 6.1 Base URL & Prefix
```
BASE_URL = http://localhost:3000
API_PREFIX = /api
Dokumentasi = http://localhost:3000/docs
```

### 6.2 Format Respons
**Sukses tunggal:**
```json
{ "data": { ... } }
```

**Sukses list (paginasi):**
```json
{
  "data": [ ... ],
  "meta": { "page": 1, "limit": 10, "total": 248 }
}
```

**Error:**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Format IP tidak valid", "details": [...] } }
```

### 6.3 Kode HTTP
| Kode | Penggunaan |
|---|---|
| 200 | Sukses |
| 201 | Created (POST) |
| 400 | Validasi/body tidak valid |
| 401 | Token tidak ada/kedaluwarsa |
| 403 | Role tidak diizinkan |
| 404 | Resource tidak ditemukan |
| 409 | Duplikat (kode/nama/username) |
| 422 | Konflik status (mis. invoice sudah lunas) |
| 500 | Internal error |

---

## 7. Endpoint per Modul

> Notasi: `(role)` = daftar peran yang boleh akses, `Public` = tanpa auth.

### 7.1 Auth (`/api/auth`)
| Method | Path | Body / Params | Response | Role | Catatan |
|---|---|---|---|---|---|
| POST | `/auth/login` | `{email, password}` | `{data:{token, user}}` | Public | verify bcrypt; user = id/name/email/role |
| POST | `/auth/forgot-password` | `{email}` | `{data:{message}}` | Public | kirim instruksi reset via email (simulasi) |
| POST | `/auth/reset-password` | `{token, newPassword}` | `{data:{message}}` | Public | min 6 karakter |
| GET | `/auth/me` | — | `{data:{id,name,email,role}}` | Semua | profil user login |
| PUT | `/auth/me` | `{name?, email?}` | `{data:{id,name,email,role}}` | Semua | update profil → sinkron `updateUser` di store frontend |
| PUT | `/auth/me/password` | `{currentPassword, newPassword}` | `{data:{message}}` | Semua | validasi password lama; min 6 |

### 7.2 Users (`/api/users`) — manajemen user & role
| Method | Path | Body | Response | Role | Catatan |
|---|---|---|---|---|---|
| GET | `/users` | query `search?, role?, status?` | `{data:[user], meta}` | super_admin | list user |
| POST | `/users` | `{name, email, password, role, status}` | `{data:user}` | super_admin | hash password; 409 jika email ada |
| PUT | `/users/:id` | `{name?, email?, role?, status?}` | `{data:user}` | super_admin | |
| DELETE | `/users/:id` | — | `{data:{message}}` | super_admin | cegah hapus diri sendiri (frontend disable) |
| PUT | `/users/:id/status` | `{status}` | `{data:user}` | super_admin | Aktif/Nonaktif |
| PUT | `/users/:id/reset-password` | `{password}` | `{data:{message}}` | super_admin | hash ulang |

### 7.3 Packages (`/api/packages`)
| Method | Path | Body | Response | Role | Catatan |
|---|---|---|---|---|---|
| GET | `/packages` | — | `{data:[package]}` | admin+ | list paket |
| POST | `/packages` | `{name, downloadSpeed, uploadSpeed, price, type, description}` | `{data:pkg}` | admin+ | kode `PKG-XX` (max+1) |
| PUT | `/packages/:id` | `{...}` | `{data:pkg}` | admin+ | |
| DELETE | `/packages/:id` | — | `{data:{message}}` | admin+ | |
| PUT | `/packages/:id/status` | `{status: 'Aktif'\|'Nonaktif'}` | `{data:pkg}` | admin+ | |

### 7.4 Customers (`/api/customers`)
| Method | Path | Body / Query | Response | Role | Catatan |
|---|---|---|---|---|---|
| GET | `/customers` | query `page, limit, search, status, packageId` | `{data:[customer], meta}` | admin+ | search: nama/code/phone/ip; `search` case-insensitive |
| GET | `/customers/:id` | — | `{data:customer}` | admin+ | include package & router |
| POST | `/customers` | lihat payload di bawah | `{data:customer}` | admin+ | kode `CUST-xxxx` (max+1); ip auto `192.168.1.x` |
| PUT | `/customers/:id` | `{...}` | `{data:customer}` | admin+ | |
| DELETE | `/customers/:id` | — | `{data:{message}}` | admin+ | hard delete (sesuai frontend) |
| PUT | `/customers/:id/expiry` | `{expiryDate}` | `{data:customer}` | admin+ | set masa aktif manual (dialog "Edit Masa Aktif") |
| POST | `/customers/:id/extend` | `{months}` | `{data:customer}` | admin+ | `addMonthsToExpiry` + status → Active |
| POST | `/network/isolir/:id` | `{isolate: boolean}` | `{data:customer}` | admin+/teknisi | status Isolated/Active (endpoint persis yg dipanggil `useIsolirCustomer`) |

**Payload POST/PUT customer (selaras `CustomerFormDialog`):**
```json
{
  "name": "Budi Santoso",
  "phone": "0812-3456-7890",
  "email": "budi@email.com",
  "address": "RT 02 / RW 04, Kel. Merdeka",
  "packageId": 2,
  "routerId": 1,
  "ipAddress": "192.168.1.2",
  "pppoeUsername": "ppp-budi",
  "pppoePassword": "budi#2026",
  "loginUsername": "budi.santoso",
  "loginPassword": "budi2026",
  "odpId": "ODP-01 / Port 4",
  "gps": "-6.9175, 107.6191"
}
```
> **Catatan normalisasi:** frontend saat ini menyimpan `packageName` & `router` sebagai string. Backend menyimpan `package_id` & `router_id` (FK) dan mengembalikan `packageName`/`routerName` hasil JOIN agar kompatibel dengan komponen yang ada.

### 7.5 Routers (`/api/routers`)
| Method | Path | Body | Response | Role | Catatan |
|---|---|---|---|---|---|
| GET | `/routers` | — | `{data:[router]}` | admin+/teknisi | |
| POST | `/routers` | `{name, host, provider}` | `{data:router}` | admin+/teknisi | `host` = `ip:port` ATAU `domain:port`; validasi HOST_RE; 409 jika name/host duplikat |
| PUT | `/routers/:id` | `{...}` | `{data:router}` | admin+/teknisi | |
| DELETE | `/routers/:id` | — | `{data:{message}}` | admin+/teknisi | |
| POST | `/routers/:id/test` | — | `{data:{status}}` | admin+/teknisi | simulasi koneksi → Connected/Standby/Disconnected + update `status` |
| POST | `/routers/:id/sync` | — | `{data:{syncedCount}}` | admin+/teknisi | sinkron user ke router |

**Validasi host (persis frontend `HOST_RE`):**
- IPv4 dengan range 0–255 per oktet, opsional `:port` (1–65535): `192.168.2.1`, `192.168.2.1:177`
- Hostname/domain, opsional `:port`: `idn24.tunnel.id:3025`
- Label hostname tidak boleh seluruhnya angka (`999.999.999.999` → ditolak)

### 7.6 Invoices (`/api/invoices`)
| Method | Path | Body / Query | Response | Role | Catatan |
|---|---|---|---|---|---|
| GET | `/invoices` | query `status?, period?, customerId?` | `{data:[invoice], meta}` | admin+/finance | |
| GET | `/invoices/:id` | — | `{data:invoice}` | admin+/finance | include payment terkait |
| POST | `/invoices` | `{customerId, amount, period}` | `{data:invoice}` | admin+/finance | kode `INV-xxxx` (max+1); status Unpaid |
| **POST** | **`/invoices/:id/mark-paid`** | `{method: 'Tunai'}` | `{data:{invoice, payment}}` | admin+/finance | **Transaksi**: buat payment `PY-xxxx` (Tunai, Sukses) → invoice Paid + `payment_method`/`payment_code` → `extendExpiry(customer, 1)` + status Active. 422 jika sudah Paid |
| DELETE | `/invoices/:id` | — | `{data:{message}}` | admin+/finance | |

### 7.7 Payments (`/api/payments`)
| Method | Path | Body / Query | Response | Role | Catatan |
|---|---|---|---|---|---|
| GET | `/payments` | query `status?, method?` | `{data:[payment], meta}` | admin+/finance | |
| GET | `/payments/approval` | — | `{data:[payment]}` | admin+/finance | queue Pending (approval page) |
| GET | `/payments/:id` | — | `{data:payment}` | admin+/finance | + statusNote/methodHint |
| POST | `/payments` | `{customerId, invoiceId, method, amount}` | `{data:payment}` | admin+/finance | catat manual (Tunai), kode `PY-xxxx` |
| **POST** | **`/payments/:id/approve`** | `{statusNote?}` | `{data:{payment, invoice}}` | admin+/finance | **Transaksi**: Pending→Sukses → `extendExpiry(customer,1)` → invoice Paid + payment_method/payment_code |
| POST | `/payments/:id/reject` | `{statusNote?}` | `{data:payment}` | admin+/finance | Pending→Ditolak |
| POST | `/payments/:id/resend` | — | `{data:{message}}` | admin+/finance | kirim ulang notifikasi (untuk log Gagal) |

**Alur QRIS (SumoPod):** backend membuat payment via `POST /api/v1/payments` (header `X-Api-Key`) → pelanggan membayar lewat `payment_link_url` → webhook `payment.completed` masuk ke `/webhook/payment` → payment `Pending→Sukses` → masa aktif +1 bulan → invoice lunas. Admin tidak perlu tindakan (kecuali tolak).

### 7.8 Webhook Payment SumoPod (`/api/webhook/payment`) — Public
| Method | Path | Header | Body (raw JSON) | Response | Catatan |
|---|---|---|---|---|---|
| POST | `/webhook/payment` | `svix-id`, `svix-timestamp`, `svix-signature`, `X-Webhook-Token` | `{event_type, data:{payment_id, order_id, amount, fee, net_amount, status, payment_method, completed_at}}` | `{data:{ok:true}}` | **WAJIB raw body** (tidak di-parse) untuk verifikasi signature. Balas **2xx dalam ≤ 10 detik** — jika tidak, webhook ditandai gagal & dikirim ulang. **Idempotent** berdasarkan `payment_id` (`gateway_ref`). Event `payment.completed` → transaksi approve; `payment.failed` / `payment.expired` → Ditolak; `payment.test` → 200 tanpa eksekusi |

**Verifikasi (dua cara, cukup salah satu):**
1. **Svix signature** (direkomendasikan): hitung `HMAC-SHA256(signingSecretBytes, "{svix-id}.{svix-timestamp}.{rawBody}")` dengan `signingSecretBytes = base64Decode(secret.replace("whsec_", ""))`. `svix-signature` bisa berisi banyak nilai (`v1,<sig> v1,<sig2>` — terjadi ±24 jam setelah rotasi secret); terima jika salah satu cocok.
2. **Webhook Token** (sederhana): bandingkan header `X-Webhook-Token` dengan `webhook_token` (prefix `whtok_`) yang disimpan. Tanpa kalkulasi HMAC.

**Implementasi Fastify:** route ini harus menggunakan content-type parser raw (jangan `application/json` biasa) agar `rawBody` utuh — satu karakter whitespace yang berubah akan mematahkan signature.

### 7.9 Tickets (`/api/tickets`)
| Method | Path | Body | Response | Role | Catatan |
|---|---|---|---|---|---|
| GET | `/tickets` | query `status?` | `{data:[ticket], meta}` | admin+/teknisi | |
| GET | `/tickets/:id` | — | `{data:ticket}` | admin+/teknisi | + timeline |
| POST | `/tickets` | `{customerId, title, category, description}` | `{data:ticket}` | admin+/teknisi | kode `TCK-xxxx`; timeline entry Dibuka (aktor Sistem) |
| PUT | `/tickets/:id/status` | `{status, note?}` | `{data:ticket}` | admin+/teknisi | `setStatus`: update status + updated_at + timeline entry (aktor Admin, note default) |
| POST | `/tickets/:id/notes` | `{note}` | `{data:ticket}` | admin+/teknisi | `addNote`: timeline entry tanpa ubah status |

**Status tiket:** `Dibuka → Diproses → Selesai` (bisa buka lagi → Dibuka). Timeline entry: `{status, actor, date, note}` — persis struktur `ticket_timeline`.

### 7.10 Hotspot (`/api/hotspot`)
| Method | Path | Body | Response | Role | Catatan |
|---|---|---|---|---|---|
| GET | `/hotspot/users` | query `status?, search?` | `{data:[user], meta}` | admin+/teknisi | voucher user |
| **POST** | **`/hotspot/vouchers/generate`** | `{count, profileId, price, format, usernameEqualsPassword, prefix}` | `{data:[user]}` | admin+/teknisi | loop generate kode unik; username = code atau `prefix+code`; password = code (jika equals) atau kode acak; `valid_until` = now + profile.durationHours; status Belum Terpakai. 409 jika ada username bentrok |
| PUT | `/hotspot/users/:id` | `{...patch}` | `{data:user}` | admin+/teknisi | |
| DELETE | `/hotspot/users` | `{ids: string[]}` | `{data:{message}}` | admin+/teknisi | hapus bulk |
| GET/POST/PUT/DELETE | `/hotspot/profiles[/:id]` | — | `{data:...}` | admin+/teknisi | CRUD profile |
| GET/POST/PUT/DELETE | `/hotspot/templates[/:id]` | — | `{data:...}` | admin+/teknisi | CRUD template voucher |
| PUT | `/hotspot/templates/:id/default` | — | `{data:{message}}` | admin+/teknisi | set default template |
| GET/PUT | `/hotspot/settings` | — | `{data:settings}` | admin+/teknisi | config server/api/company |

**Format kode voucher** (persis `generateCode` frontend):
| Format | Pola | Contoh |
|---|---|---|
| `ABCD123` | 3 huruf besar + 3 angka | `KLM482` |
| `abcd123` | 3 huruf kecil + 3 angka | `kjm481` |
| `AbcD123` | campur | `KjmL482` |
| `ABCDEFG` | 7 huruf besar | `KLMNPRT` |
| `abcdefg` | 7 huruf kecil | `kjmnprt` |
| `123456` | 6 angka | `482913` |

Huruf yang dipakai mengecualikan `I`, `O`, `i`, `l`, `o` (agar mudah dibaca).

### 7.11 WA Gateway (`/api/wa-gateway`)
| Method | Path | Body | Response | Role | Catatan |
|---|---|---|---|---|---|
| GET | `/wa-gateway/status` | — | `{data:{connected}}` | super_admin | status device (Terhubung/Belum diuji/Gagal) |
| POST | `/wa-gateway/test` | — | `{data:{connected}}` | super_admin | tes koneksi (simulasi) |
| GET/POST/PUT/DELETE | `/wa-gateway/templates[/:id]` | — | `{data:...}` | super_admin | CRUD template pesan; kode `TPL-00X` |
| GET/PUT | `/wa-gateway/config` | `{serverUrl, apiKey, deviceName, webhookUrl, autoReconnect}` | `{data:config}` | super_admin | apiKey disimpan terenkripsi, return masked |
| **POST** | **`/wa-gateway/send`** | `{to: string[], template: {body}, vars?}` | `{data:{sent, failed}}` | super_admin | normalisasi phone (0/62 → 62), isi placeholder `{nama} {jumlah} {tanggal} {no_invoice} {paket}`, tulis notification_logs |
| GET | `/wa-gateway/logs` | query `status?` | `{data:[log]}` | super_admin | riwayat kirim (max 50) |

### 7.12 Notifications (`/api/notifications`)
| Method | Path | Body | Response | Role | Catatan |
|---|---|---|---|---|---|
| GET | `/notifications` | query `status? (Terkirim/Gagal)` | `{data:[log], meta}` | Semua | log notifikasi (type payment/isolir/due/reminder/ticket, channel WhatsApp/Telegram, kode `NT-xxxx`) |
| POST | `/notifications/:id/resend` | — | `{data:log}` | Semua | kirim ulang → status Terkirim |

### 7.13 Activity Logs (`/api/activity-logs`)
| Method | Path | Query | Response | Role | Catatan |
|---|---|---|---|---|---|
| GET | `/activity-logs` | `page?, limit?` | `{data:[log], meta}` | admin+/teknisi | `{actor, action, target, createdAt}` |

Backend otomatis menulis `activity_logs` pada event penting: login, isolir/unisolir, tambah/ubah/hapus pelanggan, generate invoice, mark-paid, approve/reject pembayaran, update tiket, generate voucher.

### 7.14 Settings (`/api/settings`)
| Method | Path | Body | Response | Role | Catatan |
|---|---|---|---|---|---|
| GET | `/settings` | — | `{data:{gracePeriodDays, billingCycle}}` | admin+ | default `7` / `"Setiap 1 bulan"` |
| PUT | `/settings` | `{gracePeriodDays?, billingCycle?}` | `{data:settings}` | admin+ | validasi grace 1–60 hari |

### 7.15 Dashboard (`/api/dashboard`)
| Method | Path | Response | Catatan |
|---|---|---|---|
| GET | `/dashboard/stats` | `{data:{totalCustomers, unpaidInvoices, isolatedCustomers, monthRevenue}}` | 4 stat card frontend |
| GET | `/dashboard/revenue` | `{data:[{date, revenue}]}` | tren pemasukan (recharts AreaChart) |
| GET | `/dashboard/activity` | `{data:[{time, activity, detail, status}]}` | recentActivity (success/warning/info) |
| GET | `/dashboard/status-distribution` | `{data:[{name, value}]}` | pie status pelanggan: Aktif / Isolir / Suspend(Pending) |

### 7.16 Payment Gateway Config — Kredensial SumoPod (`/api/payment-gateway`)
> Selaras dengan tab **Payment Gateway** di halaman Pengaturan frontend (3 field secret: API Key, Webhook Signing Secret, Webhook Token).

| Method | Path | Body | Response | Role | Catatan |
|---|---|---|---|---|---|
| GET | `/payment-gateway/config` | — | `{data:{isConfigured, apiKey(masked), webhookSigningSecret(masked), webhookToken(masked)}}` | admin+ | kembalikan masked (`sumo_****`) — jangan bocorkan secret |
| PUT | `/payment-gateway/config` | `{apiKey?, webhookSigningSecret?, webhookToken?}` | `{data:{message}}` | admin+ | simpan terenkripsi; field kosong = pertahankan nilai lama |
| POST | `/payment-gateway/test` | — | `{data:{connected}}` | admin+ | tes koneksi ke `api-pay.sumopod.com` (butuh API Key) |
| POST | `/payment-gateway/create-payment` | `{orderId, amount, expiresInHours?}` | `{data:{paymentId, paymentLinkUrl, fee, netAmount}}` | admin+ | memanggil `POST https://api-pay.sumopod.com/api/v1/payments` dengan header `X-Api-Key`; body `{order_id, amount, currency:"IDR", expires_in_hours, payment_method_type_code:"QRIS"}`; simpan `payment_id` ke `payments.gateway_ref` |

**Tabel baru:** `payment_gateway_config` (single-row): `id`, `api_key`, `webhook_signing_secret`, `webhook_token`, `updated_at`. Semua secret disimpan terenkripsi; GET mengembalikan masked.

---

## 8. Business Logic & Transaksi

### 8.1 Flow Pembayaran QRIS (SumoPod gateway)
```
# 1) Buat payment link (saat invoice QRIS dibuat / dari menu invoice)
POST https://api-pay.sumopod.com/api/v1/payments
  Header: X-Api-Key: <api_key>
  Body: { order_id: "INV-1038", amount: 150000, currency: "IDR",
          expires_in_hours: 24, payment_method_type_code: "QRIS" }
  → { payment_id, payment_link_url, fee, net_amount, status: "pending" }
  → simpan payment_id → payments.gateway_ref; payment_link_url → dikirim ke pelanggan

# 2) Webhook SumoPod → sukses
POST /webhook/payment  (raw body + svix headers / X-Webhook-Token)
  → verifikasi signature (Svix HMAC-SHA256 ATAU webhook token)
  → idempotent: jika gateway_ref (payment_id) sudah diproses → 200 tanpa eksekusi
  → event = payment.completed
      → UPDATE payments SET status='Sukses' WHERE gateway_ref=?
      → UPDATE customers SET expiry_at = addMonthsToExpiry(expiry_at,1), status='Active'
      → UPDATE invoices SET status='Paid', payment_method='QRIS', payment_code=?
      → INSERT activity_logs ('Sistem','Webhook payment', order_id)
      → INSERT notification_logs (type='payment', Terkirim)
  → event = payment.failed | payment.expired
      → UPDATE payments SET status='Ditolak'
  → event = payment.test → balas 200 saja
```
**Satu transaksi (BEGIN/COMMIT)** — jika salah satu gagal, semua rollback. Balas `2xx` dalam 10 detik.

### 8.2 Flow Pembayaran Tunai (admin)
```
POST /invoices/:id/mark-paid {method:'Tunai'}
  → (transaction)
      → buat payment PY-xxxx (Tunai, Sukses, amount=invoice.amount)
      → UPDATE invoices SET status='Paid', payment_method='Tunai', payment_code=PY-xxxx
      → extendExpiry(customer, 1) + status Active
      → INSERT activity_logs
      → INSERT notification_logs (type='payment')
  → return {invoice, payment}
```

### 8.3 Generate Voucher Hotspot
```
POST /hotspot/vouchers/generate
  → ambil profile (duration_hours, dst)
  → loop count kali:
      code = generateCode(format)          # format persis frontend
      username = usernameEqualsPassword ? code : `${prefix}${code}`
      jika username sudah ada → generate ulang (guard max count*200)
      password = usernameEqualsPassword ? code : generateCode(format)
      valid_until = now + duration_hours
      status = 'Belum Terpakai'
  → INSERT N baris (batch) dalam 1 transaksi
```

### 8.4 Isolir / Unisolir
```
POST /network/isolir/:id {isolate:true}
  → status='Isolated' + tulis activity_logs (aktor admin)
POST /network/isolir/:id {isolate:false}
  → status='Active' + activity_logs
```

### 8.5 Perpanjang Masa Aktif (umum)
```
addMonthsToExpiry(expiry, months):
  parse "10 September 2026" → (y, m-1, d) → new Date(y, m+months-1, d)
```
Dipakai di: webhook QRIS, mark-paid Tunai, `POST /customers/:id/extend`, approve payment.

---

## 9. Generator Kode Human-Readable

Semua kode dibuat dengan pola `PREFIX-number` di mana number = **nilai maksimum yang ada + 1** (bukan panjang list), di dalam transaksi untuk mencegah race:

| Prefix | Contoh | Modul |
|---|---|---|
| `CUST-` | CUST-1001 | customers |
| `PKG-` | PKG-01 | packages |
| `INV-` | INV-1038 | invoices |
| `PY-` | PY-1011 | payments |
| `TCK-` | TCK-1042 | tickets |
| `NT-` | NT-1012 | notification_logs |
| `TPL-` | TPL-001 | wa_templates |

Query: `SELECT MAX(CAST(SUBSTRING(code, LENGTH(prefix)+1) AS UNSIGNED)) FROM tabel` → +1.

---

## 10. Scheduler (node-cron)

| Cron | Waktu | Aksi |
|---|---|---|
| `0 0 1 * *` | Tanggal 1 tiap bulan (sesuai billing_cycle) | Generate invoice bulanan untuk semua customer aktif (`invoice.job.ts`) |
| `0 1 * * *` | Setiap hari 01:00 WIB | Tandai invoice melewati jatuh tempo → `Overdue` |
| `0 2 * * *` | Setiap hari 02:00 WIB | Isolir customer yg grace period terlampaui (`isolir.job.ts`) + tulis log + notifikasi |
| `0 8 * * *` | Setiap hari 08:00 WIB | Kirim reminder tagihan (H-3 jatuh tempo) → notification_logs |
| `*/15 * * * *` | Setiap 15 menit | Update voucher hotspot: valid_until < now → `Expired` |

---

## 11. Non-Functional Requirements

### 11.1 Keamanan
- Password selalu `bcryptjs` hash (tidak pernah plaintext di DB/respons).
- JWT secret dari env `JWT_SECRET`, exp 8 jam.
- Rate-limit login (`/auth/login`) maks 5 percobaan/menit/IP.
- CORS origin dibatasi via env `CORS_ORIGIN` (default `http://localhost:5173`).
- `apiKey` WA Gateway disimpan terenkripsi; GET config mengembalikan masked (`****`).
- Kredensial SumoPod (`api_key`, `webhook_signing_secret`, `webhook_token`) disimpan terenkripsi di `payment_gateway_config`; GET mengembalikan masked.
- Validasi zod di semua body/params/query → 400 dengan pesan Indonesia (konsisten frontend).
- Webhook SumoPod divalidasi **raw body** via Svix signature (HMAC-SHA256) ATAU `X-Webhook-Token`; env `SUMODOP_WEBHOOK_SECRET` & `SUMODOP_WEBHOOK_TOKEN`; endpoint wajib merespons 2xx ≤ 10 detik dan idempotent per `payment_id`.

### 11.2 Performa & Keandalan
- Index pada kolom pencarian/filter: `customers.code`, `customers.name`, `customers.status`, `invoices.status`, `payments.status`, `tickets.status`, `hotspot_users.username`.
- Koneksi DB via pool `mysql2` (max 10).
- Semua operasi multi-langkah (mark-paid, approve, generate voucher) dibungkus transaksi.
- Timezone server `Asia/Jakarta`; simpan `DATETIME` WIB.

### 11.3 Dokumentasi
- Swagger/OpenAPI otomatis di `/docs` (fastify-swagger-ui).
- Setiap route terannotasi schema zod → docs selalu sinkron.

### 11.4 Logging
- Pino JSON logs; level `info` default, `debug` saat development.
- Log request: method, path, status, duration.

---

## 12. Mapping Tabel Database → Modul API

| Tabel (database-schema.md) | Dipakai oleh endpoint |
|---|---|
| `users` | `/auth/*`, `/users/*` |
| `packages` | `/packages/*` |
| `routers` | `/routers/*`, `POST /network/isolir/:id` (router_id) |
| `customers` | `/customers/*`, `/invoices/*`, `/payments/*`, `/dashboard/*` |
| `invoices` | `/invoices/*`, `/payments/:id/approve`, webhook |
| `payments` | `/payments/*`, webhook, `mark-paid` |
| `tickets` | `/tickets/*` |
| `ticket_timeline` | `PUT /tickets/:id/status`, `POST /tickets/:id/notes` |
| `hotspot_profiles` | `/hotspot/profiles/*`, `/hotspot/vouchers/generate` |
| `hotspot_users` | `/hotspot/users/*`, `/hotspot/vouchers/generate` |
| `voucher_templates` | `/hotspot/templates/*` |
| `hotspot_settings` | `/hotspot/settings` |
| `wa_templates` | `/wa-gateway/templates/*` |
| `wa_api_config` | `/wa-gateway/config`, `/wa-gateway/status`, `/wa-gateway/test` |
| `notification_logs` | `/notifications/*`, `/wa-gateway/send`, `POST /notifications/:id/resend` |
| `activity_logs` | `/activity-logs` |
| `app_settings` | `/settings/*` |
| `payment_gateway_config` | `/payment-gateway/*` (kredensial SumoPod) |

---

## 13. Contoh Alur End-to-End

### 13.1 Login → JWT
1. `POST /api/auth/login {email:'admin@rtrw.net', password:'admin123'}` → `{token, user:{id:1,name:'Admin',role:'super_admin'}}`
2. Frontend simpan ke authStore (localStorage) → semua request bawa `Authorization: Bearer <token>`.
3. Token expired → backend 401 → frontend interceptor logout → `/login`.

### 13.2 Pembayaran QRIS (otomatis via SumoPod)
1. Invoice dibuat → backend panggil `POST /api/v1/payments` SumoPod (header `X-Api-Key`) → dapat `payment_link_url` → link dikirim ke pelanggan (WA).
2. Pelanggan bayar via QRIS → SumoPod kirim webhook `payment.completed` ke `POST /api/webhook/payment`.
3. Backend verifikasi Svix signature (raw body) atau `X-Webhook-Token` → cek idempotent `payment_id` → (1 transaksi) payment `Sukses` → invoice `Paid (QRIS)` → masa aktif +1 bulan → notifikasi terkirim.
4. Admin buka `/admin/payments` → payment tampil Sukses, badge pending berkurang; invoice lunas di `/admin/invoices`.

### 13.3 Pembayaran Tunai (manual)
1. Admin buka `/admin/invoices` → invoice unpaid → "Terima Pembayaran Tunai".
2. `POST /api/invoices/:id/mark-paid {method:'Tunai'}`.
3. Backend (1 transaksi): buat `PY-xxxx` → invoice `Paid (Tunai)` → masa aktif +1 bulan.
4. Frontend toast "Pembayaran berhasil… masa aktif diperpanjang 1 bulan." (persis pesan saat ini).

---

## 14. Lampiran: Ringkasan Perubahan vs Frontend Saat Ini

| Aspek | Frontend (simulasi store) | Backend (PRD ini) |
|---|---|---|
| Data customer | Context store (useReducer) + string packageName/router | DB + FK `package_id`/`router_id` (respons tetap `packageName`/`routerName` via JOIN) |
| Pembayaran | 3 store terpisah (payment/invoice/customer) | 1 endpoint transaksional (`mark-paid`, `approve`, webhook) |
| Kode human-readable | `max+1` di zustand | `MAX+1` di SQL (dalam transaksi) |
| Persistensi | useState/zustand (reset saat reload) | MySQL (persisten) |
| Auth | localStorage + simulasi | JWT + bcrypt |

