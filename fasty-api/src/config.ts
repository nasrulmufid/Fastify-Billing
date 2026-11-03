/**
 * Konfigurasi terpusat dari environment variables.
 * Semua nilai dibaca sekali di startup.
 * Di Docker, env vars dari docker-compose; di dev, dari .env (load via tsc/tsx externally).
 */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? "0.0.0.0",
  nodeEnv: process.env.NODE_ENV ?? "development",

  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "",
    password: process.env.DB_PASSWORD ?? process.env.DB_PASS ?? "",
    database: process.env.DB_NAME ?? "",
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? "",
    expiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  },

  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",

  sumopod: {
    baseUrl: (process.env.SUMOPOD_URL ?? process.env.SUMOPOD_BASE_URL ?? "https://api-pay-sandbox.sumopod.com").trim().replace(/\/$/, ""),
    apiKey: process.env.SUMOPOD_API_KEY ?? process.env.SUMODOP_API_KEY ?? "",
    webhookSecret: process.env.SUMOPOD_WEBHOOK_SECRET ?? process.env.SUMODOP_WEBHOOK_SECRET ?? "",
    webhookToken: process.env.SUMOPOD_WEBHOOK_TOKEN ?? process.env.SUMODOP_WEBHOOK_TOKEN ?? "",
  },

  genieacs: {
    baseUrl: process.env.GENIEACS_BASE_URL ?? "",
    apiKey: process.env.GENIEACS_API_KEY ?? "",
  },

  gowa: {
    baseUrl: (process.env.GOWA_BASE_URL ?? "http://gowa:3000").replace(/\/$/, ""),
    basicAuth: process.env.GOWA_BASIC_AUTH ?? "",
    deviceId: process.env.GOWA_DEVICE_ID ?? "fasty-billing",
  },

  encryptionKey: process.env.ENCRYPTION_KEY ?? "",
}

export const isProd = config.nodeEnv === "production"

const requiredSecrets = [
  ["DB_PASSWORD", config.db.password],
  ["JWT_SECRET", config.jwt.secret],
  ["ENCRYPTION_KEY", config.encryptionKey],
] as const

if (isProd) {
  const missing = requiredSecrets
    .filter(([, value]) => !value || value.length < 16)
    .map(([name]) => name)
  if (missing.length > 0) {
    console.warn(`[WARN] Production secrets weak or missing: ${missing.join(", ")}`)
  }
}
