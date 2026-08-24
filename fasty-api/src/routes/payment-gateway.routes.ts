import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import { decryptSecret, encryptSecret, maskSecret } from "../utils/crypto.js"
import { createSumopodPayment } from "../utils/sumopod.js"

const configSchema = z.object({
  apiKey: z.string().optional(),
  webhookSigningSecret: z.string().optional(),
  webhookToken: z.string().optional(),
})

const createPaymentSchema = z.object({
  orderId: z.string().min(1, "orderId wajib diisi"),
  amount: z.coerce.number().min(1, "amount wajib diisi"),
  expiresInHours: z.coerce.number().int().min(1).max(24).optional(),
})

async function getStoredConfig(app: FastifyInstance) {
  const [row] = (await app.db.query("SELECT * FROM payment_gateway_config WHERE id = 1")) as Record<
    string,
    unknown
  >[]
  if (!row) return null
  return {
    apiKey: decryptSecret(String(row.api_key ?? "")),
    webhookSigningSecret: decryptSecret(String(row.webhook_signing_secret ?? "")),
    webhookToken: decryptSecret(String(row.webhook_token ?? "")),
  }
}

export async function paymentGatewayRoutes(app: FastifyInstance) {
  const adminAuth = {
    onRequest: [app.authenticate],
    preHandler: [app.requireRoles(["super_admin", "admin"])],
  }

  // GET /payment-gateway/config — masked
  app.get("/payment-gateway/config", adminAuth, async (req, reply) => {
    const cfg = await getStoredConfig(app)
    const isConfigured = !!cfg?.apiKey
    return reply.send({
      data: {
        isConfigured,
        apiKey: cfg ? maskSecret(cfg.apiKey) : "",
        webhookSigningSecret: cfg ? maskSecret(cfg.webhookSigningSecret) : "",
        webhookToken: cfg ? maskSecret(cfg.webhookToken) : "",
      },
    })
  })

  // PUT /payment-gateway/config — simpan terenkripsi; field kosong = pertahankan lama
  app.put("/payment-gateway/config", adminAuth, async (req, reply) => {
    const body = configSchema.parse(req.body)
    const current = await getStoredConfig(app)
    const next = {
      apiKey: body.apiKey ? encryptSecret(body.apiKey) : current ? encryptSecret(current.apiKey) : "",
      webhookSigningSecret: body.webhookSigningSecret
        ? encryptSecret(body.webhookSigningSecret)
        : current
          ? encryptSecret(current.webhookSigningSecret)
          : "",
      webhookToken: body.webhookToken ? encryptSecret(body.webhookToken) : current ? encryptSecret(current.webhookToken) : "",
    }
    await app.db.query(
      `INSERT INTO payment_gateway_config (id, api_key, webhook_signing_secret, webhook_token) VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE api_key = VALUES(api_key), webhook_signing_secret = VALUES(webhook_signing_secret), webhook_token = VALUES(webhook_token)`,
      [next.apiKey, next.webhookSigningSecret, next.webhookToken],
    )
    return reply.send({ data: { message: "Konfigurasi payment gateway disimpan" } })
  })

  // POST /payment-gateway/test — tes koneksi
  app.post("/payment-gateway/test", adminAuth, async (req, reply) => {
    const cfg = await getStoredConfig(app)
    if (!cfg?.apiKey) {
      return reply.code(400).send({
        error: { code: "NOT_CONFIGURED", message: "API Key wajib diisi terlebih dahulu" },
      })
    }
    try {
      await fetch(`${process.env.SUMODOP_BASE_URL ?? "https://api-pay-sandbox.sumopod.com"}/api/v1/payments`, {
        method: "GET",
        headers: { "X-Api-Key": cfg.apiKey },
      })
      return reply.send({ data: { connected: true } })
    } catch {
      return reply.send({ data: { connected: false } })
    }
  })

  // POST /payment-gateway/create-payment — buat payment QRIS di SumoPod
  app.post("/payment-gateway/create-payment", adminAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = createPaymentSchema.parse(req.body)
    const cfg = await getStoredConfig(app)
    if (!cfg?.apiKey) {
      return reply.code(400).send({
        error: { code: "NOT_CONFIGURED", message: "API Key belum dikonfigurasi" },
      })
    }
    try {
      const created = await createSumopodPayment({
        orderId: body.orderId,
        amount: body.amount,
        expiresInHours: body.expiresInHours,
        apiKey: cfg.apiKey,
      })
      // Simpan payment_id ke payments.gateway_ref (jika order_id = kode invoice, cocokkan)
      await app.db.query(
        "UPDATE payments SET gateway_ref = ? WHERE code = ? OR invoice_id IN (SELECT id FROM invoices WHERE code = ?)",
        [created.paymentId, body.orderId, body.orderId],
      )
      return reply.send({
        data: {
          paymentId: created.paymentId,
          paymentLinkUrl: created.paymentLinkUrl,
          fee: created.fee,
          netAmount: created.netAmount,
          status: created.status,
          expiresAt: created.expiresAt,
        },
      })
    } catch (err) {
      req.log.error(err)
      return reply.code(502).send({
        error: { code: "SUMODOP_ERROR", message: "Gagal menghubungi SumoPod" },
      })
    }
  })
}
