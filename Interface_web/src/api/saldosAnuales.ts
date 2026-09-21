export type FiltroSaldosAnuales = 'generales' | 'todos' | 'retenciones' | 'iva';

export interface MesComportamiento {
  mes: number;
  debito: number;
  credito: number;
  saldo: number;
}

export interface SaldoAnual {
  cuenta: string;
  nombre: string;
  nit: string;
  tipo: 'cuenta' | 'tercero';
  tipoFiscal: 'O' | 'R' | 'I';
  saldoAnterior: number;
  debito: number;
  credito: number;
  saldo: number;
  saldoInicial: number;
  meses: MesComportamiento[];
  saldoFinal: number;
}

export interface SaldosAnualesResponse {
  items: SaldoAnual[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  anio: number;
  mes: number;
  filtro: FiltroSaldosAnuales;
  busquedaCuenta: string;
  totalesPagina: { saldoAnterior: number; debito: number; credito: number; saldo: number };
}

export async function consultarSaldosAnuales(filtros: {
  cia: string; anio: number; mes: number; filtro: FiltroSaldosAnuales; cuenta?: string; page: number; pageSize?: number;
}): Promise<SaldosAnualesResponse> {
  const params = new URLSearchParams({
    cia: filtros.cia, anio: String(filtros.anio), mes: String(filtros.mes),
    filtro: filtros.filtro, page: String(filtros.page), pageSize: String(filtros.pageSize ?? 100),
  });
  if (filtros.cuenta?.trim()) params.set('cuenta', filtros.cuenta.trim());
  const response = await fetch(`/api/consultas/saldos-anuales?${params}`);
  const body = await response.json().catch(() => null) as SaldosAnualesResponse | { detail?: string } | null;
  if (!response.ok || !body || !('items' in body)) {
    throw new Error(body && 'detail' in body ? body.detail : 'No fue posible consultar los saldos anuales.');
  }
  return body;
}
