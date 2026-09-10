import { useEffect, useState } from "react";
import { consultarPeriodoOperacion } from "../api/periodoOperacion";
import {
  ejecutarReprocesoMensual,
  simularReprocesoMensual,
  type ResultadoReprocesoMensual,
  type SolicitudReprocesoMensual,
} from "../api/reprocesoMensual";
import type { CompaniaSesion } from "../types";

type ProcessCard = {
  id: string;
  nombre: string;
  desc: string;
  tipo: "auditoria" | "correccion";
  icono: string;
  riesgo: "Alto" | "Medio" | "Bajo";
  disponible?: boolean;
};

const PROCESOS: ProcessCard[] = [
  {
    id: "rep-mensual",
    nombre: "Reproceso mensual",
    desc: "Reconstruye CONMAE y CONTERCE desde el MOV01 consolidado",
    tipo: "correccion",
    icono: "↺",
    riesgo: "Medio",
    disponible: true,
  },
  { id: "revalorizacion", nombre: "Revalorización de cuentas", desc: "Ajuste de activos y pasivos monetarios", tipo: "correccion", icono: "⟳", riesgo: "Medio" },
  { id: "docs-vs-mov", nombre: "Documentos vs movimiento", desc: "Verifica consistencia entre documentos y libro", tipo: "auditoria", icono: "⊟", riesgo: "Bajo" },
  { id: "auditoria-rev", nombre: "Auditoría de revalorización", desc: "Valida que la revalorización esté correcta", tipo: "auditoria", icono: "⊛", riesgo: "Bajo" },
  { id: "mov-vs-ctas", nombre: "Movimiento vs cuentas válidas", desc: "Detecta movimientos en cuentas no afectables", tipo: "auditoria", icono: "⊕", riesgo: "Bajo" },
  { id: "crear-cuentas", nombre: "Crear cuentas faltantes", desc: "Asistente para crear cuentas detectadas en importaciones", tipo: "correccion", icono: "+", riesgo: "Bajo" },
  { id: "rev-opt", nombre: "Revalorización mensual optimizada", desc: "Versión rápida del proceso de revalorización", tipo: "correccion", icono: "⟳", riesgo: "Medio" },
];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface ReprocesosProps {
  compania: CompaniaSesion;
}

type Step = "idle" | "simulating" | "sim" | "running" | "done";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Integra la revalorización mensual Harbour con el esquema consolidado.
 * La simulación siempre precede a la escritura para que el contador pueda
 * revisar alcance, diferencias y anomalías antes de confirmar.
 */
export default function Reprocesos({ compania }: ReprocesosProps) {
  const [selected, setSelected] = useState<ProcessCard | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [filter, setFilter] = useState<"todos" | "auditoria" | "correccion">("todos");
  const [anio, setAnio] = useState<number | null>(null);
  const [mesDesde, setMesDesde] = useState(1);
  const [mesHasta, setMesHasta] = useState(1);
  const [mesesHabilitados, setMesesHabilitados] = useState<number[]>([]);
  const [motivo, setMotivo] = useState("");
  const [resultado, setResultado] = useState<ResultadoReprocesoMensual | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargandoPeriodo, setCargandoPeriodo] = useState(false);

  useEffect(() => {
    if (selected?.id !== "rep-mensual") return;
    let activo = true;
    setCargandoPeriodo(true);
    setError(null);
    void consultarPeriodoOperacion(compania.codigo)
      .then(periodo => {
        if (!activo) return;
        const sugerido = Number(periodo.periodoSugerido.slice(5, 7));
        setAnio(periodo.anio);
        setMesesHabilitados(periodo.mesesHabilitados);
        setMesDesde(sugerido);
        setMesHasta(sugerido);
      })
      .catch(cause => {
        if (activo) setError(cause instanceof Error ? cause.message : "No fue posible consultar CONCTR.");
      })
      .finally(() => {
        if (activo) setCargandoPeriodo(false);
      });
    return () => { activo = false; };
  }, [selected?.id, compania.codigo]);

  function openProcess(proc: ProcessCard) {
    if (!proc.disponible) return;
    setSelected(proc);
    setStep("idle");
    setResultado(null);
    setMotivo("");
    setError(null);
  }

  function changeRange(setter: (month: number) => void, value: string) {
    setter(Number(value));
    setResultado(null);
    setStep("idle");
    setError(null);
  }

  function payload(): SolicitudReprocesoMensual {
    if (anio === null) throw new Error("No se ha podido determinar el ejercicio activo.");
    return {
      cia: compania.codigo,
      anio,
      mesDesde,
      mesHasta,
      usuario: "WEB",
      motivo: motivo.trim(),
    };
  }

  async function simulate() {
    setStep("simulating");
    setError(null);
    try {
      const result = await simularReprocesoMensual(payload());
      setResultado(result);
      setStep("sim");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible simular el reproceso.");
      setStep("idle");
    }
  }

  async function execute() {
    if (!resultado?.puedeEjecutar || !motivo.trim()) return;
    setStep("running");
    setError(null);
    try {
      const result = await ejecutarReprocesoMensual(payload());
      setResultado(result);
      setStep("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible ejecutar el reproceso.");
      setStep("sim");
    }
  }

  const filtered = PROCESOS.filter(proc => filter === "todos" || proc.tipo === filter);
  const rangoInvalido = mesDesde > mesHasta;

  return (
    <div className="max-w-screen-2xl space-y-4 p-4">
      <div>
        <h1 className="text-base font-semibold text-gray-800">Reprocesos y auditoría</h1>
        <p className="text-xs text-gray-500">Verificaciones, correcciones y recálculos del libro contable</p>
      </div>

      <div className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        ⚠ Los reprocesos modifican acumulados contables. La simulación es obligatoria y la ejecución se confirma en una transacción de Advantage.
      </div>

      <div className="flex items-center gap-2">
        {[
          { k: "todos", label: "Todos los procesos" },
          { k: "auditoria", label: "Solo auditorías" },
          { k: "correccion", label: "Solo correcciones" },
        ].map(item => (
          <button
            key={item.k}
            type="button"
            onClick={() => setFilter(item.k as typeof filter)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${filter === item.k ? "text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            style={filter === item.k ? { backgroundColor: "#0073C0" } : {}}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(proc => (
          <div
            key={proc.id}
            className={`rounded border bg-white p-4 ${proc.disponible ? "cursor-pointer hover:border-sky-300 hover:shadow-sm" : "opacity-60"}`}
            onClick={() => openProcess(proc)}
          >
            <div className="mb-2 flex items-start justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-100 font-mono text-sm text-gray-700">{proc.icono}</div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${proc.tipo === "auditoria" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{proc.tipo === "auditoria" ? "Auditar" : "Corregir"}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${proc.riesgo === "Medio" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>{proc.riesgo}</span>
              </div>
            </div>
            <div className="mb-1 text-sm font-medium text-gray-800">{proc.nombre}</div>
            <div className="text-xs text-gray-500">{proc.desc}</div>
            <button
              type="button"
              disabled={!proc.disponible}
              className="mt-3 w-full rounded px-3 py-1.5 text-xs font-medium text-white disabled:bg-gray-300"
              style={proc.disponible ? { backgroundColor: "#0073C0" } : {}}
            >
              {proc.disponible ? "Iniciar proceso" : "Pendiente de integración"}
            </button>
          </div>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">{selected.nombre}</h3>
                <p className="mt-0.5 text-xs text-gray-500">MOV01 → CONMAE + CONTERCE</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} disabled={step === "running"} className="text-lg text-gray-400 hover:text-gray-600 disabled:opacity-40">×</button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="rounded border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-800">
                Todos los períodos se leen de la tabla consolidada <strong>MOV01</strong>. El proceso reemplaza débitos y créditos del rango en las cuentas y sus padres de <strong>CONMAE</strong>; los auxiliares por cuenta y NIT se reconstruyen en <strong>CONTERCE</strong>.
              </div>

              <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-gray-500">Compañía activa</label>
                  <div className="font-medium text-gray-800">{compania.codigo} — {compania.nombre}</div>
                </div>
                <div>
                  <label className="mb-1 block text-gray-500">Ejercicio activo (CONCTR)</label>
                  <div className="font-medium text-gray-800">{cargandoPeriodo ? "Consultando…" : anio ?? "No disponible"}</div>
                </div>
                <div>
                  <label htmlFor="mes-desde" className="mb-1 block text-gray-500">Período desde</label>
                  <select id="mes-desde" value={mesDesde} disabled={cargandoPeriodo || step === "running"} onChange={event => changeRange(setMesDesde, event.target.value)} className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs">
                    {MESES.map((name, index) => <option key={name} value={index + 1}>{String(index + 1).padStart(2, "0")} — {name}{mesesHabilitados.includes(index + 1) ? " · habilitado" : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="mes-hasta" className="mb-1 block text-gray-500">Período hasta</label>
                  <select id="mes-hasta" value={mesHasta} disabled={cargandoPeriodo || step === "running"} onChange={event => changeRange(setMesHasta, event.target.value)} className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs">
                    {MESES.map((name, index) => <option key={name} value={index + 1}>{String(index + 1).padStart(2, "0")} — {name}{mesesHabilitados.includes(index + 1) ? " · habilitado" : ""}</option>)}
                  </select>
                </div>
              </div>

              {rangoInvalido && <p role="alert" className="rounded bg-red-50 p-2 text-xs text-red-700">El período inicial no puede ser posterior al período final.</p>}
              {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}

              {(step === "simulating" || step === "running") && (
                <div className="space-y-2 py-2">
                  <div className="text-xs text-gray-600">{step === "simulating" ? "Comparando acumulados sin escribir…" : "Reconstruyendo acumulados en Advantage…"}</div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#0073C0]" /></div>
                </div>
              )}

              {resultado && step !== "simulating" && step !== "running" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div className="rounded bg-gray-50 p-2"><span className="block text-gray-500">Filas MOV01</span><strong>{resultado.registrosMovimiento}</strong></div>
                    <div className="rounded bg-gray-50 p-2"><span className="block text-gray-500">Cuentas/niveles</span><strong>{resultado.cuentasProcesadas}</strong></div>
                    <div className="rounded bg-gray-50 p-2"><span className="block text-gray-500">Cuenta-tercero</span><strong>{resultado.auxiliaresTercero}</strong></div>
                    <div className="rounded bg-gray-50 p-2"><span className="block text-gray-500">Diferencias</span><strong>{resultado.diferencias.total}</strong></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded bg-gray-50 p-3 text-xs">
                    <div className="text-gray-600">Débitos: <strong>{formatMoney(resultado.debito)}</strong></div>
                    <div className="text-gray-600">Créditos: <strong>{formatMoney(resultado.credito)}</strong></div>
                    <div className="text-gray-600">Campos CONMAE diferentes: <strong>{resultado.diferencias.conmae}</strong></div>
                    <div className="text-gray-600">Campos CONTERCE diferentes: <strong>{resultado.diferencias.conterce}</strong></div>
                  </div>
                  {resultado.errores.length > 0 && <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700"><strong>Errores que impiden ejecutar:</strong><ul className="mt-1 list-disc pl-5">{resultado.errores.map(item => <li key={item}>{item}</li>)}</ul></div>}
                  {resultado.advertencias.length > 0 && <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><strong>Advertencias:</strong><ul className="mt-1 list-disc pl-5">{resultado.advertencias.map(item => <li key={item}>{item}</li>)}</ul></div>}
                  {step === "sim" && resultado.puedeEjecutar && <div className="rounded bg-green-50 p-2 text-xs font-medium text-green-700">✓ Simulación terminada. Puede confirmar el reproceso.</div>}
                  {step === "sim" && (
                    <div>
                      <label htmlFor="motivo-reproceso" className="mb-1 block text-xs font-medium text-gray-600">Motivo contable (obligatorio)</label>
                      <input id="motivo-reproceso" value={motivo} maxLength={180} onChange={event => setMotivo(event.target.value)} placeholder="Explique por qué se reconstruyen los acumulados…" className="w-full rounded border border-gray-200 px-2.5 py-2 text-xs outline-none focus:border-[#0073C0]" />
                    </div>
                  )}
                  {step === "done" && <div className="rounded border border-green-200 bg-green-50 p-3 text-sm font-medium text-green-700">✓ Reproceso confirmado. Auditoría: {resultado.auditoria}.</div>}
                  {resultado.advertenciaAuditoria && <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">{resultado.advertenciaAuditoria}</p>}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 px-5 py-4">
              <button type="button" onClick={() => setSelected(null)} disabled={step === "running" || step === "simulating"} className="rounded border border-gray-200 px-4 py-2 text-xs text-gray-600 disabled:opacity-40">{step === "done" ? "Cerrar" : "Cancelar"}</button>
              {(step === "idle" || step === "done") && <button type="button" onClick={() => void simulate()} disabled={cargandoPeriodo || anio === null || rangoInvalido} className="rounded bg-[#0073C0] px-4 py-2 text-xs font-medium text-white disabled:bg-gray-300">Simular proceso</button>}
              {step === "sim" && <button type="button" onClick={() => void execute()} disabled={!resultado?.puedeEjecutar || !motivo.trim()} className="rounded bg-red-600 px-4 py-2 text-xs font-medium text-white disabled:bg-gray-300">Confirmar y ejecutar</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
