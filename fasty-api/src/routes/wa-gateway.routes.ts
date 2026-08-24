import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import { nextCode } from "../utils/codegen.js"
import { decryptSecret, encryptSecret, maskSecret } from "../utils/crypto.js"
import { normalizePhone } from "../utils/phone.js"

const templateSchema = z.object({
  name: z.string().min(1, "Nama template wajib diisi"),
  body: z.string().min(1, "Isi pesan wajib diisi"),
})

const configSchema = z.object({
  serverUrl: z.string().optional(),
  apiKey: z.string().optional(),
  deviceName: z.string().optional(),
  webhookUrl: z.string().optional(),
  autoReconnect: z.boolean().optional(),
})

const sendSchema = z.object({
  to: z.array(z.string()).min(1, "Minimal 1 penerima"),
  template: z.object({ body: z.string().min(1) }),
  vars: z
    .array(
      z.object({
        phone: z.string(),
        nama: z.string().optional(),
        jumlah: z.string().optional(),
        tanggal: z.string().optional(),
        no_invoice: z.string().optional(),
        paket: z.string().optional(),
      }),
    )
    .optional(),
})

function fillPlaceholders(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (_m, key) => vars[key] ?? "")
}

export async function waGatewayRoutes(app: FastifyInstance) {
  const superOnly = {
    onRequest: [app.authenticate],
    preHandler: [app.requireRoles(["super_admin"])],
  }

  // GET /wa-gateway/status
  app.get("/wa-gateway/status", superOnly, async (req, reply) => {
    const [row] = (await app.db.query("SELECT * FROM wa_api_config WHERE id = 1")) as Record<
      string,
      unknown
    >[]
    const hasKey = !!decryptSecret(String(row?.api_key ?? ""))
    return reply.send({ data: { connected: hasKey } })
  })

  // POST /wa-gateway/test
  app.post("/wa-gateway/test", superOnly, async (req, reply) => {
    const [row] = (await app.db.query("SELECT * FROM wa_api_config WHERE id = 1")) as Record<
      string,
      unknown
    >[]
    const hasKey = !!decryptSecret(String(row?.api_key ?? "")) && !!row?.server_url
    return reply.send({ data: { connected: hasKey } })
  })

  // ---- Templates (TPL-00X) ----
  app.get("/wa-gateway/templates", superOnly, async (req, reply) => {
    const rows = (await app.db.query("SELECT * FROM wa_templates ORDER BY id ASC")) as Record<
      string,
      unknown
    >[]
    return reply.send({
      data: rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        body: r.body,
        createdAt: String(r.created_at ?? ""),
        updatedAt: String(r.updated_at ?? ""),
      })),
    })
  })

  app.post("/wa-gateway/templates", superOnly, async (req, reply) => {
    const body = templateSchema.parse(req.body)
    const code = await app.db.transaction(async (q) => {
      return nextCode(q.query, "wa_templates", "TPL-", { minStart: 1, pad: 3 })
    })
    const result = (await app.db.query(
      "INSERT INTO wa_templates (code, name, body) VALUES (?, ?, ?)",
      [code, body.name, body.body],
    )) as unknown as { insertId: number }
    return reply.code(201).send({ data: { id: result.insertId, code, ...body } })
  })

  app.put("/wa-gateway/templates/:id", superOnly, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const body = templateSchema.partial().parse(req.body)
    await app.db.query("UPDATE wa_templates SET name = COALESCE(?, name), body = COALESCE(?, body) WHERE id = ?", [
      body.name ?? null,
      body.body ?? null,
      id,
    ])
    return reply.send({ data: { message: "Template diperbarui" } })
  })

  app.delete("/wa-gateway/templates/:id", superOnly, async (req, reply) => {
    const { id } = req.params as { id: string }
    await app.db.query("DELETE FROM wa_templates WHERE id = ?", [id])
    return reply.send({ data: { message: "Template dihapus" } })
  })

  // ---- Config ----
  app.get("/wa-gateway/config", superOnly, async (req, reply) => {
    const [row] = (await app.db.query("SELECT * FROM wa_api_config WHERE id = 1")) as Record<
      string,
      unknown
    >[]
    const apiKey = decryptSecret(String(row?.api_key ?? ""))
    return reply.send({
      data: {
        serverUrl: row?.server_url ?? "",
        apiKey: maskSecret(apiKey),
        deviceName: row?.device_name ?? "",
        webhookUrl: row?.webhook_url ?? "",
        autoReconnect: !!row?.auto_reconnect,
      },
    })
  })

  app.put("/wa-gateway/config", superOnly, async (req, reply) => {
    const body = configSchema.parse(req.body)
    const [row] = (await app.db.query("SELECT * FROM wa_api_config WHERE id = 1")) as Record<
      string,
      unknown
    >[]
    const currentKey = decryptSecret(String(row?.api_key ?? ""))
    const nextKey = body.apiKey ? encryptSecret(body.apiKey) : encryptSecret(currentKey)
    await app.db.query(
      `INSERT INTO wa_api_config (id, server_url, api_key, device_name, webhook_url, auto_reconnect)
       VALUES (1, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE server_url = COALESCE(?, server_url), api_key = ?, device_name = COALESCE(?, device_name),
       webhook_url = COALESCE(?, webhook_url), auto_reconnect = COALESCE(?, auto_reconnect)`,
      [
        body.serverUrl ?? "", nextKey, body.deviceName ?? "", body.webhookUrl ?? "", body.autoReconnect ?? true,
        body.serverUrl ?? null, nextKey, body.deviceName ?? null, body.webhookUrl ?? null, body.autoReconnect ?? null,
      ],
    )
    return reply.send({ data: { message: "Konfigurasi WA Gateway disimpan" } })
  })

  // POST /wa-gateway/send — kirim pesan single/bulk + tulis notification_logs
  app.post("/wa-gateway/send", superOnly, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = sendSchema.parse(req.body)
    const varsByPhone = new Map<string, Record<string, string>>()
    for (const v of body.vars ?? []) {
      varsByPhone.set(normalizePhone(v.phone), {
        nama: v.nama ?? "",
        jumlah: v.jumlah ?? "",
        tanggal: v.tanggal ?? "",
        no_invoice: v.no_invoice ?? "",
        paket: v.paket ?? "",
      })
    }

    let sent = 0
    let failed = 0
    for (const rawPhone of body.to) {
      const phone = normalizePhone(rawPhone)
      const vars = varsByPhone.get(phone) ?? {}
      const message = fillPlaceholders(body.template.body, vars)
      // Simulasi kirim — tulis notification_logs
      const ok = Math.random() > 0.2
      const ntCode = await app.db.transaction(async (q) => {
        return nextCode(q.query, "notification_logs", "NT-", { minStart: 1000 })
      })
      const [cust] = (await app.db.query("SELECT id FROM customers WHERE phone LIKE ? LIMIT 1", [
        `%${phone.replace(/^62/, "0")}%`,
      ])) as Record<string, unknown>[]
      if (ok) {
        sent++
      } else {
        failed++
      }
      await app.db.query(
        "INSERT INTO notification_logs (code, type, customer_id, channel, status, error) VALUES (?, 'reminder', ?, 'WhatsApp', ?, ?)",
        [ntCode, cust?.id ?? null, ok ? "Terkirim" : "Gagal", ok ? null : "Nomor tidak terdaftar"],
      )
      void message
    }
    return reply.send({ data: { sent, failed } })
  })

  // GET /wa-gateway/logs
  app.get("/wa-gateway/logs", superOnly, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = z.object({ status: z.enum(["Terkirim", "Gagal"]).optional() }).parse(req.query)
    const where = q.status ? "WHERE status = ?" : ""
    const params = q.status ? [q.status] : []
    const rows = (await app.db.query(
      `SELECT * FROM notification_logs ${where} ORDER BY id DESC LIMIT 50`,
      params,
    )) as Record<string, unknown>[]
    return reply.send({ data: rows })
  })
}
