import cron from "node-cron"
import type { FastifyInstance } from "fastify"

import { nextCode, nextDailyCode } from "../utils/codegen.js"
import { addMonthsToExpiry, formatIdDate, fromISODate, toISODate } from "../utils/date.js"
import { fillPlaceholders } from "../utils/template.js"
import { recordRouterWarning, withRouter, enqueueRouterSync, loadPendingSyncQueue, markSyncQueueEntry, firstIpFromCidr } from "../services/router.service.js"
import { syncRouterAfterPayment } from "../services/payment.service.js"
import { getReminderTemplate, sendWhatsAppMessage, sleep, buildPaymentLinkForInvoice } from "../services/wa.service.js"
import { getTelegramConfig, notifyTelegram } from "../services/telegram.service.js"

/**
 * Scheduler (node-cron) — sesuai Backend.PRD.md bagian 10.
 * Dua kelompok:
 *   - registerAlwaysOnJobs  : monitor Mikrotik + antrian sync — SELALU jalan
 *     (termasuk dev) karena fungsinya kritis utk notifikasi & pemulihan.
 *   - registerJobs          : job billing (invoice, reminder, isolir otomatis,
 *     retensi) — hanya production agar tidak mengganggu dev.
 */
export function registerAlwaysOnJobs(app: FastifyInstance) {
  // Cron antrian sync (5 menit) + monitor status Mikrotik (interval dinamis)
  registerSyncQueueJob(app)
  registerRouterMonitor(app)
}

export function registerJobs(app: FastifyInstance) {
  // 1. Setiap hari 08:05 — buat invoice otomatis H-7 sebelum expiry_at customer
  //    Invoice dibuat hanya jika belum ada invoice Unpaid/Overdue.
  //    due_at = expiry_at customer, period = bulan dari expiry_at
  cron.schedule("5 8 * * *", async () => {
    try {
      // Query: customer Active dengan expiry tepat 7 hari ke depan
      const customers = (await app.db.query(
        `SELECT c.id, c.customer_name, c.expiry_at, c.package_id
         FROM customers c
         WHERE c.status IN ('Active', 'Isolated') 
           AND c.expiry_at IS NOT NULL
           AND c.expiry_at = DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY)`,
      )) as Record<string, unknown>[]

      let created = 0
      for (const c of customers) {
        const [pkg] = (await app.db.query("SELECT price FROM packages WHERE id = ?", [
          c.package_id,
        ])) as Record<string, unknown>[]
        if (!pkg) continue

        // Sudah ada invoice Unpaid/Overdue? Skip (prevent duplikat)
        const [open] = (await app.db.query(
          "SELECT id FROM invoices WHERE customer_id = ? AND status IN ('Unpaid','Overdue') LIMIT 1",
          [c.id],
        )) as Record<string, unknown>[]
        if (open) continue

        // Period = bulan dari expiry_at
        const expiryStr = fromISODate(c.expiry_at as string | undefined)
        if (!expiryStr) continue
        const dueISO = toISODate(expiryStr)
        if (!dueISO) continue

        const period = expiryStr.split(" ").slice(1).join(" ") // "September 2026"
        const code = await app.db.transaction(async (q) => nextDailyCode(q.query, "invoices", "INV-"))
        await app.db.query(
          "INSERT INTO invoices (code, customer_id, amount, status, period, due_at) VALUES (?, ?, ?, 'Unpaid', ?, ?)",
          [code, c.id, pkg.price, period, dueISO],
        )
        created++
      }
      app.log.info({ count: created }, "Invoice H-7 otomatis dibuat")
    } catch (err) {
      app.log.error(err, "Gagal buat invoice H-7 otomatis")
    }
  })

  // 2. Setiap hari 08:00 — tandai invoice lewat jatuh tempo -> Overdue
  cron.schedule("0 8 * * *", async () => {
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
          `SELECT c.id AS customer_id, c.name AS customer_name, c.phone, c.router_id, c.pppoe_username, c.pppoe_password,
                  c.expiry_at, i.code AS invoice_code
           FROM customers c
           LEFT JOIN invoices i ON c.id = i.customer_id AND i.status IN ('Unpaid', 'Overdue')
           WHERE c.status = 'Isolated' AND c.expiry_at < DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)
           ORDER BY i.due_at ASC`,
          [grace],
        )) as Record<string, unknown>[]
        for (const cust of isolated) {
          // Kirim pesan notifikasi isolir via template WA
          const isoTemplate = await getReminderTemplate(app, "isolir")
          const paymentLink = cust.invoice_code
            ? `${process.env.FRONTEND_URL || "https://bill.example.com"}/portal/invoice/${cust.invoice_code}`
            : ""
          const isoVars: Record<string, string> = {
            nama: String(cust.customer_name ?? ""),
            expired: cust.expiry_at ? new Date(cust.expiry_at as string).toLocaleDateString("id-ID") : "",
            payment_link: paymentLink,
          }
          const isoMessage = fillPlaceholders(isoTemplate.body, isoVars)
          const isoResult = await sendWhatsAppMessage(app, { phone: String(cust.phone ?? ""), message: isoMessage })
          const ntCode = await app.db.transaction(async (q) =>
            nextCode(q.query, "notification_logs", "NT-", { minStart: 1000 }),
          )
          await app.db.query(
            "INSERT INTO notification_logs (code, type, customer_id, channel, status, error) VALUES (?, 'isolir', ?, 'WhatsApp', ?, ?)",
            [ntCode, cust.customer_id, isoResult.ok ? "Terkirim" : "Gagal", isoResult.ok ? null : isoResult.error],
          )
          if (!isoResult.ok) {
            app.log.warn({ customerId: cust.customer_id, error: isoResult.error }, "Gagal kirim notif isolir WA")
          }
          // Sinkron ke Mikrotik (REST API): ubah profile ke ISOLIR dengan ip-pool isolir.
          // Bila router offline, entri dimasukkan ke antrian sync agar diterapkan
          // otomatis saat router online kembali.
          if (cust.router_id && cust.pppoe_username) {
            const res = await withRouter(app, cust.router_id as number, async (client) => {
              const [routerRow] = (await app.db.query(
                "SELECT ip_pool_isolir FROM routers WHERE id = ?",
                [cust.router_id],
              )) as Record<string, unknown>[]
              const ipPoolIsolir = routerRow?.ip_pool_isolir ? String(routerRow.ip_pool_isolir) : ""
              await client.changePppProfile({
                name: String(cust.pppoe_username),
                password: String(cust.pppoe_password ?? ""),
                profile: "ISOLIR",
                remoteAddress: firstIpFromCidr(ipPoolIsolir),
              })
            })
            if (!res.ok) {
              await recordRouterWarning(app, {
                routerId: Number(cust.router_id),
                customerId: Number(cust.customer_id),
                action: "Isolir otomatis",
                warning: res.warning,
              })
              await enqueueRouterSync(app, {
                routerId: Number(cust.router_id),
                customerId: Number(cust.customer_id),
                reason: "Isolir otomatis",
              })
            }
          }
        }
      }
    } catch (err) {
      app.log.error(err, "Gagal isolir otomatis")
    }
  })

  // Helper: kirim reminder tagihan massal berdasarkan tipe (H-7/H-3/H-1) dengan jeda tiap 5 pesan
  async function sendReminderBatch(type: "h7" | "h3" | "h1", targetDays: number) {
    try {
      // Exact day match: due_at = hari ini + targetDays
      const invoices = (await app.db.query(
        `SELECT i.id AS invoice_id, i.code AS invoice_code, i.amount, i.due_at,
                c.id AS customer_id, c.name AS customer_name, c.phone, c.expiry_at, p.name AS package_name
         FROM invoices i
         JOIN customers c ON c.id = i.customer_id
         LEFT JOIN packages p ON p.id = c.package_id
         WHERE i.status = 'Unpaid' AND i.due_at = DATE_ADD(CURRENT_DATE(), INTERVAL ? DAY)`,
        [targetDays],
      )) as Record<string, unknown>[]

      if (invoices.length === 0) {
        app.log.info({ type }, "Tidak ada invoice yang perlu di-reminder")
        return
      }

      const template = await getReminderTemplate(app, type)
      const needsPaymentLink = template.body.includes("{payment_link}")
      let sent = 0
      let failed = 0

      // Format date ke DD/MM/YYYY
      const formatDate = (d: unknown): string => {
        if (!d) return ""
        const date = new Date(d as string | number)
        if (isNaN(date.getTime())) return ""
        return date.toLocaleDateString("id-ID", { year: "numeric", month: "2-digit", day: "2-digit" })
      }

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
        // Buat payment link per-invoice bila template membutuhkannya
        if (needsPaymentLink) {
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
        const message = fillPlaceholders(template.body, vars)

        const result = await sendWhatsAppMessage(app, { phone, message })
        const ntCode = await app.db.transaction(async (q) =>
          nextCode(q.query, "notification_logs", "NT-", { minStart: 1000 }),
        )
        await app.db.query(
          "INSERT INTO notification_logs (code, type, customer_id, channel, status, error) VALUES (?, 'reminder', ?, 'WhatsApp', ?, ?)",
          [ntCode, inv.customer_id, result.ok ? "Terkirim" : "Gagal", result.ok ? null : result.error],
        )

        if (result.ok) sent++
        else {
          failed++
          app.log.warn({ customerId: inv.customer_id, error: result.error }, "Gagal kirim reminder WA")
        }

        // Jeda antar-batch: setiap 5 pesan dikirim, beri jeda agar tidak membanjiri gateway pihak ketiga
        if ((idx + 1) % 5 === 0 && idx + 1 < invoices.length) {
          await sleep(1000)
        }
      }

      app.log.info({ type, total: invoices.length, sent, failed }, "Reminder tagihan dikirim")
    } catch (err) {
      app.log.error(err, "Gagal kirim reminder")
    }
  }

  // 4a. Setiap hari 08:05 — reminder tagihan H-7 (setelah job overdue jam 08:00)
  cron.schedule("5 8 * * *", async () => {
    await sendReminderBatch("h7", 7)
  })

  // 4b. Setiap hari 08:10 — reminder tagihan H-3
  cron.schedule("10 8 * * *", async () => {
    await sendReminderBatch("h3", 3)
  })

  // 4c. Setiap hari 08:15 — reminder tagihan H-1
  cron.schedule("15 8 * * *", async () => {
    await sendReminderBatch("h1", 1)
  })
}

/**
 * Antrian sinkronisasi (router_sync_queue) — SELALU aktif.
 * Antrian berisi pelanggan yang pembayaran/aktivasi/isolir-nya belum sempat
 * diterapkan ke Mikrotik karena router offline saat itu. Begitu router online
 * kembali, perubahan profile PPPoE (ISOLIR <-> profile paket) diterapkan otomatis.
 */
function registerSyncQueueJob(app: FastifyInstance) {
  cron.schedule("*/5 * * * *", async () => {
    try {
      const queue = await loadPendingSyncQueue(app, 50)
      if (queue.length === 0) return

      let done = 0
      let failed = 0
      let skipped = 0
      for (const item of queue) {
        // Gunakan router TERKINI pelanggan (bukan router_id saat enqueue) —
        // mencegah antrian macet selamanya di router lama yang offline
        // sedangkan pelanggan sudah pindah/dipindah ke router yang online.
        const routerId = Number(item.current_router_id ?? item.enqueued_router_id)
        // Cek dulu apakah router online — bila masih offline, skip (tetap pending)
        const ping = await withRouter(app, routerId, (client) => client.ping())
        if (!ping.ok) {
          skipped++
          continue
        }

        const customer = {
          id: item.customer_id,
          name: item.customer_name,
          router_id: routerId,
          package_id: item.package_id,
          pppoe_username: item.pppoe_username,
          pppoe_password: item.pppoe_password,
          phone: item.phone,
        }
        const synced = await syncRouterAfterPayment(app, customer, "Transaksi", {
          // Retry dari antrian: jangan kirim notifikasi "server offline" lagi —
          // pesan itu hanya relevan saat transaksi awal terjadi.
          notifyOffline: false,
        })
        if (synced) {
          await markSyncQueueEntry(app, Number(item.id), "done")
          await app.db.query(
            "INSERT INTO activity_logs (actor, action, target) VALUES ('Sistem', 'Sinkronisasi router berhasil (antrian)', ?)",
            [String(item.customer_name ?? item.customer_id)],
          )
          done++
        } else {
          await markSyncQueueEntry(app, Number(item.id), "failed", "Gagal sinkron saat router online")
          failed++
        }
      }
      app.log.info({ total: queue.length, done, failed, skipped }, "Antrian sync router diproses")
    } catch (err) {
      app.log.error(err, "Gagal memproses antrian sync router")
    }
  })
}

/**
 * Monitor status Mikrotik + notifikasi Telegram offline/online — SELALU aktif.
 * Interval dibaca dari konfigurasi Telegram (routerCheckIntervalMinutes,
 * default 5 menit) sehingga bisa diubah dari UI tanpa restart.
 * Implementasi pakai setTimeout berantai (bukan node-cron) agar interval dinamis.
 * Debounce: notif offline hanya dikirim sekali per episode offline
 * (ditandai router.status='Disconnected'), dan notif "online kembali"
 * dikirim saat status pulih.
 */
function registerRouterMonitor(app: FastifyInstance) {
  const monitor = async () => {
    try {
      const cfg = await getTelegramConfig(app)
      const routers = (await app.db.query("SELECT id, name, host, status FROM routers")) as Record<
        string,
        unknown
      >[]
      for (const r of routers) {
        const routerId = Number(r.id)
        const prevStatus = String(r.status ?? "Standby")
        const ping = await withRouter(app, routerId, (client) => client.ping())
        const isOnline = ping.ok

        // Update status di DB (Connected/Disconnected); Standby hanya sebelum pengecekan pertama
        const newStatus = isOnline ? "Connected" : "Disconnected"
        if (newStatus !== prevStatus) {
          await app.db.query("UPDATE routers SET status = ? WHERE id = ?", [newStatus, routerId])
        }

        if (!isOnline && cfg.enabled && cfg.notifyRouterOffline && prevStatus !== "Disconnected") {
          // Baru terdeteksi offline -> kirim notif Telegram (sekali per episode)
          const res = await notifyTelegram(app, {
            type: "routerOffline",
            vars: {
              router: String(r.name ?? routerId),
              host: String(r.host ?? ""),
              tanggal: new Date().toLocaleString("id-ID"),
            },
          })
          if (!res.ok) {
            app.log.warn({ routerId, error: res.error }, "Gagal kirim notif Telegram router offline")
          }
          await app.db.query(
            "INSERT INTO activity_logs (actor, action, target) VALUES ('Sistem', 'Mikrotik offline terdeteksi', ?)",
            [String(r.name ?? routerId)],
          )
        }
        if (isOnline && prevStatus === "Disconnected" && cfg.enabled) {
          // Router pulih -> notif Telegram "online kembali" + proses antrian sync
          const res = await notifyTelegram(app, {
            type: "routerOnline",
            vars: {
              router: String(r.name ?? routerId),
              host: String(r.host ?? ""),
              tanggal: new Date().toLocaleString("id-ID"),
            },
          })
          if (!res.ok) {
            app.log.warn({ routerId, error: res.error }, "Gagal kirim notif Telegram router online")
          }
          await app.db.query(
            "INSERT INTO activity_logs (actor, action, target) VALUES ('Sistem', 'Mikrotik online kembali', ?)",
            [String(r.name ?? routerId)],
          )
          app.log.info({ routerId }, "Router online kembali")
        }
      }
    } catch (err) {
      app.log.error(err, "Gagal monitor status router")
    }
  }

  // Jalankan pengecekan pertama setelah 15 detik, lalu ulang sesuai interval konfigurasi.
  // Interval dibaca ulang setiap eksekusi: jika admin mengubah nilai di UI, pengecekan
  // berikutnya memakai nilai baru tanpa restart (max 10 menit adopsi nilai baru).
  let currentIntervalMs = 0
  let timer: NodeJS.Timeout | null = null
  const scheduleNext = async () => {
    try {
      const cfg = await getTelegramConfig(app)
      currentIntervalMs = Math.max(1, cfg.routerCheckIntervalMinutes) * 60_000
    } catch {
      currentIntervalMs = 5 * 60_000
    }
    timer = setTimeout(async () => {
      await monitor()
      scheduleNext()
    }, currentIntervalMs)
  }
  timer = setTimeout(async () => {
    await monitor()
    scheduleNext()
  }, 15_000)

  // Bersihkan timer saat app ditutup (agar proses bisa exit)
  app.addHook("onClose", async () => {
    if (timer) clearTimeout(timer)
  })
}
