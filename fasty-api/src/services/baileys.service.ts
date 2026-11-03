import type { FastifyInstance } from "fastify"
import type { WASocket } from "baileys"
import { default as makeWASocket, DisconnectReason, useMultiFileAuthState } from "baileys"
import { Boom } from "@hapi/boom"
import path from "path"
import fs from "fs/promises"
import QRCode from "qrcode"

import { decryptSecret, encryptSecret } from "../utils/crypto.js"
import { normalizePhone } from "../utils/phone.js"

export interface SendResult {
  ok: boolean
  error?: string
}

export interface SendMessageInput {
  phone: string
  message: string
}

let baileysSocket: WASocket | null = null
let qrCodeData: string | null = null
let pairingCode: string | null = null
export let connectionState: "disconnected" | "connecting" | "connected" = "disconnected"

function setConnectionState(
  state: "disconnected" | "connecting" | "connected",
): void {
  connectionState = state
}

const BAILEYS_AUTH_DIR = path.join(process.cwd(), ".baileys")

/** Init Baileys auth dir */
async function ensureAuthDir(): Promise<void> {
  try {
    await fs.mkdir(BAILEYS_AUTH_DIR, { recursive: true })
  } catch {
    /* dir exists */
  }
}

/** Start Baileys connection */
export async function initBaileysSock(app: FastifyInstance): Promise<void> {
  connectionState = "connecting"
  await ensureAuthDir()

  try {
    const { state, saveCreds } = await useMultiFileAuthState(BAILEYS_AUTH_DIR)

    baileysSocket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: app.log.child({ level: "fatal" }),
      browser: ["Fastify Billing", "Chrome", "5.0"],
      syncFullHistory: false,
    })

    baileysSocket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        qrCodeData = await QRCode.toDataURL(qr)
        pairingCode = null
        app.log.info("QR code updated")
      }

      if (connection === "connecting") {
        setConnectionState("connecting")
        app.log.info("Connecting to WhatsApp...")
      }

      if (connection === "open") {
        setConnectionState("connected")
        qrCodeData = null
        pairingCode = null
        app.log.info("WhatsApp connected successfully")
      }

      if (connection === "close") {
        setConnectionState("disconnected")
        const reason = new Boom(lastDisconnect?.error).output.statusCode
        const shouldReconnect = reason !== DisconnectReason.loggedOut
        app.log.warn(`Connection closed. Reason: ${reason}. Reconnect: ${shouldReconnect}`)

        if (shouldReconnect) {
          setTimeout(() => {
            baileysSocket = null
            qrCodeData = null
            pairingCode = null
            initBaileysSock(app).catch((err) => app.log.error(err, "Failed to reconnect"))
          }, 3000)
        } else {
          baileysSocket = null
          qrCodeData = null
          pairingCode = null
          setConnectionState("disconnected")
        }
      }
    })

    baileysSocket.ev.on("creds.update", saveCreds)
  } catch (err) {
    app.log.error(err, "Failed to init Baileys socket")
    setConnectionState("disconnected")
    baileysSocket = null
    throw err
  }
}

/** Get connection status & QR */
export function getBaileyStatus(): {
  connected: boolean
  state: "disconnected" | "connecting" | "connected"
  qr: string | null
  pairingCode: string | null
} {
  return {
    connected: connectionState === "connected",
    state: connectionState,
    qr: qrCodeData,
    pairingCode,
  }
}

export async function requestBaileyPairingCode(
  app: FastifyInstance,
  phone: string,
): Promise<string> {
  const normalized = normalizePhone(phone)
  if (!/^\d{8,15}$/.test(normalized)) throw new Error("Nomor WhatsApp tidak valid")

  // Reset socket untuk fresh pairing attempt
  await disconnectBaileys()

  await initBaileysSock(app)
  if (!baileysSocket) throw new Error("WhatsApp belum siap")

  const code = await baileysSocket.requestPairingCode(normalized)
  pairingCode = code
  app.log.info(`Pairing code requested untuk ${normalized}`)
  return code
}

/** Disconnect Baileys */
export async function disconnectBaileys(): Promise<void> {
  if (baileysSocket) {
    try {
      await baileysSocket.logout()
    } catch {
      /* ignore */
    }
    baileysSocket = null
    setConnectionState("disconnected")
    qrCodeData = null
    pairingCode = null
  }
}

/** Send message via Baileys */
export async function sendWhatsAppMessage(
  app: FastifyInstance,
  input: SendMessageInput,
): Promise<SendResult> {
  if (!baileysSocket || connectionState !== "connected") {
    return {
      ok: false,
      error: "WhatsApp bot belum terhubung. Scan QR code terlebih dahulu.",
    }
  }

  try {
    // Input validation
    const phone = normalizePhone(input.phone)
    if (!phone || !/^\d+$/.test(phone)) {
      return { ok: false, error: "Nomor telepon tidak valid" }
    }

    // Message validation: prevent injection, max length
    const message = String(input.message ?? "").trim()
    if (!message || message.length === 0) {
      return { ok: false, error: "Pesan tidak boleh kosong" }
    }
    if (message.length > 4096) {
      return { ok: false, error: "Pesan terlalu panjang (maks 4096 karakter)" }
    }

    const jid = `${phone}@s.whatsapp.net`
    await baileysSocket.sendMessage(jid, { text: message })
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    app.log.warn({ phone: input.phone, error: msg }, "Failed to send WhatsApp message")
    return { ok: false, error: `Gagal mengirim pesan: ${msg.slice(0, 100)}` }
  }
}

/** Store device credentials (encrypted, validated) */
export async function storeDeviceCredentials(
  app: FastifyInstance,
  deviceName: string,
): Promise<void> {
  // Input validation
  const name = String(deviceName ?? "").trim()
  if (!name || name.length === 0) {
    throw new Error("Nama perangkat tidak boleh kosong")
  }
  if (name.length > 120) {
    throw new Error("Nama perangkat terlalu panjang (maks 120 karakter)")
  }
  if (!/^[a-zA-Z0-9\s\-_()]+$/.test(name)) {
    throw new Error("Nama perangkat mengandung karakter tidak valid")
  }

  const encrypted = encryptSecret(name)
  await app.db.query(
    `INSERT INTO wa_api_config (id, device_name) VALUES (1, ?)
     ON DUPLICATE KEY UPDATE device_name = VALUES(device_name)`,
    [encrypted],
  )
}

/** Get device name (decrypted) */
export async function getDeviceName(app: FastifyInstance): Promise<string> {
  const [row] = (await app.db.query("SELECT device_name FROM wa_api_config WHERE id = 1")) as Record<
    string,
    unknown
  >[]
  return decryptSecret(String(row?.device_name ?? ""))
}
