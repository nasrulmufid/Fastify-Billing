import fp from "fastify-plugin"
import type { FastifyInstance } from "fastify"

import { isProd } from "../config.js"

export const helmetPlugin = fp(async (app: FastifyInstance) => {
  await app.register(import("@fastify/helmet"), {
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        }
      : false, // Disable CSP in dev for easier debugging
    crossOriginEmbedderPolicy: false, // Adjust based on your needs
  })
})
