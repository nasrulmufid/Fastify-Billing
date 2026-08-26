/**
 * Script migrasi: Ubah customer code dari "CUST-XXXX" ke 6-digit number
 * Contoh: CUST-1001 -> 001001, CUST-1030 -> 001030
 * 
 * Penggunaan: npm run db:migrate:customer-code
 */
import mysql from "mysql2/promise"
import { config } from "../config.js"

async function main() {
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  })

  try {
    console.log("Menjalankan migrasi: CUST-XXXX -> 6-digit number...")
    
    // Update semua code existing: ambil angka setelah "CUST-" dan zero-pad jadi 6 digit
    const [result] = await conn.query(`
      UPDATE customers 
      SET code = LPAD(CAST(SUBSTRING(code, 6) AS UNSIGNED), 6, '0')
      WHERE code LIKE 'CUST-%'
    `) as any
    
    const affectedRows = result.affectedRows
    console.log(`✔ ${affectedRows} record berhasil diupdate`)
    
    // Verify hasil
    const [rows] = await conn.query(
      "SELECT id, code, name FROM customers ORDER BY CAST(code AS UNSIGNED) LIMIT 10",
      []
    ) as any[]
    
    console.log("\nSample hasil:")
    console.table(rows)
    
    console.log("\nMigrasi selesai! ✅")
  } catch (error) {
    console.error("❌ Migrasi gagal:", error)
    process.exit(1)
  } finally {
    await conn.end()
  }
}

main()
