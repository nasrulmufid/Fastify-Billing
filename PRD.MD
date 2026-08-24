# Product Requirements Document (PRD)
## Frontend Admin Dashboard — Aplikasi Billing RT/RW Net

---

## 1. Document Control

| Item | Detail |
|---|---|
| Judul Dokumen | PRD Frontend Admin Dashboard — Billing RT/RW Net |
| Versi | 1.0 |
| Tech Stack | Vite, React 18+, TypeScript, Tailwind CSS, shadcn/ui |
| Backend API | Fastify REST API (sesuai Backend PRD) |
| Author / Owner | Frontend Engineering Team |

---

## 2. Overview / Executive Summary

**Nama Produk:** Frontend Admin Dashboard RTRW-Billing

**Ringkasan:** Dokumen ini merupakan spesifikasi kebutuhan antarmuka (frontend) untuk Admin Dashboard aplikasi Billing RT/RW Net. Dashboard ini digunakan oleh Admin, Teknisi, dan Reseller untuk mengelola operasional ISP seperti pelanggan, paket, tagihan, tiket gangguan, voucher, jaringan (Mikrotik/FreeRADIUS), dan notifikasi WhatsApp/Telegram.

**UI/UX Framework:** Proyek ini akan menggunakan **React** dengan build tool **Vite**, **Tailwind CSS** untuk styling, dan **shadcn/ui** sebagai komponen dasar (primitives). Pemilihan `shadcn/ui` ditujukan untuk membangun antarmuka yang bersih, modern, dan sangat dapat dikustomisasi, sekaligus memastikan aksesibilitas (a11y) yang baik.

---

## 3. Tech Stack & Libraries

### 3.1 Core Framework
- **Framework:** React 18+ (Functional Components & Hooks)
- **Build Tool:** Vite
- **Bahasa:** TypeScript (Strict Mode)

### 3.2 Styling & UI Components
- **Styling:** Tailwind CSS
- **Component Library:** shadcn/ui (berbasis Radix UI)
- **Icons:** Lucide React
- **Theming:** Dark Mode default (mendukung Light/Dark toggle dengan CSS variables)

### 3.3 State Management & Data Fetching
- **Server State / API Fetching:** React Query (TanStack Query) — untuk caching, sinkronisasi, dan background updates.
- **Client State / Global State:** Zustand — ringan dan mudah digunakan (jika diperlukan untuk state UI global seperti toggle sidebar, auth user data).
- **HTTP Client:** Axios atau native Fetch API (dibungkus dalam service/client singleton).

### 3.4 Routing & Forms
- **Router:** React Router v6
- **Form Handling:** React Hook Form
- **Form Validation:** Zod (terintegrasi dengan shadcn/ui forms)

### 3.5 Utilities
- **Data Table:** TanStack Table v8 (terintegrasi dengan shadcn/ui data-table)
- **Charts:** Recharts (terintegrasi dengan shadcn/ui charts)
- **Date Formatting:** date-fns atau dayjs
- **Notifications/Toasts:** Sonner atau shadcn/ui toast

---

## 4. Architecture & Folder Structure

Struktur folder akan menggunakan pendekatan berbasis fitur (feature-based) yang modular:

```text
src/
├── assets/         # Gambar, SVG, font statis
├── components/     # Komponen global (ui/ untuk shadcn, custom/ untuk komponen aplikasi)
│   ├── ui/         # Komponen shadcn/ui (Button, Input, Card, dll.)
│   └── shared/     # Header, Sidebar, Layout wrappers
├── hooks/          # Custom React hooks (useAuth, useTheme, dll.)
├── lib/            # Utilities (shadcn cn, axios instance, helpers)
├── pages/          # Komponen representasi halaman/route
│   ├── auth/       # Login, Forgot Password
│   ├── dashboard/  # Main Dashboard
│   ├── customers/  # Customer list, detail, form
│   ├── invoices/   # Invoice list, detail
│   └── ...
├── services/       # API call wrappers per modul (customersApi.ts, authApi.ts)
├── store/          # Zustand store definitions (authStore.ts, appStore.ts)
├── types/          # TypeScript interfaces/types global
├── App.tsx         # Main application component & Router config
└── main.tsx        # Entry point
```

---

## 5. UI/UX Design Guidelines

### 5.1 Tema & Warna (Theming)
- Tema akan menggunakan CSS variables standar dari `shadcn/ui`.
- **Warna Utama (Primary):** Biru profesional (misalnya Slate-900 di Light, Blue-500 di Dark).
- **Warna Netral:** Slate atau Gray tailwind.
- **Warna Status:** 
  - Success: Emerald/Green
  - Warning: Amber/Yellow
  - Danger: Rose/Red
  - Info: Blue/Sky
- **Border Radius:** Radius standar moderat (`var(--radius) = 0.5rem` / 8px).

### 5.2 Tata Letak (Layout)
- **Desktop:** Layout klasik Dashboard dengan Sidebar di kiri (collapsible) dan Top Header (berisi search global, notifikasi, profil).
- **Mobile/Tablet:** Sidebar tersembunyi menjadi Hamburger Menu (Sheet component dari shadcn) atau Bottom Navigation untuk akses cepat operasional.
- **Tabel Data:** Menggunakan pagination, filter, dan sort pada sisi server. Kolom action berada di ujung kanan (dropdown menu).

---

## 6. Fitur & Kebutuhan Halaman (Pages / Views)

### 6.1 Authentication & Profile
- **Halaman Login:** Form login dengan validasi email/password (Zod + React Hook Form).
- **Lupa Password:** Form reset password.
- **Layout Profil:** Dropdown menu di header (shadcn DropdownMenu) untuk ubah profile, ganti password, logout.

### 6.2 Dashboard Utama
- **Overview Metrics:** Komponen `Card` (shadcn) menampilkan Total Pelanggan, Pelanggan Aktif, Total Pemasukan, dan Tagihan Tertunggak.
- **Grafik (Recharts):** 
  - Bar/Area Chart untuk tren Pemasukan Bulanan.
  - Pie/Donut Chart untuk status pelanggan.
- **Aktivitas Terkini:** List/timeline log aktivitas sistem (pembayaran masuk, notifikasi isolir).

### 6.3 Customer Management
- **List Pelanggan:** `DataTable` dengan search bar, filter status (Aktif, Isolir), dan paginasi.
- **Detail Pelanggan:** Halaman atau `Sheet` (shadcn) yang memuat info personal, paket, status jaringan, wallet, dan riwayat tagihan.
- **Form Pelanggan (Tambah/Edit):** Form komprehensif menggunakan `Form` shadcn, mencakup informasi profil, lokasi (GPS), dan setelan PPPoE/Hotspot.
- **Aksi Cepat:** Tombol Isolir/Unisolir Manual (dengan konfirmasi `AlertDialog`).

### 6.4 Package & Layanan
- **List Paket:** Tampilan Grid `Card` atau Tabel untuk paket langganan.
- **Form Paket:** Input nama, kecepatan (Up/Down), harga, dan kuota/durasi.

### 6.5 Invoicing & Pembayaran
- **List Tagihan (Invoices):** Tabel dengan warna badge status (Paid = Hijau, Unpaid = Merah, Pending = Kuning).
- **Detail Tagihan:** Tampilan struk digital, lengkap dengan opsi cetak/PDF dan link pembayaran.
- **Approval Pembayaran Manual:** Tabel verifikasi bagi admin untuk mengecek bukti transfer yang diunggah pelanggan.
- **Payment Link Generate:** Aksi copy link dari Tripay payment (Fase 1).

### 6.6 Network & Router
- **Manajemen Router:** Tabel daftar router Mikrotik/Radius.
- **Form Router:** Input IP, kredensial, provider type.
- **Uji Koneksi:** Tombol aksi yang memanggil API test connection dan menampilkan `Toast` (sukses/gagal).

### 6.7 Notifikasi (WhatsApp & Telegram)
- **Pengaturan WhatsApp:** Card status GOWA (Connected/Disconnected) beserta tombol login ulang/scan QR.
- **Template Pesan:** Tabel daftar template WhatsApp. Form pengeditan template dengan integrasi variabel dinamis (mis: `{name}`, `{amount}`).
- **Log Pengiriman:** Tabel histori pesan keluar.

### 6.8 Tiket Gangguan (Support)
- **Kanban / Tabel Tiket:** Tampilan daftar tiket gangguan (Open, In Progress, Resolved).
- **Detail Tiket:** Chat interface (mirip komentar) antara teknisi dan pelanggan.

---

## 7. Shadcn UI Components to Install

Daftar komponen dari `shadcn-ui` yang wajib diinstal (`npx shadcn@latest add <component>`):

**Layout & Navigation:**
- `accordion` (FAQ / Settings)
- `alert-dialog` (Konfirmasi delete/isolir)
- `avatar` (Profile icon)
- `card` (Dashboard widgets)
- `dropdown-menu` (Action menus di tabel, Profil dropdown)
- `sheet` (Mobile sidebar, Customer detail panel)
- `tabs` (Navigasi antar kategori form/detail)
- `separator` (Pemisah garis)

**Data Entry & Forms:**
- `form` (Form wrapper dengan React Hook Form)
- `input` (Teks, email, password)
- `select` (Dropdown pilihan paket/router)
- `textarea` (Deskripsi tiket, template WA)
- `checkbox` / `switch` (Toggle status, setting true/false)
- `date-picker` / `calendar` (Pemilihan tanggal expired/due date)

**Data Display:**
- `table` (List data)
- `badge` (Status Aktif/Isolir/Paid)
- `toast` / `sonner` (Notifikasi aksi berhasil/gagal)
- `skeleton` (Loading state)
- `dialog` (Modal form kecil)

---

## 8. Integrasi & Deployment

### 8.1 API Integration
- Semua koneksi ke backend harus melalui instance `axios` tersentralisasi yang otomatis menyisipkan Authorization Bearer Token.
- Error handling API (contoh: 401 Unauthorized) harus otomatis meredirect user ke halaman login dan membersihkan session lokal (Zustand/Local Storage).

### 8.2 Environment Variables
- `VITE_API_BASE_URL`: URL utama backend Fastify (contoh: `http://localhost:3000/api/v1`).
- `VITE_APP_NAME`: Nama aplikasi (contoh: "Billing RTRW Pro").

### 8.3 CI/CD & Build
- Menjalankan `npm run build` yang memanggil proses build Vite (Rollup).
- Output akan berada di direktori `dist/` dan dioptimalkan secara statis (SPA).
- Pendeployan dapat dihosting pada container Nginx, Vercel, Netlify, atau secara statis disajikan melalui Fastify backend itu sendiri.

---

## 9. Next Steps

1. Setup proyek awal menggunakan `npm create vite@latest frontend -- --template react-ts`.
2. Inisialisasi Tailwind CSS dan instalasi `shadcn-ui`.
3. Konstruksi Layout Utama (Sidebar, Header, Main Canvas).
4. Pembuatan komponen reusable (Data Table dengan pagination, Form wrapper).
5. Implementasi integrasi API menggunakan React Query per modul (dimulai dari Auth dan Customer).
