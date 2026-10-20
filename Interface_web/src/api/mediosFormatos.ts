/** Contrato del mantenimiento de formatos de medios magnéticos. */
export interface MedioFormato {
  codigo: string; nombre: string; elemento: string;
  concepto: boolean; tipodoc: boolean; nit: boolean; digito: boolean;
  nombreCampo: boolean; direccion: boolean; municipio: boolean; pais: boolean;
  valor1: boolean; valor2: boolean;
}

async function leer<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null) as (T & { detail?: unknown }) | null;
  if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : 'No fue posible completar la operación.');
  return body as T;
}

export async function listarMedioFormatos(cia: string): Promise<MedioFormato[]> {
  const response = await fetch(`/api/medios/formatos?${new URLSearchParams({ cia })}`);
  return (await leer<{ items: MedioFormato[] }>(response)).items;
}

export async function guardarMedioFormato(cia: string, formato: MedioFormato, original?: string): Promise<void> {
  const path = original ? `/${encodeURIComponent(original)}` : '';
  const response = await fetch(`/api/medios/formatos${path}?${new URLSearchParams({ cia })}`, {
    method: original ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      codigo: formato.codigo, nombre: formato.nombre, elemento: formato.elemento,
      concepto: formato.concepto, tipodoc: formato.tipodoc, nit: formato.nit,
      digito: formato.digito, nombreCampo: formato.nombreCampo, direccion: formato.direccion,
      municipio: formato.municipio, pais: formato.pais, usuario: 'WEB',
    }),
  });
  await leer(response);
}

export async function eliminarMedioFormato(cia: string, codigo: string): Promise<void> {
  const response = await fetch(`/api/medios/formatos/${encodeURIComponent(codigo)}?${new URLSearchParams({ cia, usuario: 'WEB' })}`, { method: 'DELETE' });
  await leer(response);
}
