import "dotenv/config.js"
import dns from "node:dns"
import { buildApp } from "./app.js"

// Banyak VPS punya IPv6 aktif tetapi routing IPv6 keluar tidak tersedia.
// SumoPod tetap diakses melalui IPv4 agar fetch tidak timeout pada koneksi IPv6.
dns.setDefaultResultOrder("ipv4first")
import { config } from "./config.js"

async function main() {
  const app = await buildApp()

  try {
    await app.listen({ port: config.port, host: config.host })
    app.log.info(`API siap di http://localhost:${config.port}`)
    app.log.info({ sumopodUrl: config.sumopod.baseUrl }, "SumoPod URL aktif")
    app.log.info(`Dokumentasi Swagger: http://localhost:${config.port}/docs`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
