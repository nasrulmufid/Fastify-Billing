import type { FastifyInstance } from "fastify"

import { config } from "../config.js"
import { normalizePhone } from "../utils/phone.js"

export interface SendResult {
  ok: boolean
  error?: string
}

export interface SendMessageInput {
  phone: string
  message: string
}

type GatewayState = "disconnected" | "connecting" | "connected"

type GowaResponse<T> = {
  code: string
  message: string
  results: T
}

let initialized = false
let qrCodeData: string | null = null
let pairingCode: string | null = null
export let connectionState: GatewayState = "disconnected"

function gowaHeaders(deviceScoped: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(config.gowa.basicAuth).toString("base64")}`,
    "Content-Type": "application/json",
  }
  if (deviceScoped) headers["X-Device-Id"] = config.gowa.deviceId
  return headers
}

async function gowa<T>(path: string, init?: RequestInit, deviceScoped = true): Promise<T> {
  if (!config.gowa.basicAuth) throw new Error("GOWA_BASIC_AUTH belum dikonfigurasi")

  const response = await fetch(`${config.gowa.baseUrl}${path}`, {
    ...init,
    headers: { ...gowaHeaders(deviceScoped), ...init?.headers },
    signal: AbortSignal.timeout(15_000),
  })
  const raw = await response.text()
  const body = JSON.parse(raw || "null") as GowaResponse<T> | null
  if (!response.ok || !body || body.code !== "SUCCESS") {
    const detail = body?.message || raw.slice(0, 200) || "empty response"
    throw new Error(`GOWA ${path} failed (${response.status}): ${detail}`)
  }
  return body.results
}

async function ensureDevice(): Promise<void> {
  if (initialized) return
  const devices = await gowa<Array<{ id?: string; device_id?: string }>>("/devices", undefined, false)
  const exists = devices.some((device) => String(device.id ?? device.device_id ?? "") === config.gowa.deviceId)
  if (!exists) {
    await gowa<{ id: string }>("/devices", {
      method: "POST",
      body: JSON.stringify({ device_id: config.gowa.deviceId }),
    }, false)
  }
  initialized = true
}

async function loadQr(url: string): Promise<string> {
  const remote = new URL(url)
  const internalUrl = new URL(`${remote.pathname}${remote.search}`, `${config.gowa.baseUrl}/`).toString()
  const response = await fetch(internalUrl, {
    headers: gowaHeaders(false),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Gagal mengunduh QR dari GOWA (${response.status})`)
  const image = Buffer.from(await response.arrayBuffer()).toString("base64")
  return `data:${response.headers.get("content-type") || "image/png"};base64,${image}`
}

/** Connect GOWA device slot. Kept name for existing route callers. */
export async function initBaileysSock(_app: FastifyInstance): Promise<void> {
  await ensureDevice()
  const status = await gowa<{ is_connected: boolean; is_logged_in: boolean }>(
    `/devices/${encodeURIComponent(config.gowa.deviceId)}/status`,
  )
  connectionState = status.is_connected && status.is_logged_in ? "connected" : "disconnected"
  if (connectionState === "connected") {
    qrCodeData = null
    pairingCode = null
  }
}

export function getBaileyStatus(): {
  connected: boolean
  state: GatewayState
  qr: string | null
  pairingCode: string | null
} {
  return { connected: connectionState === "connected", state: connectionState, qr: qrCodeData, pairingCode }
}

export async function requestBaileyQr(app: FastifyInstance): Promise<void> {
  connectionState = "connecting"
  qrCodeData = null
  pairingCode = null
  await ensureDevice()
  const result = await gowa<{ qr_link: string }>(`/devices/${encodeURIComponent(config.gowa.deviceId)}/login`)
  qrCodeData = await loadQr(result.qr_link)
  await initBaileysSock(app)
}

export async function requestBaileyPairingCode(
  _app: FastifyInstance,
  phone: string,
): Promise<string> {
  const normalized = normalizePhone(phone)
  if (!/^\d{8,15}$/.test(normalized)) throw new Error("Nomor WhatsApp tidak valid")

  connectionState = "connecting"
  qrCodeData = null
  await ensureDevice()
  const result = await gowa<{ pair_code: string }>(
    `/devices/${encodeURIComponent(config.gowa.deviceId)}/login/code?phone=${encodeURIComponent(normalized)}`,
    { method: "POST" },
  )
  pairingCode = result.pair_code
  return pairingCode
}

export async function disconnectBaileys(): Promise<void> {
  await ensureDevice()
  await gowa(`/devices/${encodeURIComponent(config.gowa.deviceId)}/logout`, { method: "POST" })
  connectionState = "disconnected"
  qrCodeData = null
  pairingCode = null
}

/** Send message via GOWA. Kept name for existing notification callers. */
export async function sendWhatsAppMessage(
  _app: FastifyInstance,
  input: SendMessageInput,
): Promise<SendResult> {
  const phone = normalizePhone(input.phone)
  const message = String(input.message ?? "").trim()
  if (!/^\d{8,15}$/.test(phone)) return { ok: false, error: "Nomor telepon tidak valid" }
  if (!message || message.length > 4096) return { ok: false, error: "Pesan tidak valid" }

  try {
    await gowa("/send/message", {
      method: "POST",
      headers: { "X-Device-Id": config.gowa.deviceId },
      body: JSON.stringify({ phone, message }),
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal mengirim pesan" }
  }
}

/** GOWA keeps device identity and session; display name stays in existing DB config. */
export async function storeDeviceCredentials(app: FastifyInstance, deviceName: string): Promise<void> {
  const name = String(deviceName ?? "").trim()
  if (!name || name.length > 120) throw new Error("Nama perangkat tidak valid")
  await app.db.query(
    `INSERT INTO wa_api_config (id, device_name) VALUES (1, ?)
     ON DUPLICATE KEY UPDATE device_name = VALUES(device_name)`,
    [name],
  )
}

export async function getDeviceName(app: FastifyInstance): Promise<string | null> {
  const [row] = (await app.db.query("SELECT device_name FROM wa_api_config WHERE id = 1")) as Array<{ device_name: string | null }>
  return row?.device_name ?? null
}
