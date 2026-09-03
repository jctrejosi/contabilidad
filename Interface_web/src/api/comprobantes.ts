export interface ComprobanteReal {
  codigo: string;
  nombre: string;
  hist: string;
  historico: boolean;
  descripcionAuxiliar: string;
}

export interface ComprobantesResponse {
  items: ComprobanteReal[];
  count: number;
  source: 'CONTICOM';
  sharedAcrossCompanies: false;
}

const requestsInProgress = new Map<string, Promise<ComprobantesResponse>>();

/** Consulta CONTICOM; CIA es obligatoria porque el catálogo no es global. */
export function listarComprobantes(cia: string): Promise<ComprobantesResponse> {
  const url = `/api/comprobantes?${new URLSearchParams({ cia }).toString()}`;
  const current = requestsInProgress.get(url);
  if (current) return current;

  const pending = fetch(url)
    .then(async response => {
      const body = await response.json().catch(() => null) as ComprobantesResponse | { detail?: string } | null;
      if (!response.ok) {
        throw new Error(body && 'detail' in body ? body.detail : 'No fue posible consultar CONTICOM.');
      }
      return body as ComprobantesResponse;
    })
    .finally(() => {
      if (requestsInProgress.get(url) === pending) requestsInProgress.delete(url);
    });
  requestsInProgress.set(url, pending);
  return pending;
}
