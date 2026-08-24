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
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASS ?? "",
    database: process.env.DB_NAME ?? "fasty_bill",
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? "dev-secret",
    expiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  },

  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",

  sumopod: {
    baseUrl: process.env.SUMODOP_BASE_URL ?? "https://api-pay-sandbox.sumopod.com",
    webhookSecret: process.env.SUMODOP_WEBHOOK_SECRET ?? "",
    webhookToken: process.env.SUMODOP_WEBHOOK_TOKEN ?? "",
  },

  encryptionKey: process.env.ENCRYPTION_KEY ?? "dev-encryption-key-placeholder!!",
}

export const isProd = config.nodeEnv === "production"
