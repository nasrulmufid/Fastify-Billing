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
  // 1. Anniversary billing — buat invoice menjelang expiry_at masing-masing customer
  //    (bukan serentak tgl 1). due_at = expiry_at (tanggal anniversary customer) agar
  //    konsisten dengan job isolir (yang memakai expiry_at). Interval siklus (1/2/...
  //    bulan) dari app_settings.billing_cycle menentukan rentang generate ke depan.
  cron.schedule("0 0 1 * *", async () => {
    try {
      const [settings] = (await app.db.query(
        "SELECT billing_cycle FROM app_settings WHERE id = 1",
      )) as Record<string, unknown>[]
      const cycle = String(settings?.billing_cycle ?? "Setiap 1 bulan")
      const m = cycle.match(/(\d+)/)
      const months = m ? Math.max(1, Number(m[1])) : 1
      // Generate invoice untuk customer yang jatuh tempo dalam N bulan ke depan
      const lookAheadDays = months * 31

      const customers = (await app.db.query(
        `SELECT * FROM customers
         WHERE status = 'Active' AND expiry_at IS NOT NULL
           AND expiry_at BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL ? DAY)`,
        [lookAheadDays],
      )) as Record<string, unknown>[]

      let created = 0
      for (const c of customers) {
        const [pkg] = (await app.db.query("SELECT * FROM packages WHERE id = ?", [
          c.package_id,
        ])) as Record<string, unknown>[]
        if (!pkg) continue

        // Sudah ada invoice terbuka (Unpaid/Overdue)? Jangan buat duplikat.
        const [open] = (await app.db.query(
          "SELECT id FROM invoices WHERE customer_id = ? AND status IN ('Unpaid','Overdue') LIMIT 1",
          [c.id],
        )) as Record<string, unknown>[]
        if (open) continue

        // due_at = expiry_at customer (anniversary, preserve hari)
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
      app.log.info({ count: created, cycle, months }, "Invoice anniversary dibuat")
    } catch (err) {
      app.log.error(err, "Gagal generate invoice anniversary")
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
          `SELECT c.id AS customer_id, c.name AS customer_name, c.phone, c.router_id, c.pppoe_username, c.pppoe_password
           FROM customers WHERE status = 'Isolated' AND expiry_at < DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY)`,
          [grace],
        )) as Record<string, unknown>[]
        for (const cust of isolated) {
          // Kirim pesan notifikasi isolir via template WA
          const isoTemplate = await getReminderTemplate(app, "isolir")
          const isoVars: Record<string, string> = {
            nama: String(cust.customer_name ?? ""),
            jumlah: "",
            tanggal: "",
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
  async function sendReminderBatch(type: "h7" | "h3" | "h1", intervalDays: number) {
    try {
      const invoices = (await app.db.query(
        `SELECT i.id AS invoice_id, i.code AS invoice_code, i.amount, i.due_at,
                c.id AS customer_id, c.name AS customer_name, c.phone, p.name AS package_name
         FROM invoices i
         JOIN customers c ON c.id = i.customer_id
         LEFT JOIN packages p ON p.id = c.package_id
         WHERE i.status = 'Unpaid' AND i.due_at BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL ? DAY)`,
        [intervalDays],
      )) as Record<string, unknown>[]

      if (invoices.length === 0) {
        app.log.info({ type }, "Tidak ada invoice yang perlu di-reminder")
        return
      }

      const template = await getReminderTemplate(app, type)
      const needsPaymentLink = template.body.includes("{payment_link}")
      let sent = 0
      let failed = 0

      for (let idx = 0; idx < invoices.length; idx++) {
        const inv = invoices[idx]
        const phone = String(inv.phone ?? "")
        const vars: Record<string, string> = {
          nama: String(inv.customer_name ?? ""),
          jumlah: inv.amount == null ? "" : String(inv.amount),
          tanggal: String(inv.due_at ?? ""),
          no_invoice: String(inv.invoice_code ?? ""),
          paket: String(inv.package_name ?? ""),
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
      for (const item of queue) {
        const routerId = Number(item.router_id)
        // Cek dulu apakah router online — bila masih offline, skip (tetap pending)
        const ping = await withRouter(app, routerId, (client) => client.ping())
        if (!ping.ok) continue

        const customer = {
          id: item.customer_id,
          name: item.customer_name,
          router_id: item.router_id,
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
      app.log.info({ total: queue.length, done, failed }, "Antrian sync router diproses")
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
