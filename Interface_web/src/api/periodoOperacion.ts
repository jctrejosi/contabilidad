export interface PeriodoOperacion {
  anio: number;
  mesesHabilitados: number[];
  periodoSugerido: string;
  fechaSugerida: string;
}

interface PeriodoOperacionResponse {
  item: PeriodoOperacion;
  source: 'CONCTR';
}

/**
 * Consulta CONCTR para evitar que Captura directa abra con un año o mes
 * inventado por la interfaz. El servidor vuelve a validar el período al grabar.
 */
export async function consultarPeriodoOperacion(cia: string): Promise<PeriodoOperacion> {
  const response = await fetch(`/api/periodo-operacion?${new URLSearchParams({ cia }).toString()}`);
  const body = await response.json().catch(() => null) as PeriodoOperacionResponse | { detail?: string } | null;
  if (!response.ok) {
    throw new Error(body && 'detail' in body ? body.detail : 'No fue posible consultar CONCTR.');
  }
  return (body as PeriodoOperacionResponse).item;
}
