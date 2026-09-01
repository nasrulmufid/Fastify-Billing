import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  ArrowRight,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Users,
  Wifi,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import api from "@/lib/axios"
import { useAuthStore } from "@/store/useAppStore"
import { toast } from "sonner"

const features = [
  {
    icon: Users,
    title: "Manajemen pelanggan & paket",
    desc: "Kelola data pelanggan, paket layanan, dan masa aktif dalam satu tempat.",
  },
  {
    icon: FileText,
    title: "Tagihan & pembayaran",
    desc: "Terbitkan invoice otomatis dan pantau pembayaran secara real-time.",
  },
  {
    icon: Wifi,
    title: "Pemantauan jaringan",
    desc: "Pantau router, isolasi pelanggan, dan distribusi paket dengan mudah.",
  },
]

const stats = [
  { value: "248", label: "Pelanggan aktif" },
  { value: "98%", label: "Pembayaran tepat waktu" },
  { value: "24/7", label: "Monitoring jaringan" },
]

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError("")

    const trimmed = email.trim()
    if (!trimmed || !password) {
      setError("Email dan password wajib diisi.")
      return
    }

    setLoading(true)
    // Autentikasi ke backend Fastify (fasty-api)
    api
      .post("/auth/login", { email: trimmed, password })
      .then(({ data }) => {
        const { token, user } = data.data
        login(user, token)
        setLoading(false)
        toast.success("Login berhasil, selamat datang!")
        navigate("/admin")
      })
      .catch((err) => {
        setLoading(false)
        const message =
          err?.response?.data?.error?.message ??
          "Tidak dapat terhubung ke server. Pastikan backend berjalan."
        setError(message)
      })
  }

  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-2">
      {/* ===== Panel brand (kiri) ===== */}
      <aside className="relative hidden overflow-hidden bg-secondary text-secondary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* dekorasi */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/40 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 -right-24 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />

        {/* brand */}
        <div className="relative">
          <div className="flex items-center gap-3">
            <img src="/fasty-bill-logo.svg" alt="Fasty Bill" className="h-11 w-11 rounded-xl shadow-lg" />
            <div>
              <p className="text-sm font-semibold">Fasty Bill</p>
              <p className="text-xs text-secondary-foreground/60">Admin Dashboard</p>
            </div>
          </div>

          <h1 className="mt-10 max-w-md text-3xl leading-tight font-bold tracking-tight xl:text-4xl">
            Kelola seluruh jaringan RT/RW dalam satu dashboard
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-secondary-foreground/70">
            Platform billing terpadu untuk pelanggan, tagihan, pembayaran, dan pemantauan
            jaringan — cepat, otomatis, dan terpusat.
          </p>

          {/* fitur */}
          <ul className="mt-10 space-y-5">
            {features.map((f) => (
              <li key={f.title} className="flex items-start gap-4">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <f.icon className="size-4.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-secondary-foreground/60">
                    {f.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* statistik */}
        <div className="relative mt-12 grid grid-cols-3 gap-6 border-t border-white/10 pt-6">
          {stats.map((s) => (
            <div key={s.label}>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="mt-0.5 text-xs text-secondary-foreground/60">{s.label}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* ===== Panel form (kanan) ===== */}
      <main className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-12">
        <div className="w-full max-w-md">
          {/* logo (mobile) */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/fasty-bill-logo.svg" alt="Fasty Bill" className="h-10 w-10 rounded-xl" />
            <div>
              <p className="text-sm font-semibold">Fasty Bill</p>
              <p className="text-xs text-muted-foreground">Admin Dashboard</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Selamat datang kembali</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Masuk untuk mengelola pelanggan, tagihan, pembayaran, dan jaringan Anda.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@rtrw.net"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 pl-9"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Lupa password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 pr-10 pl-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition hover:text-foreground"
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Ingat saya */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="login-remember"
                checked={remember}
                onCheckedChange={(c) => setRemember(c === true)}
              />
              <Label
                htmlFor="login-remember"
                className="text-sm font-normal text-muted-foreground"
              >
                Ingat saya
              </Label>
            </div>

            {/* Error */}
            {error && (
              <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-10 w-full text-sm [&_svg:not([class*='size-'])]:size-4"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  Masuk
                  <ArrowRight />
                </>
              )}
            </Button>

            {/* Info akun demo */}
            <div className="rounded-xl border border-dashed border-border bg-muted/50 px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <ShieldCheck className="size-3.5 text-primary" />
                Akun demo
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Email: <span className="font-mono">admin@rtrw.net</span> · Password:{" "}
                <span className="font-mono">admin123</span>
              </p>
            </div>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Bukan admin?{" "}
            <Link to="/portal/login" className="font-medium text-primary hover:underline">
              Masuk portal pelanggan
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
