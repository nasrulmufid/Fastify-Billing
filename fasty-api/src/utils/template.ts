/**
 * Isi placeholder {key} pada template dengan nilai dari vars.
 * Key yang tidak ada di vars akan diganti string kosong.
 */
export function fillPlaceholders(body: string, vars: Record<string, string>): string {
  return body.replace(/\{(\w+)\}/g, (_m, key) => vars[key] ?? "")
}
