import fp from "fastify-plugin"
import type { FastifyInstance } from "fastify"

export const swaggerPlugin = fp(async (app: FastifyInstance) => {
  await app.register(import("@fastify/swagger"), {
    openapi: {
      info: {
        title: "RTRW-Billing API",
        description: "Backend REST API Billing RT/RW Net (Fastify + MySQL)",
        version: "0.1.0",
      },
      servers: [{ url: "http://localhost:3000/api" }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
  })
  await app.register(import("@fastify/swagger-ui"), {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list" },
  })
})
