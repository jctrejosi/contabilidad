/** Informes de solo lectura que el backend genera desde Advantage. */
export interface FiltrosInformeAdicional {
  cia: string;
  anio: number;
  mesDesde: number;
  mesHasta: number;
  cuentaDesde?: string;
  cuentaHasta?: string;
  nit?: string;
  centro?: string;
  comprobante?: string;
  comprobanteHasta?: string;
  tipoDocumento?: string;
  tipoDocumentoHasta?: string;
  documentoDesde?: string;
  documentoHasta?: string;
  buscar?: string;
  nivel?: number;
  incluirCeros?: boolean;
}

export interface InformeAdicional {
  id: string;
  compania: { codigo: string; nombre: string; nit: string };
  anio: number;
  mesDesde: number;
  mesHasta: number;
  columnas: Array<{ label: string; money: boolean }>;
  filas: Array<Array<string | number>>;
  totales?: Array<string | number>;
  count: number;
  source: string;
  nota: string;
}

function query(f: FiltrosInformeAdicional): URLSearchParams {
  const params = new URLSearchParams({
    cia: f.cia,
    anio: String(f.anio),
    mesDesde: String(f.mesDesde),
    mesHasta: String(f.mesHasta),
    nivel: String(f.nivel ?? 6),
    incluirCeros: String(f.incluirCeros ?? false),
  });
  for (const [key, value] of Object.entries(f)) {
    if (!(key in { cia: 1, anio: 1, mesDesde: 1, mesHasta: 1, nivel: 1, incluirCeros: 1 }) && value) {
      params.set(key, String(value));
    }
  }
  return params;
}

export async function consultarInformeAdicional(id: string, filtros: FiltrosInformeAdicional): Promise<InformeAdicional> {
  const response = await fetch(`/api/informes/adicionales/${encodeURIComponent(id)}?${query(filtros)}`);
  const body = await response.json().catch(() => null) as InformeAdicional | { detail?: string } | null;
  if (!response.ok || !body || !('filas' in body)) {
    throw new Error(body && 'detail' in body ? body.detail : 'No fue posible generar el informe.');
  }
  return body;
}

export async function exportarInformeAdicional(id: string, filtros: FiltrosInformeAdicional, formato: 'pdf' | 'xlsx' | 'csv'): Promise<void> {
  const params = query(filtros);
  params.set('formato', formato);
  const response = await fetch(`/api/informes/adicionales/${encodeURIComponent(id)}/exportar?${params}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail || 'No fue posible exportar el informe.');
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${id}_${filtros.anio}.${formato}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
