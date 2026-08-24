/**
 * Util nomor WhatsApp — normalisasi ke format 62 (persis logika frontend).
 * "0815-1111-2222" -> "628151112222"
 */

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("62")) return digits
  return "62" + digits.replace(/^0/, "")
}
