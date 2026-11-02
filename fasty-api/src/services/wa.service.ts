import type { FastifyInstance } from "fastify"

import { nextCode, nextDailyCode } from "../utils/codegen.js"
import { config } from "../config.js"
import { normalizePhone } from "../utils/phone.js"
import { createSumopodPayment } from "../utils/sumopod.js"
import { sendWhatsAppMessage as baileysSend } from "./baileys.service.js"

export type SendResult = Awaited<ReturnType<typeof baileysSend>>

export interface SendMessageInput {
  phone: string
  message: string
}

/** Wrapper sendWhatsAppMessage — gunakan Baileys */
export async function sendWhatsAppMessage(
  app: FastifyInstance,
  input: SendMessageInput,
): Promise<SendResult> {
  return baileysSend(app, input)
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
  const apiKey = config.sumopod.apiKey.trim()
  if (!apiKey) return null

  const [existing] = (await app.db.query(
    "SELECT * FROM payments WHERE invoice_id = ? AND status = 'Pending' ORDER BY id DESC LIMIT 1",
    [invoice.invoice_id],
  )) as Record<string, unknown>[]
  let payment = existing
  if (!payment) {
    const code = await app.db.transaction(async (q) => nextDailyCode(q.query, "payments", "IQ-"))
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

export async function getReminderTemplate(
  app: FastifyInstance,
  type: ReminderType,
): Promise<{ id: number; name: string; body: string }> {
  const rows = (await app.db.query("SELECT * FROM wa_templates ORDER BY id ASC")) as Record<string, unknown>[]

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

  const first = rows[0]
  return { id: Number(first.id), name: String(first.name), body: String(first.body) }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const DEFAULT_OFFLINE_MESSAGE =
  "Yth {nama}, pembayaran Anda sebesar {jumlah} melalui {metode} telah kami terima. Terima kasih.\n\n" +
  "Saat ini Server sedang down biasanya karena PLN Off, anda jangan khawatir, pembayaran anda tetap kami terima " +
  "dan internet akan kembali normal setelah Server Online."

export interface OfflineMessageTemplate {
  id: number
  name: string
  body: string
}

export async function getOfflineMessage(app: FastifyInstance): Promise<OfflineMessageTemplate> {
  const [row] = (await app.db.query("SELECT offline_message FROM wa_api_config WHERE id = 1")) as Record<
    string,
    unknown
  >[]
  const custom = String(row?.offline_message ?? "").trim()
  if (custom) return { id: 0, name: "Server Offline (custom)", body: custom }

  const rows = (await app.db.query("SELECT * FROM wa_templates ORDER BY id ASC")) as Record<string, unknown>[]
  const keywords = ["offline", "server down", "server off", "pln"]
  const byName = rows.find((r) => {
    const n = String(r.name ?? "").toLowerCase()
    return keywords.some((kw) => n.includes(kw))
  })
  if (byName) {
    return { id: Number(byName.id), name: String(byName.name), body: String(byName.body) }
  }

  return { id: 0, name: "Server Offline (default)", body: DEFAULT_OFFLINE_MESSAGE }
}
