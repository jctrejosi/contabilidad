import type { MovimientoMensualReal } from './movimientoMensual';

export interface MesMovimientoAnual {
  mes: number;
  debito: number;
  credito: number;
  saldoMes: number;
  saldoAcumulado: number;
}

export interface MovimientoAnualCuentaResponse {
  cuenta: string;
  nombre: string;
  requiereTercero: boolean;
  tipoFiscal: string;
  anio: number;
  nitDesde: string;
  nitHasta: string;
  saldoInicial: number;
  meses: MesMovimientoAnual[];
  totalDebito: number;
  totalCredito: number;
  saldoFinal: number;
}

export interface DetalleAnualCuentaResponse {
  items: MovimientoMensualReal[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

type Filters = { cia: string; anio: number; cuenta: string; nitDesde?: string; nitHasta?: string };

async function get<T extends object>(path: string, message: string): Promise<T> {
  const response = await fetch(path);
  const body = await response.json().catch(() => null) as T | { detail?: string } | null;
  if (!response.ok || !body) throw new Error(body && 'detail' in body ? body.detail : message);
  return body as T;
}

function query(filters: Filters): URLSearchParams {
  const params = new URLSearchParams({ cia: filters.cia, anio: String(filters.anio), cuenta: filters.cuenta });
  if (filters.nitDesde?.trim()) params.set('nitDesde', filters.nitDesde.trim());
  if (filters.nitHasta?.trim()) params.set('nitHasta', filters.nitHasta.trim());
  return params;
}

export function consultarMovimientoAnualCuenta(filters: Filters): Promise<MovimientoAnualCuentaResponse> {
  return get(`/api/consultas/movimiento-anual-cuenta?${query(filters)}`, 'No fue posible consultar el movimiento anual.');
}

export function consultarDetalleAnualCuenta(filters: Filters & { mes: number; page?: number; pageSize?: number }): Promise<DetalleAnualCuentaResponse> {
  const params = query(filters);
  params.set('mes', String(filters.mes));
  params.set('page', String(filters.page ?? 1));
  params.set('pageSize', String(filters.pageSize ?? 100));
  return get(`/api/consultas/movimiento-anual-cuenta/detalle?${params}`, 'No fue posible consultar el detalle del mes.');
}
