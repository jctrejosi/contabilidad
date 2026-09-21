/** Cliente del asistente contable (servicio `ia-service`).
 *
 * El servicio corre en el puerto 8003 y Vite lo expone bajo `/bot-api`
 * (ver `vite.config.ts`), igual que `/api` apunta al backend del puerto 8001.
 */

export interface BotQuickOption {
  id: string;
  label: string;
  message: string;
}

export interface BotChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Contexto de sesión que el asistente recibe para ubicar la conversación. */
export interface BotContext {
  compania?: string;
  companiaNombre?: string;
  periodo?: string;
  usuario?: string;
}

export interface BotChatResponse {
  reply: string;
  session_id: string;
  /** Tablas que las herramientas dejan para el visor (vacío si no hay datos). */
  payload: BotPayload;
}

/** Tipos de dato que el visor usa para formatear y alinear cada celda. */
export type BotColumnaTipo = 'texto' | 'fecha' | 'moneda' | 'entero' | 'estado';

export interface BotPayloadColumna {
  key: string;
  label: string;
  tipo?: BotColumnaTipo;
}

export interface BotPayloadTotal {
  label: string;
  valor: string | number;
  tipo?: BotColumnaTipo;
}

/** Tabla del visor. Varias pueden venir en un mismo turno (una por consulta). */
export interface BotPayloadTabla {
  tipo: 'tabla';
  titulo: string;
  subtitulo?: string;
  columnas: BotPayloadColumna[];
  filas: Record<string, string | number | null>[];
  totales?: BotPayloadTotal[];
  nota?: string;
}

export interface BotPayload {
  bloques?: BotPayloadTabla[];
}

const BOT_API_URL = '/bot-api';

/** Opciones rápidas del widget. Si el servicio no responde, devuelve vacío. */
export async function obtenerOpcionesBot(): Promise<BotQuickOption[]> {
  try {
    const response = await fetch(`${BOT_API_URL}/chat/options`);
    if (!response.ok) return [];
    const body = (await response.json()) as { options?: BotQuickOption[] };
    return body.options ?? [];
  } catch {
    return [];
  }
}

/** Envía un mensaje al asistente y devuelve su respuesta. */
export async function enviarMensajeBot(params: {
  message: string;
  sessionId: string;
  history: BotChatMessage[];
  context?: BotContext;
}): Promise<BotChatResponse> {
  const response = await fetch(`${BOT_API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: params.message,
      session_id: params.sessionId,
      history: params.history,
      context: params.context ?? {},
    }),
  });
  const body = (await response.json().catch(() => null)) as
    | BotChatResponse
    | { detail?: string }
    | null;
  if (!response.ok) {
    const detail = body && 'detail' in body ? body.detail : null;
    throw new Error(detail || 'No fue posible contactar al asistente.');
  }
  return body as BotChatResponse;
}
