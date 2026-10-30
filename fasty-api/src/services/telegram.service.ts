import type { FastifyInstance } from "fastify"

import { nextCode } from "../utils/codegen.js"
import { fillPlaceholders } from "../utils/template.js"

/**
 * Service notifikasi Telegram untuk admin (bot API resmi Telegram).
 *
 * Konfigurasi disimpan di app_settings (setting_key = 'telegram_config', JSON):
 *   - botToken  : token bot dari @BotFather
 *   - chatId    : chat ID tujuan (grup/internal), mis. "-1001234567890"
 *   - enabled   : aktif/nonaktif global
 *   - notifyPaymentSuccess / notifyPaymentFailed / notifyPaymentExpired
 *   - notifyRouterOffline : kirim notif saat Mikrotik offline
 *   - routerCheckIntervalMinutes : interval job cek status router
 *   - templates : { paymentSuccess, paymentFailed, paymentExpired, routerOffline }
 *
 * Kirim pesan: POST https://api.telegram.org/bot<token>/sendMessage
 */

const CONFIG_KEY = "telegram_config"

/** Key konfigurasi di app_settings (dipakai juga oleh routes). */
export const TELEGRAM_CONFIG_KEY = CONFIG_KEY

export interface TelegramTemplates {
  paymentSuccess: string
  paymentFailed: string
  paymentExpired: string
  routerOffline: string
}

export interface TelegramConfig {
  botToken: string
  chatId: string
  enabled: boolean
  notifyPaymentSuccess: boolean
  notifyPaymentFailed: boolean
  notifyPaymentExpired: boolean
  notifyRouterOffline: boolean
  routerCheckIntervalMinutes: number
  templates: TelegramTemplates
}

export const DEFAULT_TELEGRAM_TEMPLATES: TelegramTemplates = {
  paymentSuccess:
    "✅ TRANSAKSI SUKSES\n\n" +
    "Pelanggan : {nama}\nKode      : {kode}\nJumlah    : Rp {jumlah}\n" +
    "Metode    : {metode}\nWaktu     : {tanggal}\n\n" +
    "Pembayaran diterima & masa aktif diperpanjang.",
  paymentFailed:
    "❌ TRANSAKSI GAGAL\n\n" +
    "Pelanggan : {nama}\nKode      : {kode}\nJumlah    : Rp {jumlah}\n" +
    "Metode    : {metode}\nWaktu     : {tanggal}\n\n" +
    "Pembayaran gagal diproses. Mohon periksa.",
  paymentExpired:
    "⌛ TRANSAKSI KADALUARSA\n\n" +
    "Pelanggan : {nama}\nKode      : {kode}\nJumlah    : Rp {jumlah}\n" +
    "Metode    : {metode}\nWaktu     : {tanggal}\n\n" +
    "Pembayaran QRIS kedaluwarsa sebelum diselesaikan.",
  routerOffline:
    "🚨 MIKROTIK OFFLINE\n\n" +
    "Router : {router}\nHost   : {host}\nWaktu  : {tanggal}\n\n" +
    "Router tidak merespons. Sinkronisasi PPPoE ditahan di antrian dan akan " +
    "diterapkan otomatis saat router online kembali.",
}

export const DEFAULT_TELEGRAM_CONFIG: TelegramConfig = {
  botToken: "",
  chatId: "",
  enabled: false,
  notifyPaymentSuccess: true,
  notifyPaymentFailed: true,
  notifyPaymentExpired: true,
  notifyRouterOffline: true,
  routerCheckIntervalMinutes: 5,
  templates: { ...DEFAULT_TELEGRAM_TEMPLATES },
}

/** Baca konfigurasi Telegram dari system_config (merge dengan default). */
export async function getTelegramConfig(app: FastifyInstance): Promise<TelegramConfig> {
  const [row] = (await app.db.query(
    "SELECT config_value FROM system_config WHERE config_key = ? LIMIT 1",
    [CONFIG_KEY],
  )) as { config_value: string | null }[]
  if (!row?.config_value) return { ...DEFAULT_TELEGRAM_CONFIG }
  try {
    const parsed = JSON.parse(row.config_value) as Partial<TelegramConfig>
    return {
      ...DEFAULT_TELEGRAM_CONFIG,
      ...parsed,
      templates: { ...DEFAULT_TELEGRAM_TEMPLATES, ...(parsed.templates ?? {}) },
    }
  } catch {
    return { ...DEFAULT_TELEGRAM_CONFIG }
  }
}

/** Simpan konfigurasi Telegram ke system_config (satu baris per key — aman dari penimpaan config lain). */
export async function saveTelegramConfig(app: FastifyInstance, cfg: TelegramConfig): Promise<void> {
  await app.db.query(
    `INSERT INTO system_config (config_key, config_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
    [CONFIG_KEY, JSON.stringify(cfg)],
  )
}

export interface SendResult {
  ok: boolean
  error?: string
}

/** Kirim satu pesan ke Telegram. Tidak pernah throw — selalu return hasil. */
export async function sendTelegramMessage(
  app: FastifyInstance,
  botToken: string,
  chatId: string,
  message: string,
): Promise<SendResult> {
  if (!botToken || !chatId) {
    return { ok: false, error: "Telegram belum dikonfigurasi (botToken/chatId kosong)" }
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string }
    if (!res.ok || data.ok !== true) {
      return { ok: false, error: data.description ?? `Telegram HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: `Gagal menghubungi Telegram: ${(err as Error).message}` }
  }
}

interface NotifyInput {
  type: "paymentSuccess" | "paymentFailed" | "paymentExpired" | "routerOffline"
  vars: Record<string, string>
}

/**
 * Kirim notifikasi transaksi/router ke Telegram admin bila:
 * - konfigurasi valid & enabled
 * - tipe terkait diaktifkan (paymentSuccess dll.)
 * Pesan diambil dari template (custom atau default) lalu placeholder diisi.
 * Log ditulis ke notification_logs (channel=Telegram).
 */
export async function notifyTelegram(app: FastifyInstance, input: NotifyInput): Promise<SendResult> {
  try {
    const cfg = await getTelegramConfig(app)
    if (!cfg.enabled || !cfg.botToken || !cfg.chatId) {
      return { ok: false, error: "Telegram nonaktif/belum dikonfigurasi" }
    }
    const typeEnabled: Record<NotifyInput["type"], boolean> = {
      paymentSuccess: cfg.notifyPaymentSuccess,
      paymentFailed: cfg.notifyPaymentFailed,
      paymentExpired: cfg.notifyPaymentExpired,
      routerOffline: cfg.notifyRouterOffline,
    }
    if (!typeEnabled[input.type]) return { ok: false, error: "Tipe notifikasi dinonaktifkan" }

    const template = cfg.templates[input.type] || DEFAULT_TELEGRAM_TEMPLATES[input.type]
    const message = fillPlaceholders(template, input.vars)
    const result = await sendTelegramMessage(app, cfg.botToken, cfg.chatId, message)

    // Log (customer_id boleh null untuk notif router)
    const ntCode = await app.db.transaction(async (q) =>
      nextCode(q.query, "notification_logs", "NT-", { minStart: 1000 }),
    )
    await app.db.query(
      "INSERT INTO notification_logs (code, type, customer_id, channel, status, error) VALUES (?, ?, ?, 'Telegram', ?, ?)",
      [
        ntCode,
        input.type === "routerOffline" ? "router" : "payment",
        input.vars.customerId ?? null,
        result.ok ? "Terkirim" : "Gagal",
        result.ok ? null : result.error,
      ],
    )
    return result
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

/** Uji koneksi bot (GET /getMe). */
export async function testTelegramBot(
  botToken: string,
): Promise<{ ok: boolean; botName?: string; error?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
      signal: AbortSignal.timeout(10_000),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      result?: { username?: string; first_name?: string }
      description?: string
    }
    if (!res.ok || data.ok !== true) {
      return { ok: false, error: data.description ?? `Telegram HTTP ${res.status}` }
    }
    return { ok: true, botName: data.result?.username ?? data.result?.first_name }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}
