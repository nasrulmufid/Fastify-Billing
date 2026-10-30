// Helper: cek/kelola status baca notifikasi (kolom seen_at).
// Pakai: npx tsx src/scripts/apply-seen-migration.ts          -> cek status
//        npx tsx src/scripts/apply-seen-migration.ts unread 2 -> set 2 terbaru jadi unread
import mysql from "mysql2/promise"

const conn = await mysql.createConnection({
  host: "127.0.0.1",
  port: 3306,
  user: "root",
  password: "",
  database: "fasty_bill",
  multipleStatements: true,
})

try {
  // Test helper mode: `npm run tsx apply-seen-migration.ts -- unread N`
  // sets the N newest notifications back to unread (seen_at = NULL).
  const mode = process.argv[2]
  if (mode === "unread") {
    const count = Number(process.argv[3] ?? 2)
    await conn.query(
      `UPDATE notification_logs SET seen_at = NULL
       WHERE id IN (SELECT id FROM (SELECT id FROM notification_logs ORDER BY id DESC LIMIT ?) t)`,
      [count],
    )
  }
  const [cols] = await conn.query(
    "SELECT COUNT(*) AS unread FROM notification_logs WHERE seen_at IS NULL",
  )
  console.log("unread count:", (cols as { unread: number }[])[0].unread)
  const [cols2] = await conn.query("SHOW COLUMNS FROM notification_logs LIKE 'seen_at'")
  console.log("seen_at column:", (cols2 as unknown[]).length > 0 ? "OK" : "MISSING")
} finally {
  await conn.end()
}
