import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  AlertTriangle,
  BellRing,
  Inbox,
  Loader2,
  MessageCircle,
  RotateCcw,
  Send,
  Wallet,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import api from "@/lib/axios"

type Channel = "WhatsApp" | "Telegram"
type NotificationStatus = "Terkirim" | "Gagal"
type ActivityType = "payment" | "isolir" | "due" | "reminder" | "ticket"
type FilterKey = "Semua" | NotificationStatus

type NotificationLog = {
  id: string
  code: string
  type: ActivityType
  customer: string
  channel: Channel
  time: string
  status: NotificationStatus
}

const activityMeta: Record<ActivityType, { label: string; icon: LucideIcon }> = {
  payment: { label: "Pembayaran berhasil", icon: Wallet },
  isolir: { label: "Isolir otomatis", icon: AlertTriangle },
  due: { label: "Tagihan jatuh tempo", icon: BellRing },
  reminder: { label: "Pengingat tagihan", icon: BellRing },
  ticket: { label: "Tiket diperbarui", icon: MessageCircle },
}

const channelBadge: Record<Channel, string> = {
  WhatsApp: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Telegram: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
}

const statusBadge: Record<NotificationStatus, string> = {
  Terkirim: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Gagal: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
}

const filters: { key: FilterKey; label: string }[] = [
  { key: "Semua", label: "Semua" },
  { key: "Terkirim", label: "Terkirim" },
  { key: "Gagal", label: "Gagal" },
]

/* ----------------------------------------------------------------
   Component
   ---------------------------------------------------------------- */

export function NotificationsPage() {
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>("Semua")
  const [telegramEnabled, setTelegramEnabled] = useState(true)
  const [resending, setResending] = useState<string | null>(null)

  /* Load notifications from backend */
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get("/notifications").then(({ data }) => {
      if (cancelled) return
      const items = (data.data ?? []) as Record<string, unknown>[]
      setLogs(
        items.map((r) => ({
          id: String(r.id),
          code: (r.code ?? "") as string,
          type: (r.type ?? "payment") as ActivityType,
          customer: (r.customer ?? "") as string,
          channel: (r.channel ?? "WhatsApp") as Channel,
          status: (r.status ?? "Terkirim") as NotificationStatus,
          time: (r.time ?? "") as string,
        }))
      )
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const counts: Record<FilterKey, number> = useMemo(() => ({
    Semua: logs.length,
    Terkirim: logs.filter((l) => l.status === "Terkirim").length,
    Gagal: logs.filter((l) => l.status === "Gagal").length,
  }), [logs])

  const filtered = filter === "Semua" ? logs : logs.filter((l) => l.status === filter)

  const handleResend = async (log: NotificationLog) => {
    setResending(log.id)
    try {
      await api.post(`/notifications/${log.id}/resend`)
      setLogs((prev) =>
        prev.map((l) => (l.id === log.id ? { ...l, status: "Terkirim" } : l)),
      )
      toast.success("Notifikasi dikirim ulang", {
        description: `${activityMeta[log.type].label} untuk ${log.customer} dikirim via ${log.channel}.`,
      })
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Gagal mengirim ulang")
    } finally {
      setResending(null)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "Notifikasi" }]}
        title="Notifikasi"
        description="Log notifikasi otomatis dari aktivitas pelanggan."
      />

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Filter / statistik */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
        {filters.map((f) => {
          const active = filter === f.key
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition-colors sm:p-4",
                active ? "ring-2 ring-primary/40" : "hover:bg-muted/50",
              )}
            >
              <p className="text-xs text-muted-foreground sm:text-sm">{f.label}</p>
              <p className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{counts[f.key]}</p>
            </button>
          )
        })}
      </div>
      )}

      {/* Kanal pengiriman */}
      {!loading && (
        <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border">
          <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <MessageCircle className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">WA Gateway</h3>
                  <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                </div>
                <p className="truncate text-sm text-muted-foreground">Device terhubung dan siap mengirim.</p>
              </div>
            </div>
            <Link to="/admin/wa-gateway">
              <Button variant="outline">Kelola</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Send className="size-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold">Telegram admin</h3>
                <p className="truncate text-sm text-muted-foreground">
                  Notifikasi operasional ke grup internal.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {telegramEnabled ? "Aktif" : "Nonaktif"}
              </span>
              <Switch
                checked={telegramEnabled}
                onCheckedChange={(v) => {
                  const on = v === true
                  setTelegramEnabled(on)
                  if (on) {
                    toast.success("Telegram diaktifkan", {
                      description: "Notifikasi operasional akan dikirim ke grup internal.",
                    })
                  } else {
                    toast.info("Telegram dinonaktifkan", {
                      description: "Notifikasi Telegram dihentikan sementara.",
                    })
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Daftar log notifikasi — mobile card list */}
      <div className="divide-y divide-border rounded-xl border border-border bg-card sm:hidden">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Inbox className="size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Tidak ada notifikasi berstatus {filter.toLowerCase()}.
            </p>
          </div>
        )}
        {filtered.map((log) => {
          const meta = activityMeta[log.type] ?? { label: String(log.type), icon: Inbox }
          const Icon = meta.icon
          return (
            <div key={log.id} className="flex items-center gap-3 px-3.5 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{meta.label}</p>
                  <Badge className={cn("shrink-0 text-[0.625rem]", statusBadge[log.status])}>
                    {log.status}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {log.customer} · {log.channel}
                </p>
                <p className="text-[11px] text-muted-foreground/70">{log.time}</p>
              </div>
              {log.status === "Gagal" && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleResend(log)}
                  disabled={resending === log.id}
                  aria-label={`Kirim ulang ${log.id}`}
                >
                  {resending === log.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="size-3.5" />
                  )}
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {/* Daftar log notifikasi — desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Waktu</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Aktivitas</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Pelanggan</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Kanal</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="w-[90px] text-xs uppercase tracking-wider text-muted-foreground">
                  <span className="sr-only">Aksi</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => {
                const meta = activityMeta[log.type] ?? { label: String(log.type), icon: Inbox }
                const Icon = meta.icon
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground">{log.time}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Icon className="size-3.5" />
                        </span>
                        <span className="text-sm font-medium">{meta.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{log.customer}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", channelBadge[log.channel])}>{log.channel}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", statusBadge[log.status])}>{log.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {log.status === "Gagal" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleResend(log)}
                          disabled={resending === log.id}
                          aria-label={`Kirim ulang ${log.id}`}
                        >
                          {resending === log.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="size-3.5" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Inbox className="size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Tidak ada notifikasi berstatus {filter.toLowerCase()}.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
