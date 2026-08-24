import mysql from "mysql2/promise"

async function main() {
  const connection = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3306,
    user: "root",
    password: "",
    database: "fasty_bill",
  })

  console.log("Migrasi: Menambahkan kolom ip_pool_pppoe dan ip_pool_isolir...")

  // Tambahkan kolom ip_pool_pppoe
  await connection.query(
    "ALTER TABLE routers ADD COLUMN ip_pool_pppoe VARCHAR(45) NULL COMMENT 'CIDR pool PPPoE untuk alokasi IP otomatis' AFTER ip_pool"
  )
  console.log("✓ Kolom ip_pool_pppoe ditambahkan")

  // Tambahkan kolom ip_pool_isolir
  await connection.query(
    "ALTER TABLE routers ADD COLUMN ip_pool_isolir VARCHAR(45) NULL COMMENT 'CIDR pool untuk profile ISOLIR Mikrotik' AFTER ip_pool_pppoe"
  )
  console.log("✓ Kolom ip_pool_isolir ditambahkan")

  // Migrasi data: salin ip_pool ke ip_pool_pppoe
  await connection.query(
    "UPDATE routers SET ip_pool_pppoe = ip_pool WHERE ip_pool IS NOT NULL AND ip_pool <> ''"
  )
  console.log("✓ Data ip_pool disalin ke ip_pool_pppoe")

  await connection.end()
  console.log("Migrasi selesai!")
}

main().catch((err) => {
  console.error("Migrasi gagal:", err)
  process.exit(1)
})
