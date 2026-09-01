import { useState, useEffect } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Users, FileText, AlertTriangle, Wallet, Clock, Loader2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCustomers } from "@/lib/customerStore"
import api from "@/lib/axios"
import { useAuthStore } from "@/store/useAppStore"

/* ================================================================
   Types
   ================================================================ */

interface DashboardStats {
  totalCustomers: number
  unpaidInvoices: number
  unpaidAmount: number
  isolatedCustomers: number
  monthRevenue: number
}

interface RevenuePoint {
  date: string
  revenue: number
}

interface ActivityItem {
  time: string
  activity: string
  detail: string
  status: "success" | "warning" | "info"
}

interface InvoiceNearDue {
  no: string
  customer: string
  amount: string
  due: string
  daysLeft: number
  status: "critical" | "warning" | "normal"
}

type RevenuePeriod = 1 | 6 | 12

function formatRevenue(valueInMillions: number): string {
  if (valueInMillions > 0 && valueInMillions < 1) {
    return `${Math.round(valueInMillions * 1_000).toLocaleString("id-ID")} rb`
  }
  return `${valueInMillions.toLocaleString("id-ID")} jt`
}

const statusVariant: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
}

const dueStatusVariant: Record<string, string> = {
  critical: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  normal: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
}

/* ================================================================
   Custom Tooltip
   ================================================================ */

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{label}</p>
      <p className="text-primary">Rp {formatRevenue(Number(payload[0].value))}</p>
    </div>
  )
}

function PieTooltip({ active, payload, total }: any) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: entry.payload?.color ?? "var(--color-primary)" }}
        />
        <span className="font-medium">{entry.name}</span>
      </div>
      <p className="text-muted-foreground">
        {entry.value} pelanggan · {pct}%
      </p>
    </div>
  )
}

/* ================================================================
   Dashboard Page
   ================================================================ */

export function AdminDashboard() {
  const customers = useCustomers()
  const token = useAuthStore((s) => s.token)

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [revenueTrend, setRevenueTrend] = useState<RevenuePoint[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [revenuePeriod, setRevenuePeriod] = useState<RevenuePeriod>(12)
  const [revenueLoading, setRevenueLoading] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    const fetchAll = async () => {
      try {
        const [statsRes, actRes] = await Promise.all([
          api.get("/dashboard/stats", { headers: { Authorization: `Bearer ${token}` } }),
          api.get("/dashboard/activity", { headers: { Authorization: `Bearer ${token}` } }),
        ])
        setStats(statsRes.data.data)
        setRecentActivity((actRes.data.data || []).map((a: any) => ({
          ...a,
          status: a.action?.includes("isolir") ? "warning" as const : "info" as const,
        })))
      } catch (err) {
        console.error("Gagal memuat dashboard:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [token])

  useEffect(() => {
    if (!token) return
    const fetchRevenue = async () => {
      setRevenueLoading(true)
      try {
        const response = await api.get(`/dashboard/revenue?months=${revenuePeriod}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setRevenueTrend(response.data.data || [])
      } catch (err) {
        console.error("Gagal memuat tren pemasukan:", err)
        setRevenueTrend([])
      } finally {
        setRevenueLoading(false)
      }
    }
    fetchRevenue()
  }, [token, revenuePeriod])

  const customerStatusDist = [
    {
      name: "Aktif",
      value: customers.filter((c) => c.status === "Active").length,
      color: "var(--color-primary)",
    },
    {
      name: "Isolir",
      value: customers.filter((c) => c.status === "Isolated").length,
      color: "hsl(0 72.2% 50.6%)",
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-label="Memuat dashboard">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  const statCards = stats
    ? [
        {
          label: "Total Pelanggan",
          value: String(stats.totalCustomers),
          change: "+12% vs bulan lalu",
          icon: Users,
          gradient: "from-indigo-500/10 via-indigo-500/5 to-transparent",
          iconBg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300",
        },
        {
          label: "Tagihan Tertunggak",
          value: String(stats.unpaidInvoices),
          change: `Rp ${(stats.unpaidAmount / 1_000).toFixed(1)} jt overdue`,
          icon: FileText,
          gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
          iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
        },
        {
          label: "Pelanggan Isolir",
          value: String(stats.isolatedCustomers),
          change: `${stats.isolatedCustomers} perlu tindakan`,
          icon: AlertTriangle,
          gradient: "from-rose-500/10 via-rose-500/5 to-transparent",
          iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",
        },
        {
          label: "Pemasukan Bulan Ini",
          value: `Rp ${(stats.monthRevenue / 1_000_000).toFixed(1)} jt`,
          change: "+8% YoY",
          icon: Wallet,
          gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
          iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
        },
      ]
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Dashboard operasional</p>
          <h2 className="text-2xl font-semibold tracking-tight">Ringkasan Billing RT/RW Net</h2>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((item) => {
          const Icon = item.icon
          return (
            <Card
              key={item.label}
              className={`relative overflow-hidden border-border bg-gradient-to-br ${item.gradient}`}
            >
              <CardContent className="px-5 py-2">
                <div className={`absolute right-4 top-4 rounded-2xl p-3.5 opacity-50 ${item.iconBg}`}>
                  <Icon className="h-8 w-8" />
                </div>
                <div className="mt-4 pr-16">
                  <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">{item.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.change}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts Section — Area (2/3) + Pie (1/3) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue area chart */}
        <Card className="border-border sm:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg font-semibold">Tren Pemasukan</CardTitle>
              <p className="text-sm text-muted-foreground">
                {revenuePeriod === 1 ? "1 bulan terakhir" : `${revenuePeriod} bulan terakhir`} (Rupiah)
              </p>
            </div>
            <Select
              value={String(revenuePeriod)}
              onValueChange={(value) => setRevenuePeriod(Number(value) as RevenuePeriod)}
            >
              <SelectTrigger className="h-8 w-30 text-xs" aria-label="Periode grafik pemasukan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Bulan</SelectItem>
                <SelectItem value="6">6 Bulan</SelectItem>
                <SelectItem value="12">12 Bulan</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                Memuat data pemasukan...
              </div>
            ) : revenueTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={revenueTrend} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                    tickFormatter={(v) => formatRevenue(Number(v))}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#revenueGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                Belum ada data pemasukan
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer status pie chart */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">Status Pelanggan</CardTitle>
            <p className="text-sm text-muted-foreground">Total pelanggan per status</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={customerStatusDist}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {customerStatusDist.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip total={customers.length} />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
              {customerStatusDist.map((st) => (
                <div key={st.name} className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: st.color }} />
                  <span className="text-muted-foreground">{st.name}</span>
                  <span className="ml-auto mr-4 font-medium tabular-nums">{st.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices near due date */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg font-semibold">Invoice Mendekati Jatuh Tempo</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs font-normal">
              {invoicesNearDue.filter((inv) => inv.status !== "normal").length} butuh perhatian
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {invoicesNearDue.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Tidak ada invoice yang mendekati jatuh tempo
            </div>
          ) : (
            <>
              {/* ===== Mobile: kartu per invoice ===== */}
              <div className="divide-y divide-border sm:hidden">
                {invoicesNearDue.map((inv) => (
                  <div key={inv.no} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{inv.no}</span>
                      <Badge className={`text-xs ${dueStatusVariant[inv.status] ?? ""}`}>
                        {inv.status === "critical"
                          ? `Sisa ${inv.daysLeft} hari`
                          : `${inv.daysLeft} hari lagi`}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{inv.customer}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-dashed border-border pt-2 text-sm">
                      <dt className="text-muted-foreground">Jumlah</dt>
                      <dd className="text-right font-medium">{inv.amount}</dd>
                      <dt className="text-muted-foreground">Jatuh Tempo</dt>
                      <dd className="text-right text-muted-foreground">{inv.due}</dd>
                    </dl>
                  </div>
                ))}
              </div>
              {/* ===== Desktop: tabel ===== */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px] text-sm">No. Invoice</TableHead>
                      <TableHead className="text-sm">Pelanggan</TableHead>
                      <TableHead className="w-[120px] text-sm">Jumlah</TableHead>
                      <TableHead className="w-[130px] text-sm">Jatuh Tempo</TableHead>
                      <TableHead className="w-[130px] text-sm">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoicesNearDue.map((inv) => (
                      <TableRow key={inv.no}>
                        <TableCell className="text-sm font-medium">{inv.no}</TableCell>
                        <TableCell className="text-sm">{inv.customer}</TableCell>
                        <TableCell className="text-sm">{inv.amount}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{inv.due}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${dueStatusVariant[inv.status] ?? ""}`}>
                            {inv.status === "critical"
                              ? `Sisa ${inv.daysLeft} hari`
                              : inv.status === "warning"
                                ? `${inv.daysLeft} hari lagi`
                                : `${inv.daysLeft} hari lagi`}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity Table */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Aktivitas Terkini</CardTitle>
            <p className="text-sm text-muted-foreground">Realtime</p>
          </div>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Belum ada aktivitas terkini
            </div>
          ) : (
            <>
              {/* ===== Mobile: kartu per aktivitas ===== */}
              <div className="divide-y divide-border sm:hidden">
                {recentActivity.map((row, i) => (
                  <div key={i} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{row.activity}</span>
                      <Badge className={`text-xs ${statusVariant[row.status] ?? ""}`}>
                        {row.status === "success"
                          ? "Sukses"
                          : row.status === "warning"
                            ? "Peringatan"
                            : "Info"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{row.detail}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground/70">{row.time}</p>
                  </div>
                ))}
              </div>
              {/* ===== Desktop: tabel ===== */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px] text-sm">Waktu</TableHead>
                      <TableHead className="text-sm">Aktivitas</TableHead>
                      <TableHead className="text-sm">Detail</TableHead>
                      <TableHead className="w-[110px] text-sm">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentActivity.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs text-muted-foreground">{row.time}</TableCell>
                        <TableCell className="text-sm font-medium">{row.activity}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.detail}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${statusVariant[row.status] ?? ""}`}>
                            {row.status === "success" ? "Sukses" : row.status === "warning" ? "Peringatan" : "Info"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
