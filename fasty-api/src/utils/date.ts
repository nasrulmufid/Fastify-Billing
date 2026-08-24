/**
 * Util tanggal — format id-ID & perhitungan masa aktif (WIB).
 */

export const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
]

/** Format Date -> "10 September 2026" */
export function formatIdDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`
}

/** Format Date -> "10 September 2026, 14.30" */
export function formatIdDateTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${formatIdDate(d)}, ${hh}.${mm}`
}

/** "10 September 2026" -> Date (parse bulan Indonesia) */
export function parseIdDate(dateStr: string): Date | null {
  const parts = dateStr.trim().split(/\s+/)
  if (parts.length !== 3) return null
  const day = Number(parts[0])
  const month = MONTHS_ID.indexOf(parts[1]) + 1
  const year = Number(parts[2])
  if (!day || !month || !year) return null
  return new Date(year, month - 1, day)
}

/**
 * Tambah N bulan ke expiry (preserve day) — persis logika addMonthsToExpiry frontend.
 * @param expiryStr "10 September 2026"
 */
export function addMonthsToExpiry(expiryStr: string, months: number): string {
  const d = parseIdDate(expiryStr)
  if (!d) {
    // fallback: gunakan hari ini
    const now = new Date()
    return formatIdDate(new Date(now.getFullYear(), now.getMonth() + months, now.getDate()))
  }
  return formatIdDate(new Date(d.getFullYear(), d.getMonth() + months, d.getDate()))
}

/** "10 September 2026" -> "2026-09-10" (untuk input date / simpan DATETIME) */
export function toISODate(dateStr: string): string | null {
  const d = parseIdDate(dateStr)
  if (!d) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** "2026-09-10" ATAU "2026-09-10 00:00:00" -> "10 September 2026" */
export function fromISODate(iso: string | null | undefined): string {
  if (!iso) return ""
  const datePart = String(iso).split(" ")[0] // ambil "YYYY-MM-DD" saja
  const d = new Date(`${datePart}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ""
  return formatIdDate(d)
}

/** Date -> "YYYY-MM-DD HH:mm:ss" untuk disimpan ke DATETIME MySQL */
export function toDbDateTime(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  const ss = String(d.getSeconds()).padStart(2, "0")
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`
}

/** Hari ini format id-ID ("20 Agustus 2026") */
export function todayId(): string {
  return formatIdDate(new Date())
}
