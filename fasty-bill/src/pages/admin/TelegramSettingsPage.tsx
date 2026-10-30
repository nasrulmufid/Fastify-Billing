import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Send,
  Bot,
  RefreshCw,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Braces,
  Loader2,
} from "lucide-react"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { renderWhatsApp } from "@/lib/whatsappFormat"
import api from "@/lib/axios"

/* ================================================================
   Types
   ================================================================ */

type TemplateKey = "paymentSuccess" | "paymentFailed" | "paymentExpired" | "routerOffline" | "routerOnline"

type TelegramConfigData = {
  botToken: string
  chatId: string
  enabled: boolean
  notifyPaymentSuccess: boolean
  notifyPaymentFailed: boolean
  notifyPaymentExpired: boolean
  notifyRouterOffline: boolean
  notifyRouterOnline: boolean
  routerCheckIntervalMinutes: number
  templates: Record<TemplateKey, string>
  defaults: {
    templates: Record<TemplateKey, string>
    routerCheckIntervalMinutes: number
  }
  configured: boolean
}

type NotifyType = TemplateKey

const notifyTypeMeta: Record<NotifyType, { label: string; description: string }> = {
  paymentSuccess: { label: "Transaksi Sukses", description: "Dikirim saat webhook payment.completed diterima dari payment gateway." },
  paymentFailed: { label: "Transaksi Gagal", description: "Dikirim saat webhook payment.failed diterima dari payment gateway." },
  paymentExpired: { label: "Transaksi Kadaluarsa", description: "Dikirim saat webhook payment.expired diterima (QRIS tidak dibayar sebelum batas waktu)." },
  routerOffline: { label: "Mikrotik Offline", description: "Dikirim saat monitor berkala mendeteksi router tidak merespons." },
  routerOnline: { label: "Mikrotik Online Kembali", description: "Dikirim saat router pulih dari offline — antrian sinkronisasi PPPoE otomatis dilanjutkan." },
}

/* ================================================================
   Component
   ================================================================ */

export function TelegramSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<NotifyType | "bot" | null>(null)
  const [config, setConfig] = useState<TelegramConfigData | null>(null)

  // Form state (editable copies)
  const [botToken, setBotToken] = useState("")
  const [chatId, setChatId] = useState("")
  const [enabled, setEnabled] = useState(false)
  const [notify, setNotify] = useState({
    paymentSuccess: true,
    paymentFailed: true,
    paymentExpired: true,
    routerOffline: true,
    routerOnline: true,
  })
  const [intervalMin, setIntervalMin] = useState(5)
  const [templates, setTemplates] = useState<Record<TemplateKey, string>>({
    paymentSuccess: "",
    paymentFailed: "",
    paymentExpired: "",
    routerOffline: "",
    routerOnline: "",
  })

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await api.get("/telegram/config")
        const cfg = data.data as TelegramConfigData
        setConfig(cfg)
        setBotToken(cfg.botToken ?? "")
        setChatId(cfg.chatId ?? "")
        setEnabled(cfg.enabled)
        setNotify({
          paymentSuccess: cfg.notifyPaymentSuccess,
          paymentFailed: cfg.notifyPaymentFailed,
          paymentExpired: cfg.notifyPaymentExpired,
          routerOffline: cfg.notifyRouterOffline,
          routerOnline: cfg.notifyRouterOnline ?? true,
        })
        setIntervalMin(cfg.routerCheckIntervalMinutes)
        setTemplates({ ...cfg.templates })
      } catch {
        toast.error("Gagal memuat konfigurasi Telegram")
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleSave = async () => {
    if (!botToken.trim() || !chatId.trim()) {
      toast.error("Bot Token dan Chat ID wajib diisi")
      return
    }
    setSaving(true)
    try {
      await api.put("/telegram/config", {
        botToken: botToken.trim(),
        chatId: chatId.trim(),
        enabled,
        notifyPaymentSuccess: notify.paymentSuccess,
        notifyPaymentFailed: notify.paymentFailed,
        notifyPaymentExpired: notify.paymentExpired,
        notifyRouterOffline: notify.routerOffline,
        notifyRouterOnline: notify.routerOnline,
        routerCheckIntervalMinutes: intervalMin,
        templates,
      })
      if (enabled) {
        toast.success("Konfigurasi Telegram disimpan", {
          description: "Notifikasi aktif dan akan dikirim ke chat tujuan.",
        })
      } else {
        // Peringatan eksplisit — master switch off = SEMUA notif tidak terkirim
        // (test bot tetap bisa jalan, ini yang sering bikin terkecoh).
        toast.warning("Tersimpan, tapi notifikasi NONAKTIF", {
          description:
            "Saklar 'Notifikasi Aktif' masih OFF — tidak ada notif yang dikirim. Nyalakan saklar lalu simpan lagi.",
          duration: 10000,
        })
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? "Gagal menyimpan konfigurasi"
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (type: NotifyType | "bot") => {
    setTesting(type)
    try {
      const { data } = await api.post("/telegram/test", {
        botToken: botToken.trim() || undefined,
        chatId: chatId.trim() || undefined,
        type: type === "bot" ? undefined : type,
      })
      const res = data.data as { ok: boolean; botName?: string; step?: string; error?: string; message?: string }
      if (res.ok) {
        if (res.step === "bot") {
          toast.success(`Bot valid: @${res.botName}`, { description: res.message })
        } else {
          toast.success(`Pesan uji "${type}" terkirim ke Telegram`)
        }
      } else {
        toast.error(`Test gagal: ${res.error ?? "tidak diketahui"}`)
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? "Gagal menguji koneksi"
      toast.error(msg)
    } finally {
      setTesting(null)
    }
  }

  const resetTemplate = (key: TemplateKey) => {
    if (!config) return
    setTemplates((prev) => ({ ...prev, [key]: config.defaults.templates[key] }))
    toast.info("Template dikembalikan ke default. Klik Simpan untuk menerapkan.")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", to: "/admin" }, { label: "Telegram" }]}
        title="Telegram Admin"
        description="Notifikasi transaksi (sukses/gagal/kadaluarsa) & status Mikrotik ke bot Telegram."
        actions={
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="mr-1.5 size-4 animate-spin" />
                Menyimpan…
              </>
            ) : (
              "Simpan Konfigurasi"
            )}
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Konfigurasi Bot */}
        <Card className="border-border lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Bot className="size-4 text-muted-foreground" />
              Konfigurasi Bot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="botToken">Bot Token</Label>
              <div className="flex gap-2">
                <Input
                  id="botToken"
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:AAF...(dari @BotFather)"
                  className="flex-1 font-mono"
                />
                <Button
                  variant="outline"
                  onClick={() => handleTest("bot")}
                  disabled={testing !== null || !botToken.trim()}
                >
                  {testing === "bot" ? (
                    <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-1.5 size-3.5" />
                  )}
                  Cek Bot
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Buat bot lewat <span className="font-medium">@BotFather</span> di Telegram, lalu salin token-nya ke sini.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="chatId">Chat ID Tujuan</Label>
              <Input
                id="chatId"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="-1001234567890 (grup) atau 123456789 (pribadi)"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Tambahkan bot ke grup internal, kirim pesan apa pun di grup, lalu ambil ID lewat
                <span className="font-medium"> https://api.telegram.org/bot&lt;token&gt;/getUpdates</span> (cari field
                <span className="font-mono"> chat.id</span>).
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Notifikasi Aktif</Label>
                <p className="text-xs text-muted-foreground">
                  Saklar utama — matikan untuk menghentikan semua kiriman Telegram.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={(v) => setEnabled(v === true)} />
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-sm font-medium">Jenis Notifikasi</Label>
              {(
                [
                  ["paymentSuccess", "Transaksi Sukses"],
                  ["paymentFailed", "Transaksi Gagal"],
                  ["paymentExpired", "Transaksi Kadaluarsa"],
                  ["routerOffline", "Mikrotik Offline"],
                  ["routerOnline", "Mikrotik Online Kembali"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{notifyTypeMeta[key].description}</p>
                  </div>
                  <Switch
                    checked={notify[key]}
                    onCheckedChange={(v) => setNotify((prev) => ({ ...prev, [key]: v === true }))}
                  />
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label htmlFor="interval">Interval Cek Mikrotik (menit)</Label>
              <Input
                id="interval"
                type="number"
                min={1}
                max={1440}
                value={intervalMin}
                onChange={(e) => setIntervalMin(Math.max(1, Number(e.target.value) || 1))}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Monitor akan ping tiap router (REST <span className="font-mono">/system/identity</span>) setiap N menit.
                Notif offline dikirim sekali per episode offline. <strong>Default: 5 menit.</strong> Perubahan diterapkan pada siklus berikutnya (tanpa restart).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Panel status */}
        <div className="flex flex-col gap-5">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                {config?.configured ? (
                  <>
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    <span className="text-sm">Bot terkonfigurasi</span>
                  </>
                ) : (
                  <>
                    <XCircle className="size-4 text-rose-500" />
                    <span className="text-sm">Belum dikonfigurasi</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {enabled ? (
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    Notifikasi Aktif
                  </Badge>
                ) : (
                  <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                    Notifikasi Nonaktif — tidak ada kiriman
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Notif sukses dikirim untuk SEMUA transaksi (QRIS & Tunai dari admin, webhook gateway).
                Notif gagal/kadaluarsa dari webhook payment gateway (SumoPod).
              </p>
              <Button variant="outline" className="w-full" onClick={() => handleTest("paymentSuccess")} disabled={testing !== null}>
                {testing === "paymentSuccess" ? (
                  <RefreshCw className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1.5 size-3.5" />
                )}
                Kirim Pesan Uji
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Braces className="size-4 text-muted-foreground" />
                Variabel Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-xs">
                {[
                  ["{nama}", "Nama pelanggan"],
                  ["{paket}", "Nama paket"],
                  ["{kode}", "Kode payment/invoice"],
                  ["{jumlah}", "Jumlah pembayaran"],
                  ["{metode}", "Metode (QRIS/Tunai)"],
                  ["{tanggal}", "Waktu kejadian"],
                  ["{router}", "Nama router (offline)"],
                  ["{host}", "Host router (offline)"],
                ].map(([variable, description]) => (
                  <div key={variable} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-2.5 py-2">
                    <code className="font-medium text-primary">{variable}</code>
                    <span className="text-right text-muted-foreground">{description}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Template Pesan */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Template Pesan</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="paymentSuccess" className="w-full">
            <TabsList>
              {(Object.keys(notifyTypeMeta) as TemplateKey[]).map((key) => (
                <TabsTrigger key={key} value={key}>
                  {notifyTypeMeta[key].label}
                </TabsTrigger>
              ))}
            </TabsList>
            {(Object.keys(notifyTypeMeta) as TemplateKey[]).map((key) => (
              <TabsContent key={key} value={key} className="mt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{notifyTypeMeta[key].description}</p>
                    <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={() => resetTemplate(key)}>
                      <RotateCcw className="mr-1 size-3" />
                      Default
                    </Button>
                  </div>
                  <Textarea
                    rows={6}
                    value={templates[key] ?? ""}
                    onChange={(e) => setTemplates((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={config?.defaults.templates[key] ?? ""}
                  />
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Pratinjau</Label>
                    <div className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 text-sm leading-relaxed">
                      {(templates[key] ?? "").trim() ? (
                        renderWhatsApp(
                          templates[key].replace(/\{nama\}/g, "Budi Santoso").replace(/\{paket\}/g, "Paket 20 Mbps").replace(/\{kode\}/g, "PY-1024").replace(/\{jumlah\}/g, "250000").replace(/\{metode\}/g, "QRIS").replace(/\{tanggal\}/g, new Date().toLocaleString("id-ID")).replace(/\{router\}/g, "Mikrotik-Core-01").replace(/\{host\}/g, "192.168.1.1:8728"),
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">Pesan akan tampil di sini…</span>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

export default TelegramSettingsPage
