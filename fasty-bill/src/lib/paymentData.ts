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

export const initialPayments: Payment[] = []

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
