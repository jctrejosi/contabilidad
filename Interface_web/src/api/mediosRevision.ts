/** MEDMAG05 y sus acciones. Todas las rutas exigen la compañía y el formato. */
export interface RegistroMedio {
  id: string; revision: string; concepto: string; tercero: string; tercero2: string;
  nombre: string; digito: string; valores: number[]; sale: boolean;
}
export interface RevisionMedios {
  formato: string; nombre: string; items: RegistroMedio[]; totalValor1: number;
}
export interface GuardarMedio {
  id?: string; revision?: string; concepto: string; tercero: string; digito: string;
  valor1: number; valor2: number;
}
export interface CambioIdentificacion {
  token: string; cantidad: number; cambios: { anterior: string; nuevo: string; concepto: string }[];
  advertencia: string;
}
export type DetalleMedio = Record<string, string>;
function ruta(cia: string, formato: string, accion = '', extra: Record<string, string> = {}) {
  return `/api/medios/revision${accion}?${new URLSearchParams({ cia, formato, ...extra })}`;
}
async function leer<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : 'No fue posible completar la operación.');
  return body as T;
}
export async function consultarRevision(cia: string, formato: string) {
  return leer<RevisionMedios>(await fetch(ruta(cia, formato)));
}
export async function guardarRevision(cia: string, formato: string, payload: GuardarMedio) {
  return leer<{ mensaje: string; advertencia: string }>(await fetch(ruta(cia, formato, '/registro'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }));
}
export async function eliminarRevision(cia: string, formato: string, item: RegistroMedio) {
  return leer<{ mensaje: string; advertencia: string }>(await fetch(ruta(cia, formato, '/eliminar'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, revision: item.revision }),
  }));
}
export async function detalleRevision(cia: string, formato: string, item: RegistroMedio) {
  return leer<{ items: DetalleMedio[] }>(await fetch(ruta(cia, formato, '/detalle', { id: item.id, revision: item.revision })));
}
export async function identificarRevision(cia: string, formato: string, token = '') {
  return leer<CambioIdentificacion>(await fetch(ruta(cia, formato, '/identificaciones'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
  }));
}
export async function exportarRevision(cia: string, formato: string, modo: 'revision' | 'detalle' | 'archivo', salida: 'pdf' | 'xlsx', identificacion = 'codigo', item?: RegistroMedio) {
  const response = await fetch(ruta(cia, formato, '/exportar', {
    modo, salida, identificacion, ...(item ? { id: item.id, revision: item.revision } : {}),
  }));
  if (!response.ok) { await leer(response); return; }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url; link.download = `medios-${formato}-${modo}.${salida}`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
