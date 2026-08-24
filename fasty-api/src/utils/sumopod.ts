import crypto from "node:crypto"

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

/** Buat payment QRIS di SumoPod */
export async function createSumopodPayment(params: CreatePaymentParams): Promise<CreatedPayment> {
  const body = {
    order_id: params.orderId,
    amount: params.amount,
    currency: "IDR",
    expires_in_hours: params.expiresInHours ?? 24,
    payment_method_type_code: "QRIS",
  }
  const res = await fetch(`${config.sumopod.baseUrl}/api/v1/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": params.apiKey,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`SumoPod API error: ${res.status} ${await res.text()}`)
  }
  const data = (await res.json()) as Record<string, unknown>
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
