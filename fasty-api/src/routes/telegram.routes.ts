import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import {
  getTelegramConfig,
  saveTelegramConfig,
  sendTelegramMessage,
  testTelegramBot,
  DEFAULT_TELEGRAM_CONFIG,
  DEFAULT_TELEGRAM_TEMPLATES,
} from "../services/telegram.service.js"

const templatesSchema = z.object({
  paymentSuccess: z.string().optional(),
  paymentFailed: z.string().optional(),
  paymentExpired: z.string().optional(),
  routerOffline: z.string().optional(),
})

const configSchema = z.object({
  botToken: z.string().trim().optional(),
  chatId: z.string().trim().optional(),
  enabled: z.coerce.boolean().optional(),
  notifyPaymentSuccess: z.coerce.boolean().optional(),
  notifyPaymentFailed: z.coerce.boolean().optional(),
  notifyPaymentExpired: z.coerce.boolean().optional(),
  notifyRouterOffline: z.coerce.boolean().optional(),
  routerCheckIntervalMinutes: z.coerce.number().int().min(1).max(1440).optional(),
  templates: templatesSchema.optional(),
})

/** Daftar tipe notifikasi yang valid untuk body test. */
const NOTIFY_TYPES = ["paymentSuccess", "paymentFailed", "paymentExpired", "routerOffline"] as const
type NotifyType = (typeof NOTIFY_TYPES)[number]

export async function telegramRoutes(app: FastifyInstance): Promise<void> {
  const superOnly = {
    onRequest: [app.authenticate],
    preHandler: [app.requireRoles(["super_admin", "admin"])],
  }

  // GET /telegram/config — muat konfigurasi + template (token dimasking)
  app.get("/telegram/config", superOnly, async (_req, reply) => {
    const cfg = await getTelegramConfig(app)
    return reply.send({
      data: {
        botToken: cfg.botToken ? `${cfg.botToken.slice(0, 8)}****` : "",
        chatId: cfg.chatId,
        enabled: cfg.enabled,
        notifyPaymentSuccess: cfg.notifyPaymentSuccess,
        notifyPaymentFailed: cfg.notifyPaymentFailed,
        notifyPaymentExpired: cfg.notifyPaymentExpired,
        notifyRouterOffline: cfg.notifyRouterOffline,
        routerCheckIntervalMinutes: cfg.routerCheckIntervalMinutes,
        templates: cfg.templates,
        defaults: {
          templates: DEFAULT_TELEGRAM_TEMPLATES,
          routerCheckIntervalMinutes: DEFAULT_TELEGRAM_CONFIG.routerCheckIntervalMinutes,
        },
        configured: Boolean(cfg.botToken && cfg.chatId),
      },
    })
  })

  // PUT /telegram/config — simpan konfigurasi (token diabaikan bila masked/tidak diisi)
  app.put("/telegram/config", superOnly, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = configSchema.parse(req.body ?? {})
    const current = await getTelegramConfig(app)
    const tokenFilled = body.botToken && !body.botToken.includes("****")
    const next = {
      botToken: tokenFilled ? String(body.botToken) : current.botToken,
      chatId: body.chatId !== undefined ? body.chatId : current.chatId,
      enabled: body.enabled ?? current.enabled,
      notifyPaymentSuccess: body.notifyPaymentSuccess ?? current.notifyPaymentSuccess,
      notifyPaymentFailed: body.notifyPaymentFailed ?? current.notifyPaymentFailed,
      notifyPaymentExpired: body.notifyPaymentExpired ?? current.notifyPaymentExpired,
      notifyRouterOffline: body.notifyRouterOffline ?? current.notifyRouterOffline,
      routerCheckIntervalMinutes:
        body.routerCheckIntervalMinutes ?? current.routerCheckIntervalMinutes,
      templates: { ...current.templates, ...(body.templates ?? {}) },
    }
    await saveTelegramConfig(app, next)
    return reply.send({ data: { message: "Konfigurasi Telegram disimpan" } })
  })

  // POST /telegram/test — uji bot token + kirim pesan percobaan ke chat tujuan
  app.post("/telegram/test", superOnly, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z
      .object({
        botToken: z.string().trim().optional(),
        chatId: z.string().trim().optional(),
        type: z.enum(NOTIFY_TYPES).optional(),
      })
      .parse(req.body ?? {})

    const current = await getTelegramConfig(app)
    const token =
      body.botToken && !body.botToken.includes("****") ? body.botToken : current.botToken
    const chatId = body.chatId || current.chatId

    if (!token) {
      return reply.code(400).send({
        error: { code: "NOT_CONFIGURED", message: "Bot Token wajib diisi terlebih dahulu" },
      })
    }
    const me = await testTelegramBot(token)
    if (!me.ok) {
      return reply.send({ data: { ok: false, step: "bot", error: me.error } })
    }
    if (!chatId) {
      return reply.send({
        data: { ok: true, step: "bot", botName: me.botName, message: "Bot valid, chatId belum diisi" },
      })
    }
    const type = (body.type ?? "paymentSuccess") as NotifyType
    const cfg = await getTelegramConfig(app)
    const template = cfg.templates[type] || DEFAULT_TELEGRAM_TEMPLATES[type]
    const sample: Record<string, string> = {
      nama: "Budi Santoso (contoh)",
      kode: "PY-1024",
      jumlah: "150000",
      metode: "QRIS",
      tanggal: new Date().toLocaleString("id-ID"),
      router: "Mikrotik-Core-01 (contoh)",
      host: "192.168.1.1:8728",
    }
    const res = await sendTelegramMessage(
      app,
      token,
      chatId,
      `🔔 <b>Pesan Uji — ${type}</b>\n\n${template.replace(/\{(\w+)\}/g, (_m: string, k: string) => sample[k] ?? "")}`,
    )
    return reply.send({
      data: { ok: res.ok, step: "send", botName: me.botName, error: res.error },
    })
  })
}
