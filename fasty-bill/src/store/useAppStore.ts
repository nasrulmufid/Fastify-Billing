import { create } from "zustand"

type User = {
  id: string
  name: string
  email: string
  role: "admin" | "super_admin" | "finance" | "teknisi"
}

type AuthState = {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  logout: () => void
  /** Perbarui profil user yang sedang login (nama/email). */
  updateUser: (patch: Partial<Pick<User, "name" | "email">>) => void
}

type SidebarState = {
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarCollapsed: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: (() => {
    try {
      const raw = localStorage.getItem("user")
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<User>
      // Validasi struktur: data localStorage dari aplikasi lain (mis. SalesTrack)
      // tidak boleh dianggap user aplikasi ini.
      if (typeof parsed?.name !== "string" || typeof parsed?.email !== "string") return null
      return parsed as User
    } catch {
      return null
    }
  })(),
  token: localStorage.getItem("token"),
  isAuthenticated: !!localStorage.getItem("token"),
  login: (user, token) => {
    localStorage.setItem("token", token)
    localStorage.setItem("user", JSON.stringify(user))
    set({ user, token, isAuthenticated: true })
  },
  logout: () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    set({ user: null, token: null, isAuthenticated: false })
  },
  updateUser: (patch) => {
    set((s) => {
      if (!s.user) return s
      const user = { ...s.user, ...patch }
      localStorage.setItem("user", JSON.stringify(user))
      return { user }
    })
  },
}))

export const useSidebarStore = create<SidebarState>((set) => ({
  sidebarOpen: false,
  sidebarCollapsed: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))
