import type { CompaniaSesion } from '../types';

interface CompaniesResponse {
  items: CompaniaSesion[];
  count: number;
  source: 'CONEMP';
}

let requestInProgress: Promise<CompaniaSesion[]> | null = null;

/** Consulta las compañías reales que el usuario puede elegir al ingresar. */
export async function listarCompanias(signal?: AbortSignal): Promise<CompaniaSesion[]> {
  if (requestInProgress) return requestInProgress;
  requestInProgress = (async () => {
    const response = await fetch('/api/companias', { signal });
    const body = await response.json().catch(() => null) as CompaniesResponse | { detail?: string } | null;
    if (!response.ok) {
      const detail = body && 'detail' in body ? body.detail : null;
      throw new Error(detail || 'No fue posible consultar las compañías de CONEMP.');
    }
    return (body as CompaniesResponse).items;
  })();
  try {
    return await requestInProgress;
  } finally {
    requestInProgress = null;
  }
}
