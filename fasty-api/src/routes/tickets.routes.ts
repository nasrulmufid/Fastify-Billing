import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import { nextCode } from "../utils/codegen.js"
import { fromISODate } from "../utils/date.js"

const TICKET_STATUS_ENUM = z.enum(["Dibuka", "Diproses", "Selesai"])

const listQuerySchema = z.object({ status: TICKET_STATUS_ENUM.optional() })

const createTicketSchema = z.object({
  customerId: z.coerce.number().min(1),
  title: z.string().min(3, "Judul minimal 3 karakter"),
  category: z.string().min(1, "Kategori wajib diisi"),
  description: z.string().optional(),
})

const statusSchema = z.object({
  status: TICKET_STATUS_ENUM,
  note: z.string().optional(),
})

const noteSchema = z.object({ note: z.string().min(1, "Catatan wajib diisi") })

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

export async function ticketsRoutes(app: FastifyInstance) {
  const auth = {
    onRequest: [app.authenticate],
    preHandler: [app.requireRoles(["super_admin", "admin", "teknisi"])],
  }

  const SQL_SELECT = `
    SELECT t.*, c.name AS customer_name
    FROM tickets t LEFT JOIN customers c ON c.id = t.customer_id
  `

  // GET /tickets
  app.get("/tickets", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = listQuerySchema.parse(req.query)
    const where = q.status ? "WHERE t.status = ?" : ""
    const params = q.status ? [q.status] : []
    const rows = (await app.db.query(`${SQL_SELECT} ${where} ORDER BY t.id DESC`, params)) as Record<
      string,
      unknown
    >[]
    return reply.send({ data: rows.map(mapTicket) })
  })

  // GET /tickets/:id (+ timeline)
  app.get("/tickets/:id", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const [row] = (await app.db.query(`${SQL_SELECT} WHERE t.id = ? LIMIT 1`, [
      id,
    ])) as Record<string, unknown>[]
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

  // POST /tickets — buat tiket + timeline entry "Dibuka" (aktor Sistem)
  app.post("/tickets", auth, async (req, reply) => {
    const body = createTicketSchema.parse(req.body)
    const code = await app.db.transaction(async (q) => {
      return nextCode(q.query, "tickets", "TCK-")
    })
    const result = (await app.db.query(
      "INSERT INTO tickets (code, customer_id, title, category, description, status) VALUES (?, ?, ?, ?, ?, 'Dibuka')",
      [code, body.customerId, body.title, body.category, body.description ?? ""],
    )) as unknown as { insertId: number }
    await app.db.query(
      "INSERT INTO ticket_timeline (ticket_id, status, actor, note) VALUES (?, 'Dibuka', 'Sistem', 'Tiket dibuat otomatis oleh sistem berdasarkan laporan pelanggan.')",
      [result.insertId],
    )
    const [row] = (await app.db.query(`${SQL_SELECT} WHERE t.id = ?`, [
      result.insertId,
    ])) as Record<string, unknown>[]
    return reply.code(201).send({ data: mapTicket(row) })
  })

  // PUT /tickets/:id/status — setStatus + timeline entry (aktor Admin)
  app.put("/tickets/:id/status", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const body = statusSchema.parse(req.body)
    await app.db.query("UPDATE tickets SET status = ? WHERE id = ?", [body.status, id])
    await app.db.query(
      "INSERT INTO ticket_timeline (ticket_id, status, actor, note) VALUES (?, ?, 'Admin', ?)",
      [id, body.status, body.note?.trim() || `Status tiket diubah menjadi ${body.status} oleh admin.`],
    )
    const [row] = (await app.db.query(`${SQL_SELECT} WHERE t.id = ?`, [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Tiket tidak ditemukan" } })
    }
    return reply.send({ data: mapTicket(row) })
  })

  // POST /tickets/:id/notes — addNote (timeline tanpa ubah status)
  app.post("/tickets/:id/notes", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const body = noteSchema.parse(req.body)
    const [row] = (await app.db.query("SELECT status FROM tickets WHERE id = ?", [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Tiket tidak ditemukan" } })
    }
    await app.db.query(
      "INSERT INTO ticket_timeline (ticket_id, status, actor, note) VALUES (?, ?, 'Admin', ?)",
      [id, row.status, body.note],
    )
    return reply.send({ data: { message: "Catatan ditambahkan" } })
  })
}
