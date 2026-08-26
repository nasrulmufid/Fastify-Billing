/**
 * Utility functions untuk Excel (XLSX) import/export pelanggan.
 * Menggunakan library exceljs.
 */
import ExcelJS from "exceljs"
import type { FastifyInstance } from "fastify"

/* ----------------------------------------------------------------
   Column definitions untuk customer Excel
   ---------------------------------------------------------------- */

export const CUSTOMER_COLUMNS = [
  { header: "Nama Lengkap", key: "name", width: 25 },
  { header: "Email", key: "email", width: 25 },
  { header: "No. WhatsApp", key: "phone", width: 20 },
  { header: "Alamat", key: "address", width: 40 },
  { header: "Nama Paket", key: "packageName", width: 20 },
  { header: "Nama Router", key: "routerName", width: 20 },
  { header: "IP Address", key: "ipAddress", width: 18 },
  { header: "PPPoE Username", key: "pppoeUsername", width: 20 },
  { header: "PPPoE Password", key: "pppoePassword", width: 15 },
  { header: "Login Username", key: "loginUsername", width: 20 },
  { header: "Login Password", key: "loginPassword", width: 15 },
  { header: "ODP ID", key: "odpId", width: 20 },
  { header: "GPS Coordinates", key: "gps", width: 25 },
]

type CustomerRow = Record<string, string | number | null | undefined>

/* ----------------------------------------------------------------
   Export: generate workbook dari array customers
   ---------------------------------------------------------------- */

export async function generateCustomerWorkbook(
  customers: CustomerRow[],
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet("Pelanggan")

  // Header row dengan styling
  worksheet.columns = CUSTOMER_COLUMNS.map((col) => ({
    ...col,
    style: {
      font: { bold: true, color: { argb: "FFFFFFFF" } },
      fill: { type: "pattern", pattern: "solid" },
      alignment: { horizontal: "center", vertical: "middle" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    },
  }))

  // Warna header
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" }, // blue-600
  }

  // Data rows
  for (const cust of customers) {
    worksheet.addRow({
      name: cust.name ?? "",
      email: cust.email ?? "",
      phone: cust.phone ?? "",
      address: cust.address ?? "",
      packageName: cust.packageName ?? "",
      routerName: cust.router ?? cust.routerName ?? "",
      ipAddress: cust.ipAddress ?? "",
      pppoeUsername: cust.pppoeUsername ?? "",
      pppoePassword: cust.pppoePassword ?? "",
      loginUsername: cust.loginUsername ?? "",
      loginPassword: cust.loginPassword ?? "",
      odpId: cust.odpId ?? "",
      gps: cust.gps ?? "",
    })
  }

  // Auto-filter
  worksheet.autoFilter = {
    from: { column: 1, row: 1 },
    to: { column: CUSTOMER_COLUMNS.length, row: Math.max(1, customers.length + 1) },
  }

  // Row height untuk data
  for (let i = 2; i <= worksheet.rowCount; i++) {
    worksheet.getRow(i).height = 20
  }

  return await workbook.xlsx.writeBuffer()
}

/* ----------------------------------------------------------------
   Template: generate workbook kosong dengan contoh data
   ---------------------------------------------------------------- */

export async function generateTemplateWorkbook(): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet("Template Import")

  worksheet.columns = CUSTOMER_COLUMNS.map((col) => ({
    ...col,
    style: {
      font: { bold: true, color: { argb: "FFFFFFFF" } },
      fill: { type: "pattern", pattern: "solid" },
      alignment: { horizontal: "center", vertical: "middle" },
      border: {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      },
    },
  }))

  // Warna header berbeda (hijau untuk template)
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF059669" }, // emerald-600
  }

  // Baris 2: instruksi
  worksheet.addRow([])
  worksheet.addRow({
    name: "📋 INSTRUKSI PENGISIAN:",
    email: "",
    phone: "",
    address: "",
    packageName: "",
    routerName: "",
    ipAddress: "",
    pppoeUsername: "",
    pppoePassword: "",
    loginUsername: "",
    loginPassword: "",
    odpId: "",
    gps: "",
  })

  const instructions = [
    "✅ Isi data mulai baris ke-3 (baris 1=header, baris 2 kosong)",
    "✅ Nama Paket: pilih dari daftar paket yang tersedia (contoh: Paket 20 Mbps)",
    "✅ Nama Router: pilih dari daftar router yang tersedia (contoh: Mikrotik-Core-01)",
    "✅ IP Address: format valid (contoh: 192.168.200.5), kosongkan untuk auto-assign",
    "✅ PPPoE Username: minimal 3 karakter, huruf/angka/hyphen",
    "✅ PPPoE Password: minimal 6 karakter",
    "✅ Login Username: minimal 3 karakter",
    "✅ Login Password: minimal 6 karakter",
    "✅ No. WhatsApp: format angka saja (contoh: 081234567890)",
    "✅ GPS: format latitude,longitude (contoh: -6.9175, 107.6191)",
    "⚠️ Kolom yang wajib diisi: Nama, No. WhatsApp, Alamat, Paket, Router, PPPoE Username/Password, Login Username/Password",
    "⚠️ Pastikan Nama Paket dan Nama Router sesuai dengan data di sistem",
  ]

  for (const instr of instructions) {
    worksheet.addRow({ name: instr })
  }

  // Baris contoh data
  worksheet.addRow([])
  worksheet.addRow({ name: "📝 CONTOH DATA:" })
  worksheet.addRow({
    name: "John Doe",
    email: "john@email.com",
    phone: "081234567890",
    address: "Jl. Contoh No. 123, RT 01/RW 02",
    packageName: "Paket 20 Mbps",
    routerName: "Mikrotik-Core-01",
    ipAddress: "192.168.200.50",
    pppoeUsername: "ppp-johndoe",
    pppoePassword: "password123",
    loginUsername: "john.doe",
    loginPassword: "login123",
    odpId: "ODP-01 / Port 5",
    gps: "-6.9175, 107.6191",
  })

  return await workbook.xlsx.writeBuffer()
}

/* ----------------------------------------------------------------
   Import: parse Excel file dan return validated rows
   ---------------------------------------------------------------- */

export interface ParsedCustomerRow {
  name: string
  email: string
  phone: string
  address: string
  packageName: string
  routerName: string
  ipAddress: string
  pppoeUsername: string
  pppoePassword: string
  loginUsername: string
  loginPassword: string
  odpId: string
  gps: string
}

export interface ImportResult {
  successCount: number
  errorCount: number
  totalRows: number
  errors: Array<{ row: number; field: string; message: string; value?: string }>
}

export async function parseImportWorkbook(
  buffer: Buffer,
): Promise<{ rows: ParsedCustomerRow[]; errors: ImportResult["errors"] }> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const worksheet = workbook.getWorksheet(1)
  if (!worksheet) {
    throw new Error("File Excel tidak memiliki sheet")
  }

  const rows: ParsedCustomerRow[] = []
  const errors: ImportResult["errors"] = []

  // Skip header (row 1) dan instruksi (row 2+ jika ada)
  // Mulai dari row 3
  let startRow = 3
  if (worksheet.rowCount < 3) {
    startRow = 2
  }

  for (let rowIdx = startRow; rowIdx <= worksheet.rowCount; rowIdx++) {
    const row = worksheet.getRow(rowIdx)
    const cellValues: Record<string, string> = {}

    // Map kolom berdasarkan header
    const headerRow = worksheet.getRow(1)
    headerRow.eachCell((cell, colIdx) => {
      cellValues[String(cell.value ?? "").trim().toLowerCase()] = String(
        row.getCell(colIdx).value ?? "",
      ).trim()
    })

    const name = cellValues["nama lengkap"] ?? ""
    const phone = cellValues["no. whatsapp"] ?? ""
    const address = cellValues["alamat"] ?? ""
    const packageName = cellValues["nama paket"] ?? ""
    const routerName = cellValues["nama router"] ?? ""
    const pppoeUsername = cellValues["pppoe username"] ?? ""
    const pppoePassword = cellValues["pppoe password"] ?? ""
    const loginUsername = cellValues["login username"] ?? ""
    const loginPassword = cellValues["login password"] ?? ""

    // Validasi wajib
    if (!name) {
      errors.push({ row: rowIdx, field: "name", message: "Nama wajib diisi" })
      continue
    }
    if (!phone) {
      errors.push({ row: rowIdx, field: "phone", message: "No. WhatsApp wajib diisi" })
      continue
    }
    if (!address) {
      errors.push({ row: rowIdx, field: "address", message: "Alamat wajib diisi" })
      continue
    }
    if (!packageName) {
      errors.push({ row: rowIdx, field: "packageName", message: "Nama paket wajib diisi" })
      continue
    }
    if (!routerName) {
      errors.push({ row: rowIdx, field: "routerName", message: "Nama router wajib diisi" })
      continue
    }
    if (!pppoeUsername || pppoeUsername.length < 3) {
      errors.push({
        row: rowIdx,
        field: "pppoeUsername",
        message: "PPPoE username minimal 3 karakter",
      })
      continue
    }
    if (!pppoePassword || pppoePassword.length < 6) {
      errors.push({
        row: rowIdx,
        field: "pppoePassword",
        message: "PPPoE password minimal 6 karakter",
      })
      continue
    }
    if (!loginUsername || loginUsername.length < 3) {
      errors.push({
        row: rowIdx,
        field: "loginUsername",
        message: "Login username minimal 3 karakter",
      })
      continue
    }
    if (!loginPassword || loginPassword.length < 6) {
      errors.push({
        row: rowIdx,
        field: "loginPassword",
        message: "Login password minimal 6 karakter",
      })
      continue
    }

    // Normalisasi phone
    const cleanPhone = phone.replace(/[\s\-\.\(\)]/g, "")

    rows.push({
      name,
      email: cellValues["email"] ?? "",
      phone: cleanPhone,
      address,
      packageName,
      routerName,
      ipAddress: cellValues["ip address"] ?? "",
      pppoeUsername,
      pppoePassword,
      loginUsername,
      loginPassword,
      odpId: cellValues["odp id"] ?? "",
      gps: cellValues["gps coordinates"] ?? "",
    })
  }

  return { rows, errors }
}

/* ----------------------------------------------------------------
   Import: eksekusi insert ke database
   ---------------------------------------------------------------- */

export interface ImportExecutionResult extends ImportResult {
  insertedIds: number[]
}

export async function executeImport(
  app: FastifyInstance,
  parsedRows: ParsedCustomerRow[],
): Promise<ImportExecutionResult> {
  const errors: ImportResult["errors"] = []
  const insertedIds: number[] = []
  let successCount = 0

  // Ambil mapping package name -> id
  const packages = (await app.db.query(
    "SELECT id, name FROM packages WHERE status = 'Aktif'",
  )) as Array<{ id: number; name: string }>

  // Ambil mapping router name -> id
  const routers = (await app.db.query(
    "SELECT id, name FROM routers",
  )) as Array<{ id: number; name: string }>

  const pkgMap: Record<string, number> = {}
  for (const p of packages) pkgMap[p.name] = p.id

  const routerMap: Record<string, number> = {}
  for (const r of routers) routerMap[r.name] = r.id

  for (const row of parsedRows) {
    try {
      const packageId = pkgMap[row.packageName]
      if (!packageId) {
        errors.push({
          row: 0,
          field: "packageName",
          message: `Paket "${row.packageName}" tidak ditemukan`,
          value: row.packageName,
        })
        continue
      }

      const routerId = routerMap[row.routerName]
      if (!routerId) {
        errors.push({
          row: 0,
          field: "routerName",
          message: `Router "${row.routerName}" tidak ditemukan`,
          value: row.routerName,
        })
        continue
      }

      // Generate code & IP dalam transaksi
      const { code, nextIp } = await app.db.transaction(async (q) => {
        // Generate 6-digit customer code via direct SQL
        const [codeRow] = await q.query(
          `SELECT MAX(CAST(code AS UNSIGNED)) AS max_code FROM customers`,
        ) as Record<string, unknown>[]
        const maxCode = Number(codeRow?.max_code ?? 0)
        const codeStr = String(Math.min(maxCode + 1, 999999)).padStart(6, "0")

        let allocated = ""
        if (row.ipAddress && row.ipAddress.trim()) {
          allocated = row.ipAddress.trim()
        } else {
          const [routerRow] = await q.query(
            "SELECT ip_pool FROM routers WHERE id = ?",
            [routerId],
          ) as Record<string, unknown>[]
          const pool = routerRow?.ip_pool ? String(routerRow.ip_pool) : ""
          if (pool) {
            const [base, prefixStr] = pool.split("/")
            const prefix = Number(prefixStr ?? 24)
            const parts = base.split(".").map(Number)
            const hostBits = 32 - prefix
            const maxHost = Math.pow(2, hostBits) - 2
            const networkLast = parts[3]
            const firstUsable = networkLast + 1
            const lastUsable = networkLast + maxHost

            const ipRows = (await q.query(
              `SELECT ip_address FROM customers WHERE ip_address LIKE ?`,
              [`${parts[0]}.${parts[1]}.${parts[2]}.%`],
            )) as Record<string, unknown>[]

            let highest = firstUsable - 1
            for (const ipRow of ipRows) {
              const ip = String(ipRow.ip_address ?? "")
              const oct = Number(ip.split(".")[3])
              if (
                ip.startsWith(`${parts[0]}.${parts[1]}.${parts[2]}.`) &&
                !Number.isNaN(oct)
              ) {
                if (oct > highest && oct <= lastUsable) highest = oct
              }
            }
            const next = highest + 1
            allocated =
              next > lastUsable
                ? `${parts[0]}.${parts[1]}.${parts[2]}.254`
                : `${parts[0]}.${parts[1]}.${parts[2]}.${next}`
          } else {
            const [maxRow] = await q.query(
              "SELECT ip_address FROM customers WHERE ip_address LIKE '192.168.1.%' ORDER BY CAST(SUBSTRING_INDEX(ip_address, '.', -1) AS UNSIGNED) DESC LIMIT 1",
            ) as Record<string, unknown>[]
            const lastOctet = Number(
              (maxRow?.ip_address as string | undefined)?.split(".")[3] ?? 1,
            )
            allocated = `192.168.1.${lastOctet + 1}`
          }
        }

        return { code: codeStr, nextIp: allocated }
      })

      const joinAt = new Date()
      const result = (await app.db.query(
        `INSERT INTO customers
          (code, name, email, phone, address, package_id, router_id, status, ip_address,
           pppoe_username, pppoe_password, login_username, login_password, odp_id, gps, join_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Isolated', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          code,
          row.name,
          row.email || null,
          row.phone,
          row.address,
          packageId,
          routerId,
          nextIp,
          row.pppoeUsername,
          row.pppoePassword,
          row.loginUsername,
          row.loginPassword,
          row.odpId ?? "",
          row.gps ?? "",
          joinAt,
        ],
      )) as unknown as { insertId: number }

      insertedIds.push(result.insertId)
      successCount++

      // Auto-buat invoice
      const now = new Date()
      const MONTHS_ID = [
        "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember",
      ]
      const period = `${MONTHS_ID[now.getMonth()]} ${now.getFullYear()}`
      const [pkg] = await app.db.query("SELECT price FROM packages WHERE id = ?", [packageId])
      const price = Number((pkg as any)?.price ?? 0)

      // Get next INV code
      const [invRow] = await app.db.query(
        "SELECT MAX(CAST(SUBSTRING(code, 5) AS UNSIGNED)) AS max_num FROM invoices",
      ) as Record<string, unknown>[]
      const maxInv = Number((invRow as any)?.max_num ?? 0)
      const invCode = `INV-${maxInv + 1}`

      await app.db.query(
        "INSERT INTO invoices (code, customer_id, amount, status, period, due_at) VALUES (?, ?, ?, 'Unpaid', ?, DATE_ADD(NOW(), INTERVAL 1 MONTH))",
        [invCode, result.insertId, price, period],
      )
    } catch (err: any) {
      errors.push({
        row: 0,
        field: "general",
        message: err.message ?? "Gagal insert data",
        value: row.name,
      })
    }
  }

  return {
    successCount,
    errorCount: errors.length,
    totalRows: parsedRows.length,
    errors,
    insertedIds,
  }
}
