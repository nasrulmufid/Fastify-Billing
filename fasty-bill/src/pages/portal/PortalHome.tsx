import { useEffect } from "react"
import { Link } from "react-router-dom"
import { useCustomerStore } from "@/store/customerStore"
import { usePortalStore } from "@/store/portalStore"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

function formatPrice(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`
}

export function PortalHome() {
  const customer = useCustomerStore((s) => s.customer)
  const invoices = usePortalStore((s) => s.invoices)
  const loading = usePortalStore((s) => s.loading)
  const load = usePortalStore((s) => s.load)

  useEffect(() => {
    if (invoices.length === 0) load()
  }, [invoices.length, load])

  const unpaid = invoices.filter((i) => i.status !== "Paid")
  const latest = [...invoices].slice(0, 3)
  const isIsolated = customer?.status === "Isolated"

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/20 to-background p-5 shadow-sm">
        <p className="text-sm font-medium text-primary">Halo, {customer?.name ?? "Pelanggan"}</p>
        <h2 className="mt-1 text-2xl font-semibold">
          {customer?.status === "Active"
            ? "Layanan Anda aktif dan siap digunakan"
            : isIsolated
              ? "Layanan Anda sedang diisolir"
              : "Periksa status layanan Anda"}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {isIsolated
            ? "Selesaikan pembayaran tagihan untuk mengaktifkan kembali layanan internet Anda."
            : "Cek tagihan, bayar dengan QRIS, dan kirim tiket gangguan dari satu tempat."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/portal/payments">
            <Button>Bayar tagihan</Button>
          </Link>
          <Link to="/portal/tickets">
            <Button variant="outline">Buat tiket</Button>
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Tagihan terbaru</h3>
          <Link className="text-sm font-medium text-primary" to="/portal/invoices">
            Lihat semua
          </Link>
        </div>
        <div className="mt-3 space-y-3">
          {loading && latest.length === 0 ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
          ) : latest.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Belum ada tagihan.
            </p>
          ) : (
            latest.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/80 p-3">
                <div>
                  <p className="font-medium">{invoice.code}</p>
                  <p className="text-sm text-muted-foreground">
                    {invoice.period}
                    {invoice.status !== "Paid" ? " · Belum dibayar" : " · Lunas"}
                  </p>
                </div>
                <p className="font-semibold">{formatPrice(invoice.amount)}</p>
              </div>
            ))
          )}
        </div>
        {unpaid.length > 0 && (
          <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
            Anda memiliki {unpaid.length} tagihan belum dibayar.
          </p>
        )}
      </div>
    </div>
  )
}
