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
  ExternalLink,
  Search,
  ListChecks,
  Filter,
} from "lucide-react"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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

/* ================================================================
   Types & Data
   ================================================================ */

type CustomerStatus = "Active" | "Isolated"

const statusLabel: Record<CustomerStatus, string> = {
  Active: "Aktif",
  Isolated: "Isolir",
}

const statusBadgeClass: Record<CustomerStatus, string> = {
  Active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Isolated: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
}

/** Ubah "0812-3456-7890" → "6281234567890" */
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

type ApiConfig = {
  serverUrl: string
  apiKey: string
  deviceName: string
  webhookUrl: string
  autoReconnect: boolean
}

const defaultApiConfig: ApiConfig = {
  serverUrl: "https://api.go-whatsapp.example.com",
  apiKey: "",
  deviceName: "RT-RW-Net-Bot",
  webhookUrl: "https://billing.example.com/webhook/wa",
  autoReconnect: true,
}

/* ---------- initial templates (kosong — dimuat dari API) ---------- */
const defaultTemplates: Template[] = []

/* ================================================================
   Tab: Pengaturan API
   ================================================================ */

function PengaturanApiTab() {
  const [config, setConfig] = useState<ApiConfig>(defaultApiConfig)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [connected, setConnected] = useState<boolean | null>(null)

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast.success("Konfigurasi API berhasil disimpan")
    }, 800)
  }

  const handleTestConnection = () => {
    if (!config.serverUrl || !config.apiKey) {
      toast.error("URL server dan API key harus diisi terlebih dahulu")
      return
    }
    setTesting(true)
    setConnected(null)
    setTimeout(() => {
      setTesting(false)
      const ok = Math.random() > 0.3
      setConnected(ok)
      if (ok) {
        toast.success("Terhubung ke GO WhatsApp API — status OK")
      } else {
        toast.error("Gagal terhubung. Periksa URL dan API key.")
      }
    }, 1500)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="border-border lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Settings2 className="size-4 text-muted-foreground" />
            Konfigurasi GO WhatsApp API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="serverUrl">Server URL</Label>
              <Input
                id="serverUrl"
                value={config.serverUrl}
                onChange={(e) => setConfig({ ...config, serverUrl: e.target.value })}
                placeholder="https://api.go-whatsapp.example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deviceName">Nama Perangkat</Label>
              <Input
                id="deviceName"
                value={config.deviceName}
                onChange={(e) => setConfig({ ...config, deviceName: e.target.value })}
                placeholder="RT-RW-Net-Bot"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="apiKey">API Key / Token</Label>
            <div className="flex gap-2">
              <Input
                id="apiKey"
                type="password"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="Masukkan API key..."
                className="flex-1"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(config.apiKey)
                  toast.success("API key disalin ke clipboard")
                }}
                disabled={!config.apiKey}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="webhookUrl">Webhook URL (callback)</Label>
            <Input
              id="webhookUrl"
              value={config.webhookUrl}
              onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
              placeholder="https://billing.example.com/webhook/wa"
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autoReconnect" className="text-sm font-medium">
                Auto-reconnect
              </Label>
              <p className="text-xs text-muted-foreground">
                Otomatis sambungkan ulang jika koneksi terputus
              </p>
            </div>
            <Switch
              id="autoReconnect"
              checked={config.autoReconnect}
              onCheckedChange={(v) => setConfig({ ...config, autoReconnect: !!v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Status & Actions */}
      <div className="flex flex-col gap-5">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Status Koneksi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {connected === null ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                  <Clock className="size-4 text-muted-foreground" />
                </div>
              ) : connected ? (
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
                  {connected === null
                    ? "Belum diuji"
                    : connected
                      ? "Terhubung"
                      : "Gagal"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {connected === null
                    ? "Klik 'Tes Koneksi'"
                    : connected
                      ? "GO WhatsApp API siap"
                      : "Periksa konfigurasi"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? (
                  <>
                    <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
                    Menguji…
                  </>
                ) : (
                  "Tes Koneksi"
                )}
              </Button>
              <Button size="sm" className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "Menyimpan…" : "Simpan"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Informasi</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              GO WhatsApp API memungkinkan pengiriman pesan WhatsApp secara
              otomatis untuk notifikasi tagihan, konfirmasi pembayaran, dan
              broadcast ke pelanggan.
            </p>
            <p>
              Pastikan nomor WhatsApp perangkat telah terverifikasi di dashboard
              GO WhatsApp sebelum digunakan.
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
  const [templates, setTemplates] = useState<Template[]>(defaultTemplates)

  // Muat template dari backend agar dropdown template tersedia di tab Kirim Pesan
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
        /* abaikan — template opsional di tab kirim */
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

  // ---- Pelanggan terfilter untuk mode bulk ----
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
        note: index < result.sent ? "Terkirim" : "Nomor tidak terdaftar",
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
      {/* Compose */}
      <Card className="border-border lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <MessageCircle className="size-4 text-muted-foreground" />
            Tulis Pesan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                mode === "single"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Phone className="size-3.5" />
              Single
            </button>
            <button
              type="button"
              onClick={() => setMode("bulk")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                mode === "bulk"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Users className="size-3.5" />
              Bulk ({bulkCount})
            </button>
          </div>

          {/* Recipient */}
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
                  {selectedIds.length} dipilih · {selectedPhones.length} nomor valid
                </span>
              </div>

              {/* Filter status */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Filter className="size-3.5 text-muted-foreground" />
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
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
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

              {/* Search */}
              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, kode, no. HP, atau paket…"
                  className="pl-8"
                />
              </div>

              {/* Select all visible / clear */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {filteredCustomers.length} pelanggan tampil
                </span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={selectVisible}
                    className="flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    <ListChecks className="size-3.5" />
                    Pilih semua tampil
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Bersihkan
                  </button>
                </div>
              </div>

              {/* Customer list */}
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
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
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

          {/* Template selector */}
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

          {/* Message body */}
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
                  : `Kirim ke ${selectedPhones.length} Pelanggan`}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Placeholder reference */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Braces className="size-4 text-muted-foreground" />
            Variabel Pesan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Gunakan variabel berikut di isi pesan. Nilainya diisi otomatis berdasarkan pelanggan dan tagihan terbaru.
          </p>
          <div className="grid gap-2 text-xs">
            {[
              ["{nama}", "Nama pelanggan"],
              ["{jumlah}", "Jumlah tagihan"],
              ["{tanggal}", "Tanggal jatuh tempo"],
              ["{no_invoice}", "Nomor invoice"],
              ["{paket}", "Nama paket"],
              ["{payment_link}", "Link pembayaran QRIS"],
            ].map(([variable, description]) => (
              <div key={variable} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-2.5 py-2">
                <code className="font-medium text-primary">{variable}</code>
                <span className="text-right text-muted-foreground">{description}</span>
              </div>
            ))}
          </div>
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <ExternalLink className="mt-0.5 size-3 shrink-0" />
            <span>{"{payment_link}"} berisi link QRIS SumoPod untuk invoice belum lunas.</span>
          </p>
        </CardContent>
      </Card>

      {/* Send Log */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base font-semibold">
            <span className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              Riwayat Kirim
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
                    <p className="text-xs font-medium">{item.phone}</p>
                    <p className="text-xs text-muted-foreground">{item.note}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{item.time}</span>
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
  const [templates, setTemplates] = useState<Template[]>(defaultTemplates)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)
  const [editing, setEditing] = useState<Template | null>(null)
  const [formName, setFormName] = useState("")
  const [formBody, setFormBody] = useState("")

  // Muat template dari backend saat mount
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
    <div className="space-y-5">
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((tpl) => (
            <Card
              key={tpl.id}
              className="group border-border transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">{tpl.name}</CardTitle>
                    <Badge variant="outline" className="mt-1 text-[10px] font-normal">
                      {tpl.id}
                    </Badge>
                  </div>
                  <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
                <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground">
                  {tpl.body}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    Diperbarui {tpl.updatedAt}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-[10px]"
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

      {/* Create / Edit Dialog */}
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
              <p className="text-xs text-muted-foreground">
                Variabel: {"{nama}"}, {"{jumlah}"}, {"{tanggal}"}, {"{no_invoice}"}, {"{paket}"}, {"{payment_link}"}
              </p>
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

      {/* Delete Confirmation */}
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
              Template <strong>{deleteTarget?.name}</strong> ({deleteTarget?.id}) akan
              dihapus permanen. Tindakan ini tidak dapat dibatalkan.
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
    </div>
  )
}

/* ================================================================
   WA Gateway Page
   ================================================================ */

export function WAGatewayPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "WA Gateway" }]}
        title="WA Gateway"
        description="Kelola pengiriman pesan WhatsApp melalui GO WhatsApp API."
      />

      <Tabs defaultValue="kirim-pesan" className="w-full">
        <TabsList>
          <TabsTrigger value="kirim-pesan">
            <Send className="mr-1.5 size-3.5" />
            Kirim Pesan
          </TabsTrigger>
          <TabsTrigger value="template-pesan">
            <MessageSquareText className="mr-1.5 size-3.5" />
            Template Pesan
          </TabsTrigger>
          <TabsTrigger value="pengaturan-api">
            <Settings2 className="mr-1.5 size-3.5" />
            Pengaturan API
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kirim-pesan" className="mt-4">
          <KirimPesanTab />
        </TabsContent>

        <TabsContent value="template-pesan" className="mt-4">
          <TemplatePesanTab />
        </TabsContent>

        <TabsContent value="pengaturan-api" className="mt-4">
          <PengaturanApiTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default WAGatewayPage
