/**
 * Halaman Sesi Online RADIUS — daftar PPPoE aktif + tombol disconnect.
 */

import { useMemo, useState } from "react"
import { Loader2, LogOut, RefreshCw, Search, Wifi } from "lucide-react"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { useDisconnectSession, useRadiusSessions, type RadiusSession } from "@/hooks/queries/useRadiusQueries"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}h ${h}j`
  if (h > 0) return `${h}j ${m}m`
  return `${m}m`
}

function SessionRowActions({ session }: { session: RadiusSession }) {
  const disconnect = useDisconnectSession()
  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={disconnect.isPending}
      onClick={() => disconnect.mutate(session.id)}
    >
      {disconnect.isPending ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <LogOut className="mr-1.5 size-3.5" />}
      Disconnect
    </Button>
  )
}

export function RadiusSessionsPage() {
  const { data: sessions, isLoading, refetch, isFetching } = useRadiusSessions()
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!sessions) return []
    const q = search.trim().toLowerCase()
    if (!q) return sessions
    return sessions.filter(
      (s) =>
        s.username.toLowerCase().includes(q) ||
        (s.customerName ?? "").toLowerCase().includes(q) ||
        s.framedIp.includes(q),
    )
  }, [sessions, search])

  const totalDown = filtered.reduce((sum, s) => sum + s.inputOctets, 0)
  const totalUp = filtered.reduce((sum, s) => sum + s.outputOctets, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", to: "/admin" },
          { label: "RADIUS", to: "/admin/radius/status" },
          { label: "Sesi Online" },
        ]}
        title="Sesi Online"
        description="Sesi PPPoE aktif dari tabel accounting FreeRADIUS (radacct)."
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className="mr-1.5 size-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-lg bg-primary/10 p-3">
              <Wifi className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sesi aktif</p>
              <p className="text-2xl font-semibold">{filtered.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total unduh</p>
            <p className="text-2xl font-semibold">{formatBytes(totalDown)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total unggah</p>
            <p className="text-2xl font-semibold">{formatBytes(totalUp)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari username, pelanggan, atau IP..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Username</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>NAS</TableHead>
              <TableHead>Durasi</TableHead>
              <TableHead>Unduh</TableHead>
              <TableHead>Unggah</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-28 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-28 text-center text-sm text-muted-foreground">
                  Tidak ada sesi aktif.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.username}</TableCell>
                  <TableCell className="text-sm">{s.customerName ?? <Badge variant="outline">Tidak dikenal</Badge>}</TableCell>
                  <TableCell className="font-mono text-xs">{s.framedIp}</TableCell>
                  <TableCell className="font-mono text-xs">{s.nasIp}</TableCell>
                  <TableCell className="text-sm">{formatDuration(s.sessionTime)}</TableCell>
                  <TableCell className="text-sm">{formatBytes(s.inputOctets)}</TableCell>
                  <TableCell className="text-sm">{formatBytes(s.outputOctets)}</TableCell>
                  <TableCell>
                    <SessionRowActions session={s} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
