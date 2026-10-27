/**
 * TanStack Query hooks for ACS (GenieACS) management.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/axios"
import { toast } from "sonner"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GenieACSDevice = {
  _id: string
  DeviceId: string
  DisplayName: string
  Tags: string[]
  Status: "Online" | "Offline"
  LastInform: string
  WlanPassword?: string
  SSID?: string
  customerId?: string | number
}

export type GenieACSConfig = {
  baseUrl: string
  apiKey: string
  apiKeyMasked: string
  syncIntervalMinutes: number
  autoSyncOnAccess: boolean
}

export type AcsSyncResult = {
  total: number
  matched: number
  unmatched: number
  noTag: number
  devices: {
    deviceId: string
    customerId?: string | number
    status: string
  }[]
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function useAcsConfig() {
  return useQuery({
    queryKey: ["acs", "config"],
    queryFn: async () => {
      const { data } = await api.get<{ data: GenieACSConfig }>("/acs/config")
      return data.data
    },
  })
}

export function useUpdateAcsConfig() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: Omit<GenieACSConfig, "apiKeyMasked">) => {
      const { data } = await api.put("/acs/config", payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acs", "config"] })
      toast.success("Konfigurasi GenieACS disimpan")
    },
    onError: () => {
      toast.error("Gagal menyimpan konfigurasi")
    },
  })
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export function useAcsDevices() {
  return useQuery({
    queryKey: ["acs", "devices"],
    queryFn: async () => {
      const { data } = await api.get<{ data: GenieACSDevice[] }>("/acs/devices")
      return data.data
    },
  })
}

export function useAcsDevice(deviceId: string) {
  return useQuery({
    queryKey: ["acs", "devices", deviceId],
    queryFn: async () => {
      const { data } = await api.get<{ data: GenieACSDevice }>(`/acs/devices/${deviceId}`)
      return data.data
    },
    enabled: !!deviceId,
  })
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export function useAcsSync() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: AcsSyncResult }>("/acs/devices/sync")
      return data.data
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["acs", "devices"] })
      toast.success(
        `Sync selesai — ${result.matched} cocok, ${result.unmatched} tidak cocok, ${result.noTag} tanpa tag`,
      )
    },
    onError: () => {
      toast.error("Gagal menyinkronkan data device")
    },
  })
}

// ---------------------------------------------------------------------------
// Device actions
// ---------------------------------------------------------------------------

export function useAcsRebootDevice() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (deviceId: string) => {
      const { data } = await api.post(`/acs/devices/${encodeURIComponent(deviceId)}/reboot`)
      return data
    },
    onSuccess: () => {
      toast.success("Request reboot berhasil dikirim")
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Gagal reboot device"
      toast.error(msg)
    },
  })
}

export function useAcsSetWifi() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      deviceId,
      ssid,
      wifiPassword,
      wlanIndex = 1,
    }: {
      deviceId: string
      ssid: string
      wifiPassword: string
      wlanIndex?: number
    }) => {
      const { data } = await api.post(
        `/acs/devices/${encodeURIComponent(deviceId)}/ssid`,
        { ssid, wifiPassword, wlanIndex },
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acs", "devices"] })
      toast.success("SSID dan password WiFi berhasil diperbarui")
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Gagal update WiFi"
      toast.error(msg)
    },
  })
}
