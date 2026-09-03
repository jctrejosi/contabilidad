import type { Cuenta } from '../types';

/** Campos que el backend permite modificar en la cuenta maestra de CONMAE. */
export interface CuentaWrite {
  nombre: string;
  afectable: boolean;
  requiereTercero: boolean;
  requiereCentro: boolean;
  ajuste: boolean;
  tipoFiscal: 'O' | 'I' | 'R';
}

export interface CuentaCreate extends CuentaWrite {
  /** Código jerárquico. Una vez creado no se modifica desde esta función. */
  codigo: string;
}

interface AccountsResponse {
  items: Cuenta[];
  count: number;
  source: string;
}

interface AccountResponse {
  item: Cuenta;
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  // En desarrollo Vite redirige /api al servicio Python del puerto 8001. En
  // producción se mantiene una URL relativa para poder usar un proxy inverso.
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => null) as { detail?: string } | null;
  if (!response.ok) {
    throw new ApiError(body?.detail || 'No fue posible completar la operación.', response.status);
  }
  return body as T;
}

function companyQuery(cia: string): string {
  return `cia=${encodeURIComponent(cia)}`;
}

// React StrictMode monta la pantalla dos veces en desarrollo para detectar
// efectos inseguros. Compartir la promesa evita ejecutar dos lecturas grandes
// de CONMAE al mismo tiempo sin ocultar esas validaciones de React.
const listRequestsInProgress = new Map<string, Promise<Cuenta[]>>();

export async function listarCuentas(cia: string, signal?: AbortSignal): Promise<Cuenta[]> {
  const key = cia.padStart(3, '0');
  const current = listRequestsInProgress.get(key);
  if (current) return current;

  const pending = request<AccountsResponse>(`/api/cuentas?${companyQuery(cia)}`, { signal })
    .then(response => response.items)
    .finally(() => {
      if (listRequestsInProgress.get(key) === pending) listRequestsInProgress.delete(key);
    });
  listRequestsInProgress.set(key, pending);
  return pending;
}

export async function crearCuenta(cia: string, payload: CuentaCreate): Promise<Cuenta> {
  const response = await request<AccountResponse>(`/api/cuentas?${companyQuery(cia)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response.item;
}

export async function actualizarCuenta(cia: string, codigo: string, payload: CuentaWrite): Promise<Cuenta> {
  const response = await request<AccountResponse>(`/api/cuentas/${encodeURIComponent(codigo)}?${companyQuery(cia)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return response.item;
}
