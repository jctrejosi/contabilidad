/** Convierte los formatos de fecha admitidos al contrato AAAA-MM-DD. */
export function normalizarFechaImportacion(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value).trim();
  if (!raw) return '';

  const build = (yearText: string, monthText: string, dayText: string): string => {
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() !== year
      || candidate.getUTCMonth() !== month - 1
      || candidate.getUTCDate() !== day
    ) return '';
    return `${yearText.padStart(4, '0')}-${monthText.padStart(2, '0')}-${dayText.padStart(2, '0')}`;
  };

  // Formato numérico utilizado por Advantage: AAAAMMDD, por ejemplo 20251201.
  const advantage = raw.match(/^(\d{4})(\d{2})(\d{2})(?:\.0+)?$/);
  if (advantage) return build(advantage[1], advantage[2], advantage[3]);

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return build(iso[1], iso[2], iso[3]);

  const local = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (local) return build(local[3], local[2], local[1]);

  // Excel almacena fechas como días transcurridos desde 1899-12-30.
  const serial = Number(raw);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    return new Date(Date.UTC(1899, 11, 30 + Math.floor(serial))).toISOString().slice(0, 10);
  }
  return '';
}

/**
 * Limpia espacios heredados de Excel/ADT sin alterar las palabras.
 * CONLOTES admite hasta 50 caracteres para el concepto, por lo que eliminar
 * relleno alrededor de nombres y comas evita rechazar textos que sí caben.
 */
export function normalizarConceptoImportacion(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\s\u00a0]+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .trim()
    .slice(0, 50);
}
