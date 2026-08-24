import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react"

import api from "./axios"
import { useAuthStore } from "@/store/useAppStore"

/* ---------- types ---------- */
export type PackageType = "Hotspot" | "PPPoE" | "Static IP"
export type PackageStatus = "Aktif" | "Nonaktif"

export interface ServicePackage {
  id: string
  code: string
  name: string
  downloadSpeed: number
  uploadSpeed: number
  price: number
  type: PackageType
  status: PackageStatus
  description: string
  createdAt: string
}

export type PackageInput = Omit<ServicePackage, "id" | "code" | "status" | "createdAt">

type Action =
  | { type: "ADD_PACKAGE"; payload: PackageInput }
  | { type: "UPDATE_PACKAGE"; payload: ServicePackage }
  | { type: "DELETE_PACKAGE"; payload: string }
  | { type: "SET_STATUS"; payload: { id: string; status: PackageStatus } }
  | { type: "SET_PACKAGES"; payload: ServicePackage[] }
  | { type: "UPSERT_PACKAGE"; payload: ServicePackage }

/* ---------- initial seed ---------- */
const seed: ServicePackage[] = [
  {
    id: "1", code: "PKG-01", name: "Paket 10 Mbps", downloadSpeed: 10, uploadSpeed: 10, price: 150000,
    type: "Hotspot", status: "Aktif",
    description: "Paket hemat untuk browsing, media sosial, dan streaming ringan.",
    createdAt: "10 Januari 2025",
  },
  {
    id: "2", code: "PKG-02", name: "Paket 20 Mbps", downloadSpeed: 20, uploadSpeed: 20, price: 250000,
    type: "PPPoE", status: "Aktif",
    description: "Cocok untuk keluarga dengan streaming HD dan video call.",
    createdAt: "10 Januari 2025",
  },
  {
    id: "3", code: "PKG-03", name: "Paket 30 Mbps", downloadSpeed: 30, uploadSpeed: 30, price: 350000,
    type: "PPPoE", status: "Aktif",
    description: "Untuk rumah tangga aktif dengan banyak perangkat terhubung.",
    createdAt: "15 Februari 2025",
  },
  {
    id: "4", code: "PKG-04", name: "Paket 50 Mbps", downloadSpeed: 50, uploadSpeed: 50, price: 500000,
    type: "Static IP", status: "Aktif",
    description: "Kecepatan tinggi dengan IP statis untuk kebutuhan bisnis.",
    createdAt: "01 Maret 2025",
  },
  {
    id: "5", code: "PKG-05", name: "Paket 75 Mbps", downloadSpeed: 75, uploadSpeed: 75, price: 750000,
    type: "Static IP", status: "Aktif",
    description: "Ideal untuk kantor kecil dengan server internal.",
    createdAt: "20 April 2025",
  },
  {
    id: "6", code: "PKG-06", name: "Paket 100 Mbps", downloadSpeed: 100, uploadSpeed: 100, price: 900000,
    type: "PPPoE", status: "Aktif",
    description: "Koneksi sangat cepat untuk streaming 4K dan gaming.",
    createdAt: "10 Mei 2025",
  },
  {
    id: "7", code: "PKG-07", name: "Paket 150 Mbps", downloadSpeed: 150, uploadSpeed: 150, price: 1200000,
    type: "Static IP", status: "Nonaktif",
    description: "Untuk bisnis besar dan hosting server lokal.",
    createdAt: "01 Juni 2025",
  },
  {
    id: "8", code: "PKG-08", name: "Paket Bisnis 50", downloadSpeed: 50, uploadSpeed: 100, price: 800000,
    type: "Static IP", status: "Aktif",
    description: "Upload asimetris untuk kantor dengan cloud sync.",
    createdAt: "15 Juni 2025",
  },
  {
    id: "9", code: "PKG-09", name: "Paket Hotspot Publik", downloadSpeed: 10, uploadSpeed: 5, price: 100000,
    type: "Hotspot", status: "Nonaktif",
    description: "Untuk area publik seperti warung dan taman.",
    createdAt: "01 Juli 2025",
  },
]

/* ---------- reducer ---------- */
function packageReducer(state: ServicePackage[], action: Action): ServicePackage[] {
  switch (action.type) {
    case "ADD_PACKAGE": {
      const now = new Date()
      const createdAt = `${now.getDate()} ${now.toLocaleString("id-ID", { month: "long" })} ${now.getFullYear()}`
      const newPackage: ServicePackage = {
        ...action.payload,
        id: String(Date.now()),
        code: `PKG-${String(state.length + 1).padStart(2, "0")}`,
        status: "Aktif",
        createdAt,
      }
      return [...state, newPackage]
    }
    case "UPDATE_PACKAGE":
      return state.map((p) => (p.id === action.payload.id ? action.payload : p))
    case "DELETE_PACKAGE":
      return state.filter((p) => p.id !== action.payload)
    case "SET_STATUS":
      return state.map((p) =>
        p.id === action.payload.id ? { ...p, status: action.payload.status } : p
      )
    case "SET_PACKAGES":
      return action.payload
    case "UPSERT_PACKAGE": {
      const exists = state.some((p) => p.id === action.payload.id)
      return exists
        ? state.map((p) => (p.id === action.payload.id ? action.payload : p))
        : [...state, action.payload]
    }
    default:
      return state
  }
}

/* ---------- mapping API -> ServicePackage ---------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPackageFromApi(p: any): ServicePackage {
  return {
    id: String(p.id),
    code: p.code,
    name: p.name,
    downloadSpeed: Number(p.downloadSpeed),
    uploadSpeed: Number(p.uploadSpeed),
    price: Number(p.price),
    type: p.type,
    status: p.status,
    description: p.description ?? "",
    createdAt: p.createdAt ?? "",
  }
}

/* ---------- context ---------- */
const PackageCtx = createContext<ServicePackage[]>([])
const PackageDispatchCtx = createContext<Dispatch<Action>>(() => {})

export function PackageProvider({ children }: { children: ReactNode }) {
  const [packages, dispatch] = useReducer(packageReducer, seed)
  const token = useAuthStore((s) => s.token)

  // Hydrate dari backend Fastify saat sudah login. Gagal -> tetap pakai seed.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    api
      .get("/packages")
      .then(({ data }) => {
        if (cancelled) return
        dispatch({ type: "SET_PACKAGES", payload: data.data.map(mapPackageFromApi) })
      })
      .catch((err) => console.warn("Gagal memuat paket dari API:", err?.message))
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <PackageCtx.Provider value={packages}>
      <PackageDispatchCtx.Provider value={dispatch}>{children}</PackageDispatchCtx.Provider>
    </PackageCtx.Provider>
  )
}

/* ---------- hook ---------- */
export function usePackages() {
  return useContext(PackageCtx)
}

export function usePackageDispatch() {
  return useContext(PackageDispatchCtx)
}

export function usePackage(id: string | undefined) {
  const packages = usePackages()
  if (!id) return undefined
  return packages.find((p) => p.id === id)
}

export function usePackageActions() {
  const dispatch = usePackageDispatch()

  const add = useCallback(
    async (input: PackageInput) => {
      try {
        const { data } = await api.post("/packages", input)
        dispatch({ type: "UPSERT_PACKAGE", payload: mapPackageFromApi(data.data) })
      } catch (err) {
        console.error("Gagal menambah paket:", err)
      }
    },
    [dispatch],
  )

  const update = useCallback(
    async (pkg: ServicePackage) => {
      try {
        const { data } = await api.put(`/packages/${pkg.id}`, pkg)
        dispatch({ type: "UPSERT_PACKAGE", payload: mapPackageFromApi(data.data) })
      } catch (err) {
        console.error("Gagal memperbarui paket:", err)
      }
    },
    [dispatch],
  )

  const remove = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/packages/${id}`)
        dispatch({ type: "DELETE_PACKAGE", payload: id })
      } catch (err) {
        console.error("Gagal menghapus paket:", err)
      }
    },
    [dispatch],
  )

  const setStatus = useCallback(
    async (id: string, status: PackageStatus) => {
      try {
        const { data } = await api.put(`/packages/${id}/status`, { status })
        dispatch({ type: "UPSERT_PACKAGE", payload: mapPackageFromApi(data.data) })
      } catch (err) {
        console.error("Gagal mengubah status paket:", err)
      }
    },
    [dispatch],
  )

  return { add, update, remove, setStatus }
}
