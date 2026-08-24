const logs = [
  { actor: "Admin", action: "Login", target: "Self", time: "06 Agustus 2026 08:30" },
  { actor: "Admin", action: "Isolir manual", target: "Budi Santoso", time: "06 Agustus 2026 07:45" },
  { actor: "Sistem", action: "Generate invoice", target: "12 pelanggan", time: "05 Agustus 2026 23:00" },
  { actor: "Admin", action: "Tambah pelanggan", target: "Dewi Sartika", time: "05 Agustus 2026 14:20" },
  { actor: "Sistem", action: "Webhook payment", target: "PY-101 (SumoPod)", time: "05 Agustus 2026 10:15" },
  { actor: "Teknisi", action: "Update tiket", target: "TKT-002 (resolved)", time: "04 Agustus 2026 16:00" },
]

import { PageHeader } from "@/components/layouts/PageHeader"

export function ActivityLogPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "Log Aktivitas" }]}
        title="Log Aktivitas"
        description="Riwayat aktivitas seluruh sistem."
      />

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] border-b border-border bg-muted/40 px-4 py-3 text-sm font-semibold text-muted-foreground">
          <span>Waktu</span>
          <span>Pelaku</span>
          <span>Aksi</span>
          <span>Target</span>
        </div>
        {logs.map((log, i) => (
          <div key={i} className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center border-b border-border px-4 py-3 text-sm last:border-b-0">
            <span className="text-muted-foreground">{log.time}</span>
            <span className="font-medium">{log.actor}</span>
            <span>{log.action}</span>
            <span className="text-muted-foreground">{log.target}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
