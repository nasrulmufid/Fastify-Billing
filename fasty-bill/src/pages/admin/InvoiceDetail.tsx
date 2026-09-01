import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Banknote, ExternalLink, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatPrice, paymentMethodBadge } from "@/lib/paymentData"
import { MONTHS_ID } from "@/lib/dateUtils"
import api from "@/lib/axios"
import { usePackages } from "@/lib/packageStore"
import { statusLabel, statusBadgeClass, useInvoiceStore } from "@/store/invoiceStore"
import { usePaymentStore } from "@/store/paymentStore"
import { useCustomers } from "@/lib/customerStore"

export function InvoiceDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const invoices = useInvoiceStore((s) => s.invoices)
  const invoice = invoices.find((inv) => inv.id === id)
  const markPaid = useInvoiceStore((s) => s.markPaid)
  const payments = usePaymentStore((s) => s.payments)
  const customers = useCustomers()

  const [payOpen, setPayOpen] = useState(false)

  if (!invoice) {
    return (
      <div className="space-y-5">
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", to: "/admin" },
            { label: "Invoice", to: "/admin/invoices" },
            { label: id ?? "" },
          ]}
          title="Invoice tidak ditemukan"
          description="Tagihan yang Anda cari tidak ada atau sudah dihapus."
          actions={
            <Button variant="outline" onClick={() => navigate("/admin/invoices")}>
              <ArrowLeft className="mr-1.5 size-4" />
              Kembali ke daftar
            </Button>
          }
        />
      </div>
    )
  }

  const customer = customers.find((c) => c.name === invoice.customer)
  const payment = payments.find((p) => p.code === invoice.paymentCode)
  const isPaid = invoice.status === "Paid"

  const handleMarkPaid = async () => {
    const success = await markPaid(invoice.id, "Tunai")
    if (!success) {
      toast.error("Gagal memproses pembayaran", {
        description: "Terjadi kesalahan saat menandai invoice lunas.",
      })
      return
    }
    // Note: backend completePaymentFlow sudah update expiry_at customer + status Active
    // Tidak perlu extendExpiry lagi di frontend (akan double extend)
    toast.success("Pembayaran tunai dicatat", {
      description: customer
        ? `${invoice.code} lunas — masa aktif ${customer.name} diperpanjang 1 bulan.`
        : `${invoice.code} telah ditandai lunas (Tunai).`,
    })
    setPayOpen(false)
  }

  const goToPayment = () => {
    if (payment) {
      navigate(`/admin/payments/${payment.id}`)
    } else {
      navigate("/admin/payments")
    }
  }

  const timeline = [
    { event: "Invoice dibuat", time: `01 ${invoice.period}` },
    { event: "Jatuh tempo", time: `10 ${invoice.period}` },
    isPaid
      ? { event: `Pembayaran diterima (${invoice.paymentMethod ?? "Tunai"})`, time: payment?.date ?? "—" }
      : invoice.status === "Overdue"
        ? { event: "Melewati jatuh tempo — menunggu pembayaran", time: "Sekarang" }
        : { event: "Menunggu pembayaran", time: "—" },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", to: "/admin" },
          { label: "Invoice", to: "/admin/invoices" },
          { label: invoice.code },
        ]}
        title={invoice.code}
        description={`Tagihan ${invoice.customer} — ${invoice.period}.`}
        actions={
          <>
            {isPaid ? (
              <Button size="lg" onClick={goToPayment}>
                <ExternalLink className="mr-1.5 size-4" />
                Lihat pembayaran
              </Button>
            ) : (
              <Button size="lg" onClick={() => setPayOpen(true)}>
                <Banknote className="mr-1.5 size-4" />
                Terima Tunai
              </Button>
            )}
            <Button variant="outline" size="lg" onClick={() => navigate("/admin/invoices")}>
              <ArrowLeft className="mr-1.5 size-4" />
              Kembali
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Status</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className={`text-sm font-medium ${statusBadgeClass[invoice.status]}`}>
              {statusLabel[invoice.status]}
            </Badge>
            {isPaid && invoice.paymentMethod && (
              <Badge className={`text-xs font-medium ${paymentMethodBadge[invoice.paymentMethod]}`}>
                {invoice.paymentMethod}
              </Badge>
            )}
          </div>
          {isPaid && invoice.paymentCode && (
            <p className="mt-1.5 text-xs text-muted-foreground">Kode pembayaran: {invoice.paymentCode}</p>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Total</p>
          <p className="mt-2 text-lg font-semibold tabular-nums">{formatPrice(invoice.amount)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Periode</p>
          <p className="mt-2 text-lg font-semibold">{invoice.period}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-lg font-semibold">Item tagihan</h3>
        <div className="mt-4 rounded-xl border border-border/70 bg-background/80 p-4">
          <div className="flex justify-between">
            <div>
              <p className="font-medium">{customer?.packageName ?? "Paket Layanan"}</p>
              <p className="text-sm text-muted-foreground">Bulan {invoice.period}</p>
            </div>
            <p className="font-semibold tabular-nums">{formatPrice(invoice.amount)}</p>
          </div>
        </div>
        <div className="mt-3 flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatPrice(invoice.amount)}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-muted-foreground">PPN 0%</span>
          <span>Rp 0</span>
        </div>
        <hr className="my-3 border-border" />
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatPrice(invoice.amount)}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-lg font-semibold">Pembayaran</h3>
        {isPaid ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-muted-foreground">
              Invoice ini sudah lunas melalui{" "}
              <span className="font-medium text-foreground">{invoice.paymentMethod}</span>
              {invoice.paymentMethod === "QRIS"
                ? " (payment gateway)."
                : " — dibayar tunai langsung ke admin."}
            </p>
            <p className="text-sm text-muted-foreground">
              Masa aktif layanan <span className="font-medium text-foreground">{invoice.customer}</span>{" "}
              telah diperpanjang otomatis 1 bulan.
            </p>
            <Button variant="outline" size="sm" onClick={goToPayment}>
              <ExternalLink className="mr-1.5 size-4" />
              Lihat detail pembayaran
            </Button>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-muted-foreground">
              Pelanggan dapat membayar tagihan ini via <strong>QRIS</strong> (payment gateway) atau{" "}
              <strong>tunai</strong> langsung ke admin. Setelah diterima, masa aktif layanan
              diperpanjang otomatis 1 bulan.
            </p>
            <Button size="sm" onClick={() => setPayOpen(true)}>
              <Banknote className="mr-1.5 size-4" />
              Terima Pembayaran Tunai
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-lg font-semibold">Timeline</h3>
        <div className="mt-4 space-y-3">
          {timeline.map((item, i) => (
            <div key={i} className="flex gap-4">
              <div
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                  isPaid && i === timeline.length - 1 ? "bg-emerald-500" : "bg-primary"
                }`}
              />
              <div>
                <p className="font-medium">{item.event}</p>
                <p className="text-sm text-muted-foreground">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Konfirmasi terima tunai ---------- */}
      <AlertDialog
        open={payOpen}
        onOpenChange={(open) => {
          if (!open) setPayOpen(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terima pembayaran tunai?</AlertDialogTitle>
            <AlertDialogDescription>
              Tandai <strong>{invoice.code}</strong> ({invoice.customer}) sebagai lunas dengan
              metode <strong>Tunai</strong> ({formatPrice(invoice.amount)}).
              <br />
              Masa aktif layanan pelanggan akan diperpanjang otomatis 1 bulan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkPaid}>
              <Banknote className="mr-1.5 size-4" />
              Terima &amp; Perpanjang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ----------------------------------------------------------------
   Invoice create form
   ---------------------------------------------------------------- */

const invoiceFormSchema = z.object({
  customerId: z.string().min(1, "Pelanggan wajib dipilih"),
  packageId: z.string().min(1, "Paket wajib dipilih"),
  period: z.string().min(1, "Periode wajib diisi"),
  amount: z.coerce.number().min(1, "Jumlah harus lebih dari 0"),
})

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>

export function InvoiceCreatePage() {
  const navigate = useNavigate()
  const customers = useCustomers()
  const packages = usePackages()
  const loadInvoices = useInvoiceStore((s) => s.load)

  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      customerId: "",
      packageId: "",
      period: new Date().toLocaleString("id-ID", { month: "long", year: "numeric" }),
      amount: 0,
    },
  })

  const selectedPackageId = watch("packageId")
  const selectedPackage = packages.find((p) => String(p.id) === selectedPackageId)

  // Auto-fill amount when package is selected
  useEffect(() => {
    if (selectedPackage) {
      setValue("amount", selectedPackage.price)
    }
  }, [selectedPackage, setValue])

  // Generate period options (dropdown): 12 bulan ke depan dari bulan ini
  const periodOptions = useMemo(() => {
    const now = new Date()
    const options: { value: string; label: string }[] = []
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const label = `${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`
      options.push({ value: label, label })
    }
    return options
  }, [])

  // Set default period to current month/year
  useEffect(() => {
    const now = new Date()
    const period = `${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`
    setValue("period", period)
  }, [setValue])

  async function onSubmit(values: InvoiceFormValues) {
    setSubmitting(true)
    try {
      await api.post("/invoices", {
        customerId: Number(values.customerId),
        amount: values.amount,
        period: values.period,
      })
      await loadInvoices()
      toast.success("Invoice dibuat", {
        description: `Invoice untuk pelanggan berhasil dibuat.`,
      })
      navigate("/admin/invoices")
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || "Gagal membuat invoice")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", to: "/admin" },
          { label: "Invoice", to: "/admin/invoices" },
          { label: "Buat Invoice" },
        ]}
        title="Buat Invoice"
        description="Invoice baru untuk pelanggan."
        actions={
          <Button variant="outline" onClick={() => navigate("/admin/invoices")}>
            <ArrowLeft className="mr-1.5 size-4" />
            Kembali
          </Button>
        }
      />

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            Form Invoice
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Pelanggan */}
              <div className="space-y-1.5">
                <Label htmlFor="customer">Pelanggan</Label>
                <Select
                  onValueChange={(v) => setValue("customerId", v as string)}
                >
                  <SelectTrigger id="customer" className="h-9">
                    <SelectValue placeholder="Pilih pelanggan…" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.customerId && (
                  <p className="text-xs text-destructive">{errors.customerId.message}</p>
                )}
              </div>

              {/* Paket */}
              <div className="space-y-1.5">
                <Label htmlFor="package">Paket Layanan</Label>
                <Select
                  onValueChange={(v) => setValue("packageId", v as string)}
                >
                  <SelectTrigger id="package" className="h-9">
                    <SelectValue placeholder="Pilih paket…" />
                  </SelectTrigger>
                  <SelectContent>
                    {packages.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} — {formatPrice(p.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.packageId && (
                  <p className="text-xs text-destructive">{errors.packageId.message}</p>
                )}
              </div>

              {/* Periode */}
              <div className="space-y-1.5">
                <Label htmlFor="period">Periode</Label>
                <Select
                  onValueChange={(v) => setValue("period", v)}
                  value={watch("period")}
                >
                  <SelectTrigger id="period" className="h-9">
                    <SelectValue placeholder="Pilih periode…" />
                  </SelectTrigger>
                  <SelectContent>
                    {periodOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value ?? ""}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.period && (
                  <p className="text-xs text-destructive">{errors.period.message}</p>
                )}
              </div>

              {/* Jumlah */}
              <div className="space-y-1.5">
                <Label htmlFor="amount">Jumlah (Rp)</Label>
                <Input
                  id="amount"
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="0"
                  className="h-9 font-mono tabular-nums"
                  {...register("amount")}
                />
                {errors.amount && (
                  <p className="text-xs text-destructive">{errors.amount.message}</p>
                )}
                {selectedPackage && (
                  <p className="text-xs text-muted-foreground">
                    Harga paket: <span className="font-semibold text-foreground">{formatPrice(selectedPackage.price)}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Banknote className="mr-1.5 size-4" />
                )}
                {submitting ? "Membuat…" : "Buat Invoice"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/admin/invoices")}
              >
                Batal
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
