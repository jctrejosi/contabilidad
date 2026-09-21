import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CompaniaSesion } from '../types';
import {
  enviarMensajeBot,
  obtenerOpcionesBot,
  type BotChatMessage,
  type BotQuickOption,
} from '../api/bot';

/** Mismo logo del bot que usa el ecommerce (Daisy), servido desde `public/`. */
const LOGO_BOT = `${import.meta.env.BASE_URL}logo-bot.png`;

/** Duración de la animación de cierre; debe coincidir con `.bot-panel-out`. */
const CLOSE_ANIMATION_MS = 200;

/** Sesión nueva por conversación; el asistente no guarda estado entre pestañas. */
function nuevoSessionId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface BotChatProps {
  compania?: CompaniaSesion | null;
  /** Periodo activo, p. ej. "2026 · Febrero 2026". */
  periodo?: string;
  usuario?: string;
}

/**
 * Botón del encabezado + panel de chat del asistente contable.
 *
 * El panel se despliega desde el lado derecho (debajo del encabezado) y se
 * monta en un portal para no quedar atrapado en el contexto de apilamiento del
 * header.
 */
export default function BotChat({ compania, periodo, usuario }: BotChatProps) {
  const [open, setOpen] = useState(false);
  // `mounted` mantiene el portal en el DOM mientras corre la animación de
  // cierre; sin esto el panel desaparecería de golpe al cerrar.
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<BotQuickOption[]>([]);

  const sessionRef = useRef<string>(nuevoSessionId());
  const historyRef = useRef<BotChatMessage[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    obtenerOpcionesBot().then(setOptions).catch(() => {});
  }, []);

  // Montaje diferido al cerrar: deja ver la animación de salida antes de
  // desmontar el portal.
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
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const enviar = useCallback(
    async (raw: string) => {
      const texto = raw.trim();
      if (!texto || loading) return;
      setInput('');
      setMessages(prev => [...prev, { role: 'user', content: texto }]);
      historyRef.current.push({ role: 'user', content: texto });
      setLoading(true);
      try {
        const respuesta = await enviarMensajeBot({
          message: texto,
          sessionId: sessionRef.current,
          history: historyRef.current.slice(-12),
          context: {
            compania: compania?.codigo,
            companiaNombre: compania?.nombre,
            periodo,
            usuario,
          },
        });
        if (respuesta.session_id) sessionRef.current = respuesta.session_id;
        setMessages(prev => [...prev, { role: 'assistant', content: respuesta.reply }]);
        historyRef.current.push({ role: 'assistant', content: respuesta.reply });
      } catch {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content:
              'No pude conectar con el asistente en este momento. Inténtalo de nuevo en unos segundos.',
          },
        ]);
      } finally {
        setLoading(false);
        inputRef.current?.focus();
      }
    },
    [loading, compania, periodo, usuario],
  );

  const reiniciar = useCallback(() => {
    sessionRef.current = nuevoSessionId();
    historyRef.current = [];
    setMessages([]);
    setInput('');
  }, []);

  const mostrarOpciones = messages.length === 0 && options.length > 0 && !loading;

  return (
    <>
      {/* Botón del encabezado, al lado del usuario */}
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        title="Asistente contable"
        aria-label="Abrir asistente contable"
        aria-expanded={open}
        className="relative p-1 rounded-full transition-colors hover:bg-gray-100"
      >
        <img
          src={LOGO_BOT}
          alt="Daisy, asistente contable"
          className="w-9 h-9 rounded-full object-cover"
        />
        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
      </button>

      {mounted &&
        createPortal(
          <>
            <style>{`
              @keyframes botPanelIn {
                0%   { transform: translateX(100%); opacity: 0; }
                100% { transform: translateX(0); opacity: 1; }
              }
              @keyframes botPanelOut {
                0%   { transform: translateX(0); opacity: 1; }
                100% { transform: translateX(100%); opacity: 0; }
              }
              @keyframes botFadeIn {
                0%   { opacity: 0; }
                100% { opacity: 1; }
              }
              @keyframes botFadeOut {
                0%   { opacity: 1; }
                100% { opacity: 0; }
              }
              @keyframes botMessageIn {
                0%   { transform: translateY(4px); opacity: 0; }
                100% { transform: translateY(0); opacity: 1; }
              }
              .bot-panel-in     { animation: botPanelIn 0.26s cubic-bezier(0.22, 1, 0.36, 1) both; }
              .bot-panel-out    { animation: botPanelOut ${CLOSE_ANIMATION_MS}ms ease-in both; }
              .bot-backdrop-in  { animation: botFadeIn 0.2s ease-out both; }
              .bot-backdrop-out { animation: botFadeOut ${CLOSE_ANIMATION_MS}ms ease-in both; }
              @media (prefers-reduced-motion: reduce) {
                .bot-panel-in, .bot-panel-out, .bot-backdrop-in, .bot-backdrop-out { animation-duration: 1ms; }
              }
            `}</style>

            {/* Fondo a pantalla completa: cierra al hacer clic fuera */}
            <div
              className={`fixed inset-0 z-60 bg-black/30 ${
                open ? 'bot-backdrop-in' : 'bot-backdrop-out'
              }`}
              onClick={() => setOpen(false)}
            />

            {/* Panel desplegado al lado derecho, a altura completa */}
            <aside
              className={`fixed right-0 inset-y-0 z-61 w-full max-w-95 bg-white shadow-2xl border-l border-gray-200 flex flex-col ${
                open ? 'bot-panel-in' : 'bot-panel-out'
              }`}
              role="dialog"
              aria-label="Asistente contable"
            >
              {/* Encabezado del panel */}
              <div
                className="shrink-0 px-4 py-3 flex items-center gap-2.5 text-white bg-petroleum-900"
              >
                <img
                  src={LOGO_BOT}
                  alt=""
                  className="w-11 h-11 rounded-full object-cover bg-white shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">Daisy</p>
                  <p className="text-[11px] flex items-center gap-1 text-petroleum-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Asistente contable de CONTABDSI
                  </p>
                </div>
                <button
                  type="button"
                  onClick={reiniciar}
                  title="Nueva conversación"
                  aria-label="Nueva conversación"
                  className="p-1.5 rounded transition-colors hover:bg-white/10"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  title="Cerrar"
                  aria-label="Cerrar asistente"
                  className="p-1.5 rounded transition-colors hover:bg-white/10"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Conversación */}
              <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-gray-50">
                {messages.length === 0 && (
                  <div className="text-sm text-gray-600 leading-relaxed">
                    <p>¡Hola! 👋 Soy Daisy, tu asistente contable de CONTABDSI.</p>
                    <p className="mt-1">
                      Te ayudo a entender el flujo contable: comprobantes, lotes,
                      contabilización, informes, impuestos y configuración.
                    </p>
                    {(compania || periodo) && (
                      <p className="mt-2 text-xs text-gray-400">
                        Contexto: {[compania?.nombre, periodo].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-400">Elige una opción o escríbeme:</p>
                  </div>
                )}

                {messages.map((mensaje, i) =>
                  mensaje.role === 'user' ? (
                    <div key={i} className="flex justify-end" style={{ animation: 'botMessageIn 0.18s ease-out both' }}>
                      <div
                        className="max-w-[85%] bg-petroleum-900 text-white text-sm px-3.5 py-2 rounded-2xl rounded-br-md whitespace-pre-wrap"
                      >
                        {mensaje.content}
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex justify-start" style={{ animation: 'botMessageIn 0.18s ease-out both' }}>
                      <div className="max-w-[90%] bg-white border border-black/5 text-gray-800 text-sm px-3.5 py-2 rounded-2xl rounded-bl-md whitespace-pre-wrap shadow-sm">
                        {mensaje.content}
                      </div>
                    </div>
                  ),
                )}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-black/5 px-4 py-2.5 rounded-2xl rounded-bl-md shadow-sm flex gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:120ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:240ms]" />
                    </div>
                  </div>
                )}
              </div>

              {/* Opciones rápidas, mientras no haya conversación */}
              {mostrarOpciones && (
                <div className="px-3 pb-2 flex flex-col gap-1.5 bg-gray-50">
                  {options.map(opcion => (
                    <button
                      key={opcion.id}
                      type="button"
                      onClick={() => enviar(opcion.message)}
                      className="text-left text-xs font-medium px-3 py-2 rounded-xl bg-white border border-gray-200 transition-colors hover:border-petroleum-500 hover:bg-petroleum-50 text-petroleum-900"
                    >
                      {opcion.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Entrada */}
              <div className="p-3 border-t border-gray-200 bg-white shrink-0">
                <form
                  onSubmit={event => {
                    event.preventDefault();
                    void enviar(input);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={event => setInput(event.target.value)}
                    placeholder="Escribe tu pregunta contable..."
                    className="flex-1 text-sm px-3.5 py-2.5 rounded-xl bg-gray-100 focus:outline-none focus:ring-2"
                    style={{ '--tw-ring-color': '#0073C0' } as React.CSSProperties}
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    aria-label="Enviar"
                    className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-40 transition-colors shrink-0 bg-petroleum-500 text-white"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3.4 20.4l17.45-7.48a1 1 0 0 0 0-1.84L3.4 3.6a.993.993 0 0 0-1.39.91L2 9.12c0 .5.37.93.87.99L17 12 2.87 13.88c-.5.07-.87.5-.87 1l.01 4.61c0 .71.73 1.2 1.39.91z" />
                    </svg>
                  </button>
                </form>
              </div>
            </aside>
          </>,
          document.body,
        )}
    </>
  );
}
