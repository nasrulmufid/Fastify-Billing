import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Banknote,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  MoreHorizontal,
  QrCode,
  Search,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  formatPrice,
  paymentStatusBadge,
  paymentSource,
  sourceBadgeClass,
  METHOD_OPTIONS,
  STATUS_OPTIONS,
  type Payment,
  type PaymentMethod,
} from "@/lib/paymentData"
import { usePaymentStore } from "@/store/paymentStore"
import { useInvoiceStore } from "@/store/invoiceStore"
import { useCustomers } from "@/lib/customerStore"

const PAGE_SIZE = 8

const methodIcon: Record<PaymentMethod, typeof QrCode> = {
  QRIS: QrCode,
  Tunai: Banknote,
}

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
      <DropdownMenuTrigger>
        <Button variant="ghost" size="icon-sm">
          <MoreHorizontal className="size-4" />
        </Button>
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
   Page
   ---------------------------------------------------------------- */

export function PaymentsPage() {
  const navigate = useNavigate()
  const items = usePaymentStore((s) => s.payments)
  const setStatus = usePaymentStore((s) => s.setStatus)
  const removePayment = usePaymentStore((s) => s.removePayment)
  const invoices = useInvoiceStore((s) => s.invoices)
  const markPaid = useInvoiceStore((s) => s.markPaid)
  const customers = useCustomers()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")
  const [page, setPage] = useState(0)

  /* ---------- Statistik ringkasan ---------- */
  const stats = useMemo(() => {
    const sukses = items.filter((p) => p.status === "Sukses")
    const pending = items.filter((p) => p.status === "Pending")
    const ditolak = items.filter((p) => p.status === "Ditolak")
    return {
      totalReceived: sukses.reduce((sum, p) => sum + p.amount, 0),
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, p) => sum + p.amount, 0),
      rejectedCount: ditolak.length,
      rejectedAmount: ditolak.reduce((sum, p) => sum + p.amount, 0),
    }
  }, [items])

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

    return result
  }, [items, search, statusFilter, methodFilter])

  /* ---------- Pagination ---------- */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const paginated = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const rangeStart = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1
  const rangeEnd = Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE)

  /* ---------- Aksi ---------- */
  const handleConfirm = async (payment: Payment) => {
    // QRIS: konfirmasi callback gateway -> pembayaran Sukses
    setStatus(payment.id, "Sukses")

    // Tandai invoice terkait lunas dengan metode pembayaran ini
    // Note: backend completePaymentFlow sudah update expiry_at customer + status Active
    // Tidak perlu extendExpiry lagi di frontend (akan double extend)
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

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      toast.error("Tidak ada data untuk diexport")
      return
    }
    const header = ["Kode", "Pelanggan", "Invoice", "Metode", "Tanggal", "Jumlah", "Status"]
    const rows = filtered.map((p) => [
      p.code,
      p.customer,
      p.invoice,
      p.method,
      p.date,
      formatPrice(p.amount),
      p.status,
    ])
    const csv = "\uFEFF" + [header, ...rows].map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "daftar-pembayaran.csv"
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Export CSV berhasil", { description: `${filtered.length} pembayaran diexport.` })
  }

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "Pembayaran" }]}
        title="Daftar Pembayaran"
        description="QRIS via gateway otomatis & pembayaran tunai yang dicatat dari menu Invoice."
        actions={
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/payments/approval")}>
            <Clock3 className="mr-1.5 size-4" />
            Konfirmasi Pembayaran
            {stats.pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                {stats.pendingCount}
              </span>
            )}
          </Button>
        }
      />

      {/* ---------- Alur pembayaran ---------- */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/40 dark:bg-violet-950/30">
          <QrCode className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" />
          <div>
            <p className="text-sm font-semibold">QRIS — Pembayaran Gateway</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Pelanggan scan QRIS dari link payment gateway. Jika berhasil, sistem otomatis
              menandai Sukses &amp; memperpanjang masa aktif layanan.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <Banknote className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-semibold">Tunai — Dicatat dari Menu Invoice</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Pelanggan bayar tunai ke admin. Admin menandai invoice lunas (metode Tunai) di
              menu Invoice — masa aktif otomatis diperpanjang.
            </p>
          </div>
        </div>
      </div>

      {/* ---------- Statistik ---------- */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Total Diterima</p>
            <span className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600">
              <Wallet className="size-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatPrice(stats.totalReceived)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {items.filter((p) => p.status === "Sukses").length} transaksi sukses
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">QRIS Menunggu Gateway</p>
            <span className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
              <Clock3 className="size-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {stats.pendingCount} transaksi
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{formatPrice(stats.pendingAmount)} menunggu callback</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">Ditolak</p>
            <span className="rounded-xl bg-rose-500/10 p-2 text-rose-600">
              <XCircle className="size-4" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {stats.rejectedCount} transaksi
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{formatPrice(stats.rejectedAmount)} ditolak</p>
        </div>
      </div>

      {/* ---------- Toolbar ---------- */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-sm">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari kode, pelanggan, atau invoice..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val ?? "all")
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

          <Select
            value={methodFilter}
            onValueChange={(val) => {
              setMethodFilter(val ?? "all")
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

          <Button variant="outline" onClick={handleExportCsv}>
            <Download className="mr-1.5 size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ---------- Data Table ---------- */}
      <div className="rounded-xl border border-border bg-card">
        {/* ===== Mobile: kartu per pembayaran ===== */}
        <div className="divide-y divide-border sm:hidden">
          {paginated.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Tidak ada pembayaran ditemukan.
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

        {/* ===== Desktop: tabel ===== */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Kode
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Pelanggan
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Invoice
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Metode
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Tanggal
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Jumlah
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Status
                </TableHead>
                <TableHead className="w-[60px] text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  <span className="sr-only">Aksi</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-28 text-center text-sm text-muted-foreground">
                    Tidak ada pembayaran ditemukan.
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
          <span className="font-medium text-foreground">{filtered.length}</span> pembayaran
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
