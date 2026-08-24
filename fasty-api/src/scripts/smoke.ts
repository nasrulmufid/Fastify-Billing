/**
 * Smoke test Fase 1 — dijalankan via `npx tsx src/scripts/smoke.ts`
 * (server harus sudah berjalan di :3000)
 */
const BASE = "http://localhost:3000/api"

async function req(path: string, options: { method?: string; body?: unknown; token?: string } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

function check(name: string, cond: boolean, extra = "") {
  console.log(`${cond ? "✔" : "✘"} ${name}${extra ? ` — ${extra}` : ""}`)
  if (!cond) process.exitCode = 1
}

async function main() {
  // 1. login
  const login = await req("/auth/login", { method: "POST", body: { email: "admin@rtrw.net", password: "admin123" } })
  check("login 200", login.status === 200, JSON.stringify(login.json.data?.user))
  const token = login.json.data?.token
  if (!token) return

  // 2. tanpa token -> 401
  const noAuth = await req("/customers")
  check("tanpa token -> 401", noAuth.status === 401, `status=${noAuth.status}`)

  // 3. daftar customers
  const list = await req("/customers?page=1&limit=3", { token })
  check("list customers 200", list.status === 200 && list.json.meta?.total >= 30, `total=${list.json.meta?.total}`)

  // 4. detail customer (JOIN package/router + tanggal)
  const detail = await req("/customers/1", { token })
  const d = detail.json.data
  check(
    "detail customer JOIN + tanggal",
    detail.status === 200 && d?.packageName === "Paket 20 Mbps" && d?.router === "Mikrotik-Core-01" && d?.expiryDate === "10 September 2026",
    `pkg=${d?.packageName} router=${d?.router} expiry=${d?.expiryDate}`,
  )

  // 5. create customer
  const created = await req("/customers", {
    method: "POST",
    token,
    body: {
      name: "Ahmad Dahlan", phone: "0812-111-2222", address: "Jl. Melati No. 1, Kel. Damai",
      packageId: 2, routerId: 1, pppoeUsername: "ppp-ahmad", pppoePassword: "ahmad#2026",
      loginUsername: "ahmad.dahlan", loginPassword: "ahmad2026",
    },
  })
  check("create customer 201", created.status === 201, `code=${created.json.data?.code} ip=${created.json.data?.ipAddress}`)
  const newId = created.json.data?.id
  if (!newId) return

  // 6. isolir
  const iso = await req(`/network/isolir/${newId}`, { method: "POST", token, body: { isolate: true } })
  check("isolir -> Isolated", iso.status === 200 && iso.json.data?.status === "Isolated", `status=${iso.json.data?.status}`)

  // 7. extend +1 bulan
  const ext = await req(`/customers/${newId}/extend`, { method: "POST", token, body: { months: 1 } })
  check("extend -> Active + expiry", ext.status === 200 && ext.json.data?.status === "Active" && !!ext.json.data?.expiryDate, `expiry=${ext.json.data?.expiryDate}`)

  // 8. set expiry manual
  const ex2 = await req(`/customers/${newId}/expiry`, { method: "PUT", token, body: { expiryDate: "15 Desember 2026" } })
  check("set expiry", ex2.status === 200 && ex2.json.data?.expiryDate === "15 Desember 2026", `expiry=${ex2.json.data?.expiryDate}`)

  // 9. packages + create
  const pkgs = await req("/packages", { token })
  check("packages list", pkgs.status === 200 && pkgs.json.data?.length >= 4, `count=${pkgs.json.data?.length}`)
  const newPkg = await req("/packages", {
    method: "POST", token,
    body: { name: "Paket 100 Mbps", downloadSpeed: 100, uploadSpeed: 100, price: 1000000, type: "PPPoE" },
  })
  check("create package -> PKG-0X", newPkg.status === 201 && /^PKG-\d{2,}$/.test(newPkg.json.data?.code ?? ""), `code=${newPkg.json.data?.code}`)

  // 10. routers + validasi host
  const routers = await req("/routers", { token })
  check("routers list", routers.status === 200 && routers.json.data?.length === 3, `count=${routers.json.data?.length}`)
  const badHost = await req("/routers", { method: "POST", token, body: { name: "R-Bad", host: "999.999.999.999", provider: "Mikrotik" } })
  check("host invalid ditolak", badHost.status === 400, `status=${badHost.status}`)

  console.log("\nSmoke test Fase 1 selesai.")
}

main()
