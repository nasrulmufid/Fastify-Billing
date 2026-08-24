/**
 * Smoke test Fase 2 — transaksi invoice/payment & webhook SumoPod.
 * Server harus berjalan di :3000. Jalankan: npx tsx src/scripts/smoke2.ts
 */
import crypto from "node:crypto"

import { config } from "../config.js"

const BASE = "http://localhost:3000/api"

async function req(path: string, options: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers ?? {}) }
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? (typeof options.body === "string" ? options.body : JSON.stringify(options.body)) : undefined,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

function check(name: string, cond: boolean, extra = "") {
  console.log(`${cond ? "✔" : "✘"} ${name}${extra ? ` — ${extra}` : ""}`)
  if (!cond) process.exitCode = 1
}

/** Hitung signature Svix utk body mentah (persis dokumentasi SumoPod) */
function svixSignature(secret: string, svixId: string, ts: string, rawBody: string): string {
  const secretBytes = Buffer.from(secret.replace("whsec_", ""), "base64")
  const signed = `${svixId}.${ts}.${rawBody}`
  const sig = crypto.createHmac("sha256", secretBytes).update(signed).digest("base64")
  return `v1,${sig}`
}

async function main() {
  const login = await req("/auth/login", { method: "POST", body: { email: "admin@rtrw.net", password: "admin123" } })
  const token = login.json.data?.token
  check("login", !!token)
  if (!token) return

  // 1. list invoices
  const invs = await req("/invoices", { token })
  check("list invoices", invs.status === 200 && invs.json.data?.length >= 10, `count=${invs.json.data?.length}`)
  const unpaid = invs.json.data?.find((i: any) => i.status === "Unpaid")
  check("ada invoice Unpaid", !!unpaid, unpaid?.code)
  const invId = unpaid?.id
  const beforeExpiry = (await req(`/customers/${unpaid?.customer_id ?? 1}`, { token })).json.data?.expiryDate

  // 2. mark-paid Tunai (transaksi: PY baru + Paid + extend)
  const mp = await req(`/invoices/${invId}/mark-paid`, { method: "POST", token, body: { method: "Tunai" } })
  const mpData = mp.json.data
  check("mark-paid 200 + payment Sukses", mp.status === 200 && mpData?.payment?.status === "Sukses", `payment=${mpData?.payment?.code}`)
  const invAfter = await req(`/invoices/${invId}`, { token })
  check("invoice jadi Paid + metode Tunai", invAfter.json.data?.status === "Paid" && invAfter.json.data?.paymentMethod === "Tunai", `method=${invAfter.json.data?.paymentMethod} code=${invAfter.json.data?.paymentCode}`)

  // 3. mark-paid duplikat -> 422
  const dup = await req(`/invoices/${invId}/mark-paid`, { method: "POST", token, body: { method: "Tunai" } })
  check("mark-paid duplikat -> 422", dup.status === 422, `status=${dup.status}`)

  // 4. approval queue
  const approval = await req("/payments/approval", { token })
  const pendings = approval.json.data ?? []
  check("approval queue ada Pending", approval.status === 200 && pendings.length >= 2, `count=${pendings.length}`)

  // 5. approve Pending (transaksi: Sukses + extend + invoice Paid)
  const target = pendings[0]
  const custBefore = (await req(`/customers/${target.customerId ?? 1}`, { token })).json.data
  const appr = await req(`/payments/${target.id}/approve`, { method: "POST", token, body: {} })
  check("approve -> Sukses", appr.status === 200 && appr.json.data?.payment?.status === "Sukses", `code=${appr.json.data?.payment?.code}`)
  const custAfter = (await req(`/customers/${target.customerId ?? 1}`, { token })).json.data
  check("approve extend expiry", custAfter?.expiryDate !== custBefore?.expiryDate, `${custBefore?.expiryDate} -> ${custAfter?.expiryDate}`)

  // 6. reject
  const p2 = pendings[1]
  const rej = await req(`/payments/${p2.id}/reject`, { method: "POST", token, body: { statusNote: "Ditolak oleh admin" } })
  check("reject -> Ditolak", rej.status === 200 && rej.json.data?.status === "Ditolak", `note=${rej.json.data?.statusNote}`)

  // 7. payment-gateway config (encrypt + masked)
  const cfgPut = await req("/payment-gateway/config", { method: "PUT", token, body: { apiKey: "sumo_test123", webhookSigningSecret: "whsec_abc123", webhookToken: "whtok_xyz789" } })
  check("config PUT", cfgPut.status === 200, `status=${cfgPut.status}`)
  const cfgGet = await req("/payment-gateway/config", { token })
  const cfg = cfgGet.json.data
  check("config GET masked + isConfigured", cfg?.isConfigured === true && /^sumo_/.test(cfg?.apiKey ?? "") && cfg?.apiKey?.includes("****"), `apiKey=${cfg?.apiKey}`)

  // 8. webhook — signature salah -> 401
  const badHook = await req("/webhook/payment", {
    method: "POST",
    headers: { "svix-id": "msg_1", "svix-timestamp": "1700000000", "svix-signature": "v1,invalid" },
    body: JSON.stringify({ event_type: "payment.test", data: {} }),
  })
  check("webhook signature salah -> 401", badHook.status === 401, `status=${badHook.status}`)

  // 9. webhook — payment.completed valid (pakai secret dari .env)
  const secret = config.sumopod.webhookSecret
  const rawBody = JSON.stringify({
    event_type: "payment.completed",
    data: { payment_id: "pay_1003", order_id: "INV-1040", amount: 350000, fee: 1750, net_amount: 348250, status: "completed", payment_method: "qris" },
  })
  const svixId = "msg_valid"
  const ts = String(Math.floor(Date.now() / 1000))
  const hook = await req("/webhook/payment", {
    method: "POST",
    headers: {
      "svix-id": svixId,
      "svix-timestamp": ts,
      "svix-signature": svixSignature(secret, svixId, ts, rawBody),
    },
    body: rawBody,
  })
  check("webhook completed valid -> 200 matched", hook.status === 200 && hook.json.data?.matched === true, JSON.stringify(hook.json.data))

  // 10. verify payment PY-1013 jadi Sukses + invoice INV-1040 Paid
  const payments = await req("/payments?status=Sukses", { token })
  const py1013 = payments.json.data?.find((p: any) => p.code === "PY-1013")
  check("PY-1013 -> Sukses via webhook", !!py1013, `status=${py1013?.status}`)
  const inv1040 = await req("/invoices", { token })
  const i1040 = inv1040.json.data?.find((i: any) => i.code === "INV-1040")
  check("INV-1040 -> Paid via webhook", i1040?.status === "Paid" && i1040?.paymentMethod === "QRIS", `status=${i1040?.status} method=${i1040?.paymentMethod} code=${i1040?.paymentCode}`)

  // 11. webhook idempotent (kirim ulang event yg sama -> tetap 200, tanpa eksekusi ganda)
  const hook2 = await req("/webhook/payment", {
    method: "POST",
    headers: {
      "svix-id": svixId,
      "svix-timestamp": ts,
      "svix-signature": svixSignature(secret, svixId, ts, rawBody),
    },
    body: rawBody,
  })
  check("webhook idempotent -> 200", hook2.status === 200, `status=${hook2.status}`)

  // 12. webhook token alternatif
  const hookToken = await req("/webhook/payment", {
    method: "POST",
    headers: { "x-webhook-token": config.sumopod.webhookToken },
    body: JSON.stringify({ event_type: "payment.test", data: {} }),
  })
  check("webhook token valid -> 200", hookToken.status === 200, `status=${hookToken.status}`)

  console.log("\nSmoke test Fase 2 selesai.")
}

main()
