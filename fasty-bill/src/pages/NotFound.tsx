import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="text-7xl font-bold text-primary/40">404</p>
      <h1 className="text-2xl font-semibold">Halaman tidak ditemukan</h1>
      <p className="max-w-md text-muted-foreground">
        Halaman yang Anda cari mungkin sudah dipindahkan atau belum tersedia.
      </p>
      <div className="mt-2 flex gap-3">
        <Link to="/portal"><Button>Portal pelanggan</Button></Link>
        <Link to="/admin"><Button variant="outline">Dashboard admin</Button></Link>
      </div>
    </div>
  )
}
