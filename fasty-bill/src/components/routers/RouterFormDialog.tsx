import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Plus, Server } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/* ----------------------------------------------------------------
   Options
   ---------------------------------------------------------------- */

export const ROUTER_PROVIDER_OPTIONS = [
  "Mikrotik",
  "FreeRADIUS",
  "Cisco",
  "Ubiquiti",
  "TP-Link",
  "Lainnya",
]

/* ----------------------------------------------------------------
   Schema
   ---------------------------------------------------------------- */

/** Host = IPv4 ATAU hostname/domain, dengan port opsional (host:port).
 *  Contoh valid: 192.168.2.1, 192.168.2.1:177, idn24.tunnel.id:3025
 *  Label hostname TIDAK boleh seluruhnya angka (mis. 999.999.999.999 ditolak). */
const HOST_RE =
  /^(?:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)|(?![0-9]+(?:\.|:|$))[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*)(?::(?:[1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5]))?$/

const formSchema = z.object({
  name: z.string().min(3, "Nama router minimal 3 karakter"),
  host: z
    .string()
    .regex(HOST_RE, "Format tidak valid. Contoh: 192.168.2.1:177 atau idn24.tunnel.id:3025"),
  provider: z.string().min(1, "Pilih provider"),
  username: z.string(),
  password: z.string(),
  useHttps: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

/* ----------------------------------------------------------------
   Component
   ---------------------------------------------------------------- */

type RouterFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Callback saat router disimpan. */
  onSubmit: (input: {
    name: string
    host: string
    provider: string
    apiPort?: number
    apiUser?: string
    apiPassword?: string
    apiUseHttps?: boolean
  }) => void
  /** Router yang sedang diedit (prefill form). Null = mode tambah. */
  editing?: {
    id: number
    name: string
    host: string
    provider: string
    apiUseHttps?: boolean
    apiUser?: string
    apiPassword?: string
  } | null
}

export function RouterFormDialog({ open, onOpenChange, onSubmit, editing }: RouterFormDialogProps) {
  const [submitting, setSubmitting] = useState(false)

  const defaultValues = useMemo<FormValues>(
    () => ({
      name: "",
      host: "",
      provider: "Mikrotik",
      username: "admin",
      password: "",
      useHttps: false,
    }),
    [],
  )

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  const provider = watch("provider")

  // Reset form setiap dialog dibuka (prefill bila mode edit)
  useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              name: editing.name,
              host: editing.host,
              provider: editing.provider,
              username: editing.apiUser ?? "admin",
              password: editing.apiPassword ?? "",
              useHttps: editing.apiUseHttps ?? false,
            }
          : defaultValues,
      )
      setSubmitting(false)
    }
  }, [open, reset, defaultValues, editing])

  function handleFormSubmit(values: FormValues) {
    setSubmitting(true)
    const hostRaw = values.host.trim()
    // Pisahkan port dari host bila ada (host:port)
    const portMatch = hostRaw.match(/:(\d+)$/)
    // Default port REST API Mikrotik: 80 (HTTP) atau 443 (HTTPS).
    // JANGAN pakai 8728 — itu port API binary legacy, bukan REST API.
    const apiPort = portMatch ? Number(portMatch[1]) : values.useHttps ? 443 : 80
    const hostOnly = portMatch ? hostRaw.replace(/:\d+$/, "") : hostRaw
    onSubmit({
      name: values.name.trim(),
      host: hostOnly,
      provider: values.provider,
      apiPort,
      apiUseHttps: values.useHttps,
      apiUser: values.username?.trim() || undefined,
      apiPassword: values.password ? values.password : undefined,
    })
    toast.success(editing ? "Router berhasil diperbarui" : "Router berhasil ditambahkan", {
      description: `${values.name.trim()} (${hostOnly}) siap dikelola.`,
    })
    setSubmitting(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Server className="size-4" />
            </span>
            {editing ? "Edit Router" : "Tambah Router Baru"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {editing
              ? "Perbarui konfigurasi router Mikrotik yang terhubung ke jaringan."
              : "Daftarkan router Mikrotik yang terhubung ke jaringan. Koneksi akan diuji otomatis."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="router-name">Nama Router</Label>
            <Input
              id="router-name"
              placeholder="Mikrotik-Core-03"
              className="h-9"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="router-host">Host / IP Address</Label>
            <Input
              id="router-host"
              placeholder="192.168.2.1:177 atau idn24.tunnel.id:3025"
              className="h-9 font-mono"
              aria-invalid={!!errors.host}
              {...register("host")}
            />
            {errors.host && (
              <p className="text-xs text-destructive">{errors.host.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) => v && setValue("provider", v)}
            >
              <SelectTrigger className="w-full" data-slot="select-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUTER_PROVIDER_OPTIONS.map((provider) => (
                  <SelectItem key={provider} value={provider}>
                    {provider}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="router-user">Username</Label>
            <Input
              id="router-user"
              placeholder="admin"
              className="h-9"
              {...register("username")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="router-pass">Password</Label>
            <Input
              id="router-pass"
              type="password"
              placeholder="••••••••"
              className="h-9"
              {...register("password")}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" className="size-4" {...register("useHttps")} />
            <span>Gunakan HTTPS (port 443) untuk REST API</span>
          </label>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Plus className="mr-1.5 size-4" />
              )}
              {submitting ? "Menyimpan…" : editing ? "Simpan Perubahan" : "Tambah Router"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
