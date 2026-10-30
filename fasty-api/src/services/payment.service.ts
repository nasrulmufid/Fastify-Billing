import type { DbQuery } from "../plugins/db.js"
import type { FastifyInstance } from "fastify"

import { nextCode } from "../utils/codegen.js"
import { addMonthsToExpiry, formatIdDate, fromISODate, toISODate } from "../utils/date.js"
import { enqueueRouterSync, recordRouterWarning, withRouter, type RouterWarning } from "./router.service.js"
import { getOfflineMessage, sendWhatsAppMessage } from "./wa.service.js"
import { notifyTelegram } from "./telegram.service.js"
import { fillPlaceholders } from "../utils/template.js"

/**
 * Selesaikan pembayaran (flow bersama):
 * payment -> Sukses, invoice -> Paid, masa aktif customer +1 bulan & Active,
 * tulis notification_log (type payment) + activity_log.
 *
 * HARUS dipanggil di dalam app.db.transaction(fn) — argumen `q`.
 * Idempotent: jika payment sudah Sukses, tidak dieksekusi ulang.
 *
 * `app` bersifat opsional: bila diberikan, akan mencoba enable secret PPPoE
 * di Mikrotik (bila customer punya router).
 * Kegagalan router dikembalikan sebagai `warning` (tidak membatalkan pembayaran).
 */
export async function completePaymentFlow(
  q: DbQuery,
  paymentId: string | number,
  method: "QRIS" | "Tunai",
  actor: string,
  app?: FastifyInstance,
): Promise<{
  payment: Record<string, unknown>
  invoice: Record<string, unknown> | null
  warning?: RouterWarning
}> {
  const [payment] = (await q.query("SELECT * FROM payments WHERE id = ?", [
    paymentId,
  ])) as Record<string, unknown>[]

  if (!payment) {
    const err = new Error("Pembayaran tidak ditemukan") as Error & { statusCode?: number }
    err.statusCode = 404
    throw err
  }
  if (payment.status === "Sukses") {
    // idempotent — sudah diproses
    return { payment, invoice: null }
  }

  // 1) payment -> Sukses
  await q.query("UPDATE payments SET status = 'Sukses', status_note = ? WHERE id = ?", [null, paymentId])

  // 2) invoice -> Paid
  let invoice: Record<string, unknown> | null = null
  if (payment.invoice_id) {
    await q.query(
      "UPDATE invoices SET status = 'Paid', payment_method = ?, payment_code = ? WHERE id = ?",
      [method, payment.code, payment.invoice_id],
    )
    const [inv] = (await q.query("SELECT * FROM invoices WHERE id = ?", [
      payment.invoice_id,
    ])) as Record<string, unknown>[]
    invoice = inv ?? null
  }

  // 3) masa aktif customer +1 bulan + Active
  // FOR UPDATE: kunci baris agar 2 pembayaran berurutan/bersamaan selalu
  // extend dari expiry terbaru (ter-commit), bukan nilai stale -> +N bulan utk N pembayaran.
  const [customer] = (await q.query("SELECT * FROM customers WHERE id = ? FOR UPDATE", [
    payment.customer_id,
  ])) as Record<string, unknown>[]
  if (customer) {
    const current =
      fromISODate(customer.expiry_at as string | undefined) || formatIdDate(new Date())
    const newExpiry = addMonthsToExpiry(current, 1)
    const iso = toISODate(newExpiry) ?? newExpiry
    await q.query("UPDATE customers SET expiry_at = ?, status = 'Active' WHERE id = ?", [
      iso,
      payment.customer_id,
    ])
  }

  // 4) notification_log (type payment, Terkirim)
  const ntCode = await nextCode(q.query, "notification_logs", "NT-", { minStart: 1000 })
  await q.query(
    "INSERT INTO notification_logs (code, type, customer_id, channel, status) VALUES (?, 'payment', ?, 'WhatsApp', 'Terkirim')",
    [ntCode, payment.customer_id],
  )

  // 5) activity_log
  await q.query("INSERT INTO activity_logs (actor, action, target) VALUES (?, ?, ?)", [
    actor,
    "Pembayaran diterima",
    String(payment.code),
  ])

  // Router adalah side effect; jalankan setelah transaksi selesai agar router
  // offline tidak menahan atau menggagalkan pembayaran.
  if (app && customer?.router_id && customer?.pppoe_username) {
    setImmediate(() => {
      void syncRouterAfterPayment(app, customer, method).catch((err) => {
        app.log.error(err, "Gagal sinkron router setelah pembayaran")
      })
    })
  }

  // Notifikasi Telegram: transaksi sukses — untuk SEMUA metode (QRIS & Tunai).
  // Single source of truth agar tidak dobel: webhook payment.completed TIDAK
  // mengirim Telegram sendiri (juga lewat sini). Fire-and-forget, tidak blokir.
  if (app) {
    setImmediate(() => {
      void (async () => {
        const [pkg] = (await app.db.query("SELECT name FROM packages WHERE id = ?", [
          customer?.package_id ?? null,
        ])) as Record<string, unknown>[]
        await notifyTelegram(app, {
          type: "paymentSuccess",
          vars: {
            customerId: String(payment.customer_id ?? ""),
            nama: String(customer?.name ?? ""),
            paket: String(pkg?.name ?? ""),
            kode: String(payment.code ?? ""),
            jumlah: String(payment.amount ?? ""),
            metode: method,
            tanggal: new Date().toLocaleString("id-ID"),
          },
        })
      })().catch(() => {})
    })
  }

  return { payment: { ...payment, status: "Sukses" }, invoice }
}

export async function syncRouterAfterPayment(
  app: FastifyInstance,
  customer: Record<string, unknown>,
  method: "QRIS" | "Tunai" | "Transaksi" = "Transaksi",
  opts?: { notifyOffline?: boolean },
): Promise<boolean> {
  const [pkg] = (await app.db.query(
    "SELECT name, download_speed, upload_speed FROM packages WHERE id = ?",
    [customer.package_id],
  )) as Record<string, unknown>[]
  if (!pkg?.name || !pkg.download_speed || !pkg.upload_speed) {
    app.log.warn({ customerId: customer.id }, "Profile paket tidak tersedia untuk sinkronisasi router")
    return false
  }

  const res = await withRouter(app, customer.router_id as number, async (client) => {
    const profile = await client.ensurePppProfile({
      name: String(pkg.name),
      downloadSpeed: Number(pkg.download_speed),
      uploadSpeed: Number(pkg.upload_speed),
    })
    await client.changePppProfile({
      name: String(customer.pppoe_username),
      password: String(customer.pppoe_password ?? ""),
      profile,
    })
  })
  if (!res.ok) {
    // Router offline / koneksi terputus — pembayaran SUDAH tercatat di DB (source of truth),
    // jadi transaksi tetap berjalan. Yang dilakukan:
    //   1. Catat warning utk audit (notification_logs + activity_logs).
    //   2. Masukkan ke antrian sync — job berkala akan menerapkan perubahan profile
    //      (ISOLIR -> profile paket) otomatis begitu router online kembali.
    //   3. Kabari pelanggan via WA: pembayaran diterima, server sedang down (mis. PLN off),
    //      internet kembali normal setelah server online. Pesan bisa dicustom di WA Gateway.
    await recordRouterWarning(app, {
      routerId: Number(customer.router_id),
      customerId: Number(customer.id),
      action: `Router offline — pembayaran ${method}`,
      warning: res.warning,
    })
    await enqueueRouterSync(app, {
      routerId: Number(customer.router_id),
      customerId: Number(customer.id),
      reason: `Pembayaran ${method}`,
    })
    if (opts?.notifyOffline !== false) {
      await sendOfflineNotice(app, customer, method)
    }
    // Notifikasi Telegram ke admin: sinkronisasi Mikrotik gagal karena router
    // offline — perubahan profile PPPoE pelanggan ini ditahan di antrian.
    const routerInfo = await getRouterInfo(app, Number(customer.router_id))
    await notifyTelegram(app, {
      type: "routerOffline",
      vars: {
        customerId: String(customer.id ?? ""),
        nama: String(customer.name ?? ""),
        paket: String(pkg?.name ?? ""),
        kode: `Pembayaran ${method}`,
        jumlah: String(paymentAmountOf(customer) ?? ""),
        metode: method,
        tanggal: new Date().toLocaleString("id-ID"),
        router: String(routerInfo.name ?? customer.router_id ?? ""),
        host: String(routerInfo.host ?? ""),
      },
    })
    return false
  }
  return true
}

/** Ambil nama & host router (untuk variabel notifikasi). */
async function getRouterInfo(app: FastifyInstance, routerId: number): Promise<{ name?: string; host?: string }> {
  const [row] = (await app.db.query("SELECT name, host FROM routers WHERE id = ?", [routerId])) as Record<
    string,
    unknown
  >[]
  return { name: row?.name ? String(row.name) : undefined, host: row?.host ? String(row.host) : undefined }
}

function paymentAmountOf(customer: Record<string, unknown>): string {
  return customer.amount != null ? String(customer.amount) : ""
}

/**
 * Kirim pesan "server offline" ke pelanggan via WA Gateway setelah pembayaran
 * sukses tercatat namun Mikrotik sedang tidak bisa dihubungi.
 * Template diambil dari konfigurasi WA Gateway (bisa dicustom admin);
 * bila belum diisi, gunakan pesan default.
 */
export async function sendOfflineNotice(
  app: FastifyInstance,
  customer: Record<string, unknown>,
  method: string,
): Promise<void> {
  try {
    const [pkg] = (await app.db.query("SELECT name, price FROM packages WHERE id = ?", [
      customer.package_id,
    ])) as Record<string, unknown>[]
    const template = await getOfflineMessage(app)
    const vars: Record<string, string> = {
      nama: String(customer.name ?? ""),
      paket: String(pkg?.name ?? ""),
      jumlah: pkg?.price != null ? String(pkg.price) : "",
      tanggal: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
      metode: method,
    }
    const message = fillPlaceholders(template.body, vars)
    const result = await sendWhatsAppMessage(app, {
      phone: String(customer.phone ?? ""),
      message,
    })
    const ntCode = await app.db.transaction(async (q) =>
      nextCode(q.query, "notification_logs", "NT-", { minStart: 1000 }),
    )
    await app.db.query(
      "INSERT INTO notification_logs (code, type, customer_id, channel, status, error) VALUES (?, 'payment', ?, 'WhatsApp', ?, ?)",
      [ntCode, customer.id ?? null, result.ok ? "Terkirim" : "Gagal", result.ok ? null : result.error],
    )
    await app.db.query(
      "INSERT INTO activity_logs (actor, action, target) VALUES ('Sistem', 'Notifikasi server offline dikirim', ?)",
      [String(customer.name ?? customer.id)],
    )
  } catch (err) {
    app.log.error(err, "Gagal mengirim notifikasi offline")
  }
}
