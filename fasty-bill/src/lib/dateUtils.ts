/* ----------------------------------------------------------------
   Date helpers (format penyimpanan tanggal: "10 September 2026")
   ---------------------------------------------------------------- */

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

/** "10 September 2026" -> "2026-09-10" (untuk input date) */
export function expiryToInputValue(dateStr: string): string {
  const parts = dateStr.trim().split(/\s+/)
  if (parts.length !== 3) return ""
  const day = Number(parts[0])
  const month = MONTHS_ID.indexOf(parts[1]) + 1
  const year = Number(parts[2])
  if (!day || !month || !year) return ""
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** "2026-09-10" (dari input date) -> "10 September 2026" */
export function inputToExpiry(value: string): string {
  if (!value) return ""
  const [y, m, d] = value.split("-").map(Number)
  return `${d} ${MONTHS_ID[m - 1]} ${y}`
}

/** Tambah N bulan ke tanggal "10 September 2026" -> "10 Oktober 2026" */
export function addMonthsToExpiry(dateStr: string, months: number): string {
  const parts = dateStr.trim().split(/\s+/)
  if (parts.length !== 3) return dateStr
  const day = Number(parts[0])
  const month = MONTHS_ID.indexOf(parts[1]) + 1
  const year = Number(parts[2])
  if (!day || !month || !year) return dateStr
  const d = new Date(year, month - 1, day)
  d.setMonth(d.getMonth() + months)
  return `${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`
}

/** Hari ini dalam format "10 September 2026" */
export function todayId(): string {
  const now = new Date()
  return `${now.getDate()} ${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`
}
