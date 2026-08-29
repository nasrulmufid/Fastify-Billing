import { useMemo, useState } from "react"
import {
  Download,
  Edit,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
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
import { toast } from "sonner"
import {
  usePackageActions,
  usePackages,
  type ServicePackage,
} from "@/lib/packageStore"
import { useCustomers } from "@/lib/customerStore"
import { PackageFormDialog } from "@/components/packages/PackageFormDialog"
import api from "@/lib/axios"

/* ----------------------------------------------------------------
   Helpers
   ---------------------------------------------------------------- */

const statusBadgeClass: Record<string, string> = {
  Aktif: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Nonaktif: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400",
}

const TYPE_OPTIONS = ["PPPoE"]
const PAGE_SIZE = 8

function formatPrice(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`
}

/* ----------------------------------------------------------------
   Row actions (dipakai di tabel desktop & kartu mobile)
   ---------------------------------------------------------------- */

type PackageRowActionsProps = {
  pkg: ServicePackage
  onEdit: (pkg: ServicePackage) => void
  onToggle: (pkg: ServicePackage) => void
  onDelete: (pkg: ServicePackage) => void
  onSync: (pkg: ServicePackage) => void
  syncing: boolean
}

function PackageRowActions({ pkg, onEdit, onToggle, onDelete, onSync, syncing }: PackageRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onEdit(pkg)}>
          <Edit className="mr-2 size-4" />
          Edit Paket
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSync(pkg)} disabled={syncing}>
          {syncing ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          Sync ke Router
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onToggle(pkg)}>
          {pkg.status === "Aktif" ? (
            <WifiOff className="mr-2 size-4" />
          ) : (
            <Wifi className="mr-2 size-4" />
          )}
          {pkg.status === "Aktif" ? "Nonaktifkan" : "Aktifkan Kembali"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-rose-600 focus:text-rose-600"
          onClick={() => onDelete(pkg)}
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

export function PackagesPage() {
  const packages = usePackages()
  const { remove, setStatus } = usePackageActions()
  const customers = useCustomers()

  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(0)

  // Sheet form (tambah / edit)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ServicePackage | undefined>(undefined)

  // Konfirmasi
  const [toggleTarget, setToggleTarget] = useState<ServicePackage | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ServicePackage | null>(null)

  // Sinkronisasi ke Mikrotik
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncingAll, setSyncingAll] = useState(false)

  /* ---------- Jumlah pelanggan per paket ---------- */
  const customerCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of customers) {
      counts[c.packageName] = (counts[c.packageName] ?? 0) + 1
    }
    return counts
  }, [customers])

  /* ---------- Filtering ---------- */
  const filtered = useMemo(() => {
    let result = packages

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      )
    }

    if (typeFilter !== "all") {
      result = result.filter((p) => p.type === typeFilter)
    }

    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter)
    }

    return result
  }, [packages, search, typeFilter, statusFilter])

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

  const openEditSheet = (pkg: ServicePackage) => {
    setEditing(pkg)
    setFormOpen(true)
  }

  const handleToggleStatus = () => {
    if (!toggleTarget) return
    const willDeactivate = toggleTarget.status === "Aktif"
    setStatus(toggleTarget.id, willDeactivate ? "Nonaktif" : "Aktif")
    toast.success(
      willDeactivate ? "Paket dinonaktifkan" : "Paket diaktifkan kembali",
      {
        description: willDeactivate
          ? `${toggleTarget.name} tidak dapat dipilih pelanggan baru.`
          : `${toggleTarget.name} kembali tersedia untuk pelanggan.`,
      }
    )
    setToggleTarget(null)
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    remove(deleteTarget.id)
    toast.success("Paket dihapus", { description: `${deleteTarget.name} telah dihapus permanen.` })
    setDeleteTarget(null)
  }

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      toast.error("Tidak ada data untuk diexport")
      return
    }
    const header = ["Kode", "Nama Paket", "Kecepatan (Mbps)", "Harga", "Tipe", "Status", "Pelanggan"]
    const rows = filtered.map((p) => [
      p.code,
      p.name,
      `${p.downloadSpeed}/${p.uploadSpeed}`,
      formatPrice(p.price),
      p.type,
      p.status,
      String(customerCounts[p.name] ?? 0),
    ])
    const csv = "\uFEFF" + [header, ...rows].map((r) => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "daftar-paket.csv"
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Export CSV berhasil", { description: `${filtered.length} paket diexport.` })
  }

  /* ---------- Sinkronisasi ke Mikrotik ---------- */
  const handleSyncOne = async (pkg: ServicePackage) => {
    setSyncingId(pkg.id)
    try {
      const { data } = await api.post<{
        data: { syncedCount: number; routerResults: Array<{ routerName: string; syncedCount: number }> }
        warning?: { message: string }
      }>(`/packages/${pkg.id}/sync`)
      const okRouters = data.data.routerResults.filter((r) => r.syncedCount > 0).length
      toast.success(`Profile ${pkg.name} disinkronkan`, {
        description: `${data.data.syncedCount} profile PPPoE dipastikan ada di ${okRouters} router.`,
      })
      if (data.warning) toast.warning(data.warning.message)
    } catch {
      toast.error(`Gagal menyinkronkan ${pkg.name}`, {
        description: "Terjadi kesalahan saat menghubungi server.",
      })
    } finally {
      setSyncingId(null)
    }
  }

  const handleSyncAll = async () => {
    setSyncingAll(true)
    try {
      const { data } = await api.post<{
        data: { syncedCount: number; routerResults: Array<{ routerName: string; syncedCount: number }> }
        warning?: { message: string }
      }>("/packages/sync")
      const okRouters = data.data.routerResults.filter((r) => r.syncedCount > 0).length
      toast.success("Sinkronisasi semua paket selesai", {
        description: `${data.data.syncedCount} profile PPPoE dipastikan ada di ${okRouters} router.`,
      })
      if (data.warning) toast.warning(data.warning.message)
    } catch {
      toast.error("Gagal sinkronisasi semua paket", {
        description: "Terjadi kesalahan saat menghubungi server.",
      })
    } finally {
      setSyncingAll(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "Paket" }]}
        title="Daftar Paket"
        description="Kelola paket dan opsi layanan yang ditawarkan ke pelanggan."
        actions={
          <Button onClick={openAddSheet} size="lg">
            <Plus className="mr-1.5 size-4" />
            Tambah Paket
          </Button>
        }
      />

      {/* ---------- Toolbar ---------- */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-sm">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau kode paket..."
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
            value={typeFilter}
            onValueChange={(val) => {
              setTypeFilter(val ?? "all")
              setPage(0)
            }}
          >
            <SelectTrigger className="w-[150px] text-sm">
              <SelectValue placeholder="Semua tipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua tipe</SelectItem>
              {TYPE_OPTIONS.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
              <SelectItem value="Aktif">Aktif</SelectItem>
              <SelectItem value="Nonaktif">Nonaktif</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={handleExportCsv}>
            <Download className="mr-1.5 size-4" />
            Export CSV
          </Button>

          <Button variant="outline" onClick={handleSyncAll} disabled={syncingAll}>
            {syncingAll ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 size-4" />
            )}
            Sync Semua ke Router
          </Button>
        </div>
      </div>

      {/* ---------- Data Table ---------- */}
      <div className="rounded-xl border border-border bg-card">
        {/* ===== Mobile: kartu per paket ===== */}
        <div className="divide-y divide-border sm:hidden">
          {paginated.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Tidak ada paket ditemukan.
            </p>
          ) : (
            paginated.map((pkg) => (
              <div key={pkg.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-primary">{pkg.code}</span>
                    <Badge variant="outline" className="text-[0.625rem]">
                      {pkg.type}
                    </Badge>
                    <Badge
                      className={`text-[0.625rem] font-medium capitalize ${statusBadgeClass[pkg.status] ?? ""}`}
                    >
                      {pkg.status}
                    </Badge>
                  </div>
                  <PackageRowActions
                    pkg={pkg}
                    onEdit={openEditSheet}
                    onToggle={setToggleTarget}
                    onDelete={setDeleteTarget}
                    onSync={handleSyncOne}
                    syncing={syncingId === pkg.id}
                  />
                </div>
                <div className="mt-1.5">
                  <p className="text-sm font-semibold">{pkg.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{pkg.description || "-"}</p>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-dashed border-border pt-2 text-xs">
                  <dt className="text-muted-foreground">Kecepatan</dt>
                  <dd className="text-right font-mono">
                    {pkg.downloadSpeed} / {pkg.uploadSpeed} Mbps
                  </dd>
                  <dt className="text-muted-foreground">Harga / Bulan</dt>
                  <dd className="text-right font-medium">{formatPrice(pkg.price)}</dd>
                  <dt className="text-muted-foreground">Pelanggan</dt>
                  <dd className="flex items-center justify-end gap-1 font-medium">
                    <Users className="size-3" />
                    {customerCounts[pkg.name] ?? 0}
                  </dd>
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
                Kode
              </TableHead>
              <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Nama Paket
              </TableHead>
              <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Kecepatan
              </TableHead>
              <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Harga / Bulan
              </TableHead>
              <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Tipe
              </TableHead>
              <TableHead className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Pelanggan
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
                  Tidak ada paket ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((pkg) => (
                <TableRow key={pkg.id} className="hover:bg-muted/30">
                  <TableCell className="text-sm font-semibold text-foreground">{pkg.code}</TableCell>
                  <TableCell>
                    <div className="flex max-w-[260px] flex-col">
                      <span className="text-sm font-medium">{pkg.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {pkg.description || "-"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {pkg.downloadSpeed} / {pkg.uploadSpeed} Mbps
                    </span>
                  </TableCell>
                  <TableCell className="text-sm font-medium">{formatPrice(pkg.price)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {pkg.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="size-3.5" />
                      {customerCounts[pkg.name] ?? 0}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs font-medium capitalize ${statusBadgeClass[pkg.status] ?? ""}`}>
                      {pkg.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <PackageRowActions
                      pkg={pkg}
                      onEdit={openEditSheet}
                      onToggle={setToggleTarget}
                      onDelete={setDeleteTarget}
                      onSync={handleSyncOne}
                      syncing={syncingId === pkg.id}
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
          <span className="font-medium text-foreground">{filtered.length}</span> paket
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
      <PackageFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        pkg={editing}
      />

      {/* ---------- Konfirmasi Aktif/Nonaktif ---------- */}
      <AlertDialog open={!!toggleTarget} onOpenChange={(open) => !open && setToggleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">
              {toggleTarget?.status === "Aktif" ? "Nonaktifkan paket?" : "Aktifkan kembali paket?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {toggleTarget?.status === "Aktif"
                ? `Paket ${toggleTarget?.name} tidak akan bisa dipilih pelanggan baru, tetapi pelanggan yang sudah berlangganan tetap berjalan.`
                : `Paket ${toggleTarget?.name} akan kembali tersedia dan dapat dipilih pelanggan baru.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleStatus}
              className={toggleTarget?.status === "Aktif" ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}
            >
              {toggleTarget?.status === "Aktif" ? "Ya, Nonaktifkan" : "Ya, Aktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---------- Konfirmasi Hapus ---------- */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Hapus paket?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Paket {deleteTarget?.name} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 hover:bg-rose-700"
            >
              <Trash2 className="mr-1.5 size-4" />
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
