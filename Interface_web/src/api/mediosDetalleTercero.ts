export type ModoDetalleMedios = 'detallado' | 'resumido';
export interface DetalleMediosTercero {
  snapshotId: string; cia: string; tercero: string; nombre: string; modo: ModoDetalleMedios;
  columnas: string[]; filas: (string | number)[][]; tipos: string[];
  totalValor: number; totalBase: number; movimientos: number; totalFilas: number;
  page: number; pageSize: number;
}
async function leer(response: Response): Promise<DetalleMediosTercero> {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : 'No fue posible consultar el detalle.');
  return body;
}
export async function consultarDetalleMedios(cia: string, tercero: string, modo: ModoDetalleMedios) {
  return leer(await fetch(`/api/medios/detalle-tercero?${new URLSearchParams({ cia, tercero, modo })}`));
}
export async function paginaDetalleMedios(cia: string, token: string, page: number) {
  return leer(await fetch(`/api/medios/detalle-tercero/pagina?${new URLSearchParams({ cia, token, page: String(page) })}`));
}
export async function exportarDetalleMedios(cia: string, token: string, salida: 'pdf' | 'xlsx') {
  const response = await fetch(`/api/medios/detalle-tercero/exportar?${new URLSearchParams({ cia, token, salida })}`);
  if (!response.ok) { await leer(response); return; }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url; link.download = `medios-detalle-tercero.${salida}`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
