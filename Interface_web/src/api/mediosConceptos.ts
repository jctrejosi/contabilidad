/** Definición de un concepto dentro de un formato de medios magnéticos. */
export interface MedioConcepto {
  formato: string;
  codigo: string;
  nombre: string;
  monto: number;
  valor1: boolean;
  valor2: boolean;
  combos: string[];
}

export const OPCIONES_COLUMNA = [
  'No Reporta', 'Cero', 'Blanco',
  ...Array.from({ length: 11 }, (_, index) => `Valor ${index + 1}`),
  'Informacion Tercero',
];

async function leer<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null) as (T & { detail?: unknown }) | null;
  if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : 'No fue posible completar la operación.');
  return body as T;
}

function ruta(cia: string, formato: string, codigo?: string) {
  return `/api/medios/formatos/${encodeURIComponent(formato)}/conceptos${codigo ? `/${encodeURIComponent(codigo)}` : ''}?${new URLSearchParams({ cia })}`;
}

export async function listarMedioConceptos(cia: string, formato: string): Promise<MedioConcepto[]> {
  const response = await fetch(ruta(cia, formato));
  return (await leer<{ items: MedioConcepto[] }>(response)).items;
}

export async function guardarMedioConcepto(cia: string, item: MedioConcepto, original?: string): Promise<void> {
  const response = await fetch(ruta(cia, item.formato, original), {
    method: original ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo: item.codigo, nombre: item.nombre, monto: item.monto,
      valor1: item.valor1, valor2: item.valor2, combos: item.combos, usuario: 'WEB' }),
  });
  await leer(response);
}

export async function eliminarMedioConcepto(cia: string, formato: string, codigo: string): Promise<void> {
  const response = await fetch(ruta(cia, formato, codigo) + '&usuario=WEB', { method: 'DELETE' });
  await leer(response);
}
