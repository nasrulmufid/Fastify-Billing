# Spesifikasi Teknikal Frontend (Frontend Engineering Specification)
## Aplikasi Admin Dashboard — Billing RT/RW Net

---

## 1. Pengantar
Dokumen ini merupakan panduan spesifikasi teknikal bagi tim Frontend Engineer untuk membangun antarmuka Admin Dashboard. Dokumen ini merinci arsitektur, struktur halaman, pemetaan komponen UI (menggunakan `shadcn/ui`), manajemen state, dan integrasi API.

---

## 2. Arsitektur Dasar & Tech Stack

- **Core:** React 18 (Functional & Hooks), TypeScript (Strict)
- **Build Tool:** Vite
- **Router:** `react-router-dom` v6
- **Styling:** Tailwind CSS + `shadcn/ui` (berbasis Radix UI)
- **Server State / Data Fetching:** `@tanstack/react-query` v5 + `axios`
- **Global / Client State:** `zustand` (untuk Auth state, Sidebar toggle, dll)
- **Form Handling & Validation:** `react-hook-form` + `@hookform/resolvers/zod` + `zod`
- **Tabel & Grafik:** `@tanstack/react-table` v8, `recharts`
- **Ikon:** `lucide-react`

---

## 3. Peta Rute (Route Map)

| Path | Halaman (Page Component) | Layout | Akses (Role) |
|---|---|---|---|
| `/login` | `LoginPage` | AuthLayout | Public |
| `/` (Redirect ke `/dashboard`) | - | - | - |
| `/dashboard` | `DashboardPage` | AdminLayout | Admin / Super Admin |
| `/customers` | `CustomerListPage` | AdminLayout | Admin / Super Admin |
| `/customers/:id` | `CustomerDetailPage` | AdminLayout | Admin / Super Admin |
| `/packages` | `PackageListPage` | AdminLayout | Admin |
| `/invoices` | `InvoiceListPage` | AdminLayout | Admin / Finance |
| `/invoices/:id` | `InvoiceDetailPage` | AdminLayout | Admin / Finance |
| `/payments` | `PaymentListPage` | AdminLayout | Admin / Finance |
| `/network/routers` | `RouterListPage` | AdminLayout | Admin / Teknisi |
| `/support/tickets` | `TicketListPage` | AdminLayout | Admin / Teknisi |
| `/settings/whatsapp`| `WhatsAppSettingsPage` | AdminLayout | Super Admin |
| `/settings/general` | `GeneralSettingsPage`| AdminLayout | Super Admin |

---

## 4. Rincian Spesifikasi Halaman & Komponen

Bagian ini menjelaskan secara spesifik *komponen apa saja* yang ada di setiap halaman.

### 4.1 Layout Utama (`AdminLayout.tsx`)
Layout ini membungkus semua halaman yang membutuhkan autentikasi.
- **Sidebar (Kiri):**
  - Menggunakan komponen custom berbasis `ScrollArea` (shadcn).
  - Navigasi link menu (Dashboard, Pelanggan, Paket, Tagihan, Jaringan, Support, Pengaturan).
  - Highlight state aktif berdasarkan current route.
  - Tombol Collapse/Expand sidebar.
- **Top Header (Atas):**
  - **Global Search:** `Input` (shadcn) dengan ikon `Search` (Lucide) untuk mencari pelanggan/invoice.
  - **Notifikasi:** `DropdownMenu` (shadcn) menampilkan notifikasi sistem terbaru (bell icon).
  - **Theme Toggle:** `Button` (Ghost) untuk ganti Light/Dark mode.
  - **User Profile:** `DropdownMenu` menampilkan Avatar, Nama User, Role. Berisi opsi "My Profile" dan "Logout".
- **Main Canvas:** Area dinamis tempat `Outlet` dari react-router dirender.

### 4.2 Halaman Dashboard (`DashboardPage.tsx`)
Halaman ringkasan eksekutif dan pemantauan operasional harian.
- **Header Section:** Judul halaman ("Dashboard") dan `DateRangePicker` untuk filter rentang waktu data.
- **Stats Widgets (4 Kolom Grid):**
  - Menggunakan `Card` (shadcn).
  - Widget 1: **Total Pelanggan** (Angka besar, label, ikon users, presentase naik/turun).
  - Widget 2: **Pelanggan Aktif / Isolir** (Angka terpisah, warna badge berbeda).
  - Widget 3: **Pemasukan Bulan Ini** (Format Rupiah, ikon wallet/chart).
  - Widget 4: **Tagihan Tertunggak (Overdue)** (Warna text merah/`text-destructive`).
- **Charts Section (2 Kolom):**
  - **Grafik Pemasukan (Kiri - Lebar 2/3):** `Card` berisi komponen grafik `AreaChart` dari `recharts` menunjukkan tren 30 hari terakhir.
  - **Distribusi Paket (Kanan - Lebar 1/3):** `Card` berisi `PieChart` dari `recharts` (misal: 50% Paket 10Mbps, 30% Paket 20Mbps).
- **Tabel Aktivitas Terkini (Bottom Section):**
  - Menggunakan `Table` (shadcn).
  - Menampilkan 5-10 log terakhir (Kolom: Waktu, Aktivitas, User/Pelanggan, Status dengan `Badge`).

### 4.3 Halaman Pelanggan (`CustomerListPage.tsx` & `CustomerDetailPage.tsx`)

#### A. Customer List (`CustomerListPage.tsx`)
- **Page Header:** Judul "Daftar Pelanggan", tombol `Button` utama "+ Tambah Pelanggan" (membuka `Sheet` atau `Dialog`).
- **Filter Toolbar:**
  - `Input` Search (Berdasarkan Nama, ID, atau No HP).
  - `Select` (shadcn) untuk filter Status (Semua, Aktif, Isolir, Pending).
  - `Select` untuk filter Paket.
- **Data Table (`@tanstack/react-table` + shadcn `Table`):**
  - Kolom: ID, Nama Pelanggan, Kontak (WA), Paket, IP Address, Status (`Badge`: Hijau = Aktif, Merah = Isolir), Masa Aktif.
  - **Actions Column:** `DropdownMenu` (Ikon titik tiga) berisi:
    - 👁️ Lihat Detail (Navigate ke `/customers/:id`)
    - ✏️ Edit
    - 🔴 Isolir Manual / 🟢 Unisolir Manual (Memicu API call setelah konfirmasi `AlertDialog`)
    - 🗑️ Hapus
- **Pagination:** Kontrol halaman di bagian bawah tabel.

#### B. Customer Detail (`CustomerDetailPage.tsx`)
- **Header:** Nama Pelanggan, Status Badge, dan tombol kembali (`<- Kembali`).
- **Grid Layout (Kiri 1/3, Kanan 2/3):**
  - **Profile Card (Kiri):**
    - Info dasar (Email, No HP, Alamat).
    - Status Jaringan & IP.
    - Saldo Dompet (Wallet Balance) dengan tombol "Top Up".
  - **Detail Tabs (Kanan - shadcn `Tabs`):**
    - **Tab "Informasi Koneksi":** Card berisi form PPPoE User, Password, Mikrotik/Router assigned, Expiry Date. Ada form edit masa aktif (Extension).
    - **Tab "Riwayat Tagihan":** Tabel mini berisi invoice milik user ini saja.
    - **Tab "Riwayat Tiket":** Tabel keluhan/tiket gangguan milik user.

#### C. Form Tambah/Edit Pelanggan (`CustomerForm.tsx`)
- Biasanya dirender dalam `Sheet` (Slide-over dari kanan) atau Halaman tersendiri.
- Menggunakan `Form` (react-hook-form).
- Field:
  - Personal Info: Nama, Email, No HP (WA), Alamat.
  - Network Config: `Select` Paket, `Select` Router, PPPoE Username, PPPoE Password.
  - Custom Fields (opsional): Koordinat GPS, ID ODP.

### 4.4 Halaman Tagihan & Pembayaran (`InvoiceListPage.tsx`)
- **Page Header:** Judul "Data Tagihan", tombol "Generate Tagihan (Batch)".
- **Data Table:**
  - Kolom: No Invoice, Pelanggan, Periode, Nominal, Jatuh Tempo, Status (`Badge`: Paid, Unpaid, Overdue).
  - **Actions:** 
    - Lihat PDF Struk
    - Kirim Reminder WA (Trigger notifikasi manual)
    - Konfirmasi Pembayaran Manual (Jika Unpaid) -> Buka modal `Dialog`.

### 4.5 Halaman Router & Jaringan (`RouterListPage.tsx`)
- **Data Table:**
  - Kolom: Nama Router, IP Address, Tipe (Mikrotik/Radius), Status (Online/Offline), Sesi Aktif, Uptime.
  - **Actions:** Tombol "Test Connection" (Menjalankan mutasi API dan menampilkan `Toast` hasil ping/latency).
- **Dialog Tambah Router:** Form input IP, Port, API Username, API Password (disembunyikan).

### 4.6 Halaman Pengaturan WhatsApp (`WhatsAppSettingsPage.tsx`)
- **Grid Layout:**
  - **Koneksi Jembatan WA (Kiri):** `Card` menampilkan status instance GOWA. Jika terputus, tampilkan area/gambar QR Code (di-fetch dari API).
  - **Template Pesan (Kanan/Bawah):** `Tabs` untuk manajemen template (Tagihan Baru, Pengingat, Isolir).
  - Form editor menggunakan `Textarea` yang mendukung insersi variabel (`{name}`, `{bill_amount}`).
- **Log Pengiriman WA:** Tabel riwayat pesan (Kolom: Tujuan, Status Pengiriman, Waktu, Template).

---

## 5. Implementasi State Management & Integrasi API

### 5.1 Struktur Data Fetching (React Query)
Memisahkan hooks API di folder `/src/hooks/queries` dan `/src/hooks/mutations`.
- `useCustomers()`: Query fetch list dengan param (page, search, status).
- `useCustomer(id)`: Query fetch detail.
- `useCreateCustomer()`: Mutation POST ke `/customers`, on-success invalidate query `useCustomers`.
- `useIsolirCustomer()`: Mutation POST ke `/network/isolir/:id`, on-success tampilkan `Toast` (shadcn) sukses.

### 5.2 Global State (Zustand)
File: `/src/store/useAppStore.ts`
- `auth`: Menyimpan data user yang sedang login (ID, Name, Role, Token).
- `sidebarOpen`: Menyimpan state apakah sidebar sedang collapse atau tidak.

### 5.3 Error Handling & HTTP Client (Axios)
File: `/src/lib/axios.ts`
- Membuat Axios instance.
- **Request Interceptor:** Otomatis memasukkan Bearer Token dari Zustand store / localStorage ke header `Authorization`.
- **Response Interceptor:**
  - Jika 401 Unauthorized: Otomatis hapus token, panggil fungsi logout, dan redirect ke `/login`.
  - Global Error Toast: Jika status 500, panggil `toast.error("Terjadi kesalahan sistem")`.

---

## 6. Daftar Komponen `shadcn/ui` yang Wajib Diinstal

```bash
# Struktur dasar & layout
npx shadcn@latest add button card separator sheet tabs scroll-area

# Form & Input
npx shadcn@latest add form input textarea select checkbox switch date-picker

# Feedback & Overlay
npx shadcn@latest add dialog alert-dialog toast sonner badge avatar dropdown-menu

# Tabel & Data
npx shadcn@latest add table pagination skeleton chart
```

---
*Spesifikasi ini disusun untuk menjadi panduan kerja harian (daily reference) bagi Frontend Engineer dalam merangkai halaman, menghubungkan fungsionalitas React Hook Form, TanStack Table, dan React Query.*
