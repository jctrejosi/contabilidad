import { useMemo, useState } from 'react';
import {
  leerArchivoImportacion,
  procesarImportacion,
  type ArchivoImportado,
  type ImportacionLotePayload,
  type ResultadoImportacion,
  type ValorArchivo,
} from '../api/importaciones';
import type { LineaLoteWrite } from '../api/lotes';
import type { NavPage } from '../components/Shell';
import { normalizarConceptoImportacion, normalizarFechaImportacion } from '../data/importaciones';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-4 py-2 text-xs font-medium text-white hover:bg-petroleum-600 disabled:cursor-not-allowed disabled:opacity-40';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';
const fmtCOP = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 }).format(value);
const PASOS = ['Archivo', 'Relacionar columnas', 'Previsualizar y crear lote'];

type Campo = keyof LineaLoteWrite;
interface DefinicionCampo { campo: Campo; label: string; obligatorio: boolean; aliases: string[] }
interface FilaPreparada { fila: number; linea: LineaLoteWrite; errores: string[] }

const CAMPOS: DefinicionCampo[] = [
  { campo: 'fecha', label: 'Fecha', obligatorio: true, aliases: ['fecha', 'tfecha'] },
  { campo: 'cuenta', label: 'Cuenta', obligatorio: true, aliases: ['cuenta', 'codigo', 'codcuenta'] },
  { campo: 'nit', label: 'Tercero', obligatorio: false, aliases: ['nit', 'tercero', 'ccodigo'] },
  { campo: 'centro', label: 'Centro de costo', obligatorio: false, aliases: ['centro', 'centrocosto', 'tfase'] },
  { campo: 'comprobante', label: 'Comprobante', obligatorio: true, aliases: ['comprobante', 'tcompr', 'tipo comprobante'] },
  { campo: 'tipoDocumento', label: 'Tipo de documento', obligatorio: true, aliases: ['tipodocumento', 'tipo', 'tipodoc'] },
  { campo: 'documento', label: 'Número de documento', obligatorio: true, aliases: ['documento', 'tdocum', 'numero documento'] },
  { campo: 'documentoAfectado', label: 'Documento afectado', obligatorio: false, aliases: ['documentoafectado', 'tdocum2', 'doc afectado'] },
  { campo: 'debito', label: 'Débito', obligatorio: true, aliases: ['debito', 'debe'] },
  { campo: 'credito', label: 'Crédito', obligatorio: true, aliases: ['credito', 'haber'] },
  { campo: 'base', label: 'Base', obligatorio: false, aliases: ['base', 'base retencion'] },
  { campo: 'concepto', label: 'Concepto', obligatorio: true, aliases: ['concepto', 'detalle', 'descripcion'] },
];

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sugerirMapeo(columnas: string[]): Record<Campo, string> {
  return Object.fromEntries(CAMPOS.map(definicion => {
    const encontrada = columnas.find(columna => definicion.aliases.some(alias => normalizar(columna) === normalizar(alias)));
    return [definicion.campo, encontrada ?? ''];
  })) as Record<Campo, string>;
}

function texto(value: ValorArchivo | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function dinero(value: ValorArchivo | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let raw = texto(value).replace(/\s/g, '').replace(/\$/g, '');
  if (!raw) return 0;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  if (comma > dot) raw = raw.replace(/\./g, '').replace(',', '.');
  else if (dot > comma && comma >= 0) raw = raw.replace(/,/g, '');
  else if (comma >= 0) raw = /^-?\d{1,3}(,\d{3})+$/.test(raw) ? raw.replace(/,/g, '') : raw.replace(',', '.');
  else if (dot >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, '');
  const result = Number(raw);
  return Number.isFinite(result) ? result : Number.NaN;
}

function prepararFilas(datos: ArchivoImportado | null, mapeo: Record<Campo, string>): FilaPreparada[] {
  if (!datos) return [];
  return datos.filas.map((raw, index) => {
    const value = (field: Campo) => raw[mapeo[field]];
    const line: LineaLoteWrite = {
      fecha: normalizarFechaImportacion(value('fecha')),
      cuenta: texto(value('cuenta')).replace(/\.0$/, ''),
      nit: texto(value('nit')).replace(/\.0$/, ''),
      centro: texto(value('centro')).replace(/\.0$/, ''),
      comprobante: texto(value('comprobante')).replace(/\.0$/, '').toUpperCase().padStart(2, '0'),
      tipoDocumento: texto(value('tipoDocumento')).toUpperCase(),
      documento: texto(value('documento')).replace(/\.0$/, ''),
      documentoAfectado: texto(value('documentoAfectado')).replace(/\.0$/, ''),
      debito: dinero(value('debito')),
      credito: dinero(value('credito')),
      base: dinero(value('base')),
      concepto: normalizarConceptoImportacion(value('concepto')),
    };
    const errores: string[] = [];
    if (!line.fecha) errores.push('Fecha inválida');
    if (!/^\d{1,12}$/.test(line.cuenta)) errores.push('Cuenta inválida');
    if (!line.comprobante || line.comprobante.length > 2) errores.push('Comprobante inválido');
    if (!line.tipoDocumento || line.tipoDocumento.length > 2) errores.push('Tipo documental inválido');
    if (!line.documento || line.documento.length > 12) errores.push('Documento inválido');
    if (!line.concepto) errores.push('El concepto está vacío');
    if (![line.debito, line.credito, line.base].every(Number.isFinite)) errores.push('Valor no numérico');
    if (line.debito < 0 || line.credito < 0 || line.base < 0) errores.push('Los valores no pueden ser negativos');
    if ((line.debito > 0 && line.credito > 0) || (line.debito === 0 && line.credito === 0)) errores.push('Debe tener débito o crédito, no ambos');
    if (line.nit.length > 11) errores.push('El tercero supera 11 caracteres');
    if (line.centro.length > 7) errores.push('El centro supera 7 caracteres');
    return { fila: index + 2, linea: line, errores };
  });
}

interface Props { cia: string; onNavigate: (page: NavPage) => void }

export default function Importaciones({ cia, onNavigate }: Props) {
  const [paso, setPaso] = useState(0);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [datos, setDatos] = useState<ArchivoImportado | null>(null);
  const [mapeo, setMapeo] = useState<Record<Campo, string>>(() => sugerirMapeo([]));
  const [lote, setLote] = useState('IMP1');
  const [nombre, setNombre] = useState('Importación contable');
  const [mes, setMes] = useState('01');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [creado, setCreado] = useState<ResultadoImportacion | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  const filas = useMemo(() => prepararFilas(datos, mapeo), [datos, mapeo]);
  const erroresLocales = filas.reduce((total, row) => total + row.errores.length, 0);
  const totalDebito = filas.reduce((total, row) => total + (Number.isFinite(row.linea.debito) ? row.linea.debito : 0), 0);
  const totalCredito = filas.reduce((total, row) => total + (Number.isFinite(row.linea.credito) ? row.linea.credito : 0), 0);
  const obligatoriosMapeados = CAMPOS.filter(field => field.obligatorio).every(field => mapeo[field.campo]);

  async function leer(file: File, sheet = '') {
    setCargando(true);
    setError('');
    setCreado(null);
    try {
      const response = await leerArchivoImportacion(file, sheet);
      setArchivo(file);
      setDatos(response);
      setMapeo(sugerirMapeo(response.columnas));
      setPaso(1);
    } catch (cause: unknown) {
      setDatos(null);
      setError(cause instanceof Error ? cause.message : 'No fue posible leer el archivo.');
    } finally {
      setCargando(false);
    }
  }

  function payload(): ImportacionLotePayload {
    return {
      lote: lote.trim().toUpperCase(), nombre: nombre.trim(), mes, usuario: 'WEB',
      lineas: filas.map(row => row.linea),
    };
  }

  async function crearLote() {
    setConfirmar(false);
    setCargando(true);
    setError('');
    try {
      const result = await procesarImportacion(cia, payload(), false);
      setCreado(result);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'No fue posible crear el lote.');
    } finally {
      setCargando(false);
    }
  }

  return <div className="max-w-screen-2xl space-y-4 p-4">
    <div><div className="mb-1 text-xs text-gray-400">Movimientos / Importaciones</div><h1 className="text-lg font-semibold text-gray-800">Importación de movimientos</h1><p className="mt-1 text-xs text-gray-500">Prepare un lote contable desde un archivo, revíselo y actualícelo posteriormente desde la opción Lotes.</p></div>

    <div className="flex items-center gap-2 overflow-x-auto">{PASOS.map((label, index) => <div key={label} className="flex shrink-0 items-center gap-2"><button type="button" disabled={index > paso || cargando || !!creado} onClick={() => setPaso(index)} className={`rounded px-3 py-1.5 text-xs font-medium ${index === paso ? 'bg-petroleum-500 text-white' : index < paso ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{index < paso ? '✓' : index + 1} · {label}</button>{index < PASOS.length - 1 && <span className="text-gray-300">›</span>}</div>)}</div>
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

    {paso === 0 && <div className="space-y-4 rounded border border-gray-200 bg-white p-5"><div><label className="mb-1 block text-xs font-medium text-gray-700">Archivo de movimientos</label><input type="file" accept=".xlsx,.csv,.txt,.adt" disabled={cargando} onChange={event => { const file = event.target.files?.[0]; if (file) void leer(file); }} className={`${INPUT} file:mr-3 file:rounded file:border-0 file:bg-petroleum-50 file:px-3 file:py-1 file:text-xs file:text-petroleum-700`} /><p className="mt-2 text-xs text-gray-500">Formatos permitidos: XLSX, CSV, TXT y ADT. La primera fila de archivos tabulares debe contener los nombres de las columnas.</p></div>{cargando && <p className="text-xs text-petroleum-700">Leyendo y preparando el archivo…</p>}</div>}

    {paso === 1 && datos && <div className="space-y-4 rounded border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-3"><div className="min-w-64 flex-1"><div className="text-xs font-semibold text-gray-700">{datos.archivo}</div><div className="mt-1 text-xs text-gray-500">{datos.filas.length} filas · {datos.columnas.length} columnas</div></div>{datos.hojas.length > 1 && <div><label className="mb-1 block text-xs font-medium text-gray-600">Hoja</label><select value={datos.hoja} onChange={event => archivo && void leer(archivo, event.target.value)} className={INPUT}>{datos.hojas.map(sheet => <option key={sheet}>{sheet}</option>)}</select></div>}</div>
      {datos.truncado && <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">El archivo supera 5.000 filas. Divídalo en varios lotes antes de continuar.</div>}
      <fieldset className="rounded border border-gray-200 px-3 pb-3"><legend className="px-2 text-xs font-semibold text-petroleum-800">Relación de columnas</legend><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{CAMPOS.map(field => <div key={field.campo}><label className="mb-1 block text-xs font-medium text-gray-600">{field.label}{field.obligatorio && <span className="text-red-500"> *</span>}</label><select value={mapeo[field.campo]} onChange={event => setMapeo(current => ({ ...current, [field.campo]: event.target.value }))} className={INPUT}><option value="">— No incluida —</option>{datos.columnas.map(column => <option key={column} value={column}>{column}</option>)}</select></div>)}</div></fieldset>
      <div className="flex justify-between"><button type="button" onClick={() => setPaso(0)} className={BUTTON_SECONDARY}>← Cambiar archivo</button><button type="button" disabled={!obligatoriosMapeados || datos.truncado} onClick={() => { const first = filas.find(row => row.linea.fecha)?.linea.fecha; if (first) setMes(first.slice(5, 7)); setPaso(2); }} className={BUTTON_PRIMARY}>Previsualizar →</button></div>
    </div>}

    {paso === 2 && datos && <div className="space-y-4">
      <div className="overflow-hidden rounded border border-gray-200 bg-white"><div className="flex flex-wrap items-center justify-between gap-2 border-b bg-gray-50 px-4 py-3"><span className="text-xs font-semibold text-gray-700">Previsualización de {filas.length} partidas</span><span className={`text-xs font-medium ${erroresLocales ? 'text-red-600' : 'text-green-700'}`}>{erroresLocales ? `${erroresLocales} observaciones de formato` : 'Formato básico correcto'}</span></div><div className="max-h-[28rem] overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-gray-50"><tr>{['Fila', 'Fecha', 'Cuenta', 'Tercero', 'Centro', 'Comp.', 'Tipo', 'Documento', 'Débito', 'Crédito', 'Concepto', 'Estado'].map((title, index) => <th key={title} className={`whitespace-nowrap px-3 py-2 font-semibold text-gray-600 ${index === 8 || index === 9 ? 'text-right' : 'text-left'}`}>{title}</th>)}</tr></thead><tbody className="divide-y">{filas.map(row => <tr key={row.fila} className={row.errores.length ? 'bg-red-50' : ''}><td className="px-3 py-2 font-mono text-gray-500">{row.fila}</td><td className="px-3 py-2 font-mono">{row.linea.fecha || '—'}</td><td className="px-3 py-2 font-mono">{row.linea.cuenta || '—'}</td><td className="px-3 py-2 font-mono">{row.linea.nit || '—'}</td><td className="px-3 py-2">{row.linea.centro || '—'}</td><td className="px-3 py-2">{row.linea.comprobante}</td><td className="px-3 py-2">{row.linea.tipoDocumento}</td><td className="px-3 py-2 font-mono">{row.linea.documento}</td><td className="px-3 py-2 text-right font-mono">{row.linea.debito ? fmtCOP(row.linea.debito) : '—'}</td><td className="px-3 py-2 text-right font-mono">{row.linea.credito ? fmtCOP(row.linea.credito) : '—'}</td><td title={row.linea.concepto} className="max-w-56 truncate px-3 py-2">{row.linea.concepto}</td><td className={`px-3 py-2 ${row.errores.length ? 'text-red-700' : 'text-green-700'}`}>{row.errores.join(' · ') || 'Lista'}</td></tr>)}</tbody><tfoot className="sticky bottom-0 border-t bg-gray-50"><tr><td colSpan={8} className="px-3 py-2 text-right font-semibold">Totales</td><td className="px-3 py-2 text-right font-mono font-semibold">{fmtCOP(totalDebito)}</td><td className="px-3 py-2 text-right font-mono font-semibold">{fmtCOP(totalCredito)}</td><td colSpan={2} className={`px-3 py-2 font-medium ${Math.abs(totalDebito - totalCredito) < 0.01 ? 'text-green-700' : 'text-red-700'}`}>{Math.abs(totalDebito - totalCredito) < 0.01 ? 'Cuadrado' : `Diferencia ${fmtCOP(Math.abs(totalDebito - totalCredito))}`}</td></tr></tfoot></table></div></div>
      <div className="rounded border border-gray-200 bg-white p-4"><fieldset className="rounded border border-gray-200 px-3 pb-3"><legend className="px-2 text-xs font-semibold text-petroleum-800">Lote de revisión</legend><div className="grid gap-3 sm:grid-cols-3"><div><label className="mb-1 block text-xs font-medium text-gray-600">Código</label><input value={lote} maxLength={4} onChange={event => setLote(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} className={`${INPUT} font-mono uppercase`} /></div><div><label className="mb-1 block text-xs font-medium text-gray-600">Mes</label><select value={mes} onChange={event => setMes(event.target.value)} className={INPUT}>{Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map(value => <option key={value}>{value}</option>)}</select></div><div><label className="mb-1 block text-xs font-medium text-gray-600">Nombre</label><input value={nombre} maxLength={25} onChange={event => setNombre(event.target.value)} className={INPUT} /><div className="mt-1 text-right text-[11px] text-gray-400">{nombre.length}/25</div></div></div></fieldset><div className="mt-3 flex justify-between"><button type="button" onClick={() => setPaso(1)} className={BUTTON_SECONDARY}>← Ajustar columnas</button><button type="button" disabled={cargando || erroresLocales > 0 || filas.length < 2 || lote.length !== 4 || !nombre.trim() || nombre.trim().length > 25} onClick={() => setConfirmar(true)} className={BUTTON_PRIMARY}>Crear lote para revisión</button></div></div>
    </div>}

    {confirmar && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"><h2 className="text-base font-semibold text-gray-900">Confirmar importación</h2><p className="mt-2 text-sm text-gray-600">Se creará el lote <strong>{lote}</strong> con {filas.length} partidas. Quedará en estado Borrador para revisarlo, verificarlo y actualizarlo desde Lotes.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConfirmar(false)} className={BUTTON_SECONDARY}>Cancelar</button><button type="button" onClick={() => void crearLote()} className={BUTTON_PRIMARY}>Confirmar y crear lote</button></div></div></div>}

    {creado && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"><div className="text-3xl text-green-600">✓</div><h2 className="mt-2 text-base font-semibold text-gray-900">Lote creado correctamente</h2><p className="mt-2 text-sm text-gray-600">El lote <strong>{creado.lote}</strong> quedó en Borrador con {creado.items} partidas. Revíselo y utilice Verificar antes de Actualizar.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCreado(null)} className={BUTTON_SECONDARY}>Permanecer aquí</button><button type="button" onClick={() => onNavigate('movimientos/lotes')} className={BUTTON_PRIMARY}>Abrir Lotes</button></div></div></div>}
  </div>;
}
