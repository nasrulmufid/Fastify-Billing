import cron from "node-cron"
import type { FastifyInstance } from "fastify"

import { nextCode } from "../utils/codegen.js"
import { addMonthsToExpiry, formatIdDate, fromISODate, toISODate } from "../utils/date.js"
import { recordRouterWarning, withRouter } from "../services/router.service.js"

/**
 * Scheduler (node-cron) — sesuai Backend.PRD.md bagian 10.
 * Diaktifkan hanya di production (NODE_ENV=production) agar tidak mengganggu dev.
 */
export function registerJobs(app: FastifyInstance) {
  // 1. Tanggal 1 tiap bulan — generate invoice bulanan utk customer aktif
  cron.schedule("0 0 1 * *", async () => {
    try {
      const period = formatIdDate(new Date()).split(" ").slice(1).join(" ") // "Agustus 2026"
      const customers = (await app.db.query(
        "SELECT * FROM customers WHERE status = 'Active'",
      )) as Record<string, unknown>[]
      for (const c of customers) {
        const [pkg] = (await app.db.query("SELECT * FROM packages WHERE id = ?", [
          c.package_id,
        ])) as Record<string, unknown>[]
        if (!pkg) continue
        const code = await app.db.transaction(async (q) => nextCode(q.query, "invoices", "INV-"))
        await app.db.query(
          "INSERT INTO invoices (code, customer_id, amount, status, period, due_at) VALUES (?, ?, ?, 'Unpaid', ?, ?)",
          [code, c.id, pkg.price, period, toISODate(addMonthsToExpiry(formatIdDate(new Date()), 1))],
        )
      }
      app.log.info({ count: customers.length }, "Invoice bulanan dibuat")
    } catch (err) {
      app.log.error(err, "Gagal generate invoice bulanan")
    }
  })

  // 2. Setiap hari 01:00 — tandai invoice lewat jatuh tempo -> Overdue
  cron.schedule("0 1 * * *", async () => {
    try {
      await app.db.query("UPDATE invoices SET status = 'Overdue' WHERE status = 'Unpaid' AND due_at < CURRENT_DATE()")
      app.log.info("Invoice overdue ditandai")
    } catch (err) {
      app.log.error(err, "Gagal tandai overdue")
    }
  })

  // 3. Setiap hari 02:00 — isolir customer yg grace period terlampaui
  cron.schedule("0 2 * * *", async () => {
    try {
      const [row] = (await app.db.query(
        "SELECT grace_period_days FROM app_settings WHERE id = 1",
      )) as Record<string, unknown>[]
      const grace = Number(row?.grace_period_days ?? 7)
      const result = (await app.db.query(
        `UPDATE customers SET status = 'Isolated'
         WHERE status = 'Active' AND expiry_at < DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)`,
        [grace],
      )) as unknown as { affectedRows: number }
      if (result.affectedRows) {
        await app.db.query("INSERT INTO activity_logs (actor, action, target) VALUES ('Sistem', 'Isolir otomatis', ?)", [
          `${result.affectedRows} pelanggan`,
        ])
        // Buat notifikasi untuk setiap customer yang terisolir + ubah profile ke ISOLIR di router
        const isolated = (await app.db.query(
          `SELECT c.id AS customer_id, c.name AS customer_name, c.router_id, c.pppoe_username, c.pppoe_password
           FROM customers WHERE status = 'Isolated' AND expiry_at < DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)`,
          [grace],
        )) as Record<string, unknown>[]
        for (const cust of isolated) {
          const ntCode = await app.db.transaction(async (q) =>
            nextCode(q.query, "notification_logs", "NT-", { minStart: 1000 }),
          )
          await app.db.query(
            "INSERT INTO notification_logs (code, type, customer_id, channel, status) VALUES (?, 'isolir', ?, 'WhatsApp', 'Terkirim')",
            [ntCode, cust.customer_id],
          )
          // Sinkron ke Mikrotik: ubah profile ke ISOLIR dengan ip-pool isolir
          if (cust.router_id && cust.pppoe_username) {
            const res = await withRouter(app, cust.router_id as number, async (client) => {
              const [routerRow] = (await app.db.query(
                "SELECT ip_pool_isolir FROM routers WHERE id = ?",
                [cust.router_id],
              )) as Record<string, unknown>[]
              const ipPoolIsolir = routerRow?.ip_pool_isolir ? String(routerRow.ip_pool_isolir) : undefined
              await client.changePppProfile({
                name: String(cust.pppoe_username),
                password: String(cust.pppoe_password ?? ""),
                profile: "ISOLIR",
                ipPool: ipPoolIsolir,
              })
            })
            if (!res.ok) {
              await recordRouterWarning(app, {
                routerId: Number(cust.router_id),
                customerId: Number(cust.customer_id),
                action: "Isolir otomatis",
                warning: res.warning,
              })
            }
          }
        }
      }
    } catch (err) {
      app.log.error(err, "Gagal isolir otomatis")
    }
  })

  // 4. Setiap hari 08:00 — reminder tagihan H-3
  cron.schedule("0 8 * * *", async () => {
    try {
      const invoices = (await app.db.query(
        `SELECT i.*, c.name AS customer_name, c.phone FROM invoices i
         JOIN customers c ON c.id = i.customer_id
         WHERE i.status = 'Unpaid' AND i.due_at BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL 3 DAY)`,
      )) as Record<string, unknown>[]
      for (const inv of invoices) {
        const ntCode = await app.db.transaction(async (q) =>
          nextCode(q.query, "notification_logs", "NT-", { minStart: 1000 }),
        )
        await app.db.query(
          "INSERT INTO notification_logs (code, type, customer_id, channel, status) VALUES (?, 'reminder', ?, 'WhatsApp', 'Terkirim')",
          [ntCode, inv.customer_id],
        )
      }
      app.log.info({ count: invoices.length }, "Reminder tagihan dikirim")
    } catch (err) {
      app.log.error(err, "Gagal kirim reminder")
    }
  })

  // 5. Setiap 15 menit — voucher hotspot kedaluwarsa
  cron.schedule("*/15 * * * *", async () => {
    try {
      await app.db.query(
        "UPDATE hotspot_users SET status = 'Expired' WHERE status = 'Belum Terpakai' AND valid_until < NOW()",
      )
    } catch (err) {
      app.log.error(err, "Gagal update voucher expired")
    }
  })
}
