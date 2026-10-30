/**
 * Util kode human-readable — pola `PREFIX-number` (max+1, aman dalam transaksi).
 * Contoh: INV-1038, PY-1011, TCK-1042, NT-1012, TPL-001.
 * Untuk customers: gunakan nextCustomerCode() yang menghasilkan 6-digit number only.
 */

/**
 * Generate 6-digit unique customer code (number only, zero-padded).
 * Contoh: 001031, 001032, ... max 999999.
 * Aman dalam transaksi (SELECT FOR UPDATE di caller).
 */
export async function nextCustomerCode(
  runQuery: (sql: string, params?: unknown[]) => Promise<unknown>,
): Promise<string> {
  const [row] = (await runQuery(
    `SELECT MAX(CAST(code AS UNSIGNED)) AS max_code FROM customers`,
  )) as Record<string, unknown>[]
  const maxCode = Number(row?.max_code ?? 0)
  const next = Math.min(maxCode + 1, 999999)
  return String(next).padStart(6, '0')
}

/**
 * Ambil nomor berikutnya (max + 1) dari kolom code sebuah tabel.
 * Dipanggil di DALAM transaksi untuk mencegah race condition.
 *
 * @param runQuery peminjam koneksi transaksi (mis. dari pool.getConnection())
 * @param table nama tabel
 * @param prefix prefix kode, mis. "CUST-"
 * @param opts.minStart nilai awal jika tabel kosong
 * @param opts.pad zero-pad nomor (mis. pad=2 -> "PKG-05")
 */
export async function nextCode(
  runQuery: (sql: string, params?: unknown[]) => Promise<unknown>,
  table: string,
  prefix: string,
  opts: { minStart?: number; pad?: number } = {},
): Promise<string> {
  const { minStart = 1000, pad = 0 } = opts
  const [row] = (await runQuery(
    `SELECT MAX(CAST(SUBSTRING(code, ${prefix.length + 1}) AS UNSIGNED)) AS max_num FROM ${table} FOR UPDATE`,
  )) as Record<string, unknown>[]
  const maxNum = Number(row?.max_num ?? 0)
  const next = Math.max(maxNum + 1, minStart)
  if (pad > 0) {
    return `${prefix}${String(next).padStart(pad, "0")}`
  }
  return `${prefix}${next}`
}

/**
 * Kode transaksi harian: PREFIX-{yymmdd}{4 digit acak}.
 * Contoh: IQ-2510304821 (payment), INV-2510307350 (invoice).
 *
 * Format yymmdd+random (bukan sequential) agar kode tidak membocorkan
 * volume transaksi & tetap unik per hari. Cek unik di DB dengan retry —
 * bila bentrok (± 1:10000 per hari), ulangi dgn angka acak baru (maks 5x).
 *
 * @param runQuery peminjam koneksi transaksi
 * @param table nama tabel ("payments" / "invoices")
 * @param prefix prefix kode ("IQ-" utk payment, "INV-" utk invoice)
 */
export async function nextDailyCode(
  runQuery: (sql: string, params?: unknown[]) => Promise<unknown>,
  table: string,
  prefix: string,
): Promise<string> {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")

  for (let attempt = 0; attempt < 5; attempt++) {
    const rand = String(Math.floor(1000 + Math.random() * 9000)) // 1000-9999
    const code = `${prefix}${yy}${mm}${dd}${rand}`
    const [dup] = (await runQuery(`SELECT code FROM ${table} WHERE code = ? LIMIT 1`, [code])) as Record<
      string,
      unknown
    >[]
    if (!dup) return code
  }
  // Fallback: 4 digit acak + timestamp ms agar hampir mustahil bentrok
  return `${prefix}${yy}${mm}${dd}${Math.floor(Math.random() * 9000) + 1000}${Date.now() % 100}`
}
