/** PLANTICO edita ocho posiciones dentro del tipo documental de VISDOCUM. */
export type PosicionPlantilla = { orden: number; concepto: string; cuentaDebito: string; cuentaCredito: string };
export type DocumentoPlantilla = { codigo: string; nombre: string; posiciones: PosicionPlantilla[] };

async function leer<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as (T & { detail?: unknown }) | null;
  if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : 'No fue posible completar la operación.');
  return body as T;
}

export async function listarDocumentosPlantilla(cia: string): Promise<DocumentoPlantilla[]> {
  const response = await fetch(`/api/plantillas-original?${new URLSearchParams({ cia })}`);
  return (await leer<{ items: DocumentoPlantilla[] }>(response)).items;
}

export async function guardarDocumentoPlantilla(cia: string, item: DocumentoPlantilla): Promise<DocumentoPlantilla> {
  const response = await fetch(`/api/plantillas-original/${encodeURIComponent(item.codigo)}?${new URLSearchParams({ cia })}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ posiciones: item.posiciones }),
  });
  return (await leer<{ item: DocumentoPlantilla }>(response)).item;
}
