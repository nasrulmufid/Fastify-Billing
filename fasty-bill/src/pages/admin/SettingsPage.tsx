import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  CalendarClock,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  QrCode,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  UserCog,
  Users,
  XCircle,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import api from "@/lib/axios"
import { useAuthStore } from "@/store/useAppStore"

/* ----------------------------------------------------------------
   Types & seed
   ---------------------------------------------------------------- */

type UserRole = "super_admin" | "admin" | "finance" | "teknisi"
type UserStatus = "Aktif" | "Nonaktif"

type SettingsUser = {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  lastLogin: string
}

const ROLE_OPTIONS = ["super_admin", "admin", "finance", "teknisi"] as const satisfies readonly UserRole[]

const roleMeta: Record<UserRole, { label: string; badge: string; icon: LucideIcon }> = {
  super_admin: {
    label: "Super Admin",
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
    icon: ShieldCheck,
  },
  admin: {
    label: "Admin",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    icon: UserCog,
  },
  finance: {
    label: "Finance",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    icon: UserIcon,
  },
  teknisi: {
    label: "Teknisi",
    badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300",
    icon: UserIcon,
  },
}

const statusBadge: Record<UserStatus, string> = {
  Aktif: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Nonaktif: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
}

/* ---------- initial users (kosong — dimuat dari API) ---------- */
const seedUsers: SettingsUser[] = []

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

/* ----------------------------------------------------------------
   Dialog: Tambah / Edit User
   ---------------------------------------------------------------- */

const userFormSchema = z.object({
  name: z.string().min(3, "Nama minimal 3 karakter"),
  email: z.string().email("Email tidak valid"),
  role: z.enum(ROLE_OPTIONS),
  password: z.string(),
  status: z.enum(["Aktif", "Nonaktif"]),
})

type UserFormValues = z.infer<typeof userFormSchema>

type UserFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Jika diberikan -> edit, jika tidak -> tambah baru */
  user?: SettingsUser
  onSave: (input: { name: string; email: string; role: UserRole; password?: string; status: UserStatus }) => void
}

function UserFormDialog({ open, onOpenChange, user, onSave }: UserFormDialogProps) {
  const isEdit = !!user
  const [submitting, setSubmitting] = useState(false)

  const defaultValues = useMemo<UserFormValues>(() => {
    if (user) {
      return { name: user.name, email: user.email, role: user.role, password: "", status: user.status }
    }
    return { name: "", email: "", role: "admin", password: "", status: "Aktif" }
  }, [user])

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues,
  })

  const role = watch("role")
  const status = watch("status")

  useEffect(() => {
    if (open) {
      reset(defaultValues)
      setSubmitting(false)
    }
  }, [open, reset, defaultValues])

  function onSubmit(values: UserFormValues) {
    if (!isEdit && values.password.length < 6) {
      toast.error("Password awal minimal 6 karakter")
      return
    }
    setSubmitting(true)
    setTimeout(() => {
      onSave({
        name: values.name.trim(),
        email: values.email.trim(),
        role: values.role,
        password: isEdit ? undefined : values.password,
        status: values.status,
      })
      setSubmitting(false)
    }, 800)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{isEdit ? "Edit User" : "Tambah User"}</DialogTitle>
          <DialogDescription className="text-sm">
            {isEdit
              ? `Perbarui data dan role untuk ${user?.name}.`
              : "Buat akun baru untuk staf operasional."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-name">Nama Lengkap</Label>
            <Input
              id="user-name"
              placeholder="Nama staf"
              className="h-9"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-email">Email</Label>
            <Input
              id="user-email"
              type="email"
              placeholder="nama@rtrw.net"
              className="h-9"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => v && setValue("role", v as UserRole)}>
                <SelectTrigger className="w-full" data-slot="select-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleMeta[r].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => v && setValue("status", v as UserStatus)}>
                <SelectTrigger className="w-full" data-slot="select-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aktif">Aktif</SelectItem>
                  <SelectItem value="Nonaktif">Nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="user-pass">Password Awal</Label>
              <Input
                id="user-pass"
                type="password"
                placeholder="Minimal 6 karakter"
                className="h-9"
                aria-invalid={!!errors.password}
                {...register("password")}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
              {submitting ? "Menyimpan…" : isEdit ? "Simpan Perubahan" : "Tambah User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ----------------------------------------------------------------
   Dialog: Reset Password
   ---------------------------------------------------------------- */

function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
  onReset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: SettingsUser | null
  onReset: (id: string, password: string) => void
}) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setPassword("")
      setConfirm("")
      setShow(false)
      setSubmitting(false)
    }
  }, [open])

  const valid = password.length >= 6 && password === confirm

  function handleReset() {
    if (!user || !valid) return
    setSubmitting(true)
    setTimeout(() => {
      onReset(user.id, password)
      setSubmitting(false)
      onOpenChange(false)
    }, 800)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="size-4 text-primary" />
            Reset Password
          </DialogTitle>
          <DialogDescription className="text-sm">
            Setel ulang password untuk {user?.name} ({user?.email}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rp-pass">Password Baru</Label>
            <div className="relative">
              <Input
                id="rp-pass"
                type={show ? "text" : "password"}
                placeholder="Minimal 6 karakter"
                className="h-9 pr-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
              >
                {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </Button>
            </div>
            {password.length > 0 && password.length < 6 && (
              <p className="text-xs text-destructive">Password minimal 6 karakter.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rp-confirm">Konfirmasi Password</Label>
            <Input
              id="rp-confirm"
              type={show ? "text" : "password"}
              placeholder="Ulangi password baru"
              className="h-9"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {confirm.length > 0 && confirm !== password && (
              <p className="text-xs text-destructive">Password tidak sama.</p>
            )}
          </div>

          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button className="flex-1" onClick={handleReset} disabled={!valid || submitting}>
              {submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <RotateCcw className="mr-1.5 size-4" />}
              {submitting ? "Menyimpan…" : "Reset Password"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ----------------------------------------------------------------
   Tab: Akun (profil + ubah password)
   ---------------------------------------------------------------- */

function TabAkun() {
  const { user, updateUser } = useAuthStore()
  const [name, setName] = useState(user?.name ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [savingProfile, setSavingProfile] = useState(false)

  const [curPass, setCurPass] = useState("")
  const [newPass, setNewPass] = useState("")
  const [confirmPass, setConfirmPass] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [savingPass, setSavingPass] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name)
      setEmail(user.email)
    }
  }, [user])

  function handleSaveProfile() {
    if (name.trim().length < 3) {
      toast.error("Nama minimal 3 karakter")
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error("Email tidak valid")
      return
    }
    setSavingProfile(true)
    setTimeout(() => {
      updateUser({ name: name.trim(), email: email.trim() })
      setSavingProfile(false)
      toast.success("Profil diperbarui", { description: "Perubahan nama & email telah disimpan." })
    }, 800)
  }

  function handleChangePassword() {
    if (!curPass) {
      toast.error("Password saat ini wajib diisi")
      return
    }
    if (newPass.length < 6) {
      toast.error("Password baru minimal 6 karakter")
      return
    }
    if (newPass !== confirmPass) {
      toast.error("Konfirmasi password tidak sama")
      return
    }
    setSavingPass(true)
    setTimeout(() => {
      setSavingPass(false)
      setCurPass("")
      setNewPass("")
      setConfirmPass("")
      toast.success("Password berhasil diubah", { description: "Gunakan password baru saat login berikutnya." })
    }, 900)
  }

  if (!user) return null

  const role = roleMeta[user.role as UserRole] ?? roleMeta.admin
  const RoleIcon = role.icon

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Profil */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            Profil Saya
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{user.name}</p>
              <Badge className={cn("mt-1 text-xs", role.badge)}>
                <RoleIcon className="mr-1 size-3" />
                {role.label}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="acc-name">Nama Lengkap</Label>
            <Input id="acc-name" className="h-9" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="acc-email">Email</Label>
            <Input
              id="acc-email"
              type="email"
              className="h-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/40 px-3.5 py-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4" />
              ID Akun
            </span>
            <span className="font-mono text-xs">{user.id}</span>
          </div>

          <Button className="w-full" onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
            {savingProfile ? "Menyimpan…" : "Simpan Profil"}
          </Button>
        </CardContent>
      </Card>

      {/* Ubah password */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            Ubah Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pw-cur">Password Saat Ini</Label>
            <Input
              id="pw-cur"
              type={showPass ? "text" : "password"}
              className="h-9"
              value={curPass}
              onChange={(e) => setCurPass(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pw-new">Password Baru</Label>
            <div className="relative">
              <Input
                id="pw-new"
                type={showPass ? "text" : "password"}
                className="h-9 pr-9"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Minimal 6 karakter"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPass ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pw-confirm">Konfirmasi Password Baru</Label>
            <Input
              id="pw-confirm"
              type={showPass ? "text" : "password"}
              className="h-9"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              placeholder="Ulangi password baru"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/40 px-3.5 py-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Lock className="size-4" />
              Sesi aktif
            </span>
            <Badge className="bg-emerald-100 text-emerald-800 text-xs dark:bg-emerald-900/40 dark:text-emerald-300">
              <CheckCircle2 className="mr-1 size-3" />
              Masuk
            </Badge>
          </div>

          <Button className="w-full" variant="outline" onClick={handleChangePassword} disabled={savingPass}>
            {savingPass ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <KeyRound className="mr-1.5 size-4" />}
            {savingPass ? "Menyimpan…" : "Ubah Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

/* ----------------------------------------------------------------
   Tab: User (manajemen user & role)
   ---------------------------------------------------------------- */

function TabUser() {
  const currentUser = useAuthStore((s) => s.user)
  const [users, setUsers] = useState<SettingsUser[]>(seedUsers)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SettingsUser | undefined>(undefined)
  const [resetTarget, setResetTarget] = useState<SettingsUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SettingsUser | null>(null)

  const activeCount = users.filter((u) => u.status === "Aktif").length

  function handleSave(input: { name: string; email: string; role: UserRole; password?: string; status: UserStatus }) {
    if (editing) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editing.id ? { ...u, name: input.name, email: input.email, role: input.role, status: input.status } : u,
        ),
      )
      toast.success("User diperbarui", { description: `${input.name} — role ${roleMeta[input.role].label}.` })
    } else {
      const newUser: SettingsUser = {
        id: `u-${Date.now()}`,
        name: input.name,
        email: input.email,
        role: input.role,
        status: input.status,
        lastLogin: "Belum pernah",
      }
      setUsers((prev) => [...prev, newUser])
      toast.success("User ditambahkan", {
        description: `${input.name} (${roleMeta[input.role].label}) dapat login dengan password awal.`,
      })
    }
    setFormOpen(false)
    setEditing(undefined)
  }

  function handleResetPassword(id: string, _password: string) {
    toast.success("Password direset", {
      description: `Password baru untuk ${users.find((u) => u.id === id)?.name} telah disimpan.`,
    })
    setResetTarget(null)
  }

  function handleToggleStatus(user: SettingsUser) {
    const next: UserStatus = user.status === "Aktif" ? "Nonaktif" : "Aktif"
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: next } : u)))
    toast.success(`User ${next === "Aktif" ? "diaktifkan" : "dinonaktifkan"}`, {
      description: `${user.name} — akses login ${next === "Aktif" ? "dibuka kembali" : "ditangguhkan"}.`,
    })
  }

  function handleDelete() {
    if (!deleteTarget) return
    setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id))
    toast.success("User dihapus", { description: `${deleteTarget.name} dihapus dari sistem.` })
    setDeleteTarget(null)
  }

  const isCurrentUser = (u: SettingsUser) => u.id === currentUser?.id

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold">Manajemen User</h3>
          <p className="text-sm text-muted-foreground">
            {users.length} user terdaftar · {activeCount} aktif
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(undefined)
            setFormOpen(true)
          }}
        >
          <Plus className="mr-1.5 size-4" />
          Tambah User
        </Button>
      </div>

      {/* Mobile: card list */}
      <div className="divide-y divide-border rounded-xl border border-border bg-card sm:hidden">
        {users.map((u) => {
          const role = roleMeta[u.role]
          const RoleIcon = role.icon
          const isMe = isCurrentUser(u)
          return (
            <div key={u.id} className="flex items-center gap-3 px-3.5 py-3">
              <Avatar size="sm">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {getInitials(u.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{u.name}</p>
                  {isMe && <Badge className="text-[0.625rem]">Anda</Badge>}
                </div>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Badge className={cn("text-[0.625rem]", role.badge)}>
                    <RoleIcon className="mr-1 size-2.5" />
                    {role.label}
                  </Badge>
                  <Badge className={cn("text-[0.625rem]", statusBadge[u.status])}>{u.status}</Badge>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setEditing(u)
                      setFormOpen(true)
                    }}
                  >
                    <Pencil className="mr-2 size-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setResetTarget(u)}>
                    <RotateCcw className="mr-2 size-4" />
                    Reset Password
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggleStatus(u)} disabled={isMe && u.status === "Aktif"}>
                    <Lock className="mr-2 size-4" />
                    {u.status === "Aktif" ? "Nonaktifkan" : "Aktifkan"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-rose-600 focus:text-rose-600"
                    onClick={() => setDeleteTarget(u)}
                    disabled={isMe}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Hapus
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto sm:block">
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">User</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Role</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Terakhir Login</TableHead>
                <TableHead className="w-[70px] text-xs uppercase tracking-wider text-muted-foreground">
                  <span className="sr-only">Aksi</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const role = roleMeta[u.role]
                const RoleIcon = role.icon
                const isMe = isCurrentUser(u)
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar size="sm">
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                            {getInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-sm font-medium">
                            {u.name}
                            {isMe && <Badge className="text-[0.625rem]">Anda</Badge>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", role.badge)}>
                        <RoleIcon className="mr-1 size-3" />
                        {role.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", statusBadge[u.status])}>{u.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.lastLogin}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(u)
                              setFormOpen(true)
                            }}
                          >
                            <Pencil className="mr-2 size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetTarget(u)}>
                            <RotateCcw className="mr-2 size-4" />
                            Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(u)} disabled={isMe && u.status === "Aktif"}>
                            <Lock className="mr-2 size-4" />
                            {u.status === "Aktif" ? "Nonaktifkan" : "Aktifkan"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-rose-600 focus:text-rose-600"
                            onClick={() => setDeleteTarget(u)}
                            disabled={isMe}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog tambah/edit */}
      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editing} onSave={handleSave} />

      {/* Dialog reset password */}
      <ResetPasswordDialog
        open={!!resetTarget}
        onOpenChange={(o) => !o && setResetTarget(null)}
        user={resetTarget}
        onReset={handleResetPassword}
      />

      {/* AlertDialog hapus */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Hapus user ini?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {deleteTarget?.name} ({deleteTarget?.email}) akan dihapus permanen dan tidak bisa login lagi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={handleDelete}
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

/* ----------------------------------------------------------------
   Tab: Umum (opsi operasional)
   ---------------------------------------------------------------- */

function TabUmum() {
  const [gracePeriod, setGracePeriod] = useState("7")
  const [billingCycle, setBillingCycle] = useState("Setiap 1 bulan")
  const [saving, setSaving] = useState(false)

  function handleSave() {
    const days = Number(gracePeriod)
    if (!days || days < 1 || days > 60) {
      toast.error("Grace period harus 1–60 hari")
      return
    }
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast.success("Pengaturan disimpan", {
        description: `Grace period ${days} hari · siklus tagihan ${billingCycle.toLowerCase()}.`,
      })
    }, 800)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
              Grace Period Isolir
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Jumlah hari tunggakan sebelum pelanggan diisolir otomatis oleh sistem.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={60}
                className="h-9 w-28"
                value={gracePeriod}
                onChange={(e) => setGracePeriod(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">hari</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
              Billing Cycle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Siklus penerbitan tagihan otomatis per pelanggan.</p>
            <Select value={billingCycle} onValueChange={(v) => v && setBillingCycle(v)}>
              <SelectTrigger className="w-full" data-slot="select-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Setiap 1 bulan">Setiap 1 bulan</SelectItem>
                <SelectItem value="Setiap 2 bulan">Setiap 2 bulan</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <CalendarClock className="size-4" />
          Invoice otomatis dibuat {billingCycle === "Setiap 1 bulan" ? "tanggal 1" : "awal periode"} tiap bulan.
        </span>
      </div>

      <Button className="w-full sm:w-auto" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
        {saving ? "Menyimpan…" : "Simpan Pengaturan"}
      </Button>
    </div>
  )
}

/* ----------------------------------------------------------------
   Tab: Payment Gateway (SumoPod — QRIS)
   ---------------------------------------------------------------- */

type SumopodConfig = {
  apiKey: string
  webhookSigningSecret: string
  webhookToken: string
}

const defaultSumopodConfig: SumopodConfig = {
  apiKey: "",
  webhookSigningSecret: "",
  webhookToken: "",
}

function SecretField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  hint?: string
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id={id}
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-9 pr-9 font-mono"
            autoComplete="off"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? `Sembunyikan ${label}` : `Tampilkan ${label}`}
          >
            {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => {
            navigator.clipboard.writeText(value)
            toast.success(`${label} disalin ke clipboard`)
          }}
          disabled={!value}
          aria-label={`Salin ${label}`}
        >
          <Copy className="size-4" />
        </Button>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function TabPaymentGateway() {
  const [config, setConfig] = useState<SumopodConfig>(defaultSumopodConfig)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [connected, setConnected] = useState<boolean | null>(null)

  const isConfigured = config.apiKey.trim().length > 0

  /** URL webhook — otomatis mengikuti origin yang sedang diakses (local/domain). */
  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhook/payment`
      : "http://localhost:3000/api/webhook/payment"

  const handleSave = () => {
    async function doSave() {
      try {
        setSaving(true)
        // Only send fields that are not masked (masked value contains '*')
        const payload: Partial<SumopodConfig> = {}
        const isMasked = (v: string) => v.includes("*")
        if (config.apiKey && !isMasked(config.apiKey)) payload.apiKey = config.apiKey
        if (config.webhookSigningSecret && !isMasked(config.webhookSigningSecret)) payload.webhookSigningSecret = config.webhookSigningSecret
        if (config.webhookToken && !isMasked(config.webhookToken)) payload.webhookToken = config.webhookToken

        await api.put("/payment-gateway/config", payload)
        toast.success("Konfigurasi payment gateway disimpan", {
          description: "Kredensial SumoPod tersimpan. Webhook akan diverifikasi otomatis.",
        })
        // reload masked values from server
        const res = await api.get("/payment-gateway/config")
        const data = res.data?.data
        if (data) {
          setConfig({
            apiKey: data.apiKey || "",
            webhookSigningSecret: data.webhookSigningSecret || "",
            webhookToken: data.webhookToken || "",
          })
        }
      } catch (err: any) {
        toast.error(err?.response?.data?.error?.message || "Gagal menyimpan konfigurasi")
      } finally {
        setSaving(false)
      }
    }
    void doSave()
  }

  const handleTestConnection = () => {
    async function doTest() {
      setTesting(true)
      setConnected(null)
      try {
        const res = await api.post("/payment-gateway/test")
        const ok = !!res.data?.data?.connected
        setConnected(ok)
        if (ok) toast.success("Terhubung ke SumoPod — status OK")
        else toast.error("Gagal terhubung ke SumoPod. Periksa API Key.")
      } catch (err: any) {
        setConnected(false)
        const msg = err?.response?.data?.error?.message || "Gagal menghubungi server"
        toast.error(msg)
      } finally {
        setTesting(false)
      }
    }
    void doTest()
  }

  // Load stored (masked) config when tab mounts
  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const res = await api.get("/payment-gateway/config")
        const data = res.data?.data
        if (mounted && data) {
          setConfig({
            apiKey: data.apiKey || "",
            webhookSigningSecret: data.webhookSigningSecret || "",
            webhookToken: data.webhookToken || "",
          })
        }
      } catch (err) {
        // ignore
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl)
    toast.success("URL webhook disalin ke clipboard")
  }

  return (
    <div className="space-y-4">
      {/* URL Webhook */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            <ExternalLink className="size-4" />
            URL Webhook
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Daftarkan URL ini sebagai endpoint webhook <code className="font-mono text-xs">payment.completed</code> di
            dashboard SumoPod. URL otomatis mengikuti alamat yang sedang diakses —{" "}
            <code className="font-mono text-xs">{window.location.origin}</code>.
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={webhookUrl}
              className="h-9 flex-1 font-mono text-xs"
              onFocus={(e) => e.target.select()}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copyWebhookUrl}
              aria-label="Salin URL webhook"
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" />
            Pastikan server mengizinkan akses publik ke endpoint ini (bukan hanya localhost).
          </div>
        </CardContent>
      </Card>

      {/* Kredensial */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            <QrCode className="size-4" />
            Kredensial SumoPod
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/40 px-3.5 py-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="size-4" />
              Status konfigurasi
            </span>
            {isConfigured ? (
              <Badge className="bg-emerald-100 text-emerald-800 text-xs dark:bg-emerald-900/40 dark:text-emerald-300">
                <CheckCircle2 className="mr-1 size-3" />
                Terkonfigurasi
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800 text-xs dark:bg-amber-900/40 dark:text-amber-300">
                Belum dikonfigurasi
              </Badge>
            )}
          </div>

          <SecretField
            id="pg-api-key"
            label="API Key"
            value={config.apiKey}
            onChange={(v) => setConfig({ ...config, apiKey: v })}
            placeholder="sumo_xxxxxxxxxxxx"
            hint="Digunakan pada header X-Api-Key saat membuat payment di api-pay.sumopod.com."
          />
          <SecretField
            id="pg-signing-secret"
            label="Webhook Signing Secret"
            value={config.webhookSigningSecret}
            onChange={(v) => setConfig({ ...config, webhookSigningSecret: v })}
            placeholder="whsec_xxxxxxxxxxxx"
            hint="Verifikasi signature Svix (svix-id · svix-timestamp · svix-signature) via HMAC-SHA256."
          />
          <SecretField
            id="pg-webhook-token"
            label="Webhook Token"
            value={config.webhookToken}
            onChange={(v) => setConfig({ ...config, webhookToken: v })}
            placeholder="whtok_xxxxxxxxxxxx"
            hint="Alternatif verifikasi sederhana — dibandingkan dengan header X-Webhook-Token."
          />
        </CardContent>
      </Card>

      {/* Status koneksi */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            Status Koneksi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/40 px-3.5 py-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <ExternalLink className="size-4" />
              api-pay.sumopod.com
            </span>
            {connected === null ? (
              <Badge variant="outline" className="text-xs">
                Belum diuji
              </Badge>
            ) : connected ? (
              <Badge className="bg-emerald-100 text-emerald-800 text-xs dark:bg-emerald-900/40 dark:text-emerald-300">
                <CheckCircle2 className="mr-1 size-3" />
                Terhubung
              </Badge>
            ) : (
              <Badge className="bg-rose-100 text-rose-800 text-xs dark:bg-rose-900/40 dark:text-rose-300">
                <XCircle className="mr-1 size-3" />
                Gagal
              </Badge>
            )}
          </div>
          <Button className="w-full" variant="outline" onClick={handleTestConnection} disabled={testing}>
            {testing ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 size-4" />}
            {testing ? "Menguji koneksi…" : "Tes Koneksi"}
          </Button>
        </CardContent>
      </Card>

      {/* Info mekanisme */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            Cara Kerja QRIS SumoPod
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/40 p-3.5">
            <p className="flex items-center gap-2 font-medium">
              <QrCode className="size-4 text-primary" />
              Alur pembayaran
            </p>
            <ol className="ml-5 list-decimal space-y-1 text-muted-foreground">
              <li>
                Sistem memanggil <code className="font-mono text-xs">POST /api/v1/payments</code> dengan header{" "}
                <code className="font-mono text-xs">X-Api-Key</code> untuk membuat payment QRIS (order_id = no invoice).
              </li>
              <li>
                Pelanggan menerima <code className="font-mono text-xs">payment_link_url</code> dan membayar via QRIS.
              </li>
              <li>
                SumoPod mengirim webhook <code className="font-mono text-xs">payment.completed</code> ke URL aplikasi.
              </li>
              <li>
                Sistem memverifikasi signature (Svix) atau <code className="font-mono text-xs">X-Webhook-Token</code>, lalu
                menandai pembayaran <strong>Sukses</strong> &amp; memperpanjang masa aktif 1 bulan.
              </li>
            </ol>
          </div>
          <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/40 p-3.5">
            <p className="flex items-center gap-2 font-medium">
              <ShieldCheck className="size-4 text-primary" />
              Keamanan webhook
            </p>
            <ul className="ml-5 list-disc space-y-1 text-muted-foreground">
              <li>Endpoint webhook wajib membalas 2xx dalam 10 detik, jika tidak dianggap gagal.</li>
              <li>
                Signature: HMAC-SHA256 dari{" "}
                <code className="font-mono text-xs">{`{svixId}.{svixTimestamp}.{rawBody}`}</code> — gunakan{" "}
                <strong>raw body</strong> tanpa format ulang.
              </li>
              <li>Idempotent: payment_id yang sama tidak diproses dua kali.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Button className="w-full sm:w-auto" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Save className="mr-1.5 size-4" />}
        {saving ? "Menyimpan…" : "Simpan Konfigurasi"}
      </Button>
    </div>
  )
}

/* ----------------------------------------------------------------
   Halaman
   ---------------------------------------------------------------- */

export function SettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "Pengaturan" }]}
        title="Pengaturan"
        description="Kelola user, role, dan opsi operasional sistem."
      />

      <Tabs defaultValue="akun" className="w-full">
        <TabsList>
          <TabsTrigger value="akun">
            <UserCog className="mr-1.5 size-3.5" />
            Akun
          </TabsTrigger>
          <TabsTrigger value="user">
            <Users className="mr-1.5 size-3.5" />
            User
          </TabsTrigger>
          <TabsTrigger value="payment-gateway">
            <QrCode className="mr-1.5 size-3.5" />
            Payment Gateway
          </TabsTrigger>
          <TabsTrigger value="umum">
            <CalendarClock className="mr-1.5 size-3.5" />
            Umum
          </TabsTrigger>
        </TabsList>

        <TabsContent value="akun" className="mt-4">
          <TabAkun />
        </TabsContent>

        <TabsContent value="user" className="mt-4">
          <TabUser />
        </TabsContent>

        <TabsContent value="payment-gateway" className="mt-4">
          <TabPaymentGateway />
        </TabsContent>

        <TabsContent value="umum" className="mt-4">
          <TabUmum />
        </TabsContent>
      </Tabs>
    </div>
  )
}

