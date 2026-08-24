import { useEffect, useState } from "react"
import { NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  CalendarPlus,
  Edit,
  Eye,
  EyeOff,
  FileDown,
  MapPin,
  Mail,
  Phone,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useCustomer,
  useCustomerActions,
} from "@/lib/customerStore"
import { CustomerFormDialog } from "@/components/customers/CustomerFormDialog"

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

const invoices = [
  { id: "INV-1042", created: "01 Agu 2026", due: "01 Sep 2026", amount: "Rp 250.000", status: "Unpaid" as const },
  { id: "INV-1039", created: "01 Jul 2026", due: "01 Agu 2026", amount: "Rp 250.000", status: "Paid" as const },
  { id: "INV-1036", created: "01 Jun 2026", due: "01 Jul 2026", amount: "Rp 250.000", status: "Paid" as const },
]

const tickets = [
  { id: "TKT-42", subject: "Internet lambat di malam hari", status: "Open" as const, date: "01 Agu 2026" },
  { id: "TKT-27", subject: "Permintaan ganti paket", status: "Resolved" as const, date: "10 Jul 2026" },
  { id: "TKT-11", subject: "Gangguan koneksi putus-putus", status: "Resolved" as const, date: "20 Jun 2026" },
]

/* ================================================================
   Detail Page
   ================================================================ */

function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const customer = useCustomer(id)
  const { setStatus, extendExpiry } = useCustomerActions()
  const navigate = useNavigate()

  const isEditRoute = location.pathname.endsWith("/edit")
  const [editOpen, setEditOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [isolateOpen, setIsolateOpen] = useState(false)
  const [extendOpen, setExtendOpen] = useState(false)

  // Buka sheet edit otomatis saat akses /edit (deep-link)
  useEffect(() => {
    if (isEditRoute) setEditOpen(true)
  }, [isEditRoute])

  if (!customer) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-lg font-semibold text-muted-foreground">Pelanggan tidak ditemukan</p>
        <NavLink to="/admin/customers" className="text-sm text-primary underline">
          Kembali ke daftar
        </NavLink>
      </div>
    )
  }

  const isIsolated = customer.status === "Isolated"

  const handleIsolate = () => {
    setStatus(customer.id, isIsolated ? "Active" : "Isolated")
    toast.success(
      isIsolated ? "Koneksi diaktifkan kembali" : "Pelanggan diisolir",
      { description: isIsolated ? "Akses internet telah dipulihkan." : "Akses internet telah dinonaktifkan." }
    )
    setIsolateOpen(false)
  }

  const handleExtend = () => {
    extendExpiry(customer.id, 1)
    toast.success("Masa aktif diperpanjang", {
      description: `Berlaku hingga +1 bulan. Pelanggan diaktifkan (unisolir) di Mikrotik.`,
    })
    setExtendOpen(false)
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
              </div>
              <p className="text-sm text-muted-foreground">{customer.code} · Bergabung {customer.joinDate}</p>
            </div>
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Edit className="mr-1.5 size-4" />
            Edit Profil
          </Button>
          <Button
            variant="outline"
            className={isIsolated ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300 dark:hover:bg-rose-900/60"}
            onClick={() => setIsolateOpen(true)}
          >
            {isIsolated ? <Wifi className="mr-1.5 size-4" /> : <WifiOff className="mr-1.5 size-4" />}
            {isIsolated ? "Aktifkan Koneksi" : "Isolir Koneksi"}
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
                        <TableCell className="text-sm font-medium">{inv.id}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{inv.created}</TableCell>
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
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Unduh PDF ${inv.id}`}
                            onClick={() => toast.info(`Mengunduh PDF ${inv.id}…`)}
                          >
                            <FileDown className="size-3.5" />
                          </Button>
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
                        <TableCell className="text-sm font-medium">{ticket.id}</TableCell>
                        <TableCell className="text-sm">{ticket.subject}</TableCell>
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
        customer={customer}
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
      <AlertDialog open={extendOpen} onOpenChange={setExtendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Perpanjang Masa Aktif?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Masa aktif {customer.name} akan direset +1 bulan dan koneksi diaktifkan (unisolir) secara paksa di Mikrotik.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleExtend} className="bg-primary">
              <CalendarPlus className="mr-1.5 size-4" />
              Perpanjang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ================================================================
   Layout
   ================================================================ */

export function CustomerLayout() {
  return (
    <Routes>
      <Route index element={<CustomerDetailPage />} />
      <Route path="edit" element={<CustomerDetailPage />} />
    </Routes>
  )
}
