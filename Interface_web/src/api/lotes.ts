export interface LoteReal {
  id: number;
  lote: string;
  nombre: string;
  mes: string;
  estadoCodigo: string;
  estado: string;
  usuarioInicial: string;
  usuarioFinal: string;
  fecha: string;
  hora: string;
  historico: string;
  permiteBorrar: string;
  debito: number;
  credito: number;
  diferencia: number;
  items: number;
  archivoOk: string;
}

export interface LineaLoteReal {
  id: number;
  cuenta: string;
  nombreCuenta: string;
  nit: string;
  nitMovimiento: string;
  debito: number;
  credito: number;
  base: number;
  centro: string;
  concepto: string;
  comprobante: string;
  tipoDocumento: string;
  fecha: string;
  documento: string;
  inconsistencia: string;
  documentoAfectado: string;
}

export interface LotesResponse {
  items: LoteReal[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  source: 'CONMOVI';
  sharedAcrossCompanies: false;
}

export interface DetalleLoteResponse {
  items: LineaLoteReal[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  pageDebit: number;
  pageCredit: number;
  source: 'CONLOTES';
  sharedAcrossCompanies: false;
}

async function responseOrError<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => null) as T | { detail?: string } | null;
  if (!response.ok) {
    throw new Error(body && 'detail' in body ? body.detail : fallback);
  }
  return body as T;
}

/** Lee únicamente los registros CONMOVI de la compañía seleccionada. */
export function consultarLotes(cia: string, page = 1): Promise<LotesResponse> {
  const params = new URLSearchParams({ cia, page: String(page), pageSize: '100' });
  return fetch(`/api/lotes?${params.toString()}`)
    .then(response => responseOrError<LotesResponse>(response, 'No fue posible consultar CONMOVI.'));
}

/** Relaciona el lote seleccionado con CONLOTES mediante CIA + LOTE. */
export function consultarDetalleLote(cia: string, lote: string, page = 1): Promise<DetalleLoteResponse> {
  const params = new URLSearchParams({ cia, lote, page: String(page), pageSize: '200' });
  return fetch(`/api/lotes/detalle?${params.toString()}`)
    .then(response => responseOrError<DetalleLoteResponse>(response, 'No fue posible consultar CONLOTES.'));
}
