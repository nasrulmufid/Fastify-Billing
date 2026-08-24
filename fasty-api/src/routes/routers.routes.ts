import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import { decryptSecret, encryptSecret, maskSecret } from "../utils/crypto.js"
import { recordRouterWarning, testRouterConnection } from "../services/router.service.js"

/**
 * Validasi host — PERSIS regex frontend (RouterFormDialog HOST_RE):
 * IPv4 range-checked ATAU hostname/domain, + port opsional.
 * Label hostname tidak boleh seluruhnya angka (999.999.999.999 ditolak).
 */
export const HOST_RE =
  /^(?:(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)|(?![0-9]+(?:\.|:|$))[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*)(?::(?:[1-9]\d{0,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5]))?$/

const ROUTER_STATUS_ENUM = z.enum(["Connected", "Standby", "Disconnected"])

const createRouterSchema = z.object({
  name: z.string().min(3, "Nama router minimal 3 karakter"),
  host: z
    .string()
    .regex(HOST_RE, "Format tidak valid. Contoh: 192.168.2.1:177 atau idn24.tunnel.id:3025"),
  provider: z.string().min(1, "Pilih provider"),
  apiPort: z.coerce.number().int().min(1).max(65535).optional(),
  apiUseHttps: z.coerce.boolean().optional(),
  apiUser: z.string().min(1).optional(),
  apiPassword: z.string().min(1).optional(),
  ipPool: z
    .string()
    .regex(
      /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\/\d{1,2}$/,
      "Format CIDR tidak valid. Contoh: 192.168.200.0/24",
    )
    .optional()
    .or(z.literal("")),
})

const updateRouterSchema = createRouterSchema.partial()

function mapRouter(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    provider: row.provider,
    apiPort: row.api_port,
    apiUseHttps: Number(row.api_use_https ?? 0) === 1,
    apiUser: row.api_user,
    apiPassword: row.api_password ? maskSecret(decryptSecret(String(row.api_password))) : "",
    ipPool: row.ip_pool ?? "",
    status: row.status,
    clientCount: row.client_count,
    uptime: row.uptime,
  }
}

export async function routersRoutes(app: FastifyInstance) {
  const techAuth = {
    onRequest: [app.authenticate],
    preHandler: [app.requireRoles(["super_admin", "admin", "teknisi"])],
  }

  // GET /routers
  app.get("/routers", techAuth, async (req, reply) => {
    const rows = (await app.db.query("SELECT * FROM routers ORDER BY id ASC")) as Record<string, unknown>[]
    return reply.send({ data: rows.map(mapRouter) })
  })

  // POST /routers
  app.post("/routers", techAuth, async (req, reply) => {
    const body = createRouterSchema.parse(req.body)
    const result = (await app.db.query(
      `INSERT INTO routers (name, host, provider, api_port, api_use_https, api_user, api_password, ip_pool)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.name.trim(),
        body.host.trim(),
        body.provider,
        body.apiPort ?? 80,
        body.apiUseHttps ? 1 : 0,
        body.apiUser ?? "admin",
        body.apiPassword ? encryptSecret(body.apiPassword) : null,
        body.ipPool ? body.ipPool.trim() : null,
      ],
    )) as unknown as { insertId: number }
    const [row] = (await app.db.query("SELECT * FROM routers WHERE id = ?", [
      result.insertId,
    ])) as Record<string, unknown>[]
    return reply.code(201).send({ data: mapRouter(row) })
  })

  // PUT /routers/:id
  app.put("/routers/:id", techAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const body = updateRouterSchema.parse(req.body)
    // Password hanya di-update bila diisi (jangan overwrite dgn null/kosong)
    if (body.apiPassword) {
      await app.db.query(
        `UPDATE routers SET name = COALESCE(?, name), host = COALESCE(?, host),
           provider = COALESCE(?, provider), api_port = COALESCE(?, api_port),
           api_use_https = COALESCE(?, api_use_https), api_user = COALESCE(?, api_user),
           api_password = ?, ip_pool = COALESCE(?, ip_pool)
         WHERE id = ?`,
        [
          body.name ? body.name.trim() : null,
          body.host ? body.host.trim() : null,
          body.provider ?? null,
          body.apiPort ?? null,
          body.apiUseHttps !== undefined ? (body.apiUseHttps ? 1 : 0) : null,
          body.apiUser ?? null,
          encryptSecret(body.apiPassword),
          body.ipPool !== undefined ? (body.ipPool ? body.ipPool.trim() : null) : null,
          id,
        ],
      )
    } else {
      await app.db.query(
        `UPDATE routers SET name = COALESCE(?, name), host = COALESCE(?, host),
           provider = COALESCE(?, provider), api_port = COALESCE(?, api_port),
           api_use_https = COALESCE(?, api_use_https), api_user = COALESCE(?, api_user),
           ip_pool = COALESCE(?, ip_pool)
         WHERE id = ?`,
        [
          body.name ? body.name.trim() : null,
          body.host ? body.host.trim() : null,
          body.provider ?? null,
          body.apiPort ?? null,
          body.apiUseHttps !== undefined ? (body.apiUseHttps ? 1 : 0) : null,
          body.apiUser ?? null,
          body.ipPool !== undefined ? (body.ipPool ? body.ipPool.trim() : null) : null,
          id,
        ],
      )
    }
    const [row] = (await app.db.query("SELECT * FROM routers WHERE id = ?", [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Router tidak ditemukan" } })
    }
    return reply.send({ data: mapRouter(row) })
  })

  // DELETE /routers/:id
  app.delete("/routers/:id", techAuth, async (req, reply) => {
    const { id } = req.params as { id: string }
    await app.db.query("DELETE FROM routers WHERE id = ?", [id])
    return reply.send({ data: { message: "Router dihapus" } })
  })

  // POST /routers/:id/test — test koneksi nyata ke Mikrotik
  app.post("/routers/:id/test", techAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const [row] = (await app.db.query("SELECT * FROM routers WHERE id = ?", [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Router tidak ditemukan" } })
    }
    const { status, warning } = await testRouterConnection(app, Number(id))
    await app.db.query("UPDATE routers SET status = ? WHERE id = ?", [status, id])
    const payload: Record<string, unknown> = { data: { status } }
    if (warning) {
      await recordRouterWarning(app, { routerId: Number(id), action: "Test koneksi", warning })
      payload.warning = warning
    }
    return reply.send(payload)
  })

  // POST /routers/:id/sync — sinkron secret PPPoE pelanggan ke router
  app.post("/routers/:id/sync", techAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const [row] = (await app.db.query("SELECT * FROM routers WHERE id = ?", [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Router tidak ditemukan" } })
    }
    const customers = (await app.db.query(
      `SELECT c.pppoe_username, c.pppoe_password, c.status, c.ip_address, p.download_speed, p.upload_speed
       FROM customers c LEFT JOIN packages p ON p.id = c.package_id
       WHERE c.router_id = ? AND c.pppoe_username IS NOT NULL AND c.pppoe_username <> ''`,
      [id],
    )) as Record<string, unknown>[]

    const { withRouter } = await import("../services/router.service.js")
    const res = await withRouter(app, Number(id), async (client) => {
      const secrets = []
      for (const c of customers) {
        let profile: string | undefined
        if (c.download_speed && c.upload_speed) {
          profile = await client.ensurePppProfile(Number(c.download_speed), Number(c.upload_speed))
        }
        secrets.push({
          name: String(c.pppoe_username),
          password: String(c.pppoe_password ?? ""),
          profile,
          disabled: c.status !== "Active",
          localAddress: c.ip_address ? String(c.ip_address) : undefined,
        })
      }
      return client.syncSecrets(secrets)
    })

    if (res.ok) {
      await app.db.query("UPDATE routers SET client_count = ? WHERE id = ?", [res.data, id])
      return reply.send({ data: { syncedCount: res.data } })
    }
    await recordRouterWarning(app, { routerId: Number(id), action: "Sinkronisasi user", warning: res.warning })
    return reply.send({ data: { syncedCount: 0 }, warning: res.warning })
  })
}
