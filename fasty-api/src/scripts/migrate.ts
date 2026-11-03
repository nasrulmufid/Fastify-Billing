/**
 * Script migrasi bersih: Hapus & buat ulang DB, jalankan schema.sql,
 * lalu buat user admin (super_admin) dengan bcrypt hash.
 *
 * Penggunaan: npm run db:migrate
 */
import "dotenv/config.js"
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
  // Hapus komentar baris (-- ...) SEBELUM split
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
  // Try connect sebagai root dulu untuk CREATE DB
  let conn: mysql.Connection
  let isRoot = false
  
  try {
    conn = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: "root",
      password: process.env.MYSQL_ROOT_PASSWORD || "",
      multipleStatements: true,
    })
    isRoot = true
    console.log("✔ Connected as root")
  } catch (err) {
    console.warn("Cannot connect as root, trying with DB user...")
    conn = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      multipleStatements: true,
    })
  }

  try {
    const dbName = config.db.database
    const dbUser = config.db.user
    const dbPass = config.db.password
    
    console.log(`Config DB:`, config.db)
    
    // 1. CREATE DATABASE (root only)
    if (isRoot) {
      console.log(`Creating database (${dbName}) as root...`)
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`)
      await conn.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'localhost' IDENTIFIED BY '${dbPass}';`)
      await conn.query(`FLUSH PRIVILEGES;`)
      console.log(`✔ Database ${dbName} created + privileges granted`)
    } else {
      console.log(`Using existing database (${dbName})...`)
    }
    
    // 2. SELECT database
    console.log(`Selecting database (${dbName})...`)
    await conn.query(`USE \`${dbName}\`;`)

    // 2. Membuat struktur tabel
    console.log("Menjalankan schema.sql untuk membuat struktur tabel...")
    await runSqlFile(conn, "schema.sql")

    // Pastikan koneksi masih berada di database yang benar
    await conn.query(`USE \`${dbName}\`;`)

    // 3. Membuat akun default super_admin (User: admin / Pass: admin)
    console.log("Membuat akun default super_admin...")
    const hash = await bcrypt.hash("admin", 10)
    
    const [result] = await conn.query(
      `INSERT INTO users (name, username, email, password_hash, role, status)
       VALUES ('Admin', 'admin', 'admin@rtrw.net', ?, 'super_admin', 'Aktif')
       ON DUPLICATE KEY UPDATE 
         name = VALUES(name), 
         role = VALUES(role), 
         status = VALUES(status)`,
      [hash],
    )
    
    console.log("Info Query Insert:", JSON.stringify(result));

    // Verifikasi langsung: Cek apakah user benar-benar masuk ke database
    const [rows]: any = await conn.query("SELECT id, username, role FROM users WHERE username = 'admin'")
    if (rows.length > 0) {
      console.log(`✔ VERIFIKASI SUKSES: Akun super_admin ditemukan di DB! (ID: ${rows[0].id}, User: ${rows[0].username})`)
    } else {
      console.error("❌ VERIFIKASI GAGAL: Data user kosong setelah insert!")
    }

    console.log("\nSetup Database selesai. Sistem siap digunakan.")
  } catch (err) {
    console.error("Proses setup database gagal:", err)
    process.exit(1)
  } finally {
    await conn.end()
  }
}

main()

