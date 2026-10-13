import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react"
import {
  consultarGeneracionMedios,
  generarMedios,
  type EstadoMedios,
  type ResultadoMedios,
} from "../api/mediosGeneracion"

/** MEDMAG04: el año se obtiene del ejercicio activo y la salida reemplaza la anterior de esta compañía. */
export default function MediosGeneracion({ cia }: { cia: string }) {
  const [estado, setEstado] = useState<EstadoMedios | null>(null)
  const [inicial, setInicial] = useState(1)
  const [final, setFinal] = useState(12)
  const [ocupado, setOcupado] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const [error, setError] = useState("")
  const [resultado, setResultado] = useState<ResultadoMedios | null>(null)

  async function cargar() {
    try {
      setEstado(await consultarGeneracionMedios(cia))
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible consultar la generación.",
      )
    }
  }
  useEffect(() => {
    const controller = new AbortController()
    setEstado(null)
    setResultado(null)
    setError("")
    setConfirmar(false)
    void consultarGeneracionMedios(cia, controller.signal)
      .then(setEstado)
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "No fue posible consultar la generación.",
          )
      })
    return () => controller.abort()
  }, [cia])

  function avanzar(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || event.shiftKey) return
    const campos = Array.from(
      event.currentTarget.querySelectorAll<HTMLSelectElement>(
        "select:not([disabled])",
      ),
    )
    const indice = campos.indexOf(event.target as HTMLSelectElement)
    if (indice >= 0) {
      event.preventDefault()
      ;(
        campos[indice + 1] ??
        event.currentTarget.querySelector<HTMLButtonElement>(
          'button[type="submit"]',
        )
      )?.focus()
    }
  }

  function preparar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setResultado(null)
    if (inicial > final) {
      setError("El mes inicial no puede ser posterior al mes final.")
      return
    }
    if (!estado?.asignaciones) {
      setError("Primero asigne cuentas a formatos y conceptos.")
      return
    }
    setConfirmar(true)
  }

  async function generar() {
    setConfirmar(false)
    setOcupado(true)
    setError("")
    try {
      const data = await generarMedios(cia, inicial, final)
      setResultado(data)
      await cargar()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible generar los medios.",
      )
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-5 p-4">
      <header>
        <p className="text-xs text-gray-500">Medios magnéticos / Generación</p>
        <h1 className="text-lg font-semibold text-gray-800">Generar medios</h1>
        <p className="mt-1 text-sm text-slate-600">
          Medios anuales de la compañía seleccionada.
        </p>
      </header>
      {error && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {estado && (
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded border border-gray-200 bg-white p-3 text-sm">
            Año activo
            <br />
            <strong className="text-lg">{estado.anio}</strong>
          </div>
          <div className="rounded border border-gray-200 bg-white p-3 text-sm">
            Asignaciones
            <br />
            <strong className="text-lg">{estado.asignaciones}</strong>
          </div>
          <div className="rounded border border-gray-200 bg-white p-3 text-sm">
            Partidas actuales
            <br />
            <strong className="text-lg">{estado.partidas}</strong>
          </div>
          <div className="rounded border border-gray-200 bg-white p-3 text-sm">
            Acumulados actuales
            <br />
            <strong className="text-lg">{estado.acumulados}</strong>
          </div>
        </div>
      )}
      <form
        onSubmit={preparar}
        onKeyDown={avanzar}
        className="rounded border border-gray-200 bg-white p-5 shadow-sm"
      >
        <h2 className="font-semibold text-slate-800">Período de generación</h2>
        <p className="mt-1 text-sm text-slate-500">
          El año se toma del ejercicio activo. La generación sustituye los
          resultados anteriores de esta compañía.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <label className="text-xs font-medium text-gray-600">
            Mes inicial
            <select
              autoFocus
              disabled={ocupado}
              className="mt-1 block rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-petroleum-500"
              value={inicial}
              onChange={(e) => setInicial(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {String(i + 1).padStart(2, "0")}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-600">
            Mes final
            <select
              disabled={ocupado}
              className="mt-1 block rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-petroleum-500"
              value={final}
              onChange={(e) => setFinal(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {String(i + 1).padStart(2, "0")}
                </option>
              ))}
            </select>
          </label>
        </div>
        {estado?.asignaciones === 0 && (
          <p className="mt-4 text-sm text-amber-800">
            Primero configure las cuentas en «3. Asignación de cuentas».
          </p>
        )}
        <button
          type="submit"
          disabled={ocupado || !estado || !estado.asignaciones}
          className="mt-5 rounded bg-petroleum-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {ocupado ? "Generando…" : "Generar medios"}
        </button>
      </form>
      {resultado && (
        <div
          role="status"
          className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          Generación terminada: {resultado.partidas} partidas y{" "}
          {resultado.acumulados} acumulados. Tiempo: {resultado.segundos}{" "}
          segundos.
        </div>
      )}
      {confirmar && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar generación"
          onKeyDown={(event) => {
            if (event.key === "Escape") setConfirmar(false)
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="max-w-md rounded bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold">Confirmar generación</h2>
            <p className="mt-2 text-sm">
              Se reemplazarán los resultados actuales de la compañía {cia} por
              el período {String(inicial).padStart(2, "0")}–
              {String(final).padStart(2, "0")} de {estado?.anio}. ¿Desea
              continuar?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                autoFocus
                onClick={() => setConfirmar(false)}
                className="rounded border border-gray-300 px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => void generar()}
                className="rounded bg-petroleum-500 px-4 py-2 text-sm text-white"
              >
                Sí, generar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
