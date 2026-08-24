import { useEffect, useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { ChevronRight, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { PortalPageHeader } from "@/components/portal/PortalPageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { portalTicketStatusStyles } from "@/lib/portalTickets"
import { usePortalStore } from "@/store/portalStore"

const CATEGORIES = [
  "Gangguan jaringan",
  "Kecepatan lambat",
  "Permintaan perubahan",
  "Lainnya",
]

export function PortalTicketsPage() {
  const tickets = usePortalStore((s) => s.tickets)
  const loadTickets = usePortalStore((s) => s.loadTickets)
  const createTicket = usePortalStore((s) => s.createTicket)

  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (tickets.length === 0) loadTickets()
  }, [tickets.length, loadTickets])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !category) {
      toast.error("Judul dan kategori wajib diisi")
      return
    }
    setSubmitting(true)
    const newId = await createTicket({
      title: title.trim(),
      category,
      description: description.trim(),
    })
    setSubmitting(false)
    if (newId) {
      toast.success("Tiket berhasil dibuat")
      setTitle("")
      setCategory("")
      setDescription("")
    } else {
      toast.error("Gagal membuat tiket")
    }
  }

  return (
    <div className="space-y-5">
      <PortalPageHeader title="Tiket support" subtitle="Ajukan gangguan atau permintaan layanan" />

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="font-semibold">Buat tiket baru</h3>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-title">Judul masalah</Label>
            <Input
              id="ticket-title"
              placeholder="cth. Internet tidak tersambung"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-category">Kategori</Label>
            <Select value={category} onValueChange={(v) => v && setCategory(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih kategori…" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticket-desc">Penjelasan</Label>
            <Textarea
              id="ticket-desc"
              className="min-h-24"
              placeholder="Jelaskan gangguan Anda"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Mengirim…
              </>
            ) : (
              "Kirim tiket"
            )}
          </Button>
        </form>
      </div>

      {/* Riwayat tiket */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Riwayat tiket</h3>
          <span className="text-xs text-muted-foreground">{tickets.length} tiket</span>
        </div>
        <div className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background/80">
          {tickets.length === 0 ? (
            <p className="px-3.5 py-8 text-center text-sm text-muted-foreground">
              Belum ada tiket.
            </p>
          ) : (
            tickets.map((ticket) => (
              <Link
                key={ticket.id}
                to={`/portal/tickets/${ticket.id}`}
                className="flex items-center gap-2 px-3.5 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{ticket.code}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        portalTicketStatusStyles[ticket.status].badge,
                      )}
                    >
                      {ticket.status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{ticket.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                    {ticket.category} · {ticket.date}
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
