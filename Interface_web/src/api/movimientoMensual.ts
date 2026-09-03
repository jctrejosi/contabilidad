/** Fila contable entregada directamente por MOV01. */
export interface MovimientoMensualReal {
  periodo: string;
  fecha: string;
  cuenta: string;
  nit: string;
  nitMovimiento: string;
  nitTercero: string;
  comprobante: string;
  centro: string;
  tipoDoc: string;
  documento: string;
  docAfectado: string;
  concepto: string;
  debito: number;
  credito: number;
  valor: number;
  base: number;
  claseFiscal: string;
  saldo: number;
  secuencia: number;
  usuario: string;
}

export interface FiltrosMovimientoMensual {
  cia: string;
  anio: number;
  mes: number;
  page: number;
  pageSize?: number;
  cuentaDesde?: string;
  cuentaHasta?: string;
  tercero?: string;
  comprobante?: string;
  centro?: string;
  documento?: string;
}

export interface MovimientoMensualResponse {
  items: MovimientoMensualReal[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  pageDebit: number;
  pageCredit: number;
  source: 'MOV01';
  sharedAcrossCompanies: false;
}

/**
 * Consulta MOV01 bajo demanda. Esta función no se ejecuta al abrir la pantalla;
 * la página la llama exclusivamente al pulsar Consultar o cambiar de página.
 */
export async function consultarMovimientoMensual(
  filtros: FiltrosMovimientoMensual,
): Promise<MovimientoMensualResponse> {
  const params = new URLSearchParams({
    cia: filtros.cia,
    anio: String(filtros.anio),
    mes: String(filtros.mes),
    page: String(filtros.page),
    pageSize: String(filtros.pageSize ?? 100),
  });
  const opcionales: Array<[string, string | undefined]> = [
    ['cuentaDesde', filtros.cuentaDesde],
    ['cuentaHasta', filtros.cuentaHasta],
    ['tercero', filtros.tercero],
    ['comprobante', filtros.comprobante],
    ['centro', filtros.centro],
    ['documento', filtros.documento],
  ];
  opcionales.forEach(([nombre, valor]) => {
    if (valor?.trim()) params.set(nombre, valor.trim());
  });

  const response = await fetch(`/api/movimiento-mensual?${params.toString()}`);
  const body = await response.json().catch(() => null) as MovimientoMensualResponse | { detail?: string } | null;
  if (!response.ok) {
    throw new Error(body && 'detail' in body ? body.detail : 'No fue posible consultar MOV01.');
  }
  return body as MovimientoMensualResponse;
}
