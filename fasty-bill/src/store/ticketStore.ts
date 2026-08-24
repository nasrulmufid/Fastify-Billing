import { create } from "zustand"

import api from "@/lib/axios"

export type TicketStatus = "Dibuka" | "Diproses" | "Selesai"

export interface Ticket {
  id: string
  code: string
  customer: string
  customerId: number
  title: string
  category: string
  description: string
  status: TicketStatus
  date: string
  updatedAt: string
  timeline: Array<{
    status?: TicketStatus
    actor: string
    date: string
    note?: string
  }>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTicketFromApi(t: any): Ticket {
  return {
    id: String(t.id),
    code: t.code,
    customer: t.customer,
    customerId: Number(t.customerId),
    title: t.title,
    category: t.category,
    description: t.description ?? "",
    status: t.status ?? "Dibuka",
    date: t.date,
    updatedAt: t.updatedAt,
    timeline: Array.isArray(t.timeline) ? t.timeline : [],
  }
}

type TicketStore = {
  tickets: Ticket[]
  /** Muat daftar tiket dari backend. */
  load: () => Promise<void>
  /** Buat tiket baru (untuk portal pelanggan). */
  create: (payload: {
    customerId: number
    title: string
    category: string
    description?: string
  }) => Promise<string | null>
  /** Ubah status tiket + tambah entri timeline baru (aktor Admin). */
  updateStatus: (id: string, status: TicketStatus, note?: string) => Promise<boolean>
  /** Tambah catatan timeline tanpa mengubah status. */
  addNote: (id: string, note: string) => Promise<boolean>
}

export const useTicketStore = create<TicketStore>((set, get) => ({
  tickets: [],

  load: async () => {
    try {
      const { data } = await api.get("/tickets")
      set({ tickets: data.data.map(mapTicketFromApi) })
    } catch (err: unknown) {
      console.warn("Gagal memuat tiket dari API:", (err as { message?: string })?.message)
    }
  },

  create: async (payload) => {
    try {
      const { data } = await api.post("/tickets", payload)
      const newId = String(data.data.id)
      await get().load()
      return newId
    } catch (err: unknown) {
      console.error("Gagal membuat tiket:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return null
    }
  },

  updateStatus: async (id, status, note) => {
    try {
      await api.put(`/tickets/${id}/status`, { status, note })
      await get().load()
      return true
    } catch (err: unknown) {
      console.error("Gagal mengubah status tiket:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return false
    }
  },

  addNote: async (id, note) => {
    try {
      await api.post(`/tickets/${id}/notes`, { note })
      await get().load()
      return true
    } catch (err: unknown) {
      console.error("Gagal menambah catatan tiket:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return false
    }
  },
}))
