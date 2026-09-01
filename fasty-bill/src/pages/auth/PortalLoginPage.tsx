import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight, Eye, EyeOff, Loader2, Lock, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCustomerStore } from "@/store/customerStore"
import { toast } from "sonner"

export function PortalLoginPage() {
  const navigate = useNavigate()
  const login = useCustomerStore((s) => s.login)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")

    if (!username.trim() || !password) {
      setError("Username dan password wajib diisi.")
      return
    }

    setLoading(true)
    const ok = await login(username.trim(), password)
    setLoading(false)

    if (ok) {
      toast.success("Login berhasil, selamat datang!")
      navigate("/portal")
    } else {
      setError("Username atau password salah, atau akun tidak aktif.")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <img
            src="/fasty-bill-logo.svg"
            alt="Fasty Bill"
            className="mx-auto h-14 w-14 rounded-2xl shadow-lg"
          />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Portal Pelanggan</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Masuk untuk cek tagihan, bayar, dan ajukan tiket gangguan.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-600">
                {error}
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <Label htmlFor="portal-username">Username</Label>
              <div className="relative">
                <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="portal-username"
                  autoComplete="username"
                  placeholder="Masukkan username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-10 pl-9"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="portal-password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="portal-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 pr-10 pl-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Memeriksa…
                </>
              ) : (
                <>
                  Masuk
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

        </div>
      </div>
    </div>
  )
}
