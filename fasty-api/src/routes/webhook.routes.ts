import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"

import { completePaymentFlow } from "../services/payment.service.js"
import { notifyTelegram } from "../services/telegram.service.js"
import { config } from "../config.js"
import { decryptSecret } from "../utils/crypto.js"
import { verifyWebhookSignature, verifyWebhookToken } from "../utils/sumopod.js"

/**
 * POST /api/webhook/payment — Public (diverifikasi signature/token).
 * WAJIB raw body (content-type parser buffer) agar signature Svix cocok.
 */
export async function webhookRoutes(app: FastifyInstance) {
  // Content-type parser scoped HANYA utk route webhook ini (raw buffer, bukan JSON parsed)
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
    done(null, body)
  })

  /** Baca secret webhook dari DB (konfigurasi UI) — fallback ke env. */
  async function getWebhookSecrets() {
    const [row] = (await app.db.query("SELECT * FROM payment_gateway_config WHERE id = 1")) as Record<
      string,
      unknown
    >[]
    if (!row) {
      return {
        webhookSecret: config.sumopod.webhookSecret,
        webhookToken: config.sumopod.webhookToken,
      }
    }
    return {
      webhookSecret:
        decryptSecret(String(row.webhook_signing_secret ?? "")) || config.sumopod.webhookSecret,
      webhookToken:
        decryptSecret(String(row.webhook_token ?? "")) || config.sumopod.webhookToken,
    }
  }

  /** Data pelanggan + invoice utk variabel notifikasi Telegram. */
  async function loadNotifyContext(customerId: unknown) {
    const [ctx] = (await app.db.query(
      `SELECT c.name AS customer_name, p.name AS package_name
       FROM customers c LEFT JOIN packages p ON p.id = c.package_id
       WHERE c.id = ?`,
      [customerId],
    )) as Record<string, unknown>[]
    return ctx ?? {}
  }

  app.post("/webhook/payment", async (req: FastifyRequest, reply: FastifyReply) => {
    const rawBody = (req.body as Buffer)?.toString("utf8") ?? ""
    if (!rawBody) {
      return reply.code(400).send({ error: { code: "EMPTY_BODY", message: "Body kosong" } })
    }

    const secrets = await getWebhookSecrets()

    // Verifikasi: token ATAU signature Svix (cukup salah satu cocok)
    const headers = req.headers
    const tokenOk = verifyWebhookToken(
      headers["x-webhook-token"] as string | undefined,
      secrets.webhookToken || undefined,
    )
    const sigOk = verifyWebhookSignature(
      secrets.webhookSecret,
      headers["svix-id"] as string | undefined,
      headers["svix-timestamp"] as string | undefined,
      headers["svix-signature"] as string | undefined,
      rawBody,
    )

    // Webhook test dari SumoPod ("Save & Test") tidak menyertakan signature valid —
    // jika secret belum dikonfigurasi, tetap balas 2xx supaya test sukses.
    const hasConfiguredSecret = Boolean(secrets.webhookSecret || secrets.webhookToken)

    if (!tokenOk && !sigOk && hasConfiguredSecret) {
      return reply.code(401).send({ error: { code: "INVALID_SIGNATURE", message: "Signature webhook tidak valid" } })
    }

    let event: { event_type?: string; data?: Record<string, unknown> }
    try {
      event = JSON.parse(rawBody)
    } catch {
      return reply.code(400).send({ error: { code: "INVALID_JSON", message: "Body bukan JSON valid" } })
    }

    const eventType = event.event_type ?? ""
    const paymentId = String(event.data?.payment_id ?? "")

    // Idempotent: cari payment berdasarkan gateway_ref
    const [payment] = (await app.db.query("SELECT * FROM payments WHERE gateway_ref = ? LIMIT 1", [
      paymentId,
    ])) as Record<string, unknown>[]
    if (!payment) {
      req.log.warn({ eventType, paymentId }, "Webhook utk payment yang tidak dikenal")
      return reply.send({ data: { ok: true, matched: false } })
    }

    switch (eventType) {
      case "payment.completed": {
        const result = await app.db.transaction(async (q) =>
          completePaymentFlow(q, String(payment.id), "QRIS", "Sistem", app),
        )
        // Notifikasi Telegram "Transaksi Sukses" dikirim dari completePaymentFlow
        // (single source of truth utk semua metode: QRIS & Tunai) — tidak di sini.
        return reply.send({ data: { ok: true, matched: true, payment: result.payment.code } })
      }
      case "payment.failed":
      case "payment.expired": {
        await app.db.query("UPDATE payments SET status = 'Ditolak' WHERE id = ?", [payment.id])
        // Notifikasi Telegram: gagal / kadaluarsa (fire-and-forget)
        const isExpired = eventType === "payment.expired"
        setImmediate(() => {
          void (async () => {
            const ctx = await loadNotifyContext(payment.customer_id)
            await notifyTelegram(app, {
              type: isExpired ? "paymentExpired" : "paymentFailed",
              vars: {
                customerId: String(payment.customer_id ?? ""),
                nama: String(ctx.customer_name ?? ""),
                paket: String(ctx.package_name ?? ""),
                kode: String(payment.code ?? ""),
                jumlah: String(payment.amount ?? ""),
                metode: "QRIS",
                tanggal: new Date().toLocaleString("id-ID"),
              },
            })
          })().catch(() => {})
        })
        return reply.send({
          data: { ok: true, matched: true, status: isExpired ? "Expired" : "Ditolak" },
        })
      }
      case "payment.test":
        return reply.send({ data: { ok: true, test: true } })
      default:
        req.log.warn({ eventType }, "Event webhook tidak dikenal")
        return reply.send({ data: { ok: true, matched: false } })
    }
  })
}
