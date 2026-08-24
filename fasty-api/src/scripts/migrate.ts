/**
 * Script migrasi sederhana: jalankan schema.sql lalu seed.sql,
 * lalu buat user admin (super_admin) dengan bcrypt hash yang valid.
 *
 * Penggunaan: npm run db:migrate
 */
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import mysql from "mysql2/promise"
import bcrypt from "bcryptjs"

import { config } from "../config.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sqlDir = path.resolve(__dirname, "../../sql")

async function runSqlFile(conn: mysql.Connection, file: string) {
  const raw = await readFile(path.join(sqlDir, file), "utf8")
  // Hapus komentar baris (-- ...) SEBELUM split, agar tidak menggabungkan
  // komentar dengan statement berikutnya.
  const withoutComments = raw
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
  const statements = withoutComments
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
  for (const stmt of statements) {
    await conn.query(stmt)
  }
  console.log(`✔ ${file} dieksekusi`)
}

async function main() {
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  })

  try {
    console.log("Menjalankan schema.sql ...")
    await runSqlFile(conn, "schema.sql")

    console.log("Menjalankan seed.sql ...")
    await runSqlFile(conn, "seed.sql")

    // Upsert user admin super_admin (bcrypt hash valid utk "admin123")
    const hash = await bcrypt.hash("admin123", 10)
    await conn.query(
      `INSERT INTO users (name, email, password_hash, role, status)
       VALUES ('Admin', 'admin@rtrw.net', ?, 'super_admin', 'Aktif')
       ON DUPLICATE KEY UPDATE name = 'Admin', role = 'super_admin', status = 'Aktif'`,
      [hash],
    )
    console.log("✔ User admin dibuat: admin@rtrw.net / admin123")

    console.log("\nMigrasi selesai. Database siap digunakan.")
  } catch (err) {
    console.error("Migrasi gagal:", err)
    process.exit(1)
  } finally {
    await conn.end()
  }
}

main()
