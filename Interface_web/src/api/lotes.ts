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

export interface LoteWrite {
  lote: string;
  nombre: string;
  mes: string;
  usuario: string;
}

export interface LineaLoteWrite {
  cuenta: string;
  nit: string;
  centro: string;
  comprobante: string;
  tipoDocumento: string;
  documento: string;
  documentoAfectado: string;
  fecha: string;
  debito: number;
  credito: number;
  base: number;
  concepto: string;
}

export interface ErrorVerificacionLote {
  categoria: string;
  lineaId: number | null;
  documento: string;
  mensaje: string;
}

export interface VerificacionLote {
  lote: string;
  valido: boolean;
  estado: 'Verificado' | 'Con errores';
  items: number;
  documentos: number;
  documentosDuplicados: number;
  debito: number;
  credito: number;
  diferencia: number;
  errores: ErrorVerificacionLote[];
}

export interface ActualizacionLote {
  lote: string;
  estado: string;
  documentos: number;
  partidas: number;
  debito: number;
  credito: number;
  dryRun: boolean;
  advertencias: string[];
}

async function responseOrError<T extends object>(response: Response, fallback: string): Promise<T> {
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
    .then(response => responseOrError<LotesResponse>(response, 'No fue posible consultar los lotes.'));
}

/** Relaciona el lote seleccionado con CONLOTES mediante CIA + LOTE. */
export function consultarDetalleLote(cia: string, lote: string, page = 1): Promise<DetalleLoteResponse> {
  const params = new URLSearchParams({ cia, lote, page: String(page), pageSize: '200' });
  return fetch(`/api/lotes/detalle?${params.toString()}`)
    .then(response => responseOrError<DetalleLoteResponse>(response, 'No fue posible consultar los movimientos del lote.'));
}

/** Crea la cabecera vacía en CONMOVI; las partidas se agregan después. */
export function crearLote(cia: string, payload: LoteWrite): Promise<{ item: LoteReal }> {
  return fetch(`/api/lotes?${new URLSearchParams({ cia }).toString()}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }).then(response => responseOrError(response, 'No fue posible crear el lote.'));
}

export function modificarLote(cia: string, lote: string, payload: LoteWrite): Promise<{ item: LoteReal }> {
  return fetch(`/api/lotes/${encodeURIComponent(lote)}?${new URLSearchParams({ cia }).toString()}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }).then(response => responseOrError(response, 'No fue posible modificar el lote.'));
}

export function guardarLineaLote(
  cia: string, lote: string, payload: LineaLoteWrite, id?: number,
): Promise<{ item: LineaLoteReal }> {
  const suffix = id ? `/${id}` : '';
  return fetch(`/api/lotes/${encodeURIComponent(lote)}/detalle${suffix}?${new URLSearchParams({ cia }).toString()}`, {
    method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }).then(response => responseOrError(response, 'No fue posible guardar la partida.'));
}

export async function eliminarLineaLote(cia: string, lote: string, id: number): Promise<void> {
  const response = await fetch(`/api/lotes/${encodeURIComponent(lote)}/detalle/${id}?${new URLSearchParams({ cia }).toString()}`, { method: 'DELETE' });
  if (!response.ok) await responseOrError(response, 'No fue posible eliminar la partida.');
}

export function verificarLote(cia: string, lote: string): Promise<{ item: VerificacionLote }> {
  return fetch(`/api/lotes/${encodeURIComponent(lote)}/verificar?${new URLSearchParams({ cia }).toString()}`, {
    method: 'POST',
  }).then(response => responseOrError(response, 'No fue posible verificar el lote.'));
}

export function actualizarLote(
  cia: string, lote: string, usuario: string, dryRun = false,
): Promise<{ item: ActualizacionLote }> {
  const query = new URLSearchParams({ cia, dryRun: String(dryRun) });
  return fetch(`/api/lotes/${encodeURIComponent(lote)}/actualizar?${query.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario }),
  }).then(response => responseOrError(response, 'No fue posible actualizar el lote.'));
}

export function eliminarLote(
  cia: string, lote: string, force = false,
): Promise<{ item: { lote: string; partidasEliminadas: number; eliminado: boolean } }> {
  const query = new URLSearchParams({ cia, force: String(force) });
  return fetch(`/api/lotes/${encodeURIComponent(lote)}?${query.toString()}`, { method: 'DELETE' })
    .then(response => responseOrError(response, 'No fue posible eliminar el lote.'));
}
