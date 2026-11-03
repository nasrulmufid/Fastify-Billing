import crypto from "node:crypto"
import https from "node:https"

import { config } from "../config.js"

/**
 * Integrasi SumoPod payment gateway (QRIS).
 * - createPayment: buat payment link via api-pay.sumopod.com
 * - verifyWebhookSignature: verifikasi Svix (HMAC-SHA256, raw body)
 * - verifyWebhookToken: verifikasi header X-Webhook-Token
 */

export interface CreatePaymentParams {
  orderId: string
  amount: number
  expiresInHours?: number
  apiKey: string
}

export interface CreatedPayment {
  paymentId: string
  orderId: string
  amount: number
  fee: number
  netAmount: number
  paymentLinkUrl: string
  status: string
  expiresAt: string | null
}

/** Endpoint Managed Payment SumoPod sesuai API: POST /api/v1/payments. */
export function sumopodPaymentsUrl(): string {
  return `${config.sumopod.baseUrl.replace(/\/$/, "")}/api/v1/payments`
}

export async function requestSumopod(
  url: string,
  apiKey: string,
  body = "",
  method: "GET" | "POST" = "POST",
): Promise<{ status: number; body: string }> {
  const target = new URL(url)
  return new Promise((resolve, reject) => {
    const req = https.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      method,
      family: 4,
      timeout: 15000,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "X-Api-Key": apiKey,
      },
    }, (res) => {
      const chunks: Buffer[] = []
      res.on("data", (chunk: Buffer) => chunks.push(chunk))
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }))
    })
    req.on("timeout", () => req.destroy(new Error("SumoPod request timeout")))
    req.on("error", reject)
    req.end(body)
  }).catch((err) => {
    throw new Error(`SumoPod tidak dapat dihubungi di ${url}: ${err instanceof Error ? err.message : String(err)}`)
  })
}

/** Buat payment QRIS di SumoPod */
export async function createSumopodPayment(params: CreatePaymentParams): Promise<CreatedPayment> {
  const body = {
    order_id: params.orderId,
    amount: params.amount,
    currency: "IDR",
    expires_in_hours: params.expiresInHours ?? 24,
    payment_method_type_code: "QRIS",
  }
  const raw = await requestSumopod(sumopodPaymentsUrl(), params.apiKey, JSON.stringify(body))
  if (raw.status < 200 || raw.status >= 300) {
    throw new Error(`SumoPod API error: ${raw.status} ${raw.body}`)
  }
  const data = JSON.parse(raw.body) as Record<string, unknown>
  return {
    paymentId: String(data.payment_id ?? ""),
    orderId: String(data.order_id ?? ""),
    amount: Number(data.amount ?? 0),
    fee: Number(data.fee ?? 0),
    netAmount: Number(data.net_amount ?? 0),
    paymentLinkUrl: String(data.payment_link_url ?? ""),
    status: String(data.status ?? "pending"),
    expiresAt: data.expires_at ? String(data.expires_at) : null,
  }
}

/**
 * Verifikasi signature Svix — PERSIS contoh dokumentasi SumoPod.
 * Secret: base64Decode(secret.replace("whsec_", "")).
 * signedContent = `${svixId}.${svixTimestamp}.${rawBody}`.
 * svix-signature bisa berisi banyak nilai "v1,<sig> v1,<sig2>" (rotasi secret ±24 jam).
 */
export function verifyWebhookSignature(
  secret: string,
  svixId: string | undefined,
  svixTimestamp: string | undefined,
  svixSignature: string | undefined,
  rawBody: string,
): boolean {
  if (!svixId || !svixTimestamp || !svixSignature || !secret) return false
  const secretBytes = Buffer.from(secret.replace("whsec_", ""), "base64")
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64")
  const signatures = svixSignature.split(" ").map((s) => s.split(",")[1])
  return signatures.includes(expected)
}

/** Verifikasi webhook token sederhana — bandingkan header X-Webhook-Token */
export function verifyWebhookToken(token: string | undefined, expected: string | undefined): boolean {
  if (!token || !expected) return false
  return token === expected
}
