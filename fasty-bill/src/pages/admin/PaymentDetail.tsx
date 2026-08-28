import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  QrCode,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  formatPrice,
  paymentStatusBadge,
  paymentSource,
  sourceBadgeClass,
  methodHint,
  type Payment,
  type PaymentMethod,
} from "@/lib/paymentData"
import { usePaymentStore } from "@/store/paymentStore"
import { useInvoiceStore } from "@/store/invoiceStore"
import { useCustomers } from "@/lib/customerStore"

const methodIcon: Record<PaymentMethod, typeof QrCode> = {
  QRIS: QrCode,
  Tunai: Banknote,
}

/* ----------------------------------------------------------------
   Detail pembayaran (dinamis sesuai :id)
   ---------------------------------------------------------------- */

export function PaymentDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const payments = usePaymentStore((s) => s.payments)
  const payment = payments.find((p) => p.id === id)
  const setStatus = usePaymentStore((s) => s.setStatus)
  const invoices = useInvoiceStore((s) => s.invoices)
  const markPaid = useInvoiceStore((s) => s.markPaid)
  const customers = useCustomers()

  if (!payment) {
    return (
      <div className="space-y-5">
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", to: "/admin" },
            { label: "Pembayaran", to: "/admin/payments" },
            { label: id ?? "" },
          ]}
          title="Pembayaran tidak ditemukan"
          description="Transaksi yang Anda cari tidak ada atau sudah dihapus."
          actions={
            <Button variant="outline" onClick={() => navigate("/admin/payments")}>
              <ArrowLeft className="mr-1.5 size-4" />
              Kembali ke daftar
            </Button>
          }
        />
      </div>
    )
  }

  const MethodIcon = methodIcon[payment.method]
  const source = paymentSource(payment.method)
  const isGateway = payment.method === "QRIS"

  const handleConfirm = async () => {
    setStatus(payment.id, "Sukses")
    // Note: backend completePaymentFlow sudah update expiry_at customer + status Active
    // Tidak perlu extendExpiry lagi di frontend (akan double extend)
    const invoice = invoices.find((inv) => inv.code === payment.invoice)
    if (invoice && invoice.status !== "Paid") {
      await markPaid(invoice.id, payment.method)
    }
    toast.success("Pembayaran berhasil", {
      description: `${payment.code} — masa aktif diperpanjang 1 bulan.`,
    })
  }

  const timeline = [
    { label: "Pembayaran dibuat", time: payment.date, done: true },
    ...(payment.status === "Sukses"
      ? [
          {
            label: isGateway
              ? "Callback gateway diterima — masa aktif diperpanjang"
              : "Pembayaran tunai dicatat admin dari menu Invoice",
            time: payment.date,
            done: true,
          },
        ]
      : payment.status === "Pending"
        ? [{ label: "Menunggu konfirmasi payment gateway", time: "Saat ini", done: false }]
        : [{ label: "Pembayaran gagal / callback ditolak", time: payment.date, done: false }]),
  ]

  const statusNote =
    payment.status === "Sukses"
      ? `Masa aktif layanan ${payment.customer} telah diperpanjang otomatis 1 bulan.`
      : payment.status === "Pending"
        ? "Pembayaran menunggu konfirmasi dari payment gateway. Biasanya selesai dalam beberapa menit."
        : "Pembayaran gagal. Pelanggan dapat mencoba lagi atau memilih pembayaran tunai ke admin."

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", to: "/admin" },
          { label: "Pembayaran", to: "/admin/payments" },
          { label: payment.code },
        ]}
        title={payment.code}
        description={`Detail transaksi pembayaran ${payment.customer}.`}
        actions={
          <>
            {payment.status === "Pending" && (
              <Button size="lg" onClick={handleConfirm}>
                <CheckCircle2 className="mr-1.5 size-4" />
                Tandai Sukses
              </Button>
            )}
            <Button variant="outline" size="lg" onClick={() => navigate("/admin/payments")}>
              <ArrowLeft className="mr-1.5 size-4" />
              Kembali
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Status</p>
          <Badge className={`mt-2 text-sm font-medium ${paymentStatusBadge[payment.status]}`}>
            {payment.status}
          </Badge>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Jumlah</p>
          <p className="mt-2 text-lg font-semibold tabular-nums">{formatPrice(payment.amount)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-muted-foreground">Metode</p>
          <Badge variant="outline" className="mt-2 gap-1 text-sm">
            <MethodIcon className="size-3.5" />
            {payment.method}
          </Badge>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {isGateway ? "via Payment Gateway" : "Tunai di loket"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-lg font-semibold">Informasi transaksi</h3>
        <div className="mt-4 divide-y divide-border">
          {[
            { label: "Kode Pembayaran", value: payment.code },
            { label: "Pelanggan", value: payment.customer },
            { label: "Invoice", value: payment.invoice },
            { label: "Tanggal", value: payment.date },
            { label: "Metode", value: payment.method },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 py-3">
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <span className="text-right text-sm font-medium">{row.value}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 py-3">
            <span className="text-sm text-muted-foreground">Sumber</span>
            <Badge className={`text-xs font-medium ${sourceBadgeClass[source]}`}>{source}</Badge>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-lg font-semibold">Status pembayaran</h3>
        <p className="mt-2 text-sm text-muted-foreground">{statusNote}</p>
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
          <MethodIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>{methodHint[payment.method]}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-lg font-semibold">Riwayat status</h3>
        <ol className="mt-4">
          {timeline.map((entry, i) => (
            <li key={entry.label} className="relative pb-6 pl-6 last:pb-0">
              {i < timeline.length - 1 && (
                <span className="absolute top-3 left-[4.5px] h-full w-px bg-border" />
              )}
              <span
                className={`absolute top-1.5 left-0 size-2.5 rounded-full ring-4 ring-background ${
                  entry.done ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              <p className="text-sm font-medium">{entry.label}</p>
              <p className="text-[11px] text-muted-foreground/70">{entry.time}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------
   Konfirmasi Pembayaran (QRIS menunggu callback gateway)
   ---------------------------------------------------------------- */

export function PaymentApprovalPage() {
  const navigate = useNavigate()
  const payments = usePaymentStore((s) => s.payments)
  const queue = payments.filter((p) => p.status === "Pending")
  const setStatus = usePaymentStore((s) => s.setStatus)
  const invoices = useInvoiceStore((s) => s.invoices)
  const markPaid = useInvoiceStore((s) => s.markPaid)
  const customers = useCustomers()

  const handleApprove = async (payment: Payment) => {
    setStatus(payment.id, "Sukses")
    // Note: backend completePaymentFlow sudah update expiry_at customer + status Active
    // Tidak perlu extendExpiry lagi di frontend (akan double extend)
    const invoice = invoices.find((inv) => inv.code === payment.invoice)
    if (invoice && invoice.status !== "Paid") {
      await markPaid(invoice.id, payment.method)
    }
    toast.success("Pembayaran disetujui", {
      description: `${payment.code} — masa aktif ${payment.customer} diperpanjang 1 bulan.`,
    })
  }

  const handleReject = (payment: Payment) => {
    setStatus(payment.id, "Ditolak")
    toast.error("Pembayaran ditolak", {
      description: `${payment.code} telah ditandai Ditolak.`,
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", to: "/admin" },
          { label: "Pembayaran", to: "/admin/payments" },
          { label: "Konfirmasi Pembayaran" },
        ]}
        title="Konfirmasi Pembayaran"
        description={`Pembayaran QRIS yang menunggu konfirmasi dari payment gateway (${queue.length} menunggu).`}
        actions={
          <Button variant="outline" onClick={() => navigate("/admin/payments")}>
            <ArrowLeft className="mr-1.5 size-4" />
            Kembali
          </Button>
        }
      />

      {queue.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
          <p className="mt-3 font-medium">Tidak ada pembayaran menunggu konfirmasi</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Semua pembayaran QRIS sudah dikonfirmasi oleh gateway.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {queue.map((item) => {
            const Icon = methodIcon[item.method]
            return (
              <div key={item.code} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{item.code}</p>
                      <Badge className={`text-[0.625rem] font-medium ${paymentStatusBadge[item.status]}`}>
                        {item.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {item.customer} · {item.invoice} · {item.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                      <Icon className="size-3.5" />
                      {item.method}
                    </span>
                    <p className="font-semibold tabular-nums">{formatPrice(item.amount)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleApprove(item)}>
                    <CheckCircle2 className="mr-1.5 size-4" />
                    Tandai Sukses
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-600"
                    onClick={() => handleReject(item)}
                  >
                    <XCircle className="mr-1.5 size-4" />
                    Tolak
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info(`Menampilkan bukti pembayaran ${item.code}...`)}
                  >
                    <Icon className="mr-1.5 size-4" />
                    Lihat bukti
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
