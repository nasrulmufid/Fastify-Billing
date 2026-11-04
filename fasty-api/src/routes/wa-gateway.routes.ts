import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import { nextCode } from "../utils/codegen.js"
import { config } from "../config.js"
import { decryptSecret, encryptSecret, maskSecret } from "../utils/crypto.js"
import { normalizePhone } from "../utils/phone.js"
import { fillPlaceholders } from "../utils/template.js"
import {
  sendWhatsAppMessage,
  sleep,
  buildPaymentLinkForInvoice,
  getOfflineMessage,
  DEFAULT_OFFLINE_MESSAGE,
} from "../services/wa.service.js"
import {
  initBaileysSock,
  requestBaileyQr,
  getBaileyStatus,
  disconnectBaileys,
  storeDeviceCredentials,
  getDeviceName,
  requestBaileyPairingCode,
} from "../services/baileys.service.js"

const templateSchema = z.object({
  name: z.string().min(1, "Nama template wajib diisi"),
  body: z.string().min(1, "Isi pesan wajib diisi"),
})

const configSchema = z.object({
  deviceName: z.string().optional(),
  offlineMessage: z.string().optional(),
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
        payment_link: z.string().optional(),
        expired: z.string().optional(),
      }),
    )
    .optional(),
})

export async function waGatewayRoutes(app: FastifyInstance) {
  const superOnly = {
    onRequest: [app.authenticate],
    preHandler: [app.requireRoles(["super_admin"])],
  }

  // Lazy init Baileys — run saat first request, bukan saat app startup
  let baileysInitialized = false
  const ensureBaileysInit = async () => {
    if (!baileysInitialized) {
      baileysInitialized = true
      try {
        await initBaileysSock(app)
      } catch (err) {
        app.log.warn(err, "Baileys init failed")
        baileysInitialized = false
        throw err
      }
    }
  }

  const resetBaileySession = async () => {
    baileysInitialized = false
    await disconnectBaileys()
  }

  // ---- Status & QR ----
  app.get("/wa-gateway/status", superOnly, async (_req, reply) => {
    try {
      await initBaileysSock(app)
      const status = getBaileyStatus()
      return reply.send({
        data: {
          connected: status.connected,
          state: status.state,
          qr: status.qr,
          pairingCode: status.pairingCode,
        },
      })
    } catch (err) {
      return reply.code(502).send({
        error: {
          code: "GOWA_UNAVAILABLE",
          message: err instanceof Error ? err.message : "GOWA tidak tersedia",
        },
      })
    }
  })


  app.post("/wa-gateway/qr", superOnly, async (_req, reply) => {
    try {
      await resetBaileySession()
      await requestBaileyQr(app)
      return reply.send({ data: getBaileyStatus() })
    } catch (err) {
      return reply.code(500).send({ error: { code: "QR_FAILED", message: err instanceof Error ? err.message : "Gagal membuat QR" } })
    }
  })

  app.post<{ Body: { phone: string } }>("/wa-gateway/pairing-code", superOnly, async (req, reply) => {
    try {
      const pairingCode = await requestBaileyPairingCode(app, req.body.phone)
      return reply.send({ data: { pairingCode } })
    } catch (err) {
      return reply.code(400).send({ error: { code: "PAIRING_CODE_FAILED", message: err instanceof Error ? err.message : "Gagal membuat pairing code" } })
    }
  })

  app.post("/wa-gateway/disconnect", superOnly, async (_req, reply) => {
    await disconnectBaileys()
    return reply.send({ data: { message: "WhatsApp disconnected" } })
  })

  app.post("/wa-gateway/test", superOnly, async (req, reply) => {
    const status = getBaileyStatus()
    if (!status.connected) {
      return reply.code(400).send({
        error: {
          code: "NOT_CONNECTED",
          message: "WhatsApp bot belum terhubung",
        },
      })
    }

    try {
      // Just verify connection; don't send actual test message
      return reply.send({
        data: { message: "WhatsApp bot terhubung dan siap mengirim pesan" },
      })
    } catch (err) {
      return reply.code(500).send({
        error: {
          code: "TEST_FAILED",
          message: "Gagal menguji koneksi",
        },
      })
    }
  })

  // ---- Reminder Templates (h7, h3, h1, isolir) ----
  app.get("/wa-gateway/reminder-templates", superOnly, async (req, reply) => {
    const rows = (await app.db.query(
      "SELECT id, code, name, body, type FROM wa_templates WHERE type IN ('reminder_h7', 'reminder_h3', 'reminder_h1', 'isolir') ORDER BY FIELD(type, 'reminder_h7', 'reminder_h3', 'reminder_h1', 'isolir'), id ASC",
    )) as Record<string, unknown>[]
    return reply.send({
      data: rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: String(r.name ?? "").slice(0, 120),
        body: String(r.body ?? "").slice(0, 4096),
        type: r.type,
        createdAt: String(r.created_at ?? ""),
        updatedAt: String(r.updated_at ?? ""),
      })),
    })
  })

  app.post(
    "/wa-gateway/reminder-templates",
    superOnly,
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = z
          .object({
            name: z.string().min(1, "Nama template wajib diisi"),
            bodyText: z.string().min(1, "Isi pesan wajib diisi"),
            type: z.enum(["reminder_h7", "reminder_h3", "reminder_h1", "isolir"]),
          })
          .parse(req.body)

        if (body.name.length > 120) {
          return reply.code(400).send({
            error: { code: "VALIDATION_ERROR", message: "Nama template terlalu panjang (maks 120 karakter)" },
          })
        }
        if (body.bodyText.length > 4096) {
          return reply.code(400).send({
            error: { code: "VALIDATION_ERROR", message: "Isi pesan terlalu panjang (maks 4096 karakter)" },
          })
        }

        const code = await app.db.transaction(async (q) => {
          return nextCode(q.query, "wa_templates", "TPL-", { minStart: 1, pad: 3 })
        })
        const result = (await app.db.query(
          "INSERT INTO wa_templates (code, name, body, type) VALUES (?, ?, ?, ?)",
          [code, body.name.trim(), body.bodyText.trim(), body.type],
        )) as unknown as { insertId: number }
        return reply.code(201).send({
          data: {
            id: result.insertId,
            code,
            name: body.name,
            body: body.bodyText,
            type: body.type,
          },
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Validasi gagal"
        app.log.warn({ error: msg }, "Reminder template creation validation failed")
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: msg },
        })
      }
    },
  )

  app.put(
    "/wa-gateway/reminder-templates/:id",
    superOnly,
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = req.params as { id: string }
        const templateId = parseInt(id, 10)
        if (!Number.isInteger(templateId) || templateId <= 0) {
          return reply.code(400).send({
            error: { code: "INVALID_ID", message: "ID template tidak valid" },
          })
        }

        const body = z
          .object({
            name: z.string().min(1).optional(),
            bodyText: z.string().min(1).optional(),
          })
          .parse(req.body)

        if (body.name && body.name.length > 120) {
          return reply.code(400).send({
            error: { code: "VALIDATION_ERROR", message: "Nama template terlalu panjang" },
          })
        }
        if (body.bodyText && body.bodyText.length > 4096) {
          return reply.code(400).send({
            error: { code: "VALIDATION_ERROR", message: "Isi pesan terlalu panjang" },
          })
        }

        await app.db.query(
          "UPDATE wa_templates SET name = COALESCE(?, name), body = COALESCE(?, body) WHERE id = ? AND type IN ('reminder_h7', 'reminder_h3', 'reminder_h1', 'isolir')",
          [body.name?.trim() ?? null, body.bodyText?.trim() ?? null, templateId],
        )
        return reply.send({ data: { message: "Template reminder diperbarui" } })
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Update gagal"
        app.log.warn({ error: msg }, "Reminder template update failed")
        return reply.code(400).send({
          error: { code: "UPDATE_ERROR", message: msg },
        })
      }
    },
  )

  app.delete(
    "/wa-gateway/reminder-templates/:id",
    superOnly,
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = req.params as { id: string }
        const templateId = parseInt(id, 10)
        if (!Number.isInteger(templateId) || templateId <= 0) {
          return reply.code(400).send({
            error: { code: "INVALID_ID", message: "ID template tidak valid" },
          })
        }

        const result = await app.db.query(
          "DELETE FROM wa_templates WHERE id = ? AND type IN ('reminder_h7', 'reminder_h3', 'reminder_h1', 'isolir')",
          [templateId],
        )
        if ((result as unknown as { affectedRows: number }).affectedRows === 0) {
          return reply.code(404).send({
            error: { code: "NOT_FOUND", message: "Template reminder tidak ditemukan" },
          })
        }
        return reply.send({ data: { message: "Template reminder dihapus" } })
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Delete gagal"
        app.log.warn({ error: msg }, "Reminder template delete failed")
        return reply.code(400).send({
          error: { code: "DELETE_ERROR", message: msg },
        })
      }
    },
  )

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
        name: String(r.name ?? "").slice(0, 120),
        body: String(r.body ?? "").slice(0, 4096),
        createdAt: String(r.created_at ?? ""),
        updatedAt: String(r.updated_at ?? ""),
      })),
    })
  })

  app.post("/wa-gateway/templates", superOnly, async (req, reply) => {
    try {
      const body = templateSchema.parse(req.body)
      
      // Validate lengths
      if (body.name.length > 120) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "Nama template terlalu panjang (maks 120 karakter)" },
        })
      }
      if (body.body.length > 4096) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "Isi pesan terlalu panjang (maks 4096 karakter)" },
        })
      }

      const code = await app.db.transaction(async (q) => {
        return nextCode(q.query, "wa_templates", "TPL-", { minStart: 1, pad: 3 })
      })
      const result = (await app.db.query(
        "INSERT INTO wa_templates (code, name, body) VALUES (?, ?, ?)",
        [code, body.name.trim(), body.body.trim()],
      )) as unknown as { insertId: number }
      return reply.code(201).send({ data: { id: result.insertId, code, ...body } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Validasi gagal"
      app.log.warn({ error: msg }, "Template creation validation failed")
      return reply.code(400).send({
        error: { code: "VALIDATION_ERROR", message: msg },
      })
    }
  })

  app.put("/wa-gateway/templates/:id", superOnly, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string }
      const templateId = parseInt(id, 10)
      if (!Number.isInteger(templateId) || templateId <= 0) {
        return reply.code(400).send({
          error: { code: "INVALID_ID", message: "ID template tidak valid" },
        })
      }

      const body = templateSchema.partial().parse(req.body)
      if (body.name && body.name.length > 120) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "Nama template terlalu panjang" },
        })
      }
      if (body.body && body.body.length > 4096) {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: "Isi pesan terlalu panjang" },
        })
      }

      await app.db.query(
        "UPDATE wa_templates SET name = COALESCE(?, name), body = COALESCE(?, body) WHERE id = ?",
        [body.name?.trim() ?? null, body.body?.trim() ?? null, templateId],
      )
      return reply.send({ data: { message: "Template diperbarui" } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update gagal"
      app.log.warn({ error: msg }, "Template update failed")
      return reply.code(400).send({
        error: { code: "UPDATE_ERROR", message: msg },
      })
    }
  })

  app.delete("/wa-gateway/templates/:id", superOnly, async (req, reply) => {
    try {
      const { id } = req.params as { id: string }
      const templateId = parseInt(id, 10)
      if (!Number.isInteger(templateId) || templateId <= 0) {
        return reply.code(400).send({
          error: { code: "INVALID_ID", message: "ID template tidak valid" },
        })
      }

      const result = await app.db.query("DELETE FROM wa_templates WHERE id = ?", [templateId])
      if ((result as unknown as { affectedRows: number }).affectedRows === 0) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "Template tidak ditemukan" },
        })
      }
      return reply.send({ data: { message: "Template dihapus" } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete gagal"
      app.log.warn({ error: msg }, "Template delete failed")
      return reply.code(400).send({
        error: { code: "DELETE_ERROR", message: msg },
      })
    }
  })

  // ---- Config ----
  app.get("/wa-gateway/config", superOnly, async (req, reply) => {
    const deviceName = await getDeviceName(app)
    const status = getBaileyStatus()
    return reply.send({
      data: {
        deviceName: deviceName || "Fasty Bot",
        connected: status.connected,
        state: status.state,
      },
    })
  })

  app.put("/wa-gateway/config", superOnly, async (req, reply) => {
    try {
      const body = configSchema.parse(req.body)
      if (body.deviceName) {
        await storeDeviceCredentials(app, body.deviceName)
      }
      return reply.send({ data: { message: "Konfigurasi WA Gateway disimpan" } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Validasi gagal"
      app.log.warn({ error: msg }, "Config update validation failed")
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: msg,
        },
      })
    }
  })

  // GET /wa-gateway/payment-received-message
  app.get("/wa-gateway/payment-received-message", superOnly, async (_req, reply) => {
    const [row] = (await app.db.query(
      "SELECT payment_received_message FROM wa_api_config WHERE id = 1",
    )) as Record<string, unknown>[]
    const custom = String(row?.payment_received_message ?? "").trim()
    
    const defaultBody = "Yth {nama}, pembayaran Anda sebesar {jumlah} melalui {metode} telah kami terima. Terima kasih.\n\nLayanan internet Anda tetap aktif."
    
    if (custom) {
      return reply.send({ data: { body: custom, isCustom: true, defaultBody } })
    }
    
    return reply.send({ data: { body: defaultBody, isCustom: false, defaultBody } })
  })

  // PUT /wa-gateway/payment-received-message
  app.put("/wa-gateway/payment-received-message", superOnly, async (req, reply) => {
    try {
      const body = z.object({ body: z.string().max(4096) }).parse(req.body ?? {})
      const custom = body.body.trim()

      if (custom && custom.length < 10) {
        return reply.code(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Pesan minimal 10 karakter",
          },
        })
      }

      await app.db.query(
        `INSERT INTO wa_api_config (id, payment_received_message) VALUES (1, ?)
         ON DUPLICATE KEY UPDATE payment_received_message = VALUES(payment_received_message)`,
        [custom || null],
      )
      return reply.send({
        data: { message: "Pesan terima pembayaran disimpan", body: custom || "" },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Validasi gagal"
      app.log.warn({ error: msg }, "Payment received message validation failed")
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: msg,
        },
      })
    }
  })

  // GET /wa-gateway/offline-message
  app.get("/wa-gateway/offline-message", superOnly, async (_req, reply) => {
    const tpl = await getOfflineMessage(app)
    const [row] = (await app.db.query("SELECT offline_message FROM wa_api_config WHERE id = 1")) as Record<
      string,
      unknown
    >[]
    return reply.send({
      data: {
        body: tpl.body,
        isCustom: Boolean(String(row?.offline_message ?? "").trim()),
        defaultBody: DEFAULT_OFFLINE_MESSAGE,
      },
    })
  })

  // PUT /wa-gateway/offline-message
  app.put("/wa-gateway/offline-message", superOnly, async (req, reply) => {
    try {
      const body = z.object({ body: z.string().max(4096) }).parse(req.body ?? {})
      const custom = body.body.trim()

      if (custom && custom.length < 10) {
        return reply.code(400).send({
          error: {
            code: "VALIDATION_ERROR",
            message: "Pesan minimal 10 karakter",
          },
        })
      }

      await app.db.query(
        `INSERT INTO wa_api_config (id, offline_message) VALUES (1, ?)
         ON DUPLICATE KEY UPDATE offline_message = VALUES(offline_message)`,
        [custom || null],
      )
      return reply.send({
        data: { message: "Pesan server offline disimpan", body: custom || DEFAULT_OFFLINE_MESSAGE },
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Validasi gagal"
      app.log.warn({ error: msg }, "Offline message validation failed")
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: msg,
        },
      })
    }
  })

  // POST /wa-gateway/send
  app.post("/wa-gateway/send", superOnly, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = sendSchema.parse(req.body)
      app.log.info({ toCount: body.to.length, varsCount: body.vars?.length ?? 0, hasTemplate: !!body.template }, "WA Gateway: send request received")

      // Validate recipients count (prevent abuse)
      if (body.to.length > 1000) {
        return reply.code(400).send({
          error: {
            code: "TOO_MANY_RECIPIENTS",
            message: "Maksimal 1000 penerima per request",
          },
        })
      }

      // Validate message
      const msgLength = body.template.body.length
      if (msgLength > 4096) {
        return reply.code(400).send({
          error: {
            code: "MESSAGE_TOO_LONG",
            message: "Pesan terlalu panjang (maks 4096 karakter)",
          },
        })
      }

      const needsPaymentLink = body.template.body.includes("{payment_link}")
      let paymentGatewayApiKey = ""
      if (needsPaymentLink) {
        paymentGatewayApiKey = config.sumopod.apiKey.trim()
        if (!paymentGatewayApiKey) {
          return reply.code(400).send({
            error: {
              code: "NOT_CONFIGURED",
              message: "Payment gateway QRIS belum dikonfigurasi oleh admin",
            },
          })
        }
      }

      const varsByPhone = new Map<string, Record<string, string>>()
      for (const v of body.vars ?? []) {
        const phone = normalizePhone(v.phone)
        if (!phone) continue
        varsByPhone.set(phone, {
          nama: (v.nama ?? "").slice(0, 200),
          jumlah: (v.jumlah ?? "").slice(0, 100),
          tanggal: (v.tanggal ?? "").slice(0, 100),
          no_invoice: (v.no_invoice ?? "").slice(0, 100),
          paket: (v.paket ?? "").slice(0, 100),
          payment_link: (v.payment_link ?? "").slice(0, 500),
          expired: (v.expired ?? "").slice(0, 100),
        })
      }

      let sent = 0
      let failed = 0
      for (const rawPhone of body.to) {
        const phone = normalizePhone(rawPhone)
        if (!phone) {
          failed++
          continue
        }

        const vars = { ...(varsByPhone.get(phone) ?? {}) }
        
        // Query customer + invoice data
        const phonePattern = phone.startsWith("62") ? phone.slice(2) : phone.replace(/^0/, "")
        const [customerData] = (await app.db.query(
          `SELECT c.id AS customer_id, c.name, c.expiry_at, p.name AS package_name
           FROM customers c
           LEFT JOIN packages p ON p.id = c.package_id
           WHERE c.phone LIKE ? OR c.phone LIKE ?
           LIMIT 1`,
          [`%62${phonePattern}%`, `%0${phonePattern}%`],
        )) as Record<string, unknown>[]

        app.log.info({ phone, hasCustomerData: !!customerData, customerId: customerData?.customer_id, expiryAt: customerData?.expiry_at, packageName: customerData?.package_name }, "WA Gateway: customer data loaded")

        const [invoiceData] = customerData
          ? ((await app.db.query(
              `SELECT id AS invoice_id, code AS invoice_code, amount, due_at
               FROM invoices
               WHERE customer_id = ? AND status IN ('Unpaid', 'Overdue')
               ORDER BY id DESC LIMIT 1`,
              [customerData.customer_id],
            )) as Record<string, unknown>[])
          : []

        app.log.info({ phone, hasInvoiceData: !!invoiceData, invoiceCode: invoiceData?.invoice_code, amount: invoiceData?.amount, dueAt: invoiceData?.due_at }, "WA Gateway: invoice data loaded")

        // Helper format date ke DD/MM/YYYY
        const formatDate = (d: unknown): string => {
          if (!d) return ""
          const date = new Date(d as string | number)
          if (isNaN(date.getTime())) return ""
          return date.toLocaleDateString("id-ID", { year: "numeric", month: "2-digit", day: "2-digit" })
        }

        // Fill vars dari customer data (selalu ada jika customer found)
        vars.nama ||= String(customerData?.name ?? "").slice(0, 200)
        vars.paket ||= String(customerData?.package_name ?? "").slice(0, 100)
        vars.expired ||= formatDate(customerData?.expiry_at).slice(0, 100)
        
        // Fill vars dari invoice data (hanya jika ada invoice Unpaid/Overdue)
        vars.jumlah ||= invoiceData?.amount == null ? "" : String(invoiceData.amount).slice(0, 100)
        vars.tanggal ||= formatDate(invoiceData?.due_at).slice(0, 100)
        vars.no_invoice ||= String(invoiceData?.invoice_code ?? "").slice(0, 100)

        if (!vars.payment_link && invoiceData?.invoice_id && paymentGatewayApiKey) {
          vars.payment_link =
            (await buildPaymentLinkForInvoice(app, {
              invoice_id: Number(invoiceData.invoice_id),
              customer_id: Number(customerData?.customer_id ?? 0),
              amount: Number(invoiceData.amount ?? 0),
            })) ?? ""
        }

        const message = fillPlaceholders(body.template.body, vars)
        const result = await sendWhatsAppMessage(app, { phone: rawPhone, message })
        const ntCode = await app.db.transaction(async (q) => {
          return nextCode(q.query, "notification_logs", "NT-", { minStart: 1000 })
        })
        const [cust] = (await app.db.query("SELECT id FROM customers WHERE phone LIKE ? OR phone LIKE ? LIMIT 1", [
          `%62${phonePattern}%`, `%0${phonePattern}%`,
        ])) as Record<string, unknown>[]

        if (result.ok) {
          sent++
        } else {
          failed++
          app.log.warn({ phone, error: result.error }, "Gagal kirim WA (manual)")
        }

        await app.db.query(
          "INSERT INTO notification_logs (code, type, customer_id, channel, status, error) VALUES (?, 'reminder', ?, 'WhatsApp', ?, ?)",
          [ntCode, cust?.id ?? null, result.ok ? "Terkirim" : "Gagal", result.ok ? null : result.error?.slice(0, 255)],
        )

        if (sent + failed > 0 && (sent + failed) % 5 === 0) {
          await sleep(1000)
        }
      }
      return reply.send({ data: { sent, failed } })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Validasi gagal"
      app.log.warn({ error: msg }, "Send message validation failed")
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: msg,
        },
      })
    }
  })

  // DEBUG: lookup customer by phone
  app.get("/debug/phones", async (req: FastifyRequest, reply: FastifyReply) => {
    const q = z.object({ phone: z.string() }).parse(req.query)
    const phones = (await app.db.query(
      `SELECT id, name, phone, expiry_at, package_id, status FROM customers 
       WHERE phone LIKE ? OR phone LIKE ? OR phone LIKE ?`,
      [`%${q.phone}%`, `%62${q.phone}%`, `%0${q.phone}%`],
    )) as Record<string, unknown>[]
    return reply.send({ phones, queryPhone: q.phone })
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
