import type { FastifyInstance, FastifyReply } from "fastify"
import { z } from "zod"

import { fromISODate, formatIdDate } from "../utils/date.js"

export async function dashboardRoutes(app: FastifyInstance) {
  const auth = { onRequest: [app.authenticate] }

  // GET /dashboard/stats
  app.get("/dashboard/stats", auth, async (req, reply: FastifyReply) => {
    const [[cust], [unpaid], [isolated], [revenue]] = (await Promise.all([
      app.db.query("SELECT COUNT(*) AS total FROM customers"),
      app.db.query("SELECT COUNT(*) AS total, COALESCE(SUM(amount),0) AS amount FROM invoices WHERE status IN ('Unpaid','Overdue')"),
      app.db.query("SELECT COUNT(*) AS total FROM customers WHERE status = 'Isolated'"),
      app.db.query("SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE status = 'Sukses' AND MONTH(paid_at) = MONTH(CURRENT_DATE())"),
    ])) as Record<string, unknown>[][]
    return reply.send({
      data: {
        totalCustomers: Number(cust?.total ?? 0),
        unpaidInvoices: Number(unpaid?.total ?? 0),
        unpaidAmount: Number(unpaid?.amount ?? 0),
        isolatedCustomers: Number(isolated?.total ?? 0),
        monthRevenue: Number(revenue?.total ?? 0),
      },
    })
  })

  // GET /dashboard/revenue — tren pemasukan berdasarkan periode
  app.get("/dashboard/revenue", auth, async (req, reply: FastifyReply) => {
    const { months } = z.object({
      months: z.coerce.number().refine((value) => [1, 6, 12].includes(value), "Periode tidak valid").default(12),
    }).parse(req.query)
    const groupBy = months === 1 ? "DATE(paid_at)" : "DATE_FORMAT(paid_at, '%Y-%m-01')"
    const rows = (await app.db.query(
      `SELECT ${groupBy} AS date, COALESCE(SUM(amount),0) AS revenue
       FROM payments
       WHERE status = 'Sukses' AND paid_at >= DATE_SUB(CURRENT_DATE(), INTERVAL ${months} MONTH)
       GROUP BY ${groupBy} ORDER BY date ASC`,
    )) as Record<string, unknown>[]
    return reply.send({
      data: rows.map((r) => ({
        date: formatIdDate(new Date(`${String(r.date).split(" ")[0]}T00:00:00`)),
        revenue: Number(r.revenue) / 1_000_000, // dalam jutaan (konsisten recharts frontend)
      })),
    })
  })

  // GET /dashboard/activity — aktivitas terbaru (frontend recentActivity)
  app.get("/dashboard/activity", auth, async (req, reply: FastifyReply) => {
    const rows = (await app.db.query(
      "SELECT * FROM activity_logs ORDER BY id DESC LIMIT 10",
    )) as Record<string, unknown>[]
    return reply.send({
      data: rows.map((r: Record<string, unknown>) => ({
        time: fromISODate(r.created_at as string | undefined),
        activity: String(r.action),
        detail: String(r.target ?? ""),
        status: String(r.action).includes("isolir") ? "warning" : "info",
      })),
    })
  })

  // GET /dashboard/status-distribution — pie: Aktif / Isolir / Suspend(Pending)
  app.get("/dashboard/status-distribution", auth, async (req, reply: FastifyReply) => {
    const rows = (await app.db.query(
      "SELECT status, COUNT(*) AS value FROM customers GROUP BY status",
    )) as Record<string, unknown>[]
    const map: Record<string, string> = { Active: "Aktif", Isolated: "Isolir", Pending: "Suspend" }
    return reply.send({
      data: rows.map((r) => ({
        name: map[String(r.status)] ?? String(r.status),
        value: Number(r.value),
      })),
    })
  })
}
