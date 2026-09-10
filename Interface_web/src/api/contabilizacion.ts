export interface PartidaContabilizacion {
  cuenta: string;
  nit: string;
  centro: string;
  debito: number;
  credito: number;
  base: number;
  documentoAfectado: string;
}

export interface CapturaContabilizacion {
  cia: string;
  fecha: string;
  comprobante: string;
  tipoDocumento: string;
  numeroDocumento: string;
  concepto: string;
  usuario: string;
  lineas: PartidaContabilizacion[];
}

export interface ResultadoContabilizacion {
  documento: string;
  comprobante: string;
  tipoDocumento: string;
  fecha: string;
  lineas: number;
  debito: number;
  credito: number;
  estado: "Contabilizado" | "Validado sin grabar";
  dryRun: boolean;
  auditoria: "Registrada" | "Pendiente" | "No aplica en prueba";
  advertencia: string;
}

/**
 * Envía la captura al backend. El JSON solo transporta los datos; Python abre
 * ADO y ejecuta la transacción definitiva directamente sobre Advantage.
 */
export async function contabilizarCaptura(
  captura: CapturaContabilizacion,
): Promise<ResultadoContabilizacion> {
  const response = await fetch("/api/movimientos/contabilizar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(captura),
  });
  const body = await response.json().catch(() => null) as
    | { item?: ResultadoContabilizacion; detail?: string }
    | null;
  if (!response.ok || !body?.item) {
    throw new Error(body?.detail || "No fue posible contabilizar el documento en Advantage.");
  }
  return body.item;
}
