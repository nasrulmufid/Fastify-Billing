import { useEffect } from "react"

import { PortalPageHeader } from "@/components/portal/PortalPageHeader"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { portalStatusBadge, portalStatusLabel, usePortalStore } from "@/store/portalStore"

function formatPrice(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`
}

export function PortalInvoicesPage() {
  const invoices = usePortalStore((s) => s.invoices)
  const loading = usePortalStore((s) => s.loading)
  const load = usePortalStore((s) => s.load)

  useEffect(() => {
    if (invoices.length === 0) load()
  }, [invoices.length, load])

  return (
    <div className="space-y-5">
      <PortalPageHeader title="Tagihan saya" subtitle="Daftar invoice dan status pembayaran" />

      <div className="grid gap-4">
        {loading && invoices.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))
        ) : invoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
            <p className="text-sm text-muted-foreground">Belum ada tagihan.</p>
          </div>
        ) : (
          invoices.map((bill) => (
            <div key={bill.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{bill.code}</p>
                  <p className="text-sm text-muted-foreground">
                    {bill.period}
                    {bill.due ? ` · Jatuh tempo ${bill.due}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatPrice(bill.amount)}</p>
                  <Badge className={cn("mt-1 font-normal", portalStatusBadge[bill.status])}>
                    {portalStatusLabel[bill.status]}
                  </Badge>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

