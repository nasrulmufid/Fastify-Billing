import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import { completePaymentFlow } from "../services/payment.service.js"
import { nextCode } from "../utils/codegen.js"
import { fromISODate, toISODate, toDbDateTime } from "../utils/date.js"

const INVOICE_STATUS_ENUM = z.enum(["Paid", "Unpaid", "Overdue"])
const METHOD_ENUM = z.enum(["QRIS", "Tunai"])

const listQuerySchema = z.object({
  status: INVOICE_STATUS_ENUM.optional(),
  period: z.string().optional(),
  customerId: z.coerce.number().optional(),
})

const createInvoiceSchema = z.object({
  customerId: z.coerce.number().min(1),
  amount: z.coerce.number().min(1),
  period: z.string().min(1, "Periode wajib diisi"),
})

const markPaidSchema = z.object({ method: METHOD_ENUM.default("Tunai") })

const SQL_SELECT = `
  SELECT i.*, c.name AS customer_name
  FROM invoices i
  LEFT JOIN customers c ON c.id = i.customer_id
`

function mapInvoice(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    customer: row.customer_name ?? "",
    amount: Number(row.amount),
    status: row.status,
    period: row.period,
    paymentMethod: row.payment_method,
    paymentCode: row.payment_code,
    due: fromISODate(row.due_at as string | undefined),
  }
}

export async function invoicesRoutes(app: FastifyInstance) {
  const auth = {
    onRequest: [app.authenticate],
    preHandler: [app.requireRoles(["super_admin", "admin", "finance"])],
  }

  // GET /invoices
  app.get("/invoices", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = listQuerySchema.parse(req.query)
    const where: string[] = []
    const params: unknown[] = []
    if (q.status) {
      where.push("i.status = ?")
      params.push(q.status)
    }
    if (q.period) {
      where.push("i.period = ?")
      params.push(q.period)
    }
    if (q.customerId) {
      where.push("i.customer_id = ?")
      params.push(q.customerId)
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : ""
    const rows = (await app.db.query(`${SQL_SELECT} ${clause} ORDER BY i.id DESC`, params)) as Record<
      string,
      unknown
    >[]
    return reply.send({ data: rows.map(mapInvoice) })
  })

  // GET /invoices/:id
  app.get("/invoices/:id", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const [row] = (await app.db.query(`${SQL_SELECT} WHERE i.id = ? LIMIT 1`, [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Invoice tidak ditemukan" } })
    }
    return reply.send({ data: mapInvoice(row) })
  })

  // POST /invoices
  app.post("/invoices", auth, async (req, reply) => {
    const body = createInvoiceSchema.parse(req.body)
    const code = await app.db.transaction(async (q) => {
      return nextCode(q.query, "invoices", "INV-")
    })
    const result = await app.db.query(
      "INSERT INTO invoices (code, customer_id, amount, status, period) VALUES (?, ?, ?, 'Unpaid', ?)",
      [code, body.customerId, body.amount, body.period],
    ) as unknown as { insertId: number }
    const [row] = (await app.db.query(`${SQL_SELECT} WHERE i.id = ?`, [
      result.insertId,
    ])) as Record<string, unknown>[]
    return reply.code(201).send({ data: mapInvoice(row) })
  })

  // POST /invoices/:id/mark-paid — pembayaran manual (transaksi)
  app.post("/invoices/:id/mark-paid", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const body = markPaidSchema.parse(req.body)

    const result = await app.db.transaction(async (q) => {
      const [invoice] = (await q.query("SELECT * FROM invoices WHERE id = ?", [
        id,
      ])) as Record<string, unknown>[]
      if (!invoice) {
        const err = new Error("Invoice tidak ditemukan") as Error & { statusCode?: number }
        err.statusCode = 404
        throw err
      }
      if (invoice.status === "Paid") {
        const err = new Error("Invoice sudah lunas") as Error & { statusCode?: number }
        err.statusCode = 422
        throw err
      }

      // Buat payment lalu selesaikan dalam transaksi yang sama.
      const pyCode = await nextCode(q.query, "payments", "PY-")
      const pRes = (await q.query(
        "INSERT INTO payments (code, customer_id, invoice_id, method, amount, paid_at, status) VALUES (?, ?, ?, ?, ?, ?, 'Pending')",
        [pyCode, invoice.customer_id, invoice.id, body.method, invoice.amount, toDbDateTime(new Date())],
      )) as unknown as { insertId: number }

      return completePaymentFlow(q, pRes.insertId, body.method, "Admin", app)
    })

    return reply.send({ data: result })
  })

  // DELETE /invoices/:id
  app.delete("/invoices/:id", auth, async (req, reply) => {
    const { id } = req.params as { id: string }
    await app.db.query("DELETE FROM invoices WHERE id = ?", [id])
    return reply.send({ data: { message: "Invoice dihapus" } })
  })
}
