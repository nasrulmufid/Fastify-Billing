import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import { nextCode } from "../utils/codegen.js"
import { decryptSecret } from "../utils/crypto.js"
import { fromISODate } from "../utils/date.js"
import { createSumopodPayment } from "../utils/sumopod.js"

/**
 * Routes portal pelanggan — semua endpoint memakai JWT customer
 * (role "customer", sub = customer.id). Data selalu dibatasi ke customer sendiri.
 */

const CUSTOMER_STATUS_ENUM = z.enum(["Active", "Isolated", "Pending"])

const createTicketSchema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter"),
  category: z.string().min(1, "Kategori wajib diisi"),
  description: z.string().optional(),
})

const createQrisSchema = z.object({
  invoiceId: z.coerce.number().min(1, "Invoice wajib dipilih"),
})

function publicCustomer(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    packageId: row.package_id,
    packageName: row.package_name ?? "",
    routerId: row.router_id,
    router: row.router_name ?? "",
    status: row.status,
    ipAddress: row.ip_address,
    loginUsername: row.login_username,
    lastPayment: fromISODate(row.last_payment_at as string | undefined) || null,
    expiryDate: fromISODate(row.expiry_at as string | undefined),
    joinDate: fromISODate(row.join_at as string | undefined),
  }
}

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

function mapPayment(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    customer: row.customer_name ?? "",
    invoice: row.invoice_code ?? "",
    method: row.method,
    amount: Number(row.amount),
    date: fromISODate(row.paid_at as string | undefined),
    status: row.status,
    statusNote: row.status_note,
  }
}

function mapTicket(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    customer: row.customer_name ?? "",
    customerId: row.customer_id,
    title: row.title,
    category: row.category,
    description: row.description,
    status: row.status,
    date: fromISODate(row.created_at as string | undefined),
    updatedAt: fromISODate(row.updated_at as string | undefined),
  }
}

/** Baca konfigurasi payment gateway (dekripsi). null jika belum diset. */
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

export async function portalRoutes(app: FastifyInstance) {
  const customerAuth = {
    onRequest: [app.authenticate],
    preHandler: [app.requireRoles(["customer"])],
  }

  /** Ambil customer.id dari JWT (sub). */
  const customerId = (req: FastifyRequest): string => {
    const payload = req.user as { sub?: string | number }
    return String(payload?.sub ?? "")
  }

  // GET /portal/me — profil pelanggan
  app.get("/portal/me", customerAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const [row] = (await app.db.query(
      `SELECT c.*, p.name AS package_name, r.name AS router_name
       FROM customers c
       LEFT JOIN packages p ON p.id = c.package_id
       LEFT JOIN routers r ON r.id = c.router_id
       WHERE c.id = ? LIMIT 1`,
      [customerId(req)],
    )) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Pelanggan tidak ditemukan" } })
    }
    return reply.send({ data: publicCustomer(row) })
  })

  // GET /portal/invoices — tagihan milik pelanggan
  app.get("/portal/invoices", customerAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const rows = (await app.db.query(
      `SELECT i.*, c.name AS customer_name
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.customer_id = ? ORDER BY i.id DESC`,
      [customerId(req)],
    )) as Record<string, unknown>[]
    return reply.send({ data: rows.map(mapInvoice) })
  })

  // GET /portal/invoices/:id — detail tagihan milik pelanggan
  app.get("/portal/invoices/:id", customerAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const [row] = (await app.db.query(
      `SELECT i.*, c.name AS customer_name
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.id = ? AND i.customer_id = ? LIMIT 1`,
      [id, customerId(req)],
    )) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Tagihan tidak ditemukan" } })
    }
    return reply.send({ data: mapInvoice(row) })
  })

  // GET /portal/payments — riwayat pembayaran milik pelanggan
  app.get("/portal/payments", customerAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const rows = (await app.db.query(
      `SELECT p.*, c.name AS customer_name, i.code AS invoice_code
       FROM payments p
       LEFT JOIN customers c ON c.id = p.customer_id
       LEFT JOIN invoices i ON i.id = p.invoice_id
       WHERE p.customer_id = ? ORDER BY p.id DESC`,
      [customerId(req)],
    )) as Record<string, unknown>[]
    return reply.send({ data: rows.map(mapPayment) })
  })

  // GET /portal/tickets — tiket milik pelanggan
  app.get("/portal/tickets", customerAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const rows = (await app.db.query(
      `SELECT t.*, c.name AS customer_name
       FROM tickets t
       LEFT JOIN customers c ON c.id = t.customer_id
       WHERE t.customer_id = ? ORDER BY t.id DESC`,
      [customerId(req)],
    )) as Record<string, unknown>[]
    return reply.send({ data: rows.map(mapTicket) })
  })

  // GET /portal/tickets/:id — detail tiket milik pelanggan (+ timeline)
  app.get("/portal/tickets/:id", customerAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const [row] = (await app.db.query(
      `SELECT t.*, c.name AS customer_name
       FROM tickets t
       LEFT JOIN customers c ON c.id = t.customer_id
       WHERE t.id = ? AND t.customer_id = ? LIMIT 1`,
      [id, customerId(req)],
    )) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Tiket tidak ditemukan" } })
    }
    const timeline = (await app.db.query(
      "SELECT * FROM ticket_timeline WHERE ticket_id = ? ORDER BY id ASC",
      [id],
    )) as Record<string, unknown>[]
    return reply.send({
      data: {
        ...mapTicket(row),
        timeline: timeline.map((tl) => ({
          status: tl.status,
          actor: tl.actor,
          date: fromISODate(tl.created_at as string | undefined),
          note: tl.note,
        })),
      },
    })
  })

  // POST /portal/tickets — buat tiket sebagai pelanggan (customerId dari JWT)
  app.post("/portal/tickets", customerAuth, async (req, reply) => {
    const body = createTicketSchema.parse(req.body)
    const customer = customerId(req)
    const code = await app.db.transaction(async (q) => {
      const [row] = (await q.query(
        "SELECT code FROM customers WHERE id = ? LIMIT 1",
        [customer],
      )) as Record<string, unknown>[]
      const prefix = row?.code ? `${String(row.code)}-` : "TCK-"
      const [cnt] = (await q.query(
        "SELECT COUNT(*) AS total FROM tickets WHERE customer_id = ?",
        [customer],
      )) as Record<string, unknown>[]
      return `${prefix}${Number(cnt?.total ?? 0) + 1}`
    })
    const result = (await app.db.query(
      "INSERT INTO tickets (code, customer_id, title, category, description, status) VALUES (?, ?, ?, ?, ?, 'Dibuka')",
      [code, customer, body.title, body.category, body.description ?? ""],
    )) as unknown as { insertId: number }
    await app.db.query(
      "INSERT INTO ticket_timeline (ticket_id, status, actor, note) VALUES (?, 'Dibuka', 'Sistem', 'Tiket dibuat otomatis oleh sistem berdasarkan laporan pelanggan.')",
      [result.insertId],
    )
    const [row] = (await app.db.query(
      `SELECT t.*, c.name AS customer_name
       FROM tickets t LEFT JOIN customers c ON c.id = t.customer_id
       WHERE t.id = ?`,
      [result.insertId],
    )) as Record<string, unknown>[]
    return reply.code(201).send({ data: mapTicket(row) })
  })

  // POST /portal/payments/create-qris — buat pembayaran QRIS via SumoPod utk satu invoice
  app.post("/portal/payments/create-qris", customerAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = createQrisSchema.parse(req.body)
    const cust = customerId(req)

    // Invoice harus milik customer & belum lunas
    const [invoice] = (await app.db.query(
      "SELECT * FROM invoices WHERE id = ? AND customer_id = ? LIMIT 1",
      [body.invoiceId, cust],
    )) as Record<string, unknown>[]
    if (!invoice) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Tagihan tidak ditemukan" } })
    }
    if (invoice.status === "Paid") {
      return reply.code(400).send({ error: { code: "ALREADY_PAID", message: "Tagihan ini sudah lunas" } })
    }

    // Pakai payment Pending yang sudah ada utk invoice ini, atau buat baru
    const [existing] = (await app.db.query(
      "SELECT * FROM payments WHERE invoice_id = ? AND status = 'Pending' ORDER BY id DESC LIMIT 1",
      [body.invoiceId],
    )) as Record<string, unknown>[]
    let payment: Record<string, unknown>
    if (existing) {
      payment = existing
    } else {
      const code = await app.db.transaction(async (q) => nextCode(q.query, "payments", "PY-"))
      const res = (await app.db.query(
        "INSERT INTO payments (code, customer_id, invoice_id, method, amount, status) VALUES (?, ?, ?, 'QRIS', ?, 'Pending')",
        [code, cust, body.invoiceId, Number(invoice.amount)],
      )) as unknown as { insertId: number }
      const [row] = (await app.db.query("SELECT * FROM payments WHERE id = ?", [
        res.insertId,
      ])) as Record<string, unknown>[]
      payment = row
    }

    const cfg = await getStoredConfig(app)
    if (!cfg?.apiKey) {
      return reply.code(400).send({
        error: { code: "NOT_CONFIGURED", message: "Payment gateway QRIS belum dikonfigurasi oleh admin" },
      })
    }

    try {
      const created = await createSumopodPayment({
        orderId: String(payment.code),
        amount: Number(invoice.amount),
        apiKey: cfg.apiKey,
      })
      await app.db.query("UPDATE payments SET gateway_ref = ? WHERE id = ?", [
        created.paymentId,
        payment.id,
      ])
      return reply.send({
        data: {
          paymentId: created.paymentId,
          paymentLinkUrl: created.paymentLinkUrl,
          amount: Number(invoice.amount),
          orderId: created.orderId,
          expiresAt: created.expiresAt,
        },
      })
    } catch (err) {
      req.log.error(err)
      return reply.code(502).send({
        error: { code: "SUMODOP_ERROR", message: "Gagal menghubungi SumoPod. Coba lagi nanti." },
      })
    }
  })
}
