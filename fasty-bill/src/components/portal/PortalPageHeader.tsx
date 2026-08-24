import { useNavigate } from "react-router-dom"
import { ChevronLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PortalPageHeaderProps {
  title: string
  subtitle?: string
  className?: string
}

/**
 * Header layar ala aplikasi mobile native:
 * tombol kembali (chevron kiri) + judul layar.
 * Kembali = pop stack navigasi; jika tidak ada riwayat, fallback ke Beranda.
 */
export function PortalPageHeader({ title, subtitle, className }: PortalPageHeaderProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    const state = window.history.state as { idx?: number } | null
    if (state && typeof state.idx === "number" && state.idx > 0) {
      navigate(-1)
    } else {
      navigate("/portal")
    }
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleBack}
        aria-label="Kembali"
        className="-ml-2 size-9 shrink-0 rounded-full text-foreground hover:bg-muted"
      >
        <ChevronLeft className="size-5" />
      </Button>
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold leading-snug">{title}</h2>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  )
}
