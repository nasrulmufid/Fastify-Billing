/**
 * TanStack Query hooks untuk RADIUS (sesi, usage, NAS, status, config).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/axios"
import { toast } from "sonner"

export type RadiusSession = {
  id: number
  username: string
  sessionId: string
  nasIp: string
  nasPort: string | null
  framedIp: string
  startTime: string | null
  sessionTime: number
  inputOctets: number
  outputOctets: number
  customerId: number | null
  customerName: string | null
}

export type RadiusUsage = {
  customerId: number
  name: string
  code: string
  pppoeUsername: string
  sessions: number
  inputOctets: number
  outputOctets: number
  sessionTime: number
}

export type RadiusNas = {
  id: number
  nasname: string
  shortname: string
  type: string
  secret: string
  description: string
  routerId: number | null
  routerName: string | null
}

export type RadiusStatus = {
  accepts24h: number
  rejects24h: number
  activeSessions: number
  radiusRouters: number
}

export type RadiusLog = {
  id: number
  username: string
  reply: string
  nasIp: string
  time: string
}

export type RadiusConfig = {
  host?: string
  authPort?: number
  acctPort?: number
  coaPort?: number
  retentionDays?: number
}

export function useRadiusSessions() {
  return useQuery({
    queryKey: ["radius", "sessions"],
    queryFn: async () => {
      const { data } = await api.get<{ data: RadiusSession[] }>("/radius/sessions")
      return data.data
    },
    refetchInterval: 15_000,
  })
}

export function useDisconnectSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<{ data: { ok: boolean; error?: string } }>(
        `/radius/sessions/${id}/disconnect`,
        {},
      )
      return data.data
    },
    onSuccess: (res) => {
      if (res.ok) toast.success("Sesi diputus")
      else toast.error("Gagal memutus sesi", { description: res.error })
      qc.invalidateQueries({ queryKey: ["radius", "sessions"] })
    },
  })
}

export function useRadiusUsage(params: { customerId?: number; from?: string; to?: string }) {
  return useQuery({
    queryKey: ["radius", "usage", params],
    queryFn: async () => {
      const { data } = await api.get<{ data: RadiusUsage[] }>("/radius/usage", { params })
      return data.data
    },
  })
}

export function useRadiusNas() {
  return useQuery({
    queryKey: ["radius", "nas"],
    queryFn: async () => {
      const { data } = await api.get<{ data: RadiusNas[] }>("/radius/nas")
      return data.data
    },
  })
}

export function useRadiusStatus() {
  return useQuery({
    queryKey: ["radius", "status"],
    queryFn: async () => {
      const { data } = await api.get<{ data: RadiusStatus }>("/radius/status")
      return data.data
    },
    refetchInterval: 30_000,
  })
}

export function useRadiusLogs(limit = 50) {
  return useQuery({
    queryKey: ["radius", "logs", limit],
    queryFn: async () => {
      const { data } = await api.get<{ data: RadiusLog[] }>("/radius/logs", { params: { limit } })
      return data.data
    },
  })
}

export function useRadiusConfig() {
  return useQuery({
    queryKey: ["radius", "config"],
    queryFn: async () => {
      const { data } = await api.get<{ data: RadiusConfig }>("/radius/config")
      return data.data
    },
  })
}

export function useUpdateRadiusConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (values: RadiusConfig) => {
      const { data } = await api.put<{ data: RadiusConfig }>("/radius/config", values)
      return data.data
    },
    onSuccess: () => {
      toast.success("Konfigurasi RADIUS disimpan")
      qc.invalidateQueries({ queryKey: ["radius", "config"] })
    },
  })
}

export function useDeleteNas() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/radius/nas/${id}`)
    },
    onSuccess: () => {
      toast.success("NAS dihapus")
      qc.invalidateQueries({ queryKey: ["radius", "nas"] })
    },
  })
}
