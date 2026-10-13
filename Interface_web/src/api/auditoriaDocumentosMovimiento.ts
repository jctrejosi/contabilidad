export interface IncidenciaMovimiento {
  tipo: string;
  comprobante: string;
  tipoDocumento: string;
  documento: string;
  fecha: string;
  cuenta: string;
  tercero: string;
  centro: string;
  secuencia: string;
  mensaje: string;
  diferencia?: number;
}

export interface ResultadoAuditoriaMovimiento {
  compania: string;
  anio: number;
  mes: number;
  soloLectura: boolean;
  partidas: number;
  documentos: number;
  documentosDescuadrados: number;
  incidencias: IncidenciaMovimiento[];
  conteos: Record<string, number>;
}

export async function auditarDocumentosMovimiento(cia: string, anio: number, mes: number): Promise<ResultadoAuditoriaMovimiento> {
  const response = await fetch('/api/reprocesos/documentos-movimiento', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cia, anio, mes }),
  });
  const body = await response.json().catch(() => null) as { item?: ResultadoAuditoriaMovimiento; detail?: string } | null;
  if (!response.ok || !body?.item) throw new Error(body?.detail || 'No fue posible completar la auditoría.');
  return body.item;
}
