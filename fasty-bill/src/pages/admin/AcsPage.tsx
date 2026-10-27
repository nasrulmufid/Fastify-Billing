/**
 * ACS Devices Page — main dashboard.
 *
 * Features:
 * - Stat cards: Total Devices, Online, Offline
 * - Device table with status indicators
 * - Auto-sync on page mount (when enabled in config)
 * - Row actions: Reboot, Change WiFi
 */

import { useEffect, useMemo, useState } from "react"
import { MoreHorizontal, RefreshCw, Search, Wifi, WifiOff } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/layouts/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  useAcsDevices,
  useAcsSync,
  useAcsConfig,
  type GenieACSDevice,
} from "@/hooks/queries/useAcsQueries"
import { useAcsStore, type AcsDeviceStatusFilter } from "@/store/acsStore"
import { DeviceActionsDialog, type DeviceInfo } from "@/components/acs/DeviceActionsDialog"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: "Online" | "Offline" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        status === "Online"
          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          : "bg-muted text-muted-foreground"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "Online" ? "bg-green-500" : "bg-gray-400"
        }`}
      />
      {status}
    </span>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  className,
}: {
  title: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  className?: string
}) {
  return (
    <Card className={className}>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="rounded-lg bg-primary/10 p-3">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Device Table Row Actions
// ---------------------------------------------------------------------------

function DeviceRowActions({ device }: { device: GenieACSDevice }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [actionDevice, setActionDevice] = useState<DeviceInfo | null>(null)

  const openActions = (dev: GenieACSDevice) => {
    setActionDevice({
      _id: dev._id,
      DeviceId: dev.DeviceId,
      DisplayName: dev.DisplayName,
      customerId: dev.customerId,
      Status: dev.Status,
    })
    setDialogOpen(true)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Aksi</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openActions(device)}>
            <Wifi className="mr-2 h-4 w-4" />
            WiFi & Reboot
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeviceActionsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        device={actionDevice}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function AcsPage() {
  const { data: config } = useAcsConfig()
  const { data: devices = [], isLoading } = useAcsDevices()
  const syncMutation = useAcsSync()

  const { filters, setSearch, setStatus, resetFilters } = useAcsStore()

  // Auto-sync on mount when enabled
  useEffect(() => {
    if (config?.autoSyncOnAccess) {
      syncMutation.mutate()
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Derived stats
  const stats = useMemo(() => {
    const total = devices.length
    const online = devices.filter((d) => d.Status === "Online").length
    const offline = devices.filter((d) => d.Status === "Offline").length
    return { total, online, offline }
  }, [devices])

  // Filtered devices
  const filteredDevices = useMemo(() => {
    return devices.filter((d) => {
      // Status filter
      if (filters.status !== "all" && d.Status !== filters.status) return false

      // Search filter (DeviceId, DisplayName, customerId)
      if (filters.search) {
        const q = filters.search.toLowerCase()
        const matchId = d.DeviceId.toLowerCase().includes(q)
        const matchName = d.DisplayName.toLowerCase().includes(q)
        const matchCustId = String(d.customerId ?? "").toLowerCase().includes(q)
        if (!matchId && !matchName && !matchCustId) return false
      }

      return true
    })
  }, [devices, filters])

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", to: "/admin" },
            { label: "ACS", to: "/admin/acs" },
            { label: "Devices" },
          ]}
          title="ACS Devices"
          description="Kelola perangkat ONU via GenieACS"
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`}
              />
              Sync Now
            </Button>
          }
        />

        {/* Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Total Devices"
            value={stats.total}
            icon={Wifi}
          />
          <StatCard
            title="Online"
            value={stats.online}
            icon={() => (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <span className="h-2 w-2 rounded-full bg-green-500" />
              </span>
            )}
          />
          <StatCard
            title="Offline"
            value={stats.offline}
            icon={WifiOff}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari serial, nama, atau ID pelanggan..."
              value={filters.search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={filters.status}
              onValueChange={(v) => setStatus(v as AcsDeviceStatusFilter)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="Online">Online</SelectItem>
                <SelectItem value="Offline">Offline</SelectItem>
              </SelectContent>
            </Select>

            {(filters.search || filters.status !== "all") && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device ID / Serial</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Pelanggan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>SSID</TableHead>
                <TableHead>Last Inform</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Skeleton rows
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : filteredDevices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {devices.length === 0
                      ? "Tidak ada device. Pastikan GenieACS dikonfigurasi dengan benar."
                      : "Tidak ada device yang cocok dengan filter."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredDevices.map((device) => (
                  <TableRow key={device._id}>
                    <TableCell>
                      <span className="font-mono text-xs">{device.DeviceId}</span>
                    </TableCell>
                    <TableCell className="font-medium">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            {device.DisplayName.length > 30
                              ? device.DisplayName.slice(0, 30) + "…"
                              : device.DisplayName}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{device.DisplayName}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {device.customerId ? (
                        <Badge variant="outline">#{device.customerId}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={device.Status} />
                    </TableCell>
                    <TableCell>
                      {device.SSID ? (
                        <span className="text-xs">{device.SSID}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {device.LastInform
                        ? new Date(device.LastInform).toLocaleString("id-ID", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <DeviceRowActions device={device} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        {!isLoading && filteredDevices.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Menampilkan {filteredDevices.length} dari {devices.length} device
          </p>
        )}
      </div>
    </TooltipProvider>
  )
}
