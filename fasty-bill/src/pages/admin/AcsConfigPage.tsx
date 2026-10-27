/**
 * ACS Configuration Page.
 *
 * Form to configure GenieACS server URL, API key, sync interval,
 * and auto-sync toggle.
 */

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Save, Settings } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAcsConfig, useUpdateAcsConfig } from "@/hooks/queries/useAcsQueries"

const configSchema = z.object({
  baseUrl: z.string().url("URL GenieACS tidak valid"),
  apiKey: z.string().min(1, "API Key wajib diisi"),
  syncIntervalMinutes: z.coerce.number().int().min(5).max(1440),
  autoSyncOnAccess: z.boolean(),
})

type ConfigFormValues = z.infer<typeof configSchema>

export function AcsConfigPage() {
  const { data: config, isLoading } = useAcsConfig()
  const mutation = useUpdateAcsConfig()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      baseUrl: "http://localhost:7557",
      apiKey: "",
      syncIntervalMinutes: 30,
      autoSyncOnAccess: true,
    },
  })

  // Populate form when config loads
  useEffect(() => {
    if (config) {
      reset({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey, // will be empty if not yet configured
        syncIntervalMinutes: config.syncIntervalMinutes,
        autoSyncOnAccess: config.autoSyncOnAccess,
      })
    }
  }, [config, reset])

  const onSubmit = (values: ConfigFormValues) => {
    mutation.mutate(values)
  }

  const interval = watch("syncIntervalMinutes")
  const autoSync = watch("autoSyncOnAccess")

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", to: "/admin" },
          { label: "ACS", to: "/admin/acs" },
          { label: "Konfigurasi" },
        ]}
        title="Konfigurasi GenieACS"
        description="Pengaturan koneksi ke server GenieACS"
        actions={
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={mutation.isPending || !isDirty}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Simpan
          </Button>
        }
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            Pengaturan Server
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* GenieACS URL */}
            <div className="space-y-2">
              <Label htmlFor="baseUrl">URL GenieACS</Label>
              <Input
                id="baseUrl"
                placeholder="http://genieacs-host:7557"
                {...register("baseUrl")}
              />
              {errors.baseUrl && (
                <p className="text-xs text-red-500">{errors.baseUrl.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Alamat server GenieACS termasuk port (default: 7557)
              </p>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Masukkan API key GenieACS"
                {...register("apiKey")}
              />
              {errors.apiKey && (
                <p className="text-xs text-red-500">{errors.apiKey.message}</p>
              )}
              {config?.apiKeyMasked && !watch("apiKey") && (
                <p className="text-xs text-muted-foreground">
                  Tersimpan: {config.apiKeyMasked}
                </p>
              )}
            </div>

            {/* Sync Interval */}
            <div className="space-y-2">
              <Label htmlFor="syncIntervalMinutes">Interval Sync</Label>
              <Select
                value={String(interval ?? 30)}
                onValueChange={(v) => setValue("syncIntervalMinutes", Number(v))}
              >
                <SelectTrigger id="syncIntervalMinutes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 menit</SelectItem>
                  <SelectItem value="15">15 menit</SelectItem>
                  <SelectItem value="30">30 menit</SelectItem>
                  <SelectItem value="60">1 jam</SelectItem>
                  <SelectItem value="120">2 jam</SelectItem>
                  <SelectItem value="360">6 jam</SelectItem>
                  <SelectItem value="1440">24 jam</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Auto-sync on access */}
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="autoSyncOnAccess" className="text-sm font-medium">
                  Auto-sync saat akses halaman
                </Label>
                <p className="text-xs text-muted-foreground">
                  Otomatis sinkronkan device saat halaman ACS dibuka
                </p>
              </div>
              <Switch
                id="autoSyncOnAccess"
                checked={autoSync}
                onCheckedChange={(v) => setValue("autoSyncOnAccess", v)}
              />
            </div>

            <Button
              type="submit"
              disabled={mutation.isPending || !isDirty}
              className="w-full"
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Simpan Konfigurasi
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
