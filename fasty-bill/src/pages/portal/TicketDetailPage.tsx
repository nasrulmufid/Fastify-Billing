import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { CheckCircle2, CircleDot, Clock3 } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { PortalPageHeader } from "@/components/portal/PortalPageHeader"
import { cn } from "@/lib/utils"
import { portalTicketStatusStyles, type PortalTicketStatus } from "@/lib/portalTickets"
import { usePortalStore, type PortalTicket } from "@/store/portalStore"

const statusIcons: Record<PortalTicketStatus, LucideIcon> = {
  Selesai: CheckCircle2,
  Diproses: Clock3,
  Dibuka: CircleDot,
}

export function PortalTicketDetailPage() {
  const { id } = useParams()
  const tickets = usePortalStore((s) => s.tickets)
  const fetchTicket = usePortalStore((s) => s.fetchTicket)
  const [ticket, setTicket] = useState<PortalTicket | null>(
    () => tickets.find((t) => t.id === id) ?? null,
  )
  const [loading, setLoading] = useState(!ticket)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    fetchTicket(id).then((t) => {
      if (active) {
        setTicket(t)
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [id, fetchTicket])

  if (loading) {
    return (
      <div className="space-y-5">
        <PortalPageHeader title="Detail tiket" subtitle="Riwayat status tiket" />
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Memuat tiket…</p>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="space-y-5">
        <PortalPageHeader title="Detail tiket" subtitle="Riwayat status tiket" />
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <p className="font-semibold">Tiket tidak ditemukan</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tiket dengan ID {id} tidak tersedia atau sudah dihapus.
          </p>
        </div>
      </div>
    )
  }

  const styles = portalTicketStatusStyles[ticket.status]
  const StatusIcon = statusIcons[ticket.status]

  const infoRows = [
    { label: "ID tiket", value: ticket.code },
    { label: "Kategori", value: ticket.category },
    { label: "Dibuat", value: ticket.date },
    { label: "Diperbarui", value: ticket.updatedAt },
  ]

  return (
    <div className="space-y-5">
      <PortalPageHeader title="Detail tiket" subtitle={ticket.id} />

      {/* Banner status */}
      <div className={cn("flex items-center gap-3 rounded-xl bg-gradient-to-br p-4", styles.banner)}>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            styles.badge,
          )}
        >
          <StatusIcon className={cn("size-5", styles.text)} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{ticket.title}</p>
          <p className="text-xs text-muted-foreground">
            Status {ticket.status} · diperbarui {ticket.updatedAt}
          </p>
        </div>
      </div>

      {/* Informasi tiket */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-lg font-semibold">Informasi tiket</h3>
        <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background/80">
          {infoRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 px-3.5 py-3">
              <span className="text-sm text-muted-foreground">{row.label}</span>
              <span className="text-right text-sm font-medium">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Deskripsi masalah */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-lg font-semibold">Deskripsi masalah</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{ticket.description}</p>
      </div>

      {/* Riwayat status — timeline */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-lg font-semibold">Riwayat status</h3>
        <ol className="mt-4">
          {ticket.timeline.map((entry, i) => {
            const entryStatus = entry.status ?? "Dibuka"
            const entryStyles = portalTicketStatusStyles[entryStatus]
            const isLast = i === ticket.timeline.length - 1
            return (
              <li key={`${entry.date}-${i}`} className="relative pb-6 pl-6 last:pb-0">
                {!isLast && (
                  <span
                    aria-hidden
                    className="absolute top-3 left-[4.5px] h-full w-px bg-border"
                  />
                )}
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-1.5 left-0 size-2.5 rounded-full ring-4 ring-background",
                    entryStyles.dot,
                  )}
                />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="text-sm font-semibold">{entry.status}</p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      entryStyles.badge,
                    )}
                  >
                    {entry.actor}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">{entry.date}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{entry.note}</p>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
