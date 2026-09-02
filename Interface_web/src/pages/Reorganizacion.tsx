import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { USUARIO } from '../data/mock';

const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';

type Fase = 'en-linea' | 'ejecutando' | 'completado';

const TABLAS_AFECTADAS = ['MOVIMIENTOS', 'LOTES', 'SALDOS', 'TERCEROS', 'DOCUMENTOS', 'ÍNDICES SECUNDARIOS'];

const PASOS = [
  { hasta: 25, texto: 'Verificando exclusividad de usuarios…' },
  { hasta: 50, texto: 'Compactando registros eliminados…' },
  { hasta: 75, texto: 'Reconstruyendo índices secundarios…' },
  { hasta: 99, texto: 'Verificando integridad de tablas…' },
  { hasta: 100, texto: 'Finalizando…' },
];

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

export default function Reorganizacion() {
  const [showModal, setShowModal] = useState(false);
  const [fase, setFase] = useState<Fase>('en-linea');
  const [respaldo, setRespaldo] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [texto, setTexto] = useState('');
  const [progreso, setProgreso] = useState(0);
  const [resultado, setResultado] = useState<{ duracion: string; registros: number; indices: number; nota: string } | null>(null);

  const motivoValido = motivo.trim().length >= 10;
  const textoValido = texto === 'REORGANIZAR';
  const habilitado = respaldo && motivoValido && textoValido;

  useEffect(() => {
    if (fase !== 'ejecutando') return;
    const id = window.setInterval(() => setProgreso(p => Math.min(100, p + 4)), 200);
    return () => window.clearInterval(id);
  }, [fase]);

  useEffect(() => {
    if (fase !== 'ejecutando' || progreso < 100) return;
    const t = window.setTimeout(() => {
      setFase('completado');
      setResultado({
        duracion: '4,2 s',
        registros: 14520,
        indices: 6,
        nota: `Nota de auditoría BIT-2026-0297 — usuario ${USUARIO.nombre} (${USUARIO.rol}), motivo registrado, operación verificada.`,
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [fase, progreso]);

  function confirmar() {
    setShowModal(false);
    setFase('ejecutando');
    setProgreso(0);
    setResultado(null);
  }

  function volverEnLinea() {
    setFase('en-linea');
    setProgreso(0);
    setResultado(null);
    setRespaldo(false);
    setMotivo('');
    setTexto('');
  }

  const pasoActual = PASOS.find(p => progreso <= p.hasta)?.texto ?? PASOS[PASOS.length - 1].texto;

  return (
    <div className="mx-auto max-w-6xl space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Administración / Reorganización de datos</div>
          <h1 className="text-lg font-semibold text-gray-800">Reorganización de índices / compactación</h1>
          <p className="mt-1 text-xs text-gray-500">Operación de mantenimiento exclusiva: excluye a los demás usuarios y requiere respaldo previo verificado.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
      </div>

      {/* Banner de estado */}
      {fase === 'ejecutando' && (
        <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="text-base leading-none mt-0.5">🔧</span>
            <div className="flex-1">
              <div className="text-xs font-semibold text-amber-800">Modo mantenimiento activo</div>
              <p className="text-xs text-amber-700 mt-0.5">Acceso exclusivo: los demás usuarios están excluidos del sistema hasta terminar.</p>
              <div className="mt-3 h-2 w-full rounded-full bg-amber-200 overflow-hidden">
                <div className="h-full bg-petroleum-500 transition-all duration-200" style={{ width: `${progreso}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-amber-700">
                <span className="font-mono">{pasoActual}</span>
                <span className="font-mono font-semibold">{progreso}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {fase === 'completado' && resultado && (
        <div className="space-y-3">
          <div className="rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            ✓ Reorganización completada correctamente en {resultado.duracion}. El sistema vuelve a estar disponible para todos los usuarios.
          </div>
          <div className="rounded border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800">{resultado.nota}</div>
        </div>
      )}

      {/* Tarjeta principal */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-5 py-3">
          <span className="text-sm font-semibold text-petroleum-900">Reorganización de índices / compactación</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            fase === 'en-linea' ? 'bg-green-100 text-green-700' : fase === 'ejecutando' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {fase === 'en-linea' ? 'En línea' : fase === 'ejecutando' ? 'Mantenimiento' : 'Completado'}
          </span>
        </div>

        <div className="space-y-3 p-4">
          <p className="text-xs leading-relaxed text-gray-500">
            La reorganización reindexa las tablas contables y compacta los registros eliminados. Se ejecuta en modo mantenimiento
            exclusivo: los demás usuarios no pueden operar mientras dure el proceso.
          </p>

          <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
            <legend className="px-2 text-xs font-semibold text-petroleum-800">Tablas afectadas</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {TABLAS_AFECTADAS.map(t => (
                <span key={t} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-mono text-gray-600">{t}</span>
              ))}
            </div>
          </fieldset>

          <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
            <legend className="px-2 text-xs font-semibold text-petroleum-800">Requisitos</legend>
            <ul className="mt-2 space-y-1.5 text-xs text-gray-600">
              <li className="flex items-start gap-2"><span className="text-petroleum-500">▸</span> Respaldo íntegro y reciente de la contabilidad (obligatorio).</li>
              <li className="flex items-start gap-2"><span className="text-petroleum-500">▸</span> Exclusividad: sin otros usuarios activos en el sistema.</li>
              <li className="flex items-start gap-2"><span className="text-petroleum-500">▸</span> Motivo justificado de la operación (mínimo 10 caracteres).</li>
              <li className="flex items-start gap-2"><span className="text-petroleum-500">▸</span> Confirmación escrita del texto <span className="font-mono font-semibold">REORGANIZAR</span>.</li>
            </ul>
          </fieldset>

          {resultado && fase === 'completado' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded border border-gray-200 p-3 text-center">
                <div className="text-xs text-gray-400">Duración</div>
                <div className="font-mono text-sm font-semibold text-gray-800 mt-1">{resultado.duracion}</div>
              </div>
              <div className="rounded border border-gray-200 p-3 text-center">
                <div className="text-xs text-gray-400">Registros compactados</div>
                <div className="font-mono text-sm font-semibold text-gray-800 mt-1">{resultado.registros.toLocaleString('es-CO')}</div>
              </div>
              <div className="rounded border border-gray-200 p-3 text-center">
                <div className="text-xs text-gray-400">Índices reconstruidos</div>
                <div className="font-mono text-sm font-semibold text-gray-800 mt-1">{resultado.indices}</div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-4 rounded-b-lg border-t border-gray-200 bg-gray-50 px-5 py-4">
            {fase === 'en-linea' && (
              <button type="button" onClick={() => setShowModal(true)} className={BUTTON_PRIMARY}>Iniciar mantenimiento</button>
            )}
            {fase === 'completado' && (
              <button type="button" onClick={volverEnLinea} className={BUTTON_PRIMARY}>Volver al estado normal</button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de riesgo */}
      {showModal && (
        <Modal title="Reorganización de índices / compactación" onClose={() => setShowModal(false)}>
          <div className="space-y-4 p-5">
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-700">
              Operación de alto riesgo: detiene el servicio contable para los demás usuarios y compacta registros eliminados.
              No puede deshacerse parcialmente — exige un respaldo íntegro y verificado.
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-gray-600">Tablas afectadas</div>
              <div className="flex flex-wrap gap-1.5">
                {TABLAS_AFECTADAS.map(t => (
                  <span key={t} className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-mono text-gray-600">{t}</span>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 rounded border border-gray-200 px-3 py-2.5 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={respaldo}
                onChange={e => setRespaldo(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-petroleum-500"
              />
              <span>Confirmo que existe un <strong>respaldo íntegro y reciente</strong> de la contabilidad (obligatorio).</span>
            </label>
            <div>
              <label htmlFor="reorg-motivo" className="mb-1 block text-xs font-medium text-gray-600">
                Motivo de la operación <span className="text-gray-400">({Math.max(0, 10 - motivo.trim().length)} caracteres restantes)</span>
              </label>
              <textarea
                id="reorg-motivo"
                data-initial-focus
                rows={3}
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Describa por qué se requiere reorganizar los datos (mínimo 10 caracteres)"
                className={`${INPUT} font-mono`}
              />
            </div>
            <div>
              <label htmlFor="reorg-texto" className="mb-1 block text-xs font-medium text-gray-600">Escriba <span className="font-mono font-semibold">REORGANIZAR</span> para confirmar</label>
              <input
                id="reorg-texto"
                value={texto}
                onChange={e => setTexto(e.target.value)}
                placeholder="REORGANIZAR"
                className={`${INPUT} font-mono`}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
            <button type="button" onClick={() => setShowModal(false)} className={BUTTON_SECONDARY}>Cancelar</button>
            <button type="button" onClick={confirmar} disabled={!habilitado} className={`${BUTTON_PRIMARY} disabled:cursor-not-allowed disabled:opacity-50`}>
              Confirmar reorganización
            </button>
          </div>
          {!habilitado && (
            <p className="px-5 pb-4 text-xs text-gray-400">
              El botón se habilita al marcar el respaldo, escribir un motivo de al menos 10 caracteres y el texto REORGANIZAR.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
