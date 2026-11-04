import fp from "fastify-plugin"
import mysql from "mysql2/promise"
import bcrypt from "bcryptjs"
import type { FastifyInstance } from "fastify"

import { config } from "../config.js"

export interface Db {
  pool: mysql.Pool
  /**
   * Query helper — mengembalikan hasil mentah mysql2:
   * SELECT -> baris (array), INSERT/UPDATE/DELETE -> ResultSetHeader (objek).
   * Call site melakukan cast sesuai kebutuhan.
   */
  query: <T = unknown>(sql: string, params?: unknown[]) => Promise<T>
  /** eksekusi dalam 1 transaksi (BEGIN/COMMIT/ROLLBACK) */
  transaction: <T>(fn: (q: DbQuery) => Promise<T>) => Promise<T>
}

/** Koneksi ber-scope transaksi (query + getConnection untuk FOR UPDATE) */
export interface DbQuery {
  query: <T = unknown>(sql: string, params?: unknown[]) => Promise<T>
  getConnection: () => Promise<mysql.PoolConnection>
}

export const dbPlugin = fp(async (app: FastifyInstance) => {
  const pool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    connectionLimit: 10,
    timezone: "+07:00",
    dateStrings: true,
  })

  const db: Db = {
    pool,
    query: async <T>(sql: string, params?: unknown[]) => {
      const [rows] = await pool.query(sql, params)
      return rows as T
    },
    transaction: async (fn) => {
      const conn = await pool.getConnection()
      try {
        await conn.beginTransaction()
        const q: DbQuery = {
          query: async <T>(sql: string, params?: unknown[]) => {
            const [rows] = await conn.query(sql, params)
            return rows as T
          },
          getConnection: async () => conn,
        }
        const result = await fn(q)
        await conn.commit()
        return result
      } catch (err) {
        await conn.rollback()
        throw err
      } finally {
        conn.release()
      }
    },
  }

  // Ensure required columns exist (idempotent migrations)
  try {
    app.log.info("Running database migrations...")

    // Ensure wa_templates.type column exists
    const [typeColExists] = await db.query<Record<string, unknown>[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'wa_templates' AND COLUMN_NAME = 'type'`,
      [config.db.database],
    )
    if (!typeColExists || typeColExists.length === 0) {
      app.log.info("Adding 'type' column to wa_templates...")
      await db.query(
        `ALTER TABLE wa_templates ADD COLUMN type ENUM('general', 'reminder_h7', 'reminder_h3', 'reminder_h1', 'isolir') NULL AFTER body`,
      )
      app.log.info("✓ Column 'type' added")
    }

    // Ensure wa_api_config.offline_message column exists
    const [offlineColExists] = await db.query<Record<string, unknown>[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'wa_api_config' AND COLUMN_NAME = 'offline_message'`,
      [config.db.database],
    )
    if (!offlineColExists || offlineColExists.length === 0) {
      app.log.info("Adding 'offline_message' column to wa_api_config...")
      await db.query(
        `ALTER TABLE wa_api_config ADD COLUMN offline_message TEXT NULL AFTER auto_reconnect`,
      )
      app.log.info("✓ Column 'offline_message' added")
    }

    // Ensure wa_api_config.payment_received_message column exists
    const [paymentMsgColExists] = await db.query<Record<string, unknown>[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'wa_api_config' AND COLUMN_NAME = 'payment_received_message'`,
      [config.db.database],
    )
    if (!paymentMsgColExists || paymentMsgColExists.length === 0) {
      app.log.info("Adding 'payment_received_message' column to wa_api_config...")
      await db.query(
        `ALTER TABLE wa_api_config ADD COLUMN payment_received_message TEXT NULL AFTER offline_message`,
      )
      app.log.info("✓ Column 'payment_received_message' added")
    }

    // Ensure customers.login_password_hash column exists
    const [loginHashColExists] = await db.query<Record<string, unknown>[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'login_password_hash'`,
      [config.db.database],
    )
    if (!loginHashColExists || loginHashColExists.length === 0) {
      app.log.info("Adding 'login_password_hash' column to customers...")
      await db.query(
        `ALTER TABLE customers ADD COLUMN login_password_hash VARCHAR(255) NULL AFTER login_password`,
      )
      app.log.info("✓ Column 'login_password_hash' added")
    }

    // Auto-hash legacy plaintext passwords into login_password_hash
    const unhashedCustomers = (await db.query(
      `SELECT id, login_password, login_password_hash FROM customers 
       WHERE (login_password_hash IS NULL AND login_password IS NOT NULL)
          OR (login_password_hash IS NOT NULL AND login_password_hash NOT LIKE '$2%')`,
    )) as Record<string, unknown>[]
    for (const cust of unhashedCustomers) {
      const plain = String(cust.login_password || cust.login_password_hash || "").trim()
      if (plain && !plain.startsWith("$2")) {
        const hash = await bcrypt.hash(plain, 10)
        await db.query("UPDATE customers SET login_password_hash = ? WHERE id = ?", [hash, cust.id])
      }
    }
    if (unhashedCustomers.length > 0) {
      app.log.info(`✓ Auto-hashed ${unhashedCustomers.length} customer passwords`)
    }

    app.log.info("✓ All migrations completed")
  } catch (err) {
    app.log.warn(err, "Migration warning (may already exist)")
  }

  app.decorate("db", db)
  app.addHook("onClose", async () => {
    await pool.end()
  })
})

declare module "fastify" {
  interface FastifyInstance {
    db: Db
  }
}
