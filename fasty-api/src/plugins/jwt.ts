import fp from "fastify-plugin"
import type { FastifyInstance } from "fastify"

import { config } from "../config.js"

function cookieValue(cookie: string | undefined, name: string): string | undefined {
  return cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1)
}

export const jwtPlugin = fp(async (app: FastifyInstance) => {
  await app.register(import("@fastify/cookie"))
  await app.register(import("@fastify/jwt"), {
    secret: config.jwt.secret,
    sign: { expiresIn: config.jwt.expiresIn },
    cookie: { cookieName: "access_token", signed: false },
  })

  // Dekorasi helper autentikasi + RBAC
  app.decorate("authenticate", async (req, reply) => {
    try {
      await req.jwtVerify({ onlyCookie: false })
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
