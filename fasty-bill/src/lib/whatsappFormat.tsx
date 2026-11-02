import type { ReactNode } from "react"

/**
 * Render teks pesan WhatsApp ke elemen React dengan format WhatsApp:
 *   *tebal*        → <strong> (bold)
 *   _miring_       → <em> (italic)
 *   ~coret~        → <span> (strikethrough)
 *   `monospace`    → <code> (monospace)
 *   baris baru     → <br/>
 *
 * Fungsi ini hanya untuk pratinjau di UI. Backend mengirimkan teks mentah
 * ke gateway WhatsApp yang sudah mendukung format tersebut secara native.
 */

type Style = "bold" | "italic" | "strike" | "mono"

const FORMAT_RE = /(\*([^*]*)\*)|(_([^_]*)_)|(~([^~]*)~)|(`([^`]*)`)/g

function renderPlain(text: string, keyBase: string): ReactNode[] {
  if (text.length === 0) return []
  const lines = text.split("\n")
  const nodes: ReactNode[] = []
  lines.forEach((line, i) => {
    if (i > 0) nodes.push(<br key={`${keyBase}-br-${i}`} />)
    if (line.length > 0) nodes.push(<span key={`${keyBase}-t-${i}`}>{line}</span>)
  })
  return nodes
}

function renderStyled(style: Style, inner: string, key: string): ReactNode {
  if (!inner.trim()) return null
  // Don't recurse — just render inner as plain text (no nested formatting)
  switch (style) {
    case "bold":
      return (
        <strong key={key} className="font-semibold">
          {inner}
        </strong>
      )
    case "italic":
      return (
        <em key={key} className="italic">
          {inner}
        </em>
      )
    case "strike":
      return (
        <span key={key} className="line-through">
          {inner}
        </span>
      )
    case "mono":
      return (
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {inner}
        </code>
      )
  }
}

/** Konversi teks berformat WhatsApp menjadi array node React (untuk pratinjau). */
export function renderWhatsApp(text: string, keyPrefix = "wa"): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null

  FORMAT_RE.lastIndex = 0
  while ((match = FORMAT_RE.exec(text)) !== null) {
    // Add plain text before match
    if (match.index > lastIndex) {
      nodes.push(...renderPlain(text.slice(lastIndex, match.index), `${keyPrefix}-${key++}`))
    }

    const full = match[0] // Full match: *text*, _text_, etc
    const boldText = match[2] // Group 2: text inside *...*
    const italicText = match[4] // Group 4: text inside _..._
    const strikeText = match[6] // Group 6: text inside ~...~
    const monoText = match[8] // Group 8: text inside `...`

    const inner = boldText || italicText || strikeText || monoText
    
  if (inner && inner.trim()) {
      const style: Style = boldText ? "bold" : italicText ? "italic" : strikeText ? "strike" : "mono"
      const styled = renderStyled(style, inner, `${keyPrefix}-${key++}`)
      if (styled) nodes.push(styled)
    } else {
      // No valid inner text, render as-is (wrapped in span for consistent key)
      nodes.push(<span key={`${keyPrefix}-${key++}`}>{full}</span>)
    }

    lastIndex = match.index + full.length
  }

  // Add remaining plain text
  if (lastIndex < text.length) {
    nodes.push(...renderPlain(text.slice(lastIndex), `${keyPrefix}-${key++}`))
  }

  return nodes
}

/** Contoh format untuk ditampilkan sebagai panduan di UI. */
export const WHATSAPP_FORMAT_HINT = [
  ["*tebal*", "Teks tebal"],
  ["_miring_", "Teks miring"],
  ["~coret~", "Teks dicoret"],
  ["`kode`", "Teks monospace"],
  ["\\n (Enter)", "Baris baru / alinea"],
] as const
