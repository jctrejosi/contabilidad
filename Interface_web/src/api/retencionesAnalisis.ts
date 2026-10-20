/** Análisis y certificados de retenciones acumuladas en Advantage. */
export interface RetMonth {
  mes: number; nombre: string;
  baseDebito: number; retencionDebito: number; baseCredito: number; retencionCredito: number;
  baseCompraDebito: number; baseCompraCredito: number;
  baseNeta: number; retencionNeta: number; baseCompraNeta: number;
}
export interface RetItem {
  cuenta: string; nombreCuenta: string; tercero: string; nombreTercero: string;
  meses: RetMonth[]; anual: Omit<RetMonth, 'mes' | 'nombre'>; version: string;
}
export interface RetPage {
  compania: { codigo: string; nombre: string }; anio: number; filas: RetItem[];
  siguiente: { cuenta: string; tercero: string } | null;
}
export interface RetFilters {
  cia: string; anio: number; cuentaDesde?: string; cuentaHasta?: string;
  nitDesde?: string; nitHasta?: string; buscar?: string; cursorCuenta?: string; cursorTercero?: string;
}
export interface RetCertificateFilters extends RetFilters {
  periodicidad: 'mensual' | 'bimestral' | 'anual'; periodo: string;
  presentacion: 'detallado' | 'sencillo' | 'porcentaje'; incluirIva: boolean;
}
export interface RetCertificateReport {
  compania: { codigo: string; nombre: string; nit: string }; anio: number; cantidad: number;
  certificados: Array<{ tercero: string; nombreTercero: string; totalBase: number;
    totalBaseCompra: number; totalRetencion: number; filas: Array<{
      periodo: string; cuenta: string; concepto: string; base: number; baseCompra: number;
      iva: number; porcentajeIva: number | null; porcentajeRetencion: number | null; retencion: number;
    }> }>;
}

const query = (values: Record<string, string | number | boolean | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)); });
  return params.toString();
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null) as (T & { detail?: string }) | null;
  if (!response.ok) throw new Error(body?.detail || 'No fue posible consultar las retenciones.');
  return body as T;
}

export const listRetentions = (filters: RetFilters) =>
  json<RetPage>(`/api/informes/retenciones/analisis?${query({ ...filters })}`);
export const getRetention = (filters: RetFilters, cuenta: string, nit: string) =>
  json<RetItem>(`/api/informes/retenciones/analisis/detalle?${query({ cia: filters.cia, anio: filters.anio, cuenta, nit })}`);
export const saveRetention = (filters: RetFilters, item: RetItem) =>
  json<RetItem>(`/api/informes/retenciones/analisis/detalle?${query({ cia: filters.cia, anio: filters.anio, cuenta: item.cuenta, nit: item.tercero })}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: item.version, meses: item.meses.map(({ mes, baseDebito, retencionDebito, baseCredito, retencionCredito, baseCompraDebito, baseCompraCredito }) =>
      ({ mes, baseDebito, retencionDebito, baseCredito, retencionCredito, baseCompraDebito, baseCompraCredito })) }),
  });
export const previewRetentionCertificates = (filters: RetCertificateFilters) =>
  json<RetCertificateReport>(`/api/informes/retenciones/certificados?${query({ ...filters })}`);

export async function exportRetentionCertificates(filters: RetCertificateFilters, formato: 'pdf' | 'xlsx'): Promise<void> {
  const response = await fetch(`/api/informes/retenciones/certificados/exportar?${query({ ...filters, formato })}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail || 'No fue posible exportar certificados.');
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url; link.download = `certificados_retenciones_${filters.cia}_${filters.anio}.${formato}`;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
