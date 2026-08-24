/* ----------------------------------------------------------------
   Data model & seed pembayaran (shared: list + detail)

   Skema pembayaran:
   - QRIS : pembayaran via payment gateway. Sukses otomatis saat
            callback gateway diterima -> masa aktif diperpanjang.
   - Tunai: pembayaran tunai ke admin, dicatat dari menu Invoice
            (admin menandai invoice lunas) -> masa aktif diperpanjang.
   ---------------------------------------------------------------- */

export type PaymentStatus = "Sukses" | "Pending" | "Ditolak"
export type PaymentMethod = "QRIS" | "Tunai"

export interface Payment {
  id: string
  code: string
  customer: string
  invoice: string
  method: PaymentMethod
  amount: number
  date: string
  status: PaymentStatus
}

/** Input pembayaran baru (id & code dibuat otomatis oleh store). */
export type PaymentInput = Omit<Payment, "id" | "code">

export function formatPrice(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`
}

/** Sumber pembayaran: gateway (QRIS) vs loket/admin (Tunai). */
export function paymentSource(method: PaymentMethod): "Gateway" | "Loket" {
  return method === "QRIS" ? "Gateway" : "Loket"
}

export const sourceBadgeClass: Record<"Gateway" | "Loket", string> = {
  Gateway: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  Loket: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400",
}

/** Penjelasan singkat tiap metode sesuai skema pembayaran. */
export const methodHint: Record<PaymentMethod, string> = {
  QRIS: "Scan QRIS via payment gateway — sukses otomatis memperpanjang masa aktif.",
  Tunai: "Dibayar tunai ke admin — dicatat dari menu Invoice, masa aktif diperpanjang.",
}

export const initialPayments: Payment[] = [
  { id: "1", code: "PY-1011", customer: "Budi Santoso", invoice: "INV-1038", method: "QRIS", amount: 150000, date: "02 Agustus 2026", status: "Sukses" },
  { id: "2", code: "PY-1012", customer: "Siti Aminah", invoice: "INV-1039", method: "Tunai", amount: 150000, date: "03 Agustus 2026", status: "Sukses" },
  { id: "3", code: "PY-1013", customer: "Rizki Putra", invoice: "INV-1040", method: "QRIS", amount: 220000, date: "04 Agustus 2026", status: "Pending" },
  { id: "4", code: "PY-1014", customer: "Dewi Lestari", invoice: "INV-1041", method: "QRIS", amount: 300000, date: "05 Agustus 2026", status: "Sukses" },
  { id: "5", code: "PY-1015", customer: "Agus Wijaya", invoice: "INV-1042", method: "Tunai", amount: 150000, date: "05 Agustus 2026", status: "Sukses" },
  { id: "6", code: "PY-1016", customer: "Budi Santoso", invoice: "INV-1043", method: "QRIS", amount: 150000, date: "06 Agustus 2026", status: "Pending" },
  { id: "7", code: "PY-1017", customer: "Siti Aminah", invoice: "INV-1044", method: "QRIS", amount: 120000, date: "06 Agustus 2026", status: "Sukses" },
  { id: "8", code: "PY-1018", customer: "Rizki Putra", invoice: "INV-1045", method: "Tunai", amount: 220000, date: "07 Agustus 2026", status: "Sukses" },
  { id: "9", code: "PY-1019", customer: "Dewi Lestari", invoice: "INV-1046", method: "QRIS", amount: 300000, date: "07 Agustus 2026", status: "Ditolak" },
  { id: "10", code: "PY-1020", customer: "Agus Wijaya", invoice: "INV-1047", method: "Tunai", amount: 150000, date: "08 Agustus 2026", status: "Sukses" },
]

export const paymentStatusBadge: Record<PaymentStatus, string> = {
  Sukses: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Ditolak: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
}

export const paymentMethodBadge: Record<PaymentMethod, string> = {
  QRIS: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  Tunai: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
}

export const METHOD_OPTIONS: PaymentMethod[] = ["QRIS", "Tunai"]
export const STATUS_OPTIONS: PaymentStatus[] = ["Sukses", "Pending", "Ditolak"]
