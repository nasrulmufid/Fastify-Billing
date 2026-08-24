/**
 * Util kode human-readable — pola `PREFIX-number` (max+1, aman dalam transaksi).
 * Contoh: CUST-1001, INV-1038, PY-1011, TCK-1042, NT-1012, TPL-001.
 */

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
