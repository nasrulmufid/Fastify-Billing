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

  /** Pastikan profile PPPoE ada (dl{down}-ul{up}); buat bila belum. Return nama profile. */
  async ensurePppProfile(downloadSpeed: number, uploadSpeed: number): Promise<string> {
    const name = `dl${downloadSpeed}-ul${uploadSpeed}`
    const existing = (await this.request<Array<{ name: string }>>(
      "GET",
      `/ppp/profile?name=${encodeURIComponent(name)}`,
    )) as Array<{ name: string }>
    if (existing.length > 0) return name
    await this.createResource("ppp/profile", {
      name,
      "rate-limit": `${downloadSpeed}M/${uploadSpeed}M`,
    })
    return name
  }

  /** Pastikan profile ISOLIR ada; buat bila belum. Return nama profile. */
  async ensureIsolirProfile(): Promise<string> {
    const name = "ISOLIR"
    const existing = (await this.request<Array<{ name: string }>>(
      "GET",
      `/ppp/profile?name=${encodeURIComponent(name)}`,
    )) as Array<{ name: string }>
    if (existing.length > 0) return name
    await this.createResource("ppp/profile", {
      name,
      "rate-limit": "0M/0M", // Isolir = tidak ada bandwidth
    })
    return name
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
   * Ubah profile secret PPPoE ke ISOLIR (dengan ip-pool isolir) atau kembali ke profile normal.
   * Tidak mengubah disabled — hanya mengganti profile dan local-address.
   */
  async changePppProfile(opts: {
    name: string
    password: string
    profile: string
    ipPool?: string
  }): Promise<void> {
    const id = await this.findSecretId(opts.name)
    const payload: Record<string, unknown> = {
      name: opts.name,
      password: opts.password,
      service: "ppp",
      profile: opts.profile,
      disabled: false,
    }
    // Bila ada ip_pool_isolir, tambahkan remote-address untuk membatasi IP pelanggan isolir
    if (opts.ipPool) payload["remote-address"] = opts.ipPool
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
  packages: Array<{ downloadSpeed: number; uploadSpeed: number }>,
): Promise<RouterResult<number>> {
  return withRouter(app, routerId, async (client) => {
    let synced = 0
    for (const p of packages) {
      await client.ensurePppProfile(p.downloadSpeed, p.uploadSpeed)
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
      "INSERT INTO notification_logs (code, type, customer_id, channel, status, error) VALUES (?, 'router', ?, 'Sistem', 'Gagal', ?)",
      [ntCode, opts.customerId ?? null, opts.warning.message],
    )
    await app.db.query("INSERT INTO activity_logs (actor, action, target) VALUES ('Sistem', 'Gagal sinkron Mikrotik', ?)", [
      target,
    ])
  } catch (err) {
    app.log.error(err, "Gagal mencatat warning router")
  }
}
