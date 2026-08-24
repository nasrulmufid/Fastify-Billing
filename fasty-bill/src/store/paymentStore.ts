import { create } from "zustand"

import {
  initialPayments,
  type Payment,
  type PaymentStatus,
} from "@/lib/paymentData"
import api from "@/lib/axios"
import { useInvoiceStore } from "./invoiceStore"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPaymentFromApi(p: any): Payment {
  return {
    id: String(p.id),
    code: p.code,
    customer: p.customer,
    invoice: p.invoice,
    method: p.method,
    amount: Number(p.amount),
    date: p.date,
    status: p.status,
  }
}

type PaymentStore = {
  payments: Payment[]
  /** Muat ulang data pembayaran dari backend. */
  load: () => Promise<void>
  /** Tandai Sukses via API (transaksi: extend masa aktif + invoice Paid). */
  approve: (id: string, statusNote?: string) => Promise<boolean>
  /** Tandai Ditolak via API. */
  reject: (id: string, statusNote?: string) => Promise<boolean>
  /** Set status lokal (fallback UI). */
  setStatus: (id: string, status: PaymentStatus) => void
  /** Hapus pembayaran via API (optimistic delete + rollback jika gagal). */
  removePayment: (id: string) => Promise<void>
}

export const usePaymentStore = create<PaymentStore>((set, get) => ({
  payments: initialPayments,

  load: async () => {
    try {
      const { data } = await api.get("/payments")
      set({ payments: data.data.map(mapPaymentFromApi) })
    } catch (err: unknown) {
      console.warn("Gagal memuat pembayaran dari API:", (err as { message?: string })?.message)
    }
  },

  approve: async (id, statusNote) => {
    try {
      await api.post(`/payments/${id}/approve`, { statusNote })
      await get().load()
      await useInvoiceStore.getState().load()
      return true
    } catch (err: unknown) {
      console.error("Gagal menyetujui pembayaran:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return false
    }
  },

  reject: async (id, statusNote) => {
    try {
      await api.post(`/payments/${id}/reject`, { statusNote })
      await get().load()
      return true
    } catch (err: unknown) {
      console.error("Gagal menolak pembayaran:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return false
    }
  },

  setStatus: (id, status) =>
    set((state) => ({
      payments: state.payments.map((p) => (p.id === id ? { ...p, status } : p)),
    })),

  removePayment: async (id) => {
    // Optimistic delete: hapus dari state dulu, rollback jika API gagal
    const prev = get().payments
    set((state) => ({ payments: state.payments.filter((p) => p.id !== id) }))
    try {
      await api.delete(`/payments/${id}`)
    } catch (err: unknown) {
      console.error("Gagal menghapus pembayaran:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      set({ payments: prev })
      throw err
    }
  },
}))
