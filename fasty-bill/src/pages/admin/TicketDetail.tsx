import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import {
  CheckCircle2,
  CircleDot,
  Clock3,
  MessageSquarePlus,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { portalTicketStatusStyles, type PortalTicketStatus } from "@/lib/portalTickets"
import { type Ticket, type TicketStatus, useTicketStore } from "@/store/ticketStore"

const statusIcons: Record<PortalTicketStatus, LucideIcon> = {
  Selesai: CheckCircle2,
  Diproses: Clock3,
  Dibuka: CircleDot,
}

function statusAction(ticket: Ticket): {
  label: string
  to: TicketStatus
  title: string
  description: string
  confirmLabel: string
} {
  if (ticket.status === "Dibuka")
    return {
      label: "Terima tiket",
      to: "Diproses",
      title: "Terima tiket",
      description: "Terima tiket ini dan mulai proses penanganan?",
      confirmLabel: "Terima tiket",
    }
  if (ticket.status === "Diproses")
    return {
      label: "Tandai selesai",
      to: "Selesai",
      title: "Tandai selesai",
      description: "Tandai tiket ini sebagai selesai setelah masalah teratasi?",
      confirmLabel: "Tandai selesai",
    }
  return {
    label: "Buka kembali",
    to: "Dibuka",
    title: "Buka kembali tiket",
    description: "Buka kembali tiket yang sudah selesai?",
    confirmLabel: "Buka kembali",
  }
}

export function TicketDetailPage() {
  const { id } = useParams()
  const tickets = useTicketStore((s) => s.tickets)
  const load = useTicketStore((s) => s.load)
  const ticket = tickets.find((t) => t.id === id)
  const updateStatus = useTicketStore((s) => s.updateStatus)
  const addNote = useTicketStore((s) => s.addNote)

  useEffect(() => {
    if (tickets.length === 0) load()
  }, [tickets.length, load])

  const [statusOpen, setStatusOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [statusNote, setStatusNote] = useState("")
  const [noteText, setNoteText] = useState("")

  if (!ticket) {
    return (
      <div className="space-y-5">
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", to: "/admin" },
            { label: "Tiket", to: "/admin/tickets" },
            { label: id ?? "Detail" },
          ]}
          title="Tiket tidak ditemukan"
          description="Tiket yang dicari tidak tersedia atau sudah dihapus."
        />
      </div>
    )
  }

  const styles = portalTicketStatusStyles[ticket.status]
  const StatusIcon = statusIcons[ticket.status]
  const action = statusAction(ticket)

  const infoRows = [
    { label: "ID tiket", value: ticket.id },
    { label: "Pelanggan", value: ticket.customer },
    { label: "Kategori", value: ticket.category },
    { label: "Dibuat", value: ticket.date },
    { label: "Diperbarui", value: ticket.updatedAt },
  ]

  const handleStatusConfirm = () => {
    updateStatus(ticket.id, action.to, statusNote)
    toast.success(`Tiket ${ticket.id} → ${action.to}`)
    setStatusOpen(false)
    setStatusNote("")
  }

  const handleNoteConfirm = () => {
    if (!noteText.trim()) {
      toast.error("Catatan tidak boleh kosong")
      return
    }
    addNote(ticket.id, noteText)
    toast.success("Catatan ditambahkan ke riwayat tiket")
    setNoteOpen(false)
    setNoteText("")
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", to: "/admin" },
          { label: "Tiket", to: "/admin/tickets" },
          { label: ticket.id },
        ]}
        title={ticket.id}
        description={`${ticket.title} · ${ticket.customer}`}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ===== Kolom utama ===== */}
        <div className="space-y-5 lg:col-span-2">
          {/* Banner status */}
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl bg-gradient-to-br p-4",
              styles.banner,
            )}
          >
            <div
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-full",
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
            <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background/80">
              {infoRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="text-right text-sm font-medium">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Deskripsi */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Deskripsi masalah</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {ticket.description}
            </p>
          </div>

          {/* Timeline */}
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
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {entry.note}
                    </p>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>

        {/* ===== Panel aksi ===== */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Tindakan</h3>

            {/* Dialog ubah status */}
            <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
              <DialogTrigger
                render={
                  <Button size="lg" className="mt-4 w-full">
                    {action.label}
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{action.title}</DialogTitle>
                  <DialogDescription>{action.description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-1.5">
                  <Label htmlFor="status-note">Catatan (opsional)</Label>
                  <Textarea
                    id="status-note"
                    className="min-h-20"
                    placeholder="cth. Teknisi sudah dihubungi, akan cek ke lokasi sore ini."
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
                  <Button onClick={handleStatusConfirm}>{action.confirmLabel}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Dialog tambah catatan */}
            <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
              <DialogTrigger
                render={
                  <Button variant="outline" size="lg" className="mt-2 w-full">
                    <MessageSquarePlus />
                    Tambahkan catatan
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambahkan catatan</DialogTitle>
                  <DialogDescription>
                    Catatan akan ditambahkan ke riwayat tiket tanpa mengubah status.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-1.5">
                  <Label htmlFor="note-text">Catatan</Label>
                  <Textarea
                    id="note-text"
                    className="min-h-20"
                    placeholder="cth. Pelanggan dikonfirmasi ulang via telepon."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
                  <Button onClick={handleNoteConfirm}>Simpan catatan</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Ringkasan */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-muted-foreground">Status saat ini</h3>
            <div className="mt-2 flex items-center gap-2">
              <StatusIcon className={cn("size-4", styles.text)} />
              <p className="font-semibold">{ticket.status}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {ticket.timeline.length} entri riwayat
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
