import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Save } from "lucide-react"
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
import {
  usePackageActions,
  type PackageType,
  type ServicePackage,
} from "@/lib/packageStore"

/* ----------------------------------------------------------------
   Options
   ---------------------------------------------------------------- */

export const PACKAGE_TYPE_OPTIONS = ["PPPoE"] as const satisfies readonly PackageType[]

/* ----------------------------------------------------------------
   Schema
   ---------------------------------------------------------------- */

const formSchema = z.object({
  name: z.string().min(3, "Nama paket minimal 3 karakter"),
  downloadSpeed: z.coerce.number().min(1, "Kecepatan download minimal 1 Mbps"),
  uploadSpeed: z.coerce.number().min(1, "Kecepatan upload minimal 1 Mbps"),
  price: z.coerce.number().min(1000, "Harga minimal Rp 1.000"),
  type: z.enum(PACKAGE_TYPE_OPTIONS),
  description: z.string(),
})

type FormValues = z.infer<typeof formSchema>

/* ----------------------------------------------------------------
   Component
   ---------------------------------------------------------------- */

type PackageFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Jika diberikan -> mode edit, jika tidak -> tambah baru */
  pkg?: ServicePackage
}

export function PackageFormDialog({ open, onOpenChange, pkg }: PackageFormDialogProps) {
  const { add, update } = usePackageActions()
  const isEdit = !!pkg
  const [submitting, setSubmitting] = useState(false)

  const defaultValues = useMemo<FormValues>(() => {
    if (pkg) {
      return {
        name: pkg.name,
        downloadSpeed: pkg.downloadSpeed,
        uploadSpeed: pkg.uploadSpeed,
        price: pkg.price,
        type: pkg.type,
        description: pkg.description,
      }
    }
    return {
      name: "",
      downloadSpeed: 10,
      uploadSpeed: 10,
      price: 150000,
      type: "PPPoE",
      description: "",
    }
  }, [pkg])

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

  // Reset form setiap dialog dibuka
  useEffect(() => {
    if (open) {
      reset(defaultValues)
      setSubmitting(false)
    }
  }, [open, reset, defaultValues])

  function onSubmit(values: FormValues) {
    setSubmitting(true)
    const payload = {
      name: values.name,
      downloadSpeed: values.downloadSpeed,
      uploadSpeed: values.uploadSpeed,
      price: values.price,
      type: values.type,
      description: values.description,
    }

    // Simulasi panggilan API
    setTimeout(() => {
      if (isEdit && pkg) {
        update({ ...pkg, ...payload })
        toast.success("Perubahan berhasil disimpan", { description: `Paket ${values.name} telah diperbarui.` })
      } else {
        add(payload)
        toast.success("Paket berhasil ditambahkan", { description: `${values.name} kini tersedia untuk pelanggan.` })
      }
      setSubmitting(false)
      onOpenChange(false)
    }, 800)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-lg font-semibold">
            {isEdit ? "Edit Paket" : "Tambah Paket Baru"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui detail layanan yang ditawarkan ke pelanggan."
              : "Buat opsi layanan baru yang dapat dipilih pelanggan."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
            {/* --- Informasi Dasar --- */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Informasi Dasar</h4>

              <div className="space-y-2">
                <Label htmlFor="p-name">Nama Paket <span className="text-rose-500">*</span></Label>
                <Input
                  id="p-name"
                  placeholder="Contoh: Paket 50 Mbps"
                  {...register("name")}
                  aria-invalid={!!errors.name}
                />
                {errors.name && <p className="text-xs text-rose-500">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Kecepatan (Download / Upload) <span className="text-rose-500">*</span></Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        type="number"
                        min={1}
                        placeholder="10"
                        className="pr-14"
                        {...register("downloadSpeed")}
                        aria-invalid={!!errors.downloadSpeed}
                      />
                      <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                        Mbps ↓
                      </span>
                    </div>
                    {errors.downloadSpeed && (
                      <p className="text-xs text-rose-500">{errors.downloadSpeed.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        type="number"
                        min={1}
                        placeholder="10"
                        className="pr-14"
                        {...register("uploadSpeed")}
                        aria-invalid={!!errors.uploadSpeed}
                      />
                      <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">
                        Mbps ↑
                      </span>
                    </div>
                    {errors.uploadSpeed && (
                      <p className="text-xs text-rose-500">{errors.uploadSpeed.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="p-price">Harga per Bulan (Rp) <span className="text-rose-500">*</span></Label>
                <div className="relative">
                  <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    id="p-price"
                    type="number"
                    min={1000}
                    step={1000}
                    placeholder="250000"
                    className="pl-9"
                    {...register("price")}
                    aria-invalid={!!errors.price}
                  />
                </div>
                {errors.price && <p className="text-xs text-rose-500">{errors.price.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Tipe Layanan <span className="text-rose-500">*</span></Label>
                <Select
                  value={watch("type")}
                  onValueChange={(val) => val && setValue("type", val as PackageType)}
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue placeholder="Pilih tipe layanan" />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKAGE_TYPE_OPTIONS.map((type) => (
                      <SelectItem key={type} value={type} className="text-sm">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <Separator />

            {/* --- Deskripsi --- */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Deskripsi</h4>
              <div className="space-y-2">
                <Label htmlFor="p-desc">
                  Deskripsi Paket <span className="text-muted-foreground">(opsional)</span>
                </Label>
                <Textarea
                  id="p-desc"
                  placeholder="Keterangan singkat yang ditampilkan ke pelanggan..."
                  rows={3}
                  {...register("description")}
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
                    {isEdit ? "Simpan Perubahan" : "Simpan Paket"}
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
