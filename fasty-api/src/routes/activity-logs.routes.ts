import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import { fromISODate } from "../utils/date.js"

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

function mapLog(row: Record<string, unknown>) {
  return {
    id: row.id,
    actor: row.actor,
    action: row.action,
    target: row.target,
    time: fromISODate(row.created_at as string | undefined),
  }
}

export async function activityLogsRoutes(app: FastifyInstance) {
  const auth = {
    onRequest: [app.authenticate],
    preHandler: [app.requireRoles(["super_admin", "admin", "teknisi"])],
  }

  app.get("/activity-logs", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = listQuerySchema.parse(req.query)
    const [countRow] = (await app.db.query(
      "SELECT COUNT(*) AS total FROM activity_logs",
    )) as Record<string, unknown>[]
    const total = Number(countRow?.total ?? 0)
    const rows = (await app.db.query(
      "SELECT * FROM activity_logs ORDER BY id DESC LIMIT ? OFFSET ?",
      [q.limit, (q.page - 1) * q.limit],
    )) as Record<string, unknown>[]
    return reply.send({
      data: rows.map(mapLog),
      meta: { page: q.page, limit: q.limit, total },
    })
  })
}
