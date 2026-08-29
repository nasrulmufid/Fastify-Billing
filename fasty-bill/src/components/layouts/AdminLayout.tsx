import { NavLink, Outlet, useNavigate } from "react-router-dom"
import {
  Search,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Menu,
  Users,
  LayoutDashboard,
  Package,
  Router,
  FileText,
  CreditCard,
  Ticket,
  Wifi,
  BellRing,
  Settings,
  Activity,
  MessageCircle,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useAuthStore, useSidebarStore } from "@/store/useAppStore"
import { useCustomers } from "@/lib/customerStore"

type NavItem = {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

type NavGroup = {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: "Utama",
    items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "PPPoE",
    items: [
      { to: "/admin/pppoe/customers", label: "Pelanggan", icon: Users },
      { to: "/admin/pppoe/packages", label: "Paket PPPoE", icon: Package },
    ],
  },
  {
    title: "Transaksi",
    items: [
      { to: "/admin/invoices", label: "Invoice", icon: FileText },
      { to: "/admin/payments", label: "Pembayaran", icon: CreditCard },
    ],
  },
  {
    title: "Lainnya",
    items: [
      { to: "/admin/network", label: "Jaringan", icon: Wifi },
      { to: "/admin/notifications", label: "Notifikasi", icon: BellRing },
      { to: "/admin/tickets", label: "Tiket", icon: Ticket },
      { to: "/admin/activity-log", label: "Log Aktivitas", icon: Activity },
      { to: "/admin/settings", label: "Pengaturan", icon: Settings },
      { to: "/admin/wa-gateway", label: "WA Gateway", icon: MessageCircle },
    ],
  },
]

function NavGroupSection({
  group,
  collapsed,
  onNavigate,
}: {
  group: NavGroup
  collapsed: boolean
  onNavigate: () => void
}) {
  const [open, setOpen] = useState(true)

  // Icon-only mode: render items flat, group headers hidden
  if (collapsed) {
    return (
      <div className="space-y-1">
        {group.items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/admin"}
            onClick={onNavigate}
            title={item.label}
            className={({ isActive }) =>
              cn(
                "flex items-center justify-center rounded-lg px-2 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
          </NavLink>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
      >
        {group.title}
        <ChevronUp
          className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="space-y-0.5">
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin"}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- initial notifications (kosong — dimuat dari API) ---------- */
const mockNotifications: NotificationItem[] = []

export function AdminLayout() {
  const { sidebarOpen, setSidebarOpen, toggleSidebar, sidebarCollapsed, toggleSidebarCollapsed } =
    useSidebarStore()
  const { user, logout } = useAuthStore()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const customers = useCustomers()
  const navigate = useNavigate()

  const unreadCount = mockNotifications.filter((n) => n.unread).length

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return customers
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 6)
  }, [customers, searchQuery])

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchQuery("")
  }

  const goToCustomer = (id: string) => {
    navigate(`/admin/customers/${id}`)
    closeSearch()
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* ===== Mobile overlay ===== */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ===== Sidebar ===== */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card transition-[width,transform] duration-300",
          sidebarCollapsed ? "w-16" : "w-72",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex h-16 items-center gap-3",
            sidebarCollapsed ? "justify-center px-0" : "px-6",
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground text-sm">
            RB
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">RTRW Billing</p>
              <p className="text-xs text-muted-foreground">Admin Dashboard</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Navigation */}
        <ScrollArea className={cn("min-h-0 flex-1 py-4", sidebarCollapsed ? "px-2" : "px-3")}>
          <nav className={cn("space-y-4", sidebarCollapsed && "space-y-1")}>
            {navGroups.map((group) => (
              <NavGroupSection
                key={group.title}
                group={group}
                collapsed={sidebarCollapsed}
                onNavigate={() => setSidebarOpen(false)}
              />
            ))}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-border p-3">
          {!sidebarCollapsed && (
            <div className="mb-3 rounded-xl border border-border/70 bg-background/80 p-3 text-xs">
              <p className="font-medium">Mode operasional</p>
              <p className="mt-1 text-muted-foreground">
                Billing, pembayaran, tiket, dan jaringan terpusat.
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn("w-full", sidebarCollapsed && "h-9 w-9 justify-center px-0")}
            onClick={toggleSidebarCollapsed}
            aria-label={sidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Ciutkan</span>
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* ===== Main content ===== */}
      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-1 flex-col transition-[padding] duration-300",
          sidebarCollapsed ? "lg:pl-16" : "lg:pl-72",
        )}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-sm sm:px-6">
          {/* Hamburger — mobile: overlay, desktop: collapse sidebar */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 lg:hidden"
            onClick={toggleSidebar}
            aria-label="Buka sidebar"
          >
            <Menu className="size-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-10 w-10 lg:inline-flex"
            onClick={toggleSidebarCollapsed}
            aria-label="Ciutkan sidebar"
          >
            <Menu className="size-6" />
          </Button>

          {/* Global search — container lebar tetap agar layout tidak bergeser
              saat dibuka (desktop), sedangkan di mobile memuai penuh. */}
          <div
            className={cn(
              "relative flex items-center",
              searchOpen ? "w-full flex-1" : "",
              "sm:w-56 sm:flex-none lg:w-64",
            )}
          >
            {searchOpen ? (
              <div className="relative flex w-full items-center">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama pelanggan..."
                  className="h-9 w-full pl-9 pr-9"
                  onBlur={closeSearch}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") closeSearch()
                    else if (e.key === "Enter" && searchResults.length > 0) {
                      goToCustomer(searchResults[0].id)
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={closeSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="Tutup pencarian"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center p-0 sm:w-full sm:justify-start sm:px-3"
                onClick={() => setSearchOpen(true)}
                aria-label="Cari nama pelanggan"
              >
                <Search className="h-4 w-4 shrink-0 sm:mr-2" />
                <span className="hidden truncate text-muted-foreground sm:inline">Cari nama pelanggan…</span>
              </Button>
            )}

            {searchOpen && searchQuery.trim() !== "" && (
              <div className="absolute left-0 top-full z-50 mt-1.5 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                <ScrollArea className="max-h-72">
                  {searchResults.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">
                      Tidak ada pelanggan dengan nama &ldquo;{searchQuery.trim()}&rdquo;.
                    </p>
                  ) : (
                    searchResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => goToCustomer(c.id)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted"
                      >
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                            {c.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{c.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {c.code} · {c.packageName}
                          </p>
                        </div>
                        <Badge
                          className={`text-xs font-medium capitalize ${
                            c.status === "Active"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                          }`}
                        >
                          {c.status === "Active"
                            ? "Aktif"
                            : "Isolir"}
                        </Badge>
                      </button>
                    ))
                  )}
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Spacer — hanya desktop agar notif & profil tetap di kanan */}
          <div className="hidden flex-1 sm:block" />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative h-10 w-10" aria-label="Notifikasi" />}>
              <Bell className="size-6" />
              {unreadCount > 0 && (
                <Badge className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] text-white">
                  {unreadCount}
                </Badge>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifikasi</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <ScrollArea className="max-h-72">
                {mockNotifications.map((n) => (
                  <DropdownMenuItem key={n.id} className="flex cursor-pointer flex-col items-start gap-0.5 py-3">
                    <div className="flex w-full items-center gap-2">
                      <span className="text-sm font-medium">{n.title}</span>
                      {n.unread && <span className="ml-auto h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{n.desc}</p>
                    <p className="text-[10px] text-muted-foreground">{n.time}</p>
                  </DropdownMenuItem>
                ))}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User profile */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 h-9 px-2 rounded-md hover:bg-muted transition-colors outline-none">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                    {user?.name?.charAt(0) ?? "A"}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-medium leading-none">{user?.name ?? "Admin"}</p>
                  <p className="text-xs text-muted-foreground">{user?.role ?? "Super Admin"}</p>
                </div>
                <ChevronDown className="ml-1 h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium">{user?.name ?? "Admin"}</p>
                <p className="text-xs text-muted-foreground">{user?.email ?? "admin@rtrw.net"}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/admin/settings")}>
                My Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-rose-600 focus:text-rose-600"
                onClick={() => {
                  logout()
                  navigate("/login")
                }}
              >
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
