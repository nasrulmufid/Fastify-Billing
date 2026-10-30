import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowDown,
  ArrowUpDown,
  ArrowUp,
  Banknote,
  CheckCircle2,
  Clock3,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  Loader2,
  MoreHorizontal,
  QrCode,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  formatPrice,
  paymentStatusBadge,
  paymentSource,
  sourceBadgeClass,
  METHOD_OPTIONS,
  STATUS_OPTIONS,
  type Payment,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/paymentData"
import { MONTHS_ID } from "@/lib/dateUtils"
import { usePaymentStore } from "@/store/paymentStore"
import { useInvoiceStore } from "@/store/invoiceStore"
import { exportReportXlsx, exportReportPdf, type ReportRow } from "@/lib/reportExport"

const PAGE_SIZE = 10

const methodIcon: Record<PaymentMethod, typeof QrCode> = {
  QRIS: QrCode,
  Tunai: Banknote,
}

/* ----------------------------------------------------------------
   Util tanggal — payment.date berformat "30 Oktober 2026" (id-ID)
   ---------------------------------------------------------------- */

/** "30 Oktober 2026" -> Date (local midnight) */
function parseIdDate(dateStr: string): Date | null {
  const parts = dateStr.trim().split(/\s+/)
  if (parts.length !== 3) return null
  const day = Number(parts[0])
  const month = MONTHS_ID.indexOf(parts[1]) + 1
  const year = Number(parts[2])
  if (!day || !month || !year) return null
  return new Date(year, month - 1, day)
}

/** "2026-10-30" (input date) -> Date local midnight; null bila kosong/invalid */
function fromInputValue(value: string): Date | null {
  if (!value) return null
  const [y, m, d] = value.split("-").map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** Jenis filter periode cepat */
type QuickRange = "all" | "today" | "7d" | "30d" | "month" | "custom"

const QUICK_RANGE_LABEL: Record<QuickRange, string> = {
  all: "Semua Periode",
  today: "Hari Ini",
  "7d": "7 Hari Terakhir",
  "30d": "30 Hari Terakhir",
  month: "Bulan Ini",
  custom: "Kustom",
}

/* ----------------------------------------------------------------
   Sort
   ---------------------------------------------------------------- */

type SortKey = "code" | "customer" | "method" | "date" | "amount" | "status"
type SortDir = "asc" | "desc"

/* ----------------------------------------------------------------
   Row actions (dipakai di tabel desktop & kartu mobile)
   ---------------------------------------------------------------- */

type PaymentRowActionsProps = {
  payment: Payment
  onDetail: (id: string) => void
  onConfirm: (payment: Payment) => void
  onDelete: (payment: Payment) => void
}

function PaymentRowActions({ payment, onDetail, onConfirm, onDelete }: PaymentRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDetail(payment.id)}>
          <Eye className="mr-2 size-4" />
          Lihat Detail
        </DropdownMenuItem>
        {payment.status === "Pending" && (
          <DropdownMenuItem onClick={() => onConfirm(payment)}>
            <CheckCircle2 className="mr-2 size-4" />
            Tandai Sukses
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-rose-600 focus:text-rose-600"
          onClick={() => onDelete(payment)}
        >
          <Trash2 className="mr-2 size-4" />
          Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ----------------------------------------------------------------
   Page — Laporan Pendapatan
   ---------------------------------------------------------------- */

export function PaymentsPage() {
  const navigate = useNavigate()
  const items = usePaymentStore((s) => s.payments)
  const loadPayments = usePaymentStore((s) => s.load)
  const setStatus = usePaymentStore((s) => s.setStatus)
  const removePayment = usePaymentStore((s) => s.removePayment)
  const invoices = useInvoiceStore((s) => s.invoices)
  const markPaid = useInvoiceStore((s) => s.markPaid)

  // Muat data dari backend saat halaman dibuka
  useEffect(() => {
    void loadPayments()
  }, [loadPayments])

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("all")
  const [methodFilter, setMethodFilter] = useState<"all" | PaymentMethod>("all")
  const [quickRange, setQuickRange] = useState<QuickRange>("all")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState<SortKey | null>("date")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null)

  /* ---------- Rentang tanggal aktif (dari quick range / custom) ---------- */
  const dateRange = useMemo((): { from: Date | null; to: Date | null } => {
    const today = new Date()
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    switch (quickRange) {
      case "today":
        return { from: startOfToday, to: null }
      case "7d":
        return { from: new Date(startOfToday.getTime() - 6 * 86_400_000), to: null }
      case "30d":
        return { from: new Date(startOfToday.getTime() - 29 * 86_400_000), to: null }
      case "month":
        return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: null }
      case "custom":
        return { from: fromInputValue(customFrom), to: fromInputValue(customTo) }
      default:
        return { from: null, to: null }
    }
  }, [quickRange, customFrom, customTo])

  const activeRangeLabel =
    quickRange === "custom" && (customFrom || customTo)
      ? `${customFrom || "…"} s/d ${customTo || "…"}`
      : QUICK_RANGE_LABEL[quickRange]

  const hasActiveFilter =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    methodFilter !== "all" ||
    quickRange !== "all"

  const resetFilters = () => {
    setSearch("")
    setStatusFilter("all")
    setMethodFilter("all")
    setQuickRange("all")
    setCustomFrom("")
    setCustomTo("")
    setPage(0)
  }

  /* ---------- Filtering ---------- */
  const filtered = useMemo(() => {
    let result = items

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.code.toLowerCase().includes(q) ||
          p.customer.toLowerCase().includes(q) ||
          p.invoice.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter)
    }

    if (methodFilter !== "all") {
      result = result.filter((p) => p.method === methodFilter)
    }

    const { from, to } = dateRange
    if (from || to) {
      result = result.filter((p) => {
        const d = parseIdDate(p.date)
        if (!d) return false
        if (from && d < from) return false
        if (to && d > new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1)) return false
        return true
      })
    }

    return result
  }, [items, search, statusFilter, methodFilter, dateRange])

  /* ---------- Ringkasan pendapatan (mengikuti filter aktif) ---------- */
  const report = useMemo(() => {
    const sukses = filtered.filter((p) => p.status === "Sukses")
    const pending = filtered.filter((p) => p.status === "Pending")
    const ditolak = filtered.filter((p) => p.status === "Ditolak")
    const qris = sukses.filter((p) => p.method === "QRIS").reduce((s, p) => s + p.amount, 0)
    const tunai = sukses.filter((p) => p.method === "Tunai").reduce((s, p) => s + p.amount, 0)
    const total = sukses.reduce((s, p) => s + p.amount, 0)
    return {
      total,
      count: sukses.length,
      qris,
      tunai,
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, p) => s + p.amount, 0),
      rejectedCount: ditolak.length,
      rejectedAmount: ditolak.reduce((s, p) => s + p.amount, 0),
      avg: sukses.length ? Math.round(total / sukses.length) : 0,
      largest: sukses.reduce((max, p) => (p.amount > max ? p.amount : max), 0),
    }
  }, [filtered])

  /* ---------- Sorting ---------- */
  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const dir = sortDir === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "amount":
          return (a.amount - b.amount) * dir
        case "date": {
          const da = parseIdDate(a.date)?.getTime() ?? 0
          const db = parseIdDate(b.date)?.getTime() ?? 0
          return (da - db) * dir
        }
        case "code":
          return a.code.localeCompare(b.code, "id") * dir
        case "customer":
          return a.customer.localeCompare(b.customer, "id") * dir
        case "method":
          return a.method.localeCompare(b.method) * dir
        case "status": {
          const order: Record<PaymentStatus, number> = { Sukses: 0, Pending: 1, Ditolak: 2 }
          return (order[a.status] - order[b.status]) * dir
        }
        default:
          return 0
      }
    })
  }, [filtered, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    setPage(0)
    if (sortKey !== key) {
      setSortKey(key)
      // Kolom tanggal & jumlah default desc (terbaru/terbesar dulu)
      setSortDir(key === "date" || key === "amount" ? "desc" : "asc")
    } else if (sortDir === "asc") {
      setSortDir("desc")
    } else {
      setSortKey(null)
      setSortDir("asc")
    }
  }

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="size-3 opacity-40" />
    return sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
  }

  const SortableHead = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => (
    <TableHead className={cn("text-xs font-semibold tracking-wider text-muted-foreground uppercase", className)}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={cn(
          "inline-flex items-center gap-1.5 transition-colors hover:text-foreground",
          sortKey === k && "text-foreground",
        )}
      >
        {label}
        {sortIcon(k)}
      </button>
    </TableHead>
  )

  /* ---------- Pagination ---------- */
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const paginated = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const rangeStart = sorted.length === 0 ? 0 : safePage * PAGE_SIZE + 1
  const rangeEnd = Math.min(sorted.length, safePage * PAGE_SIZE + PAGE_SIZE)

  /* ---------- Aksi ---------- */
  const handleConfirm = async (payment: Payment) => {
    // QRIS: konfirmasi callback gateway -> pembayaran Sukses
    setStatus(payment.id, "Sukses")

    // Tandai invoice terkait lunas dengan metode pembayaran ini
    const invoice = invoices.find((inv) => inv.code === payment.invoice)
    if (invoice && invoice.status !== "Paid") {
      await markPaid(invoice.id, payment.method)
    }

    toast.success("Pembayaran berhasil", {
      description: `${payment.code} (${payment.customer}) — masa aktif diperpanjang 1 bulan.`,
    })
  }

  const handleDelete = async (payment: Payment) => {
    try {
      await removePayment(payment.id)
      toast.success("Pembayaran dihapus", {
        description: `${payment.code} telah dihapus dari daftar.`,
      })
    } catch {
      toast.error("Gagal menghapus pembayaran", {
        description: `${payment.code} gagal dihapus. Coba lagi nanti.`,
      })
    }
  }

  const reportRows: ReportRow[] = useMemo(
    () =>
      sorted.map((p) => ({
        code: p.code,
        customer: p.customer,
        invoice: p.invoice,
        method: p.method,
        date: p.date,
        amount: p.amount,
        status: p.status,
      })),
    [sorted],
  )

  const exportMeta = {
    title: "Laporan Pendapatan",
    periodLabel: activeRangeLabel,
    summary: [
      { label: "Total Pendapatan", value: formatPrice(report.total) },
      { label: "Transaksi Sukses", value: String(report.count) },
      { label: "QRIS", value: formatPrice(report.qris) },
      { label: "Tunai", value: formatPrice(report.tunai) },
    ],
    fileName: "laporan-pendapatan",
  }

  const handleExport = async (format: "xlsx" | "pdf") => {
    if (reportRows.length === 0) {
      toast.error("Tidak ada data untuk diexport")
      return
    }
    setExporting(format)
    try {
      if (format === "xlsx") {
        await exportReportXlsx(reportRows, exportMeta)
        toast.success("Export Excel berhasil", {
          description: `${reportRows.length} transaksi (periode: ${activeRangeLabel}) diexport ke XLSX.`,
        })
      } else {
        exportReportPdf(reportRows, exportMeta)
        toast.success("Export PDF berhasil", {
          description: `${reportRows.length} transaksi (periode: ${activeRangeLabel}) diexport ke PDF.`,
        })
      }
    } catch (err) {
      console.error("Gagal export:", err)
      toast.error("Gagal export", { description: (err as Error)?.message })
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "Laporan Pendapatan" }]}
        title="Laporan Pendapatan"
        description="Rekap pemasukan QRIS & tunai dengan filter periode — semua angka mengikuti filter aktif."
        actions={
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/payments/approval")}>
            <Clock3 className="mr-1.5 size-4" />
            Konfirmasi Pembayaran
            {report.pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                {report.pendingCount}
              </span>
            )}
          </Button>
        }
      />

      {/* ---------- Ringkasan pendapatan (mengikuti filter) ---------- */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">
            Periode laporan: <span className="font-semibold text-primary">{activeRangeLabel}</span>
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total Pendapatan</p>
              <span className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600">
                <Wallet className="size-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatPrice(report.total)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {report.count} transaksi sukses
              {report.count > 0 && <> · rata-rata {formatPrice(report.avg)}</>}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Pemasukan QRIS</p>
              <span className="rounded-xl bg-violet-500/10 p-2 text-violet-600">
                <QrCode className="size-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatPrice(report.qris)}</p>
            <p className="mt-1 text-xs text-muted-foreground">via payment gateway</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Pemasukan Tunai</p>
              <span className="rounded-xl bg-sky-500/10 p-2 text-sky-600">
                <Banknote className="size-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatPrice(report.tunai)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              dicatat admin{report.largest > 0 && <> · terbesar {formatPrice(report.largest)}</>}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Belum Berhasil</p>
              <span className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
                <Clock3 className="size-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatPrice(report.pendingAmount)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {report.pendingCount} pending · {report.rejectedCount} ditolak ({formatPrice(report.rejectedAmount)})
            </p>
          </div>
        </div>
      </div>

      {/* ---------- Toolbar filter ---------- */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="space-y-1.5 lg:w-64">
            <Label htmlFor="search-payment" className="block text-xs text-muted-foreground">
              Cari
            </Label>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="search-payment"
                placeholder="Kode, pelanggan, invoice..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(0)
                }}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="block text-xs text-muted-foreground">Periode</Label>
            <Select
              items={Object.fromEntries(Object.entries(QUICK_RANGE_LABEL))}
              value={quickRange}
              onValueChange={(val) => {
                setQuickRange((val ?? "all") as QuickRange)
                setPage(0)
              }}
            >
              <SelectTrigger className="w-[170px] text-sm">
                <SelectValue placeholder="Semua Periode" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(QUICK_RANGE_LABEL) as QuickRange[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {QUICK_RANGE_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {quickRange === "custom" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="range-from" className="block text-xs text-muted-foreground">
                  Dari
                </Label>
                <Input
                  id="range-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => {
                    setCustomFrom(e.target.value)
                    setPage(0)
                  }}
                  className="w-[150px] text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="range-to" className="block text-xs text-muted-foreground">
                  Sampai
                </Label>
                <Input
                  id="range-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => {
                    setCustomTo(e.target.value)
                    setPage(0)
                  }}
                  className="w-[150px] text-sm"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label className="block text-xs text-muted-foreground">Status</Label>
            <Select
              items={{ all: "Semua status", ...Object.fromEntries(STATUS_OPTIONS.map((s) => [s, s])) }}
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter((val ?? "all") as "all" | PaymentStatus)
                setPage(0)
              }}
            >
              <SelectTrigger className="w-[140px] text-sm">
                <SelectValue placeholder="Semua status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="block text-xs text-muted-foreground">Metode</Label>
            <Select
              items={{ all: "Semua metode", ...Object.fromEntries(METHOD_OPTIONS.map((m) => [m, m])) }}
              value={methodFilter}
              onValueChange={(val) => {
                setMethodFilter((val ?? "all") as "all" | PaymentMethod)
                setPage(0)
              }}
            >
              <SelectTrigger className="w-[140px] text-sm">
                <SelectValue placeholder="Semua metode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua metode</SelectItem>
                {METHOD_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" disabled={exporting !== null || reportRows.length === 0} />
                }
              >
                {exporting ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <FileDown className="mr-1.5 size-4" />
                )}
                {exporting === "xlsx"
                  ? "Membuat Excel…"
                  : exporting === "pdf"
                    ? "Membuat PDF…"
                    : "Export Laporan"}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Pilih format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void handleExport("xlsx")}>
                  <FileSpreadsheet className="mr-2 size-4 text-emerald-600" />
                  <div className="flex flex-col">
                    <span className="font-medium">Excel (.xlsx)</span>
                    <span className="text-[11px] text-muted-foreground">
                      Dengan auto-filter & baris total
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleExport("pdf")}>
                  <FileDown className="mr-2 size-4 text-rose-600" />
                  <div className="flex flex-col">
                    <span className="font-medium">PDF (.pdf)</span>
                    <span className="text-[11px] text-muted-foreground">
                      Siap cetak dgn header & ringkasan
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {hasActiveFilter && (
              <Button variant="ghost" onClick={resetFilters} title="Hapus semua filter">
                <X className="mr-1.5 size-4" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Data Table ---------- */}
      <div className="rounded-xl border border-border bg-card">
        {/* ===== Mobile: kartu per pembayaran ===== */}
        <div className="divide-y divide-border sm:hidden">
          {paginated.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Tidak ada transaksi pada periode ini.
            </p>
          ) : (
            paginated.map((payment) => {
              const Icon = methodIcon[payment.method]
              const source = paymentSource(payment.method)
              return (
                <div key={payment.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-primary">{payment.code}</span>
                      <Badge className={`text-[0.625rem] font-medium ${paymentStatusBadge[payment.status]}`}>
                        {payment.status}
                      </Badge>
                    </div>
                    <PaymentRowActions
                      payment={payment}
                      onDetail={(id) => navigate(`/admin/payments/${id}`)}
                      onConfirm={handleConfirm}
                      onDelete={handleDelete}
                    />
                  </div>
                  <div className="mt-1.5">
                    <p className="text-sm font-semibold">{payment.customer}</p>
                    <p className="text-xs text-muted-foreground">
                      {payment.invoice} · {payment.date}
                    </p>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-dashed border-border pt-2 text-xs">
                    <dt className="text-muted-foreground">Metode</dt>
                    <dd className="flex items-center justify-end gap-1 font-medium">
                      <Icon className="size-3" />
                      {payment.method}
                    </dd>
                    <dt className="text-muted-foreground">Sumber</dt>
                    <dd className="text-right">
                      <Badge className={`text-[0.625rem] font-medium ${sourceBadgeClass[source]}`}>
                        {source}
                      </Badge>
                    </dd>
                    <dt className="text-muted-foreground">Jumlah</dt>
                    <dd className="text-right font-semibold">{formatPrice(payment.amount)}</dd>
                  </dl>
                </div>
              )
            })
          )}
        </div>

        {/* ===== Desktop: tabel dengan sort di table head ===== */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <SortableHead label="Kode" k="code" />
                <SortableHead label="Pelanggan" k="customer" />
                <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Invoice
                </TableHead>
                <SortableHead label="Metode" k="method" />
                <SortableHead label="Tanggal" k="date" />
                <SortableHead label="Jumlah" k="amount" />
                <SortableHead label="Status" k="status" />
                <TableHead className="w-[60px] text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  <span className="sr-only">Aksi</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-28 text-center text-sm text-muted-foreground">
                    Tidak ada transaksi pada periode ini.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((payment) => {
                  const Icon = methodIcon[payment.method]
                  const source = paymentSource(payment.method)
                  return (
                    <TableRow key={payment.id} className="hover:bg-muted/30">
                      <TableCell className="text-sm font-semibold text-primary">{payment.code}</TableCell>
                      <TableCell className="text-sm font-medium">{payment.customer}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{payment.invoice}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Icon className="size-3" />
                            {payment.method}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground/70">
                            {source === "Gateway" ? "via Payment Gateway" : "Tunai di loket"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{payment.date}</TableCell>
                      <TableCell className="text-sm font-semibold tabular-nums">
                        {formatPrice(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs font-medium ${paymentStatusBadge[payment.status]}`}>
                          {payment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <PaymentRowActions
                          payment={payment}
                          onDetail={(id) => navigate(`/admin/payments/${id}`)}
                          onConfirm={handleConfirm}
                          onDelete={handleDelete}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ---------- Pagination ---------- */}
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          Menampilkan <span className="font-medium text-foreground">{rangeStart}-{rangeEnd}</span> dari{" "}
          <span className="font-medium text-foreground">{sorted.length}</span> transaksi
          {quickRange !== "all" && <> (periode {activeRangeLabel.toLowerCase()})</>}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            &lt; Sebelumnya
          </Button>
          <span className="px-2 text-sm text-muted-foreground">
            Halaman {safePage + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            Selanjutnya &gt;
          </Button>
        </div>
      </div>
    </div>
  )
}
