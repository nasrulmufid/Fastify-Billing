import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

const settingsSchema = z.object({
  gracePeriodDays: z.coerce.number().int().min(1).max(60, "Grace period harus 1–60 hari").optional(),
  billingCycle: z.string().min(1).optional(),
})

export async function settingsRoutes(app: FastifyInstance) {
  const auth = {
    onRequest: [app.authenticate],
    preHandler: [app.requireRoles(["super_admin", "admin"])],
  }

  // GET /settings
  app.get("/settings", auth, async (req, reply) => {
    const [row] = (await app.db.query("SELECT * FROM app_settings WHERE id = 1")) as Record<
      string,
      unknown
    >[]
    return reply.send({
      data: {
        gracePeriodDays: Number(row?.grace_period_days ?? 7),
        billingCycle: String(row?.billing_cycle ?? "Setiap 1 bulan"),
      },
    })
  })

  // PUT /settings
  app.put("/settings", auth, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = settingsSchema.parse(req.body)
    await app.db.query(
      "INSERT INTO app_settings (id, grace_period_days, billing_cycle) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE grace_period_days = COALESCE(?, grace_period_days), billing_cycle = COALESCE(?, billing_cycle)",
      [
        body.gracePeriodDays ?? 7,
        body.billingCycle ?? "Setiap 1 bulan",
        body.gracePeriodDays ?? null,
        body.billingCycle ?? null,
      ],
    )
    return reply.send({ data: { message: "Pengaturan disimpan" } })
  })
}
