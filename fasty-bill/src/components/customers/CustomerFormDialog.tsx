import { useCallback, useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { RefreshCw, Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
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
import { useCustomerActions, type Customer, type CustomerInput } from "@/lib/customerStore"
import api from "@/lib/axios"

/* ----------------------------------------------------------------
   Options (dimuat real dari backend saat dialog dibuka)
   ---------------------------------------------------------------- */

type PkgOption = { id: number; name: string; price: number; type: string; status: string }
type RouterOption = { id: number; name: string; host: string }

/* ----------------------------------------------------------------
   Helpers
   ---------------------------------------------------------------- */

/** "0812-3456-7890" -> "812-3456-7890" (untuk ditampilkan dgn prefix +62) */
function toNationalDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return digits.replace(/^(0|62)/, "")
}

function formatNational(digits: string): string {
  const d = digits.replace(/\D/g, "")
  if (d.length <= 3) return d
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 13)}`
}

function generateUsername(name: string): string {
  const base = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
  return `ppp-${base || "user"}`
}

/** Username login portal: nama lowercase, spasi -> titik. Contoh: "Budi Santoso" -> "budi.santoso" */
function generateLoginUsername(name: string): string {
  const base = name.toLowerCase().trim().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "")
  return base || "user"
}

function generatePassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

/* ----------------------------------------------------------------
   Schema
   ---------------------------------------------------------------- */

const formSchema = z.object({
  name: z.string().min(3, "Nama lengkap minimal 3 karakter"),
  phoneDigits: z
    .string()
    .refine((v) => /^\d{8,13}$/.test(v.replace(/-/g, "")), "Nomor WhatsApp tidak valid (min. 8 digit)"),
  email: z.union([z.literal(""), z.string().email("Format email tidak valid")]),
  address: z.string().min(5, "Alamat lengkap wajib diisi"),
  packageName: z.string().min(1, "Pilih paket layanan"),
  router: z.string().min(1, "Pilih router/node"),
  ipAddress: z
    .string()
    .regex(
      /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
      "Format IP tidak valid. Contoh: 192.168.200.5",
    )
    .or(z.literal("")),
  pppoeUsername: z.string().min(3, "Username PPPoE minimal 3 karakter"),
  pppoePassword: z.string().min(6, "Password PPPoE minimal 6 karakter"),
  loginUsername: z.string().min(3, "Username login minimal 3 karakter"),
  loginPassword: z.string().min(6, "Password login minimal 6 karakter"),
  odpId: z.string(),
  gps: z.string(),
})

type FormValues = z.infer<typeof formSchema>

/* ----------------------------------------------------------------
   Component
   ---------------------------------------------------------------- */

type CustomerFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Jika diberikan -> mode edit, jika tidak -> tambah baru */
  customer?: Customer
}

export function CustomerFormDialog({ open, onOpenChange, customer }: CustomerFormDialogProps) {
  const { add, update } = useCustomerActions()
  const isEdit = !!customer
  const [submitting, setSubmitting] = useState(false)
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [pkgOptions, setPkgOptions] = useState<PkgOption[]>([])
  const [routerOptions, setRouterOptions] = useState<RouterOption[]>([])

  // Muat daftar paket & router REAL dari backend setiap dialog dibuka
  useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.all([api.get("/packages"), api.get("/routers")])
      .then(([pkgs, routers]) => {
        if (cancelled) return
        setPkgOptions((pkgs.data?.data ?? []).filter((p: PkgOption) => p.status === "Aktif"))
        setRouterOptions(routers.data?.data ?? [])
      })
      .catch((err) => console.warn("Gagal memuat daftar paket/router:", err?.message))
    return () => {
      cancelled = true
    }
  }, [open])

  const initialValues = useMemo<FormValues>(() => {
    if (customer) {
      return {
        name: customer.name,
        phoneDigits: formatNational(toNationalDigits(customer.phone)),
        email: customer.email,
        address: customer.address,
        packageName: customer.packageName,
        router: customer.router,
        ipAddress: customer.ipAddress,
        pppoeUsername: customer.pppoeUsername,
        pppoePassword: customer.pppoePassword,
        loginUsername: customer.loginUsername,
        loginPassword: customer.loginPassword,
        odpId: customer.odpId,
        gps: customer.gps,
      }
    }
    return {
      name: "",
      phoneDigits: "",
      email: "",
      address: "",
      packageName: "",
      router: "",
      ipAddress: "",
      pppoeUsername: "",
      pppoePassword: "",
      loginUsername: "",
      loginPassword: "",
      odpId: "",
      gps: "",
    }
  }, [customer])

  // Nilai final saat reset: mode edit pakai data customer apa adanya
  // (kalau belum punya paket/router, tampil placeholder — validasi memaksa pilih);
  // mode tambah default ke opsi pertama dari backend.
  const buildDefaults = useCallback<() => FormValues>(() => {
    if (customer) {
      return {
        name: customer.name,
        phoneDigits: formatNational(toNationalDigits(customer.phone)),
        email: customer.email,
        address: customer.address,
        packageName: customer.packageName || "",
        router: customer.router || "",
        ipAddress: customer.ipAddress || "",
        pppoeUsername: customer.pppoeUsername,
        pppoePassword: customer.pppoePassword,
        loginUsername: customer.loginUsername,
        loginPassword: customer.loginPassword,
        odpId: customer.odpId,
        gps: customer.gps,
      }
    }
    return {
      name: "",
      phoneDigits: "",
      email: "",
      address: "",
      packageName: pkgOptions[0]?.name ?? "",
      router: routerOptions[0]?.name ?? "",
      ipAddress: "",
      pppoeUsername: "",
      pppoePassword: "",
      loginUsername: "",
      loginPassword: "",
      odpId: "",
      gps: "",
    }
  }, [customer, pkgOptions, routerOptions])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
  })

  const nameValue = watch("name")

  // Reset form saat dialog dibuka: mode edit langsung (nilai customer valid),
  // mode tambah menunggu daftar paket/router dari backend termuat.
  const optionsReady = pkgOptions.length > 0 && routerOptions.length > 0
  const shouldReset = open && (isEdit || optionsReady)
  useEffect(() => {
    if (!shouldReset) return
    reset(buildDefaults())
    setUsernameTouched(false)
    setSubmitting(false)
  }, [shouldReset, reset, buildDefaults])

  // Auto-generate username berdasarkan nama (hanya mode tambah / belum diedit)
  useEffect(() => {
    if (open && !isEdit && !usernameTouched && nameValue.trim()) {
      setValue("pppoeUsername", generateUsername(nameValue))
      setValue("loginUsername", generateLoginUsername(nameValue))
    }
  }, [open, isEdit, nameValue, usernameTouched, setValue])

  // Auto-generate password sekali saat mode tambah
  useEffect(() => {
    if (open && !isEdit) {
      setValue("pppoePassword", generatePassword())
      setValue("loginPassword", generatePassword())
    }
  }, [open, isEdit, setValue])

  function onSubmit(values: FormValues) {
    setSubmitting(true)
    const phoneDigits = values.phoneDigits.replace(/\D/g, "")
    const phone = `0${formatNational(phoneDigits)}`
    const payload: CustomerInput = {
      name: values.name,
      phone,
      email: values.email,
      address: values.address,
      packageName: values.packageName,
      router: values.router,
      ipAddress: values.ipAddress || "",
      pppoeUsername: values.pppoeUsername,
      pppoePassword: values.pppoePassword,
      loginUsername: values.loginUsername,
      loginPassword: values.loginPassword,
      odpId: values.odpId,
      gps: values.gps,
    }

    // Simulasi panggilan API
    setTimeout(() => {
      if (isEdit && customer) {
        update({ ...customer, ...payload })
        toast.success("Perubahan berhasil disimpan", { description: `Data ${values.name} telah diperbarui.` })
      } else {
        add(payload)
        toast.success("Pelanggan berhasil ditambahkan", {
          description: `Akun portal aktif (login: ${values.loginUsername}). Layanan aktif setelah pembayaran pertama.`,
        })
      }
      setSubmitting(false)
      onOpenChange(false)
    }, 800)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-lg font-semibold">
            {isEdit ? "Edit Pelanggan" : "Tambah Pelanggan Baru"}
          </DialogTitle>
          <DialogDescription>
            Masukkan detail identitas dan konfigurasi jaringan pelanggan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
            {/* --- Informasi Pribadi --- */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Informasi Pribadi</h4>
              <div className="space-y-2">
                <Label htmlFor="f-name">Nama Lengkap <span className="text-rose-500">*</span></Label>
                <Input
                  id="f-name"
                  placeholder="Nama lengkap pelanggan"
                  {...register("name")}
                  aria-invalid={!!errors.name}
                />
                {errors.name && <p className="text-xs text-rose-500">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="f-phone">No. WhatsApp <span className="text-rose-500">*</span></Label>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                    +62
                  </span>
                  <Input
                    id="f-phone"
                    className="rounded-l-none"
                    placeholder="812-3456-7890"
                    inputMode="numeric"
                    {...register("phoneDigits", {
                      onChange: (e) => {
                        const formatted = formatNational(e.target.value)
                        e.target.value = formatted
                        setValue("phoneDigits", formatted, { shouldValidate: true })
                      },
                    })}
                    aria-invalid={!!errors.phoneDigits}
                  />
                </div>
                {errors.phoneDigits && <p className="text-xs text-rose-500">{errors.phoneDigits.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="f-email">Email <span className="text-muted-foreground">(opsional)</span></Label>
                <Input
                  id="f-email"
                  type="email"
                  placeholder="email@contoh.com"
                  {...register("email")}
                  aria-invalid={!!errors.email}
                />
                {errors.email && <p className="text-xs text-rose-500">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="f-login-user">
                    Username Login (Portal) <span className="text-rose-500">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      const n = watch("name")
                      if (n.trim()) setValue("loginUsername", generateLoginUsername(n))
                    }}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <RefreshCw className="size-3" /> Buat dari nama
                  </button>
                </div>
                <Input
                  id="f-login-user"
                  className="font-mono"
                  placeholder="budi.santoso"
                  {...register("loginUsername")}
                  aria-invalid={!!errors.loginUsername}
                />
                {errors.loginUsername && <p className="text-xs text-rose-500">{errors.loginUsername.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="f-login-pass">
                    Password Login (Portal) <span className="text-rose-500">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={() => setValue("loginPassword", generatePassword())}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <RefreshCw className="size-3" /> Acak ulang
                  </button>
                </div>
                <Input
                  id="f-login-pass"
                  className="font-mono"
                  {...register("loginPassword")}
                  aria-invalid={!!errors.loginPassword}
                />
                {errors.loginPassword && <p className="text-xs text-rose-500">{errors.loginPassword.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="f-address">Alamat Lengkap <span className="text-rose-500">*</span></Label>
                <Textarea
                  id="f-address"
                  placeholder="RT / RW, nama jalan, kelurahan"
                  rows={3}
                  {...register("address")}
                  aria-invalid={!!errors.address}
                />
                {errors.address && <p className="text-xs text-rose-500">{errors.address.message}</p>}
              </div>
            </section>

            <Separator />

            {/* --- Konfigurasi Jaringan & Paket --- */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Konfigurasi Jaringan &amp; Paket</h4>

              <div className="space-y-2">
                <Label>Paket Layanan <span className="text-rose-500">*</span></Label>
                <Select
                  value={watch("packageName")}
                  onValueChange={(val) => val && setValue("packageName", val)}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Pilih paket" />
                  </SelectTrigger>
                  <SelectContent>
                    {pkgOptions.length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">Memuat daftar paket…</p>
                    ) : (
                      pkgOptions.map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.name} className="text-sm">
                          {pkg.name} — Rp {pkg.price.toLocaleString("id-ID")}/bln
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Router / Node <span className="text-rose-500">*</span></Label>
                <Select
                  value={watch("router")}
                  onValueChange={(val) => val && setValue("router", val)}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Pilih router" />
                  </SelectTrigger>
                  <SelectContent>
                    {routerOptions.length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">Memuat daftar router…</p>
                    ) : (
                      routerOptions.map((r) => (
                        <SelectItem key={r.id} value={r.name} className="text-sm">
                          {r.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="f-ip">
                  IP Address (Local Address PPP) <span className="text-muted-foreground">(opsional)</span>
                </Label>
                <Input
                  id="f-ip"
                  className="font-mono"
                  placeholder="Kosongkan → otomatis dari pool router (mis. 192.168.200.x)"
                  {...register("ipAddress")}
                  aria-invalid={!!errors.ipAddress}
                />
                {errors.ipAddress && <p className="text-xs text-rose-500">{errors.ipAddress.message}</p>}
                <p className="text-xs text-muted-foreground">
                  IP ini menjadi <span className="font-mono">local-address</span> pada secret PPP di Mikrotik.
                  Bila dikosongkan, sistem mengambil IP berikutnya dari pool router yang dipilih.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="f-pppoe-user">Username PPPoE <span className="text-rose-500">*</span></Label>
                  <button
                    type="button"
                    onClick={() => setValue("pppoeUsername", generateUsername(nameValue))}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <RefreshCw className="size-3" /> Auto-generate
                  </button>
                </div>
                <Input
                  id="f-pppoe-user"
                  className="font-mono"
                  {...register("pppoeUsername", {
                    onChange: () => setUsernameTouched(true),
                  })}
                  aria-invalid={!!errors.pppoeUsername}
                />
                {errors.pppoeUsername && <p className="text-xs text-rose-500">{errors.pppoeUsername.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="f-pppoe-pass">Password PPPoE <span className="text-rose-500">*</span></Label>
                  <button
                    type="button"
                    onClick={() => setValue("pppoePassword", generatePassword())}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <RefreshCw className="size-3" /> Acak ulang
                  </button>
                </div>
                <Input
                  id="f-pppoe-pass"
                  className="font-mono"
                  {...register("pppoePassword")}
                  aria-invalid={!!errors.pppoePassword}
                />
                {errors.pppoePassword && <p className="text-xs text-rose-500">{errors.pppoePassword.message}</p>}
              </div>
            </section>

            <Separator />

            {/* --- Data Khusus --- */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Data Khusus / Custom Fields</h4>
              <div className="space-y-2">
                <Label htmlFor="f-odp">ID ODP / Port</Label>
                <Input id="f-odp" placeholder="Contoh: ODP-01 / Port 4" {...register("odpId")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-gps">Titik Koordinat GPS</Label>
                <Input
                  id="f-gps"
                  placeholder="Contoh: -6.9175, 107.6191"
                  className="font-mono"
                  {...register("gps")}
                />
              </div>
            </section>
          </div>

          {/* --- Footer --- */}
          <DialogFooter className="border-t border-border px-5 py-4">
            <div className="flex w-full gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Batal
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="size-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    Menyimpan…
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    {isEdit ? "Simpan Perubahan" : "Simpan & Aktivasi"}
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
