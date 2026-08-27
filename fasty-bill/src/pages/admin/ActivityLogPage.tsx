import { useState, useEffect } from "react"
import { LoaderCircle } from "lucide-react"
import { PageHeader } from "@/components/layouts/PageHeader"
import api from "@/lib/axios"
import { useAuthStore } from "@/store/useAppStore"

interface ActivityLog {
  id: string
  actor: string
  action: string
  target: string
  time: string
}

export function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const token = useAuthStore((s) => s.token)

  useEffect(() => {
    if (!token) return
    api.get("/activity-logs", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        setLogs(res.data.data || [])
        setLoading(false)
      })
      .catch(() => {
        setLogs([])
        setLoading(false)
      })
  }, [token])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-label="Memuat log aktivitas">
        <LoaderCircle className="size-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Memuat log aktivitas</span>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "Log Aktivitas" }]}
        title="Log Aktivitas"
        description="Riwayat aktivitas seluruh sistem."
      />

      {logs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
          Belum ada log aktivitas.
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] border-b border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-muted-foreground">
            <span>Waktu</span>
            <span>Pelaku</span>
            <span>Aksi</span>
            <span>Target</span>
          </div>
          {logs.map((log, i) => (
            <div key={log.id} className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center border-b border-border px-4 py-3 text-sm last:border-b-0">
              <span className="text-muted-foreground">{log.time}</span>
              <span className="font-medium">{log.actor}</span>
              <span>{log.action}</span>
              <span className="text-muted-foreground">{log.target}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
