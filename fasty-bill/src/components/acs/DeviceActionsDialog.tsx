/**
 * DeviceActionsDialog — dialog for Reboot and WiFi Settings actions.
 *
 * Opens from the device table row actions dropdown.
 * Tabs: Reboot | WiFi Settings
 */

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Wifi, Power } from "lucide-react"

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAcsRebootDevice, useAcsSetWifi } from "@/hooks/queries/useAcsQueries"

// ---------------------------------------------------------------------------
// Types & Schemas
// ---------------------------------------------------------------------------

export type DeviceInfo = {
  _id: string
  DeviceId: string
  DisplayName: string
  customerId?: string | number
  Status: "Online" | "Offline"
}

const wifiSchema = z.object({
  ssid: z.string().min(1, "SSID wajib diisi").max(32, "SSID maksimal 32 karakter"),
  wifiPassword: z
    .string()
    .min(8, "Password WiFi minimal 8 karakter")
    .max(63, "Password WiFi maksimal 63 karakter"),
  wlanIndex: z.coerce.number().int().min(1).default(1),
})

type WifiFormValues = z.infer<typeof wifiSchema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type DeviceActionsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  device: DeviceInfo | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DeviceActionsDialog({ open, onOpenChange, device }: DeviceActionsDialogProps) {
  if (!device) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            Aksi Device
          </DialogTitle>
          <DialogDescription>
            {device.DisplayName} ({device.DeviceId})
            {device.customerId && (
              <span className="ml-1">— Pelanggan #{device.customerId}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="wifi" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="wifi" className="gap-1.5">
              <Wifi className="h-3.5 w-3.5" />
              WiFi
            </TabsTrigger>
            <TabsTrigger value="reboot" className="gap-1.5">
              <Power className="h-3.5 w-3.5" />
              Reboot
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wifi" className="mt-4">
            <WifiForm device={device} onSuccess={() => onOpenChange(false)} />
          </TabsContent>

          <TabsContent value="reboot" className="mt-4">
            <RebootConfirm device={device} onSuccess={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// WiFi Form
// ---------------------------------------------------------------------------

function WifiForm({ device, onSuccess }: { device: DeviceInfo; onSuccess: () => void }) {
  const mutation = useAcsSetWifi()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<WifiFormValues>({
    resolver: zodResolver(wifiSchema),
    defaultValues: {
      ssid: "",
      wifiPassword: "",
      wlanIndex: 1,
    },
  })

  const onSubmit = (values: WifiFormValues) => {
    mutation.mutate(
      { deviceId: device._id, ...values },
      { onSuccess },
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="wlanIndex">Radio / WLAN Index</Label>
        <Select
          defaultValue="1"
          onValueChange={(v) => setValue("wlanIndex", Number(v))}
        >
          <SelectTrigger id="wlanIndex">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">WLAN 1 (2.4 GHz)</SelectItem>
            <SelectItem value="2">WLAN 2 (5 GHz)</SelectItem>
            <SelectItem value="3">WLAN 3</SelectItem>
            <SelectItem value="4">WLAN 4</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ssid">SSID</Label>
        <Input
          id="ssid"
          placeholder="Nama jaringan WiFi"
          {...register("ssid")}
        />
        {errors.ssid && (
          <p className="text-xs text-red-500">{errors.ssid.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="wifiPassword">Password WiFi</Label>
        <Input
          id="wifiPassword"
          type="password"
          placeholder="Minimal 8 karakter"
          {...register("wifiPassword")}
        />
        {errors.wifiPassword && (
          <p className="text-xs text-red-500">{errors.wifiPassword.message}</p>
        )}
      </div>

      <DialogFooter>
        <Button
          type="submit"
          disabled={mutation.isPending}
          className="w-full"
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Simpan WiFi
        </Button>
      </DialogFooter>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Reboot Confirm
// ---------------------------------------------------------------------------

function RebootConfirm({ device, onSuccess }: { device: DeviceInfo; onSuccess: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const mutation = useAcsRebootDevice()

  const handleReboot = () => {
    mutation.mutate(device._id, {
      onSuccess: () => {
        setConfirmOpen(false)
        onSuccess()
      },
    })
  }

  return (
    <>
      <div className="space-y-4 text-sm text-muted-foreground">
        <p>
          Reboot akan mengirim perintah TR-069 <strong>Reboot</strong> ke device.
        </p>
        <div className="rounded-md bg-muted px-3 py-2 font-mono text-xs">
          <div>Device: {device.DisplayName}</div>
          <div>Serial: {device.DeviceId}</div>
          <div>Status: {device.Status}</div>
        </div>
        <p className="text-amber-600 dark:text-amber-400">
          ⚠️ Device akan terputus sementara selama proses reboot.
        </p>
      </div>

      <DialogFooter className="mt-4">
        <Button
          variant="destructive"
          onClick={() => setConfirmOpen(true)}
          className="w-full"
        >
          <Power className="mr-2 h-4 w-4" />
          Reboot Device
        </Button>
      </DialogFooter>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Reboot</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin reboot{" "}
              <strong>{device.DisplayName}</strong>? Semua koneksi aktif akan
              terputus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReboot}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {mutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Ya, Reboot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
