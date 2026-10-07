/** Catálogo general de tipos de retención; la API expresa la tarifa como fracción. */
export interface TipoRetencion { codigo: string; nombre: string; tarifa: number }

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as T | { detail?: unknown } | null;
  if (!response.ok) {
    const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null;
    throw new Error(typeof detail === 'string' ? detail : 'No fue posible completar la operación.');
  }
  return body as T;
}

export async function listarTiposRetencion(cia: string): Promise<TipoRetencion[]> {
  const response = await fetch(`/api/conceptos-retencion?${new URLSearchParams({ cia })}`);
  return (await json<{ items: TipoRetencion[] }>(response)).items;
}

export async function guardarTipoRetencion(cia: string, item: TipoRetencion, original?: string): Promise<TipoRetencion> {
  const response = await fetch(`/api/conceptos-retencion${original ? `/${encodeURIComponent(original)}` : ''}?${new URLSearchParams({ cia })}`, {
    method: original ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(original ? {} : { codigo: item.codigo }), nombre: item.nombre, tarifa: item.tarifa, usuario: 'WEB' }),
  });
  return (await json<{ item: TipoRetencion }>(response)).item;
}

export async function eliminarTipoRetencion(cia: string, codigo: string, motivo: string): Promise<void> {
  const response = await fetch(`/api/conceptos-retencion/${encodeURIComponent(codigo)}?${new URLSearchParams({ cia, motivo, usuario: 'WEB' })}`, { method: 'DELETE' });
  if (response.status !== 204) await json(response);
}
