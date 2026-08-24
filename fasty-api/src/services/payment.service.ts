import type { DbQuery } from "../plugins/db.js"
import type { FastifyInstance } from "fastify"

import { nextCode } from "../utils/codegen.js"
import { addMonthsToExpiry, formatIdDate, fromISODate, toISODate } from "../utils/date.js"
import { recordRouterWarning, withRouter, type RouterWarning } from "./router.service.js"

/**
 * Selesaikan pembayaran (flow bersama):
 * payment -> Sukses, invoice -> Paid, masa aktif customer +1 bulan & Active,
 * tulis notification_log (type payment) + activity_log.
 *
 * HARUS dipanggil di dalam app.db.transaction(fn) — argumen `q`.
 * Idempotent: jika payment sudah Sukses, tidak dieksekusi ulang.
 *
 * `app` bersifat opsional: bila diberikan, setelah transaksi commit akan
 * mencoba enable secret PPPoE di Mikrotik (bila customer punya router).
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
  const [customer] = (await q.query("SELECT * FROM customers WHERE id = ?", [
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

  // 6) Sinkron ke Mikrotik: enable secret PPPoE (setelah transaksi DB commit)
  let warning: RouterWarning | undefined
  if (app && customer?.router_id && customer?.pppoe_username) {
    const res = await withRouter(app, customer.router_id as number, async (client) => {
      await client.setSecretDisabled(String(customer.pppoe_username), false)
    })
    if (!res.ok) {
      warning = res.warning
      await recordRouterWarning(app, {
        routerId: Number(customer.router_id),
        customerId: Number(customer.id),
        action: "Pembayaran sukses — enable secret",
        warning: res.warning,
      })
    }
  }

  return { payment: { ...payment, status: "Sukses" }, invoice, warning }
}
