import { create } from "zustand"

import type { PaymentMethod } from "@/lib/paymentData"
import api from "@/lib/axios"
import { usePaymentStore } from "./paymentStore"

export type InvoiceStatus = "Paid" | "Unpaid" | "Overdue"

export interface Invoice {
  id: string
  code: string
  customer: string
  amount: number
  status: InvoiceStatus
  period: string
  /** Terisi setelah invoice lunas: metode pembayaran yang dipakai. */
  paymentMethod?: PaymentMethod
  /** Kode pembayaran terkait (mis. PY-1011). */
  paymentCode?: string
}

export const initialInvoices: Invoice[] = [
  { id: "1", code: "INV-1038", customer: "Budi Santoso", amount: 150000, status: "Paid", period: "Agustus 2026", paymentMethod: "QRIS", paymentCode: "PY-1011" },
  { id: "2", code: "INV-1039", customer: "Siti Aminah", amount: 150000, status: "Paid", period: "Agustus 2026", paymentMethod: "Tunai", paymentCode: "PY-1012" },
  { id: "3", code: "INV-1040", customer: "Rizki Putra", amount: 220000, status: "Unpaid", period: "Agustus 2026" },
  { id: "4", code: "INV-1041", customer: "Dewi Lestari", amount: 300000, status: "Paid", period: "Agustus 2026", paymentMethod: "QRIS", paymentCode: "PY-1014" },
  { id: "5", code: "INV-1042", customer: "Agus Wijaya", amount: 150000, status: "Paid", period: "Agustus 2026", paymentMethod: "Tunai", paymentCode: "PY-1015" },
  { id: "6", code: "INV-1043", customer: "Budi Santoso", amount: 150000, status: "Unpaid", period: "Agustus 2026" },
  { id: "7", code: "INV-1044", customer: "Siti Aminah", amount: 120000, status: "Paid", period: "Agustus 2026", paymentMethod: "QRIS", paymentCode: "PY-1017" },
  { id: "8", code: "INV-1045", customer: "Rizki Putra", amount: 220000, status: "Paid", period: "Agustus 2026", paymentMethod: "Tunai", paymentCode: "PY-1018" },
  { id: "9", code: "INV-1046", customer: "Dewi Lestari", amount: 300000, status: "Overdue", period: "Juli 2026" },
  { id: "10", code: "INV-1047", customer: "Agus Wijaya", amount: 150000, status: "Paid", period: "Agustus 2026", paymentMethod: "Tunai", paymentCode: "PY-1020" },
]

export const statusLabel: Record<InvoiceStatus, string> = {
  Paid: "Lunas",
  Unpaid: "Belum Bayar",
  Overdue: "Jatuh Tempo",
}

export const statusBadgeClass: Record<InvoiceStatus, string> = {
  Paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Unpaid: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Overdue: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInvoiceFromApi(i: any): Invoice {
  return {
    id: String(i.id),
    code: i.code,
    customer: i.customer,
    amount: Number(i.amount),
    status: i.status,
    period: i.period,
    paymentMethod: i.paymentMethod ?? undefined,
    paymentCode: i.paymentCode ?? undefined,
  }
}

type InvoiceStore = {
  invoices: Invoice[]
  /** Muat ulang data invoice dari backend. */
  load: () => Promise<void>
  /**
   * Tandai invoice lunas (Tunai) — backend membuat payment PY-xxxx,
   * menandai invoice Paid, dan memperpanjang masa aktif pelanggan 1 bulan (transaksi).
   */
  markPaid: (id: string, method: PaymentMethod) => Promise<boolean>
  removeInvoice: (id: string) => Promise<void>
}

export const useInvoiceStore = create<InvoiceStore>((set, get) => ({
  invoices: initialInvoices,

  load: async () => {
    try {
      const { data } = await api.get("/invoices")
      set({ invoices: data.data.map(mapInvoiceFromApi) })
    } catch (err: unknown) {
      console.warn("Gagal memuat invoice dari API:", (err as { message?: string })?.message)
    }
  },

  markPaid: async (id, method) => {
    try {
      await api.post(`/invoices/${id}/mark-paid`, { method })
      await get().load()
      await usePaymentStore.getState().load()
      return true
    } catch (err: unknown) {
      console.error("Gagal menandai invoice lunas:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return false
    }
  },

  removeInvoice: async (id) => {
    try {
      await api.delete(`/invoices/${id}`)
      set((state) => ({ invoices: state.invoices.filter((inv) => inv.id !== id) }))
    } catch (err) {
      console.error("Gagal menghapus invoice:", err)
    }
  },
}))
