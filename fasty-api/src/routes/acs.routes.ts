/**
 * ACS (GenieACS) management routes.
 *
 * Provides:
 *   GET  /acs/config          - get GenieACS server config
 *   PUT  /acs/config          - save GenieACS server config
 *   GET  /acs/devices         - list all devices with status
 *   POST /acs/devices/sync    - sync customer IDs → GenieACS device tags
 *   GET  /acs/devices/:deviceId         - get single device
 *   POST /acs/devices/:deviceId/reboot   - reboot device
 *   POST /acs/devices/:deviceId/ssid     - change SSID + WiFi password
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import {
  GenieACSService,
  type GenieACSDevice,
  type GenieACSConfig,
} from "../services/genieacs.service.js"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const acsConfigSchema = z.object({
  baseUrl: z.string().url("URL GenieACS tidak valid"),
  apiKey: z.string().min(1, "API Key wajib diisi"),
  syncIntervalMinutes: z.coerce.number().int().min(5).max(1440).default(30),
  autoSyncOnAccess: z.boolean().default(true),
})

const ssidSchema = z.object({
  ssid: z.string().min(1, "SSID wajib diisi").max(32, "SSID maksimal 32 karakter"),
  wifiPassword: z.string().min(8, "Password WiFi minimal 8 karakter").max(63, "Password WiFi maksimal 63 karakter"),
  wlanIndex: z.coerce.number().int().min(1).default(1),
})

const CONFIG_SETTING_KEY = "genieacs_config"

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function acsRoutes(app: FastifyInstance): Promise<void> {
  const auth = {
    onRequest: [app.authenticate],
    preHandler: [app.requireRoles(["super_admin", "admin"])],
  }

  // GET /acs/config
  app.get("/acs/config", auth, async (_req: FastifyRequest, reply: FastifyReply) => {
    const [row] = (await app.db.query(
      "SELECT config_value FROM system_config WHERE config_key = ? LIMIT 1",
      [CONFIG_SETTING_KEY],
    )) as { config_value: string }[]

    let configData: GenieACSConfig = {
      baseUrl: "http://localhost:7557",
      apiKey: "",
      syncIntervalMinutes: 30,
      autoSyncOnAccess: true,
    }

    if (row?.config_value) {
      try {
        const parsed = JSON.parse(row.config_value)
        configData = {
          baseUrl: parsed.baseUrl ?? configData.baseUrl,
          apiKey: parsed.apiKey ?? "",
          syncIntervalMinutes: Number(parsed.syncIntervalMinutes ?? 30),
          autoSyncOnAccess: parsed.autoSyncOnAccess ?? true,
        }
      } catch {
        // ignore parse errors, use defaults
      }
    }

    // Never expose apiKey in full — mask it
    const masked: GenieACSConfig & { apiKeyMasked: string } = {
      ...configData,
      apiKeyMasked: configData.apiKey
        ? configData.apiKey.slice(0, 4) + "****" + configData.apiKey.slice(-4)
        : "",
    }

    return reply.send({ data: masked })
  })

  // PUT /acs/config
  app.put("/acs/config", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = acsConfigSchema.parse(req.body)

    // Simpan ke system_config (satu baris per key — tidak menimpa config lain
    // seperti telegram_config; app_settings hanya utk pengaturan umum single-row).
    await app.db.query(
      `INSERT INTO system_config (config_key, config_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
      [CONFIG_SETTING_KEY, JSON.stringify(body)],
    )

    return reply.send({ data: { message: "Konfigurasi GenieACS disimpan" } })
  })

  // GET /acs/devices
  app.get("/acs/devices", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const config = await getAcsConfig(app)

    const client = new GenieACSService({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    })

    const rawDevices = await client.getDevices()
    const devices: GenieACSDevice[] = rawDevices.map((raw) =>
      GenieACSService.mapDevice(raw),
    )

    return reply.send({ data: devices })
  })

  // GET /acs/devices/:deviceId
  app.get(
    "/acs/devices/:deviceId",
    auth,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { deviceId } = req.params as { deviceId: string }
      const config = await getAcsConfig(app)

      const client = new GenieACSService({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
      })

      const raw = await client.getDevice(deviceId)
      const device = GenieACSService.mapDevice(raw)

      return reply.send({ data: device })
    },
  )

  // POST /acs/devices/sync
  // Reads customer_id tags from GenieACS devices and matches to local customers table.
  // If a GenieACS device has a tag "customer_id:123" but no local customer has that id,
  // it logs a warning (GenieACS is source of truth for tag -> customer mapping).
  app.post("/acs/devices/sync", auth, async (_req: FastifyRequest, reply: FastifyReply) => {
    const config = await getAcsConfig(app)

    const client = new GenieACSService({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    })

    // 1. Fetch all devices from GenieACS
    const rawDevices = await client.getDevices()
    const devices: GenieACSDevice[] = rawDevices.map((raw) =>
      GenieACSService.mapDevice(raw),
    )

    // 2. Fetch all local customers
    const customers = await app.db.query(
      "SELECT id, name, phone FROM customers",
    ) as { id: number; name: string; phone: string }[]

    const customerIds = new Set(customers.map((c) => c.id))
    const customerMap = new Map(customers.map((c) => [c.id, c]))

    let matched = 0
    let unmatched = 0
    const deviceSummaries: { deviceId: string; customerId?: string | number; status: string }[] = []

    for (const device of devices) {
      if (device.customerId) {
        if (customerIds.has(Number(device.customerId))) {
          matched++
        } else {
          unmatched++
        }
        deviceSummaries.push({
          deviceId: device.DeviceId,
          customerId: device.customerId,
          status: customerIds.has(Number(device.customerId)) ? "matched" : "unmatched",
        })
      } else {
        deviceSummaries.push({
          deviceId: device.DeviceId,
          status: "no_customer_tag",
        })
      }
    }

    app.log.info(
      `[ACS Sync] Total devices: ${devices.length}, matched: ${matched}, unmatched: ${unmatched}, no_tag: ${devices.length - matched - unmatched}`,
    )

    return reply.send({
      data: {
        total: devices.length,
        matched,
        unmatched,
        noTag: devices.length - matched - unmatched,
        devices: deviceSummaries,
      },
    })
  })

  // POST /acs/devices/:deviceId/reboot
  app.post(
    "/acs/devices/:deviceId/reboot",
    auth,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { deviceId } = req.params as { deviceId: string }
      const config = await getAcsConfig(app)

      const client = new GenieACSService({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
      })

      try {
        await client.rebootDevice(deviceId)
        app.log.info(`[ACS] Reboot requested for device ${deviceId}`)
        return reply.send({ data: { message: "Reboot berhasil dikirim ke device" } })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        app.log.error(`[ACS] Reboot failed for ${deviceId}: ${msg}`)
        return reply.status(502).send({
          error: { code: "REBOOT_FAILED", message: `Gagal reboot device: ${msg}` },
        })
      }
    },
  )

  // POST /acs/devices/:deviceId/ssid
  app.post(
    "/acs/devices/:deviceId/ssid",
    auth,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { deviceId } = req.params as { deviceId: string }
      const body = ssidSchema.parse(req.body)
      const config = await getAcsConfig(app)

      const client = new GenieACSService({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
      })

      try {
        await client.setWifiParams(deviceId, body.ssid, body.wifiPassword, body.wlanIndex)
        app.log.info(
          `[ACS] WiFi params set for device ${deviceId}: SSID=${body.ssid}, WLAN=${body.wlanIndex}`,
        )
        return reply.send({
          data: { message: "SSID dan password WiFi berhasil diperbarui" },
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        app.log.error(`[ACS] Set WiFi failed for ${deviceId}: ${msg}`)
        return reply.status(502).send({
          error: { code: "WIFI_UPDATE_FAILED", message: `Gagal update WiFi: ${msg}` },
        })
      }
    },
  )
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function getAcsConfig(app: FastifyInstance): Promise<GenieACSConfig> {
  const [row] = (await app.db.query(
    "SELECT config_value FROM system_config WHERE config_key = ? LIMIT 1",
    [CONFIG_SETTING_KEY],
  )) as { config_value: string }[]

  if (!row?.config_value) {
    // Return defaults — caller should warn user to configure first
    return {
      baseUrl: "http://localhost:7557",
      apiKey: "",
      syncIntervalMinutes: 30,
      autoSyncOnAccess: true,
    }
  }

  try {
    const parsed = JSON.parse(row.config_value)
    return {
      baseUrl: parsed.baseUrl ?? "http://localhost:7557",
      apiKey: parsed.apiKey ?? "",
      syncIntervalMinutes: Number(parsed.syncIntervalMinutes ?? 30),
      autoSyncOnAccess: parsed.autoSyncOnAccess ?? true,
    }
  } catch {
    return {
      baseUrl: "http://localhost:7557",
      apiKey: "",
      syncIntervalMinutes: 30,
      autoSyncOnAccess: true,
    }
  }
}
