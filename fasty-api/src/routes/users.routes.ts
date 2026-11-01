import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import bcrypt from "bcryptjs"

const ROLE_ENUM = z.enum(["super_admin", "admin", "finance", "teknisi"])
const STATUS_ENUM = z.enum(["Aktif", "Nonaktif"])

const createUserSchema = z.object({
  name: z.string().min(3, "Nama minimal 3 karakter"),
  username: z.string().min(3, "Username minimal 3 karakter"),
  email: z.string().email("Email tidak valid").or(z.literal("")).optional(),
  password: z.string().min(6, "Password minimal 6 karakter"),
  role: ROLE_ENUM,
  status: STATUS_ENUM.default("Aktif"),
})

const updateUserSchema = z.object({
  name: z.string().min(3).optional(),
  username: z.string().min(3).optional(),
  email: z.string().email("Email tidak valid").or(z.literal("")).optional(),
  role: ROLE_ENUM.optional(),
  status: STATUS_ENUM.optional(),
})

const statusSchema = z.object({ status: STATUS_ENUM })
const resetPassSchema = z.object({ password: z.string().min(6, "Password minimal 6 karakter") })

const listQuerySchema = z.object({
  search: z.string().optional(),
  role: ROLE_ENUM.optional(),
  status: STATUS_ENUM.optional(),
})

function publicUser(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    lastLogin: row.last_login_at,
  }
}

export async function usersRoutes(app: FastifyInstance) {
  const adminOnly = { onRequest: [app.authenticate], preHandler: [app.requireRoles(["super_admin"])] }

  // GET /users
  app.get("/users", adminOnly, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const q = listQuerySchema.parse(req.query)
      const where: string[] = []
      const params: unknown[] = []
      if (q.search) {
        where.push("(name LIKE ? OR email LIKE ? OR username LIKE ?)")
        params.push(`%${q.search}%`, `%${q.search}%`, `%${q.search}%`)
      }
      if (q.role) {
        where.push("role = ?")
        params.push(q.role)
      }
      if (q.status) {
        where.push("status = ?")
        params.push(q.status)
      }
      const clause = where.length ? `WHERE ${where.join(" AND ")}` : ""
      const rows = (await app.db.query(
        `SELECT * FROM users ${clause} ORDER BY id ASC`,
        params,
      )) as Record<string, unknown>[]
      return reply.send({ data: rows.map(publicUser), meta: { page: 1, limit: rows.length, total: rows.length } })
    } catch (err: any) {
      return reply.code(500).send({
        error: { code: "SERVER_ERROR", message: "Gagal memuat data user" },
      })
    }
  })

  // POST /users
  app.post("/users", adminOnly, async (req, reply) => {
    try {
      const body = createUserSchema.parse(req.body)
      const trimmedUsername = body.username.trim().toLowerCase()
      
      // Cek username sudah ada
      const [existing] = (await app.db.query(
        "SELECT id FROM users WHERE LOWER(username) = ?",
        [trimmedUsername],
      )) as Record<string, unknown>[]
      if (existing) {
        return reply.code(409).send({
          error: { code: "USERNAME_EXISTS", message: "Username sudah digunakan" },
        })
      }
      
      const hash = await bcrypt.hash(body.password, 10)
      const result = (await app.db.query(
        "INSERT INTO users (name, username, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)",
        [body.name.trim(), trimmedUsername, body.email ? body.email.toLowerCase() : null, hash, body.role, body.status],
      )) as unknown as { insertId: number }
      
      const [row] = (await app.db.query("SELECT * FROM users WHERE id = ?", [
        result.insertId,
      ])) as Record<string, unknown>[]
      
      if (!row) {
        return reply.code(500).send({
          error: { code: "CREATE_FAILED", message: "Gagal membuat user" },
        })
      }
      
      return reply.code(201).send({ data: publicUser(row) })
    } catch (err: any) {
      if (err.code === "ERR_VALIDATION") {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: err.message },
        })
      }
      return reply.code(500).send({
        error: { code: "SERVER_ERROR", message: "Gagal membuat user" },
      })
    }
  })

  // PUT /users/:id
  app.put("/users/:id", adminOnly, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string }
      const body = updateUserSchema.parse(req.body)
      
      // Cek user exists
      const [existing] = (await app.db.query("SELECT id FROM users WHERE id = ?", [id])) as Record<string, unknown>[]
      if (!existing) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "User tidak ditemukan" } })
      }
      
      // Cek username duplikat jika username diubah
      if (body.username) {
        const trimmedUsername = body.username.trim().toLowerCase()
        const [duplicate] = (await app.db.query(
          "SELECT id FROM users WHERE LOWER(username) = ? AND id != ?",
          [trimmedUsername, id],
        )) as Record<string, unknown>[]
        if (duplicate) {
          return reply.code(409).send({
            error: { code: "USERNAME_EXISTS", message: "Username sudah digunakan" },
          })
        }
      }
      
      await app.db.query(
        "UPDATE users SET name = COALESCE(?, name), username = COALESCE(?, username), email = COALESCE(?, email), role = COALESCE(?, role), status = COALESCE(?, status) WHERE id = ?",
        [
          body.name?.trim() ?? null,
          body.username ? body.username.trim().toLowerCase() : null,
          body.email ? body.email.toLowerCase() : null,
          body.role ?? null,
          body.status ?? null,
          id
        ],
      )
      
      const [row] = (await app.db.query("SELECT * FROM users WHERE id = ?", [id])) as Record<string, unknown>[]
      return reply.send({ data: publicUser(row) })
    } catch (err: any) {
      if (err.code === "ERR_VALIDATION") {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: err.message },
        })
      }
      return reply.code(500).send({
        error: { code: "SERVER_ERROR", message: "Gagal mengubah user" },
      })
    }
  })

  // DELETE /users/:id
  app.delete("/users/:id", adminOnly, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string }
      const current = req.user as { sub: string }
      
      if (String(current.sub) === id) {
        return reply.code(400).send({
          error: { code: "SELF_DELETE", message: "Tidak bisa menghapus akun sendiri" },
        })
      }
      
      // Cek user exists
      const [existing] = (await app.db.query("SELECT id FROM users WHERE id = ?", [id])) as Record<string, unknown>[]
      if (!existing) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "User tidak ditemukan" } })
      }
      
      await app.db.query("DELETE FROM users WHERE id = ?", [id])
      return reply.send({ data: { message: "User dihapus" } })
    } catch (err: any) {
      return reply.code(500).send({
        error: { code: "SERVER_ERROR", message: "Gagal menghapus user" },
      })
    }
  })

  // PUT /users/:id/status
  app.put("/users/:id/status", adminOnly, async (req, reply) => {
    try {
      const { id } = req.params as { id: string }
      const body = statusSchema.parse(req.body)
      const current = req.user as { sub: string }
      
      // Cek user exists
      const [existing] = (await app.db.query("SELECT * FROM users WHERE id = ?", [id])) as Record<string, unknown>[]
      if (!existing) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "User tidak ditemukan" } })
      }
      
      // Cegah menonaktifkan diri sendiri
      if (String(current.sub) === id && body.status === "Nonaktif") {
        return reply.code(400).send({
          error: { code: "SELF_DEACTIVATE", message: "Tidak bisa menonaktifkan akun sendiri" },
        })
      }
      
      await app.db.query("UPDATE users SET status = ? WHERE id = ?", [body.status, id])
      const [row] = (await app.db.query("SELECT * FROM users WHERE id = ?", [id])) as Record<string, unknown>[]
      return reply.send({ data: publicUser(row) })
    } catch (err: any) {
      return reply.code(500).send({
        error: { code: "SERVER_ERROR", message: "Gagal mengubah status user" },
      })
    }
  })

  // PUT /users/:id/reset-password
  app.put("/users/:id/reset-password", adminOnly, async (req, reply) => {
    try {
      const { id } = req.params as { id: string }
      const body = resetPassSchema.parse(req.body)
      
      // Cek user exists
      const [existing] = (await app.db.query("SELECT id, name FROM users WHERE id = ?", [id])) as Record<string, unknown>[]
      if (!existing) {
        return reply.code(404).send({ error: { code: "NOT_FOUND", message: "User tidak ditemukan" } })
      }
      
      const hash = await bcrypt.hash(body.password, 10)
      await app.db.query("UPDATE users SET password_hash = ? WHERE id = ?", [hash, id])
      return reply.send({ data: { message: "Password berhasil direset" } })
    } catch (err: any) {
      if (err.code === "ERR_VALIDATION") {
        return reply.code(400).send({
          error: { code: "VALIDATION_ERROR", message: err.message },
        })
      }
      return reply.code(500).send({
        error: { code: "SERVER_ERROR", message: "Gagal mereset password" },
      })
    }
  })
}
