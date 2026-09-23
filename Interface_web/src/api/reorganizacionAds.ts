/** Mantenimiento real de los índices existentes en el diccionario Advantage. */
export interface IndiceAds {
  nombre: string;
  archivo: string;
  expresion: string;
  condicion: string;
  opciones: number;
  longitud: number;
}

export interface PlanReorganizacion {
  tablas: Array<{ tabla: string; indices: IndiceAds[] }>;
  ausentes: string[];
  inaccesibles: Array<{
    tabla: string;
    motivo: string;
    reconstruible: boolean;
    archivosFaltantes: string[];
  }>;
  totalIndices: number;
  huella: string;
}

export interface EstadoReorganizacion {
  id: string;
  tipo?: 'crearIndice';
  nombreIndice?: string;
  estado: 'Ejecutando' | 'Completada' | 'Fallida';
  inicio: string;
  fin: string | null;
  segundos: number | null;
  tablaActual: string | null;
  totalTablas: number;
  totalIndices: number;
  resultados: Array<{ tabla: string; estado: string; indices: number; segundos?: number; reconstruido?: boolean }>;
  error: string | null;
}

export interface CatalogoIndicesAds {
  tablas: Array<{ tabla: string; campos: string[] }>;
}

export interface PlanCrearIndice {
  tabla: string;
  nombre: string;
  campos: string[];
  estado: 'pendiente' | 'existente' | 'conflicto';
  motivo: string;
  huella: string;
}

export async function consultarCatalogoIndices(): Promise<CatalogoIndicesAds> {
  return json(await fetch('/api/ads/indices/catalogo'), 'No fue posible consultar las tablas y campos.');
}

export async function consultarPlanCrearIndice(tabla: string, nombre: string, campos: string[]): Promise<PlanCrearIndice> {
  return json(await fetch('/api/ads/indices/plan', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabla, nombre, campos }),
  }), 'No fue posible validar el nuevo índice.');
}

export async function crearIndice(plan: PlanCrearIndice): Promise<EstadoReorganizacion> {
  return json(await fetch('/api/ads/indices', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tabla: plan.tabla, nombre: plan.nombre, campos: plan.campos,
      huella: plan.huella, respaldoConfirmado: true, confirmacion: 'CREAR INDICE' }),
  }), 'No fue posible iniciar la creación del índice.');
}

async function json<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => null) as (T & { detail?: string }) | null;
  if (!response.ok) throw new Error(body?.detail || fallback);
  return body as T;
}

export async function consultarPlanReorganizacion(): Promise<PlanReorganizacion> {
  return json(await fetch('/api/ads/reorganizacion/plan'), 'No fue posible leer los índices de Advantage.');
}

export async function consultarEstadoReorganizacion(): Promise<EstadoReorganizacion | null> {
  return json(await fetch('/api/ads/reorganizacion/estado'), 'No fue posible consultar el estado de la reorganización.');
}

export async function iniciarReorganizacion(huella: string): Promise<EstadoReorganizacion> {
  return json(await fetch('/api/ads/reorganizacion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ huella, respaldoConfirmado: true, confirmacion: 'REORGANIZAR' }),
  }), 'No fue posible iniciar la reorganización.');
}
