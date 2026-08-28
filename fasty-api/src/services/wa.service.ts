import type { FastifyInstance } from "fastify"

import { decryptSecret } from "../utils/crypto.js"
import { nextCode } from "../utils/codegen.js"
import { normalizePhone } from "../utils/phone.js"
import { createSumopodPayment } from "../utils/sumopod.js"

/**
 * Service integrasi WA Gateway pihak ketiga (Go WhatsApp API).
 *
 * Konfigurasi diambil dari tabel `wa_api_config` (single row id=1):
 *   - server_url : base URL gateway (mis. https://wa.example.com)
 *   - api_key    : API key terenkripsi
 *
 * Format request ke gateway (standar umum Go WhatsApp API):
 *   POST {server_url}/send
 *   Headers: { "X-Api-Key": <api_key>, "Content-Type": "application/json" }
 *   Body:    { "phone": "628xxxx", "message": "..." }
 *
 * Jika format gateway Anda berbeda, cukup sesuaikan bagian `buildRequest`
 * di bawah tanpa mengubah pemanggil.
 */

export interface SendResult {
  ok: boolean
  error?: string
}

export interface SendMessageInput {
  phone: string // nomor mentah (akan dinormalisasi ke 62)
  message: string
}

/** Ambil config gateway dari DB. Mengembalikan null jika belum dikonfigurasi. */
async function getGatewayConfig(app: FastifyInstance): Promise<{ serverUrl: string; apiKey: string } | null> {
  const [row] = (await app.db.query("SELECT server_url, api_key FROM wa_api_config WHERE id = 1")) as Record<
    string,
    unknown
  >[]
  const serverUrl = String(row?.server_url ?? "").trim()
  const apiKey = decryptSecret(String(row?.api_key ?? "")).trim()
  if (!serverUrl || !apiKey) return null
  return { serverUrl, apiKey }
}

/**
 * Normalisasi nomor ke format JID yang diharapkan gateway go-whatsapp-web-multidevice.
 * Gateway menolak nomor yang dimulai "0" dan mengharapkan suffix "@s.whatsapp.net".
 * Contoh: "0815-1111-2222" -> "628151112222@s.whatsapp.net"
 */
function toWhatsAppJID(phone: string): string {
  const normalized = normalizePhone(phone) // "628151112222"
  if (normalized.includes("@")) return normalized
  return `${normalized}@s.whatsapp.net`
}

/** Kirim satu pesan WhatsApp ke gateway pihak ketiga (aldinokemal/go-whatsapp-web-multidevice). */
export async function sendWhatsAppMessage(app: FastifyInstance, input: SendMessageInput): Promise<SendResult> {
  const cfg = await getGatewayConfig(app)
  if (!cfg) {
    return { ok: false, error: "WA Gateway belum dikonfigurasi (server_url/api_key kosong)" }
  }

  const phone = toWhatsAppJID(input.phone)
  const url = `${cfg.serverUrl.replace(/\/$/, "")}/send/message`

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": cfg.apiKey,
      },
      body: JSON.stringify({ phone, message: input.message }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return { ok: false, error: `Gateway ${res.status}: ${text.slice(0, 200)}` }
    }

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    // Gateway mengembalikan { code: "SUCCESS", status: 200, ... } saat berhasil
    const code = String(data.code ?? "")
    if (code.toUpperCase() !== "SUCCESS") {
      return { ok: false, error: String(data.message ?? data.error ?? "Gateway mengembalikan bukan SUCCESS") }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Gagal menghubungi gateway: ${msg}` }
  }
}

/**
 * Buat (atau reuse) payment link QRIS SumoPod untuk sebuah invoice.
 * Mengembalikan URL pembayaran unik per-invoice, atau null bila payment gateway
 * belum dikonfigurasi / gagal. Aman dipanggil berulang: payment Pending existing
 * akan dipakai kembali (tidak membuat duplikat).
 */
export async function buildPaymentLinkForInvoice(
  app: FastifyInstance,
  invoice: { invoice_id: number | string; customer_id: number | string; amount: number | string },
): Promise<string | null> {
  const [paymentConfig] = (await app.db.query(
    "SELECT api_key FROM payment_gateway_config WHERE id = 1",
  )) as Record<string, unknown>[]
  const apiKey = decryptSecret(String(paymentConfig?.api_key ?? "")).trim()
  if (!apiKey) return null

  const [existing] = (await app.db.query(
    "SELECT * FROM payments WHERE invoice_id = ? AND status = 'Pending' ORDER BY id DESC LIMIT 1",
    [invoice.invoice_id],
  )) as Record<string, unknown>[]
  let payment = existing
  if (!payment) {
    const code = await app.db.transaction(async (q) => nextCode(q.query, "payments", "PY-"))
    const result = (await app.db.query(
      "INSERT INTO payments (code, customer_id, invoice_id, method, amount, status) VALUES (?, ?, ?, 'QRIS', ?, 'Pending')",
      [code, invoice.customer_id, invoice.invoice_id, Number(invoice.amount)],
    )) as unknown as { insertId: number }
    const [createdPayment] = (await app.db.query("SELECT * FROM payments WHERE id = ?", [
      result.insertId,
    ])) as Record<string, unknown>[]
    payment = createdPayment
  }

  const created = await createSumopodPayment({
    orderId: String(payment.code),
    amount: Number(invoice.amount),
    apiKey,
  })
  await app.db.query("UPDATE payments SET gateway_ref = ? WHERE id = ?", [
    created.paymentId,
    payment.id,
  ])
  return created.paymentLinkUrl
}

/**
 * Tipe reminder tagihan yang didukung.
 * - h7  : pengingat 7 hari sebelum jatuh tempo
 * - h3  : pengingat 3 hari sebelum jatuh tempo
 * - h1  : pengingat 1 hari sebelum jatuh tempo
 * - isolir : pemberitahuan isolir (koneksi diputus)
 */
export type ReminderType = "h7" | "h3" | "h1" | "isolir"

const REMINDER_TYPE_KEYWORDS: Record<ReminderType, string[]> = {
  h7: ["h-7", "h7", "7 hari", "tujuh hari"],
  h3: ["h-3", "h3", "3 hari", "tiga hari"],
  h1: ["h-1", "h1", "1 hari", "satu hari", "besok"],
  isolir: ["isolir", "putus", "blokir", "suspend"],
}

const REMINDER_FALLBACK: Record<ReminderType, { name: string; body: string }> = {
  h7: {
    name: "Pengingat Tagihan H-7",
    body: "Yth {nama}, kami mengingatkan bahwa tagihan internet Anda sebesar {jumlah} akan jatuh tempo pada {tanggal}. Mohon menyiapkan pembayaran. Terima kasih.",
  },
  h3: {
    name: "Pengingat Tagihan H-3",
    body: "Yth {nama}, tagihan internet Anda sebesar {jumlah} akan jatuh tempo dalam 3 hari ({tanggal}). Mohon segera melakukan pembayaran agar layanan tetap aktif. Terima kasih.",
  },
  h1: {
    name: "Pengingat Tagihan H-1",
    body: "Yth {nama}, ini pengingat terakhir: tagihan internet Anda sebesar {jumlah} jatuh tempo besok ({tanggal}). Segera lakukan pembayaran untuk menghindari isolir. Terima kasih.",
  },
  isolir: {
    name: "Pemberitahuan Isolir",
    body: "Yth {nama}, koneksi internet Anda telah diisolir karena belum melakukan pembayaran tagihan sebesar {jumlah} (jatuh tempo {tanggal}). Hubungi admin untuk informasi dan cara pembayaran. Terima kasih.",
  },
}

/**
 * Ambil template pesan reminder berdasarkan tipe (H-7/H-3/H-1/Isolir).
 * Prioritas:
 *   1. Template di DB dengan nama mengandung keyword tipe tersebut
 *   2. Template pertama di DB (jika ada, agar admin bisa atur satu template umum)
 *   3. Fallback pesan default per-tipe (hardcoded) — hanya jika tabel wa_templates kosong
 */
export async function getReminderTemplate(
  app: FastifyInstance,
  type: ReminderType,
): Promise<{ id: number; name: string; body: string }> {
  const rows = (await app.db.query("SELECT * FROM wa_templates ORDER BY id ASC")) as Record<string, unknown>[]

  // Tabel kosong -> gunakan fallback hardcoded per-tipe
  if (rows.length === 0) {
    const fallback = REMINDER_FALLBACK[type]
    return { id: 0, name: fallback.name, body: fallback.body }
  }

  const keywords = REMINDER_TYPE_KEYWORDS[type]
  const byName = rows.find((r) => {
    const n = String(r.name ?? "").toLowerCase()
    return keywords.some((kw) => n.includes(kw))
  })
  if (byName) {
    return { id: Number(byName.id), name: String(byName.name), body: String(byName.body) }
  }

  // Template spesifik tipe belum dibuat: pakai template pertama yang ada di DB
  const first = rows[0]
  return { id: Number(first.id), name: String(first.name), body: String(first.body) }
}

/** Helper delay (jeda antar-batch pengiriman massal). */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
