import { useEffect, useState } from "react"
import { Loader2, Save } from "lucide-react"
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

type RouterIpPoolDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  router: { id: number; name: string; host: string; ipPool?: string } | null
  onSaved?: () => void
}

export function RouterIpPoolDialog({ open, onOpenChange, router, onSaved }: RouterIpPoolDialogProps) {
  const [ipPool, setIpPool] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && router) {
      setIpPool(router.ipPool ?? "")
      setSaving(false)
    }
  }, [open, router])

  const handleSave = async () => {
    if (!router) return
    setSaving(true)
    try {
      await api.put(`/routers/${router.id}`, { ipPool })
      toast.success("Pool IP disimpan", {
        description: ipPool
          ? `Pelanggan baru di ${router.name} akan otomatis mengambil IP dari ${ipPool}.`
          : `Pool IP untuk ${router.name} dikosongkan (pakai default 192.168.1.x).`,
      })
      onSaved?.()
      onOpenChange(false)
    } catch {
      toast.error("Gagal menyimpan pool IP", {
        description: "Terjadi kesalahan saat menghubungi server.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Set Pool IP PPPoE</DialogTitle>
          <DialogDescription>
            Atur rentang IP otomatis untuk router <strong>{router?.name}</strong>. Setiap pelanggan
            baru yang tidak mengisi IP manual akan mendapat IP berikutnya dari pool ini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 px-1 py-2">
          <Label htmlFor="ip-pool">CIDR Pool <span className="text-rose-500">*</span></Label>
          <Input
            id="ip-pool"
            className="font-mono"
            placeholder="Contoh: 192.168.200.0/24"
            value={ipPool}
            onChange={(e) => setIpPool(e.target.value)}
            aria-invalid={false}
          />
          <p className="text-xs text-muted-foreground">
            Format CIDR, contoh <span className="font-mono">192.168.200.0/24</span>. Kosongkan untuk
            kembali ke default <span className="font-mono">192.168.1.x</span>.
          </p>
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
                Simpan Pool
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
