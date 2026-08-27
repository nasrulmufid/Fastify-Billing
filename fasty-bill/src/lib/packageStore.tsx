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
export type PackageType = "PPPoE"
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

/* ---------- initial seed (kosong — data dimuat dari API) ---------- */
const seed: ServicePackage[] = []

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
