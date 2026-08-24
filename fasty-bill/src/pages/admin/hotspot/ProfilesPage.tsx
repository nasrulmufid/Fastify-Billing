import { useMemo, useState, useEffect } from "react"
import { toast } from "sonner"
import { Gauge, Plus, Pencil, Trash2, Power } from "lucide-react"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import { durationLabelFromHours } from "@/lib/hotspotData"
import { useHotspotStore, type HotspotProfile, type HotspotUser } from "@/store/hotspotStore"

function formatPrice(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`
}

type ProfileForm = Omit<HotspotProfile, 'id'> & { id?: number }

export function ProfilesTab() {
  const profiles = useHotspotStore((s) => s.profiles)
  const users = useHotspotStore((s) => s.users)
  const addProfile = useHotspotStore((s) => s.addProfile)
  const updateProfile = useHotspotStore((s) => s.updateProfile)
  const removeProfile = useHotspotStore((s) => s.removeProfile)
  const load = useHotspotStore((s) => s.load)

  // Muat data dari database real saat komponen mount
  useEffect(() => {
    load()
  }, [load])

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

export function ProfilesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "Hotspot", to: "/admin/hotspot" }, { label: "Profil Hotspot" }]}
        title="Profil Hotspot"
        description="Kelola profile hotspot untuk membatasi durasi, kecepatan, dan jumlah perangkat."
      />
      <ProfilesTab />
    </div>
  )
}
