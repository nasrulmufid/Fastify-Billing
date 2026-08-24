import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import { completePaymentFlow } from "../services/payment.service.js"
import { fromISODate } from "../utils/date.js"

const PAYMENT_STATUS_ENUM = z.enum(["Sukses", "Pending", "Ditolak"])
const METHOD_ENUM = z.enum(["QRIS", "Tunai"])

const listQuerySchema = z.object({
  status: PAYMENT_STATUS_ENUM.optional(),
  method: METHOD_ENUM.optional(),
})

const noteSchema = z.object({ statusNote: z.string().optional() })

const SQL_SELECT = `
  SELECT p.*, c.name AS customer_name, i.code AS invoice_code
  FROM payments p
  LEFT JOIN customers c ON c.id = p.customer_id
  LEFT JOIN invoices i ON i.id = p.invoice_id
`

function mapPayment(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    customer: row.customer_name ?? "",
    customerId: row.customer_id,
    invoice: row.invoice_code ?? "",
    invoiceId: row.invoice_id,
    method: row.method,
    amount: Number(row.amount),
    date: fromISODate(row.paid_at as string | undefined),
    status: row.status,
    gatewayRef: row.gateway_ref,
    statusNote: row.status_note,
  }
}

export async function paymentsRoutes(app: FastifyInstance) {
  // Parser JSON toleran body kosong (POST /payments/:id/resend tanpa body, header json dr axios)
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    try {
      const text = String(body ?? "").trim()
      done(null, text ? JSON.parse(text) : {})
    } catch (err) {
      done(err as Error)
    }
  })

  const auth = {
    onRequest: [app.authenticate],
    preHandler: [app.requireRoles(["super_admin", "admin", "finance"])],
  }

  // GET /payments
  app.get("/payments", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = listQuerySchema.parse(req.query)
    const where: string[] = []
    const params: unknown[] = []
    if (q.status) {
      where.push("p.status = ?")
      params.push(q.status)
    }
    if (q.method) {
      where.push("p.method = ?")
      params.push(q.method)
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : ""
    const rows = (await app.db.query(`${SQL_SELECT} ${clause} ORDER BY p.id DESC`, params)) as Record<
      string,
      unknown
    >[]
    return reply.send({ data: rows.map(mapPayment) })
  })

  // GET /payments/approval — queue Pending
  app.get("/payments/approval", auth, async (req, reply) => {
    const rows = (await app.db.query(
      `${SQL_SELECT} WHERE p.status = 'Pending' ORDER BY p.id ASC`,
    )) as Record<string, unknown>[]
    return reply.send({ data: rows.map(mapPayment) })
  })

  // GET /payments/:id
  app.get("/payments/:id", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const [row] = (await app.db.query(`${SQL_SELECT} WHERE p.id = ? LIMIT 1`, [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Pembayaran tidak ditemukan" } })
    }
    return reply.send({ data: mapPayment(row) })
  })

  // POST /payments — catat pembayaran manual (Tunai)
  app.post("/payments", auth, async (req, reply) => {
    const body = z
      .object({
        customerId: z.coerce.number().min(1),
        invoiceId: z.coerce.number().optional().nullable(),
        method: METHOD_ENUM.default("Tunai"),
        amount: z.coerce.number().min(1),
      })
      .parse(req.body)

    const result = await app.db.transaction(async (q) => {
      const { nextCode } = await import("../utils/codegen.js")
      const pyCode = await nextCode(q.query, "payments", "PY-")
      const { toDbDateTime } = await import("../utils/date.js")
      const pRes = (await q.query(
        "INSERT INTO payments (code, customer_id, invoice_id, method, amount, paid_at, status) VALUES (?, ?, ?, ?, ?, ?, 'Pending')",
        [pyCode, body.customerId, body.invoiceId ?? null, body.method, body.amount, toDbDateTime(new Date())],
      )) as unknown as { insertId: number }
      return completePaymentFlow(q, pRes.insertId, body.method, "Admin", app)
    })

    return reply.code(201).send({ data: result })
  })

  // POST /payments/:id/approve — tandai Sukses (transaksi)
  app.post("/payments/:id/approve", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const body = noteSchema.parse(req.body)
    const result = await app.db.transaction(async (q) => {
      if (body.statusNote) {
        await q.query("UPDATE payments SET status_note = ? WHERE id = ?", [body.statusNote, id])
      }
      return completePaymentFlow(q, id, "QRIS", "Admin", app)
    })
    return reply.send({ data: result })
  })

  // POST /payments/:id/reject
  app.post("/payments/:id/reject", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const body = noteSchema.parse(req.body)
    await app.db.query("UPDATE payments SET status = 'Ditolak', status_note = ? WHERE id = ?", [
      body.statusNote ?? "Pembayaran ditolak",
      id,
    ])
    const [row] = (await app.db.query(`${SQL_SELECT} WHERE p.id = ?`, [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Pembayaran tidak ditemukan" } })
    }
    return reply.send({ data: mapPayment(row) })
  })

  // DELETE /payments/:id — hapus pembayaran (hard delete)
  app.delete("/payments/:id", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const [row] = (await app.db.query("SELECT id FROM payments WHERE id = ?", [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Pembayaran tidak ditemukan" } })
    }
    await app.db.query("DELETE FROM payments WHERE id = ?", [id])
    return reply.send({ data: { message: "Pembayaran dihapus" } })
  })

  // POST /payments/:id/resend — kirim ulang notifikasi (log Gagal -> Terkirim)
  app.post("/payments/:id/resend", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const [row] = (await app.db.query("SELECT * FROM payments WHERE id = ?", [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Pembayaran tidak ditemukan" } })
    }
    await app.db.query(
      "INSERT INTO notification_logs (code, type, customer_id, channel, status) SELECT CONCAT('NT-', LPAD((SELECT COUNT(*) FROM notification_logs)+1000, 4, '0')), 'payment', ?, 'WhatsApp', 'Terkirim'",
      [row.customer_id],
    )
    return reply.send({ data: { message: "Notifikasi dikirim ulang" } })
  })
}
