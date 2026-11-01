import "dotenv/config"

/**
 * Konfigurasi terpusat dari environment variables.
 * Semua nilai dibaca sekali di startup.
 */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? "0.0.0.0",
  nodeEnv: process.env.NODE_ENV ?? "development",

  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "",
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? "",
    expiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  },

  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",

  sumopod: {
    baseUrl: process.env.SUMODOP_BASE_URL ?? "https://api-pay-sandbox.sumopod.com",
    webhookSecret: process.env.SUMODOP_WEBHOOK_SECRET ?? "",
    webhookToken: process.env.SUMODOP_WEBHOOK_TOKEN ?? "",
  },

  genieacs: {
    baseUrl: process.env.GENIEACS_BASE_URL ?? "",
    apiKey: process.env.GENIEACS_API_KEY ?? "",
  },

  encryptionKey: process.env.ENCRYPTION_KEY ?? "",
}

export const isProd = config.nodeEnv === "production"

const requiredSecrets = [
  ["DB_USER", config.db.user],
  ["DB_PASSWORD", config.db.password],
  ["DB_NAME", config.db.database],
  ["JWT_SECRET", config.jwt.secret],
  ["ENCRYPTION_KEY", config.encryptionKey],
] as const

if (isProd) {
  const missing = requiredSecrets
    .filter(([, value]) => !value || value.length < 16)
    .map(([name]) => name)
  if (missing.length > 0) {
    throw new Error(`Missing or weak production secrets: ${missing.join(", ")}`)
  }
}
