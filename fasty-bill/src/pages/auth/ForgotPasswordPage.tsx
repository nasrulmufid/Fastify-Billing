import { useState, type FormEvent } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Loader2, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import api from "@/lib/axios"
import { toast } from "sonner"

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    api
      .post("/auth/forgot-password", { email: email.trim() })
      .then(() => {
        setLoading(false)
        toast.success("Instruksi reset password terkirim ke email Anda.")
      })
      .catch(() => {
        setLoading(false)
        toast.error("Gagal mengirim instruksi. Periksa email Anda.")
      })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-bold text-primary-foreground">
            RB
          </div>
          <div>
            <p className="text-sm font-semibold">RTRW Billing</p>
            <p className="text-xs text-muted-foreground">Admin Dashboard</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold tracking-tight">Atur ulang akses akun</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Masukkan email Anda dan kami akan kirimkan instruksi untuk mengatur ulang password.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="fp-email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fp-email"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@rtrw.net"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 pl-9"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-10 w-full text-sm [&_svg:not([class*='size-'])]:size-4"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Mengirim...
                </>
              ) : (
                "Kirim instruksi"
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            Kembali ke login
          </Link>
        </p>
      </div>
    </div>
  )
}
