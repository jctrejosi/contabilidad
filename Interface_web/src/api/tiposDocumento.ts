export interface TipoDocumentoReal {
  /** VISDOCUM no tiene ID; se utiliza su código global como clave estable. */
  id: string;
  codigo: string;
  nombre: string;
  modulo: number;
  nombreModulo: string;
  tipo: string;
  consecutivo: number;
  permiteModificarConsecutivo: boolean | null;
  prefijo: string;
  comprobante: string;
  contabiliza: boolean | null;
  generaCuentasPorPagar: boolean | null;
  afectaBancos: boolean | null;
  convierteDocumento: boolean | null;
  documentoConversion: string;
  formaPago: boolean | null;
  documentoOficial: boolean | null;
  modificaCostos: boolean | null;
  esTraslado: boolean | null;
  permiteRepetir: boolean | null;
  grabaSaldo: boolean | null;
  validaDian: boolean | null;
}

export interface TiposDocumentoResponse {
  items: TipoDocumentoReal[];
  count: number;
  source: 'VISDOCUM';
  sharedAcrossCompanies: true;
}

let requestInProgress: Promise<TiposDocumentoResponse> | null = null;

/** Consulta VISDOCUM sin CIA; el backend limita SUC a la sucursal 1. */
export function listarTiposDocumento(): Promise<TiposDocumentoResponse> {
  if (requestInProgress) return requestInProgress;
  requestInProgress = fetch('/api/tipos-documento')
    .then(async response => {
      const body = await response.json().catch(() => null) as TiposDocumentoResponse | { detail?: string } | null;
      if (!response.ok) {
        throw new Error(body && 'detail' in body ? body.detail : 'No fue posible consultar VISDOCUM.');
      }
      return body as TiposDocumentoResponse;
    })
    .finally(() => { requestInProgress = null; });
  return requestInProgress;
}
