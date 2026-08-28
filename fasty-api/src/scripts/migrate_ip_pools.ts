import mysql from "mysql2/promise"

import { config } from "../config.js"

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  })

  try {
    const [columns] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME AS columnName
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = 'routers'`,
      [config.db.database],
    )
    const existingColumns = new Set(columns.map((column) => String(column.columnName)))

    console.log("Migrasi: Menyesuaikan kolom IP pool pada tabel routers...")

    if (!existingColumns.has("ip_pool_pppoe")) {
      await connection.query(
        "ALTER TABLE routers ADD COLUMN ip_pool_pppoe VARCHAR(45) NULL COMMENT 'CIDR pool PPPoE untuk alokasi IP otomatis' AFTER api_password",
      )
      console.log("✓ Kolom ip_pool_pppoe ditambahkan")
    }

    if (!existingColumns.has("ip_pool_isolir")) {
      await connection.query(
        "ALTER TABLE routers ADD COLUMN ip_pool_isolir VARCHAR(45) NULL COMMENT 'CIDR pool untuk profile ISOLIR Mikrotik' AFTER ip_pool_pppoe",
      )
      console.log("✓ Kolom ip_pool_isolir ditambahkan")
    }

    if (existingColumns.has("ip_pool")) {
      await connection.query(
        "UPDATE routers SET ip_pool_pppoe = ip_pool WHERE (ip_pool_pppoe IS NULL OR ip_pool_pppoe = '') AND ip_pool IS NOT NULL AND ip_pool <> ''",
      )
      await connection.query("ALTER TABLE routers DROP COLUMN ip_pool")
      console.log("✓ Data ip_pool dipindahkan dan kolom ip_pool dihapus")
    }

    console.log("Migrasi selesai!")
  } finally {
    await connection.end()
  }
}

main().catch((err) => {
  console.error("Migrasi gagal:", err)
  process.exit(1)
})
