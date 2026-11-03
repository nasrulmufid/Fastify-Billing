import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import { maskSecret } from "../utils/crypto.js"
import { createSumopodPayment } from "../utils/sumopod.js"
import { config } from "../config.js"

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

async function getStoredConfig(_app: FastifyInstance) {
  return {
    apiKey: config.sumopod.apiKey,
    webhookSigningSecret: config.sumopod.webhookSecret,
    webhookToken: config.sumopod.webhookToken,
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
        sumopodUrl: config.sumopod.baseUrl,
        apiKey: cfg ? maskSecret(cfg.apiKey) : "",
        webhookSigningSecret: cfg ? maskSecret(cfg.webhookSigningSecret) : "",
        webhookToken: cfg ? maskSecret(cfg.webhookToken) : "",
      },
    })
  })

  // PUT /payment-gateway/config — simpan terenkripsi; field kosong = pertahankan lama
  app.put("/payment-gateway/config", adminAuth, async (_req, reply) =>
    reply.code(405).send({
      error: { code: "ENV_ONLY", message: "Konfigurasi SumoPod hanya dapat diatur melalui environment variables" },
    }),
  )

  // POST /payment-gateway/test — tes koneksi
  app.post("/payment-gateway/test", adminAuth, async (req, reply) => {
    const cfg = await getStoredConfig(app)
    if (!cfg?.apiKey) {
      return reply.code(400).send({
        error: { code: "NOT_CONFIGURED", message: "API Key wajib diisi terlebih dahulu" },
      })
    }
    try {
      const baseUrl = config.sumopod.baseUrl.replace(/\/$/, "")
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      let response: Response
      try {
        response = await fetch(`${baseUrl}/api/v1/payments`, {
          method: "GET",
          headers: { Accept: "application/json", "X-Api-Key": cfg.apiKey },
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeout)
      }

      const connected = response.status < 500
      if (!connected) {
        app.log.warn({ status: response.status, baseUrl }, "SumoPod connection test returned server error")
      }
      return reply.send({ data: { connected, status: response.status } })
    } catch (err) {
      app.log.warn({
        error: err instanceof Error ? err.message : String(err),
        cause: err instanceof Error && err.cause ? String(err.cause) : undefined,
        baseUrl: config.sumopod.baseUrl,
      }, "SumoPod connection test failed")
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
