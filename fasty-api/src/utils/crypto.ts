import crypto from "node:crypto"

import { config } from "../config.js"

/**
 * Enkripsi/dekripsi secret (API key, webhook secret, token) sebelum disimpan ke DB.
 * Menggunakan AES-256-GCM dengan key turunan dari ENCRYPTION_KEY (SHA-256).
 */

function getKey(): Buffer {
  return crypto.createHash("sha256").update(config.encryptionKey).digest()
}

export function encryptSecret(plain: string): string {
  if (!plain) return ""
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`
}

export function decryptSecret(stored: string): string {
  if (!stored) return ""
  if (!stored.startsWith("enc:v1:")) return stored // plaintext lama / placeholder
  const [, , ivB64, tagB64, dataB64] = stored.split(":")
  const iv = Buffer.from(ivB64, "base64")
  const tag = Buffer.from(tagB64, "base64")
  const data = Buffer.from(dataB64, "base64")
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")
}

/** Mask secret utk respons GET — tampilkan prefix + "****" */
export function maskSecret(value: string): string {
  if (!value) return ""
  if (value.length <= 6) return "****"
  return `${value.slice(0, 6)}****`
}
