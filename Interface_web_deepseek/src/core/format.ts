/* Utilidades de formato — COP, NIT, fechas, números */

const copFmt = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const copFmt0 = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** 1234567.8 -> "1.234.567,80" */
export function money(v: number | null | undefined, decimals = true): string {
  if (v === null || v === undefined || Number.isNaN(v)) return ''
  const neg = v < 0
  const abs = Math.abs(v)
  const s = decimals ? copFmt.format(abs) : copFmt0.format(abs)
  return neg ? `-${s}` : s
}

/** Con signo y color listo para render: "COP 1.234.567,80" */
export function cop(v: number): string {
  return money(v)
}

/** Fecha ISO '2026-02-14' -> "14/02/2026" */
export function fecha(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Fecha y hora ISO -> "14/02/2026 09:32" */
export function fechaHora(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`
}

export function nowISO(): string {
  return new Date().toISOString()
}

/** NIT 900123456 -> "900.123.456" */
export function nitFmt(nit: string): string {
  if (!nit) return ''
  const clean = nit.replace(/\D/g, '')
  if (clean.length <= 3) return clean
  const rest = clean.slice(3)
  const groups = rest.match(/.{1,3}/g) ?? []
  return `${clean.slice(0, 3)}.${groups.join('.')}`
}

export function nombreMes(n: number): string {
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ]
  return meses[n - 1] ?? `Mes ${n}`
}

/** Suma con precisión de 2 decimales */
export function sum(vals: number[]): number {
  return Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** ID único corto */
let seq = 0
export function uid(prefix = 'id'): string {
  seq += 1
  return `${prefix}-${Date.now().toString(36)}-${seq}`
}

export function formatNumber(v: number): string {
  return copFmt0.format(v)
}
