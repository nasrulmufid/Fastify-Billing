/**
 * Halaman NAS / RADIUS Client — daftar router yang terdaftar di FreeRADIUS.
 * Aktivasi RADIUS dilakukan dari halaman Jaringan (NetworkPage) per router.
 */

import { useState } from "react"
import { Loader2, Search, Server, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
import { useDeleteNas, useRadiusNas, type RadiusNas } from "@/hooks/queries/useRadiusQueries"

export function RadiusNasPage() {
  const { data: nasList, isLoading } = useRadiusNas()
  const deleteNas = useDeleteNas()
  const [search, setSearch] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<RadiusNas | null>(null)

  const filtered = (nasList ?? []).filter(
    (n) =>
      n.nasname.toLowerCase().includes(search.toLowerCase()) ||
      (n.shortname ?? "").toLowerCase().includes(search.toLowerCase()),
  )

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteNas.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: () => {
        toast.error("Gagal menghapus NAS")
        setDeleteTarget(null)
      },
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", to: "/admin" },
          { label: "RADIUS", to: "/admin/radius/status" },
          { label: "NAS / RADIUS Client" },
        ]}
        title="NAS / RADIUS Client"
        description="Router yang diizinkan bertanya ke FreeRADIUS. Aktifkan lewat menu Jaringan → Aktifkan RADIUS."
      />

      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari NAS name atau shortname..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>NAS Name (IP)</TableHead>
              <TableHead>Shortname</TableHead>
              <TableHead>Router</TableHead>
              <TableHead>Secret</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-28 text-center">
                  <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-28 text-center text-sm text-muted-foreground">
                  Belum ada NAS terdaftar. Aktifkan RADIUS pada salah satu router di menu Jaringan.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((n) => (
                <TableRow key={n.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Server className="size-4 text-muted-foreground" />
                      <span className="font-mono text-xs">{n.nasname}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{n.shortname}</TableCell>
                  <TableCell className="text-sm">
                    {n.routerName ? (
                      <Badge variant="outline">{n.routerName}</Badge>
                    ) : (
                      <span className="text-muted-foreground">Tidak terhubung</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{n.secret}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                      onClick={() => setDeleteTarget(n)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Card className="border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Secret disimpan terenkripsi di tabel <code className="font-mono text-xs">routers.nas_secret</code> dan
          disalin ke tabel <code className="font-mono text-xs">nas</code> yang dibaca FreeRADIUS.
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Hapus NAS?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Router <strong>{deleteTarget?.shortname}</strong> ({deleteTarget?.nasname}) tidak akan bisa
              mengautentikasi pelanggan via FreeRADIUS lagi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={handleDelete}>
              <Trash2 className="mr-1.5 size-4" />
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
