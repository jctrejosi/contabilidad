/** MEDMAG04: el servidor obtiene el año activo y reemplaza resultados por CIA. */
export interface EstadoMedios {
  anio: number
  asignaciones: number
  partidas: number
  acumulados: number
}

export interface ResultadoMedios {
  anio: number
  mesInicial: number
  mesFinal: number
  partidas: number
  acumulados: number
  segundos: number
}

async function leer<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as T & {
    detail?: unknown
  } | null
  if (!response.ok)
    throw new Error(
      typeof body?.detail === "string"
        ? body.detail
        : "No fue posible completar la operación.",
    )
  return body as T
}

export async function consultarGeneracionMedios(
  cia: string,
  signal?: AbortSignal,
): Promise<EstadoMedios> {
  return leer(
    await fetch(`/api/medios/generacion?${new URLSearchParams({ cia })}`, {
      signal,
    }),
  )
}

export async function generarMedios(
  cia: string,
  mesInicial: number,
  mesFinal: number,
): Promise<ResultadoMedios> {
  return leer(
    await fetch(`/api/medios/generacion?${new URLSearchParams({ cia })}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mesInicial, mesFinal, confirmar: true }),
    }),
  )
}
