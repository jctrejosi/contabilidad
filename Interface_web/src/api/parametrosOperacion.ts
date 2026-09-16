import type { ParametrosOperacion } from '../data/parametrosOperacion';

interface ParametrosOperacionResponse {
  item: ParametrosOperacion;
  source: 'CONCTR';
}

async function responseOrError(response: Response): Promise<ParametrosOperacionResponse> {
  const body = await response.json().catch(() => null) as ParametrosOperacionResponse | { detail?: string } | null;
  if (!response.ok) {
    throw new Error(body && 'detail' in body ? body.detail : 'No fue posible operar con CONCTR.');
  }
  return body as ParametrosOperacionResponse;
}

/** Lee el único registro de parámetros que usa PARAMS en el sistema original. */
export async function consultarParametrosOperacion(cia: string): Promise<ParametrosOperacion> {
  const response = await fetch(`/api/parametros-operacion?${new URLSearchParams({ cia }).toString()}`);
  return (await responseOrError(response)).item;
}

/** Actualiza exclusivamente los campos persistidos por DSIGRABA6. */
export async function guardarParametrosOperacion(cia: string, parametros: ParametrosOperacion): Promise<ParametrosOperacion> {
  const { codigoInterno: _soloLectura, ...payload } = parametros;
  const response = await fetch(`/api/parametros-operacion?${new URLSearchParams({ cia }).toString()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return (await responseOrError(response)).item;
}
