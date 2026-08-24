import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import { syncHotspotProfilesToRouter, syncHotspotUsersToRouter, recordRouterWarning } from "../services/router.service.js"

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ" // tanpa I/O
const LOWER = "abcdefghjkmnpqrstuvwxyz" // tanpa i/l/o
const DIGIT = "0123456789"

type CodeFormat = "ABCD123" | "abcd123" | "AbcD123" | "ABCDEFG" | "abcdefg" | "123456"

function rand(chars: string): string {
  return chars[Math.floor(Math.random() * chars.length)]
}

/** Generate kode voucher — PERSIS logika frontend hotspotData.generateCode */
export function generateCode(format: CodeFormat): string {
  switch (format) {
    case "ABCD123":
      return `${rand(UPPER)}${rand(UPPER)}${rand(UPPER)}${rand(DIGIT)}${rand(DIGIT)}${rand(DIGIT)}`
    case "abcd123":
      return `${rand(LOWER)}${rand(LOWER)}${rand(LOWER)}${rand(DIGIT)}${rand(DIGIT)}${rand(DIGIT)}`
    case "AbcD123":
      return `${rand(UPPER)}${rand(LOWER)}${rand(LOWER)}${rand(UPPER)}${rand(DIGIT)}${rand(DIGIT)}${rand(DIGIT)}`
    case "ABCDEFG":
      return Array.from({ length: 7 }, () => rand(UPPER)).join("")
    case "abcdefg":
      return Array.from({ length: 7 }, () => rand(LOWER)).join("")
    case "123456":
      return Array.from({ length: 6 }, () => rand(DIGIT)).join("")
  }
}

const FORMAT_ENUM = z.enum(["ABCD123", "abcd123", "AbcD123", "ABCDEFG", "abcdefg", "123456"])
const STATUS_ENUM = z.enum(["Aktif", "Belum Terpakai", "Expired"])

const generateSchema = z.object({
  count: z.coerce.number().int().min(1).max(500),
  profileId: z.coerce.number().optional().nullable(),
  price: z.coerce.number().default(0),
  format: FORMAT_ENUM.default("ABCD123"),
  usernameEqualsPassword: z.boolean().default(false),
  prefix: z.string().default(""),
})

const profileSchema = z.object({
  name: z.string().min(1),
  durationHours: z.coerce.number().int().min(1),
  durationLabel: z.string().default(""),
  price: z.coerce.number().default(0),
  downloadSpeed: z.coerce.number().default(10),
  uploadSpeed: z.coerce.number().default(10),
  sharedUsers: z.coerce.number().default(1),
  sessionTimeout: z.coerce.number().default(30),
  status: z.enum(["Aktif", "Nonaktif"]).default("Aktif"),
})

const templateSchema = z.object({
  name: z.string().min(1),
  html: z.string().min(1),
})

const patchSchema = z.object({
  status: STATUS_ENUM.optional(),
  validUntil: z.string().optional(),
  price: z.coerce.number().optional(),
})

export async function hotspotRoutes(app: FastifyInstance) {
  const techAuth = {
    onRequest: [app.authenticate],
    preHandler: [app.requireRoles(["super_admin", "admin", "teknisi"])],
  }

  // ---- Users (voucher) ----
  app.get("/hotspot/users", techAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = z.object({ status: STATUS_ENUM.optional(), search: z.string().optional() }).parse(req.query)
    const where: string[] = []
    const params: unknown[] = []
    if (q.status) {
      where.push("status = ?")
      params.push(q.status)
    }
    if (q.search) {
      where.push("username LIKE ?")
      params.push(`%${q.search}%`)
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : ""
    const rows = (await app.db.query(
      `SELECT u.*, p.name AS profile_name FROM hotspot_users u LEFT JOIN hotspot_profiles p ON p.id = u.profile_id ${clause} ORDER BY u.id DESC`,
      params,
    )) as Record<string, unknown>[]
    return reply.send({
      data: rows.map((r) => ({
        id: r.id,
        username: r.username,
        password: r.password,
        profileId: r.profile_id,
        profileName: r.profile_name,
        price: Number(r.price),
        validUntil: String(r.valid_until ?? ""),
        status: r.status,
        createdAt: String(r.created_at ?? ""),
      })),
    })
  })

  // POST /hotspot/vouchers/generate
  app.post("/hotspot/vouchers/generate", techAuth, async (req, reply) => {
    const body = generateSchema.parse(req.body)
    const result = await app.db.transaction(async (q) => {
      let durationHours = 24
      if (body.profileId) {
        const [profile] = (await q.query("SELECT * FROM hotspot_profiles WHERE id = ?", [
          body.profileId,
        ])) as Record<string, unknown>[]
        if (profile) durationHours = Number(profile.duration_hours)
      }

      const taken = new Set<string>()
      const existing = (await q.query("SELECT username FROM hotspot_users")) as Record<string, unknown>[]
      for (const e of existing) taken.add(String(e.username))

      const created: { username: string; password: string; profile_id: unknown; price: number; valid_until: string }[] = []
      let guard = 0
      const now = new Date()
      const validUntil = new Date(now.getTime() + durationHours * 3600 * 1000)
        .toISOString()
        .slice(0, 19)
        .replace("T", " ")

      while (created.length < body.count && guard < body.count * 200) {
        guard++
        const code = generateCode(body.format)
        const username = body.usernameEqualsPassword ? code : `${body.prefix}${code}`
        if (taken.has(username)) continue
        taken.add(username)
        created.push({
          username,
          password: body.usernameEqualsPassword ? code : generateCode(body.format),
          profile_id: body.profileId ?? null,
          price: body.price,
          valid_until: validUntil,
        })
      }

      if (created.length) {
        for (const c of created) {
          await q.query(
            "INSERT INTO hotspot_users (username, password, profile_id, price, valid_until, status) VALUES (?, ?, ?, ?, ?, 'Belum Terpakai')",
            [c.username, c.password, c.profile_id, c.price, c.valid_until],
          )
        }
      }
      return created.map((c) => ({ ...c, status: "Belum Terpakai" }))
    })

    // Sync semua user hotspot ke router yang terhubung
    const allUsers = (await app.db.query(
      `SELECT u.username, u.password, p.name AS profile_name 
       FROM hotspot_users u 
       LEFT JOIN hotspot_profiles p ON p.id = u.profile_id`,
    )) as Record<string, unknown>[]

    const routers = (await app.db.query("SELECT id FROM routers WHERE status = 'Connected'")) as Record<string, unknown>[]
    for (const router of routers) {
      const res = await syncHotspotUsersToRouter(app, Number(router.id), allUsers.map((u: Record<string, unknown>) => ({
        username: String(u.username),
        password: String(u.password),
        profileName: String(u.profile_name || "default"),
      })))
      if (!res.ok) {
        await recordRouterWarning(app, { routerId: Number(router.id), action: "sync hotspot user", warning: res.warning })
      }
    }

    return reply.code(201).send({ data: result })
  })

  // PUT /hotspot/users/:id
  app.put("/hotspot/users/:id", techAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const body = patchSchema.parse(req.body)
    await app.db.query(
      "UPDATE hotspot_users SET status = COALESCE(?, status), valid_until = COALESCE(?, valid_until), price = COALESCE(?, price) WHERE id = ?",
      [body.status ?? null, body.validUntil ?? null, body.price ?? null, id],
    )
    return reply.send({ data: { message: "User hotspot diperbarui" } })
  })

  // DELETE /hotspot/users (bulk)
  app.delete("/hotspot/users", techAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({ ids: z.array(z.coerce.number()).min(1) }).parse(req.body)
    const placeholders = body.ids.map(() => "?").join(",")
    await app.db.query(`DELETE FROM hotspot_users WHERE id IN (${placeholders})`, body.ids)
    return reply.send({ data: { message: `${body.ids.length} user dihapus` } })
  })

  // ---- Profiles ----
  app.get("/hotspot/profiles", techAuth, async (req, reply) => {
    const rows = (await app.db.query("SELECT * FROM hotspot_profiles ORDER BY id ASC")) as Record<
      string,
      unknown
    >[]
    return reply.send({
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        durationHours: r.duration_hours,
        durationLabel: r.duration_label,
        price: Number(r.price),
        downloadSpeed: r.download_speed,
        uploadSpeed: r.upload_speed,
        sharedUsers: r.shared_users,
        sessionTimeout: r.session_timeout,
        status: r.status,
      })),
    })
  })

  app.post("/hotspot/profiles", techAuth, async (req, reply) => {
    const body = profileSchema.parse(req.body)
    const result = (await app.db.query(
      "INSERT INTO hotspot_profiles (name, duration_hours, duration_label, price, download_speed, upload_speed, shared_users, session_timeout, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [body.name, body.durationHours, body.durationLabel || `${body.durationHours} Jam`, body.price, body.downloadSpeed, body.uploadSpeed, body.sharedUsers, body.sessionTimeout, body.status],
    )) as unknown as { insertId: number }

    // Sync profile baru ke semua router yang terhubung
    const routers = (await app.db.query("SELECT id FROM routers WHERE status = 'Connected'")) as Record<string, unknown>[]
    for (const router of routers) {
      const allProfiles = (await app.db.query("SELECT name, shared_users, session_timeout, download_speed, upload_speed FROM hotspot_profiles WHERE status = 'Aktif'")) as Record<string, unknown>[]
      const res = await syncHotspotProfilesToRouter(app, Number(router.id), allProfiles.map((p: Record<string, unknown>) => ({
        name: String(p.name),
        sharedUsers: Number(p.shared_users),
        sessionTimeout: Number(p.session_timeout),
        downloadSpeed: Number(p.download_speed),
        uploadSpeed: Number(p.upload_speed),
      })))
      if (!res.ok) {
        await recordRouterWarning(app, { routerId: Number(router.id), action: "sync hotspot profile", warning: res.warning })
      }
    }

    return reply.code(201).send({ data: { id: result.insertId, ...body } })
  })

  app.put("/hotspot/profiles/:id", techAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const body = profileSchema.partial().parse(req.body)
    await app.db.query(
      `UPDATE hotspot_profiles SET
        name = COALESCE(?, name), duration_hours = COALESCE(?, duration_hours), duration_label = COALESCE(?, duration_label),
        price = COALESCE(?, price), download_speed = COALESCE(?, download_speed), upload_speed = COALESCE(?, upload_speed),
        shared_users = COALESCE(?, shared_users), session_timeout = COALESCE(?, session_timeout), status = COALESCE(?, status)
       WHERE id = ?`,
      [body.name ?? null, body.durationHours ?? null, body.durationLabel ?? null, body.price ?? null, body.downloadSpeed ?? null, body.uploadSpeed ?? null, body.sharedUsers ?? null, body.sessionTimeout ?? null, body.status ?? null, id],
    )

    // Sync semua profile ke router yang terhubung
    const routers = (await app.db.query("SELECT id FROM routers WHERE status = 'Connected'")) as Record<string, unknown>[]
    for (const router of routers) {
      const allProfiles = (await app.db.query("SELECT name, shared_users, session_timeout, download_speed, upload_speed FROM hotspot_profiles WHERE status = 'Aktif'")) as Record<string, unknown>[]
      const res = await syncHotspotProfilesToRouter(app, Number(router.id), allProfiles.map((p: Record<string, unknown>) => ({
        name: String(p.name),
        sharedUsers: Number(p.shared_users),
        sessionTimeout: Number(p.session_timeout),
        downloadSpeed: Number(p.download_speed),
        uploadSpeed: Number(p.upload_speed),
      })))
      if (!res.ok) {
        await recordRouterWarning(app, { routerId: Number(router.id), action: "sync hotspot profile", warning: res.warning })
      }
    }

    return reply.send({ data: { message: "Profile diperbarui" } })
  })

  app.delete("/hotspot/profiles/:id", techAuth, async (req, reply) => {
    const { id } = req.params as { id: string }
    await app.db.query("DELETE FROM hotspot_profiles WHERE id = ?", [id])

    // Sync semua profile ke router yang terhubung
    const routers = (await app.db.query("SELECT id FROM routers WHERE status = 'Connected'")) as Record<string, unknown>[]
    for (const router of routers) {
      const allProfiles = (await app.db.query("SELECT name, shared_users, session_timeout, download_speed, upload_speed FROM hotspot_profiles WHERE status = 'Aktif'")) as Record<string, unknown>[]
      const res = await syncHotspotProfilesToRouter(app, Number(router.id), allProfiles.map((p: Record<string, unknown>) => ({
        name: String(p.name),
        sharedUsers: Number(p.shared_users),
        sessionTimeout: Number(p.session_timeout),
        downloadSpeed: Number(p.download_speed),
        uploadSpeed: Number(p.upload_speed),
      })))
      if (!res.ok) {
        await recordRouterWarning(app, { routerId: Number(router.id), action: "sync hotspot profile", warning: res.warning })
      }
    }

    return reply.send({ data: { message: "Profile dihapus" } })
  })

  // ---- Templates ----
  app.get("/hotspot/templates", techAuth, async (req, reply) => {
    const rows = (await app.db.query("SELECT * FROM voucher_templates ORDER BY id ASC")) as Record<
      string,
      unknown
    >[]
    return reply.send({
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        html: r.html,
        isDefault: !!r.is_default,
        updatedAt: String(r.updated_at ?? ""),
      })),
    })
  })

  app.post("/hotspot/templates", techAuth, async (req, reply) => {
    const body = templateSchema.parse(req.body)
    const result = (await app.db.query(
      "INSERT INTO voucher_templates (name, html, is_default) VALUES (?, ?, ?)",
      [body.name, body.html, 0],
    )) as unknown as { insertId: number }
    return reply.code(201).send({ data: { id: result.insertId, ...body, isDefault: false } })
  })

  app.put("/hotspot/templates/:id", techAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const body = templateSchema.partial().parse(req.body)
    await app.db.query("UPDATE voucher_templates SET name = COALESCE(?, name), html = COALESCE(?, html) WHERE id = ?", [
      body.name ?? null,
      body.html ?? null,
      id,
    ])
    return reply.send({ data: { message: "Template diperbarui" } })
  })

  app.delete("/hotspot/templates/:id", techAuth, async (req, reply) => {
    const { id } = req.params as { id: string }
    await app.db.query("DELETE FROM voucher_templates WHERE id = ?", [id])
    return reply.send({ data: { message: "Template dihapus" } })
  })

  app.put("/hotspot/templates/:id/default", techAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    await app.db.transaction(async (q) => {
      await q.query("UPDATE voucher_templates SET is_default = 0")
      await q.query("UPDATE voucher_templates SET is_default = 1 WHERE id = ?", [id])
    })
    return reply.send({ data: { message: "Template default diatur" } })
  })

  // ---- Settings ----
  app.get("/hotspot/settings", techAuth, async (req, reply) => {
    const [row] = (await app.db.query("SELECT * FROM hotspot_settings WHERE id = 1")) as Record<
      string,
      unknown
    >[]
    return reply.send({
      data: {
        serverUrl: row?.server_url ?? "",
        apiPort: row?.api_port ?? 8728,
        apiUser: row?.api_user ?? "admin",
        apiPassword: row?.api_password ?? "",
        companyName: row?.company_name ?? "RTRW Net",
        currency: row?.currency ?? "IDR",
        loginPageUrl: row?.login_page_url ?? "",
        voucherPrefix: row?.voucher_prefix ?? "",
        autoSync: !!row?.auto_sync,
      },
    })
  })

  app.put("/hotspot/settings", techAuth, async (req, reply) => {
    const body = z
      .object({
        serverUrl: z.string().optional(),
        apiPort: z.coerce.number().optional(),
        apiUser: z.string().optional(),
        apiPassword: z.string().optional(),
        companyName: z.string().optional(),
        currency: z.string().optional(),
        loginPageUrl: z.string().optional(),
        voucherPrefix: z.string().optional(),
        autoSync: z.boolean().optional(),
      })
      .parse(req.body)
    await app.db.query(
      `INSERT INTO hotspot_settings (id, server_url, api_port, api_user, api_password, company_name, currency, login_page_url, voucher_prefix, auto_sync)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE server_url = COALESCE(?, server_url), api_port = COALESCE(?, api_port), api_user = COALESCE(?, api_user),
       api_password = COALESCE(?, api_password), company_name = COALESCE(?, company_name), currency = COALESCE(?, currency),
       login_page_url = COALESCE(?, login_page_url), voucher_prefix = COALESCE(?, voucher_prefix), auto_sync = COALESCE(?, auto_sync)`,
      [
        body.serverUrl ?? "", body.apiPort ?? 8728, body.apiUser ?? "admin", body.apiPassword ?? "",
        body.companyName ?? "RTRW Net", body.currency ?? "IDR", body.loginPageUrl ?? "", body.voucherPrefix ?? "", body.autoSync ?? false,
        body.serverUrl ?? null, body.apiPort ?? null, body.apiUser ?? null, body.apiPassword ?? null,
        body.companyName ?? null, body.currency ?? null, body.loginPageUrl ?? null, body.voucherPrefix ?? null, body.autoSync ?? null,
      ],
    )
    return reply.send({ data: { message: "Pengaturan hotspot disimpan" } })
  })
}
