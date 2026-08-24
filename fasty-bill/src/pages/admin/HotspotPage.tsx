import { useMemo, useState } from "react"
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

function UsersTab() {
  const users = useHotspotStore((s) => s.users)
  const profiles = useHotspotStore((s) => s.profiles)
  const templates = useHotspotStore((s) => s.templates)
  const settings = useHotspotStore((s) => s.settings)
  const generateVouchers = useHotspotStore((s) => s.generateVouchers)
  const updateUser = useHotspotStore((s) => s.updateUser)
  const removeUsers = useHotspotStore((s) => s.removeUsers)

  /* generate form */
  const [count, setCount] = useState(5)
  const [profileId, setProfileId] = useState<number | null>(profiles[0]?.id ?? null)
  const [price, setPrice] = useState(profiles[0]?.price ?? 15000)
  const [format, setFormat] = useState<CodeFormat>("ABCD123")
  const [usernameEqualsPassword, setUsernameEqualsPassword] = useState(true)
  const [prefix, setPrefix] = useState(settings.voucherPrefix)
  const [generating, setGenerating] = useState(false)

  /* list state */
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"Semua" | HotspotUserStatus>("Semua")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [visiblePass, setVisiblePass] = useState<Set<number>>(new Set())

  /* dialogs */
  const [editForm, setEditForm] = useState<UserEditForm | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HotspotUser | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const profileMap = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.id, p])) as Record<number, HotspotProfile>,
    [profiles]
  )
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
            Buat user & password hotspot sekaligus. Kode dipakai untuk login di halaman hotspot
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
   Tab 2 — Profile hotspot
   ---------------------------------------------------------------- */

type ProfileForm = Omit<HotspotProfile, 'id'> & { id?: number }

function ProfilesTab() {
  const profiles = useHotspotStore((s) => s.profiles)
  const users = useHotspotStore((s) => s.users)
  const addProfile = useHotspotStore((s) => s.addProfile)
  const updateProfile = useHotspotStore((s) => s.updateProfile)
  const removeProfile = useHotspotStore((s) => s.removeProfile)

  const [profileDialog, setProfileDialog] = useState<ProfileForm | null>(null)
  const [deleteProfile, setDeleteProfile] = useState<HotspotProfile | null>(null)

  const openCreate = () =>
    setProfileDialog({
      name: "",
      durationHours: 24,
      durationLabel: "1 Hari",
      price: 15000,
      downloadSpeed: 10,
      uploadSpeed: 10,
      sharedUsers: 1,
      sessionTimeout: 360,
      status: "Aktif",
    })

  const openEdit = (p: HotspotProfile) => setProfileDialog({ ...p })

  const saveProfile = () => {
    if (!profileDialog) return
    if (!profileDialog.name.trim()) {
      toast.error("Nama profile wajib diisi")
      return
    }
    const data = {
      ...profileDialog,
      durationLabel: durationLabelFromHours(profileDialog.durationHours),
    }
    if (profileDialog.id) {
      updateProfile(profileDialog.id, data)
      toast.success("Profile diperbarui")
    } else {
      addProfile(data)
      toast.success("Profile ditambahkan")
    }
    setProfileDialog(null)
  }

  const toggleProfile = (p: HotspotProfile) => {
    const next = p.status === "Aktif" ? "Nonaktif" : "Aktif"
    updateProfile(p.id, { status: next })
    toast.success(`Profile "${p.name}" ${next === "Aktif" ? "diaktifkan" : "dinonaktifkan"}`)
  }

  const confirmDeleteProfile = () => {
    if (!deleteProfile) return
    if (users.some((u) => u.profileId === deleteProfile.id)) {
      toast.error("Profile dipakai oleh voucher — hapus voucher tersebut dulu")
      setDeleteProfile(null)
      return
    }
    removeProfile(deleteProfile.id)
    setDeleteProfile(null)
    toast.success("Profile dihapus")
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Profile Hotspot</h2>
          <p className="text-sm text-muted-foreground">
            Batasi durasi, kecepatan, dan jumlah perangkat per user hotspot.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Tambah Profile
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {profiles.map((p) => {
          const usage = users.filter((u) => u.profileId === p.id).length
          return (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <CardDescription>
                    {p.durationLabel} · {formatPrice(p.price)}
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    p.status === "Aktif"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                      : "border-zinc-500/30 bg-zinc-500/10 text-zinc-500"
                  )}
                >
                  {p.status}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <div className="text-muted-foreground">Kecepatan</div>
                    <div className="font-mono font-medium">
                      {p.downloadSpeed}/{p.uploadSpeed} Mbps
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <div className="text-muted-foreground">Shared Users</div>
                    <div className="font-medium">{p.sharedUsers} perangkat</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <div className="text-muted-foreground">Session Timeout</div>
                    <div className="font-medium">{p.sessionTimeout} menit</div>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <div className="text-muted-foreground">Dipakai</div>
                    <div className="font-medium">{usage} voucher</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleProfile(p)}>
                    <Power className="size-3.5" />
                    {p.status === "Aktif" ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-600"
                    onClick={() => setDeleteProfile(p)}
                  >
                    <Trash2 className="size-3.5" />
                    Hapus
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Dialog profile */}
      <Dialog
        open={!!profileDialog}
        onOpenChange={(o) => !o && setProfileDialog(null)}
      >
        <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>{profileDialog?.id ? "Edit Profile" : "Tambah Profile"}</DialogTitle>
            <DialogDescription>
              Durasi otomatis diberi label (mis. 24 → "1 Hari").
            </DialogDescription>
          </DialogHeader>
          {profileDialog && (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Nama profile</Label>
                    <Input
                      value={profileDialog.name}
                      onChange={(e) =>
                        setProfileDialog({ ...profileDialog, name: e.target.value })
                      }
                      placeholder="cth. 1 Jam, 1 Hari, 1 Bulan…"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Durasi (jam)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={profileDialog.durationHours}
                      onChange={(e) =>
                        setProfileDialog({
                          ...profileDialog,
                          durationHours: Number(e.target.value) || 1,
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Label:{" "}
                      <span className="font-medium text-foreground">
                        {durationLabelFromHours(profileDialog.durationHours)}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Harga (Rp)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={profileDialog.price}
                      onChange={(e) =>
                        setProfileDialog({
                          ...profileDialog,
                          price: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Download (Mbps)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={profileDialog.downloadSpeed}
                      onChange={(e) =>
                        setProfileDialog({
                          ...profileDialog,
                          downloadSpeed: Number(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Upload (Mbps)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={profileDialog.uploadSpeed}
                      onChange={(e) =>
                        setProfileDialog({
                          ...profileDialog,
                          uploadSpeed: Number(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Shared users</Label>
                    <Input
                      type="number"
                      min={1}
                      value={profileDialog.sharedUsers}
                      onChange={(e) =>
                        setProfileDialog({
                          ...profileDialog,
                          sharedUsers: Number(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Session timeout (menit)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={profileDialog.sessionTimeout}
                      onChange={(e) =>
                        setProfileDialog({
                          ...profileDialog,
                          sessionTimeout: Number(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={profileDialog.status}
                    onValueChange={(v) =>
                      v &&
                      setProfileDialog({
                        ...profileDialog,
                        status: v as HotspotProfile["status"],
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih status…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Aktif">Aktif</SelectItem>
                      <SelectItem value="Nonaktif">Nonaktif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="border-t px-5 py-4">
                <div className="flex w-full gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setProfileDialog(null)}
                  >
                    Batal
                  </Button>
                  <Button className="flex-1" onClick={saveProfile}>
                    Simpan
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog hapus profile */}
      <AlertDialog
        open={!!deleteProfile}
        onOpenChange={(open) => !open && setDeleteProfile(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Hapus profile?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Profile <span className="font-medium text-foreground">{deleteProfile?.name}</span>{" "}
              akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={confirmDeleteProfile}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ----------------------------------------------------------------
   Tab 3 — Template voucher (HTML)
   ---------------------------------------------------------------- */

const PLACEHOLDERS = [
  "{username}",
  "{password}",
  "{profile}",
  "{duration}",
  "{price}",
  "{valid_until}",
  "{company}",
]

const STARTER_HTML = `<div style="width:260px;font-family:Arial,sans-serif;border:1px solid #e2e8f0;border-radius:10px;padding:14px;">
  <h3 style="margin:0 0 8px;text-align:center;">{company}</h3>
  <p style="margin:4px 0;">Username: <b>{username}</b></p>
  <p style="margin:4px 0;">Password: <b>{password}</b></p>
  <p style="margin:4px 0;">Paket: {profile} · {duration}</p>
  <p style="margin:4px 0;">Harga: {price}</p>
  <p style="margin:4px 0;">Berlaku: {valid_until}</p>
</div>`

type TemplateForm = { id?: number; name: string; html: string }

function TemplatesTab() {
  const templates = useHotspotStore((s) => s.templates)
  const addTemplate = useHotspotStore((s) => s.addTemplate)
  const updateTemplate = useHotspotStore((s) => s.updateTemplate)
  const removeTemplate = useHotspotStore((s) => s.removeTemplate)
  const setDefaultTemplate = useHotspotStore((s) => s.setDefaultTemplate)

  const [templateDialog, setTemplateDialog] = useState<TemplateForm | null>(null)
  const [previewTarget, setPreviewTarget] = useState<VoucherTemplate | null>(null)
  const [deleteTemplate, setDeleteTemplate] = useState<VoucherTemplate | null>(null)

  const openCreate = () => setTemplateDialog({ name: "", html: STARTER_HTML })
  const openEdit = (t: VoucherTemplate) => setTemplateDialog({ id: t.id, name: t.name, html: t.html })

  const saveTemplate = () => {
    if (!templateDialog) return
    if (!templateDialog.name.trim()) {
      toast.error("Nama template wajib diisi")
      return
    }
    if (!templateDialog.html.trim()) {
      toast.error("HTML template wajib diisi")
      return
    }
    if (templateDialog.id) {
      updateTemplate(templateDialog.id, {
        name: templateDialog.name.trim(),
        html: templateDialog.html,
      })
      toast.success("Template diperbarui")
    } else {
      addTemplate({ name: templateDialog.name.trim(), html: templateDialog.html })
      toast.success("Template ditambahkan")
    }
    setTemplateDialog(null)
  }

  const confirmDeleteTemplate = () => {
    if (!deleteTemplate) return
    removeTemplate(deleteTemplate.id)
    setDeleteTemplate(null)
    toast.success("Template dihapus")
  }

  const previewHtml = templateDialog
    ? fillTemplate(templateDialog.html)
    : ""

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Template Voucher</h2>
          <p className="text-sm text-muted-foreground">
            Desain voucher dalam HTML. Placeholder diganti otomatis saat cetak.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Tambah Template
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  {t.name}
                  {t.isDefault && (
                    <Badge variant="secondary">
                      <Star className="size-3" />
                      Default
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>Diperbarui {t.updatedAt}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="max-h-24 overflow-hidden rounded-lg bg-muted/50 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {t.html}
              </div>
              <div className="flex flex-wrap gap-2">
                {!t.isDefault && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDefaultTemplate(t.id)
                      toast.success(`Template "${t.name}" dijadikan default`)
                    }}
                  >
                    <Star className="size-3.5" />
                    Jadikan default
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setPreviewTarget(t)}>
                  <Eye className="size-3.5" />
                  Pratinjau
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-rose-600"
                  onClick={() => setDeleteTemplate(t)}
                >
                  <Trash2 className="size-3.5" />
                  Hapus
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog tambah/edit template */}
      <Dialog
        open={!!templateDialog}
        onOpenChange={(o) => !o && setTemplateDialog(null)}
      >
        <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 p-0 sm:max-w-xl">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle>
              {templateDialog?.id ? "Edit Template" : "Tambah Template"}
            </DialogTitle>
            <DialogDescription>
              Tulis HTML voucher. Klik chip placeholder untuk menyisipkannya.
            </DialogDescription>
          </DialogHeader>
          {templateDialog && (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div className="space-y-1.5">
                  <Label>Nama template</Label>
                  <Input
                    value={templateDialog.name}
                    onChange={(e) =>
                      setTemplateDialog({ ...templateDialog, name: e.target.value })
                    }
                    placeholder="cth. Klasik, Modern, Minimalis…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>HTML</Label>
                  <Textarea
                    value={templateDialog.html}
                    onChange={(e) =>
                      setTemplateDialog({ ...templateDialog, html: e.target.value })
                    }
                    className="h-56 resize-none font-mono text-xs leading-relaxed"
                    spellCheck={false}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {PLACEHOLDERS.map((ph) => (
                      <button
                        key={ph}
                        type="button"
                        onClick={() =>
                          setTemplateDialog({
                            ...templateDialog,
                            html: templateDialog.html + ph,
                          })
                        }
                        className="rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        {ph}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Pratinjau</Label>
                  <div className="flex justify-center rounded-lg border border-dashed border-border bg-muted/30 p-4">
                    <div
                      className="overflow-hidden rounded-md"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="border-t px-5 py-4">
                <div className="flex w-full gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setTemplateDialog(null)}
                  >
                    Batal
                  </Button>
                  <Button className="flex-1" onClick={saveTemplate}>
                    Simpan
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog pratinjau template */}
      <Dialog open={!!previewTarget} onOpenChange={(o) => !o && setPreviewTarget(null)}>
        <DialogContent className="w-full sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-4" />
              Pratinjau — {previewTarget?.name}
            </DialogTitle>
            <DialogDescription>Contoh dengan data sampel (ABC123 / 1 Hari).</DialogDescription>
          </DialogHeader>
          {previewTarget && (
            <div className="flex justify-center rounded-xl border border-dashed border-border bg-muted/30 p-5">
              <div
                className="overflow-hidden rounded-md"
                dangerouslySetInnerHTML={{ __html: fillTemplate(previewTarget.html) }}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setPreviewTarget(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog hapus template */}
      <AlertDialog
        open={!!deleteTemplate}
        onOpenChange={(open) => !open && setDeleteTemplate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Hapus template?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Template <span className="font-medium text-foreground">{deleteTemplate?.name}</span>{" "}
              akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={confirmDeleteTemplate}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ----------------------------------------------------------------
   Tab 4 — Pengaturan
   ---------------------------------------------------------------- */

function SettingsTab() {
  const settings = useHotspotStore((s) => s.settings)
  const updateSettings = useHotspotStore((s) => s.updateSettings)

  const [form, setForm] = useState<HotspotSettings>(settings)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [conn, setConn] = useState<"idle" | "ok" | "fail">("idle")
  const [showApiPass, setShowApiPass] = useState(false)

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      updateSettings(form)
      setSaving(false)
      toast.success("Pengaturan hotspot disimpan")
    }, 600)
  }

  const handleTest = () => {
    setTesting(true)
    setConn("idle")
    setTimeout(() => {
      setTesting(false)
      setConn(Math.random() > 0.3 ? "ok" : "fail")
    }, 1200)
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Koneksi server */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
              <Server className="size-4" />
              Koneksi Mikrotik
            </CardTitle>
            <CardDescription>
              Kredensial RouterOS API untuk sinkronisasi user hotspot otomatis.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Server URL</Label>
              <Input
                value={form.serverUrl}
                onChange={(e) => setForm({ ...form, serverUrl: e.target.value })}
                placeholder="http://192.168.1.1"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>API Port</Label>
              <Input
                type="number"
                value={form.apiPort}
                onChange={(e) => setForm({ ...form, apiPort: Number(e.target.value) || 8728 })}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>API Username</Label>
              <Input
                value={form.apiUser}
                onChange={(e) => setForm({ ...form, apiUser: e.target.value })}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>API Password</Label>
              <div className="relative">
                <Input
                  type={showApiPass ? "text" : "password"}
                  value={form.apiPassword}
                  onChange={(e) => setForm({ ...form, apiPassword: e.target.value })}
                  className="pr-9 font-mono"
                  placeholder="••••••••"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1/2 right-1.5 size-6 -translate-y-1/2"
                  onClick={() => setShowApiPass((v) => !v)}
                >
                  {showApiPass ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Halaman login hotspot</Label>
              <Input
                value={form.loginPageUrl}
                onChange={(e) => setForm({ ...form, loginPageUrl: e.target.value })}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prefix username (default)</Label>
              <Input
                value={form.voucherPrefix}
                onChange={(e) => setForm({ ...form, voucherPrefix: e.target.value })}
                className="font-mono"
              />
            </div>
          </CardContent>
        </Card>

        {/* Status + info */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                <PlugZap className="size-4" />
                Status Koneksi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {conn === "idle" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" />
                  Belum diuji
                </div>
              )}
              {conn === "ok" && (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="size-4" />
                  Terhubung ke {form.serverUrl}
                </div>
              )}
              {conn === "fail" && (
                <div className="flex items-center gap-2 text-sm text-rose-600">
                  <XCircle className="size-4" />
                  Gagal terhubung — cek server & kredensial
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={handleTest} disabled={testing}>
                {testing ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <PlugZap className="size-4" />
                )}
                {testing ? "Menguji…" : "Tes Koneksi"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                <ShieldCheck className="size-4" />
                Informasi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>• Terhubung ke Mikrotik via RouterOS API (port 8728).</p>
              <p>• User dibuat di /ip hotspot user sesuai profile terpilih.</p>
              <p>• Voucher dicetak memakai template HTML di tab "Template Voucher".</p>
              <p>• Kredensial API disimpan lokal di browser.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tampilan & voucher */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
            <FileCode2 className="size-4" />
            Tampilan & Voucher
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Nama perusahaan</Label>
            <Input
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              placeholder="RTRW NET"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Mata uang</Label>
            <Input
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              placeholder="Rp"
            />
          </div>
          <div className="flex items-end">
            <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
              <div>
                <div className="text-sm font-medium">Sinkronisasi otomatis</div>
                <div className="text-xs text-muted-foreground">
                  Kirim user ke Mikrotik saat generate
                </div>
              </div>
              <Switch
                checked={form.autoSync}
                onCheckedChange={(v) => setForm({ ...form, autoSync: !!v })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? "Menyimpan…" : "Simpan Pengaturan"}
        </Button>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------
   Halaman utama
   ---------------------------------------------------------------- */

export function HotspotPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "Hotspot" }]}
        title="Hotspot Mikrotik"
        description="Kelola user & password login hotspot, generate voucher, profile, dan template cetak."
      />
      <Tabs defaultValue="pengguna" className="w-full">
        <TabsList className="w-full flex-wrap">
          <TabsTrigger value="pengguna">
            <Users />
            Pengguna
          </TabsTrigger>
          <TabsTrigger value="profile">
            <Gauge />
            Profile
          </TabsTrigger>
          <TabsTrigger value="template">
            <FileCode2 />
            Template Voucher
          </TabsTrigger>
          <TabsTrigger value="pengaturan">
            <Settings />
            Pengaturan
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pengguna" className="mt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="profile" className="mt-4">
          <ProfilesTab />
        </TabsContent>
        <TabsContent value="template" className="mt-4">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="pengaturan" className="mt-4">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
