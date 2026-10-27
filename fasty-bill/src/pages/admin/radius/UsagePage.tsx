/**
 * Halaman Pemakaian RADIUS — agregasi radacct per pelanggan.
 */

import { useState } from "react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Loader2 } from "lucide-react"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useRadiusUsage } from "@/hooks/queries/useRadiusQueries"

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

export function RadiusUsagePage() {
  const [customerId, setCustomerId] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const { data, isLoading } = useRadiusUsage({
    customerId: customerId ? Number(customerId) : undefined,
    from: from || undefined,
    to: to || undefined,
  })

  const chartData = (data ?? []).slice(0, 10).map((u) => ({
    name: u.name,
    total: Number(((u.inputOctets + u.outputOctets) / 1024 / 1024 / 1024).toFixed(2)),
  }))

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", to: "/admin" },
          { label: "RADIUS", to: "/admin/radius/status" },
          { label: "Pemakaian" },
        ]}
        title="Pemakaian"
        description="Rekap unduh/unggah per pelanggan dari sesi yang sudah berakhir (radacct)."
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="usage-cust">ID Pelanggan</Label>
            <Input
              id="usage-cust"
              type="number"
              placeholder="Semua"
              className="w-36"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="usage-from">Dari</Label>
            <Input id="usage-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="usage-to">Sampai</Label>
            <Input id="usage-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>10 pelanggan pemakaian terbesar (GB)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="total" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Pelanggan</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Sesi</TableHead>
              <TableHead>Unduh</TableHead>
              <TableHead>Unggah</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : !data?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">
                  Belum ada data pemakaian.
                </TableCell>
              </TableRow>
            ) : (
              data.map((u) => (
                <TableRow key={u.customerId}>
                  <TableCell className="text-sm">
                    <span className="font-medium">{u.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{u.code}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{u.pppoeUsername}</TableCell>
                  <TableCell className="text-sm">{u.sessions}</TableCell>
                  <TableCell className="text-sm">{formatBytes(u.inputOctets)}</TableCell>
                  <TableCell className="text-sm">{formatBytes(u.outputOctets)}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {formatBytes(u.inputOctets + u.outputOctets)}
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
