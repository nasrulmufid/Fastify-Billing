import fp from "fastify-plugin"
import mysql from "mysql2/promise"
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
