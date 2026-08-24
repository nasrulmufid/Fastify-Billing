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
import { Users, FileText, AlertTriangle, Wallet, Clock } from "lucide-react"

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
import { useCustomers } from "@/lib/customerStore"

/* ================================================================
   Data
   ================================================================ */

const stats = [
  {
    label: "Total Pelanggan",
    value: "248",
    change: "+12% vs bulan lalu",
    icon: Users,
    gradient: "from-indigo-500/10 via-indigo-500/5 to-transparent",
    iconBg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300",
  },
  {
    label: "Tagihan Tertunggak",
    value: "31",
    change: "Rp 4.2 jt overdue",
    icon: FileText,
    gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
    iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  },
  {
    label: "Pelanggan Isolir",
    value: "9",
    change: "2 perlu tindakan",
    icon: AlertTriangle,
    gradient: "from-rose-500/10 via-rose-500/5 to-transparent",
    iconBg: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",
  },
  {
    label: "Pemasukan Bulan Ini",
    value: "Rp 18.4 jt",
    change: "+8% YoY",
    icon: Wallet,
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
]

const revenueTrend = [
  { date: "1 Ags", revenue: 0.6 },
  { date: "5 Ags", revenue: 1.4 },
  { date: "10 Ags", revenue: 3.1 },
  { date: "15 Ags", revenue: 5.8 },
  { date: "20 Ags", revenue: 9.2 },
  { date: "25 Ags", revenue: 13.5 },
  { date: "30 Ags", revenue: 18.4 },
]

const recentActivity = [
  { time: "2 menit lalu", activity: "Pembayaran sukses", detail: "Budi Santoso — invoice #INV-1042", status: "success" as const },
  { time: "12 menit lalu", activity: "Isolir otomatis", detail: "3 pelanggan melewati grace period", status: "warning" as const },
  { time: "1 jam lalu", activity: "Invoice terbit", detail: "12 invoice bulan Agustus dibuat", status: "info" as const },
  { time: "3 jam lalu", activity: "Pelanggan baru", detail: "Ahmad Dahlan — Paket 20 Mbps", status: "info" as const },
  { time: "5 jam lalu", activity: "Pembayaran diterima", detail: "Rizki — invoice #INV-1041", status: "success" as const },
]

const statusVariant: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
}

const invoicesNearDue = [
  { no: "INV-1042", customer: "Budi Santoso", amount: "Rp 250.000", due: "08 Agu 2026", daysLeft: 2, status: "critical" as const },
  { no: "INV-1041", customer: "Rizki Ramadhan", amount: "Rp 450.000", due: "09 Agu 2026", daysLeft: 3, status: "warning" as const },
  { no: "INV-1040", customer: "Siti Aminah", amount: "Rp 200.000", due: "12 Agu 2026", daysLeft: 6, status: "warning" as const },
  { no: "INV-1039", customer: "Ahmad Dahlan", amount: "Rp 300.000", due: "15 Agu 2026", daysLeft: 9, status: "normal" as const },
  { no: "INV-1038", customer: "Dewi Lestari", amount: "Rp 500.000", due: "18 Agu 2026", daysLeft: 12, status: "normal" as const },
]

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
      <p className="text-primary">Rp {payload[0].value} jt</p>
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
    {
      name: "Suspend",
      value: customers.filter((c) => c.status === "Pending").length,
      color: "hsl(45.4 93.4% 47.5%)",
    },
  ]

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
        {stats.map((item) => {
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
              <p className="text-sm text-muted-foreground">30 hari terakhir (juta Rupiah)</p>
            </div>
            <Badge variant="outline" className="text-xs font-normal">
              +8% YoY
            </Badge>
          </CardHeader>
          <CardContent>
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
                  tickFormatter={(v) => `${v} jt`}
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
        </CardContent>
      </Card>
    </div>
  )
}
