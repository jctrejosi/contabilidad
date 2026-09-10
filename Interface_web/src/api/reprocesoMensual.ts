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
