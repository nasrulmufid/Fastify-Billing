import { useEffect, useState } from "react"
import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  CalendarPlus,
  Edit,
  Eye,
  EyeOff,
  FileDown,
  LoaderCircle,
  MapPin,
  Mail,
  Phone,
  Wallet,
  Wifi,
  WifiOff,
} from "lucide-react"
import { toast } from "sonner"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CustomerFormDialog } from "@/components/customers/CustomerFormDialog"
import api from "@/lib/axios"
import { useAuthStore } from "@/store/useAppStore"
import { useCustomerActions } from "@/lib/customerStore"
import { expiryToInputValue, inputToExpiry } from "@/lib/dateUtils"
import { formatPrice } from "@/lib/paymentData"
import { Banknote } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

/* ================================================================
   Helpers
   ================================================================ */

const statusVariant: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  Isolated: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  Pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
}

const statusLabel: Record<string, string> = {
  Active: "Aktif",
  Isolated: "Isolir",
  Pending: "Pending",
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  return digits.startsWith("62") ? digits : "62" + digits.replace(/^0/, "")
}

function mapsUrl(gps: string): string {
  return `https://www.google.com/maps?q=${gps.replace(/\s/g, "")}`
}

/* ================================================================
   Detail Page
   ================================================================ */

interface Customer {
  id: string
  code: string
  name: string
  email: string
  phone: string
  address: string
  packageName: string
  status: "Active" | "Isolated" | "Pending"
  ipAddress: string
  router: string
  pppoeUsername: string
  pppoePassword: string
  loginUsername: string
  loginPassword: string
  odpId: string
  gps: string
  lastPayment: string
  expiryDate: string
  joinDate: string
}

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const { token } = useAuthStore()
  const navigate = useNavigate()
  const { extendExpiry, setExpiry, setStatus } = useCustomerActions()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const isEditRoute = location.pathname.endsWith("/edit")
  const [editOpen, setEditOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [isolateOpen, setIsolateOpen] = useState(false)
  const [extendOpen, setExtendOpen] = useState(false)
  const [extendDate, setExtendDate] = useState<string>("")
  const [extendLoading, setExtendLoading] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [payInvoice, setPayInvoice] = useState<any | null>(null)
  const [cashOpen, setCashOpen] = useState(false)
  const [packages, setPackages] = useState<any[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null)
  const [cashLoading, setCashLoading] = useState(false)

  // Fetch customer data from backend API
  useEffect(() => {
    if (!id || !token) return

    setLoading(true)
    setError(null)

    Promise.all([
      api.get(`/customers/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
      api.get(`/invoices?customerId=${id}`, { headers: { Authorization: `Bearer ${token}` } }),
      api.get("/tickets", { headers: { Authorization: `Bearer ${token}` } }),
    ])
      .then(([custRes, invRes, tickRes]) => {
        setCustomer(custRes.data.data)
        setInvoices(invRes.data.data || [])
        setTickets((tickRes.data.data || []).filter((ticket: { customerId: number | string }) => String(ticket.customerId) === id))
        setLoading(false)
      })
      .catch((err) => {
        console.error("Gagal fetch customer:", err)
        setError("Pelanggan tidak ditemukan atau Anda tidak memiliki akses.")
        setLoading(false)
      })
  }, [id, token])

  // Buka sheet edit otomatis saat akses /edit (deep-link)
  useEffect(() => {
    if (isEditRoute && customer) setEditOpen(true)
  }, [isEditRoute, customer])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-label="Memuat data pelanggan">
        <LoaderCircle className="size-8 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Memuat data pelanggan</span>
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-lg font-semibold text-muted-foreground">{error || "Pelanggan tidak ditemukan"}</p>
        <NavLink to="/admin/pppoe/customers" className="text-sm text-primary underline">
          Kembali ke daftar pelanggan
        </NavLink>
      </div>
    )
  }

  const isIsolated = customer.status === "Isolated"

  const handleExtendMonth = async () => {
    if (!customer) return
    setExtendLoading(true)
    try {
      await extendExpiry(customer.id, 1)
      toast.success("Masa aktif diperpanjang", {
        description: `Berlaku hingga +1 bulan. Pelanggan diaktifkan (unisolir) di Mikrotik.`,
      })
      setExtendOpen(false)
    } catch (err: any) {
      console.error("Gagal memperpanjang masa aktif:", err)
      toast.error("Gagal memperpanjang masa aktif", {
        description: err?.response?.data?.error?.message || "Terjadi kesalahan saat memperpanjang masa aktif.",
      })
    } finally {
      setExtendLoading(false)
    }
  }

  const handleExtendDate = async () => {
    if (!customer || !extendDate) return
    setExtendLoading(true)
    try {
      const newExpiry = inputToExpiry(extendDate)
      await setExpiry(customer.id, newExpiry)
      toast.success("Masa aktif diperbarui", {
        description: `${customer.name} berlaku hingga ${newExpiry}.`,
      })
      setExtendOpen(false)
    } catch (err: any) {
      console.error("Gagal mengubah masa aktif:", err)
      toast.error("Gagal mengubah masa aktif", {
        description: err?.response?.data?.error?.message || "Terjadi kesalahan saat mengubah masa aktif.",
      })
    } finally {
      setExtendLoading(false)
    }
  }

  const handleIsolate = async () => {
    if (!customer) return
    try {
      await setStatus(customer.id, isIsolated ? "Active" : "Isolated")
      toast.success(
        isIsolated ? "Koneksi diaktifkan kembali" : "Pelanggan diisolir",
        { description: isIsolated ? "Akses internet telah dipulihkan." : "Akses internet telah dinonaktifkan." }
      )
    } catch (err: any) {
      console.error("Gagal mengubah status koneksi:", err)
      toast.error("Gagal mengubah status koneksi", {
        description: err?.response?.data?.error?.message || "Terjadi kesalahan saat mengubah status koneksi.",
      })
    }
    setIsolateOpen(false)
  }

  const handleMarkPaid = async () => {
    if (!payInvoice) return
    try {
      await api.post(`/invoices/${payInvoice.id}/mark-paid`, { method: "Tunai" })
      // Note: backend completePaymentFlow sudah update expiry_at customer + status Active
      // Tidak perlu extendExpiry lagi di frontend (akan double extend)
      toast.success("Pembayaran tunai dicatat", {
        description: `${payInvoice.code} lunas — masa aktif ${customer.name} diperpanjang 1 bulan.`,
      })
      setPayOpen(false)
      setPayInvoice(null)
      // Refresh invoices
      const invRes = await api.get(`/invoices?customerId=${id}`, { headers: { Authorization: `Bearer ${token}` } })
      setInvoices(invRes.data.data || [])
    } catch (err: any) {
      console.error("Gagal memproses pembayaran:", err)
      toast.error("Gagal memproses pembayaran", {
        description: err?.response?.data?.error?.message || "Terjadi kesalahan saat menandai invoice lunas.",
      })
    }
  }

  const handleOpenCash = async () => {
    setCashLoading(true)
    try {
      const res = await api.get("/packages", { headers: { Authorization: `Bearer ${token}` } })
      setPackages((res.data.data || []).filter((p: any) => p.status === "Aktif"))
      setSelectedPackageId(null)
      setCashOpen(true)
    } catch (err: any) {
      console.error("Gagal memuat daftar paket:", err)
      toast.error("Gagal memuat daftar paket", {
        description: err?.response?.data?.error?.message || "Terjadi kesalahan saat memuat paket.",
      })
    } finally {
      setCashLoading(false)
    }
  }

  const handlePurchaseCash = async () => {
    if (!customer || !selectedPackageId) return
    setCashLoading(true)
    try {
      const res = await api.post(
        `/customers/${customer.id}/purchase-cash`,
        { packageId: selectedPackageId },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const pkg = packages.find((p) => p.id === selectedPackageId)
      toast.success("Order paket tunai dicatat", {
        description: `${customer.name} dipindah ke paket ${pkg?.name ?? ""} — lunas tunai, masa aktif +1 bulan & profile Mikrotik disinkron.`,
      })
      setCashOpen(false)
      setSelectedPackageId(null)
      // Refresh data pelanggan & invoice
      const [custRes, invRes] = await Promise.all([
        api.get(`/customers/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        api.get(`/invoices?customerId=${id}`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      setCustomer(custRes.data.data)
      setInvoices(invRes.data.data || [])
    } catch (err: any) {
      console.error("Gagal order paket tunai:", err)
      toast.error("Gagal order paket tunai", {
        description: err?.response?.data?.error?.message || "Terjadi kesalahan saat memproses order paket.",
      })
    } finally {
      setCashLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ---------- Breadcrumb ---------- */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink to="/admin">Dashboard</BreadcrumbLink>
            <BreadcrumbSeparator />
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbLink to="/admin/customers">Pelanggan</BreadcrumbLink>
            <BreadcrumbSeparator />
          </BreadcrumbItem>
          <BreadcrumbItem>
            <BreadcrumbPage>{customer.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* ---------- Header ---------- */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
          {/* Back button: baris sendiri di atas pada mobile, inline di desktop */}
          <Button variant="ghost" onClick={() => navigate("/admin/customers")} className="w-fit gap-1.5 px-2">
            <ArrowLeft className="size-4" />
            <span className="text-sm">Kembali</span>
          </Button>
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                {getInitials(customer.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{customer.name}</h1>
                <Badge className={`text-xs font-medium ${statusVariant[customer.status] ?? ""}`}>
                  {statusLabel[customer.status] ?? customer.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Edit Profil"
                  onClick={() => setEditOpen(true)}
                >
                  <Edit className="size-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{customer.code} · Bergabung {customer.joinDate}</p>
            </div>
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Button
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
            onClick={handleOpenCash}
            disabled={cashLoading}
          >
            <Banknote className="mr-1.5 size-4" />
            Terima Cash
          </Button>
          <Button
            variant="outline"
            className={isIsolated ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900/60"}
            onClick={() => setIsolateOpen(true)}
          >
            {isIsolated ? <Wifi className="mr-1.5 size-4" /> : <WifiOff className="mr-1.5 size-4" />}
            {isIsolated ? "Buka Isolir" : "Isolir Koneksi"}
          </Button>
        </div>
      </div>

      {/* ---------- Kartu Ringkasan (baris penuh) ---------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Identitas */}
        <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                Identitas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <a
                href={`https://wa.me/${waNumber(customer.phone)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Phone className="size-4 shrink-0 text-muted-foreground" />
                {customer.phone}
              </a>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                <span>{customer.email || "-"}</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-1">
                  <span>{customer.address}</span>
                  {customer.gps && (
                    <a
                      href={mapsUrl(customer.gps)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-fit items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <MapPin className="size-3" />
                      {customer.gps} — Buka peta
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Informasi Singkat */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                Informasi Singkat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Paket</span>
                <span className="font-medium">{customer.packageName}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">IP Address</span>
                <span className="font-mono text-xs">{customer.ipAddress}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Router / Node</span>
                <span className="font-medium">{customer.router}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">ODP / Port</span>
                <span className="font-medium">{customer.odpId || "-"}</span>
              </div>
            </CardContent>
          </Card>
      </div>

      {/* ---------- Tabs: menu di atas, konten di bawah ---------- */}
      <Card className="border-border">
        <CardContent className="p-0">
          <Tabs defaultValue="connection" className="w-full gap-0">
              <div className="overflow-x-auto border-b border-border px-4 pt-4 sm:px-6 [scrollbar-width:none]">
                <TabsList variant="line" className="h-auto min-w-max gap-0 p-0">
                  <TabsTrigger
                    value="connection"
                    className="rounded-b-none px-3 text-sm after:hidden whitespace-nowrap data-active:border-b-2 data-active:border-b-primary! data-active:bg-transparent"
                  >
                    Koneksi &amp; Jaringan
                  </TabsTrigger>
                  <TabsTrigger
                    value="invoices"
                    className="rounded-b-none px-3 text-sm after:hidden whitespace-nowrap data-active:border-b-2 data-active:border-b-primary! data-active:bg-transparent"
                  >
                    Riwayat Tagihan
                  </TabsTrigger>
                  <TabsTrigger
                    value="tickets"
                    className="rounded-b-none px-3 text-sm after:hidden whitespace-nowrap data-active:border-b-2 data-active:border-b-primary! data-active:bg-transparent"
                  >
                    Tiket Keluhan
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Tab: Koneksi & Jaringan */}
              <TabsContent value="connection" className="space-y-5 p-4 sm:p-6">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                  <div>
                    <p className="text-sm font-medium">Paket Layanan</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{customer.packageName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Router / Node</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{customer.router}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Username PPPoE</p>
                    <p className="mt-0.5 font-mono text-sm text-muted-foreground">{customer.pppoeUsername}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Password PPPoE</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-sm text-muted-foreground">
                        {showPassword ? customer.pppoePassword : "••••••••••"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                      >
                        {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Username Login (Portal)</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-sm text-muted-foreground">{customer.loginUsername}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Password Login (Portal)</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-sm text-muted-foreground">
                        {showLoginPassword ? customer.loginPassword : "••••••••••"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setShowLoginPassword((v) => !v)}
                        aria-label={showLoginPassword ? "Sembunyikan password login" : "Tampilkan password login"}
                      >
                        {showLoginPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">IP Address</p>
                    <p className="mt-0.5 font-mono text-sm text-muted-foreground">{customer.ipAddress}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">ID ODP / Port</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{customer.odpId || "-"}</p>
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Masa Aktif</p>
                    <p className={`mt-0.5 text-sm font-semibold ${customer.status === "Active" ? "text-emerald-600" : "text-rose-600"}`}>
                      {customer.expiryDate}
                    </p>
                  </div>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => setExtendOpen(true)}>
                    <CalendarPlus className="mr-1.5 size-4" />
                    Perpanjang Manual
                  </Button>
                </div>
              </TabsContent>

              {/* Tab: Riwayat Tagihan */}
              <TabsContent value="invoices" className="p-4 sm:p-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">No Invoice</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Tanggal Dibuat</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Jatuh Tempo</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Nominal</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead className="w-[60px] text-xs uppercase tracking-wider text-muted-foreground">
                        <span className="sr-only">Aksi</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="text-sm font-medium">{inv.code}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{inv.period}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{inv.due}</TableCell>
                        <TableCell className="text-sm">{inv.amount}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              inv.status === "Paid"
                                ? "bg-emerald-100 text-emerald-800 text-xs dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-amber-100 text-amber-800 text-xs dark:bg-amber-900/40 dark:text-amber-300"
                            }
                          >
                            {inv.status === "Paid" ? "Lunas" : "Belum Bayar"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Unduh PDF ${inv.id}`}
                              onClick={() => toast.info(`Mengunduh PDF ${inv.id}…`)}
                            >
                              <FileDown className="size-3.5" />
                            </Button>
                            {inv.status === "Unpaid" && (
                              <div className="group relative">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                                  onClick={() => {
                                    setPayInvoice(inv)
                                    setPayOpen(true)
                                  }}
                                >
                                  <Wallet className="size-3.5" />
                                </Button>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                                  Terima Pembayaran Cash
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Tab: Tiket Keluhan */}
              <TabsContent value="tickets" className="p-4 sm:p-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">No Tiket</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Judul</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-muted-foreground">Tanggal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="text-sm font-medium">{ticket.code}</TableCell>
                        <TableCell className="text-sm">{ticket.title}</TableCell>
                        <TableCell>
                          <Badge
                            variant={ticket.status === "Open" ? "outline" : "secondary"}
                            className="text-xs"
                          >
                            {ticket.status === "Open" ? "Open" : "Resolved"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ticket.date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

      {/* ---------- Dialog Edit ---------- */}
      <CustomerFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={customer as any}
      />

      {/* ---------- Konfirmasi Isolir ---------- */}
      <AlertDialog open={isolateOpen} onOpenChange={setIsolateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">
              {isIsolated ? "Aktifkan kembali koneksi?" : "Isolir pelanggan?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {isIsolated
                ? `Koneksi internet ${customer.name} akan diaktifkan kembali secara otomatis di Mikrotik.`
                : `Koneksi internet ${customer.name} akan dinonaktifkan (isolir) sampai pembayaran dilakukan.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleIsolate}
              className={isIsolated ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
            >
              {isIsolated ? "Ya, Aktifkan" : "Ya, Isolir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---------- Dialog Perpanjang Manual ---------- */}
      <Dialog
        open={extendOpen}
        onOpenChange={(open) => {
          setExtendOpen(open)
          if (open && customer) setExtendDate(expiryToInputValue(customer.expiryDate))
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">Perpanjang Masa Aktif</DialogTitle>
            <DialogDescription className="text-sm">
              Pilih untuk memperpanjang 1 bulan otomatis, atau tentukan tanggal berakhir sendiri untuk {customer.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Masa aktif saat ini</p>
              <p className="text-sm font-medium">{customer.expiryDate}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="extend-date">Pilih tanggal berakhir</Label>
              <Input
                id="extend-date"
                type="date"
                value={extendDate}
                onChange={(e) => setExtendDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleExtendDate}
              disabled={extendLoading || !extendDate}
            >
              <CalendarPlus className="mr-1.5 size-4" />
              Terapkan Tanggal
            </Button>
            <Button
              className="w-full bg-primary sm:w-auto"
              onClick={handleExtendMonth}
              disabled={extendLoading}
            >
              <CalendarPlus className="mr-1.5 size-4" />
              Perpanjang 1 Bulan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Dialog Terima Pembayaran Cash ---------- */}
      <AlertDialog open={payOpen} onOpenChange={setPayOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Terima Pembayaran Cash?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {payInvoice
                ? `Pembayaran tunai untuk invoice ${payInvoice.code} sebesar ${formatPrice(payInvoice.amount)} akan dicatat. Masa aktif ${customer.name} akan diperpanjang 1 bulan.`
                : "Pilih invoice yang akan dibayar."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkPaid} className="bg-primary">
              <Banknote className="mr-1.5 size-4" />
              Terima Pembayaran
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ---------- Dialog Terima Cash (Order Paket Baru) ---------- */}
      <Dialog open={cashOpen} onOpenChange={setCashOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Terima Cash — Order Paket Baru</DialogTitle>
            <DialogDescription className="text-sm">
              Pilih paket untuk {customer.name}. Sistem akan mencatat order, melunasi tunai, memperpanjang masa aktif 1 bulan, dan menyinkron profile Mikrotik.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {packages.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada paket aktif.</p>
            ) : (
              packages.map((pkg) => {
                const selected = selectedPackageId === pkg.id
                return (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedPackageId(pkg.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left transition-colors ${
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{pkg.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {pkg.downloadSpeed}/{pkg.uploadSpeed} Mbps
                        {pkg.description ? ` · ${pkg.description}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">{formatPrice(pkg.price)}</span>
                  </button>
                )
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCashOpen(false)} disabled={cashLoading}>
              Batal
            </Button>
            <Button
              onClick={handlePurchaseCash}
              disabled={cashLoading || !selectedPackageId}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {cashLoading ? (
                <LoaderCircle className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Banknote className="mr-1.5 size-4" />
              )}
              Konfirmasi &amp; Catat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ================================================================
   Layout
   ================================================================ */

export function CustomerLayout() {
  return <CustomerDetailPage />
}
