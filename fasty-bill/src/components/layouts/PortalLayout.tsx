import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom"
import { Home, FileText, CreditCard, Ticket, User, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useCustomerStore } from "@/store/customerStore"

const portalNav = [
  { to: "/portal", label: "Beranda", icon: Home, end: true },
  { to: "/portal/invoices", label: "Tagihan", icon: FileText },
  { to: "/portal/payments", label: "Bayar", icon: CreditCard },
  { to: "/portal/tickets", label: "Tiket", icon: Ticket },
  { to: "/portal/account", label: "Akun", icon: User },
]

export function PortalLayout() {
  const navigate = useNavigate()
  const isAuthenticated = useCustomerStore((s) => s.isAuthenticated)
  const logout = useCustomerStore((s) => s.logout)

  // Wajib login customer — jika belum, arahkan ke halaman login portal.
  if (!isAuthenticated) {
    return <Navigate to="/portal/login" replace />
  }

  const handleLogout = () => {
    logout()
    navigate("/portal/login")
  }

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Kolom selebar ponsel — di desktop tampak seperti frame HP */}
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col border-x border-border bg-background shadow-2xl">
        {/* ===== Header ringkas ===== */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                RB
              </div>
              <div>
                <p className="text-sm leading-tight font-semibold">RTRW Billing</p>
                <p className="text-[10px] text-muted-foreground">Portal Pelanggan</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label="Keluar"
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        {/* ===== Konten ===== */}
        <main className="flex-1 px-4 py-5 pb-24">
          <Outlet />
        </main>

        {/* ===== Bottom navigation (tab bar ala aplikasi mobile) ===== */}
        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="grid grid-cols-5">
            {portalNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                <item.icon className="size-5" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
