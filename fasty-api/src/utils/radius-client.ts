import crypto from "node:crypto"
import dgram from "node:dgram"

/**
 * Klien RADIUS minimal (RFC 2865 / 2866 / 5176) berbasis UDP tanpa dependency.
 * Hanya mendukung atribut string/integer/IPv4 yang dibutuhkan billing.
 */

export const CODE = {
  AccessRequest: 1,
  AccessAccept: 2,
  AccessReject: 3,
  AccountingRequest: 4,
  AccountingResponse: 5,
  DisconnectRequest: 40,
  DisconnectACK: 41,
  DisconnectNAK: 42,
  CoARequest: 43,
  CoAACK: 44,
  CoANAK: 45,
} as const

export type RadiusAttr = [type: number, value: Buffer]

/** Atribut RADIUS standar yang dipakai */
export const ATTR = {
  UserName: 1,
  UserPassword: 2,
  NasIpAddress: 4,
  NasPort: 5,
  ServiceType: 6,
  FramedIpAddress: 8,
  ReplyMessage: 18,
  AcctSessionId: 44,
  NasIdentifier: 32,
  NasPortType: 61,
} as const

/** Vendor-Specific MikroTik (vendor 14988) */
export const MIKROTIK_VENDOR = 14988
export const MIKROTIK_RATE_LIMIT = 8

export function strAttr(type: number, value: string): RadiusAttr {
  return [type, Buffer.from(value, "utf8")]
}

export function ipAttr(type: number, ip: string): RadiusAttr {
  const parts = ip.split(".").map((p) => Number(p))
  return [type, Buffer.from(parts)]
}

export function intAttr(type: number, value: number): RadiusAttr {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(value >>> 0)
  return [type, b]
}

/** Vendor-Specific MikroTik-Rate-Limit (string, contoh "10M/10M"). */
export function mikrotikVsa(subType: number, value: string): RadiusAttr {
  const payload = Buffer.from(value, "utf8")
  const sub = Buffer.concat([Buffer.from([subType, payload.length + 2]), payload])
  const vendor = Buffer.alloc(4)
  vendor.writeUInt32BE(MIKROTIK_VENDOR)
  return [26, Buffer.concat([vendor, sub])]
}

function encodeAttrs(attrs: RadiusAttr[]): Buffer {
  const parts: Buffer[] = []
  for (const [type, value] of attrs) {
    if (value.length > 253) throw new Error(`Atribut ${type} terlalu panjang`)
    parts.push(Buffer.from([type, value.length + 2]), value)
  }
  return Buffer.concat(parts)
}

/** Bangun paket RADIUS. Authenticator dihitung sesuai jenis paket. */
export function buildPacket(
  code: number,
  id: number,
  attrs: RadiusAttr[],
  secret: string,
): { packet: Buffer; authenticator: Buffer } {
  const body = encodeAttrs(attrs)
  const header = Buffer.alloc(4)
  header.writeUInt8(code, 0)
  header.writeUInt8(id & 0xff, 1)
  header.writeUInt16BE(20 + body.length, 2)

  // Access-Request: Request Authenticator acak. Lainnya: MD5 atas paket dengan authenticator nol + secret.
  const authenticator =
    code === CODE.AccessRequest
      ? crypto.randomBytes(16)
      : md5(Buffer.concat([header, Buffer.alloc(16), body, Buffer.from(secret)]))
  return { packet: Buffer.concat([header, authenticator, body]), authenticator }
}

function md5(buf: Buffer): Buffer {
  return crypto.createHash("md5").update(buf).digest()
}

/** Enkripsi User-Password (RFC 2865 §5.2). */
export function encryptPassword(password: string, secret: string, requestAuth: Buffer): Buffer {
  const pw = Buffer.from(password, "utf8")
  const padded = Buffer.alloc(Math.max(16, Math.ceil(pw.length / 16) * 16))
  pw.copy(padded)
  const out = Buffer.alloc(padded.length)
  let prev = requestAuth
  for (let i = 0; i < padded.length; i += 16) {
    const b = md5(Buffer.concat([Buffer.from(secret), prev]))
    for (let j = 0; j < 16; j++) out[i + j] = padded[i + j] ^ b[j]
    prev = out.subarray(i, i + 16)
  }
  return out
}

export interface UdpResult {
  ok: boolean
  code?: number
  error?: string
}

/** Kirim paket UDP dan tunggu balasan (timeout). */
export function sendUdp(host: string, port: number, packet: Buffer, timeoutMs = 3000): Promise<UdpResult & { reply?: Buffer }> {
  return new Promise((resolve) => {
    const sock = dgram.createSocket("udp4")
    let done = false
    const finish = (r: UdpResult & { reply?: Buffer }) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try {
        sock.close()
      } catch {
        /* socket sudah tertutup */
      }
      resolve(r)
    }
    const timer = setTimeout(() => finish({ ok: false, error: `Timeout ${timeoutMs}ms ke ${host}:${port}` }), timeoutMs)
    sock.on("message", (msg) => finish({ ok: true, code: msg[0], reply: msg }))
    sock.on("error", (err) => finish({ ok: false, error: err.message }))
    sock.send(packet, port, host, (err) => {
      if (err) finish({ ok: false, error: err.message })
    })
  })
}

/** Validasi Response Authenticator (RFC 2865 §3). */
export function verifyResponseAuth(reply: Buffer, requestAuth: Buffer, secret: string): boolean {
  const expected = md5(Buffer.concat([reply.subarray(0, 4), requestAuth, reply.subarray(20), Buffer.from(secret)]))
  return expected.equals(reply.subarray(4, 20))
}

