import type { MovimientoMensualReal } from './movimientoMensual';

export interface MesMovimientoAnualCentro { mes: number; debito: number; credito: number; saldoMes: number; saldoAcumulado: number }
export interface MovimientoCentroReal extends MovimientoMensualReal { nombreCuenta: string }
export interface MovimientoAnualCentroResponse {
  centro: string; nombre: string; anio: number; cuentaDesde: string; cuentaHasta: string;
  saldoInicial: number; meses: MesMovimientoAnualCentro[]; totalDebito: number; totalCredito: number; saldoFinal: number;
}
export interface DetalleAnualCentroResponse { items: MovimientoCentroReal[]; page: number; pageSize: number; hasMore: boolean }
type Filters = { cia: string; anio: number; centro: string; cuentaDesde?: string; cuentaHasta?: string };

function query(filters: Filters): URLSearchParams {
  const params = new URLSearchParams({ cia: filters.cia, anio: String(filters.anio), centro: filters.centro });
  if (filters.cuentaDesde?.trim()) params.set('cuentaDesde', filters.cuentaDesde.trim());
  if (filters.cuentaHasta?.trim()) params.set('cuentaHasta', filters.cuentaHasta.trim());
  return params;
}
async function get<T extends object>(url: string, fallback: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json().catch(() => null) as T | { detail?: string } | null;
  if (!response.ok || !body) throw new Error(body && 'detail' in body ? body.detail : fallback);
  return body as T;
}
export function consultarMovimientoAnualCentro(filters: Filters): Promise<MovimientoAnualCentroResponse> {
  return get(`/api/consultas/movimiento-anual-centro?${query(filters)}`, 'No fue posible consultar el movimiento anual del centro.');
}
export function consultarDetalleAnualCentro(filters: Filters & { mes: number; page?: number; pageSize?: number }): Promise<DetalleAnualCentroResponse> {
  const params = query(filters); params.set('mes', String(filters.mes)); params.set('page', String(filters.page ?? 1)); params.set('pageSize', String(filters.pageSize ?? 100));
  return get(`/api/consultas/movimiento-anual-centro/detalle?${params}`, 'No fue posible consultar el detalle mensual del centro.');
}
