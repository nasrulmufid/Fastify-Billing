import mysql from "mysql2/promise"

async function main() {
  const connection = await mysql.createConnection({
    host: "127.0.0.1",
    port: 3306,
    user: "root",
    password: "",
    database: "fasty_bill",
  })

  console.log("Migrasi: Menghapus kolom ip_pool (sudah digantikan oleh ip_pool_pppoe)...")

  // Hapus kolom ip_pool
  await connection.query(
    "ALTER TABLE routers DROP COLUMN ip_pool"
  )
  console.log("✓ Kolom ip_pool dihapus")

  await connection.end()
  console.log("Migrasi selesai!")
}

main().catch((err) => {
  console.error("Migrasi gagal:", err)
  process.exit(1)
})
