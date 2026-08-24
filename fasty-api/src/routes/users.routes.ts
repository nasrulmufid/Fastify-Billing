import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { z } from "zod"
import bcrypt from "bcryptjs"

const ROLE_ENUM = z.enum(["super_admin", "admin", "finance", "teknisi"])
const STATUS_ENUM = z.enum(["Aktif", "Nonaktif"])

const createUserSchema = z.object({
  name: z.string().min(3, "Nama minimal 3 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  role: ROLE_ENUM,
  status: STATUS_ENUM.default("Aktif"),
})

const updateUserSchema = z.object({
  name: z.string().min(3).optional(),
  email: z.string().email().optional(),
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
    const q = listQuerySchema.parse(req.query)
    const where: string[] = []
    const params: unknown[] = []
    if (q.search) {
      where.push("(name LIKE ? OR email LIKE ?)")
      params.push(`%${q.search}%`, `%${q.search}%`)
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
  })

  // POST /users
  app.post("/users", adminOnly, async (req, reply) => {
    const body = createUserSchema.parse(req.body)
    const hash = await bcrypt.hash(body.password, 10)
    const result = (await app.db.query(
      "INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)",
      [body.name, body.email.toLowerCase(), hash, body.role, body.status],
    )) as unknown as { insertId: number }
    const [row] = (await app.db.query("SELECT * FROM users WHERE id = ?", [
      result.insertId,
    ])) as Record<string, unknown>[]
    return reply.code(201).send({ data: publicUser(row) })
  })

  // PUT /users/:id
  app.put("/users/:id", adminOnly, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const body = updateUserSchema.parse(req.body)
    await app.db.query(
      "UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), role = COALESCE(?, role), status = COALESCE(?, status) WHERE id = ?",
      [body.name ?? null, body.email ? body.email.toLowerCase() : null, body.role ?? null, body.status ?? null, id],
    )
    const [row] = (await app.db.query("SELECT * FROM users WHERE id = ?", [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "User tidak ditemukan" } })
    }
    return reply.send({ data: publicUser(row) })
  })

  // DELETE /users/:id
  app.delete("/users/:id", adminOnly, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string }
    const current = req.user as { sub: string }
    if (String(current.sub) === id) {
      return reply.code(400).send({
        error: { code: "SELF_DELETE", message: "Tidak bisa menghapus akun sendiri" },
      })
    }
    await app.db.query("DELETE FROM users WHERE id = ?", [id])
    return reply.send({ data: { message: "User dihapus" } })
  })

  // PUT /users/:id/status
  app.put("/users/:id/status", adminOnly, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = statusSchema.parse(req.body)
    await app.db.query("UPDATE users SET status = ? WHERE id = ?", [body.status, id])
    const [row] = (await app.db.query("SELECT * FROM users WHERE id = ?", [
      id,
    ])) as Record<string, unknown>[]
    if (!row) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "User tidak ditemukan" } })
    }
    return reply.send({ data: publicUser(row) })
  })

  // PUT /users/:id/reset-password
  app.put("/users/:id/reset-password", adminOnly, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = resetPassSchema.parse(req.body)
    const hash = await bcrypt.hash(body.password, 10)
    await app.db.query("UPDATE users SET password_hash = ? WHERE id = ?", [hash, id])
    return reply.send({ data: { message: "Password berhasil direset" } })
  })
}
