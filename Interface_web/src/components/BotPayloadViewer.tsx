import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BotColumnaTipo, BotPayloadTabla, BotPayloadTotal } from '../api/bot';

/** Duración de la animación de cierre; debe coincidir con `.bot-visor-*`. */
const CLOSE_ANIMATION_MS = 200;

const MONEDA = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 2,
});
const NUMERO = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/** Formatea una celda según el tipo declarado por la herramienta que la produjo. */
function formatear(valor: unknown, tipo?: BotColumnaTipo): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (tipo === 'moneda' || tipo === 'entero') {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return String(valor);
    return tipo === 'moneda' ? MONEDA.format(numero) : NUMERO.format(numero);
  }
  if (tipo === 'fecha') {
    const [anio, mes, dia] = String(valor).split('-');
    return dia && mes && anio ? `${dia}/${mes}/${anio}` : String(valor);
  }
  return String(valor);
}

function claseCelda(tipo?: BotColumnaTipo): string {
  switch (tipo) {
    case 'moneda':
    case 'entero':
      return 'text-right tabular-nums whitespace-nowrap';
    case 'estado':
      return 'text-center whitespace-nowrap';
    case 'fecha':
      return 'whitespace-nowrap';
    default:
      return '';
  }
}

function Total({ total }: { total: BotPayloadTotal }) {
  const afirmativo = total.tipo === 'estado' && total.valor === 'Sí';
  return (
    <span className="text-gray-500">
      {total.label}:{' '}
      <span
        className={`font-semibold tabular-nums ${
          total.tipo === 'estado' ? (afirmativo ? 'text-green-600' : 'text-red-600') : 'text-gray-800'
        }`}
      >
        {formatear(total.valor, total.tipo)}
      </span>
    </span>
  );
}

interface BotPayloadViewerProps {
  /** `false` dispara la animación de salida antes de desmontar. */
  open: boolean;
  bloques: BotPayloadTabla[];
  onClose: () => void;
}

/**
 * Visor de datos del asistente: muestra en un modal, con tablas reales, lo que
 * las herramientas dejaron en el `payload`. Se abre con el botón "Ver tabla"
 * de cada respuesta, así el chat queda corto y los datos se leen cómodos.
 */
export default function BotPayloadViewer({ open, bloques, onClose }: BotPayloadViewerProps) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), CLOSE_ANIMATION_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes botVisorIn {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes botVisorOut {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes botVisorCardIn {
          0%   { transform: translateY(12px) scale(0.98); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes botVisorCardOut {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(12px) scale(0.98); opacity: 0; }
        }
        .bot-visor-in       { animation: botVisorIn 0.2s ease-out both; }
        .bot-visor-out      { animation: botVisorOut ${CLOSE_ANIMATION_MS}ms ease-in both; }
        .bot-visor-card-in  { animation: botVisorCardIn 0.24s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .bot-visor-card-out { animation: botVisorCardOut ${CLOSE_ANIMATION_MS}ms ease-in both; }
        @media (prefers-reduced-motion: reduce) {
          .bot-visor-in, .bot-visor-out, .bot-visor-card-in, .bot-visor-card-out { animation-duration: 1ms; }
        }
      `}</style>

      <div
        className={`fixed inset-0 z-70 bg-black/50 ${open ? 'bot-visor-in' : 'bot-visor-out'}`}
        onClick={onClose}
      />

      <div className="fixed inset-0 z-71 flex items-center justify-center p-3 sm:p-6 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Datos de la consulta"
          className={`pointer-events-auto w-full max-w-6xl max-h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
            open ? 'bot-visor-card-in' : 'bot-visor-card-out'
          }`}
        >
          <div className="shrink-0 px-4 sm:px-5 py-3 flex items-center gap-3 text-white bg-petroleum-900">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">Datos de la consulta</p>
              <p className="text-[11px] text-petroleum-200">
                {bloques.length === 1 ? '1 tabla' : `${bloques.length} tablas`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Cerrar"
              aria-label="Cerrar visor de datos"
              className="p-1.5 rounded transition-colors hover:bg-white/10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-6 bg-gray-50">
            {bloques.map((bloque, i) => (
              <section key={`${bloque.titulo}-${i}`}>
                <h3 className="text-sm font-semibold text-gray-800">{bloque.titulo}</h3>
                {bloque.subtitulo && (
                  <p className="mt-0.5 text-xs text-gray-500">{bloque.subtitulo}</p>
                )}

                <div className="mt-2 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-100 text-gray-600">
                      <tr>
                        {bloque.columnas.map(columna => (
                          <th
                            key={columna.key}
                            className={`px-3 py-2 font-semibold ${claseCelda(columna.tipo)}`}
                          >
                            {columna.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bloque.filas.length === 0 ? (
                        <tr>
                          <td
                            colSpan={bloque.columnas.length}
                            className="px-3 py-6 text-center text-gray-400"
                          >
                            Sin datos para estos filtros.
                          </td>
                        </tr>
                      ) : (
                        bloque.filas.map((fila, j) => (
                          <tr key={j} className="hover:bg-gray-50">
                            {bloque.columnas.map(columna => (
                              <td
                                key={columna.key}
                                className={`px-3 py-1.5 text-gray-700 ${claseCelda(columna.tipo)}`}
                              >
                                {formatear(fila[columna.key], columna.tipo)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {bloque.totales && bloque.totales.length > 0 && (
                    <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                      {bloque.totales.map((total, k) => (
                        <Total key={k} total={total} />
                      ))}
                    </div>
                  )}
                </div>

                {bloque.nota && <p className="mt-1 text-[11px] text-gray-400">{bloque.nota}</p>}
              </section>
            ))}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
