import type { Tercero } from '../types';

export type EstadoTerceroQuery = 'todos' | 'activo' | 'bloqueado';

export interface TercerosPageResponse {
  items: Tercero[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
  source: 'FADCLI';
  sharedAcrossCompanies: true;
}

interface ListarTercerosParams {
  page: number;
  pageSize?: number;
  search?: string;
  estado?: EstadoTerceroQuery;
}

const requestsInProgress = new Map<string, Promise<TercerosPageResponse>>();

/** Consulta una página del maestro global; búsqueda y filtros se ejecutan en ADS. */
export function listarTerceros({
  page,
  pageSize = 100,
  search = '',
  estado = 'todos',
}: ListarTercerosParams): Promise<TercerosPageResponse> {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    q: search,
    estado,
  });
  const url = `/api/terceros?${query.toString()}`;
  const current = requestsInProgress.get(url);
  if (current) return current;

  const pending = fetch(url)
    .then(async response => {
      const body = await response.json().catch(() => null) as TercerosPageResponse | { detail?: string } | null;
      if (!response.ok) {
        throw new Error(body && 'detail' in body ? body.detail : 'No fue posible consultar FADCLI.');
      }
      return body as TercerosPageResponse;
    })
    .finally(() => {
      if (requestsInProgress.get(url) === pending) requestsInProgress.delete(url);
    });
  requestsInProgress.set(url, pending);
  return pending;
}
