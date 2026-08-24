/**
 * Smoke test Fase 3 — tickets, hotspot, wa-gateway, notifications, activity-logs, settings, dashboard.
 * Server :3000, DB fresh. Jalankan: npx tsx src/scripts/smoke3.ts
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
  const login = await req("/auth/login", { method: "POST", body: { email: "admin@rtrw.net", password: "admin123" } })
  const token = login.json.data?.token
  if (!token) return

  // 1. tickets list + detail + status + notes
  const tickets = await req("/tickets", { token })
  check("tickets list", tickets.status === 200 && tickets.json.data?.length >= 3, `count=${tickets.json.data?.length}`)
  // pilih tiket yg punya timeline seed (TCK-1042 = id 1)
  const t = tickets.json.data.find((x: any) => x.id === 1) ?? tickets.json.data[0]
  const detail = await req(`/tickets/${t.id}`, { token })
  check("ticket detail + timeline", detail.json.data?.timeline?.length >= 1, `timeline=${detail.json.data?.timeline?.length}`)
  const st = await req(`/tickets/${t.id}/status`, { method: "PUT", token, body: { status: "Diproses", note: "Sedang ditangani" } })
  check("ticket setStatus", st.status === 200 && st.json.data?.status === "Diproses")
  const note = await req(`/tickets/${t.id}/notes`, { method: "POST", token, body: { note: "Catatan tambahan" } })
  check("ticket addNote", note.status === 200)
  const detail2 = await req(`/tickets/${t.id}`, { token })
  check("timeline bertambah", detail2.json.data?.timeline?.length === (detail.json.data?.timeline?.length ?? 0) + 2)

  // 2. hotspot profiles + generate voucher
  const profiles = await req("/hotspot/profiles", { token })
  check("hotspot profiles", profiles.status === 200 && profiles.json.data?.length >= 3, `count=${profiles.json.data?.length}`)
  const gen = await req("/hotspot/vouchers/generate", { method: "POST", token, body: { count: 5, profileId: 1, price: 10000, format: "ABCD123", usernameEqualsPassword: true, prefix: "" } })
  const vouchers = gen.json.data ?? []
  check("generate voucher 5", gen.status === 201 && vouchers.length === 5, `count=${vouchers.length}`)
  check("voucher username = password", vouchers[0]?.username === vouchers[0]?.password && /^[A-Z]{3}\d{3}$/.test(vouchers[0]?.username ?? ""), vouchers[0]?.username)

  // 3. wa-gateway templates + config + send + status
  const waTpl = await req("/wa-gateway/templates", { token })
  check("wa templates", waTpl.status === 200 && waTpl.json.data?.length >= 3, `count=${waTpl.json.data?.length}`)
  const waCfg = await req("/wa-gateway/config", { method: "PUT", token, body: { serverUrl: "https://api.go-whatsapp.example.com", apiKey: "wa_key_123", deviceName: "Bot", autoReconnect: true } })
  check("wa config PUT", waCfg.status === 200)
  const waCfgGet = await req("/wa-gateway/config", { token })
  check("wa config masked", /wa_k/.test(waCfgGet.json.data?.apiKey ?? "") && waCfgGet.json.data?.apiKey?.includes("****"), waCfgGet.json.data?.apiKey)
  const send = await req("/wa-gateway/send", { method: "POST", token, body: { to: ["0812-3456-7890"], template: { body: "Halo {nama}, tagihan {no_invoice} sebesar {jumlah}" }, vars: [{ phone: "0812-3456-7890", nama: "Budi", jumlah: "Rp 250.000", no_invoice: "INV-1038" }] } })
  check("wa send", send.status === 200, `sent=${send.json.data?.sent} failed=${send.json.data?.failed}`)

  // 4. notifications list + resend
  const notifs = await req("/notifications", { token })
  check("notifications list", notifs.status === 200 && notifs.json.data?.length >= 4, `count=${notifs.json.data?.length}`)
  const failedNotif = notifs.json.data?.find((n: any) => n.status === "Gagal")
  if (failedNotif) {
    const res = await req(`/notifications/${failedNotif.id}/resend`, { method: "POST", token })
    check("notif resend -> Terkirim", res.status === 200 && res.json.data?.status === "Terkirim")
  } else {
    check("notif resend (skip — tak ada Gagal)", true)
  }

  // 5. activity logs — trigger dulu via isolir (menulis activity_log), lalu cek
  await req("/network/isolir/3", { method: "POST", token, body: { isolate: true } })
  const logs = await req("/activity-logs", { token })
  check("activity logs", logs.status === 200 && logs.json.data?.length >= 1, `count=${logs.json.data?.length}`)

  // 6. settings GET/PUT
  const settings = await req("/settings", { token })
  check("settings GET", settings.status === 200 && settings.json.data?.gracePeriodDays === 7, `grace=${settings.json.data?.gracePeriodDays}`)
  const setPut = await req("/settings", { method: "PUT", token, body: { gracePeriodDays: 10 } })
  check("settings PUT", setPut.status === 200)
  const settings2 = await req("/settings", { token })
  check("settings tersimpan", settings2.json.data?.gracePeriodDays === 10)

  // 7. dashboard
  const stats = await req("/dashboard/stats", { token })
  check("dashboard stats", stats.status === 200 && stats.json.data?.totalCustomers >= 30, JSON.stringify(stats.json.data))
  const revenue = await req("/dashboard/revenue", { token })
  check("dashboard revenue", revenue.status === 200 && Array.isArray(revenue.json.data))
  const act = await req("/dashboard/activity", { token })
  check("dashboard activity", act.status === 200 && Array.isArray(act.json.data))
  const dist = await req("/dashboard/status-distribution", { token })
  const names = (dist.json.data ?? []).map((x: any) => x.name)
  check("dashboard status-distribution", dist.status === 200 && names.includes("Aktif"), names.join(","))

  console.log("\nSmoke test Fase 3 selesai.")
}

main()
