import mysql from "mysql2/promise"

import { config } from "../config.js"

type CustomerRow = { id: number; code: string; router_id: number; ip_address: string }
type RouterRow = { id: number; name: string; ip_pool_pppoe: string | null }

function parsePool(cidr: string) {
  const [address, prefixText] = cidr.split("/")
  const octets = address?.split(".").map(Number) ?? []
  const prefix = Number(prefixText)
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null

  const addressNumber = octets.reduce((value, octet) => value * 256 + octet, 0) >>> 0
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
  const network = addressNumber & mask
  const broadcast = (network | (~mask >>> 0)) >>> 0
  const first = prefix >= 31 ? network : network + 1
  const last = prefix >= 31 ? broadcast : broadcast - 1
  return { first, last }
}

function ipToNumber(ip: string) {
  const octets = ip.split(".").map(Number)
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null
  return octets.reduce((value, octet) => value * 256 + octet, 0) >>> 0
}

function numberToIp(value: number) {
  return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join(".")
}

async function main() {
  const connection = await mysql.createConnection({ ...config.db })

  try {
    const [routers] = await connection.query<RouterRow[]>(
      "SELECT id, name, ip_pool_pppoe FROM routers WHERE ip_pool_pppoe IS NOT NULL AND ip_pool_pppoe <> ''",
    )
    let updated = 0

    await connection.beginTransaction()
    for (const router of routers) {
      const pool = parsePool(router.ip_pool_pppoe ?? "")
      if (!pool) {
        console.warn(`Pool tidak valid, dilewati: ${router.name} (${router.ip_pool_pppoe})`)
        continue
      }

      const [customers] = await connection.query<CustomerRow[]>(
        "SELECT id, code, router_id, ip_address FROM customers WHERE router_id = ? ORDER BY id",
        [router.id],
      )
      const used = new Set<number>()
      for (const customer of customers) {
        const ipNumber = ipToNumber(customer.ip_address)
        if (ipNumber !== null && ipNumber >= pool.first && ipNumber <= pool.last) used.add(ipNumber)
      }

      for (const customer of customers) {
        const current = ipToNumber(customer.ip_address)
        if (current !== null && current >= pool.first && current <= pool.last) continue

        let replacement = pool.first
        while (replacement <= pool.last && used.has(replacement)) replacement += 1
        if (replacement > pool.last) throw new Error(`Pool ${router.name} penuh untuk customer ${customer.code}`)

        const replacementIp = numberToIp(replacement)
        await connection.query("UPDATE customers SET ip_address = ? WHERE id = ?", [replacementIp, customer.id])
        used.add(replacement)
        updated += 1
        console.log(`${customer.code}: ${customer.ip_address} -> ${replacementIp} (${router.name})`)
      }
    }
    await connection.commit()
    console.log(`Migrasi selesai: ${updated} IP customer diperbarui.`)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error("Migrasi IP customer gagal:", error)
  process.exit(1)
})
