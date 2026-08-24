import { useMemo, useState, useEffect } from "react"
import { toast } from "sonner"
import {
  Users,
  Gauge,
  FileCode2,
  Settings,
  Wand2,
  RefreshCw,
  Search,
  Copy,
  Eye,
  EyeOff,
  Printer,
  Pencil,
  Trash2,
  MoreHorizontal,
  CheckCircle2,
  Clock3,
  Ban,
  Ticket,
  Plus,
  Power,
  Star,
  Save,
  PlugZap,
  Clock,
  XCircle,
  Server,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  CODE_FORMATS,
  durationLabelFromHours,
  fillTemplate,
  generateCode,
  type CodeFormat,
} from "@/lib/hotspotData"
import { useHotspotStore, USER_STATUSES, type HotspotProfile, type HotspotUser, type VoucherTemplate, type HotspotSettings, type HotspotUserStatus } from "@/store/hotspotStore"

/** Tambah jam ke sekarang dan format YYYY-MM-DD HH:mm:ss */
function addHoursToNow(hours: number): string {
  const d = new Date(Date.now() + hours * 3600 * 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/* ----------------------------------------------------------------
   Helpers
   ---------------------------------------------------------------- */

function formatPrice(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`
}

/** Buka jendela baru berisi voucher siap cetak memakai template HTML. */
function printVouchers(
  template: VoucherTemplate,
  list: HotspotUser[],
  settings: HotspotSettings,
  profileMap: Record<number, HotspotProfile>
) {
  const items = list
    .map((u) => {
      const profile = u.profileId != null ? profileMap[u.profileId] : undefined
      return `<div class="voucher-item">${fillTemplate(template.html, {
        username: u.username,
        password: u.password,
        profile: profile?.name ?? "-",
        duration: profile?.durationLabel ?? "-",
        price: `${settings.currency ?? "Rp"} ${u.price.toLocaleString("id-ID")}`,
        valid_until: u.validUntil,
        company: settings.companyName ?? "",
      })}</div>`
    })
    .join("")

  const win = window.open("", "_blank", "width=860,height=640")
  if (!win) {
    toast.error("Popup diblokir browser — izinkan popup lalu coba lagi")
    return
  }
  win.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"/><title>Cetak Voucher</title><style>
    body{font-family:Arial,sans-serif;margin:0;padding:16px;}
    .voucher-grid{display:flex;flex-wrap:wrap;gap:12px;}
    .voucher-item{break-inside:avoid;}
    @media print{body{padding:0;}}
  </style></head><body><div class="voucher-grid">${items}</div>
  <script>window.addEventListener('load',function(){setTimeout(function(){window.print();},250);});<\/script>
  </body></html>`)
  win.document.close()
}

const statusBadgeClass: Record<HotspotUserStatus, string> = {
  Aktif: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Belum Terpakai": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Expired: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400",
}

function copyText(text: string, label: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`${label} disalin`))
    .catch(() => toast.error("Gagal menyalin"))
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: number
  tone: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold leading-none tabular-nums">{value}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ----------------------------------------------------------------
   Aksi baris user (tabel desktop & kartu mobile)
   ---------------------------------------------------------------- */

function UserRowActions({
  user,
  onEdit,
  onDelete,
  onPrint,
}: {
  user: HotspotUser
  onEdit: () => void
  onDelete: () => void
  onPrint: () => void
}) {
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
        <DropdownMenuItem
          onClick={() => copyText(`Username: ${user.username}\nPassword: ${user.password}`, "Kredensial")}
        >
          <Copy className="mr-2 size-4" />
          Salin kredensial
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPrint}>
          <Printer className="mr-2 size-4" />
          Cetak voucher
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={onDelete}>
          <Trash2 className="mr-2 size-4" />
          Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ----------------------------------------------------------------
   Tab 1 — Pengguna (user hotspot / voucher)
   ---------------------------------------------------------------- */

type UserEditForm = {
  id: number
  username: string
  password: string
  profileId: number | null
  price: number
  status: HotspotUserStatus
}

export function VouchersTab() {
  const users = useHotspotStore((s) => s.users)
  const profiles = useHotspotStore((s) => s.profiles)
  const templates = useHotspotStore((s) => s.templates)
  const settings = useHotspotStore((s) => s.settings)
  const addUser = useHotspotStore((s) => s.addUser)
  const updateUser = useHotspotStore((s) => s.updateUser)
  const removeUsers = useHotspotStore((s) => s.removeUsers)
  const generateVouchers = useHotspotStore((s) => s.generateVouchers)
  const load = useHotspotStore((s) => s.load)

  // Muat data dari database real saat komponen mount
  useEffect(() => {
    load()
  }, [load])

  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("Semua")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [visiblePass, setVisiblePass] = useState<Set<number>>(new Set())
  const [editForm, setEditForm] = useState<UserEditForm | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HotspotUser | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  // Generate form state
  const [count, setCount] = useState(10)
  const [profileId, setProfileId] = useState<number | undefined>()
  const [price, setPrice] = useState(15000)
  const [format, setFormat] = useState<CodeFormat>("ALPHA")
  const [usernameEqualsPassword, setUsernameEqualsPassword] = useState(true)
  const [prefix, setPrefix] = useState("HS-")
  const [generating, setGenerating] = useState(false)

  const profileMap = useMemo(() => {
    const map: Record<number, HotspotProfile> = {}
    profiles.forEach((p) => { map[p.id] = p })
    return map
  }, [profiles])

  const activeTemplate = useMemo(
    () => templates.find((t) => t.isDefault) ?? templates[0] ?? null,
    [templates]
  )

  const stats = useMemo(
    () => ({
      total: users.length,
      aktif: users.filter((u) => u.status === "Aktif").length,
      unused: users.filter((u) => u.status === "Belum Terpakai").length,
      expired: users.filter((u) => u.status === "Expired").length,
    }),
    [users]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => {
      const matchQ =
        !q ||
        u.username.toLowerCase().includes(q) ||
        u.password.toLowerCase().includes(q)
      const matchS = statusFilter === "Semua" || u.status === statusFilter
      return matchQ && matchS
    })
  }, [users, query, statusFilter])

  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((u) => u.id))
    )

  const toggleVisible = (id: number) =>
    setVisiblePass((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const handleProfileChange = (pid: number | string) => {
    setProfileId(typeof pid === 'string' ? Number(pid) : pid)
    const p = profiles.find((x) => x.id === (typeof pid === 'string' ? Number(pid) : pid))
    if (p) setPrice(p.price)
  }

  const handleGenerate = async () => {
    if (!profileId) {
      toast.error("Pilih profile terlebih dahulu")
      return
    }
    const n = Math.min(Math.max(count, 1), 100)
    setGenerating(true)
    try {
      const created = await generateVouchers({
        count: n,
        profileId,
        price,
        format,
        usernameEqualsPassword,
        prefix: (prefix?.trim()) || "HS-",
      })
      if (!created.length) {
        toast.error("Tidak ada voucher dibuat — coba ubah format/prefix")
        return
      }
      setSelected(new Set(created.map((c) => c.id)))
      toast.success(`${created.length} voucher dibuat & dipilih untuk dicetak`)
    } catch {
      toast.error("Gagal generate voucher")
    } finally {
      setGenerating(false)
    }
  }

  const printOne = (u: HotspotUser) => {
    if (!activeTemplate) {
      toast.error("Tidak ada template voucher")
      return
    }
    printVouchers(activeTemplate, [u], settings, profileMap)
  }

  const printSelected = () => {
    if (!activeTemplate) {
      toast.error("Tidak ada template voucher")
      return
    }
    const list = users.filter((u) => selected.has(u.id))
    if (!list.length) return
    printVouchers(activeTemplate, list, settings, profileMap)
  }

  const openEdit = (u: HotspotUser) =>
    setEditForm({
      id: u.id,
      username: u.username,
      password: u.password,
      profileId: u.profileId,
      price: u.price,
      status: u.status,
    })

  const editProfile = editForm ? profiles.find((p) => p.id === editForm.profileId) : undefined

  const onEditProfileChange = (pid: number | string) => {
    const pId = typeof pid === 'string' ? Number(pid) : pid
    const p = profiles.find((x) => x.id === pId)
    setEditForm((f) => (f ? { ...f, profileId: pId, price: p?.price ?? f.price } : f))
  }

  const saveEdit = async () => {
    if (!editForm) return
    if (!editForm.username.trim() || !editForm.password.trim()) {
      toast.error("Username & password wajib diisi")
      return
    }
    const success = await updateUser(editForm.id, {
      status: editForm.status,
      validUntil: addHoursToNow(editProfile?.durationHours ?? 24),
      price: editForm.price,
    })
    if (success) {
      setEditForm(null)
      toast.success("Voucher diperbarui")
    } else {
      toast.error("Gagal memperbarui voucher")
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const success = await removeUsers([deleteTarget.id])
    if (success) {
      setDeleteTarget(null)
      toast.success("Voucher dihapus")
    }
  }

  const confirmBulkDelete = async () => {
    const success = await removeUsers([...selected])
    if (success) {
      setSelected(new Set())
      setBulkDeleteOpen(false)
      toast.success("Voucher terpilih dihapus")
    }
  }

  return (
    <div className="space-y-5">
      {/* Generate voucher */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
            <Wand2 className="size-4 text-primary" />
            Generate Voucher
          </CardTitle>
          <CardDescription>
            Buat user &amp; password hotspot sekaligus. Kode dipakai untuk login di halaman hotspot
            Mikrotik, lalu bisa dicetak sebagai voucher.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Jumlah voucher</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Number(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Profile</Label>
              <Select value={profileId?.toString()} onValueChange={(v) => handleProfileChange(Number(v))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih profile…" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} — {formatPrice(p.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Harga (Rp)</Label>
              <Input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Format kode</Label>
              <Select
                value={format}
                onValueChange={(v) => v && setFormat(v as CodeFormat)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih format…" />
                </SelectTrigger>
                <SelectContent>
                  {CODE_FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      <span className="font-mono">{f}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Username = Password</div>
                  <div className="text-xs text-muted-foreground">Satu kode untuk keduanya</div>
                </div>
                <Switch
                  checked={usernameEqualsPassword}
                  onCheckedChange={(v) => setUsernameEqualsPassword(!!v)}
                />
              </div>
            </div>
            {!usernameEqualsPassword && (
              <div className="space-y-1.5">
                <Label>Prefix username</Label>
                <Input
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="HS-"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Username = prefix + kode, password = kode acak terpisah
                </p>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Contoh format <span className="font-mono">{format}</span>:{" "}
              <span className="font-mono font-medium text-foreground">
                {generateCode(format)}
              </span>
            </p>
            <Button
              onClick={handleGenerate}
              disabled={generating || !profileId}
              className="w-full sm:w-auto"
            >
              {generating ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              {generating ? "Membuat…" : `Generate ${count} Voucher`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistik */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Ticket} label="Total Voucher" value={stats.total} tone="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle2} label="Aktif" value={stats.aktif} tone="bg-emerald-500/10 text-emerald-600" />
        <StatCard icon={Clock3} label="Belum Terpakai" value={stats.unused} tone="bg-amber-500/10 text-amber-600" />
        <StatCard icon={Ban} label="Expired" value={stats.expired} tone="bg-rose-500/10 text-rose-600" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari username / password…"
            className="h-8 pl-8"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {(["Semua", ...USER_STATUSES] as const).map((f) => (
            <Button
              key={f}
              variant={statusFilter === f ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setStatusFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <p className="text-sm font-medium">{selected.size} voucher dipilih</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={printSelected}>
              <Printer className="size-4" />
              Cetak
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="size-4" />
              Hapus
            </Button>
          </div>
        </div>
      )}

      {/* Daftar voucher */}
      <div className="rounded-xl border border-border bg-card">
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Password</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>Harga</TableHead>
                <TableHead>Berlaku s/d</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Tidak ada voucher yang cocok.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(u.id)}
                        onCheckedChange={() => toggleSelect(u.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs font-semibold">{u.username}</span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-6"
                          onClick={() => copyText(u.username, "Username")}
                        >
                          <Copy className="size-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">
                          {visiblePass.has(u.id)
                            ? u.password
                            : "•".repeat(Math.min(u.password.length, 8))}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-6"
                          onClick={() => toggleVisible(u.id)}
                        >
                          {visiblePass.has(u.id) ? (
                            <EyeOff className="size-3" />
                          ) : (
                            <Eye className="size-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-6"
                          onClick={() => copyText(u.password, "Password")}
                        >
                          <Copy className="size-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {u.profileId != null ? profileMap[u.profileId]?.name ?? "-" : "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">{formatPrice(u.price)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{u.validUntil}</TableCell>
                    <TableCell>
                      <Badge className={cn("font-normal", statusBadgeClass[u.status])}>
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <UserRowActions
                        user={u}
                        onEdit={() => openEdit(u)}
                        onDelete={() => setDeleteTarget(u)}
                        onPrint={() => printOne(u)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Kartu mobile */}
        <div className="divide-y divide-border sm:hidden">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Tidak ada voucher yang cocok.
            </div>
          ) : (
            filtered.map((u) => (
              <div key={u.id} className="flex items-start gap-3 p-3">
                <Checkbox
                  className="mt-1"
                  checked={selected.has(u.id)}
                  onCheckedChange={() => toggleSelect(u.id)}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{u.username}</span>
                    <Badge className={cn("font-normal", statusBadgeClass[u.status])}>
                      {u.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>Pass:</span>
                    <span className="font-mono">
                      {visiblePass.has(u.id)
                        ? u.password
                        : "•".repeat(Math.min(u.password.length, 8))}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6"
                      onClick={() => toggleVisible(u.id)}
                    >
                      {visiblePass.has(u.id) ? (
                        <EyeOff className="size-3" />
                      ) : (
                        <Eye className="size-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-6"
                      onClick={() => copyText(u.password, "Password")}
                    >
                      <Copy className="size-3" />
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {u.profileId != null ? (profileMap[u.profileId]?.name ?? "-") : "-"} · {formatPrice(u.price)} · Berlaku{" "}
                    {u.validUntil}
                  </div>
                </div>
                <UserRowActions
                  user={u}
                  onEdit={() => openEdit(u)}
                  onDelete={() => setDeleteTarget(u)}
                  onPrint={() => printOne(u)}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Dialog edit voucher */}
      <Dialog open={!!editForm} onOpenChange={(o) => !o && setEditForm(null)}>
        <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>Edit Voucher</DialogTitle>
            <DialogDescription>
              Perbarui kredensial user hotspot. Masa berlaku mengikuti durasi profile.
            </DialogDescription>
          </DialogHeader>
          {editForm && (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Username</Label>
                    <Input
                      value={editForm.username}
                      onChange={(e) =>
                        setEditForm({ ...editForm, username: e.target.value })
                      }
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password</Label>
                    <Input
                      value={editForm.password}
                      onChange={(e) =>
                        setEditForm({ ...editForm, password: e.target.value })
                      }
                      className="font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Profile</Label>
                  <Select
                    value={editForm.profileId}
                    onValueChange={(v) => v && onEditProfileChange(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih profile…" />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {formatPrice(p.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Harga (Rp)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.price}
                      onChange={(e) =>
                        setEditForm({ ...editForm, price: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={editForm.status}
                      onValueChange={(v) =>
                        v && setEditForm({ ...editForm, status: v as HotspotUserStatus })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih status…" />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Berlaku s/d:{" "}
                  <span className="font-medium text-foreground">
                    {addHoursToNow(editProfile?.durationHours ?? 24)}
                  </span>
                </p>
              </div>
              <DialogFooter className="border-t px-5 py-4">
                <div className="flex w-full gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setEditForm(null)}>
                    Batal
                  </Button>
                  <Button className="flex-1" onClick={saveEdit}>
                    Simpan
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog hapus 1 voucher */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Hapus voucher?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Voucher{" "}
              <span className="font-mono font-medium text-foreground">
                {deleteTarget?.username}
              </span>{" "}
              akan dihapus permanen dari daftar user hotspot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={confirmDelete}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog hapus massal */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Hapus voucher terpilih?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {selected.size} voucher akan dihapus permanen dari daftar user hotspot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={confirmBulkDelete}
            >
              Hapus {selected.size}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ----------------------------------------------------------------
   Halaman utama
   ---------------------------------------------------------------- */

export function VouchersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "Hotspot", to: "/admin/hotspot" }, { label: "Voucher" }]}
        title="Voucher Hotspot"
        description="Kelola user &amp; password login hotspot, generate voucher."
      />
      <VouchersTab />
    </div>
  )
}

