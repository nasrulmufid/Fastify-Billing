import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/axios"
import { toast } from "sonner"

// --- Types ---
export type CustomerStatus = "active" | "isolated" | "pending"

export type Customer = {
  id: number | string
  name: string
  email: string
  phone: string
  address: string
  packageId: number | string
  packageName: string
  ipAddress: string
  pppoeUsername: string
  pppoePassword: string
  loginUsername: string
  loginPassword: string
  routerId: number | string
  routerName: string
  status: CustomerStatus
  expiryDate: string
  joinDate: string
  lastPayment: string | null
}

export type CustomerListParams = {
  page?: number
  limit?: number
  search?: string
  status?: CustomerStatus | ""
  packageId?: string
}

export type CustomerListResponse = {
  data: Customer[]
  total: number
  page: number
  limit: number
}

// --- Queries ---
export function useCustomers(params: CustomerListParams = {}) {
  return useQuery({
    queryKey: ["customers", params],
    queryFn: async () => {
      const { data } = await api.get<CustomerListResponse>("/customers", { params })
      return data
    },
  })
}

export function useCustomer(id: string | number | undefined) {
  return useQuery({
    queryKey: ["customers", id],
    queryFn: async () => {
      const { data } = await api.get<Customer>(`/customers/${id}`)
      return data
    },
    enabled: !!id,
  })
}

// --- Mutations ---
export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<Customer, "id" | "joinDate">) => {
      const { data } = await api.post<Customer & { warning?: { message: string } }>("/customers", payload)
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["customers"] })
      toast.success("Pelanggan berhasil ditambahkan")
      if (data.warning) toast.warning(data.warning.message)
    },
    onError: () => toast.error("Gagal menambahkan pelanggan"),
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Customer> & { id: string | number }) => {
      const { data } = await api.put<Customer>(`/customers/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] })
      toast.success("Pelanggan berhasil diperbarui")
    },
    onError: () => toast.error("Gagal memperbarui pelanggan"),
  })
}

export function useIsolirCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isolate }: { id: string | number; isolate: boolean }) => {
      const { data } = await api.post<Customer & { warning?: { message: string } }>(
        `/network/isolir/${id}`,
        { isolate },
      )
      return data
    },
    onSuccess: (data, { isolate }) => {
      qc.invalidateQueries({ queryKey: ["customers"] })
      toast.success(isolate ? "Pelanggan berhasil diisolir" : "Pelanggan berhasil di-unisolir")
      if (data.warning) toast.warning(data.warning.message)
    },
    onError: () => toast.error("Gagal mengubah status isolir"),
  })
}

export function useDeleteCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string | number) => {
      await api.delete(`/customers/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] })
      toast.success("Pelanggan berhasil dihapus")
    },
    onError: () => toast.error("Gagal menghapus pelanggan"),
  })
}
