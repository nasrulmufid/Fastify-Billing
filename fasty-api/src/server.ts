import { buildApp } from "./app.js"
import { config } from "./config.js"

async function main() {
  const app = await buildApp()

  try {
    await app.listen({ port: config.port, host: config.host })
    app.log.info(`API siap di http://localhost:${config.port}`)
    app.log.info(`Dokumentasi Swagger: http://localhost:${config.port}/docs`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
