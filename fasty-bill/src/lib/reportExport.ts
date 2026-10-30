/**
 * Utilitas export Laporan Pendapatan ke XLSX (exceljs) & PDF (jspdf-autotable)
 * dengan desain profesional: header berwarna, total row, footer credit.
 */
import ExcelJS from "exceljs"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

export interface ReportRow {
  code: string
  customer: string
  invoice: string
  method: string
  date: string
  amount: number
  status: string
}

export interface ReportMeta {
  /** Judul di header dokumen, mis. "Laporan Pendapatan" */
  title: string
  /** Label periode aktif, mis. "Hari Ini" / "2026-10-01 s/d 2026-10-30" */
  periodLabel: string
  /** Ringkasan: [label, nilai] — dicetak di bawah header & di total PDF */
  summary: Array<{ label: string; value: string }>
  /** Nama file tanpa ekstensi */
  fileName: string
}

const BRAND_COLOR = "2563EB" // blue-600
const HEADER_BG = "1E293B" // slate-800
const SUCCESS_COLOR = "059669" // emerald-600

function formatRupiah(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`
}

function fileTimestamp(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

/* ================================================================
   Export XLSX (exceljs)
   ================================================================ */
export async function exportReportXlsx(rows: ReportRow[], meta: ReportMeta): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Fastify Billing"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("Laporan Pendapatan", {
    views: [{ state: "frozen", ySplit: 5 }], // header tetap terlihat saat scroll
  })

  // Lebar kolom (A..F)
  sheet.columns = [
    { width: 14 }, // Kode
    { width: 28 }, // Pelanggan
    { width: 14 }, // Invoice
    { width: 12 }, // Metode
    { width: 20 }, // Tanggal
    { width: 18 }, // Jumlah
  ]

  /* ---------- Judul laporan ---------- */
  sheet.mergeCells("A1:F1")
  const titleCell = sheet.getCell("A1")
  titleCell.value = meta.title
  titleCell.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } }
  titleCell.alignment = { vertical: "middle", horizontal: "center" }
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND_COLOR}` } }
  sheet.getRow(1).height = 30

  sheet.mergeCells("A2:F2")
  const periodCell = sheet.getCell("A2")
  periodCell.value = `Periode: ${meta.periodLabel}`
  periodCell.font = { size: 11, italic: true, color: { argb: "FF64748B" } }
  periodCell.alignment = { vertical: "middle", horizontal: "center" }
  sheet.getRow(2).height = 20

  // Ringkasan (baris 3)
  sheet.mergeCells("A3:F3")
  sheet.getCell("A3").value = meta.summary.map((s) => `${s.label}: ${s.value}`).join("    |    ")
  sheet.getCell("A3").font = { size: 10, color: { argb: "FF64748B" } }
  sheet.getCell("A3").alignment = { horizontal: "center" }
  sheet.getRow(3).height = 18

  /* ---------- Header tabel (baris 5) ---------- */
  const headerRowIndex = 5
  const headers = ["Kode", "Pelanggan", "Invoice", "Metode", "Tanggal", "Jumlah"]
  const headerRow = sheet.getRow(headerRowIndex)
  headerRow.values = headers
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${HEADER_BG}` } }
    cell.alignment = { vertical: "middle", horizontal: "center" }
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    }
  })
  headerRow.height = 22

  /* ---------- Data rows ---------- */
  rows.forEach((r, i) => {
    const row = sheet.getRow(headerRowIndex + 1 + i)
    row.values = [r.code, r.customer, r.invoice, r.method, r.date, r.amount]
    // Format kolom Jumlah (F) sebagai rupiah
    row.getCell(6).numFmt = '"Rp"#,##0'
    row.getCell(6).alignment = { horizontal: "right" }
    // Zebra striping
    if (i % 2 === 1) {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } } // slate-100
      })
    }
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: "hair" },
        left: { style: "hair" },
        bottom: { style: "hair" },
        right: { style: "hair" },
      }
    })
  })

  /* ---------- Baris TOTAL ---------- */
  const totalRow = sheet.getRow(headerRowIndex + 1 + rows.length)
  const sukses = rows.filter((r) => r.status === "Sukses")
  sheet.mergeCells(`A${totalRow.number}:E${totalRow.number}`)
  totalRow.getCell(1).value = `TOTAL ( ${sukses.length} transaksi sukses )`
  totalRow.getCell(1).font = { bold: true, size: 11 }
  totalRow.getCell(1).alignment = { horizontal: "right" }
  totalRow.getCell(6).value = sukses.reduce((s, r) => s + r.amount, 0)
  totalRow.getCell(6).numFmt = '"Rp"#,##0'
  totalRow.getCell(6).font = { bold: true, size: 11, color: { argb: `FF${SUCCESS_COLOR}` } }
  totalRow.getCell(6).alignment = { horizontal: "right" }
  totalRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } } // emerald-100
    cell.border = { top: { style: "medium" } }
  })
  totalRow.height = 22

  /* ---------- Auto filter & footer ---------- */
  sheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: 6 },
  }

  const footerRow = sheet.getRow(headerRowIndex + rows.length + 3)
  sheet.mergeCells(`A${footerRow.number}:F${footerRow.number}`)
  footerRow.getCell(1).value = `Dicetak dari Fastify Billing — ${new Date().toLocaleString("id-ID")}`
  footerRow.getCell(1).font = { size: 9, italic: true, color: { argb: "FF94A3B8" } }

  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${meta.fileName}-${fileTimestamp()}.xlsx`,
  )
}

/* ================================================================
   Export PDF (jspdf + autotable)
   ================================================================ */
export function exportReportPdf(rows: ReportRow[], meta: ReportMeta): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()

  /* ---------- Header dokumen ---------- */
  doc.setFillColor(BRAND_COLOR)
  doc.rect(0, 0, pageWidth, 26, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.text(meta.title, pageWidth / 2, 11, { align: "center" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(`Periode: ${meta.periodLabel}`, pageWidth / 2, 18, { align: "center" })

  /* ---------- Ringkasan (kotak-kotak) ---------- */
  let y = 32
  doc.setTextColor(30, 41, 59)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  const boxWidth = (pageWidth - 14 - 6) / Math.max(1, meta.summary.length)
  meta.summary.forEach((s, i) => {
    const x = 7 + i * (boxWidth + 6)
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(x, y, boxWidth, 16, 2, 2, "FD")
    doc.setFontSize(7.5)
    doc.setTextColor(100, 116, 139)
    doc.setFont("helvetica", "normal")
    doc.text(s.label.toUpperCase(), x + 3, y + 5)
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(15, 23, 42)
    doc.text(s.value, x + 3, y + 12)
  })

  /* ---------- Tabel transaksi ---------- */
  const totalSukses = rows.filter((r) => r.status === "Sukses").reduce((s, r) => s + r.amount, 0)
  autoTable(doc, {
    startY: y + 22,
    head: [["Kode", "Pelanggan", "Invoice", "Metode", "Tanggal", "Jumlah"]],
    body: rows.map((r) => [
      r.code,
      r.customer,
      r.invoice,
      r.method,
      r.date,
      formatRupiah(r.amount),
    ]),
    foot: [[
      "",
      "",
      "",
      "TOTAL",
      formatRupiah(totalSukses),
      `${rows.filter((r) => r.status === "Sukses").length} sukses`,
    ]],
    theme: "striped",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: "bold", halign: "center" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    footStyles: { fillColor: [209, 250, 229], textColor: [6, 95, 70], fontStyle: "bold", fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 24 },
      2: { cellWidth: 24, textColor: [100, 116, 139] },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 28 },
      5: { halign: "right", fontStyle: "bold" },
    },
  })

  /* ---------- Footer di semua halaman ---------- */
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const h = doc.internal.pageSize.getHeight()
    doc.setDrawColor(226, 232, 240)
    doc.line(7, h - 10, pageWidth - 7, h - 10)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text("Dicetak dari Fastify Billing", 7, h - 6)
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 7, h - 6, { align: "right" })
  }

  doc.save(`${meta.fileName}-${fileTimestamp()}.pdf`)
}
