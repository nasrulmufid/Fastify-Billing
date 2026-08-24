import { create } from "zustand"

import api from "@/lib/axios"

export type CustomerStatus = "Active" | "Isolated" | "Pending"

export interface CustomerProfile {
  id: number
  code: string
  name: string
  email: string
  phone: string
  address: string
  packageId: number | null
  packageName: string
  routerId: number | null
  router: string
  status: CustomerStatus
  ipAddress: string
  loginUsername: string
  lastPayment: string | null
  expiryDate: string | null
  joinDate: string | null
}

type CustomerAuthState = {
  customer: CustomerProfile | null
  token: string | null
  isAuthenticated: boolean
  /** Login portal dengan akun customer (login_username + login_password). */
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  /** Muat ulang profil customer dari backend. */
  loadProfile: () => Promise<void>
}

export const useCustomerStore = create<CustomerAuthState>((set) => ({
  customer: (() => {
    try {
      const raw = localStorage.getItem("portal_customer")
      if (!raw) return null
      const parsed = JSON.parse(raw) as CustomerProfile
      if (typeof parsed?.id !== "number" || typeof parsed?.name !== "string") return null
      return parsed
    } catch {
      return null
    }
  })(),
  token: localStorage.getItem("portal_token"),
  isAuthenticated: !!localStorage.getItem("portal_token"),

  login: async (username, password) => {
    try {
      const { data } = await api.post("/auth/customer-login", { username, password })
      const { token, customer } = data.data
      localStorage.setItem("portal_token", token)
      localStorage.setItem("portal_customer", JSON.stringify(customer))
      set({ token, customer, isAuthenticated: true })
      return true
    } catch (err: unknown) {
      console.error("Login customer gagal:", err)
      return false
    }
  },

  logout: () => {
    localStorage.removeItem("portal_token")
    localStorage.removeItem("portal_customer")
    set({ customer: null, token: null, isAuthenticated: false })
  },

  loadProfile: async () => {
    try {
      const { data } = await api.get("/portal/me")
      const customer = data.data as CustomerProfile
      localStorage.setItem("portal_customer", JSON.stringify(customer))
      set({ customer })
    } catch (err: unknown) {
      console.warn("Gagal memuat profil customer:", (err as { message?: string })?.message)
    }
  },
}))
