import { useState, useRef, useEffect } from "react"
import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import api from "@/lib/axios"

/* ------------------------------------------------------------
   Inline SVG icons – no dependency needed
   ------------------------------------------------------------ */

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16,17 21,12 16,7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

/* ------------------------------------------------------------
   Notification types & helpers
   ------------------------------------------------------------ */

type NotificationItem = {
  id: string
  code: string
  type: string
  customer: string
  channel: string
  status: string
  time: string
}

const activityMeta: Record<string, { label: string; color: string }> = {
  payment: { label: "Pembayaran diterima", color: "text-emerald-600 dark:text-emerald-400" },
  isolir: { label: "Isolir otomatis", color: "text-rose-600 dark:text-rose-400" },
  due: { label: "Tagihan jatuh tempo", color: "text-amber-600 dark:text-amber-400" },
  reminder: { label: "Pengingat tagihan", color: "text-sky-600 dark:text-sky-400" },
  ticket: { label: "Tiket diperbarui", color: "text-violet-600 dark:text-violet-400" },
  router: { label: "Gagal sinkron Mikrotik", color: "text-amber-600 dark:text-amber-400" },
}

/* ------------------------------------------------------------
   Navbar
   ------------------------------------------------------------ */

export function Navbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const [search, setSearch] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [notifCount, setNotifCount] = useState(0)

  /* close dropdowns on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  /* fetch real notifications */
  useEffect(() => {
    let cancelled = false
    api.get("/notifications").then(({ data }) => {
      if (cancelled) return
      const items = data.data ?? []
      setNotifications(items.slice(0, 5))
      setNotifCount(items.length)
    }).catch(() => {
      // ignore — keep defaults
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:px-6">
        {/* hamburger (mobile) */}
        <button
          onClick={onToggleSidebar}
          className="rounded-xl p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
          aria-label="Toggle sidebar"
        >
          <HamburgerIcon className="h-10 w-10" />
        </button>

        {/* search */}
        <div className="relative flex-1 sm:max-w-md">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pelanggan, invoice…"
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
          />
        </div>

        {/* spacer */}
        <div className="flex-1" />

        {/* notification */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((p) => !p)}
            className="relative rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Notifikasi"
          >
            <BellIcon className="h-5 w-5" />
            {notifCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {notifCount > 99 ? "99+" : notifCount}
              </span>
            )}
          </button>

          {/* notification dropdown */}
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card p-1 shadow-lg z-50">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">Notifikasi</div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Belum ada notifikasi
                  </div>
                ) : (
                  notifications.map((n) => {
                    const meta = activityMeta[n.type] ?? { label: n.type, color: "" }
                    return (
                      <div
                        key={n.id}
                        className="group flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm transition hover:bg-muted"
                      >
                        <div className={`mt-0.5 size-2 shrink-0 rounded-full ${meta.color.replace("text-", "bg-")}`} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-tight">{meta.label}</p>
                          <p className="truncate text-xs text-muted-foreground">{n.customer}</p>
                          <p className="text-[10px] text-muted-foreground/70">{n.time}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="border-t border-border pt-1">
                <NavLink
                  to="/admin/notifications"
                  onClick={() => setNotifOpen(false)}
                  className="block px-3 py-2 text-center text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  Lihat semua notifikasi
                </NavLink>
              </div>
            </div>
          )}
        </div>

        {/* avatar + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((p) => !p)}
            className="flex items-center gap-2 rounded-xl p-1.5 transition hover:bg-muted"
          >
            {/* avatar circle */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              A
            </div>
            <span className="hidden text-sm font-medium sm:inline">Admin</span>
            <ChevronDownIcon
              className={cn(
                "hidden h-3.5 w-3.5 text-muted-foreground transition sm:block",
                menuOpen && "rotate-180",
              )}
            />
          </button>

          {/* dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-card p-1 shadow-lg">
              <NavLink
                to="/admin/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <SettingsIcon className="h-4 w-4" />
                Pengaturan
              </NavLink>
              <button
                onClick={() => setMenuOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-600 transition hover:bg-rose-50"
              >
                <LogoutIcon className="h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
