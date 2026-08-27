import { useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Calendar,
  Download,
  Edit,
  Eye,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UserCheck,
  Wifi,
  WifiOff,
} from "lucide-react"

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  useCustomerActions,
  useCustomers,
  type Customer,
} from "@/lib/customerStore"
import { CustomerFormDialog } from "@/components/customers/CustomerFormDialog"
import { usePackages } from "@/lib/packageStore"
import api from "@/lib/axios"

/* ----------------------------------------------------------------
   Status helpers
   ---------------------------------------------------------------- */

const statusBadgeClass: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Isolated: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  Pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
}

const statusLabel: Record<string, string> = {
  Active: "Aktif",
  Isolated: "Isolir",
  Pending: "Pending",
}

const PAGE_SIZE = 8

/* ----------------------------------------------------------------
   Date helpers (format penyimpanan: "10 September 2026")
   ---------------------------------------------------------------- */

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
]

/** "10 September 2026" -> "2026-09-10" (untuk input date) */
function expiryToInputValue(dateStr: string): string {
  const parts = dateStr.trim().split(/\s+/)
  if (parts.length !== 3) return ""
  const day = Number(parts[0])
  const month = MONTHS_ID.indexOf(parts[1]) + 1
  const year = Number(parts[2])
  if (!day || !month || !year) return ""
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** "2026-09-10" (dari input date) -> "10 September 2026" */
function inputToExpiry(value: string): string {
  if (!value) return ""
  const [y, m, d] = value.split("-").map(Number)
  return `${d} ${MONTHS_ID[m - 1]} ${y}`
}

/* ----------------------------------------------------------------
   Row actions (dipakai di tabel desktop & kartu mobile)
   ---------------------------------------------------------------- */

type CustomerRowActionsProps = {
  cust: Customer
  onDetail: (id: string) => void
  onEdit: (cust: Customer) => void
  onEditExpiry: (cust: Customer) => void
  onIsolate: (cust: Customer) => void
  onDelete: (cust: Customer) => void
}

function CustomerRowActions({ cust, onDetail, onEdit, onIsolate, onDelete, onEditExpiry }: CustomerRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" size="icon-sm">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDetail(cust.id)}>
          <Eye className="mr-2 size-4" />
          Lihat Detail
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(cust)}>
          <Edit className="mr-2 size-4" />
          Edit Data
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEditExpiry(cust)}>
          <Calendar className="mr-2 size-4" />
          Edit Masa Aktif
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onIsolate(cust)}>
          {cust.status === "Pending" ? (
            <UserCheck className="mr-2 size-4" />
          ) : cust.status === "Isolated" ? (
            <Wifi className="mr-2 size-4" />
          ) : (
            <WifiOff className="mr-2 size-4" />
          )}
          {cust.status === "Pending"
            ? "Aktifkan Akun"
            : cust.status === "Isolated"
              ? "Aktifkan Koneksi"
              : "Isolir Pelanggan"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-rose-600 focus:text-rose-600"
          onClick={() => onDelete(cust)}
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

export function CustomersPage() {
  const customers = useCustomers()
  const { remove, setStatus, setExpiry } = useCustomerActions()
  const packages = usePackages()
  const navigate = useNavigate()

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [packageFilter, setPackageFilter] = useState("all")
  const [page, setPage] = useState(0)

  // Sheet form (tambah / edit)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | undefined>(undefined)

  // Konfirmasi
  const [isolateTarget, setIsolateTarget] = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)

  // Dialog edit masa aktif
  const [expiryTarget, setExpiryTarget] = useState<Customer | null>(null)
  const [expiryValue, setExpiryValue] = useState("")

  // Sinkronisasi secret PPPoE ke Mikrotik
  const [syncing, setSyncing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSyncCustomers = async () => {
    setSyncing(true)
    try {
      const { data } = await api.post<{
        data: {
          syncedCount: number
          customerCount: number
          routerResults: Array<{ routerId: number; syncedCount: number }>
        }
        warning?: { message: string }
      }>("/customers/sync")
      const okRouters = data.data.routerResults.filter((r) => r.syncedCount > 0).length
      toast.success("Sinkronisasi pelanggan selesai", {
        description: `${data.data.syncedCount} secret PPPoE (${data.data.customerCount} pelanggan) disinkronkan ke ${okRouters} router.`,
      })
      if (data.warning) toast.warning(data.warning.message)
    } catch {
      toast.error("Gagal sinkronisasi pelanggan", {
        description: "Terjadi kesalahan saat menghubungi server.",
      })
    } finally {
      setSyncing(false)
    }
  }

  // Export Excel
  const handleExportExcel = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/customers/export`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      if (!response.ok) throw new Error("Export gagal")
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `pelanggan_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success("Export Excel berhasil", {
        description: `${filtered.length} pelanggan diexport ke file Excel.`,
      })
    } catch {
      toast.error("Gagal export Excel", {
        description: "Terjadi kesalahan saat mengekspor data.",
      })
    }
  }

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/customers/template`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      if (!response.ok) throw new Error("Download template gagal")
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "template-import-pelanggan.xlsx"
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success("Template berhasil didownload", {
        description: "Isi data mulai baris ke-3 sesuai instruksi di template.",
      })
    } catch {
      toast.error("Gagal download template", {
        description: "Terjadi kesalahan saat mendownload template.",
      })
    }
  }

  // Import Excel
  const handleImportExcel = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/customers/import`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData,
      })

      const result = await response.json()

      if (response.status === 422) {
        // Validation errors
        const errorList = result.errors?.map((e: any) => `Baris ${e.row}: ${e.message}`).join("\n")
        toast.error("Validasi gagal", {
          description: `Terdapat ${result.errors?.length || 0} error:\n${errorList}`,
        })
        return
      }

      if (response.status === 207) {
        // Partial success
        toast.warning("Import sebagian berhasil", {
          description: `${result.data.successCount} berhasil, ${result.data.errorCount} gagal.`,
        })
        return
      }

      if (response.ok) {
        toast.success("Import berhasil", {
          description: `${result.data.successCount} pelanggan berhasil ditambahkan.`,
        })
        // Refresh data
        window.location.reload()
      } else {
        toast.error("Import gagal", {
          description: result.error?.message ?? "Terjadi kesalahan saat mengimport data.",
        })
      }
    } catch {
      toast.error("Gagal import Excel", {
        description: "Terjadi kesalahan saat mengupload file.",
      })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      toast.error("Format file tidak didukung", {
        description: "Hanya file Excel (.xlsx atau .xls) yang diperbolehkan.",
      })
      return
    }
    handleImportExcel(file)
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const openExpiryDialog = (cust: Customer) => {
    setExpiryTarget(cust)
    setExpiryValue(expiryToInputValue(cust.expiryDate))
  }

  const handleSaveExpiry = () => {
    if (!expiryTarget || !expiryValue) return
    const newExpiry = inputToExpiry(expiryValue)
    setExpiry(expiryTarget.id, newExpiry)
    toast.success("Masa aktif diperbarui", {
      description: `${expiryTarget.name} berlaku hingga ${newExpiry}.`,
    })
    setExpiryTarget(null)
  }

  /* ---------- Filtering ---------- */
  const filtered = useMemo(() => {
    let result = customers

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.ipAddress.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter)
    }

    if (packageFilter !== "all") {
      result = result.filter((c) => c.packageName === packageFilter)
    }

    return result
  }, [customers, search, statusFilter, packageFilter])

  /* ---------- Pagination ---------- */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const paginated = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const rangeStart = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1
  const rangeEnd = Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE)

  /* ---------- Aksi ---------- */
  const openAddSheet = () => {
    setEditing(undefined)
    setFormOpen(true)
  }

  const openEditSheet = (cust: Customer) => {
    setEditing(cust)
    setFormOpen(true)
  }

  const handleIsolate = () => {
    if (!isolateTarget) return
    const st = isolateTarget.status
    const willIsolate = st === "Active"
    setStatus(isolateTarget.id, willIsolate ? "Isolated" : "Active")
    toast.success(
      willIsolate
        ? `${isolateTarget.name} diisolir`
        : `${isolateTarget.name} diaktifkan`,
      {
        description: willIsolate
          ? "Koneksi internet dinonaktifkan."
          : st === "Pending"
            ? "Akun portal aktif — pelanggan dapat login & melakukan pembayaran."
            : "Koneksi internet dipulihkan.",
      }
    )
    setIsolateTarget(null)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    remove(deleteTarget.id)
    toast.success("Pelanggan dihapus", { description: `${deleteTarget.name} telah dihapus permanen.` })
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "Pelanggan" }]}
        title="Daftar Pelanggan"
        description="Kelola seluruh pelanggan jaringan Anda dalam satu tempat."
        actions={
          <Button onClick={openAddSheet} size="lg">
            <Plus className="mr-1.5 size-4" />
            Tambah Pelanggan
          </Button>
        }
      />

      {/* ---------- Toolbar ---------- */}
      <div className="space-y-3">
        {/* Baris 1: Search + Filters */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1 lg:max-w-sm">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari nama, ID, atau No HP..."
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
              <SelectTrigger className="w-40 text-sm">
                <SelectValue placeholder="Semua status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="Active">Aktif</SelectItem>
                <SelectItem value="Isolated">Isolir</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={packageFilter}
              onValueChange={(val) => {
                setPackageFilter(val ?? "all")
                setPage(0)
              }}
            >
              <SelectTrigger className="w-42 text-sm">
                <SelectValue placeholder="Semua paket" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua paket</SelectItem>
                {packages.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.name}>
                    {pkg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Baris 2: Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={handleSyncCustomers} disabled={syncing}>
            {syncing ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 size-4" />
            )}
            Sync Pelanggan ke Router
          </Button>

          {/* Dropdown Export */}
          <div className="relative">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="outline" className="shrink-0">
                  <Download className="mr-1.5 size-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4}>
                <DropdownMenuLabel>Export Operations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExportExcel}>
                  <Download className="mr-2 size-4" />
                  Export Pelanggan (.xlsx)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Dropdown Import */}
          <div className="relative">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="outline" className="shrink-0">
                  <Upload className="mr-1.5 size-4" />
                  Import
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={4}>
                <DropdownMenuLabel>Import Operations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 size-4" />
                  Import Pelanggan (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadTemplate}>
                  <Download className="mr-2 size-4" />
                  Download Template Import
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* ---------- Table ---------- */}
      <div className="rounded-xl border border-border bg-card">
        {/* ===== Mobile: kartu per pelanggan ===== */}
        <div className="divide-y divide-border sm:hidden">
          {paginated.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Tidak ada pelanggan ditemukan.
            </p>
          ) : (
            paginated.map((cust) => (
              <div key={cust.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-primary">{cust.code}</span>
                    <Badge
                      className={`text-[0.625rem] font-medium capitalize ${statusBadgeClass[cust.status] ?? ""}`}
                    >
                      {statusLabel[cust.status] ?? cust.status}
                    </Badge>
                  </div>
                  <CustomerRowActions
                    cust={cust}
                    onDetail={(id) => navigate(`/admin/pppoe/customers/${id}`)}
                    onEdit={openEditSheet}
                    onEditExpiry={openExpiryDialog}
                    onIsolate={setIsolateTarget}
                    onDelete={setDeleteTarget}
                  />
                </div>
                <div className="mt-1.5">
                  <Link
                    to={`/admin/customers/${cust.id}`}
                    className="text-sm font-semibold transition-colors hover:text-primary hover:underline"
                  >
                    {cust.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{cust.phone}</p>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-dashed border-border pt-2 text-xs">
                  <dt className="text-muted-foreground">Paket Layanan</dt>
                  <dd className="text-right font-medium">{cust.packageName}</dd>
                  <dt className="text-muted-foreground">IP Address</dt>
                  <dd className="text-right font-mono text-muted-foreground">{cust.ipAddress}</dd>
                  <dt className="text-muted-foreground">Masa Aktif</dt>
                  <dd className="text-right font-medium">{cust.expiryDate}</dd>
                </dl>
              </div>
            ))
          )}
        </div>

        {/* ===== Desktop: tabel ===== */}
        <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                ID Pelanggan
              </TableHead>
              <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Pelanggan
              </TableHead>
              <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Paket Layanan
              </TableHead>
              <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                IP Address
              </TableHead>
              <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Status
              </TableHead>
              <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Masa Aktif
              </TableHead>
              <TableHead className="w-15 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <span className="sr-only">Aksi</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-28 text-center text-sm text-muted-foreground">
                  Tidak ada pelanggan ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((cust) => (
                <TableRow key={cust.id} className="hover:bg-muted/30">
                  <TableCell className="text-sm font-semibold text-foreground">{cust.code}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <Link
                        to={`/admin/customers/${cust.id}`}
                        className="text-sm font-medium transition-colors hover:text-primary hover:underline"
                      >
                        {cust.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">{cust.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{cust.packageName}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">{cust.ipAddress}</span>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs font-medium capitalize ${statusBadgeClass[cust.status] ?? ""}`}>
                      {statusLabel[cust.status] ?? cust.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{cust.expiryDate}</TableCell>
                  <TableCell>
                    <CustomerRowActions
                      cust={cust}
                      onDetail={(id) => navigate(`/admin/customers/${id}`)}
                      onEdit={openEditSheet}
                      onEditExpiry={openExpiryDialog}
                      onIsolate={setIsolateTarget}
                      onDelete={setDeleteTarget}
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
          <span className="font-medium text-foreground">{filtered.length}</span> pelanggan
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

      {/* ---------- Form Dialog ---------- */}
      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editing}
      />

      {/* ---------- Dialog Edit Masa Aktif ---------- */}
      <Dialog
        open={!!expiryTarget}
        onOpenChange={(open) => !open && setExpiryTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">Edit Masa Aktif</DialogTitle>
            <DialogDescription className="text-sm">
              Ubah tanggal berakhir langganan untuk{" "}
              <strong>{expiryTarget?.name}</strong> ({""}
              {expiryTarget?.code}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="expiry-date" className="text-xs font-medium text-muted-foreground">
              Tanggal Berakhir
            </label>
            <Input
              id="expiry-date"
              type="date"
              value={expiryValue}
              onChange={(e) => setExpiryValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpiryTarget(null)}>
              Batal
            </Button>
            <Button onClick={handleSaveExpiry} disabled={!expiryValue}>
              <Calendar className="mr-1.5 size-4" />
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Konfirmasi Isolir ---------- */}
      <AlertDialog open={!!isolateTarget} onOpenChange={(open) => !open && setIsolateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">
              {isolateTarget?.status === "Isolated" ? "Aktifkan kembali koneksi?" : "Isolir pelanggan?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {isolateTarget?.status === "Isolated"
                ? `Koneksi internet ${isolateTarget?.name} akan diaktifkan kembali secara otomatis di Mikrotik.`
                : `Koneksi internet ${isolateTarget?.name} akan dinonaktifkan (isolir) sampai pembayaran dilakukan.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleIsolate}
              className={isolateTarget?.status === "Isolated" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
            >
              {isolateTarget?.status === "Isolated" ? "Ya, Aktifkan" : "Ya, Isolir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---------- Konfirmasi Hapus ---------- */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Hapus pelanggan?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Data <strong>{deleteTarget?.name}</strong> akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700">
              <Trash2 className="mr-1.5 size-4" />
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
