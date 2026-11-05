/**
 * Test script — trigger job scheduler manual tanpa tunggu cron
 * Usage: tsx src/scripts/test-jobs.ts [job-name]
 * 
 * Available jobs:
 *   - reminder-h7    : reminder H-7 sebelum jatuh tempo
 *   - reminder-h3    : reminder H-3 sebelum jatuh tempo
 *   - reminder-h1    : reminder H-1 sebelum jatuh tempo
 *   - isolir         : isolir otomatis customer expired
 *   - retention      : hapus invoice Lunas >90 hari
 *   - invoice        : generate invoice anniversary billing
 */

import "dotenv/config"
import Fastify from "fastify"
import { buildApp } from "../app.js"

const jobName = process.argv[2]

async function run() {
  if (!jobName) {
    console.log(`Usage: tsx src/scripts/test-jobs.ts [job-name]

Available jobs:
  reminder-h7    - Reminder H-7 sebelum jatuh tempo
  reminder-h3    - Reminder H-3 sebelum jatuh tempo
  reminder-h1    - Reminder H-1 sebelum jatuh tempo
  isolir         - Isolir otomatis customer expired
  retention      - Hapus invoice Lunas >90 hari
  invoice        - Generate invoice anniversary billing
`)
    process.exit(1)
  }

  console.log(`\n=== Running job: ${jobName} ===\n`)

  const app = await buildApp()

  try {
    const days = jobName.startsWith("reminder-h") ? parseInt(jobName.split("-h")[1]) : null

    if (days) {
      // Reminder job
      const [template] = (await app.db.query(
        "SELECT * FROM wa_templates WHERE type = ? LIMIT 1",
        [`reminder_h${days}`],
      )) as any

      console.log(`Template: ${template?.name || 'fallback'}`)

      const invoices = (await app.db.query(
        `SELECT i.id, i.code, i.due_at, i.amount,
                c.id AS customer_id, c.name AS customer_name, c.phone
         FROM invoices i
         JOIN customers c ON i.customer_id = c.id
         WHERE i.status = 'Unpaid'
           AND i.due_at = DATE_ADD(CURRENT_DATE(), INTERVAL ? DAY)
         LIMIT 10`,
        [days],
      )) as any

      console.log(`Found ${invoices.length} invoices due in ${days} days`)
      for (const inv of invoices) {
        console.log(`  [${inv.code}] ${inv.customer_name} (${inv.phone}) - Rp ${inv.amount}`)
      }
    } else if (jobName === "isolir") {
      const customers = (await app.db.query(
        "SELECT id, code, name, expiry_at FROM customers WHERE status = 'Active' AND expiry_at < CURRENT_DATE() LIMIT 10",
      )) as any

      console.log(`Found ${customers.length} expired active customers`)
      for (const c of customers) {
        console.log(`  [${c.code}] ${c.name} - expired: ${c.expiry_at}`)
      }
    } else if (jobName === "retention") {
      const [result] = (await app.db.query(
        "SELECT COUNT(*) AS total FROM invoices WHERE status = 'Paid' AND created_at < DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)",
      )) as any

      console.log(`Old paid invoices (>90d) to delete: ${result[0].total}`)
    } else if (jobName === "invoice") {
      const [settings] = (await app.db.query("SELECT billing_cycle FROM app_settings WHERE id = 1")) as any

      const cycle = String(settings[0]?.billing_cycle ?? "Setiap 1 bulan")
      const m = cycle.match(/(\d+)/)
      const months = m ? Math.max(1, Number(m[1])) : 1
      const lookAheadDays = months * 31

      const customers = (await app.db.query(
        `SELECT c.id, c.code, c.name, c.expiry_at, p.price
         FROM customers c
         LEFT JOIN packages p ON c.package_id = p.id
         WHERE c.status = 'Active' AND c.expiry_at IS NOT NULL
           AND c.expiry_at BETWEEN CURRENT_DATE() AND DATE_ADD(CURRENT_DATE(), INTERVAL ? DAY)
         LIMIT 10`,
        [lookAheadDays],
      )) as any

      console.log(`Found ${customers.length} customers expiring in ${lookAheadDays} days`)
      for (const c of customers) {
        console.log(`  [${c.code}] ${c.name} - expiry: ${c.expiry_at}, price: ${c.price}`)
      }
    } else {
      console.log(`❌ Unknown job: ${jobName}`)
      process.exit(1)
    }

    console.log("\n✅ Done")
  } catch (err) {
    console.error("❌ Error:", err)
    process.exit(1)
  } finally {
    await app.close()
  }
}

run()
