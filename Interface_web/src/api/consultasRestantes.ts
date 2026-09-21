import type { MovimientoMensualReal, MovimientoMensualResponse } from './movimientoMensual';

async function get<T extends object>(path: string, fallback: string): Promise<T> {
  const response = await fetch(path); const body = await response.json().catch(() => null) as T | { detail?: string } | null;
  if (!response.ok || !body) throw new Error(body && 'detail' in body ? body.detail : fallback);
  return body as T;
}

export interface SaldoCuentaCentroCuenta { cuenta: string; nombre: string; manejaCentro: boolean; saldoAnterior: number; debito: number; credito: number; saldo: number }
export interface SaldoCuentaCentroCentro { centro: string; nombre: string; saldoAnterior: number; debito: number; credito: number; saldo: number }
export function consultarCuentasCentro(f: { cia: string; anio: number; mes: number; buscar: string; page: number }) {
  const q = new URLSearchParams({ cia: f.cia, anio: String(f.anio), mes: String(f.mes), buscar: f.buscar, page: String(f.page), pageSize: '100' });
  return get<{ items: SaldoCuentaCentroCuenta[]; page: number; hasMore: boolean }>(`/api/consultas/saldos-cuenta-centro/cuentas?${q}`, 'No fue posible consultar los saldos.');
}
export function consultarCentrosCuenta(f: { cia: string; anio: number; mes: number; cuenta: string }) {
  const q = new URLSearchParams({ ...f, anio: String(f.anio), mes: String(f.mes) });
  return get<{ items: SaldoCuentaCentroCentro[] }>(`/api/consultas/saldos-cuenta-centro/centros?${q}`, 'No fue posible consultar los centros.');
}
export function consultarDetalleCuentaCentro(f: { cia: string; anio: number; mes: number; cuenta: string; centro: string }) {
  const q = new URLSearchParams({ ...f, anio: String(f.anio), mes: String(f.mes), page: '1', pageSize: '200' });
  return get<MovimientoMensualResponse>(`/api/consultas/saldos-cuenta-centro/detalle?${q}`, 'No fue posible consultar el detalle.');
}

export interface DocumentoEspecificoResponse { items: Array<MovimientoMensualReal & { nombreCuenta: string }>; count: number; debito: number; credito: number; diferencia: number; cabecera?: { comprobante: string; fecha: string; tipoDocumento: string; documento: string; documentoAfectado: string; concepto: string } }
export function consultarDocumentoEspecifico(f: { cia: string; anio: number; mes: number; tipoDocumento: string; documento: string; buscarPor: 'propio' | 'afectado' }) {
  const q = new URLSearchParams({ ...f, anio: String(f.anio), mes: String(f.mes) });
  return get<DocumentoEspecificoResponse>(`/api/consultas/documento-especifico?${q}`, 'No fue posible consultar el documento.');
}

export type TipoComparativo = 'companias' | 'centros' | 'meses';
export type ModoComparativo = 'saldo' | 'movimiento';
export interface FilaComparativoReal { clave: string; nombre: string; valorA: number; valorB: number; diferencia: number; porcentaje: number }
export interface ComparativoResponse { items: FilaComparativoReal[]; page: number; pageSize: number; hasMore: boolean; tipo: TipoComparativo; modo: ModoComparativo; anio: number; mesA: number; mesB: number; ciaA: string; ciaB: string }
export function consultarComparativo(f: { tipo: TipoComparativo; cia: string; anio: number; mesA: number; ciaB?: string; mesB?: number; modo: ModoComparativo; cuentaDesde?: string; cuentaHasta?: string; nitDesde?: string; nitHasta?: string; centroDesde?: string; centroHasta?: string; buscar?: string; page: number }) {
  const q = new URLSearchParams({ tipo: f.tipo, cia: f.cia, anio: String(f.anio), mesA: String(f.mesA), modo: f.modo, page: String(f.page), pageSize: '100' });
  Object.entries(f).forEach(([key, value]) => { if (!['tipo', 'cia', 'anio', 'mesA', 'modo', 'page'].includes(key) && value !== undefined && value !== '') q.set(key, String(value)); });
  return get<ComparativoResponse>(`/api/consultas/comparativos?${q}`, 'No fue posible generar el comparativo.');
}
