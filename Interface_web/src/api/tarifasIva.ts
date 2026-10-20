/** CONTIIVA es global; la API expresa la tarifa como fracción (0.19 = 19 %). */
export interface TarifaIva { codigo: string; nombre: string; tarifa: number }

async function leer<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as (T & { detail?: unknown }) | null;
  if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : 'No fue posible completar la operación.');
  return body as T;
}

export async function listarTarifasIva(cia: string): Promise<TarifaIva[]> {
  const response = await fetch(`/api/tarifas-iva?${new URLSearchParams({ cia })}`);
  return (await leer<{ items: TarifaIva[] }>(response)).items;
}

export async function guardarTarifaIva(cia: string, item: TarifaIva, original?: string): Promise<TarifaIva> {
  const response = await fetch(`/api/tarifas-iva${original ? `/${encodeURIComponent(original)}` : ''}?${new URLSearchParams({ cia })}`, {
    method: original ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(original ? {} : { codigo: item.codigo }), nombre: item.nombre, tarifa: item.tarifa, usuario: 'WEB' }),
  });
  return (await leer<{ item: TarifaIva }>(response)).item;
}

export async function eliminarTarifaIva(cia: string, codigo: string, motivo: string): Promise<void> {
  const response = await fetch(`/api/tarifas-iva/${encodeURIComponent(codigo)}?${new URLSearchParams({ cia, motivo, usuario: 'WEB' })}`, { method: 'DELETE' });
  if (response.status !== 204) await leer(response);
}
