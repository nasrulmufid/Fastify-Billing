import { useEffect, useState } from "react"
import { Loader2, Save, Settings2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import api from "@/lib/axios"

type Router = {
  id: number
  name: string
  host: string
  ipPool?: string
  ipPoolPppoe?: string
  ipPoolIsolir?: string
}

type RouterSettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  router: Router | null
  onSaved?: () => void
}

export function RouterSettingsDialog({ open, onOpenChange, router, onSaved }: RouterSettingsDialogProps) {
  const [ipPoolPppoe, setIpPoolPppoe] = useState("")
  const [ipPoolIsolir, setIpPoolIsolir] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && router) {
      setIpPoolPppoe(router.ipPoolPppoe ?? "")
      setIpPoolIsolir(router.ipPoolIsolir ?? "")
      setSaving(false)
    }
  }, [open, router])

  const handleSave = async () => {
    if (!router) return
    setSaving(true)
    try {
      await api.put(`/routers/${router.id}`, { ipPoolPppoe, ipPoolIsolir })
      toast.success("Setting IP Pool disimpan", {
        description: `IP Pool PPPoE dan Isolir untuk ${router.name} telah diperbarui.`,
      })
      onSaved?.()
      onOpenChange(false)
    } catch {
      toast.error("Gagal menyimpan setting IP Pool", {
        description: "Terjadi kesalahan saat menghubungi server.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Settings2 className="size-5" />
            Setting IP Pool — {router?.name}
          </DialogTitle>
          <DialogDescription>
            Atur rentang IP untuk pelanggan baru (PPPoE) dan pelanggan isolir pada router{" "}
            <strong>{router?.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-1 py-2">
          <div className="space-y-2">
            <Label htmlFor="ip-pool-pppoe">IP Pool PPPoE</Label>
            <Input
              id="ip-pool-pppoe"
              className="font-mono"
              placeholder="Contoh: 192.168.200.0/24"
              value={ipPoolPppoe}
              onChange={(e) => setIpPoolPppoe(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              CIDR pool untuk alokasi IP otomatis pelanggan baru. Kosongkan untuk default.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ip-pool-isolir">IP Pool Isolir</Label>
            <Input
              id="ip-pool-isolir"
              className="font-mono"
              placeholder="Contoh: 10.99.0.0/24"
              value={ipPoolIsolir}
              onChange={(e) => setIpPoolIsolir(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              CIDR pool untuk profile ISOLIR di Mikrotik. Pelanggan yang diisolir akan mendapat IP dari pool ini.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Menyimpan…
              </>
            ) : (
              <>
                <Save className="mr-1.5 size-4" />
                Simpan Setting
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
