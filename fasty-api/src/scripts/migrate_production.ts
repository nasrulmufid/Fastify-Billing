import { readFile } from "node:fs/promises"
import mysql from "mysql2/promise"

import { config } from "../config.js"

async function main() {
  const sql = await readFile("/app/sql/migration_production.sql", "utf8")
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  })

  try {
    await connection.query(sql)
    console.log("Migrasi produksi berhasil dieksekusi")
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error("Migrasi gagal:", error)
  process.exit(1)
})
