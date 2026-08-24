import fp from "fastify-plugin"
import type { FastifyInstance } from "fastify"

import { config } from "../config.js"

export const jwtPlugin = fp(async (app: FastifyInstance) => {
  await app.register(import("@fastify/jwt"), {
    secret: config.jwt.secret,
    sign: { expiresIn: config.jwt.expiresIn },
  })

  // Dekorasi helper autentikasi + RBAC
  app.decorate("authenticate", async (req, reply) => {
    try {
      await req.jwtVerify()
    } catch {
      return reply.code(401).send({
        error: { code: "UNAUTHORIZED", message: "Token tidak valid atau kedaluwarsa" },
      })
    }
  })

  app.decorate("requireRoles", (roles: string[]) => async (req, reply) => {
    const payload = req.user as { role?: string } | undefined
    if (!payload?.role || !roles.includes(payload.role)) {
      return reply.code(403).send({
        error: { code: "FORBIDDEN", message: "Role tidak diizinkan mengakses resource ini" },
      })
    }
  })
})

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: any, reply: any) => Promise<unknown>
    requireRoles: (roles: string[]) => (req: any, reply: any) => Promise<unknown>
  }
}
