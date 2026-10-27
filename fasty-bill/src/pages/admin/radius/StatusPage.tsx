/**
 * Halaman Status & Log RADIUS — ringkasan 24 jam + log autentikasi terbaru.
 */

import { Loader2, ShieldCheck, ShieldX, Users, Wifi } from "lucide-react"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useRadiusLogs, useRadiusStatus } from "@/hooks/queries/useRadiusQueries"

function StatCard({
  title,
  value,
  icon: Icon,
  tone = "primary",
}: {
  title: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  tone?: "primary" | "success" | "danger" | "muted"
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600",
    danger: "bg-rose-500/10 text-rose-600",
    muted: "bg-muted text-muted-foreground",
  }[tone]
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`rounded-lg p-3 ${toneClass}`}>
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function RadiusStatusPage() {
  const { data: status, isLoading } = useRadiusStatus()
  const { data: logs, isLoading: logsLoading } = useRadiusLogs(50)

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "RADIUS" }]}
        title="Status RADIUS"
        description="Ringkasan autentikasi FreeRADIUS 24 jam terakhir (radpostauth) dan sesi aktif."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Auth sukses (24 jam)" value={status?.accepts24h ?? 0} icon={ShieldCheck} tone="success" />
        <StatCard title="Auth gagal (24 jam)" value={status?.rejects24h ?? 0} icon={ShieldX} tone="danger" />
        <StatCard title="Sesi aktif" value={status?.activeSessions ?? 0} icon={Wifi} />
        <StatCard title="Router memakai RADIUS" value={status?.radiusRouters ?? 0} icon={Users} tone="muted" />
      </div>

      {isLoading && (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/40 px-4 py-3 text-sm font-semibold">
          Log autentikasi terbaru
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead>Waktu</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Hasil</TableHead>
              <TableHead>NAS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logsLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : !logs?.length ? (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-sm text-muted-foreground">
                  Belum ada aktivitas autentikasi.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-sm text-muted-foreground">{l.time}</TableCell>
                  <TableCell className="font-mono text-xs">{l.username}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        l.reply === "Access-Accept"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                      }
                    >
                      {l.reply}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.nasIp}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
