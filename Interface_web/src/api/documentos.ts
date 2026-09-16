export interface DocumentoContable {
  id: number;
  fecha: string;
  comprobante: string;
  tipoDocumento: string;
  documento: string;
  documentoInterno: string;
  nit: string;
  tercero: string;
  detalle: string;
  valor: number;
  modulo: number;
  documentoAfectado: string;
}

export interface MovimientoDocumento {
  id: number;
  secuencia: number;
  cuenta: string;
  nombreCuenta: string;
  nit: string;
  centro: string;
  documentoAfectado: string;
  concepto: string;
  debito: number;
  credito: number;
  base: number;
  claseFiscal: string;
  usuario: string;
}

export interface FiltrosDocumentos {
  cia: string;
  page: number;
  pageSize?: number;
  periodo?: string;
  comprobante?: string;
  tipoDocumento?: string;
  nit?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  documento?: string;
}

export interface DocumentosResponse {
  items: DocumentoContable[];
  page: number;
  pageSize: number;
  hasMore: boolean;
  source: 'CONDOCUM';
  sharedAcrossCompanies: false;
}

export interface ResultadoAnulacion {
  documento: string;
  partidasRetiradas: number;
  totalDebito: number;
  totalCredito: number;
  cuentasRecalculadas: number;
  tercerosRecalculados: number;
  centrosRecalculados: number;
  dryRun: boolean;
  advertencia: string;
}

function optional(params: URLSearchParams, name: string, value?: string) {
  if (value?.trim()) params.set(name, value.trim());
}

/** Consulta CONDOCUM únicamente cuando la pantalla confirma los filtros. */
export async function consultarDocumentos(filtros: FiltrosDocumentos): Promise<DocumentosResponse> {
  const params = new URLSearchParams({
    cia: filtros.cia,
    page: String(filtros.page),
    pageSize: String(filtros.pageSize ?? 50),
  });
  optional(params, 'periodo', filtros.periodo);
  optional(params, 'comprobante', filtros.comprobante);
  optional(params, 'tipoDocumento', filtros.tipoDocumento);
  optional(params, 'nit', filtros.nit);
  optional(params, 'fechaDesde', filtros.fechaDesde);
  optional(params, 'fechaHasta', filtros.fechaHasta);
  optional(params, 'documento', filtros.documento);

  const response = await fetch(`/api/documentos?${params.toString()}`);
  const body = await response.json().catch(() => null) as DocumentosResponse | { detail?: string } | null;
  if (!response.ok) {
    throw new Error(body && 'detail' in body ? body.detail : 'No fue posible consultar CONDOCUM.');
  }
  return body as DocumentosResponse;
}

/** Lee MOV01 usando la clave completa de la cabecera seleccionada. */
export async function consultarDetalleDocumento(
  cia: string,
  documento: DocumentoContable,
): Promise<MovimientoDocumento[]> {
  const params = new URLSearchParams({
    cia,
    documento: documento.documento,
    comprobante: documento.comprobante,
    tipoDocumento: documento.tipoDocumento,
    fecha: documento.fecha,
  });
  const response = await fetch(`/api/documentos/detalle?${params.toString()}`);
  const body = await response.json().catch(() => null) as { items?: MovimientoDocumento[]; detail?: string } | null;
  if (!response.ok || !body?.items) {
    throw new Error(body?.detail || 'No fue posible consultar el detalle en MOV01.');
  }
  return body.items;
}

/** Retira un documento seleccionado y solicita el recálculo contable atómico. */
export async function anularDocumento(
  cia: string,
  documento: DocumentoContable,
  motivo: string,
  usuario = 'WEB',
): Promise<ResultadoAnulacion> {
  const response = await fetch('/api/documentos/anular', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cia,
      id: documento.id,
      documento: documento.documento,
      comprobante: documento.comprobante,
      tipoDocumento: documento.tipoDocumento,
      fecha: documento.fecha,
      usuario,
      motivo,
    }),
  });
  const body = await response.json().catch(() => null) as
    | { item?: ResultadoAnulacion; detail?: string }
    | null;
  if (!response.ok || !body?.item) {
    throw new Error(body?.detail || 'No fue posible completar la anulación.');
  }
  return body.item;
}
