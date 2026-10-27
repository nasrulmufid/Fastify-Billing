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

  genieacs: {
    baseUrl: process.env.GENIEACS_URL ?? "http://localhost:7557",
    apiKey: process.env.GENIEACS_API_KEY ?? "",
    syncIntervalMinutes: Number(process.env.GENIEACS_SYNC_INTERVAL ?? 30),
    autoSyncOnAccess: process.env.GENIEACS_AUTO_SYNC !== "false",
  },

  radius: {
    host: process.env.RADIUS_HOST ?? "freeradius",
    authPort: Number(process.env.RADIUS_AUTH_PORT ?? 1812),
    acctPort: Number(process.env.RADIUS_ACCT_PORT ?? 1813),
    coaPort: Number(process.env.RADIUS_COA_PORT ?? 3799),
    enabled: process.env.RADIUS_ENABLED === "true",
  },
}

export const isProd = config.nodeEnv === "production"
