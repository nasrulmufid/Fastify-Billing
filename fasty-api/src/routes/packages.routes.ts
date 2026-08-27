import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import { nextCode } from "../utils/codegen.js"
import {
  recordRouterWarning,
  syncPackagesToRouter,
  type RouterWarning,
} from "../services/router.service.js"

const PKG_TYPE_ENUM = z.enum(["PPPoE"])
const PKG_STATUS_ENUM = z.enum(["Aktif", "Nonaktif"])

const createPkgSchema = z.object({
  name: z.string().min(3, "Nama paket minimal 3 karakter"),
  downloadSpeed: z.coerce.number().min(1),
  uploadSpeed: z.coerce.number().min(1),
  price: z.coerce.number().min(1000, "Harga minimal Rp 1.000"),
  type: PKG_TYPE_ENUM.default("PPPoE"),
  description: z.string().optional(),
})

const updatePkgSchema = createPkgSchema.partial()
const statusSchema = z.object({ status: PKG_STATUS_ENUM })

function mapPkg(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    downloadSpeed: row.download_speed,
    uploadSpeed: row.upload_speed,
    price: Number(row.price),
    type: row.type,
    status: row.status,
    description: row.description,
    createdAt: row.created_at,
  }
}

/**
 * Sinkronkan daftar paket PPPoE ke SEMUA router terdaftar.
 * Return jumlah profile ter-sync + hasil per router + daftar warning.
 * Kegagalan satu router tidak menghentikan router lain (best-effort).
 */
async function syncPackagesToAllRouters(
  app: FastifyInstance,
  pkgRows: Record<string, unknown>[],
): Promise<{ syncedCount: number; routerResults: Record<string, unknown>[]; warnings: RouterWarning[] }> {
  const routers = (await app.db.query("SELECT id, name FROM routers ORDER BY id ASC")) as Record<string, unknown>[]
  const speeds = pkgRows.map((p) => ({
    downloadSpeed: Number(p.download_speed),
    uploadSpeed: Number(p.upload_speed),
  }))
  const routerResults: Record<string, unknown>[] = []
  const warnings: RouterWarning[] = []
  let syncedCount = 0

  for (const r of routers) {
    const res = await syncPackagesToRouter(app, Number(r.id), speeds)
    const entry: Record<string, unknown> = {
      routerId: Number(r.id),
      routerName: r.name,
      syncedCount: res.ok ? res.data : 0,
    }
    if (!res.ok) {
      entry.warning = res.warning
      warnings.push(res.warning)
      await recordRouterWarning(app, {
        routerId: Number(r.id),
        action: "Sinkronisasi paket",
        warning: res.warning,
      })
    } else {
      syncedCount += res.data
    }
    routerResults.push(entry)
  }

  return { syncedCount, routerResults, warnings }
}

export async function packagesRoutes(app: FastifyInstance) {
  const auth = { onRequest: [app.authenticate] }
  const adminOnly = { onRequest: [app.authenticate], preHandler: [app.requireRoles(["super_admin", "admin"])] }

  // GET /packages
  app.get("/packages", auth, async (req, reply) => {
    const rows = (await app.db.query("SELECT * FROM packages ORDER BY id ASC")) as Record<string, unknown>[]
    return reply.send({ data: rows.map(mapPkg) })
  })

  // POST /packages
  app.post("/packages", adminOnly, async (req, reply) => {
    const body = createPkgSchema.parse(req.body)
    const code = await app.db.transaction(async (q) => {
      return nextCode(q.query, "packages", "PKG-", { minStart: 1, pad: 2 })
    })
    const result = (await app.db.query(
      "INSERT INTO packages (code, name, download_speed, upload_speed, price, type, status, description) VALUES (?, ?, ?, ?, ?, ?, 'Aktif', ?)",
      [code, body.name, body.downloadSpeed, body.uploadSpeed, body.price, body.type, body.description ?? ""],
    )) as unknown as { insertId: number }
    const [row] = (await app.db.query("SELECT * FROM packages WHERE id = ?", [
      result.insertId,
    ])) as Record<string, unknown>[]
    return reply.code(201).send({ data: mapPkg(row) })
  })

  // PUT /packages/:id
  app.put("/packages/:id", adminOnly, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const body = updatePkgSchema.parse(req.body)
    await app.db.query(
      `UPDATE packages SET
        name = COALESCE(?, name),
        download_speed = COALESCE(?, download_speed),
        upload_speed = COALESCE(?, upload_speed),
        price = COALESCE(?, price),
        type = COALESCE(?, type),
        description = COALESCE(?, description)
       WHERE id = ?`,
      [
        body.name ?? null,
        body.downloadSpeed ?? null,
        body.uploadSpeed ?? null,
        body.price ?? null,
        body.type ?? null,
        body.description ?? null,
        id,
      ],
    )
    const [row] = (await app.db.query("SELECT * FROM packages WHERE id = ?", [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Paket tidak ditemukan" } })
    }
    return reply.send({ data: mapPkg(row) })
  })

  // DELETE /packages/:id
  app.delete("/packages/:id", adminOnly, async (req, reply) => {
    const { id } = req.params as { id: string }
    await app.db.query("DELETE FROM packages WHERE id = ?", [id])
    return reply.send({ data: { message: "Paket dihapus" } })
  })

  // PUT /packages/:id/status
  app.put("/packages/:id/status", adminOnly, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = statusSchema.parse(req.body)
    await app.db.query("UPDATE packages SET status = ? WHERE id = ?", [body.status, id])
    const [row] = (await app.db.query("SELECT * FROM packages WHERE id = ?", [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Paket tidak ditemukan" } })
    }
    return reply.send({ data: mapPkg(row) })
  })

  // POST /packages/sync — sync semua paket PPPoE aktif ke semua router
  app.post("/packages/sync", adminOnly, async (req, reply) => {
    const pkgRows = (await app.db.query(
      "SELECT id, code, name, download_speed, upload_speed, type FROM packages WHERE status = 'Aktif' AND type = 'PPPoE' ORDER BY id ASC",
    )) as Record<string, unknown>[]
    if (pkgRows.length === 0) {
      return reply.send({
        data: { syncedCount: 0, routerResults: [] },
        warning: {
          code: "MIKROTIK_OFFLINE",
          message: "Tidak ada paket PPPoE aktif untuk disinkronkan",
        },
      })
    }
    const { syncedCount, routerResults, warnings } = await syncPackagesToAllRouters(app, pkgRows)
    const payload: Record<string, unknown> = { data: { syncedCount, routerResults } }
    if (warnings.length) payload.warning = warnings[0]
    return reply.send(payload)
  })

  // POST /packages/:id/sync — sync satu paket ke semua router
  app.post("/packages/:id/sync", adminOnly, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const [row] = (await app.db.query("SELECT * FROM packages WHERE id = ?", [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Paket tidak ditemukan" } })
    }
    if (row.type !== "PPPoE") {
      return reply.send({
        data: { syncedCount: 0, routerResults: [] },
        warning: {
          code: "MIKROTIK_OFFLINE",
          message: `${row.name} bertipe ${row.type} — profile PPPoE hanya untuk paket tipe PPPoE`,
        },
      })
    }
    const { syncedCount, routerResults, warnings } = await syncPackagesToAllRouters(app, [row])
    const payload: Record<string, unknown> = { data: { syncedCount, routerResults } }
    if (warnings.length) payload.warning = warnings[0]
    return reply.send(payload)
  })
}
