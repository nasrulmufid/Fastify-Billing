import { create } from "zustand"

import api from "@/lib/axios"
import type { PaymentMethod } from "@/lib/paymentData"

export type PortalInvoiceStatus = "Paid" | "Unpaid" | "Overdue"
export type PortalTicketStatus = "Dibuka" | "Diproses" | "Selesai"

export interface PortalInvoice {
  id: string
  code: string
  amount: number
  status: PortalInvoiceStatus
  period: string
  paymentMethod?: PaymentMethod
  paymentCode?: string
  due?: string
}

export interface PortalPayment {
  id: string
  code: string
  invoice: string
  method: PaymentMethod
  amount: number
  date: string
  status: "Sukses" | "Pending" | "Ditolak"
}

export interface PortalTicket {
  id: string
  code: string
  customer: string
  title: string
  category: string
  description: string
  status: PortalTicketStatus
  date: string
  updatedAt: string
  timeline: Array<{
    status?: PortalTicketStatus
    actor: string
    date: string
    note?: string
  }>
}

export const portalStatusLabel: Record<PortalInvoiceStatus, string> = {
  Paid: "Lunas",
  Unpaid: "Belum Bayar",
  Overdue: "Jatuh Tempo",
}

export const portalStatusBadge: Record<PortalInvoiceStatus, string> = {
  Paid: "bg-emerald-500/10 text-emerald-600",
  Unpaid: "bg-amber-500/10 text-amber-600",
  Overdue: "bg-rose-500/10 text-rose-600",
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInvoice(i: any): PortalInvoice {
  return {
    id: String(i.id),
    code: i.code,
    amount: Number(i.amount),
    status: i.status,
    period: i.period,
    paymentMethod: i.paymentMethod ?? undefined,
    paymentCode: i.paymentCode ?? undefined,
    due: i.due ?? undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPayment(p: any): PortalPayment {
  return {
    id: String(p.id),
    code: p.code,
    invoice: p.invoice,
    method: p.method,
    amount: Number(p.amount),
    date: p.date,
    status: p.status,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTicket(t: any): PortalTicket {
  return {
    id: String(t.id),
    code: t.code,
    customer: t.customer,
    title: t.title,
    category: t.category,
    description: t.description ?? "",
    status: t.status ?? "Dibuka",
    date: t.date,
    updatedAt: t.updatedAt,
    timeline: Array.isArray(t.timeline) ? t.timeline : [],
  }
}

type PortalStore = {
  invoices: PortalInvoice[]
  payments: PortalPayment[]
  tickets: PortalTicket[]
  loading: boolean
  /** Muat semua data portal pelanggan (harus sudah login customer). */
  load: () => Promise<void>
  /** Muat ulang daftar tiket saja. */
  loadTickets: () => Promise<void>
  /** Buat tiket baru dari portal. */
  createTicket: (payload: {
    title: string
    category: string
    description?: string
  }) => Promise<string | null>
  /** Detail tiket (termasuk timeline) — fetch langsung dari backend. */
  fetchTicket: (id: string) => Promise<PortalTicket | null>
  /** Buat pembayaran QRIS SumoPod utk satu invoice → return paymentLinkUrl / null. */
  createQrisPayment: (invoiceId: string | number) => Promise<{ paymentLinkUrl: string; amount: number } | null>
  reset: () => void
}

export const usePortalStore = create<PortalStore>((set, get) => ({
  invoices: [],
  payments: [],
  tickets: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      const [inv, pay, tic] = await Promise.all([
        api.get("/portal/invoices"),
        api.get("/portal/payments"),
        api.get("/portal/tickets"),
      ])
      set({
        invoices: inv.data.data.map(mapInvoice),
        payments: pay.data.data.map(mapPayment),
        tickets: tic.data.data.map(mapTicket),
      })
    } catch (err: unknown) {
      console.warn("Gagal memuat data portal:", (err as { message?: string })?.message)
    } finally {
      set({ loading: false })
    }
  },

  loadTickets: async () => {
    try {
      const { data } = await api.get("/portal/tickets")
      set({ tickets: data.data.map(mapTicket) })
    } catch (err: unknown) {
      console.warn("Gagal memuat tiket portal:", (err as { message?: string })?.message)
    }
  },

  createTicket: async (payload) => {
    try {
      const { data } = await api.post("/portal/tickets", payload)
      const newId = String(data.data.id)
      await get().loadTickets()
      return newId
    } catch (err: unknown) {
      console.error("Gagal membuat tiket portal:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return null
    }
  },

  fetchTicket: async (id) => {
    try {
      const { data } = await api.get(`/portal/tickets/${id}`)
      return mapTicket(data.data)
    } catch (err: unknown) {
      console.warn("Gagal memuat detail tiket:", (err as { message?: string })?.message)
      return null
    }
  },

  createQrisPayment: async (invoiceId) => {
    try {
      const { data } = await api.post("/portal/payments/create-qris", { invoiceId })
      return {
        paymentLinkUrl: data.data.paymentLinkUrl,
        amount: Number(data.data.amount ?? 0),
      }
    } catch (err: unknown) {
      console.error("Gagal membuat pembayaran QRIS:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return null
    }
  },

  reset: () => set({ invoices: [], payments: [], tickets: [] }),
}))
