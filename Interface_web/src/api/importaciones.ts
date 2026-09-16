import type { ErrorVerificacionLote, LineaLoteWrite } from './lotes';

export type ValorArchivo = string | number | boolean | null;

export interface ArchivoImportado {
  archivo: string;
  hojas: string[];
  hoja: string;
  columnas: string[];
  filas: Record<string, ValorArchivo>[];
  truncado: boolean;
}

export interface ImportacionLotePayload {
  lote: string;
  nombre: string;
  mes: string;
  usuario: string;
  lineas: LineaLoteWrite[];
}

export interface ResultadoImportacion {
  lote: string;
  nombre: string;
  mes: string;
  valido: boolean;
  estado: string;
  creado: boolean;
  items: number;
  documentos: number;
  documentosDuplicados: number;
  debito: number;
  credito: number;
  diferencia: number;
  errores: ErrorVerificacionLote[];
}

async function responseOrError<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => null) as T | { detail?: string | unknown[] } | null;
  if (!response.ok) {
    const detail = body && 'detail' in body ? body.detail : null;
    if (typeof detail === 'string') throw new Error(detail);
    if (Array.isArray(detail)) {
      const messages = detail.map((raw): string => {
        if (!raw || typeof raw !== 'object') return '';
        const issue = raw as { loc?: unknown[]; msg?: unknown };
        const location = Array.isArray(issue.loc) ? issue.loc.filter(part => part !== 'body') : [];
        let label = location.map(part => String(part)).join(' / ');
        const lineIndex = location.findIndex(part => part === 'lineas');
        if (lineIndex >= 0 && typeof location[lineIndex + 1] === 'number') {
          const row = Number(location[lineIndex + 1]) + 2;
          const field = location[lineIndex + 2] ? ` / ${String(location[lineIndex + 2])}` : '';
          label = `Fila ${row}${field}`;
        }
        const message = typeof issue.msg === 'string' ? issue.msg : 'Valor inválido';
        return label ? `${label}: ${message}` : message;
      }).filter(Boolean);
      if (messages.length) throw new Error(messages.join(' · '));
    }
    throw new Error(fallback);
  }
  return body as T;
}

export async function leerArchivoImportacion(file: File, hoja = ''): Promise<ArchivoImportado> {
  const body = new FormData();
  body.append('archivo', file);
  const query = new URLSearchParams();
  if (hoja) query.set('hoja', hoja);
  const response = await fetch(`/api/importaciones/leer?${query.toString()}`, {
    method: 'POST', body,
  });
  const result = await responseOrError<{ item: ArchivoImportado }>(response, 'No fue posible leer el archivo.');
  return result.item;
}

export async function procesarImportacion(
  cia: string,
  payload: ImportacionLotePayload,
  dryRun: boolean,
): Promise<ResultadoImportacion> {
  const query = new URLSearchParams({ cia, dryRun: String(dryRun) });
  const response = await fetch(`/api/importaciones/lote?${query.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await responseOrError<{ item: ResultadoImportacion }>(
    response,
    dryRun ? 'No fue posible validar la importación.' : 'No fue posible crear el lote.',
  );
  return result.item;
}
