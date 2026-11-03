import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Send,
  Settings2,
  MessageSquareText,
  Phone,
  Users,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Copy,
  Pencil,
  Trash2,
  Plus,
  Clock,
  MessageCircle,
  Braces,
  Search,
  ListChecks,
  Filter,
  AlertTriangle,
  LogOut,
} from "lucide-react"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useCustomers } from "@/lib/customerStore"
import api from "@/lib/axios"
import { renderWhatsApp, WHATSAPP_FORMAT_HINT } from "@/lib/whatsappFormat"

type CustomerStatus = "Active" | "Isolated"

const statusLabel: Record<CustomerStatus, string> = {
  Active: "Aktif",
  Isolated: "Isolir",
}

const statusBadgeClass: Record<CustomerStatus, string> = {
  Active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Isolated: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "")
  if (!digits) return ""
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits
}

type Template = {
  id: string
  name: string
  body: string
  createdAt: string
  updatedAt: string
}

type BaileyStatus = {
  connected: boolean
  state: "disconnected" | "connecting" | "connected"
  qr: string | null
  pairingCode?: string | null
}

const defaultBaileyStatus: BaileyStatus = {
  connected: false,
  state: "disconnected",
  qr: null,
}

/* ================================================================
   Tab: Pengaturan GOWA (Login WhatsApp)
   ================================================================ */

function PengaturanBaileysTab() {
  const [status, setStatus] = useState<BaileyStatus>(defaultBaileyStatus)
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [deviceName, setDeviceName] = useState("Fasty Bot")
  const [phone, setPhone] = useState("")
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    const loadStatus = async () => {
      try {
        const { data } = await api.get("/wa-gateway/status")
        const next = data?.data ?? defaultBaileyStatus
        setStatus(next)
        setLoading(false)
        if (next.connected && timer) clearInterval(timer)
      } catch {
        setLoading(false)
      }
    }

    loadStatus().finally(() => {
      timer = setInterval(loadStatus, 2000)
    })
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [])

  const handleGenerateQR = async () => {
    setLoading(true)
    try {
      const { data } = await api.post("/wa-gateway/qr")
      setStatus(data?.data ?? defaultBaileyStatus)
      if (data?.data?.qr) {
        toast.info("QR code berhasil dimuat. Scan dengan WhatsApp Anda.")
      } else if (data?.data?.state === "disconnected") {
        toast.error("Koneksi WhatsApp gagal. Cek koneksi keluar container ke WhatsApp.")
      }
    } catch (err) {
      toast.error("Gagal membuat QR code")
    } finally {
      setLoading(false)
    }
  }

  const handlePairingCode = async () => {
    try {
      const { data } = await api.post("/wa-gateway/pairing-code", { phone })
      setPairingCode(data?.data?.pairingCode ?? null)
      toast.info("Masukkan kode di WhatsApp: Perangkat tertaut > Tautkan dengan nomor telepon")
    } catch {
      toast.error("Gagal membuat pairing code")
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      await api.post("/wa-gateway/disconnect")
      setStatus(defaultBaileyStatus)
      toast.success("WhatsApp berhasil disconnect")
    } catch (err) {
      toast.error("Gagal disconnect WhatsApp")
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      await api.put("/wa-gateway/config", { deviceName })
      toast.success("Konfigurasi WhatsApp disimpan")
    } catch (err) {
      toast.error("Gagal menyimpan konfigurasi")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="border-border lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Settings2 className="size-4 text-muted-foreground" />
            Login WhatsApp (GOWA)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scan QR code di bawah dengan aplikasi WhatsApp Anda untuk menghubungkan device.
          </p>

          {loading ? (
            <div className="flex h-72 items-center justify-center rounded-lg border border-border bg-muted">
              <RefreshCw className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : status.qr ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/40 p-4 sm:p-6">
              <img src={status.qr} alt="QR Code" className="size-40 sm:size-56" />
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                QR code ini akan expire dalam beberapa menit. Jika sudah expire, klik "Buat QR Baru".
              </p>
            </div>
          ) : (
            <div className="flex h-72 items-center justify-center rounded-lg border-2 border-dashed border-border">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Belum ada QR code</p>
                <p className="text-xs text-muted-foreground mt-1">Klik tombol di bawah untuk membuat</p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="phone">Nomor WhatsApp untuk Pairing</Label>
            <div className="flex gap-2">
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="628123456789" />
              <Button onClick={handlePairingCode} disabled={!phone.trim() || status.state === "connecting"}>Pairing</Button>
            </div>
            {pairingCode && <p className="rounded bg-muted p-3 text-center font-mono text-lg tracking-widest">{pairingCode}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="deviceName">Nama Perangkat</Label>
            <Input
              id="deviceName"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Fasty Bot"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleGenerateQR}
              disabled={loading || status.state === "connecting"}
              className="flex-1"
              variant={status.connected ? "outline" : "default"}
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
                  Memproses…
                </>
              ) : status.connected ? (
                "Buat QR Baru"
              ) : (
                "Buat QR Code"
              )}
            </Button>
            <Button
              onClick={handleSaveConfig}
              disabled={saving}
              variant="outline"
            >
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
            {status.connected && (
              <Button
                onClick={handleDisconnect}
                disabled={disconnecting}
                variant="destructive"
                size="icon"
              >
                {disconnecting ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <LogOut className="size-4" />
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-5">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Status Koneksi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {status.state === "connecting" ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40 dark:text-yellow-300">
                  <RefreshCw className="size-4 animate-spin" />
                </div>
              ) : status.connected ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
                  <CheckCircle2 className="size-4" />
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
                  <XCircle className="size-4" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium">
                  {status.state === "connecting"
                    ? "Menghubungkan…"
                    : status.connected
                      ? "Terhubung"
                      : "Tidak Terhubung"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {status.state === "connecting"
                    ? "Scan QR code di perangkat Anda"
                    : status.connected
                      ? "WhatsApp siap mengirim pesan"
                      : "Buat QR code untuk login"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Informasi</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              GOWA mengelola koneksi WhatsApp dan pengiriman pesan otomatis
              dari device Anda.
            </p>
            <p>
              Device akan terus terhubung selama aplikasi berjalan. Pastikan nomor WhatsApp
              aktif dan terpasang.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ================================================================
   Tab: Kirim Pesan
   ================================================================ */

function KirimPesanTab() {
  const customers = useCustomers()
  const [mode, setMode] = useState<"single" | "bulk">("single")
  const [phone, setPhone] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<"Semua" | CustomerStatus>("Semua")
  const [search, setSearch] = useState("")
  const [message, setMessage] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [sending, setSending] = useState(false)
  const [log, setLog] = useState<{ time: string; phone: string; status: "ok" | "fail"; note: string }[]>([])
  const [templates, setTemplates] = useState<Template[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await api.get("/wa-gateway/templates")
        if (Array.isArray(data?.data)) {
          setTemplates(
            data.data.map((t: Record<string, unknown>) => ({
              id: String(t.id),
              name: String(t.name ?? ""),
              body: String(t.body ?? ""),
              createdAt: String(t.createdAt ?? ""),
              updatedAt: String(t.updatedAt ?? ""),
            })),
          )
        }
      } catch {
        /* abaikan */
      }
    })()
  }, [])

  const applyTemplate = (id: string) => {
    const tpl = templates.find((t) => t.id === id)
    if (tpl) {
      setMessage(tpl.body)
      setTemplateId(id)
      toast.info(`Template "${tpl.name}" diterapkan`)
    }
  }

  const filteredCustomers = customers.filter((c) => {
    if (statusFilter !== "Semua" && c.status !== statusFilter) return false
    const q = search.trim().toLowerCase()
    if (q) {
      return (
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.phone.replace(/[^\d]/g, "").includes(q.replace(/[^\d]/g, "")) ||
        c.packageName.toLowerCase().includes(q)
      )
    }
    return true
  })

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const selectVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      filteredCustomers.forEach((c) => next.add(c.id))
      return [...next]
    })
  }

  const clearSelection = () => {
    setSelectedIds((prev) => {
      const visibleIds = new Set(filteredCustomers.map((c) => c.id))
      return prev.filter((id) => !visibleIds.has(id))
    })
  }

  const selectedCustomers = customers.filter((c) => selectedIds.includes(c.id))
  const selectedPhones = selectedCustomers.map((c) => normalizePhone(c.phone)).filter(Boolean)

  const handleSend = async () => {
    const recipients = mode === "single" ? [phone.trim()] : selectedPhones

    if (recipients.length === 0 || !recipients[0]) {
      toast.error("Masukkan nomor tujuan terlebih dahulu")
      return
    }
    if (!message.trim()) {
      toast.error("Pesan tidak boleh kosong")
      return
    }

    setSending(true)
    try {
      const vars = selectedCustomers.map((customer) => ({
        phone: customer.phone,
        nama: customer.name,
        paket: customer.packageName,
      }))
      const { data } = await api.post("/wa-gateway/send", {
        to: recipients,
        template: { body: message.trim() },
        vars: mode === "bulk" ? vars : undefined,
      })
      const result = data.data as { sent: number; failed: number }
      const now = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
      const newLog = recipients.map((p, index) => ({
        time: now,
        phone: p,
        status: (index < result.sent ? "ok" : "fail") as "ok" | "fail",
        note: index < result.sent ? "Terkirim" : "Gagal",
      }))
      setLog((prev) => [...newLog, ...prev].slice(0, 50))
      toast.success(`${result.sent}/${recipients.length} pesan terkirim`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim pesan")
    } finally {
      setSending(false)
    }
  }

  const bulkCount = mode === "bulk" ? selectedIds.length : 0

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="border-border lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <MessageCircle className="size-4 text-muted-foreground" />
            Tulis Pesan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 sm:gap-1.5 rounded-md px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                mode === "single"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Phone className="size-3.5" />
              <span className="hidden sm:inline">Single</span>
              <span className="sm:hidden">1</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("bulk")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 sm:gap-1.5 rounded-md px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                mode === "bulk"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Users className="size-3.5" />
              <span className="hidden sm:inline">Bulk</span>
              <span className="sm:hidden">M</span>
              ({bulkCount})
            </button>
          </div>

          {mode === "single" ? (
            <div className="space-y-1.5">
              <Label htmlFor="phone">Nomor Tujuan</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="62812xxxxxxxx"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Pilih Pelanggan</Label>
                <span className="text-xs text-muted-foreground">
                  {selectedIds.length} dipilih · {selectedPhones.length} nomor
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
                <Filter className="size-3.5 shrink-0 text-muted-foreground" />
                {(["Semua", "Active", "Isolated"] as const).map((f) => {
                  const count =
                    f === "Semua"
                      ? customers.length
                      : customers.filter((c) => c.status === f).length
                  const label = f === "Semua" ? "Semua" : statusLabel[f]
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setStatusFilter(f)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                        statusFilter === f
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label} ({count})
                    </button>
                  )
                })}
              </div>

              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, kode, no. HP…"
                  className="pl-8"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {filteredCustomers.length} pelanggan tampil
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={selectVisible}
                    className="flex items-center gap-1 font-medium text-primary hover:underline whitespace-nowrap"
                  >
                    <ListChecks className="size-3.5" />
                    Pilih semua
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-muted-foreground hover:text-foreground hover:underline whitespace-nowrap"
                  >
                    Bersihkan
                  </button>
                </div>
              </div>

              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-1.5">
                {filteredCustomers.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Tidak ada pelanggan yang cocok.
                  </p>
                ) : (
                  filteredCustomers.map((c) => {
                    const checked = selectedIds.includes(c.id)
                    return (
                      <label
                        key={c.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors",
                          checked ? "bg-primary/5" : "hover:bg-muted/60",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleSelect(c.id)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-medium">{c.name}</span>
                            <Badge
                              className={cn(
                                "shrink-0 text-[10px] font-normal",
                                statusBadgeClass[c.status],
                              )}
                            >
                              {statusLabel[c.status]}
                            </Badge>
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                            {c.code} · {c.packageName} · {normalizePhone(c.phone)}
                          </p>
                        </div>
                      </label>
                    )
                  })
                )}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Template Cepat</Label>
            <Select value={templateId} onValueChange={(v) => applyTemplate(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih template pesan…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">-- Tanpa template --</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">
              Isi Pesan
              <span className="ml-2 text-xs text-muted-foreground">
                ({message.length} karakter)
              </span>
            </Label>
            <Textarea
              id="message"
              rows={5}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value)
                setTemplateId("")
              }}
              placeholder="Tulis pesan WhatsApp di sini…"
            />
            <p className="text-xs text-muted-foreground">
              Variabel: {"{nama}"}, {"{jumlah}"}, {"{tanggal}"}, {"{no_invoice}"}, {"{paket}"}, {"{payment_link}"}
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Pratinjau</Label>
              <div className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 text-sm leading-relaxed overflow-x-auto">
                {message.trim()
                  ? renderWhatsApp(message)
                  : <span className="text-xs text-muted-foreground">Pesan akan tampil di sini…</span>}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Format didukung: *tebal*, _miring_, ~coret~, `kode`, dan baris baru (Enter).
              </p>
            </div>
          </div>

          <Button
            onClick={handleSend}
            disabled={sending}
            size="lg"
            className="h-11 w-full gap-2 px-5 text-sm font-semibold"
          >
            {sending ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Mengirim…
              </>
            ) : (
              <>
                <Send className="size-4" />
                {mode === "single"
                  ? "Kirim Pesan"
                  : `Kirim ke ${selectedPhones.length}`}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Braces className="size-3.5 sm:size-4 text-muted-foreground" />
            <span className="hidden sm:inline">Variabel Pesan</span>
            <span className="sm:hidden">Variabel</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Gunakan variabel berikut di isi pesan. Nilainya diisi otomatis.
          </p>
          <div className="grid gap-2 text-xs">
            {[
              ["{nama}", "Nama pelanggan"],
              ["{jumlah}", "Jumlah tagihan"],
              ["{tanggal}", "Tanggal jatuh tempo"],
              ["{no_invoice}", "No. invoice"],
              ["{paket}", "Nama paket"],
              ["{payment_link}", "Link QRIS"],
            ].map(([variable, description]) => (
              <div key={variable} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-2">
                <code className="font-medium text-primary text-[11px]">{variable}</code>
                <span className="text-right text-muted-foreground text-[10px]">{description}</span>
              </div>
            ))}
          </div>
          <Separator className="my-1" />
          <p className="text-xs font-medium">Format Teks WhatsApp</p>
          <div className="grid gap-2 text-xs">
            {WHATSAPP_FORMAT_HINT.map(([syntax, description]) => (
              <div
                key={syntax}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-2"
              >
                <code className="font-medium text-primary text-[11px]">{syntax}</code>
                <span className="text-right text-muted-foreground text-[10px]">{description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base font-semibold">
            <span className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span className="hidden sm:inline">Riwayat Kirim</span>
              <span className="sm:hidden">Riwayat</span>
            </span>
            {log.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setLog([])} className="h-auto px-2 py-1 text-xs">
                Bersihkan
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada riwayat pengiriman.
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {log.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm"
                >
                  {item.status === "ok" ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="mt-0.5 size-3.5 shrink-0 text-rose-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium break-all">{item.phone}</p>
                    <p className="text-xs text-muted-foreground">{item.note}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">{item.time}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/* ================================================================
   Tab: Template Pesan
   ================================================================ */

function TemplatePesanTab() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)
  const [editing, setEditing] = useState<Template | null>(null)
  const [formName, setFormName] = useState("")
  const [formBody, setFormBody] = useState("")

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data } = await api.get("/wa-gateway/templates")
        if (active && Array.isArray(data?.data)) {
          setTemplates(
            data.data.map((t: Record<string, unknown>) => ({
              id: String(t.id),
              name: String(t.name ?? ""),
              body: String(t.body ?? ""),
              createdAt: String(t.createdAt ?? ""),
              updatedAt: String(t.updatedAt ?? ""),
            })),
          )
        }
      } catch (err) {
        toast.error("Gagal memuat template pesan")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const openCreate = () => {
    setEditing(null)
    setFormName("")
    setFormBody("")
    setDialogOpen(true)
  }

  const openEdit = (tpl: Template) => {
    setEditing(tpl)
    setFormName(tpl.name)
    setFormBody(tpl.body)
    setDialogOpen(true)
  }

  const handleSaveTemplate = async () => {
    if (!formName.trim()) {
      toast.error("Nama template harus diisi")
      return
    }
    if (!formBody.trim()) {
      toast.error("Isi pesan tidak boleh kosong")
      return
    }

    setSaving(true)
    try {
      if (editing) {
        await api.put(`/wa-gateway/templates/${editing.id}`, {
          name: formName.trim(),
          body: formBody.trim(),
        })
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === editing.id ? { ...t, name: formName.trim(), body: formBody.trim() } : t,
          ),
        )
        toast.success(`Template "${formName.trim()}" diperbarui`)
      } else {
        const { data } = await api.post("/wa-gateway/templates", {
          name: formName.trim(),
          body: formBody.trim(),
        })
        const created = data?.data
        setTemplates((prev) => [
          ...prev,
          {
            id: String(created?.id ?? `${Date.now()}`),
            name: formName.trim(),
            body: formBody.trim(),
            createdAt: created?.createdAt ?? "",
            updatedAt: created?.updatedAt ?? "",
          },
        ])
        toast.success(`Template "${formName.trim()}" dibuat`)
      }
      setDialogOpen(false)
    } catch (err) {
      toast.error("Gagal menyimpan template")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/wa-gateway/templates/${deleteTarget.id}`)
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      toast.success(`Template "${deleteTarget.name}" dihapus`)
    } catch (err) {
      toast.error("Gagal menghapus template")
    } finally {
      setDeleteTarget(null)
    }
  }

  const copyTemplate = (body: string) => {
    navigator.clipboard.writeText(body)
    toast.success("Isi template disalin ke clipboard")
  }

  return (
    <Card className="border-border"><CardContent className="pt-6 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {loading ? "Memuat template…" : `${templates.length} template tersimpan`}
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 size-4" />
          Template Baru
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <MessageSquareText className="mx-auto mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Belum ada template pesan.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
              <Plus className="mr-1.5 size-3.5" />
              Buat Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <Card
              key={tpl.id}
              className="group border-border transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm font-semibold truncate">{tpl.name}</CardTitle>
                    <Badge variant="outline" className="mt-1 text-[10px] font-normal">
                      {tpl.id}
                    </Badge>
                  </div>
                  <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => openEdit(tpl)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-rose-500 hover:text-rose-600"
                      onClick={() => setDeleteTarget(tpl)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                  {tpl.body}
                </p>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground truncate">
                    Diperbarui {tpl.updatedAt}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-[10px] shrink-0"
                    onClick={() => copyTemplate(tpl.body)}
                  >
                    <Copy className="mr-1 size-3" />
                    Salin
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Template" : "Template Baru"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Perbarui nama dan isi template pesan."
                : "Buat template pesan baru untuk pengiriman cepat."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tplName">Nama Template</Label>
              <Input
                id="tplName"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Misal: Pengingat Tagihan"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tplBody">
                Isi Pesan
                <span className="ml-2 text-xs text-muted-foreground">
                  ({formBody.length} karakter)
                </span>
              </Label>
              <Textarea
                id="tplBody"
                rows={6}
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="Tulis template pesan…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleSaveTemplate} disabled={saving}>
              {saving ? "Menyimpan…" : editing ? "Simpan Perubahan" : "Buat Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus template?</AlertDialogTitle>
            <AlertDialogDescription>
              Template <strong>{deleteTarget?.name}</strong> akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </CardContent>
    </Card>
  )
}

/* ================================================================
   Tab: Pesan Offline
   ================================================================ */

function PesanOfflineTab() {
  const [body, setBody] = useState("")
  const [defaultBody, setDefaultBody] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await api.get("/wa-gateway/offline-message")
        setBody(String(data?.data?.body ?? ""))
        setDefaultBody(String(data?.data?.defaultBody ?? ""))
      } catch {
        toast.error("Gagal memuat pesan offline")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleSave = async () => {
    if (!body.trim()) {
      toast.error("Isi pesan tidak boleh kosong")
      return
    }
    setSaving(true)
    try {
      await api.put("/wa-gateway/offline-message", { body: body.trim() })
      toast.success("Pesan offline disimpan")
    } catch {
      toast.error("Gagal menyimpan pesan offline")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setBody(defaultBody)
    toast.info("Reset ke default")
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="border-border lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="size-4 text-muted-foreground" />
            Pesan "Server Offline"
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="offlineMessage">
              Isi Pesan
              <span className="ml-2 text-xs text-muted-foreground">({body.length} karakter)</span>
            </Label>
            <Textarea
              id="offlineMessage"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={loading}
              placeholder="Tulis pesan untuk pelanggan saat server offline…"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={saving || loading}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function WAGatewayPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "WA Gateway" }]}
        title="WA Gateway (GOWA)"
        description="Kelola pengiriman pesan WhatsApp melalui GOWA."
      />

      <Tabs defaultValue="pengaturan-baileys" className="w-full">
        <TabsList className="grid w-full grid-cols-2 gap-1 sm:flex sm:overflow-x-auto p-1 mb-4 sm:mb-0">
          <TabsTrigger value="pengaturan-baileys" className="whitespace-nowrap">
            <Settings2 className="mr-1.5 size-3.5" />
            <span className="hidden sm:inline">Pengaturan GOWA</span>
            <span className="sm:hidden">Pengaturan</span>
          </TabsTrigger>
          <TabsTrigger value="kirim-pesan" className="whitespace-nowrap">
            <Send className="mr-1.5 size-3.5" />
            <span className="hidden sm:inline">Kirim Pesan</span>
            <span className="sm:hidden">Kirim</span>
          </TabsTrigger>
          <TabsTrigger value="template-pesan" className="whitespace-nowrap">
            <MessageSquareText className="mr-1.5 size-3.5" />
            <span className="hidden sm:inline">Template Pesan</span>
            <span className="sm:hidden">Template</span>
          </TabsTrigger>
          <TabsTrigger value="pesan-offline" className="whitespace-nowrap">
            <AlertTriangle className="mr-1.5 size-3.5" />
            <span className="hidden sm:inline">Pesan Offline</span>
            <span className="sm:hidden">Offline</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pengaturan-baileys" className="mt-4">
          <PengaturanBaileysTab />
        </TabsContent>

        <TabsContent value="kirim-pesan" className="mt-4">
          <KirimPesanTab />
        </TabsContent>

        <TabsContent value="template-pesan" className="mt-4">
          <TemplatePesanTab />
        </TabsContent>

        <TabsContent value="pesan-offline" className="mt-4">
          <PesanOfflineTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default WAGatewayPage
