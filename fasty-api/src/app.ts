import Fastify, { type FastifyInstance } from "fastify"
import { ZodTypeProvider } from "fastify-type-provider-zod"

import { config } from "./config.js"
import { corsPlugin } from "./plugins/cors.js"
import { dbPlugin } from "./plugins/db.js"
import { errorHandlerPlugin } from "./plugins/error-handler.js"
import { jwtPlugin } from "./plugins/jwt.js"
import { swaggerPlugin } from "./plugins/swagger.js"

import { authRoutes } from "./routes/auth.routes.js"
import { activityLogsRoutes } from "./routes/activity-logs.routes.js"
import { customersRoutes } from "./routes/customers.routes.js"
import { dashboardRoutes } from "./routes/dashboard.routes.js"
import { hotspotRoutes } from "./routes/hotspot.routes.js"
import { invoicesRoutes } from "./routes/invoices.routes.js"
import { notificationsRoutes } from "./routes/notifications.routes.js"
import { packagesRoutes } from "./routes/packages.routes.js"
import { paymentGatewayRoutes } from "./routes/payment-gateway.routes.js"
import { paymentsRoutes } from "./routes/payments.routes.js"
import { portalRoutes } from "./routes/portal.routes.js"
import { routersRoutes } from "./routes/routers.routes.js"
import { settingsRoutes } from "./routes/settings.routes.js"
import { ticketsRoutes } from "./routes/tickets.routes.js"
import { usersRoutes } from "./routes/users.routes.js"
import { waGatewayRoutes } from "./routes/wa-gateway.routes.js"
import { webhookRoutes } from "./routes/webhook.routes.js"
import { registerJobs } from "./jobs/index.js"

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" } }
          : undefined,
    },
  }).withTypeProvider<ZodTypeProvider>()

  // Global rate limit default (dapat di-override per route)
  await app.register(import("@fastify/rate-limit"), {
    max: 300,
    timeWindow: "1 minute",
  })

  // Plugins
  await app.register(corsPlugin)
  await app.register(dbPlugin)
  await app.register(jwtPlugin)
  await app.register(errorHandlerPlugin)
  await app.register(swaggerPlugin)

  // API prefix
  await app.register(
    async (api) => {
      // Fase 1 — auth & master data
      await api.register(authRoutes)
      await api.register(usersRoutes)
      await api.register(packagesRoutes)
      await api.register(routersRoutes)
      await api.register(customersRoutes)

      // Fase 2 — transaksi invoice/payment & webhook
      await api.register(invoicesRoutes)
      await api.register(paymentsRoutes)
      await api.register(paymentGatewayRoutes)
      await api.register(webhookRoutes)

      // Fase 3 — dukungan & operasional
      await api.register(ticketsRoutes)
      await api.register(hotspotRoutes)
      await api.register(waGatewayRoutes)
      await api.register(notificationsRoutes)
      await api.register(activityLogsRoutes)
      await api.register(settingsRoutes)
      await api.register(dashboardRoutes)

      // Portal pelanggan (role customer)
      await api.register(portalRoutes)
    },
    { prefix: "/api" },
  )

  // Health check
  app.get("/health", async () => ({ data: { ok: true } }))

  // Scheduler — hanya di production
  if (config.nodeEnv === "production") {
    registerJobs(app)
  }

  return app
}
