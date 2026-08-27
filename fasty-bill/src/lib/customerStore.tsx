import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react"

import { addMonthsToExpiry } from "./dateUtils"
import api from "./axios"
import { useAuthStore } from "@/store/useAppStore"

/* ---------- types ---------- */
export interface Customer {
  id: string
  code: string
  name: string
  email: string
  phone: string
  address: string
  packageName: string
  status: "Active" | "Isolated" | "Pending"
  ipAddress: string
  router: string
  pppoeUsername: string
  pppoePassword: string
  loginUsername: string
  loginPassword: string
  odpId: string
  gps: string
  lastPayment: string
  expiryDate: string
  joinDate: string
}

export type CustomerInput = Omit<
  Customer,
  "id" | "code" | "status" | "lastPayment" | "expiryDate" | "joinDate"
>

type Action =
  | { type: "ADD_CUSTOMER"; payload: CustomerInput }
  | { type: "UPDATE_CUSTOMER"; payload: Customer }
  | { type: "DELETE_CUSTOMER"; payload: string }
  | { type: "SET_STATUS"; payload: { id: string; status: Customer["status"] } }
  | { type: "SET_EXPIRY"; payload: { id: string; expiryDate: string } }
  | { type: "EXTEND_EXPIRY"; payload: { id: string; months: number } }
  | { type: "SET_CUSTOMERS"; payload: Customer[] }
  | { type: "UPSERT_CUSTOMER"; payload: Customer }

/* ---------- initial seed (kosong — data dimuat dari API) ---------- */
const seed: Customer[] = []

/* ---------- reducer ---------- */
function customerReducer(state: Customer[], action: Action): Customer[] {
  switch (action.type) {
    case "ADD_CUSTOMER": {
      const now = new Date()
      const id = String(Date.now())
      const newCustomer: Customer = {
        ...action.payload,
        id,
        code: String(state.length + 1001).padStart(6, '0'),
        status: "Active",
        lastPayment: "-",
        expiryDate: `${now.getDate()} ${now.toLocaleString("id-ID", { month: "long" })} ${now.getFullYear()}`,
        joinDate: `${now.getDate()} ${now.toLocaleString("id-ID", { month: "long" })} ${now.getFullYear()}`,
      }
      return [...state, newCustomer]
    }
    case "UPDATE_CUSTOMER":
      return state.map((c) => (c.id === action.payload.id ? action.payload : c))
    case "DELETE_CUSTOMER":
      return state.filter((c) => c.id !== action.payload)
    case "SET_STATUS":
      return state.map((c) => (c.id === action.payload.id ? { ...c, status: action.payload.status } : c))
    case "SET_EXPIRY":
      return state.map((c) => (c.id === action.payload.id ? { ...c, expiryDate: action.payload.expiryDate } : c))
    case "EXTEND_EXPIRY":
      return state.map((c) =>
        c.id === action.payload.id
          ? { ...c, status: "Active" as const, expiryDate: addMonthsToExpiry(c.expiryDate, action.payload.months) }
          : c
      )
    case "SET_CUSTOMERS":
      return action.payload
    case "UPSERT_CUSTOMER": {
      const exists = state.some((c) => c.id === action.payload.id)
      return exists
        ? state.map((c) => (c.id === action.payload.id ? action.payload : c))
        : [...state, action.payload]
    }
    default:
      return state
  }
}

/* ---------- mapping API -> Customer ---------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCustomerFromApi(c: any): Customer {
  return {
    id: String(c.id),
    code: c.code,
    name: c.name,
    email: c.email ?? "",
    phone: c.phone,
    address: c.address ?? "",
    packageName: c.packageName ?? "",
    status: c.status,
    ipAddress: c.ipAddress,
    router: c.router ?? "",
    pppoeUsername: c.pppoeUsername,
    pppoePassword: c.pppoePassword,
    loginUsername: c.loginUsername,
    loginPassword: c.loginPassword,
    odpId: c.odpId ?? "",
    gps: c.gps ?? "",
    lastPayment: c.lastPayment ?? "-",
    expiryDate: c.expiryDate ?? "",
    joinDate: c.joinDate ?? "",
  }
}

/* Cache mapping nama -> id utk payload API (package/router) */
let pkgIdCache: Record<string, number> = {}
let routerIdCache: Record<string, number> = {}

async function ensureMaps() {
  if (Object.keys(pkgIdCache).length && Object.keys(routerIdCache).length) return
  const [pkgs, routers] = await Promise.all([api.get("/packages"), api.get("/routers")])
  for (const p of pkgs.data.data) pkgIdCache[p.name] = Number(p.id)
  for (const r of routers.data.data) routerIdCache[r.name] = Number(r.id)
}

/* ---------- context ---------- */
const CustomerCtx = createContext<Customer[]>([])
const DispatchCtx = createContext<Dispatch<Action>>(() => {})

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customers, dispatch] = useReducer(customerReducer, seed)
  const token = useAuthStore((s) => s.token)

  // Hydrate dari backend Fastify (fasty-api) saat sudah login. Gagal -> tetap pakai seed.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    api
      .get("/customers", { params: { limit: 100 } })
      .then(({ data }) => {
        if (cancelled) return
        dispatch({ type: "SET_CUSTOMERS", payload: data.data.map(mapCustomerFromApi) })
      })
      .catch((err) => console.warn("Gagal memuat pelanggan dari API:", err?.message))
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <CustomerCtx.Provider value={customers}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </CustomerCtx.Provider>
  )
}

/* ---------- hook ---------- */
export function useCustomers() {
  return useContext(CustomerCtx)
}

export function useCustomerDispatch() {
  return useContext(DispatchCtx)
}

export function useCustomer(id: string | undefined) {
  const customers = useCustomers()
  if (!id) return undefined
  return customers.find((c) => c.id === id)
}

export function useCustomerActions() {
  const dispatch = useCustomerDispatch()
  const customers = useCustomers()

  const add = useCallback(
    async (input: CustomerInput) => {
      try {
        await ensureMaps()
        const payload: Record<string, unknown> = {
          name: input.name,
          phone: input.phone,
          email: input.email,
          address: input.address,
          ipAddress: input.ipAddress,
          pppoeUsername: input.pppoeUsername,
          pppoePassword: input.pppoePassword,
          loginUsername: input.loginUsername,
          loginPassword: input.loginPassword,
          odpId: input.odpId,
          gps: input.gps,
          packageId: input.packageName ? (pkgIdCache[input.packageName] ?? null) : null,
          routerId: input.router ? (routerIdCache[input.router] ?? null) : null,
        }
        const { data } = await api.post("/customers", payload)
        dispatch({ type: "UPSERT_CUSTOMER", payload: mapCustomerFromApi(data.data) })
      } catch (err) {
        console.error("Gagal menambah pelanggan:", err)
      }
    },
    [dispatch],
  )

  const update = useCallback(
    async (customer: Customer) => {
      try {
        await ensureMaps()
        const payload: Record<string, unknown> = {
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
          ipAddress: customer.ipAddress,
          pppoeUsername: customer.pppoeUsername,
          pppoePassword: customer.pppoePassword,
          loginUsername: customer.loginUsername,
          loginPassword: customer.loginPassword,
          odpId: customer.odpId,
          gps: customer.gps,
          packageId: customer.packageName ? (pkgIdCache[customer.packageName] ?? null) : null,
          routerId: customer.router ? (routerIdCache[customer.router] ?? null) : null,
        }
        const { data } = await api.put(`/customers/${customer.id}`, payload)
        dispatch({ type: "UPSERT_CUSTOMER", payload: mapCustomerFromApi(data.data) })
      } catch (err) {
        console.error("Gagal memperbarui pelanggan:", err)
      }
    },
    [dispatch],
  )

  const remove = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/customers/${id}`)
        dispatch({ type: "DELETE_CUSTOMER", payload: id })
      } catch (err) {
        console.error("Gagal menghapus pelanggan:", err)
      }
    },
    [dispatch],
  )

  const setStatus = useCallback(
    async (id: string, status: Customer["status"]) => {
      try {
        const { data } = await api.post(`/network/isolir/${id}`, { isolate: status === "Isolated" })
        dispatch({ type: "UPSERT_CUSTOMER", payload: mapCustomerFromApi(data.data) })
      } catch (err) {
        console.error("Gagal mengubah status:", err)
      }
    },
    [dispatch],
  )

  const setExpiry = useCallback(
    async (id: string, expiryDate: string) => {
      try {
        const { data } = await api.put(`/customers/${id}/expiry`, { expiryDate })
        dispatch({ type: "UPSERT_CUSTOMER", payload: mapCustomerFromApi(data.data) })
      } catch (err) {
        console.error("Gagal mengubah masa aktif:", err)
      }
    },
    [dispatch],
  )

  /** Perpanjang masa aktif N bulan + aktifkan layanan (setelah pembayaran). */
  const extendExpiry = useCallback(
    async (id: string, months: number) => {
      try {
        const { data } = await api.post(`/customers/${id}/extend`, { months })
        dispatch({ type: "UPSERT_CUSTOMER", payload: mapCustomerFromApi(data.data) })
      } catch (err) {
        console.error("Gagal memperpanjang masa aktif:", err)
      }
    },
    [dispatch],
  )

  const nextId = String(customers.length + 1)

  return { add, update, remove, setStatus, setExpiry, extendExpiry, nextId }
}
