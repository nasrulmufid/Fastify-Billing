import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  CheckCircle2,
  CircleDot,
  Clock3,
  Inbox,
  Ticket as TicketIcon,
  ArrowRight,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { portalTicketStatusStyles, type PortalTicketStatus } from "@/lib/portalTickets"
import { type Ticket, useTicketStore } from "@/store/ticketStore"

const statusIcons: Record<PortalTicketStatus, LucideIcon> = {
  Selesai: CheckCircle2,
  Diproses: Clock3,
  Dibuka: CircleDot,
}

type FilterKey = "Semua" | PortalTicketStatus

const filters: { key: FilterKey; label: string }[] = [
  { key: "Semua", label: "Semua" },
  { key: "Dibuka", label: "Dibuka" },
  { key: "Diproses", label: "Diproses" },
  { key: "Selesai", label: "Selesai" },
]

/* Aksi status cepat untuk daftar: Dibuka→Terima, Diproses→Selesaikan, Selesai→Buka lagi */
function nextAction(ticket: Ticket): {
  label: string
  to: Ticket["status"]
  variant: "default" | "outline"
} | null {
  if (ticket.status === "Dibuka")
    return { label: "Terima tiket", to: "Diproses", variant: "default" }
  if (ticket.status === "Diproses")
    return { label: "Selesaikan", to: "Selesai", variant: "default" }
  return { label: "Buka lagi", to: "Dibuka", variant: "outline" }
}

export function TicketsPage() {
  const tickets = useTicketStore((s) => s.tickets)
  const updateStatus = useTicketStore((s) => s.updateStatus)
  const load = useTicketStore((s) => s.load)
  const [filter, setFilter] = useState<FilterKey>("Semua")

  useEffect(() => {
    if (tickets.length === 0) load()
  }, [tickets.length, load])

  const counts: Record<FilterKey, number> = {
    Semua: tickets.length,
    Dibuka: tickets.filter((t) => t.status === "Dibuka").length,
    Diproses: tickets.filter((t) => t.status === "Diproses").length,
    Selesai: tickets.filter((t) => t.status === "Selesai").length,
  }

  const filtered =
    filter === "Semua" ? tickets : tickets.filter((t) => t.status === filter)

  const handleQuickAction = (ticket: Ticket) => {
    const action = nextAction(ticket)
    if (!action) return
    updateStatus(ticket.id, action.to)
    toast.success(`Tiket ${ticket.id} → ${action.to}`)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "Tiket" }]}
        title="Tiket Gangguan"
        description="Pantau dan kelola tiket dukungan dari pelanggan."
      />

      {/* Statistik */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {filters.map((f) => {
          const active = filter === f.key
          const isStatus = f.key !== "Semua"
          const statusKey = f.key as PortalTicketStatus
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors",
                active ? "ring-2 ring-primary/40" : "hover:bg-muted/50",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">{f.label}</p>
                {isStatus && (
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full",
                      portalTicketStatusStyles[statusKey].badge,
                    )}
                  >
                    {(() => {
                      const Icon = statusIcons[statusKey]
                      return (
                        <Icon
                          className={cn(
                            "size-3.5",
                            portalTicketStatusStyles[statusKey].text,
                          )}
                        />
                      )
                    })()}
                  </span>
                )}
              </div>
              <p className="mt-1 text-2xl font-semibold">{counts[f.key]}</p>
            </button>
          )
        })}
      </div>

      {/* Daftar tiket */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
          <Inbox className="mx-auto size-10 text-muted-foreground/50" />
          <p className="mt-3 font-semibold">
            Tidak ada tiket {filter === "Semua" ? "" : `berstatus ${filter}`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Semua tiket pelanggan akan tampil di sini.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((ticket) => {
            const styles = portalTicketStatusStyles[ticket.status]
            const StatusIcon = statusIcons[ticket.status]
            const action = nextAction(ticket)
            return (
              <div
                key={ticket.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl",
                        styles.badge,
                      )}
                    >
                      <StatusIcon className={cn("size-5", styles.text)} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{ticket.id}</p>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                            styles.badge,
                          )}
                        >
                          {ticket.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {ticket.customer} · {ticket.category}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/admin/tickets/${ticket.id}`}>
                      <Button variant="outline" size="sm">
                        <TicketIcon />
                        Lihat detail
                      </Button>
                    </Link>
                    {action && (
                      <Button
                        size="sm"
                        variant={action.variant}
                        onClick={() => handleQuickAction(ticket)}
                      >
                        {action.label}
                        <ArrowRight />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-sm font-medium">{ticket.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Dibuat {ticket.date} · Diperbarui {ticket.updatedAt}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

