import mysql from "mysql2/promise"
import * as dotenv from "dotenv"

dotenv.config({ path: "/home/sysadmin/fasty/.env" })

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "fasty",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "fasty_bill",
}

console.log(`Connecting to ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}...`)

;(async () => {
  try {
    const conn = await mysql.createConnection(dbConfig)
    console.log("✓ Connected to database")

    // Check if column exists
    const [columns] = await conn.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'wa_templates' AND COLUMN_NAME = 'type'`,
      [dbConfig.database],
    )

    if ((columns as any[]).length > 0) {
      console.log("✓ Column 'type' already exists in wa_templates")
      await conn.end()
      process.exit(0)
    }

    console.log("Adding 'type' column to wa_templates...")
    await conn.execute(
      `ALTER TABLE wa_templates ADD COLUMN type ENUM('general', 'reminder_h7', 'reminder_h3', 'reminder_h1', 'isolir') NULL AFTER body COMMENT 'Tipe template: general atau reminder_*'`,
    )
    console.log("✓ Column 'type' added successfully")

    // Verify
    const [verify] = await conn.execute(
      `SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'wa_templates' AND COLUMN_NAME = 'type'`,
      [dbConfig.database],
    )
    console.log("✓ Verification:", verify)

    await conn.end()
    console.log("✓ Migration completed")
    process.exit(0)
  } catch (err) {
    console.error("✗ Error:", err instanceof Error ? err.message : err)
    process.exit(1)
  }
})()
