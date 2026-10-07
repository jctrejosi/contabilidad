/** Informes de solo lectura que el backend genera desde Advantage. */
export interface FiltrosInformeAdicional {
  cia: string;
  anio: number;
  mesDesde: number;
  mesHasta: number;
  cuentaDesde?: string;
  cuentaHasta?: string;
  nit?: string;
  nitDesde?: string;
  nitHasta?: string;
  ordenTerceros?: 'cuenta' | 'tercero';
  ordenMovimiento?: 'documento' | 'fecha';
  centro?: string;
  comprobante?: string;
  comprobanteHasta?: string;
  tipoDocumento?: string;
  tipoDocumentoHasta?: string;
  documentoDesde?: string;
  documentoHasta?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  modalidad?: 'detallado' | 'resumido';
  documentoAfectado?: string;
  buscar?: string;
  nivel?: number;
  incluirCeros?: boolean;
  incluirResultados?: boolean;
  incluirTerceros?: boolean;
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
  tipos?: string[];
  fechaDesde?: string;
  fechaHasta?: string;
  /** Identificador temporal del libro calculado para paginar y exportar sin repetir la consulta. */
  snapshotId?: string;
}

export interface MovimientoAnualTercero {
  cuenta: string;
  nombreCuenta: string;
  tercero: string;
  nombreTercero: string;
  saldoInicial: number;
  meses: Array<{ mes: number; debito: number; credito: number; saldo: number }>;
  saldoFinal: number;
}

export async function consultarMovimientoAnualTercero(cia: string, anio: number, cuenta: string, nit: string): Promise<MovimientoAnualTercero> {
  const params = new URLSearchParams({ cia, anio: String(anio), cuenta, nit });
  const response = await fetch(`/api/informes/terceros/anual?${params}`);
  const body = await response.json().catch(() => null) as MovimientoAnualTercero | { detail?: string } | null;
  if (!response.ok || !body || !('meses' in body)) {
    throw new Error(body && 'detail' in body ? body.detail : 'No fue posible consultar el movimiento anual.');
  }
  return body;
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
    if (!(key in { cia: 1, anio: 1, mesDesde: 1, mesHasta: 1, nivel: 1, incluirCeros: 1 }) &&
        (value || (typeof value === 'boolean' && key === 'incluirResultados'))) {
      params.set(key, String(value));
    }
  }
  return params;
}

export async function consultarInformeAdicional(id: string, filtros: FiltrosInformeAdicional): Promise<InformeAdicional> {
  const params = query(filtros);
  if (['aux-gral', 'aux-doc-afectado', 'tercero-general', 'tercero-cuenta-tercero'].includes(id)) params.set('vistaPaginada', 'true');
  const response = await fetch(`/api/informes/adicionales/${encodeURIComponent(id)}?${params}`);
  const body = await response.json().catch(() => null) as InformeAdicional | { detail?: string } | null;
  if (!response.ok || !body || !('filas' in body)) {
    throw new Error(body && 'detail' in body ? body.detail : 'No fue posible generar el informe.');
  }
  return body;
}

/** Rehace, por compañía y meses, los acumulados que el informe de IVA consulta. */
export async function procesarAcumulacionIva(filtros: FiltrosInformeAdicional): Promise<InformeAdicional> {
  const params = new URLSearchParams({
    cia: filtros.cia, anio: String(filtros.anio),
    mesDesde: String(filtros.mesDesde), mesHasta: String(filtros.mesHasta),
  });
  const response = await fetch(`/api/informes/iva-acumulacion?${params}`, { method: 'POST' });
  const body = await response.json().catch(() => null) as InformeAdicional | { detail?: string } | null;
  if (!response.ok || !body || !('filas' in body)) {
    throw new Error(body && 'detail' in body ? body.detail : 'No fue posible acumular el IVA.');
  }
  return body;
}

/** INFOR05(1): reemplaza los meses elegidos en el acumulado de retenciones. */
export async function procesarAcumulacionRetenciones(filtros: FiltrosInformeAdicional): Promise<InformeAdicional> {
  const params = new URLSearchParams({
    cia: filtros.cia, anio: String(filtros.anio),
    mesDesde: String(filtros.mesDesde), mesHasta: String(filtros.mesHasta),
  });
  const response = await fetch(`/api/informes/retenciones-acumulacion?${params}`, { method: 'POST' });
  const body = await response.json().catch(() => null) as InformeAdicional | { detail?: string } | null;
  if (!response.ok || !body || !('filas' in body)) {
    throw new Error(body && 'detail' in body ? body.detail : 'No fue posible acumular las retenciones.');
  }
  return body;
}

export async function consultarPaginaInformeAdicional(id: string, snapshotId: string, pagina: number): Promise<InformeAdicional> {
  const response = await fetch(`/api/informes/adicionales/${encodeURIComponent(id)}/instantanea/${encodeURIComponent(snapshotId)}/pagina?pagina=${pagina}`);
  const body = await response.json().catch(() => null) as InformeAdicional | { detail?: string } | null;
  if (!response.ok || !body || !('filas' in body)) {
    throw new Error(body && 'detail' in body ? body.detail : 'No fue posible cargar la página del informe.');
  }
  return body;
}

export function urlImpresionInformeAdicional(id: string, snapshotId: string): string {
  return `/api/informes/adicionales/${encodeURIComponent(id)}/instantanea/${encodeURIComponent(snapshotId)}/exportar?formato=pdf&visualizar=true`;
}

export async function exportarInformeAdicional(id: string, filtros: FiltrosInformeAdicional, formato: 'pdf' | 'xlsx' | 'csv', snapshotId?: string): Promise<void> {
  const params = query(filtros);
  params.set('formato', formato);
  const path = snapshotId
    ? `/api/informes/adicionales/${encodeURIComponent(id)}/instantanea/${encodeURIComponent(snapshotId)}/exportar`
    : `/api/informes/adicionales/${encodeURIComponent(id)}/exportar`;
  const response = await fetch(`${path}?${params}`);
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
