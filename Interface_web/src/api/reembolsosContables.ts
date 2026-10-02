/** Flujo Harbour de reembolsos: cabecera, gastos y lote contable generado. */
export interface ReembolsoItem {
  tercero: string;
  centro: string;
  centroCruce: string;
  concepto: string;
  valor: number;
}

export interface ReembolsoEncabezado {
  lote: string;
  documentoCaja: string;
  fecha: string;
  valorGeneral: number;
  concepto: string;
  documentoCruce: string;
  comprobante: string;
}

export interface ReembolsoContable {
  encabezado: ReembolsoEncabezado;
  items: ReembolsoItem[];
  estado: 'Borrador' | 'Lote generado';
}

export interface ResumenReembolso {
  lote: string;
  fecha: string;
  concepto: string;
  valor: number;
  estado: 'Borrador' | 'Lote generado';
}

export interface ResultadoConfirmacion {
  loteContable: string;
  partidas: number;
  documentos: number;
  debito: number;
  credito: number;
  dryRun: boolean;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await response.json().catch(() => null) as (T & { detail?: string }) | null;
  if (!response.ok) throw new Error(body?.detail || 'No fue posible completar la operación.');
  return body as T;
}

const base = (cia: string) => `/api/reembolsos-contables?cia=${encodeURIComponent(cia)}`;
const item = (cia: string, lote: string) =>
  `/api/reembolsos-contables/${encodeURIComponent(lote)}?cia=${encodeURIComponent(cia)}`;

export async function listarReembolsos(cia: string): Promise<ResumenReembolso[]> {
  const response = await request<{ items: ResumenReembolso[] }>(base(cia));
  return response.items;
}

export async function consultarReembolso(cia: string, lote: string): Promise<ReembolsoContable> {
  const response = await request<{ item: ReembolsoContable }>(item(cia, lote));
  return response.item;
}

export async function guardarReembolso(
  cia: string, data: Pick<ReembolsoContable, 'encabezado' | 'items'>, original?: string,
): Promise<void> {
  await request(original ? item(cia, original) : base(cia), {
    method: original ? 'PUT' : 'POST', body: JSON.stringify(data),
  });
}

export async function confirmarReembolso(
  cia: string, lote: string, loteContable: string, dryRun: boolean,
): Promise<ResultadoConfirmacion> {
  const url = `/api/reembolsos-contables/${encodeURIComponent(lote)}/confirmar?${new URLSearchParams({ cia, dryRun: String(dryRun) })}`;
  const response = await request<{ item: ResultadoConfirmacion }>(url, {
    method: 'POST', body: JSON.stringify({ loteContable, usuario: 'WEB' }),
  });
  return response.item;
}
