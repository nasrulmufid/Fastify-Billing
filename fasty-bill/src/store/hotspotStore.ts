import { create } from "zustand"

import api from "@/lib/axios"

export type CodeFormat = "ABCD123" | "abcd123" | "AbcD123" | "ABCDEFG" | "abcdefg" | "123456"
export type HotspotUserStatus = "Aktif" | "Belum Terpakai" | "Expired"

export interface HotspotProfile {
  id: number
  name: string
  durationHours: number
  durationLabel: string
  price: number
  downloadSpeed: number
  uploadSpeed: number
  sharedUsers: number
  sessionTimeout: number
  status: "Aktif" | "Nonaktif"
}

export interface HotspotUser {
  id: number
  username: string
  password: string
  profileId: number | null
  profileName?: string
  price: number
  validUntil: string
  status: HotspotUserStatus
  createdAt: string
}

export interface VoucherTemplate {
  id: number
  name: string
  html: string
  isDefault: boolean
  updatedAt: string
}

export interface HotspotSettings {
  isolirAllGrace?: number
  reminderH3Grace?: number
  voucherPrefix?: string
  companyName?: string
  currency?: string
  serverUrl?: string
  apiPort?: number
  apiUser?: string
  apiPassword?: string
  loginPageUrl?: string
  autoSync?: boolean
}

export type GenerateVoucherInput = {
  count: number
  profileId?: number | null
  price: number
  format: CodeFormat
  usernameEqualsPassword: boolean
  prefix: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProfileFromApi(p: any): HotspotProfile {
  return {
    id: Number(p.id),
    name: p.name,
    durationHours: Number(p.durationHours ?? p.duration_hours),
    durationLabel: p.durationLabel ?? p.duration_label ?? `${p.durationHours} Jam`,
    price: Number(p.price),
    downloadSpeed: Number(p.downloadSpeed),
    uploadSpeed: Number(p.uploadSpeed),
    sharedUsers: Number(p.sharedUsers),
    sessionTimeout: Number(p.sessionTimeout),
    status: p.status ?? "Aktif",
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapUserFromApi(u: any): HotspotUser {
  return {
    id: Number(u.id),
    username: u.username,
    password: u.password,
    profileId: u.profileId ?? u.profile_id ?? null,
    profileName: u.profileName ?? u.profile_name ?? undefined,
    price: Number(u.price),
    validUntil: String(u.validUntil ?? u.valid_until ?? ""),
    status: u.status ?? "Belum Terpakai",
    createdAt: String(u.createdAt ?? u.created_at ?? ""),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTemplateFromApi(t: any): VoucherTemplate {
  return {
    id: Number(t.id),
    name: t.name,
    html: t.html,
    isDefault: Boolean(t.isDefault ?? t.is_default),
    updatedAt: String(t.updatedAt ?? t.updated_at ?? ""),
  }
}

type HotspotStore = {
  users: HotspotUser[]
  profiles: HotspotProfile[]
  templates: VoucherTemplate[]
  settings: HotspotSettings

  /** Muat semua data dari backend. */
  load: () => Promise<void>
  /** Buat N voucher sekaligus via backend API. */
  generateVouchers: (input: GenerateVoucherInput) => Promise<HotspotUser[]>
  updateUser: (id: number, patch: { status?: HotspotUserStatus; validUntil?: string; price?: number }) => Promise<boolean>
  removeUsers: (ids: number[]) => Promise<boolean>

  addProfile: (input: Omit<HotspotProfile, "id">) => Promise<boolean>
  updateProfile: (id: number, patch: Partial<Omit<HotspotProfile, "id">>) => Promise<boolean>
  removeProfile: (id: number) => Promise<boolean>

  addTemplate: (input: { name: string; html: string }) => Promise<boolean>
  updateTemplate: (id: number, patch: { name?: string; html?: string }) => Promise<boolean>
  removeTemplate: (id: number) => Promise<boolean>
  setDefaultTemplate: (id: number) => Promise<boolean>

  updateSettings: (patch: Partial<HotspotSettings>) => Promise<boolean>
}

export const useHotspotStore = create<HotspotStore>((set, get) => ({
  users: [],
  profiles: [],
  templates: [],
  settings: {},

  load: async () => {
    try {
      const [usersRes, profilesRes, templatesRes, settingsRes] = await Promise.all([
        api.get("/hotspot/users"),
        api.get("/hotspot/profiles"),
        api.get("/hotspot/templates"),
        api.get("/hotspot/settings"),
      ])
      set({
        users: usersRes.data.data.map(mapUserFromApi),
        profiles: profilesRes.data.data.map(mapProfileFromApi),
        templates: templatesRes.data.data.map(mapTemplateFromApi),
        settings: settingsRes.data.data ?? {},
      })
    } catch (err: unknown) {
      console.warn("Gagal memuat hotspot data dari API:", (err as { message?: string })?.message)
    }
  },

  generateVouchers: async (input) => {
    try {
      const { data } = await api.post("/hotspot/vouchers/generate", input)
      const newUsers = (data.data ?? []).map(mapUserFromApi)
      set((s) => ({ users: [...s.users, ...newUsers] }))
      return newUsers
    } catch (err: unknown) {
      console.error("Gagal generate voucher:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return []
    }
  },

  updateUser: async (id, patch) => {
    try {
      await api.put(`/hotspot/users/${id}`, patch)
      await get().load()
      return true
    } catch (err: unknown) {
      console.error("Gagal update user:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return false
    }
  },

  removeUsers: async (ids) => {
    try {
      await api.delete("/hotspot/users", { data: { ids } })
      set((s) => ({ users: s.users.filter((u) => !ids.includes(u.id)) }))
      return true
    } catch (err: unknown) {
      console.error("Gagal hapus user:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return false
    }
  },

  addProfile: async (input) => {
    try {
      await api.post("/hotspot/profiles", input)
      await get().load()
      return true
    } catch (err: unknown) {
      console.error("Gagal tambah profile:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return false
    }
  },

  updateProfile: async (id, patch) => {
    try {
      await api.put(`/hotspot/profiles/${id}`, patch)
      await get().load()
      return true
    } catch (err: unknown) {
      console.error("Gagal update profile:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return false
    }
  },

  removeProfile: async (id) => {
    try {
      await api.delete(`/hotspot/profiles/${id}`)
      set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) }))
      return true
    } catch (err: unknown) {
      console.error("Gagal hapus profile:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return false
    }
  },

  addTemplate: async (input) => {
    try {
      await api.post("/hotspot/templates", input)
      await get().load()
      return true
    } catch (err: unknown) {
      console.error("Gagal tambah template:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return false
    }
  },

  updateTemplate: async (id, patch) => {
    try {
      await api.put(`/hotspot/templates/${id}`, patch)
      await get().load()
      return true
    } catch (err: unknown) {
      console.error("Gagal update template:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return false
    }
  },

  removeTemplate: async (id) => {
    try {
      await api.delete(`/hotspot/templates/${id}`)
      set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }))
      return true
    } catch (err: unknown) {
      console.error("Gagal hapus template:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return false
    }
  },

  setDefaultTemplate: async (id) => {
    try {
      await api.put(`/hotspot/templates/${id}/default`)
      await get().load()
      return true
    } catch (err: unknown) {
      console.error("Gagal set default template:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return false
    }
  },

  updateSettings: async (patch) => {
    try {
      await api.put("/hotspot/settings", patch)
      set((s) => ({ settings: { ...s.settings, ...patch } }))
      return true
    } catch (err: unknown) {
      console.error("Gagal update settings:", (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? err)
      return false
    }
  },
}))

/** Status yang tersedia untuk filter/select user voucher. */
export const USER_STATUSES: HotspotUserStatus[] = ["Aktif", "Belum Terpakai", "Expired"]
