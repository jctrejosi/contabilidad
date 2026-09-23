import { useEffect, useState } from 'react';
import {
  consultarCatalogoIndices, consultarEstadoReorganizacion, consultarPlanCrearIndice,
  consultarPlanReorganizacion, crearIndice, iniciarReorganizacion,
  type CatalogoIndicesAds, type EstadoReorganizacion, type PlanCrearIndice, type PlanReorganizacion,
} from '../api/reorganizacionAds';

const BOTON = 'rounded bg-petroleum-500 px-4 py-2 text-sm font-medium text-white hover:bg-petroleum-600 disabled:cursor-not-allowed disabled:opacity-50';

export default function Reorganizacion() {
  const [plan, setPlan] = useState<PlanReorganizacion | null>(null);
  const [estado, setEstado] = useState<EstadoReorganizacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [iniciando, setIniciando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [respaldo, setRespaldo] = useState(false);
  const [sinUsuarios, setSinUsuarios] = useState(false);
  const [confirmacion, setConfirmacion] = useState('');
  const [catalogo, setCatalogo] = useState<CatalogoIndicesAds | null>(null);
  const [tablaIndice, setTablaIndice] = useState('');
  const [nombreIndice, setNombreIndice] = useState('');
  const [campoNuevo, setCampoNuevo] = useState('');
  const [camposIndice, setCamposIndice] = useState<string[]>([]);
  const [planIndice, setPlanIndice] = useState<PlanCrearIndice | null>(null);
  const [validandoIndice, setValidandoIndice] = useState(false);
  const [creandoIndice, setCreandoIndice] = useState(false);
  const [confirmacionIndice, setConfirmacionIndice] = useState('');

  async function actualizarPlan() {
    setCargando(true);
    setError(null);
    try {
      const [siguientePlan, siguienteEstado, siguienteCatalogo] = await Promise.all([
        consultarPlanReorganizacion(), consultarEstadoReorganizacion(), consultarCatalogoIndices(),
      ]);
      setPlan(siguientePlan);
      setEstado(siguienteEstado);
      setCatalogo(siguienteCatalogo);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible consultar el diccionario.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { void actualizarPlan(); }, []);

  useEffect(() => {
    if (estado?.estado !== 'Ejecutando') return;
    const timer = window.setInterval(() => {
      consultarEstadoReorganizacion().then(siguiente => {
        setEstado(siguiente);
        if (siguiente?.estado === 'Completada' && siguiente.tipo === 'crearIndice') {
          setPlanIndice(null);
          void actualizarPlan();
        }
      }).catch(cause => {
        setError(cause instanceof Error ? cause.message : 'Se perdió la consulta del proceso.');
      });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [estado?.estado]);

  async function iniciar() {
    if (!plan || plan.inaccesibles.some(item => !item.reconstruible) || !respaldo || !sinUsuarios || confirmacion !== 'REORGANIZAR') return;
    setIniciando(true);
    setError(null);
    try {
      setEstado(await iniciarReorganizacion(plan.huella));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible iniciar la reindexación.');
    } finally {
      setIniciando(false);
    }
  }

  async function validarIndice() {
    setValidandoIndice(true);
    setError(null);
    setPlanIndice(null);
    try {
      setPlanIndice(await consultarPlanCrearIndice(tablaIndice, nombreIndice, camposIndice));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible validar el índice.');
    } finally {
      setValidandoIndice(false);
    }
  }

  async function iniciarIndice() {
    if (!planIndice || planIndice.estado !== 'pendiente' || !respaldo || !sinUsuarios || confirmacionIndice !== 'CREAR INDICE') return;
    setCreandoIndice(true);
    setError(null);
    try {
      setEstado(await crearIndice(planIndice));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No fue posible crear el índice.');
    } finally {
      setCreandoIndice(false);
    }
  }

  function cambiarCampo(index: number, direction: -1 | 1) {
    const next = [...camposIndice];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setCamposIndice(next);
    setPlanIndice(null);
  }

  const tablasConIndices = plan?.tablas.filter(item => item.indices.length > 0) ?? [];
  const completas = estado?.resultados.filter(item => item.estado === 'Completada').length ?? 0;
  const total = tablasConIndices.length;
  const progreso = total ? Math.round(completas / total * 100) : 0;
  const ejecutando = estado?.estado === 'Ejecutando';
  const camposDisponibles = catalogo?.tablas.find(item => item.tabla === tablaIndice)?.campos ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div>
        <div className="mb-1 text-xs text-gray-400">Administración / Reorganización de datos</div>
        <h1 className="text-lg font-semibold text-gray-800">Reorganización de índices</h1>
        <p className="mt-1 text-xs text-gray-500">
          Reconstruye los índices existentes de las tablas contables registradas en Advantage. No elimina registros ni cambia sus definiciones.
        </p>
      </div>

      {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {estado && (
        <section className={`rounded border p-4 ${estado.estado === 'Fallida' ? 'border-red-200 bg-red-50' : estado.estado === 'Completada' ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
            <span>{estado.tipo === 'crearIndice'
              ? estado.estado === 'Ejecutando' ? `Creando ${estado.nombreIndice} en ${estado.tablaActual}…` : `Creación del índice ${estado.estado.toLowerCase()}`
              : estado.estado === 'Ejecutando' ? `Reindexando ${estado.tablaActual || 'preparando tablas'}…` : `Reorganización ${estado.estado.toLowerCase()}`}</span>
            {estado.tipo !== 'crearIndice' && <span>{completas} de {total} tablas con índices</span>}
          </div>
          {estado.tipo !== 'crearIndice' && <div className="mt-3 h-2 overflow-hidden rounded bg-gray-200">
            <div className="h-full bg-petroleum-500 transition-all" style={{ width: `${progreso}%` }} />
          </div>}
          {estado.segundos !== null && <p className="mt-2 text-xs">Duración: {estado.segundos.toLocaleString('es-CO')} segundos.</p>}
          {estado.error && <p className="mt-2 text-xs text-red-700">Error en {estado.tablaActual || 'la verificación'}: {estado.error}{estado.tipo !== 'crearIndice' ? ' Las tablas completadas antes del fallo permanecen reindexadas.' : ''}</p>}
          {estado.resultados.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {estado.resultados.map(item => <span key={item.tabla} className="rounded border border-gray-200 bg-white px-2 py-1 text-xs">{item.tabla}: {item.estado}{item.reconstruido ? ' · índice recreado' : ''}{item.segundos !== undefined ? ` (${item.segundos.toLocaleString('es-CO')} s)` : ''}</span>)}
            </div>
          )}
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-petroleum-900">Índices del diccionario actual</h2>
          <button type="button" className="rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50" disabled={cargando || ejecutando} onClick={() => void actualizarPlan()}>
            Actualizar vista previa
          </button>
        </div>
        {cargando ? <p className="mt-3 text-sm text-gray-500">Consultando Advantage…</p> : plan && (
          <>
            <p className="mt-2 text-xs text-gray-600">
              {tablasConIndices.length} tablas con {plan.totalIndices} índices. La operación afecta el diccionario compartido por todas las compañías, no solo la compañía seleccionada.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {plan.tablas.map(item => (
                <details key={item.tabla} className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <summary className="cursor-pointer text-xs font-medium text-gray-800">{item.tabla} · {item.indices.length} índices</summary>
                  <ul className="mt-2 space-y-1 text-xs text-gray-600">
                    {item.indices.length ? item.indices.map(index => <li key={`${index.archivo}:${index.nombre}`} className="break-all" title={`${index.expresion}${index.condicion ? ` · ${index.condicion}` : ''}`}>{index.nombre} · {index.archivo}</li>) : <li>Sin índices; no se reindexa.</li>}
                  </ul>
                </details>
              ))}
            </div>
            {plan.ausentes.length > 0 && <p className="mt-3 text-xs text-amber-700">No registradas en este diccionario; se omiten: {plan.ausentes.join(', ')}.</p>}
            {plan.inaccesibles.length > 0 && (
              <div role="alert" className={`mt-3 rounded border px-3 py-2 text-xs ${plan.inaccesibles.some(item => !item.reconstruible) ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                {plan.inaccesibles.some(item => !item.reconstruible)
                  ? 'Hay tablas que no se pueden abrir ni reconstruir automáticamente.'
                  : 'Hay archivos de índice ausentes. Advantage intentará recrearlos desde el diccionario antes de reindexar.'}
                {plan.inaccesibles.map(item => <p key={item.tabla} className="mt-1">{item.tabla}: {item.reconstruible ? `Se recrearán ${item.archivosFaltantes.join(', ')}.` : item.motivo}</p>)}
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-petroleum-900">Verificar y crear un índice nuevo</h2>
        <p className="mt-2 text-xs text-gray-600">
          Seleccione una tabla y los campos en el orden de búsqueda. Antes de crear, se comprobará si ya existe un índice equivalente en el diccionario compartido por todas las compañías.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-gray-700">Tabla
            <select value={tablaIndice} disabled={ejecutando || cargando} onChange={event => {
              setTablaIndice(event.target.value); setCamposIndice([]); setCampoNuevo(''); setPlanIndice(null);
            }} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="">Seleccione una tabla</option>
              {catalogo?.tablas.map(item => <option key={item.tabla} value={item.tabla}>{item.tabla}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-700">Nombre del índice
            <input value={nombreIndice} disabled={ejecutando} maxLength={128} onChange={event => { setNombreIndice(event.target.value.toUpperCase()); setPlanIndice(null); }} placeholder="Ej. CONMAE7" className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-56 flex-1 text-xs text-gray-700">Agregar campo
            <select value={campoNuevo} disabled={!tablaIndice || ejecutando} onChange={event => setCampoNuevo(event.target.value)} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="">Seleccione un campo</option>
              {camposDisponibles.filter(field => !camposIndice.includes(field)).map(field => <option key={field} value={field}>{field}</option>)}
            </select>
          </label>
          <button type="button" disabled={!campoNuevo || camposIndice.length >= 8 || ejecutando} onClick={() => {
            setCamposIndice(previous => [...previous, campoNuevo]); setCampoNuevo(''); setPlanIndice(null);
          }} className="rounded border border-gray-300 px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-50">Agregar campo</button>
        </div>
        {camposIndice.length > 0 && <div className="mt-3 space-y-1">
          {camposIndice.map((field, index) => <div key={field} className="flex items-center gap-2 text-xs text-gray-700">
            <span className="w-5 text-right">{index + 1}.</span><span className="min-w-28 font-medium">{field}</span>
            <button type="button" disabled={index === 0 || ejecutando} onClick={() => cambiarCampo(index, -1)} aria-label={`Subir ${field}`} className="rounded border px-2 disabled:opacity-40">↑</button>
            <button type="button" disabled={index === camposIndice.length - 1 || ejecutando} onClick={() => cambiarCampo(index, 1)} aria-label={`Bajar ${field}`} className="rounded border px-2 disabled:opacity-40">↓</button>
            <button type="button" disabled={ejecutando} onClick={() => { setCamposIndice(previous => previous.filter(item => item !== field)); setPlanIndice(null); }} className="text-red-700 disabled:opacity-40">Quitar</button>
          </div>)}
        </div>}
        <button type="button" disabled={!tablaIndice || !nombreIndice || !camposIndice.length || validandoIndice || ejecutando} onClick={() => void validarIndice()} className="mt-4 rounded border border-petroleum-500 px-3 py-2 text-xs text-petroleum-900 hover:bg-gray-50 disabled:opacity-50">
          {validandoIndice ? 'Verificando…' : 'Verificar índice'}
        </button>
        {planIndice && <div className={`mt-3 rounded border px-3 py-2 text-xs ${planIndice.estado === 'pendiente' ? 'border-amber-200 bg-amber-50 text-amber-900' : planIndice.estado === 'existente' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          <p>{planIndice.motivo}</p>
          <p className="mt-1">{planIndice.nombre} en {planIndice.tabla}: {planIndice.campos.join(' → ')}</p>
        </div>}
        {planIndice?.estado === 'pendiente' && <div className="mt-3">
          <p className="text-xs text-gray-600">Para crear el índice, confirme el respaldo y la salida de los demás usuarios en la sección inferior.</p>
          <label htmlFor="confirmacion-indice" className="mt-2 block text-xs text-gray-600">Escriba CREAR INDICE para confirmar</label>
          <input id="confirmacion-indice" value={confirmacionIndice} disabled={ejecutando} onChange={event => setConfirmacionIndice(event.target.value)} className="mt-1 w-full max-w-xs rounded border border-gray-300 px-3 py-2 text-sm" />
          <div className="mt-3"><button type="button" className={BOTON} disabled={!respaldo || !sinUsuarios || confirmacionIndice !== 'CREAR INDICE' || ejecutando || creandoIndice} onClick={() => void iniciarIndice()}>
            {creandoIndice ? 'Iniciando…' : 'Crear índice'}
          </button></div>
        </div>}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-petroleum-900">Antes de iniciar</h2>
        <p className="mt-2 text-xs text-gray-600">
          Advantage necesita acceso exclusivo a cada tabla. Cierre el programa original y las demás sesiones que puedan mantener estas tablas abiertas. Si no obtiene exclusividad, el proceso se detendrá e indicará la tabla afectada.
        </p>
        <div className="mt-3 space-y-2 text-xs text-gray-700">
          <label className="flex items-start gap-2"><input type="checkbox" checked={respaldo} onChange={event => setRespaldo(event.target.checked)} disabled={ejecutando} /> Confirmo que tengo un respaldo reciente y verificado del diccionario y sus tablas.</label>
          <label className="flex items-start gap-2"><input type="checkbox" checked={sinUsuarios} onChange={event => setSinUsuarios(event.target.checked)} disabled={ejecutando} /> Confirmo que los demás usuarios han salido de la aplicación y de Advantage.</label>
        </div>
        <label htmlFor="confirmacion-reorganizacion" className="mt-4 block text-xs text-gray-600">Escriba REORGANIZAR para confirmar</label>
        <input id="confirmacion-reorganizacion" value={confirmacion} onChange={event => setConfirmacion(event.target.value)} disabled={ejecutando} className="mt-1 w-full max-w-xs rounded border border-gray-300 px-3 py-2 text-sm" />
        <div className="mt-4">
          <button type="button" className={BOTON} onClick={() => void iniciar()} disabled={!plan?.totalIndices || !!plan?.inaccesibles.some(item => !item.reconstruible) || !respaldo || !sinUsuarios || confirmacion !== 'REORGANIZAR' || ejecutando || iniciando || cargando}>
            {iniciando ? 'Iniciando…' : ejecutando ? 'Reorganización en curso' : 'Reindexar índices existentes'}
          </button>
        </div>
      </section>
    </div>
  );
}
