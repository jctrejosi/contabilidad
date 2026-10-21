export interface ResultadoReprocesoMensual {
  compania: { codigo: string; nombre: string };
  anio: number;
  mesDesde: number;
  mesHasta: number;
  registrosMovimiento: number;
  cuentasProcesadas: number;
  auxiliaresTercero: number;
  debito: number;
  credito: number;
  diferencias: { conmae: number; conterce: number; total: number };
  advertencias: string[];
  errores: string[];
  puedeEjecutar: boolean;
  estado: string;
  duracionSegundos: number;
  idOperacion?: string;
  tiemposEtapas?: { etapa: string; segundos: number }[];
  auditoria: string;
  advertenciaAuditoria: string;
  fuente: "MOV01";
  destinos: ["CONMAE", "CONTERCE"];
}

export interface SolicitudReprocesoMensual {
  cia: string;
  anio: number;
  mesDesde: number;
  mesHasta: number;
  usuario: string;
  motivo: string;
  seguimientoId?: string;
}

export interface ProgresoReproceso {
  estado: "activo" | "finalizado" | "error";
  etapa: string;
  procesados: number;
  total: number | null;
  segundos: number;
}

export async function consultarProgresoReproceso(id: string, cia: string, signal: AbortSignal): Promise<ProgresoReproceso | null> {
  const response = await fetch(`/api/reprocesos/mensual/progreso/${id}?cia=${encodeURIComponent(cia)}`, { signal, cache: "no-store" });
  if (!response.ok) return null;
  const body = await response.json() as { item: ProgresoReproceso };
  return body.item;
}

async function enviar(
  path: "simular" | "ejecutar",
  payload: SolicitudReprocesoMensual,
): Promise<ResultadoReprocesoMensual> {
  const response = await fetch(`/api/reprocesos/mensual/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null) as
    | { item?: ResultadoReprocesoMensual; detail?: string }
    | null;
  if (!response.ok || !body?.item) {
    throw new Error(body?.detail || "No fue posible ejecutar el reproceso en Advantage.");
  }
  return body.item;
}

/** Solo lee y compara; no modifica CONMAE ni CONTERCE. */
export function simularReprocesoMensual(
  payload: SolicitudReprocesoMensual,
): Promise<ResultadoReprocesoMensual> {
  return enviar("simular", payload);
}

/** Confirma el reemplazo transaccional de los acumulados calculados desde MOV01. */
export function ejecutarReprocesoMensual(
  payload: SolicitudReprocesoMensual,
): Promise<ResultadoReprocesoMensual> {
  return enviar("ejecutar", payload);
}
