/** Consulta, corrección manual y certificados del análisis de IVA. */
export interface IvaMonth {
  mes: number;
  nombre: string;
  baseDebito: number;
  ivaDebito: number;
  baseCredito: number;
  ivaCredito: number;
  baseNeta: number;
  ivaNeto: number;
}

export type IvaTotals = Pick<IvaMonth, 'baseDebito' | 'ivaDebito' | 'baseCredito' | 'ivaCredito' | 'baseNeta' | 'ivaNeto'>;
export interface IvaItem {
  cuenta: string;
  nombreCuenta: string;
  tercero: string;
  nombreTercero: string;
  meses: IvaMonth[];
  anual: IvaTotals;
  version: string;
}
export interface IvaPage {
  compania: { codigo: string; nombre: string };
  anio: number;
  filas: IvaItem[];
  siguiente: { cuenta: string; tercero: string } | null;
}
export interface IvaFilters {
  cia: string;
  anio: number;
  cuentaDesde?: string;
  cuentaHasta?: string;
  nitDesde?: string;
  nitHasta?: string;
  buscar?: string;
  cursorCuenta?: string;
  cursorTercero?: string;
}
export interface CertificateFilters extends IvaFilters {
  periodicidad: 'mensual' | 'bimestral' | 'anual';
  periodo: string;
  incluirPorcentaje: boolean;
}
export interface CertificateReport {
  compania: { codigo: string; nombre: string; nit: string };
  anio: number;
  certificados: Array<{
    tercero: string;
    nombreTercero: string;
    filas: Array<{ periodo: string; cuenta: string; concepto: string; base: number; iva: number; porcentaje: number | null }>;
    totalBase: number;
    totalIva: number;
  }>;
  cantidad: number;
}

function qs(values: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.toString();
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null) as (T & { detail?: string }) | null;
  if (!response.ok) throw new Error(body?.detail || 'No fue posible consultar el análisis de IVA.');
  return body as T;
}

export function listIva(f: IvaFilters): Promise<IvaPage> {
  return json(`/api/informes/iva/analisis?${qs({ ...f })}`);
}

export function getIva(f: IvaFilters, cuenta: string, nit: string): Promise<IvaItem> {
  return json(`/api/informes/iva/analisis/detalle?${qs({ cia: f.cia, anio: f.anio, cuenta, nit })}`);
}

export function saveIva(f: IvaFilters, item: IvaItem): Promise<IvaItem> {
  const meses = item.meses.map(({ mes, baseDebito, ivaDebito, baseCredito, ivaCredito }) =>
    ({ mes, baseDebito, ivaDebito, baseCredito, ivaCredito }));
  return json(`/api/informes/iva/analisis/detalle?${qs({ cia: f.cia, anio: f.anio, cuenta: item.cuenta, nit: item.tercero })}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: item.version, meses }),
  });
}

export function previewCertificates(f: CertificateFilters): Promise<CertificateReport> {
  return json(`/api/informes/iva/certificados?${qs({ ...f })}`);
}

export async function exportCertificates(f: CertificateFilters, formato: 'pdf' | 'xlsx'): Promise<void> {
  const response = await fetch(`/api/informes/iva/certificados/exportar?${qs({ ...f, formato })}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail || 'No fue posible exportar certificados.');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `certificados_iva_${f.cia}_${f.anio}.${formato}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
