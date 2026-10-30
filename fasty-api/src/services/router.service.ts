import type { FastifyInstance } from "fastify"

import { decryptSecret } from "../utils/crypto.js"

/**
 * Integrasi Mikrotik via REST API (/rest/...).
 *
 * Prinsip: DB adalah source of truth. Interaksi ke router adalah side-effect.
 * Bila router offline/gagal, pemanggil TETAP melanjutkan operasi DB dan menerima
 * `warning` (lihat `withRouter`) — tidak pernah melempar error fatal ke request.
 */

const REQUEST_TIMEOUT_MS = 5000

/** Error spesifik saat komunikasi ke Mikrotik gagal (offline, timeout, auth, 5xx). */
export class MikrotikError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MikrotikError"
  }
}

export interface RouterCredentials {
  id: number
  name: string
  host: string
  apiPort: number
  apiUseHttps: boolean
  apiUser: string
  apiPassword: string
}

export interface RouterWarning {
  code: "MIKROTIK_OFFLINE"
  message: string
}

/** Hasil aman dari interaksi router — ok=true bila berhasil, ok=false bila warning. */
export type RouterResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; warning: RouterWarning }

/** Baca & dekripsi kredensial router dari DB. Throw bila router tidak ditemukan. */
export async function getRouterCredentials(
  app: FastifyInstance,
  routerId: number | null | undefined,
): Promise<RouterCredentials> {
  if (!routerId) throw new MikrotikError("Pelanggan tidak memiliki router terassigned")
  const [row] = (await app.db.query("SELECT * FROM routers WHERE id = ? LIMIT 1", [
    routerId,
  ])) as Record<string, unknown>[]
  if (!row) throw new MikrotikError(`Router #${routerId} tidak ditemukan`)
  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    host: String(row.host ?? ""),
    apiPort: Number(row.api_port ?? 80),
    apiUseHttps: Number(row.api_use_https ?? 0) === 1,
    apiUser: String(row.api_user ?? "admin"),
    apiPassword: decryptSecret(String(row.api_password ?? "")),
  }
}

/** Client tipis untuk REST API Mikrotik. */
class MikrotikClient {
  private readonly base: string
  private readonly auth: string

  constructor(private readonly creds: RouterCredentials) {
    // Host bisa berupa "ip" atau "ip:port". Bila host sudah mengandung port
    // (data lama/seed), hormati port tsb; jika tidak, gunakan apiPort
    // (default REST Mikrotik = 80 HTTP / 443 HTTPS, BUKAN 8728).
    const scheme = creds.apiUseHttps ? "https" : "http"
    const hostOnly = /:\d+$/.test(creds.host) ? creds.host : `${creds.host}:${creds.apiPort}`
    this.base = `${scheme}://${hostOnly}/rest`
    this.auth = Buffer.from(`${creds.apiUser}:${creds.apiPassword}`).toString("base64")
  }

  private async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    try {
      const res = await fetch(`${this.base}${path}`, {
        method,
        headers: {
          Authorization: `Basic ${this.auth}`,
          "Content-Type": "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        // AbortSignal baru per-request — jangan share satu AbortController
        // antar request (sekali abort, semua request berikutnya langsung gagal).
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        const hint =
          res.status === 401
            ? " — kredensial salah atau user tidak punya hak akses REST (butuh grup full/read)"
            : res.status === 404
              ? " — REST API tidak aktif di port ini (cek /ip service www di router)"
              : ""
        throw new MikrotikError(`Mikrotik ${method} ${this.base}${path} -> HTTP ${res.status}${hint} ${text.slice(0, 200)}`)
      }
      // Mikrotik mengembalikan "" untuk beberapa operasi sukses
      const txt = await res.text()
      return (txt ? JSON.parse(txt) : {}) as T
    } catch (err) {
      if (err instanceof MikrotikError) throw err
      if (err instanceof Error && err.name === "AbortError") {
        throw new MikrotikError(
          `Timeout (${REQUEST_TIMEOUT_MS}ms) menghubungi ${this.base} — periksa alamat/port/firewall`, 
        )
      }
      throw new MikrotikError(`Gagal menghubungi ${this.base}: ${(err as Error).message}`)
    }
  }

  /** Cek koneksi — panggil endpoint identity. */
  async ping(): Promise<boolean> {
    await this.request("GET", "/system/identity")
    return true
  }

  /**
   * Buat item baru di resource. Mikrotik RouterOS 7 memakai POST /{resource},
   * sedangkan RouterOS 6.x / emulator memakai POST /{resource}/add.
   * Coba POST biasa dulu, fallback ke /add bila router menolak (400 no such command).
   */
  private async createResource(resource: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.request("POST", `/${resource}`, payload)
    } catch (err) {
      if (err instanceof MikrotikError && /no such command/i.test(err.message)) {
        await this.request("POST", `/${resource}/add`, payload)
        return
      }
      throw err
    }
  }

  /**
   * Update item by id. RouterOS 7 mendukung PUT /{resource}/{id},
   * RouterOS 6.x / emulator memakai POST /{resource}/set dengan field ".id".
   */
  private async updateResource(resource: string, id: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.request("PUT", `/${resource}/${id}`, payload)
    } catch (err) {
      if (err instanceof MikrotikError && /no such command|not found/i.test(err.message)) {
        await this.request("POST", `/${resource}/set`, { ".id": id, ...payload })
        return
      }
      throw err
    }
  }

  /**
   * Pastikan profile PPPoE ada di Mikrotik.
   * Nama profile = nama paket (misal "Paket 10 Mbps"), rate-limit = kecepatan paket.
   */
  async ensurePppProfile(opts: { name: string; downloadSpeed: number; uploadSpeed: number }): Promise<string> {
    const name = opts.name
    const existing = (await this.request<Array<{ name: string }>>(
      "GET",
      `/ppp/profile?name=${encodeURIComponent(name)}`,
    )) as Array<{ name: string }>
    if (existing.length > 0) return name
    await this.createResource("ppp/profile", {
      name,
      "rate-limit": `${opts.downloadSpeed}M/${opts.uploadSpeed}M`,
    })
    return name
  }

  /**
   * Pastikan profile PPPoE ada di Mikrotik (backward-compat: pakai nama paket).
   * Return nama profile.
   */
  async ensurePppProfileByName(name: string, downloadSpeed: number, uploadSpeed: number): Promise<string> {
    return this.ensurePppProfile({ name, downloadSpeed, uploadSpeed })
  }

  /** Pastikan profile ISOLIR ada; buat bila belum. Return nama profile. */
  async ensureIsolirProfile(): Promise<string> {
    const name = "ISOLIR"
    
    // Cek apakah profile sudah ada
    const existing = (await this.request<Array<{ name: string }>>(
      "GET",
      `/ppp/profile?name=${encodeURIComponent(name)}`,
    )) as Array<{ name: string }>
    
    if (existing.length > 0) {
      return name
    }
    
    // Profile belum ada, coba buat
    try {
      await this.createResource("ppp/profile", {
        name,
        "rate-limit": "0M/0M", // Isolir = tidak ada bandwidth
      })
      
      // Verifikasi bahwa profile sudah dibuat
      const verified = (await this.request<Array<{ name: string }>>(
        "GET",
        `/ppp/profile?name=${encodeURIComponent(name)}`,
      )) as Array<{ name: string }>
      
      if (verified.length > 0) {
        return name
      }
      
      // Jika verifikasi gagal, throw error
      throw new MikrotikError(`Profile ISOLIR berhasil dibuat tapi verifikasi gagal`)
    } catch (err) {
      // Throw error agar bisa ditangani oleh caller (withRouter)
      console.error(`[Mikrotik] Gagal membuat profile ISOLIR di ${this.base}:`, (err as Error).message)
      throw new MikrotikError(`Gagal membuat profile ISOLIR: ${(err as Error).message}`)
    }
  }

  /** Cari secret berdasarkan name. Return id bila ada, null bila tidak. */
  private async findSecretId(name: string): Promise<string | null> {
    const rows = (await this.request<Array<{ ".id": string }>>(
      "GET",
      `/ppp/secret?name=${encodeURIComponent(name)}`,
    )) as Array<{ ".id": string }>
    return rows[0]?.[".id"] ?? null
  }

  /** Buat/perbarui secret PPPoE. Bila sudah ada, update (profile + disabled). */
  async ensurePppSecret(opts: {
    name: string
    password: string
    profile?: string
    disabled: boolean
    localAddress?: string
  }): Promise<void> {
    const id = await this.findSecretId(opts.name)
    const payload: Record<string, unknown> = {
      name: opts.name,
      password: opts.password,
      // Service HARUS "ppp" (bukan "any") agar hanya koneksi PPPoE yang diizinkan.
      service: "ppp",
      disabled: opts.disabled,
    }
    if (opts.profile) payload.profile = opts.profile
    // local-address = IP lokal pelanggan pada secret PPP (satu IP per pelanggan).
    if (opts.localAddress) payload["local-address"] = opts.localAddress
    if (id) {
      await this.updateResource("ppp/secret", id, payload)
    } else {
      await this.createResource("ppp/secret", payload)
    }
  }

  /** Set status disabled secret (true=isolir, false=aktif). */
  async setSecretDisabled(name: string, disabled: boolean): Promise<void> {
    const id = await this.findSecretId(name)
    if (!id) {
      // Secret belum ada — anggap sudah "aman" (tidak ada yg bisa di-disable).
      // Buat saja dalam keadaan disabled agar konsisten dengan status Isolated.
      if (disabled) return
      throw new MikrotikError(`Secret ${name} tidak ditemukan di router`)
    }
    await this.updateResource("ppp/secret", id, { disabled })
  }

  /**
   * Ubah profile secret PPPoE ke ISOLIR (dengan remote-address dari pool isolir)
   * atau kembali ke profile normal (remote-address dikembalikan ke ip_address DB).
   * Tidak mengubah disabled — hanya mengganti profile dan remote-address.
   *
   * PENTING: `remoteAddress` harus IP TUNGGAL (mis. "172.1.1.10"), BUKAN CIDR
   * ("172.1.1.0/24") — RouterOS menolak CIDR pada remote-address secret dengan
   * HTTP 400 "invalid value for argument remote-address".
   */
  async changePppProfile(opts: {
    name: string
    password: string
    profile: string
    remoteAddress?: string
  }): Promise<void> {
    const id = await this.findSecretId(opts.name)
    const payload: Record<string, unknown> = {
      name: opts.name,
      password: opts.password,
      service: "ppp",
      profile: opts.profile,
      disabled: false,
    }
    if (opts.remoteAddress) payload["remote-address"] = opts.remoteAddress
    if (id) {
      await this.updateResource("ppp/secret", id, payload)
    } else {
      await this.createResource("ppp/secret", payload)
    }
  }

  /** Sinkronisasi semua secret pelanggan dari DB ke router (add bila belum ada). */
  async syncSecrets(
    secrets: Array<{ name: string; password: string; profile?: string; disabled: boolean }>,
  ): Promise<number> {
    let synced = 0
    for (const s of secrets) {
      await this.ensurePppSecret(s)
      synced++
    }
    return synced
  }

  // ========================================================
  // PPPoE Secret — /ppp secret
  // ========================================================
}

/**
 * Ambil IP tunggal yang aman dari string CIDR pool isolir (mis. "172.1.1.0/24"
 * -> "172.1.1.2"; oktet .0/.1 dihindari karena biasanya network/gateway).
 * RouterOS menolak CIDR pada remote-address secret (HTTP 400), jadi isolir
 * selalu memakai IP tunggal hasil helper ini.
 */
export function firstIpFromCidr(cidr: string | undefined | null): string | undefined {
  if (!cidr) return undefined
  const [base, prefixStr] = cidr.trim().split("/")
  const parts = base.split(".").map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return undefined
  const prefix = Number(prefixStr ?? 24)
  if (Number.isNaN(prefix) || prefix < 8 || prefix > 32) return undefined
  // IP pertama yang usable: network address + 2 (lewati network .0 dan gateway .1)
  const lastOctet = Math.min(parts[3] + 2, 254)
  return `${parts[0]}.${parts[1]}.${parts[2]}.${lastOctet}`
}

/**
 * Jalankan interaksi router dengan penanganan error aman.
 * Bila gagal (MikrotikError), kembalikan warning (tidak throw) agar caller
 * tetap bisa menyelesaikan operasi DB.
 */
export async function withRouter<T = unknown>(
  app: FastifyInstance,
  routerId: number | null | undefined,
  fn: (client: MikrotikClient, creds: RouterCredentials) => Promise<T>,
): Promise<RouterResult<T>> {
  try {
    const creds = await getRouterCredentials(app, routerId)
    const client = new MikrotikClient(creds)
    const data = await fn(client, creds)
    return { ok: true, data }
  } catch (err) {
    if (err instanceof MikrotikError) {
      return {
        ok: false,
        warning: { code: "MIKROTIK_OFFLINE", message: err.message },
      }
    }
    return {
      ok: false,
      warning: { code: "MIKROTIK_OFFLINE", message: `Gagal sinkron router: ${(err as Error).message}` },
    }
  }
}

/** Test koneksi nyata ke router. Return status Connected/Disconnected + warning bila gagal. */
export async function testRouterConnection(
  app: FastifyInstance,
  routerId: number,
): Promise<{ status: "Connected" | "Disconnected"; warning?: RouterWarning }> {
  const res = await withRouter(app, routerId, (client) => client.ping())
  if (res.ok) return { status: "Connected" }
  return { status: "Disconnected", warning: res.warning }
}

/** Sinkronisasi profile PPPoE (`dl{down}-ul{up}`) untuk daftar paket ke router.
 *  Buat profile bila belum ada; update bila ada. Return jumlah profile ter-sync. */
export async function syncPackagesToRouter(
  app: FastifyInstance,
  routerId: number,
  packages: Array<{ name: string; downloadSpeed: number; uploadSpeed: number }>,
): Promise<RouterResult<number>> {
  return withRouter(app, routerId, async (client) => {
    let synced = 0
    for (const p of packages) {
      await client.ensurePppProfile({
        name: p.name,
        downloadSpeed: p.downloadSpeed,
        uploadSpeed: p.uploadSpeed,
      })
      synced++
    }
    return synced
  })
}

/**
 * Catat warning router ke notification_logs (type=router, status=Gagal) + activity_logs.
 * Aman dipanggil meski app.db tersedia.
 */
export async function recordRouterWarning(
  app: FastifyInstance,
  opts: { routerId?: number | null; customerId?: number | null; action: string; warning: RouterWarning },
): Promise<void> {
  try {
    const routerName = opts.routerId
      ? ((await app.db.query("SELECT name FROM routers WHERE id = ?", [opts.routerId])) as Record<string, unknown>[])[0]?.name
      : null
    const target = [routerName, opts.action].filter(Boolean).join(" — ")
    const ntCode = await app.db.transaction(async (q) =>
      (await import("../utils/codegen.js")).nextCode(q.query, "notification_logs", "NT-", { minStart: 1000 }),
    )
    await app.db.query(
      "INSERT INTO notification_logs (code, type, customer_id, channel, status, error) VALUES (?, 'router', ?, 'WhatsApp', 'Gagal', ?)",
      [ntCode, opts.customerId ?? null, opts.warning.message],
    )
    await app.db.query("INSERT INTO activity_logs (actor, action, target) VALUES ('Sistem', 'Gagal sinkron Mikrotik', ?)", [
      target,
    ])
  } catch (err) {
    app.log.error(err, "Gagal mencatat warning router")
  }
}

/* ============================================================
   Antrian sinkronisasi ulang saat Mikrotik offline
   ============================================================
   Saat pembayaran/aktivasi terjadi namun router sedang offline,
   perubahan profile PPPoE tidak bisa diterapkan. Entri di tabel
   router_sync_queue menandai pelanggan yang perlu di-sync ulang;
   job berkala (jobs/index.ts) memproses antrian ini begitu router
   kembali online. Tabel dibuat otomatis (idempoten) agar deployment
   lama tanpa migrasi tetap berjalan.
   ============================================================ */

export interface QueueSyncItem {
  routerId: number
  customerId: number
  reason?: string
}

/** Pastikan tabel antrian ada (idempoten — aman dipanggil berulang). */
export async function ensureSyncQueueTable(app: FastifyInstance): Promise<void> {
  await app.db.query(
    `CREATE TABLE IF NOT EXISTS router_sync_queue (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      customer_id BIGINT UNSIGNED NOT NULL,
      router_id BIGINT UNSIGNED NOT NULL,
      reason VARCHAR(200) NULL,
      status ENUM('pending','done','failed') NOT NULL DEFAULT 'pending',
      attempts INT NOT NULL DEFAULT 0,
      last_error TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME NULL,
      INDEX idx_sync_queue_status (status),
      INDEX idx_sync_queue_router (router_id)
    ) ENGINE=InnoDB`,
  )
}

/** Masukkan pelanggan ke antrian sync.
 *  Bila sudah ada entri pending utk customer tsb: perbarui router_id ke nilai
 *  TERKINI (pelanggan bisa saja dipindah router saat entri masih pending —
 *  penyebab antrian macet di router lama yang mati selamanya). */
export async function enqueueRouterSync(
  app: FastifyInstance,
  item: QueueSyncItem,
): Promise<void> {
  try {
    await ensureSyncQueueTable(app)
    const [existing] = (await app.db.query(
      "SELECT id FROM router_sync_queue WHERE customer_id = ? AND status = 'pending' LIMIT 1",
      [item.customerId],
    )) as Record<string, unknown>[]
    if (existing) {
      // Perbarui router_id entri pending agar job memproses di router yang benar
      await app.db.query(
        "UPDATE router_sync_queue SET router_id = ?, reason = COALESCE(?, reason) WHERE id = ?",
        [item.routerId, item.reason ?? null, Number(existing.id)],
      )
      return
    }
    await app.db.query(
      "INSERT INTO router_sync_queue (customer_id, router_id, reason) VALUES (?, ?, ?)",
      [item.customerId, item.routerId, item.reason ?? null],
    )
  } catch (err) {
    app.log.error(err, "Gagal memasukkan antrian sync router")
  }
}

/**
 * Sinkronkan router_id entri pending milik pelanggan bila pelanggan dipindah
 * ke router lain. Dipanggil saat admin mengubah router assignment customer.
 */
export async function updateQueueRouterForCustomer(
  app: FastifyInstance,
  customerId: number,
  newRouterId: number,
): Promise<void> {
  try {
    await ensureSyncQueueTable(app)
    await app.db.query(
      "UPDATE router_sync_queue SET router_id = ? WHERE customer_id = ? AND status = 'pending'",
      [newRouterId, customerId],
    )
  } catch (err) {
    app.log.error(err, "Gagal memperbarui router antrian sync")
  }
}

/**
 * Ambil entri pending dari antrian sync (untuk job berkala).
 * PENTING: router_id yang dipakai job adalah router TERKINI pelanggan
 * (c.router_id AS current_router_id) — bukan router_id yang dibekukan saat
 * enqueue. Mencegah antrian macet selamanya di router lama yang offline
 * sedangkan pelanggan sudah pindah/dipindah ke router yang online.
 */
export async function loadPendingSyncQueue(
  app: FastifyInstance,
  limit = 50,
): Promise<Record<string, unknown>[]> {
  await ensureSyncQueueTable(app)
  return (await app.db.query(
    `SELECT q.id, q.customer_id, q.router_id AS enqueued_router_id,
            COALESCE(c.router_id, q.router_id) AS current_router_id,
            q.reason, q.attempts, c.name AS customer_name,
            c.pppoe_username, c.pppoe_password, c.status, c.package_id, c.phone
     FROM router_sync_queue q
     JOIN customers c ON c.id = q.customer_id
     WHERE q.status = 'pending'
     ORDER BY q.id ASC
     LIMIT ?`,
    [limit],
  )) as Record<string, unknown>[]
}

/** Tandai entri antrian selesai/gagal. */
export async function markSyncQueueEntry(
  app: FastifyInstance,
  id: number,
  status: "done" | "failed",
  error?: string,
): Promise<void> {
  await app.db.query(
    `UPDATE router_sync_queue
     SET status = ?, attempts = attempts + 1, last_error = ?, processed_at = NOW()
     WHERE id = ?`,
    [status, error ?? null, id],
  )
}
