import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import { fromISODate } from "../utils/date.js"

const STATUS_ENUM = z.enum(["Terkirim", "Gagal"])
const listQuerySchema = z.object({ status: STATUS_ENUM.optional() })

function mapLog(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    customer: row.customer_name ?? "",
    customerId: row.customer_id,
    channel: row.channel,
    status: row.status,
    seenAt: row.seen_at ?? null,
    time: fromISODate(row.sent_at as string | undefined),
    error: row.error,
  }
}

export async function notificationsRoutes(app: FastifyInstance) {
  // Parser JSON toleran body kosong (POST /notifications/:id/resend tanpa body)
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    try {
      const text = String(body ?? "").trim()
      done(null, text ? JSON.parse(text) : {})
    } catch (err) {
      done(err as Error)
    }
  })

  const auth = { onRequest: [app.authenticate] }

  const SQL_SELECT = `
    SELECT n.*, c.name AS customer_name
    FROM notification_logs n LEFT JOIN customers c ON c.id = n.customer_id
  `

  // GET /notifications
  app.get("/notifications", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = listQuerySchema.parse(req.query)
    const where = q.status ? "WHERE n.status = ?" : ""
    const params = q.status ? [q.status] : []
    const rows = (await app.db.query(`${SQL_SELECT} ${where} ORDER BY n.id DESC`, params)) as Record<
      string,
      unknown
    >[]
    return reply.send({ data: rows.map(mapLog) })
  })

  // POST /notifications/:id/resend — Gagal -> Terkirim
  app.post("/notifications/:id/resend", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    await app.db.query("UPDATE notification_logs SET status = 'Terkirim', error = NULL WHERE id = ?", [id])
    const [row] = (await app.db.query(`${SQL_SELECT} WHERE n.id = ?`, [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Notifikasi tidak ditemukan" } })
    }
    return reply.send({ data: mapLog(row) })
  })

  // POST /notifications/read-all — tandai semua notifikasi sudah dibaca (seen_at = NOW)
  app.post("/notifications/read-all", auth, async (_req: FastifyRequest, reply: FastifyReply) => {
    await app.db.query("UPDATE notification_logs SET seen_at = NOW() WHERE seen_at IS NULL")
    return reply.send({ data: { ok: true } })
  })

  // POST /notifications/:id/read — tandai satu notifikasi sudah dibaca
  app.post("/notifications/:id/read", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    await app.db.query("UPDATE notification_logs SET seen_at = NOW() WHERE id = ? AND seen_at IS NULL", [id])
    const [row] = (await app.db.query(`${SQL_SELECT} WHERE n.id = ?`, [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Notifikasi tidak ditemukan" } })
    }
    return reply.send({ data: mapLog(row) })
  })
}
