import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import bcrypt from "bcryptjs"

import { toDbDateTime } from "../utils/date.js"

const loginSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
})

const customerLoginSchema = z.object({
  username: z.string().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
})

const forgotSchema = z.object({ email: z.string().email("Format email tidak valid") })

const resetSchema = z.object({
  token: z.string().min(1, "Token wajib diisi"),
  newPassword: z.string().min(6, "Password baru minimal 6 karakter"),
})

const updateProfileSchema = z.object({
  name: z.string().min(3, "Nama minimal 3 karakter").optional(),
  email: z.string().email("Email tidak valid").optional(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
  newPassword: z.string().min(6, "Password baru minimal 6 karakter"),
})

function publicUser(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
  }
}

/** Data customer untuk portal — tanpa field sensitif (pppoe/login password). */
function publicCustomer(row: Record<string, unknown>) {
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
    loginUsername: row.login_username,
    expiryDate: row.expiry_at,
    joinDate: row.join_at,
  }
}

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/login
  app.post(
    "/auth/login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = loginSchema.parse(req.body)
      const [row] = (await app.db.query(
        "SELECT * FROM users WHERE email = ? LIMIT 1",
        [body.email.toLowerCase()],
      )) as Record<string, unknown>[]

      if (!row || row.status !== "Aktif") {
        return reply.code(401).send({
          error: { code: "INVALID_CREDENTIALS", message: "Email atau password salah" },
        })
      }

      const ok = await bcrypt.compare(body.password, String(row.password_hash))
      if (!ok) {
        return reply.code(401).send({
          error: { code: "INVALID_CREDENTIALS", message: "Email atau password salah" },
        })
      }

      await app.db.query("UPDATE users SET last_login_at = ? WHERE id = ?", [
        toDbDateTime(new Date()),
        row.id,
      ])

      const token = app.jwt.sign({ sub: row.id, role: row.role })
      return reply.send({ data: { token, user: publicUser(row) } })
    },
  )

  // POST /auth/customer-login — login portal pelanggan (login_username + login_password)
  app.post(
    "/auth/customer-login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = customerLoginSchema.parse(req.body)
      const [row] = (await app.db.query(
        `SELECT c.*, p.name AS package_name, r.name AS router_name
         FROM customers c
         LEFT JOIN packages p ON p.id = c.package_id
         LEFT JOIN routers r ON r.id = c.router_id
         WHERE c.login_username = ? LIMIT 1`,
        [body.username.trim()],
      )) as Record<string, unknown>[]

      if (!row) {
        return reply.code(401).send({
          error: { code: "INVALID_CREDENTIALS", message: "Username atau password salah" },
        })
      }

      if (body.password !== String(row.login_password)) {
        return reply.code(401).send({
          error: { code: "INVALID_CREDENTIALS", message: "Username atau password salah" },
        })
      }

      // Active = layanan aktif; Isolated = akun aktif tapi layanan diisolir (bisa login & bayar).
      const token = app.jwt.sign({ sub: row.id, role: "customer" })
      return reply.send({ data: { token, customer: publicCustomer(row) } })
    },
  )

  // POST /auth/forgot-password
  app.post("/auth/forgot-password", async (req, reply) => {
    const body = forgotSchema.parse(req.body)
    // Simulasi: kirim instruksi reset via email (belum ada mailer)
    await app.db.query(
      "INSERT INTO activity_logs (actor, action, target) VALUES ('Sistem', 'Permintaan reset password', ?)",
      [body.email],
    )
    return reply.send({ data: { message: "Instruksi reset password terkirim ke email Anda." } })
  })

  // POST /auth/reset-password
  app.post("/auth/reset-password", async (req, reply) => {
    const body = resetSchema.parse(req.body)
    // Token dinormalisasi menjadi email (simulasi sederhana — produksi pakai token aman)
    const email = body.token.replace(/^reset:/, "").toLowerCase()
    const hash = await bcrypt.hash(body.newPassword, 10)
    const result = (await app.db.query(
      "UPDATE users SET password_hash = ? WHERE email = ?",
      [hash, email],
    )) as unknown as { affectedRows: number }
    if (!result.affectedRows) {
      return reply.code(400).send({
        error: { code: "INVALID_TOKEN", message: "Token reset tidak valid" },
      })
    }
    return reply.send({ data: { message: "Password berhasil direset. Silakan login." } })
  })

  // GET /auth/me
  app.get(
    "/auth/me",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const payload = req.user as { sub: string }
      const [row] = (await app.db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [
        payload.sub,
      ])) as Record<string, unknown>[]
      if (!row) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "User tidak ditemukan" } })
      }
      return reply.send({ data: publicUser(row) })
    },
  )

  // PUT /auth/me (update profil)
  app.put(
    "/auth/me",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = updateProfileSchema.parse(req.body)
      const payload = req.user as { sub: string }
      await app.db.query("UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?", [
        body.name ?? null,
        body.email ? body.email.toLowerCase() : null,
        payload.sub,
      ])
      const [row] = (await app.db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [
        payload.sub,
      ])) as Record<string, unknown>[]
      return reply.send({ data: publicUser(row) })
    },
  )

  // PUT /auth/me/password (ubah password sendiri)
  app.put(
    "/auth/me/password",
    { onRequest: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = changePasswordSchema.parse(req.body)
      const payload = req.user as { sub: string }
      const [row] = (await app.db.query("SELECT * FROM users WHERE id = ? LIMIT 1", [
        payload.sub,
      ])) as Record<string, unknown>[]
      if (!row) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "User tidak ditemukan" } })
      }
      const ok = await bcrypt.compare(body.currentPassword, String(row.password_hash))
      if (!ok) {
        return reply.code(400).send({
          error: { code: "WRONG_PASSWORD", message: "Password saat ini salah" },
        })
      }
      const hash = await bcrypt.hash(body.newPassword, 10)
      await app.db.query("UPDATE users SET password_hash = ? WHERE id = ?", [hash, payload.sub])
      return reply.send({ data: { message: "Password berhasil diubah" } })
    },
  )
}
