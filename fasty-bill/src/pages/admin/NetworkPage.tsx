import { useEffect, useState } from "react"
import {
  Activity,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Server,
  Settings2,
  Trash2,
  Users,
  Wifi,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
import { RouterFormDialog } from "@/components/routers/RouterFormDialog"
import { RouterSettingsDialog } from "@/components/routers/RouterSettingsDialog"
import { cn } from "@/lib/utils"
import api from "@/lib/axios"

type RouterStatus = "Connected" | "Standby" | "Disconnected"

type NetworkRouter = {
  id: number
  name: string
  host: string
  provider: string
  status: RouterStatus
  clientCount: number
  uptime: string
  ipPool?: string
  ipPoolPppoe?: string
  ipPoolIsolir?: string
}

const statusBadge: Record<RouterStatus, string> = {
  Connected: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Standby: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  Disconnected: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
}

const statusDot: Record<RouterStatus, string> = {
  Connected: "bg-emerald-500",
  Standby: "bg-amber-500",
  Disconnected: "bg-rose-500",
}

export function NetworkPage() {
  const [routers, setRouters] = useState<NetworkRouter[]>([])
  const [testing, setTesting] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<(NetworkRouter & { apiPort?: number; apiUseHttps?: boolean; apiUser?: string; apiPassword?: string }) | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NetworkRouter | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [settingsTarget, setSettingsTarget] = useState<NetworkRouter | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const busy = testing !== null || syncing !== null
  const online = routers.filter((r) => r.status === "Connected").length
  const totalClients = routers.reduce((sum, r) => sum + r.clientCount, 0)

  // Muat router dari backend (sumber data tunggal — tidak ada mock)
  const loadRouters = async () => {
    try {
      const { data } = await api.get<{ data: NetworkRouter[] }>("/routers")
      if (Array.isArray(data.data)) setRouters(data.data)
    } catch {
      toast.error("Gagal memuat daftar router")
    }
  }

  useEffect(() => {
    loadRouters()
  }, [])

  const handleAddRouter = async (input: {
    name: string
    host: string
    provider: string
    apiPort?: number
    apiUser?: string
    apiPassword?: string
    apiUseHttps?: boolean
  }) => {
    // Cegah duplikat nama/host (di sisi client, sebagai guard cepat)
    const duplicate = routers.some(
      (r) => r.name.toLowerCase() === input.name.toLowerCase() || r.host === input.host,
    )
    if (duplicate) {
      toast.error("Router sudah terdaftar", {
        description: "Nama atau Host/alamat sudah dipakai router lain.",
      })
      return
    }
    try {
      await api.post("/routers", {
        name: input.name,
        host: input.host,
        provider: input.provider,
        apiPort: input.apiPort,
        apiUseHttps: input.apiUseHttps,
        apiUser: input.apiUser,
        apiPassword: input.apiPassword,
      })
      await loadRouters()
      toast.success("Router ditambahkan", {
        description: `${input.name} (${input.host}) tersimpan di database.`,
      })
    } catch {
      toast.error("Gagal menambahkan router", {
        description: "Terjadi kesalahan saat menyimpan ke server.",
      })
    }
  }

  const handleEditRouter = async (input: {
    name: string
    host: string
    provider: string
    apiPort?: number
    apiUser?: string
    apiPassword?: string
    apiUseHttps?: boolean
  }) => {
    if (!editing) return
    // Cegah duplikat nama/host terhadap router lain (bukan dirinya sendiri)
    const duplicate = routers.some(
      (r) =>
        r.id !== editing.id &&
        (r.name.toLowerCase() === input.name.toLowerCase() || r.host === input.host),
    )
    if (duplicate) {
      toast.error("Router sudah terdaftar", {
        description: "Nama atau Host/alamat sudah dipakai router lain.",
      })
      return
    }
    try {
      await api.put(`/routers/${editing.id}`, {
        name: input.name,
        host: input.host,
        provider: input.provider,
        apiPort: input.apiPort,
        apiUseHttps: input.apiUseHttps,
        apiUser: input.apiUser,
        apiPassword: input.apiPassword,
      })
      await loadRouters()
      toast.success("Router diperbarui", {
        description: `${input.name} (${input.host}) tersimpan di database.`,
      })
    } catch {
      toast.error("Gagal memperbarui router", {
        description: "Terjadi kesalahan saat menyimpan ke server.",
      })
    }
  }

  const openEdit = (router: NetworkRouter) => {
    setEditing(router)
    setFormOpen(true)
  }

  const handleFormSubmit = (input: {
    name: string
    host: string
    provider: string
    apiPort?: number
    apiUser?: string
    apiPassword?: string
    apiUseHttps?: boolean
  }) => {
    if (editing) {
      handleEditRouter(input)
    } else {
      handleAddRouter(input)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/routers/${deleteTarget.id}`)
      setRouters((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      toast.success("Router dihapus", {
        description: `${deleteTarget.name} telah dihapus dari daftar.`,
      })
      setDeleteTarget(null)
    } catch {
      toast.error("Gagal menghapus router", {
        description: "Terjadi kesalahan saat menghubungi server.",
      })
    } finally {
      setDeleting(false)
    }
  }

  const stats = [
    {
      label: "Total Router",
      value: routers.length,
      icon: Server,
      gradient: "from-indigo-500/10 via-indigo-500/5 to-transparent",
      iconBg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300",
    },
    {
      label: "Online",
      value: online,
      icon: CheckCircle2,
      gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
      iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
    },
    {
      label: "Pelanggan Terhubung",
      value: totalClients,
      icon: Users,
      gradient: "from-sky-500/10 via-sky-500/5 to-transparent",
      iconBg: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300",
    },
  ]

  const handleTest = async (router: NetworkRouter) => {
    setTesting(router.name)
    try {
      const { data } = await api.post<{
        data: { status: RouterStatus }
        warning?: { message: string }
      }>(`/routers/${router.id}/test`, {})
      setRouters((prev) =>
        prev.map((r) => (r.id === router.id ? { ...r, status: data.data.status } : r)),
      )
      if (data.data.status === "Connected") {
        toast.success(`Koneksi ${router.name} terhubung`, {
          description: `${router.host} merespons.`,
        })
      } else {
        toast.error(`Koneksi ${router.name} gagal`, {
          description: "Router tidak merespons. Periksa jaringan.",
        })
      }
      if (data.warning) toast.warning(data.warning.message)
    } catch {
      toast.error(`Gagal menguji ${router.name}`, {
        description: "Terjadi kesalahan saat menghubungi server.",
      })
    } finally {
      setTesting(null)
    }
  }

  const handleSync = async (router: NetworkRouter) => {
    setSyncing(router.name)
    try {
      const { data } = await api.post<{
        data: { syncedCount: number }
        warning?: { message: string }
      }>(`/routers/${router.id}/sync`, {})
      toast.success("Sinkronisasi selesai", {
        description: `${data.data.syncedCount} user (profile PPP + secret PPP) disinkronkan ke ${router.name}.`,
      })
      if (data.warning) toast.warning(data.warning.message)
    } catch {
      toast.error(`Gagal menyinkronkan ${router.name}`, {
        description: "Terjadi kesalahan saat menghubungi server.",
      })
    } finally {
      setSyncing(null)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "Jaringan" }]}
        title="Jaringan & Router"
        description="Kelola router Mikrotik yang terhubung ke jaringan."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-1.5 size-4" />
            Add New Router
          </Button>
        }
      />

      {/* Statistik */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((item) => {
          const Icon = item.icon
          return (
            <Card
              key={item.label}
              className={`relative overflow-hidden border-border bg-gradient-to-br ${item.gradient}`}
            >
              <CardContent className="px-5 py-4">
                <div className={`absolute right-3 top-3 rounded-xl p-2.5 opacity-60 ${item.iconBg}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{item.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Daftar router */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {routers.map((router) => (
          <Card key={router.name} className="border-border">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Server className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{router.name}</h3>
                    <p className="truncate font-mono text-xs text-muted-foreground">{router.host}</p>
                  </div>
                </div>
                <Badge className={cn("text-xs", statusBadge[router.status])}>
                  <span
                    className={cn("mr-1.5 inline-block size-1.5 rounded-full", statusDot[router.status])}
                  />
                  {router.status}
                </Badge>
              </div>

              <div className="mt-4 space-y-2.5 border-t border-dashed border-border pt-4 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Wifi className="size-3.5" />
                    Provider
                  </span>
                  <span className="font-medium">{router.provider}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="size-3.5" />
                    Pelanggan
                  </span>
                  <span className="font-medium tabular-nums">{router.clientCount} online</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Activity className="size-3.5" />
                    Uptime
                  </span>
                  <span className="font-medium">{router.uptime}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  className="flex-1"
                  onClick={() => handleTest(router)}
                  disabled={busy}
                >
                  {testing === router.name ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <Activity className="mr-1.5 size-4" />
                  )}
                  {testing === router.name ? "Menguji…" : "Test koneksi"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleSync(router)}
                  disabled={busy}
                >
                  {syncing === router.name ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 size-4" />
                  )}
                  {syncing === router.name ? "Menyinkronkan…" : "Sync user"}
                </Button>
                {/* Setting IP Pool PPPOE & Isolir */}
                <Button
                  variant="outline"
                  className="flex-1 justify-center text-violet-600 hover:bg-violet-500/10 hover:text-violet-600"
                  onClick={() => {
                    setSettingsTarget(router)
                    setSettingsOpen(true)
                  }}
                  disabled={busy}
                >
                  <Settings2 className="mr-1.5 size-4" />
                  Setting IP Pool
                </Button>
                {/* Mobile: tombol berlabel lebar penuh. Desktop: ikon di ujung kanan. */}
                <Button
                  variant="ghost"
                  className="flex-1 justify-center text-rose-600 hover:bg-rose-500/10 hover:text-rose-600 sm:flex-none sm:justify-normal"
                  onClick={() => setDeleteTarget(router)}
                  disabled={busy}
                >
                  <Trash2 className="mr-1.5 size-4 sm:mr-0" />
                  <span className="sm:hidden">Hapus</span>
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 justify-center sm:flex-none sm:justify-normal"
                  onClick={() => openEdit(router)}
                  disabled={busy}
                >
                  <Pencil className="mr-1.5 size-4 sm:mr-0" />
                  <span className="sm:hidden">Edit</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog tambah/edit router */}
      <RouterFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditing(null)
        }}
        onSubmit={handleFormSubmit}
        editing={editing}
      />

      {/* Dialog set pool IP PPPoE */}
      <RouterIpPoolDialog
        open={ipPoolOpen}
        onOpenChange={setIpPoolOpen}
        router={ipPoolTarget}
        onSaved={loadRouters}
      />

      {/* Dialog setting IP Pool PPPOE & Isolir */}
      <RouterSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        router={settingsTarget}
        onSaved={loadRouters}
      />

      {/* Konfirmasi hapus router */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Hapus router?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Router <strong>{deleteTarget?.name}</strong> akan dihapus dari daftar.
              Secret PPP pelanggan yang ter-assign ke router ini tidak akan otomatis dihapus di
              Mikrotik — pastikan sudah di-nonaktifkan terlebih dahulu. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleting ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 size-4" />
              )}
              {deleting ? "Menghapus…" : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
