export type ModoExtraccion = 'comprobante' | 'documentos' | 'completo';

export interface SolicitudExtraccion {
  cia: string;
  anio: number;
  mes: number;
  modo: ModoExtraccion;
  lote: string;
  comprobante: string;
  tipoDocumento: string;
  documentoDesde: string;
  documentoHasta: string;
  huella?: string;
  usuario?: string;
  motivo?: string;
}

export interface ResumenExtraccion {
  compania: string;
  anio: number;
  mes: number;
  modo: ModoExtraccion;
  lote: string;
  partidas: number;
  documentos: number;
  debito: number;
  credito: number;
  diferencia: number;
  documentosDescuadrados: number;
  huella: string;
  advertencias: string[];
  estado?: string;
  advertenciaAuditoria?: string;
}

async function enviar(path: 'previa' | 'confirmar', request: SolicitudExtraccion): Promise<ResumenExtraccion> {
  const response = await fetch(`/api/especiales/extraccion/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request),
  });
  const body = await response.json().catch(() => null) as { item?: ResumenExtraccion; detail?: string } | null;
  if (!response.ok || !body?.item) throw new Error(body?.detail || 'No fue posible procesar la extracción.');
  return body.item;
}

export const previsualizarExtraccion = (request: SolicitudExtraccion) => enviar('previa', request);
export const confirmarExtraccion = (request: SolicitudExtraccion) => enviar('confirmar', request);
