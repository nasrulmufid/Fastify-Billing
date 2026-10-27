import type { FastifyInstance } from "fastify"

import { config } from "../config.js"
import type { DbQuery } from "../plugins/db.js"
import {
  ATTR,
  CODE,
  buildPacket,
  ipAttr,
  mikrotikVsa,
  sendUdp,
  strAttr,
  verifyResponseAuth,
  MIKROTIK_RATE_LIMIT,
  type RadiusAttr,
} from "../utils/radius-client.js"

/**
 * Integrasi FreeRADIUS: billing (`customers`) menulis ke tabel rad*, FreeRADIUS membaca saat auth.
 * Semua fungsi mengembalikan hasil (tidak throw) agar operasi DB tetap berjalan bila RADIUS gagal.
 */

export const ISOLIR_GROUP = "ISOLIR"

export interface RadiusResult {
  ok: boolean
  error?: string
}

type Q = DbQuery["query"]

/** Ganti semua atribut username di radcheck dengan Cleartext-Password terbaru. */
export async function upsertCheck(q: Q, username: string, password: string): Promise<void> {
  await q(`DELETE FROM radcheck WHERE username = ? AND attribute = 'Cleartext-Password'`, [username])
  await q(`INSERT INTO radcheck (username, attribute, op, value) VALUES (?, 'Cleartext-Password', ':=', ?)`, [
    username,
    password,
  ])
}

/** Set Framed-IP-Address di radreply (kosong = hapus). */
export async function upsertReplyIp(q: Q, username: string, ip: string | null): Promise<void> {
  await q(`DELETE FROM radreply WHERE username = ? AND attribute = 'Framed-IP-Address'`, [username])
  if (ip) {
    await q(`INSERT INTO radreply (username, attribute, op, value) VALUES (?, 'Framed-IP-Address', ':=', ?)`, [
      username,
      ip,
    ])
  }
}

/** Tetapkan grup pengguna (grup = profile_name paket, atau ISOLIR). */
export async function setUserGroup(q: Q, username: string, groupname: string): Promise<void> {
  await q(`DELETE FROM radusergroup WHERE username = ?`, [username])
  await q(`INSERT INTO radusergroup (username, groupname, priority) VALUES (?, ?, 1)`, [username, groupname])
}

/** Upsert rate-limit grup paket di radgroupreply. */
export async function syncPackageGroup(
  q: Q,
  profileName: string,
  downloadMbps: number,
  uploadMbps: number,
): Promise<void> {
  await q(`DELETE FROM radgroupreply WHERE groupname = ? AND attribute = 'Mikrotik-Rate-Limit'`, [profileName])
  await q(
    `INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES (?, 'Mikrotik-Rate-Limit', ':=', ?)`,
    [profileName, `${downloadMbps}M/${uploadMbps}M`],
  )
}

/** Grup ISOLIR: rate-limit 0 dan (opsional) pool isolir sebagai Framed-Pool. */
export async function ensureIsolirGroup(q: Q): Promise<void> {
  await q(`DELETE FROM radgroupreply WHERE groupname = ?`, [ISOLIR_GROUP])
  await q(`INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES (?, 'Mikrotik-Rate-Limit', ':=', '0M/0M')`, [
    ISOLIR_GROUP,
  ])
}

/**
 * Sinkron satu pelanggan ke RADIUS. Grup ditentukan dari status:
 * Active -> profile_name paket; Isolated -> ISOLIR.
 */
export async function syncCustomer(
  q: Q,
  c: {
    pppoe_username: string
    pppoe_password: string
    ip_address: string | null
    status: string
    profile_name: string | null
    package_code: string | null
  },
): Promise<RadiusResult> {
  if (!c.pppoe_username) return { ok: false, error: "Username PPPoE kosong" }
  const group =
    c.status === "Active" ? c.profile_name || (c.package_code ? `PKG-${c.package_code}` : ISOLIR_GROUP) : ISOLIR_GROUP
  await upsertCheck(q, c.pppoe_username, c.pppoe_password ?? "")
  await upsertReplyIp(q, c.pppoe_username, c.ip_address && group !== ISOLIR_GROUP ? c.ip_address : null)
  await setUserGroup(q, c.pppoe_username, group)
  return { ok: true }
}

/** Hapus pengguna dari semua tabel RADIUS (dipanggil saat pelanggan dihapus). */
export async function deleteUser(q: Q, username: string): Promise<void> {
  for (const table of ["radcheck", "radreply", "radusergroup"]) {
    await q(`DELETE FROM ${table} WHERE username = ?`, [username])
  }
}

/** Ambil daftar pelanggan satu router beserta data paket, untuk sinkron massal. */
export async function loadRouterCustomers(app: FastifyInstance, routerId: number) {
  return (await app.db.query(
    `SELECT c.id, c.pppoe_username, c.pppoe_password, c.ip_address, c.status,
            p.profile_name, p.code AS package_code, p.download_speed, p.upload_speed, p.name AS package_name
     FROM customers c LEFT JOIN packages p ON p.id = c.package_id
     WHERE c.router_id = ? AND c.pppoe_username IS NOT NULL AND c.pppoe_username <> ''`,
    [routerId],
  )) as Record<string, unknown>[]
}

/** Apakah router memakai FreeRADIUS sebagai sumber autentikasi. */
export async function isRadiusRouter(app: FastifyInstance, routerId: number | null | undefined): Promise<boolean> {
  if (!routerId) return false
  const [row] = (await app.db.query("SELECT radius_enabled FROM routers WHERE id = ?", [routerId])) as Record<
    string,
    unknown
  >[]
  return Number(row?.radius_enabled ?? 0) === 1
}

/** Sinkron semua pelanggan router ke RADIUS (backfill saat RADIUS diaktifkan). */
export async function backfillRouter(app: FastifyInstance, routerId: number): Promise<RadiusResult & { synced: number }> {
  const rows = await loadRouterCustomers(app, routerId)
  let synced = 0
  await app.db.transaction(async (q) => {
    await ensureIsolirGroup(q.query)
    for (const r of rows) {
      const res = await syncCustomer(q.query, {
        pppoe_username: String(r.pppoe_username),
        pppoe_password: String(r.pppoe_password ?? ""),
        ip_address: r.ip_address ? String(r.ip_address) : null,
        status: String(r.status),
        profile_name: r.profile_name ? String(r.profile_name) : null,
        package_code: r.package_code ? String(r.package_code) : null,
      })
      if (res.ok) synced++
    }
  })
  return { ok: true, synced }
}

/** Sinkron grup paket ke RADIUS untuk daftar paket PPPoE aktif. */
export async function syncAllPackageGroups(app: FastifyInstance): Promise<RadiusResult & { synced: number }> {
  const pkgs = (await app.db.query(
    `SELECT code, name, profile_name, download_speed, upload_speed FROM packages
     WHERE type = 'PPPoE' AND status = 'Aktif'`,
  )) as Record<string, unknown>[]
  await app.db.transaction(async (q) => {
    await ensureIsolirGroup(q.query)
    for (const p of pkgs) {
      const group = String(p.profile_name || `PKG-${p.code}`)
      await syncPackageGroup(q.query, group, Number(p.download_speed), Number(p.upload_speed))
    }
  })
  return { ok: true, synced: pkgs.length }
}

/** Sinkron satu pelanggan dalam transaksi terpisah; kegagalan dikembalikan sebagai hasil. */
export async function syncCustomerById(app: FastifyInstance, customerId: number): Promise<RadiusResult> {
  const [row] = (await app.db.query(
    `SELECT c.pppoe_username, c.pppoe_password, c.ip_address, c.status, p.profile_name, p.code AS package_code
     FROM customers c LEFT JOIN packages p ON p.id = c.package_id WHERE c.id = ?`,
    [customerId],
  )) as Record<string, unknown>[]
  if (!row?.pppoe_username) return { ok: false, error: "Pelanggan tanpa username PPPoE" }
  try {
    return await app.db.transaction((q) =>
      syncCustomer(q.query, {
        pppoe_username: String(row.pppoe_username),
        pppoe_password: String(row.pppoe_password ?? ""),
        ip_address: row.ip_address ? String(row.ip_address) : null,
        status: String(row.status),
        profile_name: row.profile_name ? String(row.profile_name) : null,
        package_code: row.package_code ? String(row.package_code) : null,
      }),
    )
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

/** Kirim Disconnect-Request (RFC 5176) ke NAS untuk memutus sesi aktif. */
export async function sendDisconnect(
  nas: { ip: string; secret: string; coaPort: number },
  attrs: { username: string; sessionId?: string; nasIp?: string },
): Promise<RadiusResult> {
  const list: RadiusAttr[] = [strAttr(ATTR.UserName, attrs.username)]
  if (attrs.sessionId) list.push(strAttr(ATTR.AcctSessionId, attrs.sessionId))
  if (attrs.nasIp) list.push(ipAttr(ATTR.NasIpAddress, attrs.nasIp))
  return sendCoaPacket(nas, CODE.DisconnectRequest, list)
}

/** Kirim CoA-Request untuk mengubah rate-limit sesi aktif tanpa memutusnya. */
export async function sendCoa(
  nas: { ip: string; secret: string; coaPort: number },
  attrs: { username: string; rateLimit: string; sessionId?: string },
): Promise<RadiusResult> {
  const list: RadiusAttr[] = [strAttr(ATTR.UserName, attrs.username), mikrotikVsa(MIKROTIK_RATE_LIMIT, attrs.rateLimit)]
  if (attrs.sessionId) list.push(strAttr(ATTR.AcctSessionId, attrs.sessionId))
  return sendCoaPacket(nas, CODE.CoARequest, list)
}

async function sendCoaPacket(
  nas: { ip: string; secret: string; coaPort: number },
  code: number,
  attrs: RadiusAttr[],
): Promise<RadiusResult> {
  const id = Math.floor(Math.random() * 256)
  const { packet, authenticator } = buildPacket(code, id, attrs, nas.secret)
  const res = await sendUdp(nas.ip, nas.coaPort || config.radius.coaPort, packet)
  if (!res.ok || !res.reply) return { ok: false, error: res.error ?? "Tidak ada balasan" }
  const ackCode = code === CODE.DisconnectRequest ? CODE.DisconnectACK : CODE.CoAACK
  if (res.code !== ackCode) return { ok: false, error: `NAS menolak (code ${res.code})` }
  if (!verifyResponseAuth(res.reply, authenticator, nas.secret)) {
    return { ok: false, error: "Response authenticator tidak valid" }
  }
  return { ok: true }
}
