/* ----------------------------------------------------------------
   Hotspot Mikrotik — types, seed data & generator kode voucher
   ---------------------------------------------------------------- */

import { MONTHS_ID } from "@/lib/dateUtils"

/* ---------- format kode voucher ---------- */

export type CodeFormat =
  | "ABCD123"
  | "abcd123"
  | "AbcD123"
  | "ABCDEFG"
  | "abcdefg"
  | "123456"

export const CODE_FORMATS: CodeFormat[] = [
  "ABCD123",
  "abcd123",
  "AbcD123",
  "ABCDEFG",
  "abcdefg",
  "123456",
]

/** Huruf tanpa I/O (dan i/l/o) agar kode mudah dibaca di voucher. */
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
const LOWER = "abcdefghjkmnpqrstuvwxyz"
const DIGIT = "0123456789"

function rand(chars: string): string {
  return chars[Math.floor(Math.random() * chars.length)]
}

/** Generate kode acak mengikuti pola format (mis. "ABCD123" = 3 huruf + 3 angka). */
export function generateCode(format: CodeFormat): string {
  switch (format) {
    case "ABCD123":
      return `${rand(UPPER)}${rand(UPPER)}${rand(UPPER)}${rand(DIGIT)}${rand(DIGIT)}${rand(DIGIT)}`
    case "abcd123":
      return `${rand(LOWER)}${rand(LOWER)}${rand(LOWER)}${rand(DIGIT)}${rand(DIGIT)}${rand(DIGIT)}`
    case "AbcD123":
      return `${rand(UPPER)}${rand(LOWER)}${rand(LOWER)}${rand(UPPER)}${rand(DIGIT)}${rand(DIGIT)}${rand(DIGIT)}`
    case "ABCDEFG":
      return Array.from({ length: 7 }, () => rand(UPPER)).join("")
    case "abcdefg":
      return Array.from({ length: 7 }, () => rand(LOWER)).join("")
    case "123456":
      return Array.from({ length: 6 }, () => rand(DIGIT)).join("")
  }
}

/* ---------- tipe data ---------- */

export type HotspotUserStatus = "Aktif" | "Belum Terpakai" | "Expired"

export interface HotspotUser {
  id: string
  username: string
  password: string
  profileId: string
  price: number
  /** "10 September 2026 14:30" */
  validUntil: string
  status: HotspotUserStatus
  createdAt: string
}

export interface HotspotProfile {
  id: string
  name: string
  durationHours: number
  durationLabel: string
  price: number
  downloadSpeed: number
  uploadSpeed: number
  sharedUsers: number
  /** menit */
  sessionTimeout: number
  status: "Aktif" | "Nonaktif"
  createdAt: string
}

export type HotspotProfileInput = Omit<HotspotProfile, "id" | "createdAt">

export interface VoucherTemplate {
  id: string
  name: string
  html: string
  isDefault: boolean
  updatedAt: string
}

export interface HotspotSettings {
  serverUrl: string
  apiPort: number
  apiUser: string
  apiPassword: string
  companyName: string
  currency: string
  loginPageUrl: string
  voucherPrefix: string
  autoSync: boolean
}

/** Ganti semua placeholder ({username}, {password}, dst) dengan nilai nyata. */
export function fillTemplate(
  html: string,
  overrides: Record<string, string> = {}
): string {
  const vars: Record<string, string> = {
    username: "ABC123",
    password: "ABC123",
    profile: "1 Hari",
    duration: "1 Hari",
    price: "Rp 15.000",
    valid_until: "11 Agustus 2026 09:00",
    company: "RTRW NET",
    ...overrides,
  }
  let out = html
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(v)
  return out
}

/* ---------- helper tanggal ("10 September 2026 14:30") ---------- */

export function formatIdDateTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm}`
}

export function addHoursToNow(hours: number): string {
  const d = new Date()
  d.setHours(d.getHours() + hours)
  return formatIdDateTime(d)
}

/** Label durasi dari jam: 1→"1 Jam", 24→"1 Hari", 168→"1 Minggu", 720→"1 Bulan" */
export function durationLabelFromHours(h: number): string {
  if (h === 1) return "1 Jam"
  if (h === 24) return "1 Hari"
  if (h === 168) return "1 Minggu"
  if (h === 720) return "1 Bulan"
  if (h === 8760) return "1 Tahun"
  return `${h} Jam`
}

/* ---------- seed: profile ---------- */

export const seedProfiles: HotspotProfile[] = [
  {
    id: "pr-1",
    name: "1 Jam",
    durationHours: 1,
    durationLabel: "1 Jam",
    price: 5000,
    downloadSpeed: 5,
    uploadSpeed: 5,
    sharedUsers: 1,
    sessionTimeout: 60,
    status: "Aktif",
    createdAt: "10 Januari 2025",
  },
  {
    id: "pr-2",
    name: "1 Hari",
    durationHours: 24,
    durationLabel: "1 Hari",
    price: 15000,
    downloadSpeed: 10,
    uploadSpeed: 10,
    sharedUsers: 1,
    sessionTimeout: 360,
    status: "Aktif",
    createdAt: "10 Januari 2025",
  },
  {
    id: "pr-3",
    name: "1 Minggu",
    durationHours: 168,
    durationLabel: "1 Minggu",
    price: 50000,
    downloadSpeed: 10,
    uploadSpeed: 10,
    sharedUsers: 2,
    sessionTimeout: 720,
    status: "Aktif",
    createdAt: "15 Februari 2025",
  },
  {
    id: "pr-4",
    name: "1 Bulan",
    durationHours: 720,
    durationLabel: "1 Bulan",
    price: 150000,
    downloadSpeed: 20,
    uploadSpeed: 20,
    sharedUsers: 3,
    sessionTimeout: 1440,
    status: "Aktif",
    createdAt: "01 Maret 2025",
  },
]

/* ---------- seed: user / voucher ---------- */

export const seedUsers: HotspotUser[] = [
  { id: "u1", username: "ABC123", password: "ABC123", profileId: "pr-2", price: 15000, validUntil: "11 Agustus 2026 09:30", status: "Aktif", createdAt: "10 Agustus 2026 09:30" },
  { id: "u2", username: "xyz456", password: "xyz456", profileId: "pr-3", price: 50000, validUntil: "17 Agustus 2026 10:00", status: "Aktif", createdAt: "10 Agustus 2026 10:00" },
  { id: "u3", username: "XyZ789", password: "XyZ789", profileId: "pr-4", price: 150000, validUntil: "10 September 2026 11:15", status: "Aktif", createdAt: "10 Agustus 2026 11:15" },
  { id: "u4", username: "KLMNOPQ", password: "KLMNOPQ", profileId: "pr-2", price: 15000, validUntil: "12 Agustus 2026 08:00", status: "Belum Terpakai", createdAt: "10 Agustus 2026 08:00" },
  { id: "u5", username: "qrstuvw", password: "qrstuvw", profileId: "pr-1", price: 5000, validUntil: "9 Agustus 2026 13:20", status: "Expired", createdAt: "9 Agustus 2026 13:20" },
  { id: "u6", username: "123456", password: "123456", profileId: "pr-1", price: 5000, validUntil: "12 Agustus 2026 14:00", status: "Belum Terpakai", createdAt: "10 Agustus 2026 14:00" },
  { id: "u7", username: "HS-ABC123", password: "def456", profileId: "pr-4", price: 150000, validUntil: "10 September 2026 15:45", status: "Aktif", createdAt: "10 Agustus 2026 15:45" },
  { id: "u8", username: "xyz789", password: "xyz789", profileId: "pr-3", price: 50000, validUntil: "18 Agustus 2026 09:10", status: "Belum Terpakai", createdAt: "10 Agustus 2026 09:10" },
  { id: "u9", username: "DEF456", password: "DEF456", profileId: "pr-1", price: 5000, validUntil: "8 Agustus 2026 18:30", status: "Expired", createdAt: "8 Agustus 2026 18:30" },
  { id: "u10", username: "GHI789", password: "GHI789", profileId: "pr-2", price: 15000, validUntil: "13 Agustus 2026 07:25", status: "Belum Terpakai", createdAt: "10 Agustus 2026 07:25" },
]

/* ---------- seed: template voucher (HTML) ---------- */

export const seedTemplates: VoucherTemplate[] = [
  {
    id: "tpl-1",
    name: "Klasik",
    isDefault: true,
    updatedAt: "10 Agustus 2026 09:00",
    html: `<div style="width:260px;border:2px solid #1e3a8a;border-radius:12px;padding:16px;font-family:Arial,sans-serif;color:#0f172a;background:#ffffff;">
  <div style="text-align:center;border-bottom:2px dashed #e2e8f0;padding-bottom:10px;margin-bottom:10px;">
    <div style="font-size:20px;font-weight:800;color:#1e3a8a;letter-spacing:1px;">{company}</div>
    <div style="font-size:11px;color:#64748b;margin-top:2px;">Voucher Hotspot Internet</div>
  </div>
  <table style="width:100%;font-size:12px;border-collapse:collapse;">
    <tr><td style="color:#64748b;padding:3px 0;">Username</td><td style="font-weight:700;text-align:right;font-family:Consolas,monospace;letter-spacing:1px;">{username}</td></tr>
    <tr><td style="color:#64748b;padding:3px 0;">Password</td><td style="font-weight:700;text-align:right;font-family:Consolas,monospace;letter-spacing:1px;">{password}</td></tr>
    <tr><td style="color:#64748b;padding:3px 0;">Paket</td><td style="font-weight:700;text-align:right;">{profile}</td></tr>
    <tr><td style="color:#64748b;padding:3px 0;">Durasi</td><td style="font-weight:700;text-align:right;">{duration}</td></tr>
    <tr><td style="color:#64748b;padding:3px 0;">Harga</td><td style="font-weight:700;text-align:right;">{price}</td></tr>
    <tr><td style="color:#64748b;padding:3px 0;">Berlaku s/d</td><td style="font-weight:700;text-align:right;">{valid_until}</td></tr>
  </table>
</div>`,
  },
  {
    id: "tpl-2",
    name: "Modern",
    isDefault: false,
    updatedAt: "10 Agustus 2026 09:05",
    html: `<div style="width:260px;border-radius:16px;overflow:hidden;font-family:Arial,sans-serif;color:#ffffff;background:linear-gradient(135deg,#0f766e,#134e4a);">
  <div style="padding:14px 16px;background:rgba(255,255,255,0.12);text-align:center;">
    <div style="font-size:18px;font-weight:800;letter-spacing:1px;">{company}</div>
    <div style="font-size:10px;opacity:.8;margin-top:2px;">INTERNET VOUCHER</div>
  </div>
  <div style="padding:14px 16px;">
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px dashed rgba(255,255,255,.25);"><span style="opacity:.75;">Username</span><span style="font-family:Consolas,monospace;font-weight:700;letter-spacing:1px;">{username}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px dashed rgba(255,255,255,.25);"><span style="opacity:.75;">Password</span><span style="font-family:Consolas,monospace;font-weight:700;letter-spacing:1px;">{password}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px dashed rgba(255,255,255,.25);"><span style="opacity:.75;">Paket</span><span style="font-weight:700;">{profile}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px dashed rgba(255,255,255,.25);"><span style="opacity:.75;">Durasi</span><span style="font-weight:700;">{duration}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px dashed rgba(255,255,255,.25);"><span style="opacity:.75;">Harga</span><span style="font-weight:700;">{price}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;"><span style="opacity:.75;">Berlaku s/d</span><span style="font-weight:700;">{valid_until}</span></div>
  </div>
</div>`,
  },
  {
    id: "tpl-3",
    name: "Minimalis",
    isDefault: false,
    updatedAt: "10 Agustus 2026 09:10",
    html: `<div style="width:260px;border:1px solid #cbd5e1;border-radius:8px;padding:16px;font-family:Arial,sans-serif;color:#1e293b;">
  <div style="text-align:center;font-size:14px;font-weight:700;letter-spacing:2px;color:#334155;">VOUCHER HOTSPOT</div>
  <div style="margin-top:10px;font-size:12px;line-height:1.9;">
    <div>Username&nbsp;: <b style="font-family:Consolas,monospace;">{username}</b></div>
    <div>Password&nbsp;: <b style="font-family:Consolas,monospace;">{password}</b></div>
    <div>Paket&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {profile} ({duration})</div>
    <div>Harga&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: {price}</div>
    <div>Berlaku&nbsp;&nbsp;&nbsp;: {valid_until}</div>
  </div>
  <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #cbd5e1;text-align:center;font-size:10px;color:#94a3b8;">{company}</div>
</div>`,
  },
]

/* ---------- seed: pengaturan ---------- */

export const defaultSettings: HotspotSettings = {
  serverUrl: "http://192.168.1.1",
  apiPort: 8728,
  apiUser: "admin",
  apiPassword: "",
  companyName: "RTRW NET",
  currency: "Rp",
  loginPageUrl: "http://192.168.1.1/login",
  voucherPrefix: "HS-",
  autoSync: true,
}
