import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import { decryptSecret } from "../utils/crypto.js"
import { fromISODate } from "../utils/date.js"
import { sendDisconnect } from "../services/radius.service.js"
import { backfillRouter } from "../services/radius.service.js"

const CONFIG_KEY = "radius_config"

const nasSchema = z.object({
  routerId: z.coerce.number().min(1).optional(),
  nasname: z.string().min(3),
  shortname: z.string().min(1),
  secret: z.string().min(4).optional(),
  description: z.string().optional(),
})

const configSchema = z.object({
  host: z.string().min(1).optional(),
  authPort: z.coerce.number().int().min(1).max(65535).optional(),
  acctPort: z.coerce.number().int().min(1).max(65535).optional(),
  coaPort: z.coerce.number().int().min(1).max(65535).optional(),
  retentionDays: z.coerce.number().int().min(7).max(3650).optional(),
})

function mapSession(r: Record<string, unknown>) {
  return {
    id: r.radacctid,
    username: r.username,
    sessionId: r.acctsessionid,
    nasIp: r.nasipaddress,
    nasPort: r.nasportid,
    framedIp: r.framedipaddress,
    startTime: r.acctstarttime,
    sessionTime: Number(r.acctsessiontime ?? 0),
    inputOctets: Number(r.acctinputoctets ?? 0),
    outputOctets: Number(r.acctoutputoctets ?? 0),
    customerId: r.customer_id ?? null,
    customerName: r.customer_name ?? null,
  }
}

async function readConfig(app: FastifyInstance): Promise<Record<string, unknown>> {
  const [row] = (await app.db.query(
    "SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1",
    [CONFIG_KEY],
  )) as { setting_value: string }[]
  try {
    return row?.setting_value ? (JSON.parse(row.setting_value) as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export async function radiusRoutes(app: FastifyInstance): Promise<void> {
  const adminAuth = {
    onRequest: [app.authenticate],
    preHandler: [app.requireRoles(["super_admin", "admin"])],
  }
  const techAuth = {
    onRequest: [app.authenticate],
    preHandler: [app.requireRoles(["super_admin", "admin", "teknisi"])],
  }

  // GET /radius/sessions — sesi PPPoE aktif (acctstoptime IS NULL)
  app.get("/radius/sessions", techAuth, async (_req, reply) => {
    const rows = (await app.db.query(
      `SELECT ra.*, c.id AS customer_id, c.name AS customer_name
       FROM radacct ra LEFT JOIN customers c ON c.pppoe_username = ra.username
       WHERE ra.acctstoptime IS NULL ORDER BY ra.acctstarttime DESC`,
    )) as Record<string, unknown>[]
    return reply.send({ data: rows.map(mapSession) })
  })

  // POST /radius/sessions/:id/disconnect — putus sesi aktif via CoA port NAS
  app.post("/radius/sessions/:id/disconnect", techAuth, async (req, reply) => {
    const { id } = req.params as { id: string }
    const [sess] = (await app.db.query(
      "SELECT radacctid, username, acctsessionid, nasipaddress FROM radacct WHERE radacctid = ? AND acctstoptime IS NULL",
      [id],
    )) as Record<string, unknown>[]
    if (!sess) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Sesi tidak ditemukan" } })
    }
    const [nas] = (await app.db.query(
      `SELECT id, host, COALESCE(nas_secret, '') AS secret, COALESCE(coa_port, 3799) AS coa_port
       FROM routers WHERE radius_enabled = 1 AND host LIKE ?`,
      [`${String(sess.nasipaddress)}:%`],
    )) as Record<string, unknown>[]
    if (!nas?.secret) {
      return reply.code(400).send({ error: { code: "NAS_UNKNOWN", message: "NAS tidak terdaftar sebagai RADIUS client" } })
    }
    const res = await sendDisconnect(
      { ip: String(sess.nasipaddress), secret: decryptSecret(String(nas.secret)), coaPort: Number(nas.coa_port) },
      { username: String(sess.username), sessionId: String(sess.acctsessionid ?? "") },
    )
    if (!res.ok) {
      await app.db.query(
        "INSERT INTO activity_logs (actor, action, target) VALUES ('Sistem', 'Disconnect RADIUS gagal', ?)",
        [String(sess.username)],
      )
      return reply.send({ data: { ok: false, error: res.error } })
    }
    // Tandai sesi berakhir agar tidak tampil lagi di daftar aktif
    await app.db.query("UPDATE radacct SET acctstoptime = NOW() WHERE radacctid = ?", [id])
    await app.db.query(
      "INSERT INTO activity_logs (actor, action, target) VALUES ('Sistem', 'Disconnect RADIUS', ?)",
      [String(sess.username)],
    )
    return reply.send({ data: { ok: true } })
  })

  // GET /radius/usage — agregasi pemakaian per pelanggan (periode opsional)
  app.get("/radius/usage", techAuth, async (req, reply) => {
    const q = z
      .object({
        customerId: z.coerce.number().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(req.query ?? {})
    const where: string[] = ["ra.acctstoptime IS NOT NULL"]
    const params: unknown[] = []
    if (q.customerId) {
      where.push("c.id = ?")
      params.push(q.customerId)
    }
    if (q.from) {
      where.push("ra.acctstarttime >= ?")
      params.push(q.from)
    }
    if (q.to) {
      where.push("ra.acctstarttime <= ?")
      params.push(q.to)
    }
    const rows = (await app.db.query(
      `SELECT c.id AS customer_id, c.name AS customer_name, c.code, c.pppoe_username,
              COUNT(*) AS sessions,
              COALESCE(SUM(ra.acctinputoctets),0) AS input_octets,
              COALESCE(SUM(ra.acctoutputoctets),0) AS output_octets,
              COALESCE(SUM(ra.acctsessiontime),0) AS session_time
       FROM radacct ra
       JOIN customers c ON c.pppoe_username = ra.username
       WHERE ${where.join(" AND ")}
       GROUP BY c.id, c.name, c.code, c.pppoe_username
       ORDER BY output_octets DESC`,
      params,
    )) as Record<string, unknown>[]
    return reply.send({
      data: rows.map((r) => ({
        customerId: r.customer_id,
        name: r.customer_name,
        code: r.code,
        pppoeUsername: r.pppoe_username,
        sessions: Number(r.sessions),
        inputOctets: Number(r.input_octets),
        outputOctets: Number(r.output_octets),
        sessionTime: Number(r.session_time),
      })),
    })
  })

  // GET /radius/nas — daftar NAS dari tabel nas (join nama router bila ada)
  app.get("/radius/nas", techAuth, async (_req, reply) => {
    const rows = (await app.db.query(
      `SELECT n.*, r.id AS router_id, r.name AS router_name
       FROM nas n LEFT JOIN routers r ON r.host LIKE CONCAT(n.nasname, ':%')
       ORDER BY n.id ASC`,
    )) as Record<string, unknown>[]
    return reply.send({
      data: rows.map((r) => ({
        id: r.id,
        nasname: r.nasname,
        shortname: r.shortname,
        type: r.type,
        secret: r.secret ? "****" : "",
        description: r.description,
        routerId: r.router_id ?? null,
        routerName: r.router_name ?? null,
      })),
    })
  })

  // DELETE /radius/nas/:id
  app.delete("/radius/nas/:id", adminAuth, async (req, reply) => {
    const { id } = req.params as { id: string }
    await app.db.query("DELETE FROM nas WHERE id = ?", [id])
    return reply.send({ data: { message: "NAS dihapus" } })
  })

  // GET /radius/status — ringkasan 24 jam + sesi aktif
  app.get("/radius/status", techAuth, async (_req, reply) => {
    const [accepts] = (await app.db.query(
      "SELECT COUNT(*) AS total FROM radpostauth WHERE reply = 'Access-Accept' AND authdate >= DATE_SUB(NOW(), INTERVAL 24 HOUR)",
    )) as Record<string, unknown>[]
    const [rejects] = (await app.db.query(
      "SELECT COUNT(*) AS total FROM radpostauth WHERE reply = 'Access-Reject' AND authdate >= DATE_SUB(NOW(), INTERVAL 24 HOUR)",
    )) as Record<string, unknown>[]
    const [active] = (await app.db.query(
      "SELECT COUNT(*) AS total FROM radacct WHERE acctstoptime IS NULL",
    )) as Record<string, unknown>[]
    const [routers] = (await app.db.query(
      "SELECT COUNT(*) AS total FROM routers WHERE radius_enabled = 1",
    )) as Record<string, unknown>[]
    return reply.send({
      data: {
        accepts24h: Number(accepts?.total ?? 0),
        rejects24h: Number(rejects?.total ?? 0),
        activeSessions: Number(active?.total ?? 0),
        radiusRouters: Number(routers?.total ?? 0),
      },
    })
  })

  // GET /radius/logs — log autentikasi terbaru
  app.get("/radius/logs", techAuth, async (req, reply) => {
    const q = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }).parse(req.query ?? {})
    const rows = (await app.db.query(
      "SELECT id, username, reply, authdate, nasipaddress FROM radpostauth ORDER BY id DESC LIMIT ?",
      [q.limit],
    )) as Record<string, unknown>[]
    return reply.send({
      data: rows.map((r) => ({
        id: r.id,
        username: r.username,
        reply: r.reply,
        nasIp: r.nasipaddress,
        time: fromISODate(r.authdate as string | undefined),
      })),
    })
  })

  // GET /radius/config / PUT /radius/config — key-value di app_settings
  app.get("/radius/config", adminAuth, async (_req, reply) => {
    return reply.send({ data: await readConfig(app) })
  })

  app.put("/radius/config", adminAuth, async (req, reply) => {
    const body = configSchema.parse(req.body ?? {})
    const current = await readConfig(app)
    const next = { ...current, ...body }
    await app.db.query(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [CONFIG_KEY, JSON.stringify(next)],
    )
    return reply.send({ data: next })
  })

  // POST /radius/backfill — sinkron ulang semua pelanggan pada router RADIUS
  app.post("/radius/backfill", adminAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({ routerId: z.coerce.number().min(1) }).parse(req.body ?? {})
    const [row] = (await app.db.query("SELECT id FROM routers WHERE id = ?", [body.routerId])) as Record<
      string,
      unknown
    >[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Router tidak ditemukan" } })
    }
    const res = await backfillRouter(app, body.routerId)
    return reply.send({ data: { synced: res.synced } })
  })
}
