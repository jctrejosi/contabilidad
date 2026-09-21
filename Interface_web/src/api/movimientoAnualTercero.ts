import type { MovimientoMensualReal } from './movimientoMensual';

export interface MesMovimientoAnualTercero {
  mes: number;
  debito: number;
  credito: number;
  saldoMes: number;
  saldoAcumulado: number;
}

export interface MovimientoTerceroReal extends MovimientoMensualReal { nombreCuenta: string }

export interface MovimientoAnualTerceroResponse {
  nit: string;
  digito: string;
  nombre: string;
  activo: boolean;
  anio: number;
  cuentaDesde: string;
  cuentaHasta: string;
  saldoInicial: number;
  meses: MesMovimientoAnualTercero[];
  totalDebito: number;
  totalCredito: number;
  saldoFinal: number;
}

export interface DetalleAnualTerceroResponse {
  items: MovimientoTerceroReal[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

type Filters = { cia: string; anio: number; tercero: string; cuentaDesde?: string; cuentaHasta?: string };

function query(filters: Filters): URLSearchParams {
  const params = new URLSearchParams({ cia: filters.cia, anio: String(filters.anio), tercero: filters.tercero });
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

export function consultarMovimientoAnualTercero(filters: Filters): Promise<MovimientoAnualTerceroResponse> {
  return get(`/api/consultas/movimiento-anual-tercero?${query(filters)}`, 'No fue posible consultar el movimiento anual del tercero.');
}

export function consultarDetalleAnualTercero(filters: Filters & { mes: number; page?: number; pageSize?: number }): Promise<DetalleAnualTerceroResponse> {
  const params = query(filters);
  params.set('mes', String(filters.mes));
  params.set('page', String(filters.page ?? 1));
  params.set('pageSize', String(filters.pageSize ?? 100));
  return get(`/api/consultas/movimiento-anual-tercero/detalle?${params}`, 'No fue posible consultar el detalle mensual del tercero.');
}
