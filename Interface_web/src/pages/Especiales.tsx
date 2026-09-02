import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { EMPRESA, PERIODO, USUARIO } from '../data/mock';
import { FUNCIONES_ESPECIALES, type FuncionEspecial, type SeccionEspecial } from '../data/configEspeciales';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100 aria-[invalid=true]:border-red-400';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_DANGER = 'rounded bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-lg border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/40">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 id={titleId} className="text-sm font-semibold text-gray-800">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar diálogo" className="rounded px-2 text-xl text-gray-500 hover:bg-gray-100">×</button>
      </div>
      {children}
    </dialog>
  );
}

function BarraProgreso({ progreso }: { progreso: number }) {
  return (
    <div className="w-full">
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-petroleum-500 transition-all duration-300" style={{ width: `${Math.round(progreso)}%` }} />
      </div>
      <div className="mt-1 text-right text-xs font-mono text-gray-500">{Math.round(progreso)}%</div>
    </div>
  );
}

const SECCIONES: { valor: SeccionEspecial; titulo: string; descripcion: string }[] = [
  { valor: 'analizar', titulo: 'Analizar plan', descripcion: 'Verificaciones de sólo lectura sobre el plan de cuentas y sus configuraciones.' },
  { valor: 'eliminar', titulo: 'Eliminar cuentas en cero', descripcion: 'Operaciones destructivas que eliminan cuentas sin saldo ni movimiento. Requieren respaldo previo.' },
  { valor: 'fusion', titulo: 'Fusión de movimientos', descripcion: 'Consolidación de registros duplicados. Funcionalidad en preparación.' },
];

export default function Especiales() {
  const [busqueda, setBusqueda] = useState('');
  const [seccion, setSeccion] = useState<SeccionEspecial | 'todas'>('todas');
  const [funcion, setFuncion] = useState<FuncionEspecial | null>(null);
  const [motivo, setMotivo] = useState('');
  const [texto, setTexto] = useState('');
  const [errores, setErrores] = useState<{ motivo?: string; texto?: string }>({});
  const [progreso, setProgreso] = useState(0);
  const [ejecutando, setEjecutando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    if (!ejecutando || !funcion) return;
    const timer = setInterval(() => {
      setProgreso(prev => {
        const next = Math.min(100, prev + 6 + Math.random() * 12);
        if (next >= 100) {
          clearInterval(timer);
          setEjecutando(false);
          setResultado(`${funcion.nombre} completado el ${new Date().toLocaleDateString('es-CO')} por ${USUARIO.nombre}. La acción quedó registrada en la bitácora con el motivo indicado.`);
          setMensaje({ tipo: 'success', texto: `${funcion.nombre}: ejecución simulada completada.` });
          return 100;
        }
        return next;
      });
    }, 280);
    return () => clearInterval(timer);
  }, [ejecutando, funcion]);

  const filtradas = FUNCIONES_ESPECIALES.filter(f => {
    if (seccion !== 'todas' && f.seccion !== seccion) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      return f.nombre.toLowerCase().includes(q) || f.descripcion.toLowerCase().includes(q);
    }
    return true;
  });

  function abrirFuncion(f: FuncionEspecial) {
    if (!f.habilitada) return;
    setFuncion(f);
    setMotivo('');
    setTexto('');
    setErrores({});
    setProgreso(0);
    setEjecutando(false);
    setResultado(null);
  }

  function ejecutar(event: FormEvent) {
    event.preventDefault();
    if (!funcion) return;
    const nuevosErrores: { motivo?: string; texto?: string } = {};
    if (motivo.trim().length < 10) nuevosErrores.motivo = 'El motivo debe tener al menos 10 caracteres.';
    if (texto.trim() !== funcion.confirmacion) nuevosErrores.texto = `Escriba exactamente "${funcion.confirmacion}" para confirmar.`;
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length) return;
    setEjecutando(true);
  }

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Configuración / Funciones especiales</div>
          <h1 className="text-lg font-semibold text-gray-800">Funciones especiales</h1>
          <p className="mt-1 text-xs text-gray-500">Operaciones de alto riesgo sobre el plan de cuentas: análisis de estructura y eliminación de cuentas en cero.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {mensaje && <div role={mensaje.tipo === 'error' ? 'alert' : 'status'} className={`rounded border px-4 py-3 text-sm ${mensaje.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>{mensaje.texto}</div>}

      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
        <strong>Atención:</strong> las funciones de esta pantalla actúan sobre la contabilidad {EMPRESA.codigo} — {EMPRESA.nombre} (período {PERIODO.nombre}). Las operaciones destructivas exigen motivo y confirmación por escrito, y simulan su ejecución sin tocar los datos originales.
      </div>

      <div className="bg-white rounded border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Buscar función..." value={busqueda} onChange={e => setBusqueda(e.target.value)} className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 w-64" />
        {([['todas', 'Todas'], ['analizar', 'Analizar plan'], ['eliminar', 'Eliminar en cero'], ['fusion', 'Fusión']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setSeccion(k)} className={`text-xs px-2.5 py-1 rounded transition-colors font-medium ${seccion === k ? 'bg-petroleum-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-500">{FUNCIONES_ESPECIALES.filter(f => f.habilitada).length} funciones disponibles</span>
      </div>

      {SECCIONES.map(s => {
        const items = filtradas.filter(f => f.seccion === s.valor);
        if (!items.length) return null;
        return (
          <div key={s.valor} className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
              <div>
                <div className="text-sm font-semibold text-gray-800">{s.titulo}</div>
                <div className="text-xs text-gray-500">{s.descripcion}</div>
              </div>
              <span className="text-xs font-mono text-gray-400">{items.length}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {items.map(f => (
                <div key={f.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 ${!f.habilitada ? 'opacity-60' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-800">{f.nombre}</span>
                      {f.enDesarrollo && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">En desarrollo</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${f.seccion === 'eliminar' ? 'bg-red-100 text-red-700' : f.seccion === 'analizar' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                        {f.seccion === 'eliminar' ? 'Riesgo alto' : f.seccion === 'analizar' ? 'Solo lectura' : 'Riesgo alto'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{f.descripcion}</p>
                    <p className="mt-1 text-xs text-gray-400">{f.impacto}</p>
                  </div>
                  <button onClick={() => abrirFuncion(f)} disabled={!f.habilitada}
                    className={`shrink-0 text-xs px-3 py-1.5 rounded font-medium ${f.habilitada ? 'border border-gray-300 text-gray-700 hover:bg-gray-100' : 'border border-gray-200 text-gray-400 cursor-not-allowed'}`}>
                    Ejecutar →
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {funcion && <Modal title={`Confirmar — ${funcion.nombre}`} onClose={() => setFuncion(null)}>
        {resultado ? (
          <div className="space-y-3 p-5">
            <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">✓ {resultado}</div>
          </div>
        ) : (
          <form noValidate onSubmit={ejecutar}>
            <div className="space-y-3 p-5">
              <div className="rounded border border-gray-200 px-3 py-2 text-xs leading-relaxed text-gray-600">
                <div className="flex justify-between gap-2"><span className="text-gray-500">Compañía:</span><span className="font-mono font-semibold text-gray-800">{EMPRESA.codigo} — {EMPRESA.nombre}</span></div>
                <div className="flex justify-between gap-2"><span className="text-gray-500">Período:</span><span className="font-mono text-gray-800">{PERIODO.nombre}</span></div>
                <div className="flex justify-between gap-2"><span className="text-gray-500">Impacto:</span><span className={`font-medium ${funcion.seccion === 'eliminar' ? 'text-red-700' : 'text-gray-800'}`}>{funcion.impacto}</span></div>
              </div>
              <div className="grid items-center gap-1">
                <label htmlFor="esp-motivo" className="text-xs font-medium text-gray-600">Motivo de la ejecución (mínimo 10 caracteres):</label>
                <textarea id="esp-motivo" rows={2} className={INPUT} value={motivo} disabled={ejecutando} onChange={e => { setMotivo(e.target.value); setErrores(prev => ({ ...prev, motivo: undefined })); }} aria-invalid={!!errores.motivo} aria-describedby={errores.motivo ? 'esp-motivo-error' : undefined} />
                {errores.motivo && <p id="esp-motivo-error" className="text-xs text-red-600">{errores.motivo}</p>}
              </div>
              <div className="grid items-center gap-1">
                <label htmlFor="esp-texto" className="text-xs font-medium text-gray-600">Escriba <span className="font-mono font-semibold">{funcion.confirmacion}</span> para confirmar:</label>
                <input id="esp-texto" data-initial-focus className={`${INPUT} font-mono`} value={texto} disabled={ejecutando} onChange={e => { setTexto(e.target.value); setErrores(prev => ({ ...prev, texto: undefined })); }} aria-invalid={!!errores.texto} aria-describedby={errores.texto ? 'esp-texto-error' : undefined} />
                {errores.texto && <p id="esp-texto-error" className="text-xs text-red-600">{errores.texto}</p>}
              </div>
              {ejecutando && <BarraProgreso progreso={progreso} />}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setFuncion(null)} className={BUTTON_SECONDARY} disabled={ejecutando}>Cancelar</button>
              <button type="submit" className={BUTTON_DANGER} disabled={ejecutando || !motivo.trim() || !texto.trim()}>Ejecutar función</button>
            </div>
          </form>
        )}
        {resultado && <div className="flex justify-end gap-2 border-t border-gray-200 p-4"><button type="button" onClick={() => setFuncion(null)} className={BUTTON_SECONDARY}>Aceptar</button></div>}
      </Modal>}
    </div>
  );
}
