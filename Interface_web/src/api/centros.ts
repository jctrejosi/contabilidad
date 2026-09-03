import type { CentroJerarquico } from '../data/configCentros';

export interface CentrosResponse {
  items: CentroJerarquico[];
  count: number;
  source: 'CONCECOS';
  sharedAcrossCompanies: false;
}

const requestsInProgress = new Map<string, Promise<CentrosResponse>>();

/** Consulta CONCECOS. CIA es obligatoria porque los códigos no son globales. */
export function listarCentros(cia: string): Promise<CentrosResponse> {
  const url = `/api/centros?${new URLSearchParams({ cia }).toString()}`;
  const current = requestsInProgress.get(url);
  if (current) return current;

  const pending = fetch(url)
    .then(async response => {
      const body = await response.json().catch(() => null) as CentrosResponse | { detail?: string } | null;
      if (!response.ok) {
        throw new Error(body && 'detail' in body ? body.detail : 'No fue posible consultar CONCECOS.');
      }
      return body as CentrosResponse;
    })
    .finally(() => {
      if (requestsInProgress.get(url) === pending) requestsInProgress.delete(url);
    });
  requestsInProgress.set(url, pending);
  return pending;
}
