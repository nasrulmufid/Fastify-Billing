import { useEffect } from "react"
import { CalendarClock, Gauge, Wifi } from "lucide-react"

import { PortalPageHeader } from "@/components/portal/PortalPageHeader"
import { useCustomerStore } from "@/store/customerStore"

export function PortalAccountPage() {
  const customer = useCustomerStore((s) => s.customer)
  const loadProfile = useCustomerStore((s) => s.loadProfile)

  useEffect(() => {
    if (customer) loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusBanner =
    customer?.status === "Active"
      ? { title: "Layanan aktif", desc: "Semua berjalan normal", color: "from-emerald-500/15 to-primary/10", dot: "bg-emerald-500" }
      : customer?.status === "Isolated"
        ? { title: "Layanan diisolir", desc: "Selesaikan pembayaran untuk mengaktifkan layanan", color: "from-rose-500/15 to-primary/10", dot: "bg-rose-500" }
        : { title: "Menunggu aktivasi", desc: "Layanan belum aktif", color: "from-amber-500/15 to-primary/10", dot: "bg-amber-500" }

  return (
    <div className="space-y-5">
      <PortalPageHeader title="Akun saya" subtitle="Profil & status layanan" />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-lg font-semibold">Informasi pribadi</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Nama</p>
            <p className="font-medium">{customer?.name ?? "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{customer?.email ?? "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Telepon</p>
            <p className="font-medium">{customer?.phone ?? "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Alamat</p>
            <p className="font-medium">{customer?.address ?? "-"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Kode pelanggan</p>
            <p className="font-medium font-mono">{customer?.code ?? "-"}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-lg font-semibold">Status layanan</h3>

        {/* Banner status */}
        <div className={`mt-4 flex items-center gap-3 rounded-xl bg-gradient-to-br p-4 ${statusBanner.color}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${statusBanner.dot}`} />
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${statusBanner.dot}`} />
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold">{statusBanner.title}</p>
            <p className="text-xs text-muted-foreground">{statusBanner.desc}</p>
          </div>
        </div>

        {/* Detail layanan — daftar baris ala aplikasi mobile */}
        <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background/80">
          <div className="flex items-center justify-between gap-3 px-3.5 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Wifi className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Paket</span>
            </div>
            <span className="text-sm font-medium">{customer?.packageName || "-"}</span>
          </div>
          <div className="flex items-center justify-between gap-3 px-3.5 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Gauge className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Router</span>
            </div>
            <span className="font-mono text-sm font-medium">{customer?.router || "-"}</span>
          </div>
          <div className="flex items-center justify-between gap-3 px-3.5 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Masa aktif</span>
            </div>
            <span className="text-sm font-medium">{customer?.expiryDate ?? "-"}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
