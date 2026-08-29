import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"

import { nextCode, nextCustomerCode } from "../utils/codegen.js"
import { addMonthsToExpiry, formatIdDate, fromISODate, toISODate, toDbDateTime, MONTHS_ID } from "../utils/date.js"
import { recordRouterWarning, withRouter, type RouterWarning } from "../services/router.service.js"
import { completePaymentFlow } from "../services/payment.service.js"
import {
  generateCustomerWorkbook,
  generateTemplateWorkbook,
  parseImportWorkbook,
  executeImport,
} from "../utils/excel.js"

const CUSTOMER_STATUS_ENUM = z.enum(["Active", "Isolated"])

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: CUSTOMER_STATUS_ENUM.optional(),
  packageId: z.coerce.number().optional(),
})

const createCustomerSchema = z.object({
  name: z.string().min(3, "Nama lengkap minimal 3 karakter"),
  phone: z.string().min(8, "Nomor WhatsApp tidak valid"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().min(5, "Alamat wajib diisi"),
  packageId: z.coerce.number().optional().nullable(),
  routerId: z.coerce.number().optional().nullable(),
  ipAddress: z.string().optional(),
  pppoeUsername: z.string().min(3, "Username PPPoE minimal 3 karakter"),
  pppoePassword: z.string().min(6, "Password PPPoE minimal 6 karakter"),
  loginUsername: z.string().min(3, "Username login minimal 3 karakter"),
  loginPassword: z.string().min(6, "Password login minimal 6 karakter"),
  odpId: z.string().optional(),
  gps: z.string().optional(),
})

const updateCustomerSchema = createCustomerSchema.partial()

const expirySchema = z.object({ expiryDate: z.string().min(1, "Tanggal berakhir wajib diisi") })
const extendSchema = z.object({ months: z.coerce.number().int().min(1).max(12).default(1) })
const isolateSchema = z.object({ isolate: z.boolean() })

const SQL_SELECT = `
  SELECT c.*, p.name AS package_name, r.name AS router_name
  FROM customers c
  LEFT JOIN packages p ON p.id = c.package_id
  LEFT JOIN routers r ON r.id = c.router_id
`

/**
 * Hitung IP berikutnya dari pool CIDR (contoh "192.168.200.0/24").
 * Mengambil oktet terakhir tertinggi yang SUDAH dipakai pelanggan di DB,
 * lalu +1. Bila melebihi batas subnet, kembalikan IP .254 (batas aman) — caller
 * tetap menyimpan (DB source of truth), tapi router akan menolak bila bentrok.
 */
async function nextIpFromPool(
  query: (sql: string, params?: unknown[]) => Promise<unknown>,
  cidr: string,
  routerId: number,
): Promise<string> {
  const [base, prefixStr] = cidr.split("/")
  const prefix = Number(prefixStr ?? 24)
  const parts = base.split(".").map(Number)
  if (parts.length !== 4 || Number.isNaN(prefix)) return ""

  // Hitung jumlah host bit & batas oktet terakhir
  const hostBits = 32 - prefix
  const maxHost = Math.pow(2, hostBits) - 2 // tanpa network & broadcast
  const networkLast = parts[3]
  const firstUsable = networkLast + 1
  const lastUsable = networkLast + maxHost

  // Cari oktet terakhir tertinggi yang sudah dipakai di subnet ini
  const rows = (await query(
    `SELECT ip_address FROM customers WHERE router_id = ? AND ip_address LIKE ?`,
    [routerId, `${parts[0]}.${parts[1]}.${parts[2]}.%`],
  )) as Record<string, unknown>[]
  let highest = firstUsable - 1
  for (const r of rows) {
    const ip = String(r.ip_address ?? "")
    const oct = Number(ip.split(".")[3])
    if (ip.startsWith(`${parts[0]}.${parts[1]}.${parts[2]}.`) && !Number.isNaN(oct)) {
      if (oct > highest && oct <= lastUsable) highest = oct
    }
  }
  const next = highest + 1
  if (next > lastUsable) return `${parts[0]}.${parts[1]}.${parts[2]}.254`
  return `${parts[0]}.${parts[1]}.${parts[2]}.${next}`
}

function mapCustomer(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    packageId: row.package_id,
    packageName: row.package_name ?? "",
    routerId: row.router_id,
    router: row.router_name ?? "",
    status: row.status,
    ipAddress: row.ip_address,
    pppoeUsername: row.pppoe_username,
    pppoePassword: row.pppoe_password,
    loginUsername: row.login_username,
    loginPassword: row.login_password,
    odpId: row.odp_id,
    gps: row.gps,
    lastPayment: fromISODate(row.last_payment_at as string | undefined) || null,
    expiryDate: fromISODate(row.expiry_at as string | undefined),
    joinDate: fromISODate(row.join_at as string | undefined),
  }
}

export async function customersRoutes(app: FastifyInstance) {
  const adminAuth = {
    onRequest: [app.authenticate],
    preHandler: [app.requireRoles(["super_admin", "admin"])],
  }
  const techAuth = {
    onRequest: [app.authenticate],
    preHandler: [app.requireRoles(["super_admin", "admin", "teknisi"])],
  }

  // GET /customers
  app.get("/customers", adminAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const q = listQuerySchema.parse(req.query)
    const where: string[] = []
    const params: unknown[] = []

    if (q.search) {
      where.push("(c.name LIKE ? OR c.code LIKE ? OR c.phone LIKE ? OR c.ip_address LIKE ?)")
      const like = `%${q.search}%`
      params.push(like, like, like, like)
    }
    if (q.status) {
      where.push("c.status = ?")
      params.push(q.status)
    }
    if (q.packageId) {
      where.push("c.package_id = ?")
      params.push(q.packageId)
    }

    const clause = where.length ? `WHERE ${where.join(" AND ")}` : ""
    const offset = (q.page - 1) * q.limit

    const [countRow] = (await app.db.query(
      `SELECT COUNT(*) AS total FROM customers c ${clause}`,
      params,
    )) as Record<string, unknown>[]
    const total = Number(countRow?.total ?? 0)

    const rows = (await app.db.query(
      `${SQL_SELECT} ${clause} ORDER BY c.id ASC LIMIT ? OFFSET ?`,
      [...params, q.limit, offset],
    )) as Record<string, unknown>[]

    return reply.send({
      data: rows.map(mapCustomer),
      meta: { page: q.page, limit: q.limit, total },
    })
  })

  // GET /customers/:id
  app.get("/customers/:id", adminAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const [row] = (await app.db.query(`${SQL_SELECT} WHERE c.id = ? LIMIT 1`, [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Pelanggan tidak ditemukan" } })
    }
    return reply.send({ data: mapCustomer(row) })
  })

  // POST /customers
  app.post("/customers", adminAuth, async (req, reply) => {
    const body = createCustomerSchema.parse(req.body)
    // Alokasi IP otomatis: bila IP tidak diisi, ambil IP berikutnya dari pool
    // router (ip_pool CIDR, contoh 192.168.200.0/24). Fallback ke 192.168.1.x
    // bila router tidak punya pool.
    const { nextIp } = await app.db.transaction(async (q) => {
      const code = await nextCustomerCode(q.query)
      let allocated = body.ipAddress || ""
      if (!allocated && body.routerId) {
        const [routerRow] = (await q.query("SELECT ip_pool_pppoe FROM routers WHERE id = ?", [
          body.routerId,
        ])) as Record<string, unknown>[]
        const pool = routerRow?.ip_pool_pppoe ? String(routerRow.ip_pool_pppoe) : ""
        if (pool) {
          allocated = await nextIpFromPool(q.query, pool, Number(body.routerId))
        } else {
          const [maxRow] = (await q.query(
            "SELECT ip_address FROM customers WHERE ip_address LIKE '192.168.1.%' ORDER BY CAST(SUBSTRING_INDEX(ip_address, '.', -1) AS UNSIGNED) DESC LIMIT 1",
          )) as Record<string, unknown>[]
          const lastOctet = Number((maxRow?.ip_address as string | undefined)?.split(".")[3] ?? 1)
          allocated = `192.168.1.${lastOctet + 1}`
        }
      }
      return { code: c, nextIp: allocated }
    })

    const joinAt = new Date()
    // Pelanggan baru: akun AKTIF (bisa login portal & lihat tagihan) tapi layanan ISOLIR
    // (menunggu pembayaran). Setelah pembayaran pertama -> status Active (payment.service).
    // expiry_at diset ke join_at + 1 bulan agar payment flow bisa menghitung perpanjangan
    // dari tanggal yang benar (bukan fallback ke "hari ini").
    const expiryAt = new Date(joinAt.getFullYear(), joinAt.getMonth() + 1, joinAt.getDate())
    const result = (await app.db.query(
      `INSERT INTO customers
        (code, name, email, phone, address, package_id, router_id, status, ip_address,
         pppoe_username, pppoe_password, login_username, login_password, odp_id, gps, join_at, expiry_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Isolated', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        body.name,
        body.email || null,
        body.phone,
        body.address,
        body.packageId ?? null,
        body.routerId ?? null,
        body.ipAddress || nextIp,
        body.pppoeUsername,
        body.pppoePassword,
        body.loginUsername,
        body.loginPassword,
        body.odpId ?? "",
        body.gps ?? "",
        joinAt,
        expiryAt,
      ],
    )) as unknown as { insertId: number }

    // Auto-buat invoice periode berjalan (Unpaid) agar ada tagihan di portal pelanggan.
    // Pembayaran pertama -> layanan aktif (status Active via payment.service completePaymentFlow).
    const newCustomerId = result.insertId
    if (body.packageId) {
      const [pkg] = (await app.db.query("SELECT price FROM packages WHERE id = ?", [
        body.packageId,
      ])) as Record<string, unknown>[]
      const price = Number(pkg?.price ?? 0)
      const now = new Date()
      const period = `${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`
      const invCode = await app.db.transaction(async (q) => nextCode(q.query, "invoices", "INV-"))
      await app.db.query(
        "INSERT INTO invoices (code, customer_id, amount, status, period, due_at) VALUES (?, ?, ?, 'Unpaid', ?, DATE_ADD(NOW(), INTERVAL 1 MONTH))",
        [invCode, newCustomerId, price, period],
      )
    }

    const [row] = (await app.db.query(`${SQL_SELECT} WHERE c.id = ?`, [
      newCustomerId,
    ])) as Record<string, unknown>[]

    // Sinkron ke Mikrotik: buat secret PPPoE (disabled, karena status Isolated)
    // + pastikan profile (nama paket) ada. Kegagalan -> warning, bukan error.
    const warnings: RouterWarning[] = []
    if (body.routerId && body.pppoeUsername) {
      const res = await withRouter(app, body.routerId, async (client) => {
        await client.ensurePppSecret({
          name: body.pppoeUsername,
          password: body.pppoePassword,
          profile: await client.ensureIsolirProfile(),
          disabled: false,
          localAddress: nextIp,
        })
      })
      if (!res.ok) {
        warnings.push(res.warning)
        await recordRouterWarning(app, {
          routerId: body.routerId,
          customerId: newCustomerId,
          action: "Tambah pelanggan (secret PPPoE)",
          warning: res.warning,
        })
      }
    }

    const payload: Record<string, unknown> = { data: mapCustomer(row) }
    if (warnings.length) payload.warning = warnings[0]
    return reply.code(201).send(payload)
  })

  // POST /customers/:id/activate-service — aktifkan layanan manual (setelah tunai/deposit)
  app.post("/customers/:id/activate-service", adminAuth, async (req, reply) => {
    const { id } = req.params as { id: string }
    await app.db.query("UPDATE customers SET status = 'Active' WHERE id = ?", [id])
    const [row] = (await app.db.query(`${SQL_SELECT} WHERE c.id = ?`, [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Pelanggan tidak ditemukan" } })
    }

    // Sinkron ke Mikrotik: enable secret PPPoE (kembalikan ke profile paket)
    const warnings: RouterWarning[] = []
    if (row.router_id && row.pppoe_username) {
      const res = await withRouter(app, Number(row.router_id), async (client) => {
        const [pkg] = (await app.db.query("SELECT name, download_speed, upload_speed FROM packages WHERE id = ?", [
          row.package_id,
        ])) as Record<string, unknown>[]
        if (pkg?.download_speed && pkg?.upload_speed) {
          const profile = await client.ensurePppProfile({ name: String(pkg.name), downloadSpeed: Number(pkg.download_speed), uploadSpeed: Number(pkg.upload_speed) })
          await client.changePppProfile({
            name: String(row.pppoe_username),
            password: String(row.pppoe_password ?? ""),
            profile,
          })
        }
      })
      if (!res.ok) {
        warnings.push(res.warning)
        await recordRouterWarning(app, {
          routerId: Number(row.router_id),
          customerId: Number(row.id),
          action: "Aktifkan layanan",
          warning: res.warning,
        })
      }
    }

    const payload: Record<string, unknown> = { data: mapCustomer(row) }
    if (warnings.length) payload.warning = warnings[0]
    return reply.send(payload)
  })

  // PUT /customers/:id
  app.put("/customers/:id", adminAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const body = updateCustomerSchema.parse(req.body)

    // Catat paket & IP lama utk deteksi "pindah paket" atau perubahan IP
    const [prevRow] = (await app.db.query("SELECT package_id, ip_address FROM customers WHERE id = ?", [
      id,
    ])) as Record<string, unknown>[]
    const prevPackageId = prevRow ? Number(prevRow.package_id ?? 0) : null
    const prevIp = prevRow ? String(prevRow.ip_address ?? "") : ""

    await app.db.query(
      `UPDATE customers SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        package_id = COALESCE(?, package_id),
        router_id = COALESCE(?, router_id),
        ip_address = COALESCE(?, ip_address),
        pppoe_username = COALESCE(?, pppoe_username),
        pppoe_password = COALESCE(?, pppoe_password),
        login_username = COALESCE(?, login_username),
        login_password = COALESCE(?, login_password),
        odp_id = COALESCE(?, odp_id),
        gps = COALESCE(?, gps)
       WHERE id = ?`,
      [
        body.name ?? null,
        body.email ?? null,
        body.phone ?? null,
        body.address ?? null,
        body.packageId ?? null,
        body.routerId ?? null,
        body.ipAddress ?? null,
        body.pppoeUsername ?? null,
        body.pppoePassword ?? null,
        body.loginUsername ?? null,
        body.loginPassword ?? null,
        body.odpId ?? null,
        body.gps ?? null,
        id,
      ],
    )
    let [row] = (await app.db.query(`${SQL_SELECT} WHERE c.id = ?`, [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Pelanggan tidak ditemukan" } })
    }

    // Jika pengguna mengosongkan IP pada update (""), alokasikan dari pool router
    // atau fallback ke 192.168.1.x seperti pada pembuatan.
    if ((row.ip_address === null || String(row.ip_address).trim() === "") && (body.routerId || row.router_id)) {
      const routerIdToUse = body.routerId ? Number(body.routerId) : Number(row.router_id)
      const [routerRow] = (await app.db.query("SELECT ip_pool_pppoe FROM routers WHERE id = ?", [routerIdToUse])) as Record<string, unknown>[]
      const pool = routerRow?.ip_pool_pppoe ? String(routerRow.ip_pool_pppoe) : ""
      let allocated = ""
      if (pool) {
        allocated = await nextIpFromPool(app.db.query, pool, routerIdToUse)
      } else {
        const [maxRow] = (await app.db.query(
          "SELECT ip_address FROM customers WHERE ip_address LIKE '192.168.1.%' ORDER BY CAST(SUBSTRING_INDEX(ip_address, '.', -1) AS UNSIGNED) DESC LIMIT 1",
        )) as Record<string, unknown>[]
        const lastOctet = Number((maxRow?.ip_address as string | undefined)?.split(".")[3] ?? 1)
        allocated = `192.168.1.${lastOctet + 1}`
      }
      await app.db.query("UPDATE customers SET ip_address = ? WHERE id = ?", [allocated, id])
      const [updatedRow] = (await app.db.query(`${SQL_SELECT} WHERE c.id = ?`, [id])) as Record<string, unknown>[]
      row = updatedRow
    }

    // Auto-reassign profile PPPoE bila pelanggan PINDAH PAKET (kecepatan berubah).
    // Customer Isolated tetap enabled dan memakai profile ISOLIR.
    // Kegagalan -> warning, bukan error (DB tetap source of truth).
    const warnings: RouterWarning[] = []
    const newPackageId = body.packageId ? Number(body.packageId) : null
    if (row.router_id && row.pppoe_username && newPackageId && newPackageId !== prevPackageId) {
      const [pkg] = (await app.db.query("SELECT name, download_speed, upload_speed FROM packages WHERE id = ?", [
        newPackageId,
      ])) as Record<string, unknown>[]
      if (pkg?.download_speed && pkg?.upload_speed) {
        const res = await withRouter(app, Number(row.router_id), async (client) => {
          const isIsolated = String(row.status) === "Isolated"
          const profile = isIsolated
            ? await client.ensureIsolirProfile()
            : await client.ensurePppProfile({
                name: String(pkg.name),
                downloadSpeed: Number(pkg.download_speed),
                uploadSpeed: Number(pkg.upload_speed),
              })
          await client.ensurePppSecret({
            name: String(row.pppoe_username),
            password: String(row.pppoe_password ?? ""),
            profile,
            disabled: !isIsolated && String(row.status) !== "Active",
            localAddress: row.ip_address ? String(row.ip_address) : undefined,
          })
        })
        if (!res.ok) {
          warnings.push(res.warning)
          await recordRouterWarning(app, {
            routerId: Number(row.router_id),
            customerId: Number(row.id),
            action: "Ubah paket pelanggan",
            warning: res.warning,
          })
        }
      }
    }

    // Jika IP berubah (mis. sebelumnya statis lalu dihapus), pastikan secret PPP di router
    // memakai `local-address` yang baru. Lakukan ini juga bila paket tidak berubah.
    if (row.router_id && row.pppoe_username && String(prevIp) !== String(row.ip_address)) {
      const [pkg] = (await app.db.query("SELECT name, download_speed, upload_speed FROM packages WHERE id = ?", [
        row.package_id,
      ])) as Record<string, unknown>[]
      const res = await withRouter(app, Number(row.router_id), async (client) => {
        let profile: string | undefined
        const isIsolated = String(row.status) === "Isolated"
        if (isIsolated) {
          profile = await client.ensureIsolirProfile()
        } else if (pkg?.download_speed && pkg?.upload_speed) {
          profile = await client.ensurePppProfile({ name: String(pkg.name), downloadSpeed: Number(pkg.download_speed), uploadSpeed: Number(pkg.upload_speed) })
        }
        await client.ensurePppSecret({
          name: String(row.pppoe_username),
          password: String(row.pppoe_password ?? ""),
          profile,
          disabled: !isIsolated && String(row.status) !== "Active",
          localAddress: row.ip_address ? String(row.ip_address) : undefined,
        })
      })
      if (!res.ok) {
        warnings.push(res.warning)
        await recordRouterWarning(app, {
          routerId: Number(row.router_id),
          customerId: Number(row.id),
          action: "Perbarui local-address pelanggan",
          warning: res.warning,
        })
      }
    }

    const payload: Record<string, unknown> = { data: mapCustomer(row) }
    if (warnings.length) payload.warning = warnings[0]
    return reply.send(payload)
  })

  // DELETE /customers/:id
  app.delete("/customers/:id", adminAuth, async (req, reply) => {
    const { id } = req.params as { id: string }
    await app.db.query("DELETE FROM customers WHERE id = ?", [id])
    return reply.send({ data: { message: "Pelanggan dihapus" } })
  })

  // PUT /customers/:id/expiry — set masa aktif manual
  app.put("/customers/:id/expiry", adminAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const body = expirySchema.parse(req.body)
    const iso = toISODate(body.expiryDate) ?? body.expiryDate
    await app.db.query("UPDATE customers SET expiry_at = ? WHERE id = ?", [iso, id])
    const [row] = (await app.db.query(`${SQL_SELECT} WHERE c.id = ?`, [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Pelanggan tidak ditemukan" } })
    }
    return reply.send({ data: mapCustomer(row) })
  })

  // POST /customers/:id/extend — perpanjang masa aktif N bulan + Active
  app.post("/customers/:id/extend", adminAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const body = extendSchema.parse(req.body)
    const [row] = (await app.db.query("SELECT * FROM customers WHERE id = ?", [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Pelanggan tidak ditemukan" } })
    }
    const current = fromISODate(row.expiry_at as string | undefined) || formatIdDate(new Date())
    const newExpiry = addMonthsToExpiry(current, body.months)
    const iso = toISODate(newExpiry) ?? newExpiry
    await app.db.query("UPDATE customers SET expiry_at = ?, status = 'Active' WHERE id = ?", [iso, id])
    const [updated] = (await app.db.query(`${SQL_SELECT} WHERE c.id = ?`, [
      id,
    ])) as Record<string, unknown>[]
    return reply.send({ data: mapCustomer(updated) })
  })

  // POST /customers/:id/purchase-cash — beli paket tunai: ganti paket (jika beda),
  // buat invoice baru (Unpaid), lalu lunasi tunai -> completePaymentFlow (invoice Paid,
  // masa aktif +1 bulan, status Active, sinkron router).
  app.post("/customers/:id/purchase-cash", adminAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const body = z.object({ packageId: z.coerce.number().min(1) }).parse(req.body)

    const [customer] = (await app.db.query("SELECT * FROM customers WHERE id = ?", [
      id,
    ])) as Record<string, unknown>[]
    if (!customer) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Pelanggan tidak ditemukan" } })
    }

    const [pkg] = (await app.db.query("SELECT * FROM packages WHERE id = ?", [
      body.packageId,
    ])) as Record<string, unknown>[]
    if (!pkg) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Paket tidak ditemukan" } })
    }

    const result = await app.db.transaction(async (q) => {
      // 1) Ganti paket bila berbeda
      if (Number(customer.package_id) !== Number(body.packageId)) {
        await q.query("UPDATE customers SET package_id = ? WHERE id = ?", [body.packageId, id])
      }

      // 2) Buat invoice baru (Unpaid) untuk periode berjalan
      const now = new Date()
      const period = `${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`
      const invCode = await nextCode(q.query, "invoices", "INV-")
      const invRes = (await q.query(
        "INSERT INTO invoices (code, customer_id, amount, status, period, due_at) VALUES (?, ?, ?, 'Unpaid', ?, DATE_ADD(NOW(), INTERVAL 1 MONTH))",
        [invCode, id, Number(pkg.price), period],
      )) as unknown as { insertId: number }

      // 3) Buat payment lalu selesaikan (lunas tunai) dalam transaksi yang sama
      const pyCode = await nextCode(q.query, "payments", "PY-")
      const pRes = (await q.query(
        "INSERT INTO payments (code, customer_id, invoice_id, method, amount, paid_at, status) VALUES (?, ?, ?, 'Tunai', ?, ?, 'Pending')",
        [pyCode, id, invRes.insertId, Number(pkg.price), toDbDateTime(now)],
      )) as unknown as { insertId: number }

      return completePaymentFlow(q, pRes.insertId, "Tunai", "Admin", app)
    })

    const [updated] = (await app.db.query(`${SQL_SELECT} WHERE c.id = ?`, [
      id,
    ])) as Record<string, unknown>[]
    const payload: Record<string, unknown> = {
      data: { customer: mapCustomer(updated), invoice: result.invoice, payment: result.payment },
    }
    if (result.warning) payload.warning = result.warning
    return reply.send(payload)
  })

  // POST /network/isolir/:id — isolir / unisolir
  app.post("/network/isolir/:id", techAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const body = isolateSchema.parse(req.body)
    const status = body.isolate ? "Isolated" : "Active"
    await app.db.query("UPDATE customers SET status = ? WHERE id = ?", [status, id])
    const [row] = (await app.db.query(`${SQL_SELECT} WHERE c.id = ?`, [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Pelanggan tidak ditemukan" } })
    }

    // Sinkron ke Mikrotik: ubah profile PPPoE ke ISOLIR (dengan ip-pool isolir) atau kembali ke profile normal.
    // Tidak mengubah disabled — hanya mengganti profile dan remote-address.
    const warnings: RouterWarning[] = []
    if (row.router_id && row.pppoe_username) {
      const res = await withRouter(app, Number(row.router_id), async (client) => {
        const [routerRow] = (await app.db.query(
          "SELECT ip_pool_isolir FROM routers WHERE id = ?",
          [row.router_id],
        )) as Record<string, unknown>[]
        const ipPoolIsolir = routerRow?.ip_pool_isolir ? String(routerRow.ip_pool_isolir) : undefined
        if (body.isolate) {
          // Isolir: ubah profile ke ISOLIR dengan ip-pool isolir (auto-create jika belum ada)
          const isolirProfile = await client.ensureIsolirProfile()
          await client.changePppProfile({
            name: String(row.pppoe_username),
            password: String(row.pppoe_password ?? ""),
            profile: isolirProfile,
            ipPool: ipPoolIsolir,
          })
        } else {
          // Unisolir: kembalikan ke profile paket pelanggan
          const [pkg] = (await app.db.query("SELECT name, download_speed, upload_speed FROM packages WHERE id = ?", [
            row.package_id,
          ])) as Record<string, unknown>[]
          if (pkg?.download_speed && pkg?.upload_speed) {
            const profile = await client.ensurePppProfile({ name: String(pkg.name), downloadSpeed: Number(pkg.download_speed), uploadSpeed: Number(pkg.upload_speed) })
            await client.changePppProfile({
              name: String(row.pppoe_username),
              password: String(row.pppoe_password ?? ""),
              profile,
            })
          }
        }
      })
      if (!res.ok) {
        warnings.push(res.warning)
        await recordRouterWarning(app, {
          routerId: Number(row.router_id),
          customerId: Number(row.id),
          action: body.isolate ? "Isolir pelanggan" : "Aktifkan koneksi",
          warning: res.warning,
        })
      }
    }

    const actor = (req.user as { role?: string; sub?: string })?.role ?? "Admin"
    await app.db.query("INSERT INTO activity_logs (actor, action, target) VALUES (?, ?, ?)", [
      actor,
      body.isolate ? "Isolir pelanggan" : "Aktifkan koneksi",
      String(row.name),
    ])
    const payload: Record<string, unknown> = { data: mapCustomer(row) }
    if (warnings.length) payload.warning = warnings[0]
    return reply.send(payload)
  })

  // POST /customers/sync — sinkron secret PPPoE SEMUA pelanggan ke router masing-masing.
  // Mapping paket -> profile Mikrotik memakai nama paket dari database.
  // Pelanggan Isolated tetap enabled, tetapi memakai profile ISOLIR.
  // Dikelompokkan per router; satu router gagal tidak menghentikan router lain.
  app.post("/customers/sync", techAuth, async (req, reply) => {
    const customers = (await app.db.query(
      `SELECT c.id AS customer_id, c.name AS customer_name, c.router_id,
              c.pppoe_username, c.pppoe_password, c.status,
              p.name AS package_name, p.download_speed, p.upload_speed, p.type AS package_type
       FROM customers c
       LEFT JOIN packages p ON p.id = c.package_id
       WHERE c.router_id IS NOT NULL
         AND c.pppoe_username IS NOT NULL AND c.pppoe_username <> ''
       ORDER BY c.router_id ASC`,
    )) as Record<string, unknown>[]

    if (customers.length === 0) {
      return reply.send({
        data: { syncedCount: 0, routerResults: [], customerCount: 0 },
        warning: {
          code: "MIKROTIK_OFFLINE",
          message: "Tidak ada pelanggan dengan username PPPoE & router terasign",
        },
      })
    }

    // Kelompokkan pelanggan per router (sekali koneksi per router, efisien)
    const byRouter = new Map<number, Record<string, unknown>[]>()
    for (const c of customers) {
      const rid = Number(c.router_id)
      if (!byRouter.has(rid)) byRouter.set(rid, [])
      byRouter.get(rid)!.push(c)
    }

    const warnings: RouterWarning[] = []
    const routerResults: Record<string, unknown>[] = []
    let syncedCount = 0

    for (const [routerId, list] of byRouter) {
      const res = await withRouter(app, routerId, async (client) => {
        // Profile ISOLIR wajib tersedia karena secret Isolated tetap enabled.
        const isolirProfile = await client.ensureIsolirProfile()

        // Pastikan SEMUA paket PPPoE punya profile di Mikrotik (bahkan yang belum ada pelanggan)
        const pppoePackages = (await app.db.query(
          "SELECT name, download_speed, upload_speed FROM packages WHERE type = 'PPPoE' AND status = 'Aktif'",
        )) as Record<string, unknown>[]
        for (const pkg of pppoePackages) {
          await client.ensurePppProfile({
            name: String(pkg.name),
            downloadSpeed: Number(pkg.download_speed),
            uploadSpeed: Number(pkg.upload_speed),
          })
        }

        const secrets: Array<{ name: string; password: string; profile?: string; disabled: boolean }> = []
        for (const c of list) {
          let profile: string | undefined
          let disabled = true
          if (String(c.status) === "Isolated") {
            profile = isolirProfile
            disabled = false
          } else if (String(c.status) === "Active") {
            // Pelanggan aktif memakai profile dengan nama paket dari database.
            if (c.package_type === "PPPoE" && c.download_speed && c.upload_speed) {
              profile = await client.ensurePppProfile({
                name: String(c.package_name),
                downloadSpeed: Number(c.download_speed),
                uploadSpeed: Number(c.upload_speed),
              })
            }
            disabled = false
          }
          secrets.push({
            name: String(c.pppoe_username),
            password: String(c.pppoe_password ?? ""),
            profile,
            disabled,
          })
        }
        return client.syncSecrets(secrets)
      })

      if (res.ok) {
        syncedCount += res.data
        await app.db.query("UPDATE routers SET client_count = ? WHERE id = ?", [res.data, routerId])
        routerResults.push({ routerId, syncedCount: res.data })
      } else {
        warnings.push(res.warning)
        await recordRouterWarning(app, {
          routerId,
          action: "Sinkronisasi pelanggan",
          warning: res.warning,
        })
        routerResults.push({ routerId, syncedCount: 0, warning: res.warning })
      }
    }

    const payload: Record<string, unknown> = {
      data: { syncedCount, routerResults, customerCount: customers.length },
    }
    if (warnings.length) payload.warning = warnings[0]
    return reply.send(payload)
  })

  // GET /customers/export — download semua pelanggan sebagai .xlsx
  app.get("/customers/export", adminAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const rows = (await app.db.query(SQL_SELECT)) as Record<string, unknown>[]
    const buffer = await generateCustomerWorkbook(rows)
    const filename = `pelanggan_${new Date().toISOString().slice(0, 10)}.xlsx`
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .header("Content-Length", buffer.length.toString())
      .send(buffer)
  })

  // GET /customers/template — download template import .xlsx
  app.get("/customers/template", adminAuth, async (req: FastifyRequest, reply: FastifyReply) => {
    const buffer = await generateTemplateWorkbook()
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", 'attachment; filename="template-import-pelanggan.xlsx"')
      .header("Content-Length", buffer.length.toString())
      .send(buffer)
  })

  // POST /customers/import — import pelanggan dari file .xlsx
  app.post(
    "/customers/import",
    {
      onRequest: [app.authenticate],
      preHandler: [app.requireRoles(["super_admin", "admin"])],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const fastifyMultipart = await import("@fastify/multipart")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload = await req.file() as any

        if (!payload) {
          return reply.code(400).send({
            error: { code: "BAD_REQUEST", message: "File Excel wajib diupload" },
          })
        }

        const buffer = Buffer.from(await payload.toBuffer())
        const { rows: parsedRows, errors: parseErrors } = await parseImportWorkbook(buffer)

        if (parseErrors.length > 0) {
          return reply.code(422).send({
            error: { code: "VALIDATION_ERROR", message: `${parseErrors.length} error validasi` },
            errors: parseErrors,
          })
        }

        if (parsedRows.length === 0) {
          return reply.code(400).send({
            error: { code: "BAD_REQUEST", message: "Tidak ada data valid untuk diimport" },
          })
        }

        const result = await executeImport(app, parsedRows)

        if (result.errorCount > 0) {
          return reply.code(207).send({
            data: {
              successCount: result.successCount,
              errorCount: result.errorCount,
              totalRows: result.totalRows,
              insertedIds: result.insertedIds,
            },
            errors: result.errors,
          })
        }

        return reply.code(200).send({
          data: {
            successCount: result.successCount,
            errorCount: result.errorCount,
            totalRows: result.totalRows,
            insertedIds: result.insertedIds,
          },
        })
      } catch (err: any) {
        return reply.code(500).send({
          error: { code: "INTERNAL_ERROR", message: err.message ?? "Gagal memproses import" },
        })
      }
    },
  )
}
