export interface FiltrosBalanceComprobacion {
  cia: string;
  anio: number;
  mesDesde: number;
  mesHasta: number;
  nivel: 4 | 6 | 9 | 12;
  incluirCeros: boolean;
  incluirResultados: boolean;
  incluirTerceros: boolean;
  incluirCentros: boolean;
  detalleCuentaDesde: string;
  detalleCuentaHasta: string;
}

export interface CuentaBalanceComprobacion {
  tipo: 'seccion' | 'cuenta' | 'tercero' | 'centro' | 'resultado' | 'total-clase' | 'total-estado' | 'total-balance';
  seccion: 'resultados' | 'balance';
  cuenta: string;
  nit: string;
  nombre: string;
  nivel: number;
  saldoAnterior: number;
  debito: number;
  credito: number;
  saldoActual: number;
}

export interface BalanceComprobacion {
  compania: { codigo: string; nombre: string; nit: string };
  anio: number;
  mesDesde: number;
  mesHasta: number;
  periodo: string;
  nivel: number;
  nombreNivel: string;
  incluirCeros: boolean;
  incluirResultados: boolean;
  incluirTerceros: boolean;
  incluirCentros: boolean;
  items: CuentaBalanceComprobacion[];
  count: number;
  totales: { saldoAnterior: number; debito: number; credito: number; diferencia: number; saldoActual: number; pasivoPatrimonio: number; resultadoEjercicio: number };
  source: 'CONMAE';
}

function query(filtros: FiltrosBalanceComprobacion): URLSearchParams {
  return new URLSearchParams({
    cia: filtros.cia,
    anio: String(filtros.anio),
    mesDesde: String(filtros.mesDesde),
    mesHasta: String(filtros.mesHasta),
    nivel: String(filtros.nivel),
    incluirCeros: String(filtros.incluirCeros),
    incluirResultados: String(filtros.incluirResultados),
    incluirTerceros: String(filtros.incluirTerceros),
    incluirCentros: String(filtros.incluirCentros),
    detalleCuentaDesde: filtros.detalleCuentaDesde,
    detalleCuentaHasta: filtros.detalleCuentaHasta,
  });
}

/** Consulta los acumulados contables reales de CONMAE. */
export async function consultarBalanceComprobacion(
  filtros: FiltrosBalanceComprobacion,
): Promise<BalanceComprobacion> {
  const response = await fetch(`/api/informes/balance-comprobacion?${query(filtros)}`);
  const body = await response.json().catch(() => null) as BalanceComprobacion | { detail?: string } | null;
  if (!response.ok || !body || !('items' in body)) {
    throw new Error(body && 'detail' in body ? body.detail : 'No fue posible generar el balance de comprobación.');
  }
  return body;
}

/** Descarga exactamente los filtros del informe visible como Excel o PDF. */
export async function exportarBalanceComprobacion(
  filtros: FiltrosBalanceComprobacion,
  formato: 'xlsx' | 'pdf',
): Promise<void> {
  const params = query(filtros);
  params.set('formato', formato);
  const response = await fetch(`/api/informes/balance-comprobacion/exportar?${params}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail || `No fue posible exportar el informe en ${formato.toUpperCase()}.`);
  }
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] || `balance_comprobacion.${formato}`;
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
