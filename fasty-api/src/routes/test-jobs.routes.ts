import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import { nextCode, nextDailyCode } from "../utils/codegen.js"
import { fillPlaceholders } from "../utils/template.js"
import { sendWhatsAppMessage, buildPaymentLinkForInvoice, sleep } from "../services/wa.service.js"

const testSchema = z.object({
  job: z.enum(["reminder-h7", "reminder-h3", "reminder-h1", "isolir", "retention", "invoice"]),
})

export async function testJobsRoutes(app: FastifyInstance) {
  // Only enable in dev
  if (process.env.NODE_ENV !== "development") return

  app.post("/test/trigger-job", { onRequest: [app.authenticate] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { job } = testSchema.parse(req.body)

    try {
      if (job.startsWith("reminder")) {
        const days = Number(job.split("-")[1])
        await triggerReminder(app, days)
      } else if (job === "isolir") {
        await triggerIsolir(app)
      } else if (job === "retention") {
        await triggerRetention(app)
      } else if (job === "invoice") {
        await triggerInvoice(app)
      }

      return reply.send({ ok: true, job })
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ ok: false, error: String(err) })
    }
  })
}

async function triggerReminder(app: FastifyInstance, days: number) {
  const [template] = (await app.db.query(
    "SELECT * FROM reminder_templates WHERE days = ? LIMIT 1",
    [days],
  )) as Record<string, unknown>[]

  if (!template) throw new Error(`No template for H-${days}`)

  const invoices = (await app.db.query(
    `SELECT i.id AS invoice_id, i.code AS invoice_code, i.due_at, i.total_amount AS amount,
            c.id AS customer_id, c.name AS customer_name, c.phone, c.expiry_at,
            p.name AS package_name
     FROM invoices i
     JOIN customers c ON i.customer_id = c.id
     LEFT JOIN packages p ON c.package_id = p.id
     WHERE i.status = 'Belum Lunas'
       AND i.due_at = DATE_ADD(CURRENT_DATE(), INTERVAL ? DAY)
     LIMIT 10`,
    [days],
  )) as Record<string, unknown>[]

  console.log(`[TEST] Found ${invoices.length} reminders to send`)

  const formatDate = (d: unknown): string => {
    if (!d) return ""
    const date = new Date(d as string | number)
    if (isNaN(date.getTime())) return ""
    return date.toLocaleDateString("id-ID", { year: "numeric", month: "2-digit", day: "2-digit" })
  }

  let sent = 0
  let failed = 0

  for (let idx = 0; idx < invoices.length; idx++) {
    const inv = invoices[idx]
    const phone = String(inv.phone ?? "")

    const vars: Record<string, string> = {
      nama: String(inv.customer_name ?? ""),
      jumlah: inv.amount == null ? "" : String(inv.amount),
      tanggal: formatDate(inv.due_at),
      no_invoice: String(inv.invoice_code ?? ""),
      paket: String(inv.package_name ?? ""),
      expired: formatDate(inv.expiry_at),
    }

    // Add payment link jika template membutuhkannya
    if ((template.body as string).includes("{payment_link}")) {
      try {
        const link = await buildPaymentLinkForInvoice(app, {
          invoice_id: Number(inv.invoice_id),
          customer_id: Number(inv.customer_id),
          amount: Number(inv.amount),
        })
        if (link) vars.payment_link = link
      } catch (err) {
        app.log.warn({ invoiceId: inv.invoice_id, error: String(err) }, "Gagal buat payment link")
      }
    }

    const message = fillPlaceholders(template.body as string, vars)
    console.log(`[TEST] Sending to ${phone}: ${message.substring(0, 50)}...`)

    const result = await sendWhatsAppMessage(app, { phone, message })
    const ntCode = await app.db.transaction(async (q) =>
      nextCode(q.query, "notification_logs", "NT-", { minStart: 1000 }),
    )

    await app.db.query(
      "INSERT INTO notification_logs (code, type, customer_id, channel, status, error, sent_at) VALUES (?, 'reminder', ?, 'WhatsApp', ?, ?, NOW())",
      [ntCode, inv.customer_id, result.ok ? "Terkirim" : "Gagal", result.ok ? null : result.error],
    )

    if (result.ok) {
      sent++
      console.log(`✅ Sent to ${phone}`)
    } else {
      failed++
      console.log(`❌ Failed to ${phone}: ${result.error}`)
    }

    if ((idx + 1) % 5 === 0 && idx + 1 < invoices.length) {
      await sleep(500)
    }
  }

  console.log(`[TEST] Reminder H-${days} complete: ${sent} sent, ${failed} failed`)
}

async function triggerIsolir(app: FastifyInstance) {
  const customers = (await app.db.query(
    "SELECT * FROM customers WHERE status = 'Active' AND expiry_at < CURRENT_DATE() LIMIT 5",
  )) as Record<string, unknown>[]

  console.log(`[TEST] Found ${customers.length} expired customers`)

  for (const c of customers) {
    await app.db.query("UPDATE customers SET status = 'Isolir' WHERE id = ?", [c.id])

    const logCode = await app.db.transaction(async (q) =>
      nextCode(q.query, "activity_logs", "AL-", { minStart: 1000 }),
    )

    await app.db.query(
      "INSERT INTO activity_logs (code, actor, action, target, created_at) VALUES (?, 'Sistem', 'Isolir otomatis', ?, NOW())",
      [logCode, `${c.name} (${c.code})`],
    )

    console.log(`✅ Isolated ${c.name}`)
  }
}

async function triggerRetention(app: FastifyInstance) {
  const result = await app.db.query(
    "DELETE FROM invoices WHERE status = 'Lunas' AND paid_at < DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)",
  )

  console.log(`[TEST] Deleted ${(result as any).affectedRows} old invoices`)
}

async function triggerInvoice(app: FastifyInstance) {
  const [settings] = (await app.db.query("SELECT billing_cycle FROM app_settings WHERE id = 1")) as Record<
    string,
    unknown
  >[]
  const cycle = String(settings?.billing_cycle ?? "Setiap 1 bulan")
  const m = cycle.match(/(\d+)/)
  const months = m ? Math.max(1, Number(m[1])) : 1
  const lookAheadDays = months * 31

  const customers = (await app.db.query(
    `SELECT c.*, p.price FROM customers c
     LEFT JOIN packages p ON c.package_id = p.id
     WHERE c.status = 'Active' AND c.expiry_at IS NOT NULL
       AND c.expiry_at BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL ? DAY)
     LIMIT 5`,
    [lookAheadDays],
  )) as Record<string, unknown>[]

  console.log(`[TEST] Found ${customers.length} customers to generate invoices for`)

  for (const c of customers) {
    const exists = (await app.db.query(
      "SELECT id FROM invoices WHERE customer_id = ? AND status = 'Belum Lunas' LIMIT 1",
      [c.id],
    )) as Record<string, unknown>[]

    if (exists.length > 0) {
      console.log(`Skip ${c.name}: already has unpaid invoice`)
      continue
    }

    const invCode = await app.db.transaction(async (q) =>
      nextCode(q.query, "invoices", "INV-", { minStart: 1000 }),
    )

    const dueAt = c.expiry_at

    await app.db.query(
      "INSERT INTO invoices (code, customer_id, due_at, total_amount, status, created_at) VALUES (?, ?, ?, ?, 'Belum Lunas', NOW())",
      [invCode, c.id, dueAt, c.price || 0],
    )

    console.log(`✅ Created invoice ${invCode} for ${c.name}`)
  }
}
