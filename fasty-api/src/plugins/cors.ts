import fp from "fastify-plugin"
import type { FastifyInstance } from "fastify"

import { config } from "../config.js"

export const corsPlugin = fp(async (app: FastifyInstance) => {
  await app.register(import("@fastify/cors"), {
    origin: config.corsOrigin.split(",").map((s) => s.trim()),
    credentials: true,
  })
})
