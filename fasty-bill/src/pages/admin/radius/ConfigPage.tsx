/**
 * Halaman Pengaturan FreeRADIUS — host/port yang dipakai backend & retensi radacct.
 * Nilai disimpan di app_settings (setting_key='radius_config') sebagai override env.
 */

import { useEffect } from "react"
import { Loader2, Save, Settings } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRadiusConfig, useUpdateRadiusConfig } from "@/hooks/queries/useRadiusQueries"
import { useState } from "react"

export function RadiusConfigPage() {
  const { data: config, isLoading } = useRadiusConfig()
  const mutation = useUpdateRadiusConfig()

  const [host, setHost] = useState("freeradius")
  const [authPort, setAuthPort] = useState("1812")
  const [acctPort, setAcctPort] = useState("1813")
  const [coaPort, setCoaPort] = useState("3799")
  const [retentionDays, setRetentionDays] = useState("90")

  useEffect(() => {
    if (config) {
      setHost(config.host ?? "freeradius")
      setAuthPort(String(config.authPort ?? 1812))
      setAcctPort(String(config.acctPort ?? 1813))
      setCoaPort(String(config.coaPort ?? 3799))
      setRetentionDays(String(config.retentionDays ?? 90))
    }
  }, [config])

  const handleSave = () => {
    const retention = Number(retentionDays)
    if (!retention || retention < 7 || retention > 3650) {
      toast.error("Retensi harus 7–3650 hari")
      return
    }
    mutation.mutate({
      host,
      authPort: Number(authPort),
      acctPort: Number(acctPort),
      coaPort: Number(coaPort),
      retentionDays: retention,
    })
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", to: "/admin" },
          { label: "RADIUS", to: "/admin/radius/status" },
          { label: "Pengaturan" },
        ]}
        title="Pengaturan FreeRADIUS"
        description="Koneksi backend ke server FreeRADIUS dan retensi data accounting."
        actions={
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Simpan
          </Button>
        }
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="size-4" />
            Server & Retensi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="radius-host">Host FreeRADIUS</Label>
            <Input id="radius-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="freeradius" />
            <p className="text-xs text-muted-foreground">
              Nama service Docker atau IP server RADIUS. CoA/Disconnect dikirim langsung ke IP NAS (router).
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="radius-auth">Port Auth</Label>
              <Input id="radius-auth" type="number" value={authPort} onChange={(e) => setAuthPort(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="radius-acct">Port Acct</Label>
              <Input id="radius-acct" type="number" value={acctPort} onChange={(e) => setAcctPort(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="radius-coa">Port CoA</Label>
              <Input id="radius-coa" type="number" value={coaPort} onChange={(e) => setCoaPort(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="radius-retention">Retensi radacct (hari)</Label>
            <Input
              id="radius-retention"
              type="number"
              min={7}
              max={3650}
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Data sesi yang sudah berakhir dihapus otomatis oleh job harian setelah batas ini.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
