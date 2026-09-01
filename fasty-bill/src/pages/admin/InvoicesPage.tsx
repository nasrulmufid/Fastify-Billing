import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Banknote, Eye, MoreHorizontal, Search, Trash2 } from "lucide-react"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  formatPrice,
  paymentMethodBadge,
  type PaymentMethod,
} from "@/lib/paymentData"
import {
  statusLabel,
  statusBadgeClass,
  type Invoice,
  type InvoiceStatus,
} from "@/store/invoiceStore"
import { useInvoiceStore } from "@/store/invoiceStore"
import { useCustomers } from "@/lib/customerStore"

const PAGE_SIZE = 8

const STATUS_OPTIONS: InvoiceStatus[] = ["Paid", "Unpaid", "Overdue"]

const methodIcon: Record<PaymentMethod, typeof Banknote> = {
  QRIS: Banknote,
  Tunai: Banknote,
}

/* ----------------------------------------------------------------
   Row actions (dipakai di tabel desktop & kartu mobile)
   ---------------------------------------------------------------- */

type InvoiceRowActionsProps = {
  invoice: Invoice
  onDetail: (id: string) => void
  onMarkPaid: (invoice: Invoice) => void
  onDelete: (invoice: Invoice) => void
}

function InvoiceRowActions({ invoice, onDetail, onMarkPaid, onDelete }: InvoiceRowActionsProps) {
  const canPay = invoice.status !== "Paid"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDetail(invoice.id)}>
          <Eye className="mr-2 size-4" />
          Lihat Detail
        </DropdownMenuItem>
        {canPay && (
          <DropdownMenuItem onClick={() => onMarkPaid(invoice)}>
            <Banknote className="mr-2 size-4" />
            Terima Pembayaran Tunai
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-rose-600 focus:text-rose-600"
          onClick={() => onDelete(invoice)}
        >
          <Trash2 className="mr-2 size-4" />
          Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MethodCell({ invoice }: { invoice: Invoice }) {
  const Icon = methodIcon[invoice.paymentMethod ?? "Tunai"]
  return invoice.paymentMethod ? (
    <div className="flex flex-col items-start gap-1">
      <Badge className={`gap-1 text-xs font-medium ${paymentMethodBadge[invoice.paymentMethod]}`}>
        <Icon className="size-3" />
        {invoice.paymentMethod}
      </Badge>
      {invoice.paymentCode && (
        <span className="text-[11px] text-muted-foreground/70">{invoice.paymentCode}</span>
      )}
    </div>
  ) : (
    <span className="text-sm text-muted-foreground">—</span>
  )
}

/* ----------------------------------------------------------------
   Page
   ---------------------------------------------------------------- */

export function InvoicesPage() {
  const navigate = useNavigate()
  const invoices = useInvoiceStore((s) => s.invoices)
  const loadInvoices = useInvoiceStore((s) => s.load)
  const markPaid = useInvoiceStore((s) => s.markPaid)
  const removeInvoice = useInvoiceStore((s) => s.removeInvoice)

  // Muat data dari backend saat halaman dibuka
  useEffect(() => {
    void loadInvoices()
  }, [loadInvoices])

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(0)
  const [payTarget, setPayTarget] = useState<Invoice | null>(null)

  /* ---------- Filtering ---------- */
  const filtered = useMemo(() => {
    let result = invoices

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (inv) => inv.code.toLowerCase().includes(q) || inv.customer.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== "all") {
      result = result.filter((inv) => inv.status === statusFilter)
    }

    return result
  }, [invoices, search, statusFilter])

  /* ---------- Pagination ---------- */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const paginated = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const rangeStart = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1
  const rangeEnd = Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE)

  /* ---------- Aksi ---------- */
  const handleMarkPaid = async (invoice: Invoice) => {
    const success = await markPaid(invoice.id, "Tunai")
    if (!success) {
      toast.error("Gagal memproses pembayaran", {
        description: "Terjadi kesalahan saat menandai invoice lunas.",
      })
      return
    }
    // Note: backend completePaymentFlow sudah update expiry_at customer + status Active
    // Tidak perlu extendExpiry lagi di frontend (akan double extend)
    toast.success("Pembayaran tunai dicatat", {
      description: `${invoice.code} lunas — masa aktif ${invoice.customer} diperpanjang 1 bulan.`,
    })
    setPayTarget(null)
  }

  const handleDelete = (invoice: Invoice) => {
    removeInvoice(invoice.id)
    toast.success("Invoice dihapus", { description: `${invoice.code} telah dihapus dari daftar.` })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "Invoice" }]}
        title="Daftar Invoice"
        description="Kelola tagihan & terima pembayaran tunai untuk mengaktifkan/memperpanjang layanan."
        actions={
          <Button size="lg" onClick={() => navigate("/admin/invoices/new")}>
            + Buat invoice
          </Button>
        }
      />

      {/* ---------- Toolbar ---------- */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-sm">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari kode atau pelanggan..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val ?? "all")
            setPage(0)
          }}
        >
          <SelectTrigger className="w-[160px] text-sm">
            <SelectValue placeholder="Semua status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabel[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ---------- Data Table ---------- */}
      <div className="rounded-xl border border-border bg-card">
        {/* ===== Mobile: kartu per invoice ===== */}
        <div className="divide-y divide-border sm:hidden">
          {paginated.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Tidak ada invoice ditemukan.</p>
          ) : (
            paginated.map((invoice) => {
              const MethodIcon = methodIcon[invoice.paymentMethod ?? "Tunai"]
              return (
              <div key={invoice.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-primary">{invoice.code}</span>
                    <Badge className={`text-[0.625rem] font-medium ${statusBadgeClass[invoice.status]}`}>
                      {statusLabel[invoice.status]}
                    </Badge>
                  </div>
                  <InvoiceRowActions
                    invoice={invoice}
                    onDetail={(id) => navigate(`/admin/invoices/${id}`)}
                    onMarkPaid={setPayTarget}
                    onDelete={handleDelete}
                  />
                </div>
                <div className="mt-1.5">
                  <p className="text-sm font-semibold">{invoice.customer}</p>
                  <p className="text-xs text-muted-foreground">{invoice.period}</p>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-dashed border-border pt-2 text-xs">
                  <dt className="text-muted-foreground">Metode</dt>
                  <dd className="text-right">
                    {invoice.paymentMethod ? (
                      <Badge
                        className={`gap-1 text-[0.625rem] font-medium ${paymentMethodBadge[invoice.paymentMethod]}`}
                      >
                        <MethodIcon className="size-3" />
                        {invoice.paymentMethod}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Jumlah</dt>
                  <dd className="text-right font-semibold">{formatPrice(invoice.amount)}</dd>
                </dl>
                {invoice.status !== "Paid" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 w-full text-emerald-600"
                    onClick={() => setPayTarget(invoice)}
                  >
                    <Banknote className="mr-1.5 size-4" />
                    Terima Tunai &amp; Perpanjang
                  </Button>
                )}
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
                  Periode
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Metode
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Status
                </TableHead>
                <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Jumlah
                </TableHead>
                <TableHead className="w-[60px] text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  <span className="sr-only">Aksi</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-28 text-center text-sm text-muted-foreground">
                    Tidak ada invoice ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((invoice) => (
                  <TableRow key={invoice.id} className="hover:bg-muted/30">
                    <TableCell className="text-sm font-semibold text-primary">{invoice.code}</TableCell>
                    <TableCell className="text-sm font-medium">{invoice.customer}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{invoice.period}</TableCell>
                    <TableCell>
                      <MethodCell invoice={invoice} />
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs font-medium ${statusBadgeClass[invoice.status]}`}>
                        {statusLabel[invoice.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-semibold tabular-nums">
                      {formatPrice(invoice.amount)}
                    </TableCell>
                    <TableCell>
                      <InvoiceRowActions
                        invoice={invoice}
                        onDetail={(id) => navigate(`/admin/invoices/${id}`)}
                        onMarkPaid={setPayTarget}
                        onDelete={handleDelete}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ---------- Pagination ---------- */}
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          Menampilkan <span className="font-medium text-foreground">{rangeStart}-{rangeEnd}</span> dari{" "}
          <span className="font-medium text-foreground">{filtered.length}</span> invoice
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

      {/* ---------- Konfirmasi terima tunai ---------- */}
      <AlertDialog
        open={!!payTarget}
        onOpenChange={(open) => {
          if (!open) setPayTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terima pembayaran tunai?</AlertDialogTitle>
            <AlertDialogDescription>
              Tandai <strong>{payTarget?.code}</strong> ({payTarget?.customer}) sebagai lunas
              dengan metode <strong>Tunai</strong> (Rp{" "}
              {payTarget ? payTarget.amount.toLocaleString("id-ID") : ""}).
              <br />
              Masa aktif layanan pelanggan akan diperpanjang otomatis 1 bulan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => payTarget && handleMarkPaid(payTarget)}>
              <Banknote className="mr-1.5 size-4" />
              Terima &amp; Perpanjang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
