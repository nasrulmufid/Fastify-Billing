import { useEffect, useState } from "react"
import { CheckCircle2, Clock3, ExternalLink, Loader2, QrCode, XCircle } from "lucide-react"
import { toast } from "sonner"

import { PortalPageHeader } from "@/components/portal/PortalPageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { usePortalStore, type PortalInvoice, type PortalPayment } from "@/store/portalStore"

function formatPrice(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`
}

const paymentBadge: Record<PortalPayment["status"], string> = {
  Sukses: "bg-emerald-500/10 text-emerald-600",
  Pending: "bg-amber-500/10 text-amber-600",
  Ditolak: "bg-rose-500/10 text-rose-600",
}

const paymentIcon: Record<PortalPayment["status"], typeof CheckCircle2> = {
  Sukses: CheckCircle2,
  Pending: Clock3,
  Ditolak: XCircle,
}

export function PortalPaymentsPage() {
  const invoices = usePortalStore((s) => s.invoices)
  const payments = usePortalStore((s) => s.payments)
  const loading = usePortalStore((s) => s.loading)
  const load = usePortalStore((s) => s.load)
  const createQrisPayment = usePortalStore((s) => s.createQrisPayment)

  const [selectedInvoice, setSelectedInvoice] = useState<PortalInvoice | null>(null)
  const [paying, setPaying] = useState(false)
  const [manualLink, setManualLink] = useState("")
  const [payError, setPayError] = useState("")

  useEffect(() => {
    if (invoices.length === 0 && payments.length === 0) load()
  }, [invoices.length, payments.length, load])

  const unpaid = invoices.filter((i) => i.status !== "Paid")
  const active = selectedInvoice ?? unpaid[0] ?? null

  const handlePayQris = async () => {
    if (!active) return
    setPaying(true)
    setPayError("")
    const result = await createQrisPayment(active.id)
    setPaying(false)
    if (result?.paymentLinkUrl) {
      // Redirect langsung ke halaman pembayaran QRIS SumoPod
      window.location.href = result.paymentLinkUrl
    } else {
      setPayError(
        "Payment gateway QRIS belum terhubung. Tempel link pembayaran SumoPod di bawah, atau hubungi admin.",
      )
    }
  }

  const handleUseManualLink = () => {
    const url = manualLink.trim()
    if (!url) {
      toast.error("Masukkan link pembayaran terlebih dahulu")
      return
    }
    // Redirect langsung ke link pembayaran yang ditempel
    window.location.href = url
  }

  return (
    <div className="space-y-5">
      <PortalPageHeader title="Pembayaran" subtitle="Bayar tagihan via QRIS atau tunai" />

      {/* ===== Bayar tagihan belum lunas ===== */}
      {unpaid.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <QrCode className="size-4 text-primary" />
            <h3 className="font-semibold">Bayar tagihan</h3>
          </div>

          <div className="mt-3 space-y-2">
            {unpaid.map((inv) => (
              <label
                key={inv.id}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-colors",
                  active?.id === inv.id
                    ? "border-primary/60 bg-primary/5"
                    : "border-border/70 bg-background/80 hover:bg-muted/40",
                )}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="pay-invoice"
                    className="size-4 accent-[var(--primary)]"
                    checked={active?.id === inv.id}
                    onChange={() => {
                      setSelectedInvoice(inv)
                      setPayError("")
                    }}
                  />
                  <div>
                    <p className="text-sm font-medium">{inv.code}</p>
                    <p className="text-xs text-muted-foreground">{inv.period}</p>
                  </div>
                </div>
                <p className="font-semibold">{formatPrice(inv.amount)}</p>
              </label>
            ))}
          </div>

          <Button className="mt-4 w-full" onClick={handlePayQris} disabled={paying || !active}>
            {paying ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Membuat pembayaran…
              </>
            ) : (
              <>
                <QrCode className="size-4" />
                Bayar dengan QRIS
              </>
            )}
          </Button>

          {payError && (
            <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
              <p className="text-xs text-rose-600">{payError}</p>
              <div className="mt-2 space-y-1.5">
                <Label htmlFor="manual-pay-link" className="text-xs">
                  Link pembayaran QRIS (SumoPod)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="manual-pay-link"
                    value={manualLink}
                    onChange={(e) => setManualLink(e.target.value)}
                    placeholder="https://checkout.pymnt.app/payment-links/..."
                    className="h-9 flex-1 font-mono text-xs"
                  />
                  <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={handleUseManualLink}>
                    <ExternalLink className="size-3.5" />
                    Bayar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Riwayat pembayaran ===== */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <h3 className="font-semibold">Riwayat pembayaran</h3>
        <div className="mt-3 grid gap-3">
          {loading && payments.length === 0 ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
          ) : payments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">Belum ada pembayaran.</p>
            </div>
          ) : (
            payments.map((p) => {
              const Icon = paymentIcon[p.status]
              return (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/80 p-3">
                  <div>
                    <p className="text-sm font-medium">{p.code}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.method} · {p.date}
                      {p.invoice ? ` · ${p.invoice}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatPrice(p.amount)}</p>
                    <Badge className={cn("mt-1 font-normal", paymentBadge[p.status])}>
                      <Icon className="mr-1 size-3" />
                      {p.status}
                    </Badge>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
