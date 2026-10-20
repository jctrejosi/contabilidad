/** MEDMAG03: asignaciones por cuenta y compañía; MEDMAG03T: copia de CONMAE. */
export interface CuentaMedios { codigo: string; nombre: string; tercero: boolean; ivaRet: string }
export interface AsignacionMedios {
  cuenta: string; formato: string; concepto: string; tipo: string; cuenta2: string;
  tipomed: number; pmed1: number; pmed2: number; pmed3: number;
  pmed4: number; pmed5: number; pmed6: number; formato2: string;
  concepto2: string; modcxp: number; colvalor: number; colbase: number;
  movtipo: number; columna2: number; docx: string; docx2: string;
  docx3: string; natural: boolean;
}
export interface VistaCopia {
  origen: string; destino: string; origenFilas: number;
  coincidentes: number; sinCorrespondencia: number;
}

async function leer<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null) as (T & { detail?: unknown }) | null;
  if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : 'No fue posible completar la operación.');
  return body as T;
}

const urlCuenta = (cia: string, cuenta: string) => `/api/medios/cuentas/${encodeURIComponent(cuenta)}/asignaciones?${new URLSearchParams({ cia })}`;

export async function listarCuentasMedios(cia: string): Promise<CuentaMedios[]> {
  return (await leer<{ items: CuentaMedios[] }>(await fetch(`/api/medios/cuentas?${new URLSearchParams({ cia })}`))).items;
}
export async function listarAsignacionesMedios(cia: string, cuenta: string): Promise<AsignacionMedios[]> {
  return (await leer<{ items: AsignacionMedios[] }>(await fetch(urlCuenta(cia, cuenta)))).items;
}
export async function guardarAsignacionMedios(cia: string, item: AsignacionMedios, original?: AsignacionMedios): Promise<void> {
  const { cuenta: _cuenta, ...fields } = item;
  delete (fields as typeof fields & { cia?: number }).cia;
  await leer(await fetch(urlCuenta(cia, item.cuenta), {
    method: original ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...fields, ...(original ? { original } : {}) }),
  }));
}
export async function eliminarAsignacionMedios(cia: string, item: AsignacionMedios): Promise<void> {
  const query = new URLSearchParams({ cia, formato: item.formato, concepto: item.concepto, cuenta2: item.cuenta2 });
  await leer(await fetch(`/api/medios/cuentas/${encodeURIComponent(item.cuenta)}/asignaciones?${query}`, { method: 'DELETE' }));
}
export async function copiarAsignacionesCuenta(cia: string, origen: string, destino: string): Promise<{ copiadas: number; omitidas: number }> {
  return leer(await fetch(`/api/medios/cuentas/copiar?${new URLSearchParams({ cia })}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origen, destino, confirmar: true }),
  }));
}
export async function previsualizarCopiaCompania(cia: string, origen: string): Promise<VistaCopia> {
  return leer(await fetch(`/api/medios/definiciones/preview?${new URLSearchParams({ cia, origen })}`));
}
export async function copiarDefinicionesCompania(cia: string, origen: string): Promise<{ actualizadas: number; sinCorrespondencia: number }> {
  return leer(await fetch(`/api/medios/definiciones/copiar?${new URLSearchParams({ cia })}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origen, confirmar: true }),
  }));
}
