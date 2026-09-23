import { useEffect, useId, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { NavPage } from '../components/Shell';
import {
  consultarBalanceComprobacion,
  exportarBalanceComprobacion,
  type BalanceComprobacion,
  type FiltrosBalanceComprobacion,
} from '../api/balanceComprobacion';
import { consultarPeriodoOperacion } from '../api/periodoOperacion';
import { consultarInformeAdicional, exportarInformeAdicional, type FiltrosInformeAdicional, type InformeAdicional } from '../api/informesAdicionales';

// El formato de moneda es de presentación: no depende de los datos de demostración.
const fmtCOP = (n: number): string => `$ ${n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';
const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';

interface Informe {
  id: string;
  nombre: string;
  desc: string;
  page?: NavPage;
}

interface Categoria {
  id: string;
  nombre: string;
  icon: string;
  informes: Informe[];
}

const CATEGORIAS: Categoria[] = [
  {
    id: 'documentos',
    nombre: 'Documentos',
    icon: '📄',
    informes: [
      { id: 'doc-formato', nombre: 'Documento por formato', desc: 'Documentos emitidos según el formato documental configurado' },
      { id: 'doc-planilla', nombre: 'Documento por planilla', desc: 'Documentos agrupados por planilla de generación (nómina, aportes)' },
    ],
  },
  {
    id: 'libros',
    nombre: 'Libros contables',
    icon: '📚',
    informes: [
      { id: 'listado-cuentas', nombre: 'Listado de cuentas', desc: 'Plan de cuentas con atributos de afectabilidad' },
      { id: 'balance-comp-lib', nombre: 'Balance de comprobación acumulado', desc: 'Débitos y créditos acumulados por cuenta — totales cuadrados' },
      { id: 'balance-mensual', nombre: 'Balance mensual', desc: 'Movimiento y saldo por mes' },
      { id: 'acum-corriente', nombre: 'Acumulado corriente/no corriente', desc: 'Saldos clasificados como corrientes o no corrientes' },
      { id: 'aux-gral', nombre: 'Libro auxiliar general', desc: 'Todas las cuentas con movimiento detallado' },
      { id: 'aux-doc-afectado', nombre: 'Auxiliar por documento afectado', desc: 'Movimientos que referencian otro documento' },
      { id: 'mov-comprobante', nombre: 'Movimiento por comprobante', desc: 'Totales de movimiento por comprobante contable' },
      { id: 'inventario-bal', nombre: 'Inventario y balance', desc: 'Saldos iniciales, movimientos y saldos finales por cuenta' },
      { id: 'mayor-bal', nombre: 'Mayor y balance', desc: 'Resumen por cuenta con saldo' },
      { id: 'diario-cta', nombre: 'Diario por cuenta', desc: 'Movimiento ordenado por cuenta' },
      { id: 'caja-diario-comp', nombre: 'Caja diario por comprobante', desc: 'Movimientos de caja menor ordenados por comprobante' },
      { id: 'caja-diario-cta', nombre: 'Caja diario por cuenta', desc: 'Movimientos de caja menor ordenados por cuenta' },
      { id: 'saldos-cuenta', nombre: 'Saldos por cuenta', desc: 'Saldo inicial, movimiento y saldo final de cada cuenta' },
    ],
  },
  {
    id: 'estados',
    nombre: 'Estados y balances',
    icon: '⊟',
    informes: [
      { id: 'balance-comp', nombre: 'Balance de comprobación acumulado', desc: 'Saldos y movimientos acumulados por cuenta — totales cuadrados' },
      { id: 'bal-gral-resultados', nombre: 'Balance general y estado de resultados', desc: 'Estado de situación financiera y resultados del período' },
      { id: 'bal-comparativo-mensual', nombre: 'Balance comparativo mensual', desc: 'Saldos de dos meses comparados con su variación' },
      { id: 'analisis-anual-acum', nombre: 'Análisis anual acumulado', desc: 'Débitos y créditos acumulados en el año' },
      { id: 'analisis-anual-mens', nombre: 'Análisis anual mensual', desc: 'Comportamiento mes a mes del año' },
      { id: 'balance-prueba-anual', nombre: 'Balance de prueba anual', desc: 'Débitos y créditos del año — totales cuadrados' },
      { id: 'mov-tipo-doc', nombre: 'Movimiento por tipo de documento', desc: 'Totales por tipo de documento contable' },
      { id: 'mov-cuenta', nombre: 'Movimiento por cuenta', desc: 'Totales de movimiento por cuenta' },
      { id: 'comp-cta-tercero', nombre: 'Comparativo cuenta-tercero', desc: 'Cruce de cuentas contra terceros' },
      { id: 'resumen-tipo-contribuyente', nombre: 'Resumen por tipo de contribuyente', desc: 'Saldos agrupados por tipo de contribuyente' },
    ],
  },
  {
    id: 'terceros',
    nombre: 'Terceros',
    icon: '👤',
    informes: [
      { id: 'tercero-general', nombre: 'General', desc: 'Listado completo de terceros con saldo y cupo' },
      { id: 'tercero-acumulacion', nombre: 'Acumulación', desc: 'Saldo y movimientos acumulados por tercero' },
      { id: 'tercero-cuenta-tercero', nombre: 'Cuenta-tercero', desc: 'Movimiento por cuenta y tercero' },
      { id: 'tercero-especifico', nombre: 'Tercero específico', desc: 'Detalle de movimiento de un tercero puntual' },
      { id: 'tercero-cumpleanos', nombre: 'Cumpleaños', desc: 'Fechas de cumpleaños de los terceros' },
      { id: 'tercero-etiquetas', nombre: 'Etiquetas', desc: 'Terceros organizados por zona comercial' },
    ],
  },
  {
    id: 'centros',
    nombre: 'Centros de costo',
    icon: '🏢',
    informes: [
      { id: 'diario-rangos-continuos', nombre: 'Diario rangos continuos', desc: 'Diario de centros con rangos continuos de documentos' },
      { id: 'diario-rangos-fijos', nombre: 'Diario rangos fijos', desc: 'Diario de centros con rangos fijos por centro' },
      { id: 'balance-acumulado', nombre: 'Balance acumulado', desc: 'Saldos acumulados por centro' },
      { id: 'balance-mensual-centro', nombre: 'Balance mensual', desc: 'Movimiento mensual por centro' },
      { id: 'clasificacion-centros', nombre: 'Clasificación por centros', desc: 'Cuentas clasificadas por centro de costo' },
      { id: 'clasificacion-centro-tercero', nombre: 'Clasificación centro-tercero', desc: 'Cruce de centros contra terceros' },
      { id: 'discriminados-mes', nombre: 'Discriminados por mes', desc: 'Variación mensual de centros durante el año' },
    ],
  },
  {
    id: 'flujo',
    nombre: 'Flujo de caja',
    icon: '💰',
    informes: [
      { id: 'def-cuentas-flujo', nombre: 'Definición de cuentas', desc: 'Cuentas asignadas al flujo de caja y su signo' },
      { id: 'flujo-comparativo', nombre: 'Comparativo anual', desc: 'Flujo de caja comparado entre dos años' },
    ],
  },
  {
    id: 'niif',
    nombre: 'NIC / NIIF',
    icon: '🌐',
    informes: [
      { id: 'esfa-apertura', nombre: 'ESFA apertura/convergencia', desc: 'Estado de situación financiera de apertura bajo NIIF' },
      { id: 'nic-saldos', nombre: 'Información NIC de saldos y movimientos', desc: 'Saldos y movimientos presentados bajo NIC' },
    ],
  },
  {
    id: 'generador',
    nombre: 'Generador personalizado',
    icon: '⚙',
    informes: [
      { id: 'generador-personalizado', nombre: 'Informe personalizado', desc: 'Definición flexible de columnas, filtros y orden del informe' },
    ],
  },
];

// ---------------------------------------------------------------- datos de vista previa

type Celda = string | number;

interface Columna { label: string; money?: boolean; }

interface DatosInforme {
  columnas: Columna[];
  filas: Celda[][];
  totales?: Celda[];
  nota?: string;
  tipos?: string[];
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MESES_BALANCE = [...MESES, 'Mes 13', 'Mes 14', 'Mes 15', 'Mes 16', 'Mes 17', 'Mes 18'];
const BALANCE_IDS = new Set(['balance-comp', 'balance-comp-lib']);
const ACCOUNT_BALANCE_IDS = new Set([
  'balance-mensual', 'inventario-bal', 'mayor-bal', 'saldos-cuenta', 'bal-gral-resultados',
  'bal-comparativo-mensual', 'analisis-anual-acum', 'analisis-anual-mens', 'balance-prueba-anual',
]);
const CENTER_REPORT_IDS = new Set([
  'balance-acumulado', 'balance-mensual-centro', 'clasificacion-centros',
  'clasificacion-centro-tercero', 'discriminados-mes',
]);
const THIRD_SUMMARY_IDS = new Set([
  'tercero-acumulacion', 'tercero-cuenta-tercero', 'comp-cta-tercero', 'resumen-tipo-contribuyente',
]);
const THIRD_DIRECTORY_IDS = new Set(['tercero-general', 'tercero-cumpleanos', 'tercero-etiquetas']);

function mostrarFiltro(id: string, key: string): boolean {
  const account = ['cuentaDesde', 'cuentaHasta', 'buscar'].includes(key);
  const third = ['cuentaDesde', 'cuentaHasta', 'nit', 'buscar'].includes(key);
  const center = ['cuentaDesde', 'cuentaHasta', 'nit', 'centro', 'buscar'].includes(key);
  if (id === 'listado-cuentas' || ACCOUNT_BALANCE_IDS.has(id)) return account;
  if (THIRD_DIRECTORY_IDS.has(id)) return ['nit', 'buscar'].includes(key);
  if (THIRD_SUMMARY_IDS.has(id)) return third;
  if (CENTER_REPORT_IDS.has(id)) return center;
  if (id === 'doc-formato') return ['tipoDocumento', 'documentoDesde', 'documentoHasta'].includes(key);
  if (id === 'doc-planilla') return ['comprobante', 'comprobanteHasta', 'tipoDocumento', 'tipoDocumentoHasta', 'documentoDesde', 'documentoHasta'].includes(key);
  return true;
}

function fmtMonto(n: number): string {
  return n < 0 ? `− ${fmtCOP(Math.abs(n))}` : fmtCOP(n);
}

function CeldaValor({ valor, money }: { valor: Celda; money: boolean }) {
  if (typeof valor === 'number') {
    if (!money) return <td className="px-3 py-2 text-right font-mono text-gray-700 whitespace-nowrap">{valor.toLocaleString('es-CO')}</td>;
    if (valor === 0) return <td className="px-3 py-2 text-right font-mono text-gray-300 whitespace-nowrap">—</td>;
    return <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${valor < 0 ? 'text-red-600' : 'text-gray-800'}`}>{fmtMonto(valor)}</td>;
  }
  const esTotal = /TOTALES/i.test(valor);
  return <td className={`px-3 py-2 whitespace-nowrap ${esTotal ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{valor || '—'}</td>;
}

// ---------------------------------------------------------------- vista previa

const PAGE_SIZE = 8;
const STORAGE_FAVS = 'contabdsi:informes:favoritos:v2';
const STORAGE_RECIENTES = 'contabdsi:informes:recientes:v2';

function leerLista(clave: string): string[] {
  try {
    const raw = localStorage.getItem(clave);
    if (raw) {
      const value: unknown = JSON.parse(raw);
      if (Array.isArray(value) && value.every(x => typeof x === 'string')) return value;
    }
  } catch {
    // Almacenamiento deshabilitado: se ignora.
  }
  return [];
}

function Modal({ title, onClose, ancho = 'max-w-lg', children }: { title: string; onClose: () => void; ancho?: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    dialog?.querySelector<HTMLElement>('[data-initial-focus]')?.focus();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} className={`fixed inset-0 m-auto max-h-[calc(100vh-3rem)] w-[calc(100%_-_2rem)] ${ancho} overflow-y-auto rounded-lg border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/40`}>
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 id={titleId} className="text-sm font-semibold text-gray-800">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar diálogo" className="rounded px-2 text-xl text-gray-500 hover:bg-gray-100">×</button>
      </div>
      {children}
    </dialog>
  );
}

interface PreviewState {
  inf: Informe;
  anio: string;
  mesDesde: string;
  mesHasta: string;
  balance?: BalanceComprobacion;
  filtrosBalance?: FiltrosBalanceComprobacion;
  report?: InformeAdicional;
  filtrosReport?: FiltrosInformeAdicional;
}

function VistaPrevia({ preview, onClose }: { preview: PreviewState; onClose: () => void }) {
  const datos = useMemo<DatosInforme>(() => {
    if (preview.report) return {
      columnas: preview.report.columnas,
      filas: preview.report.filas,
      totales: preview.report.totales,
      nota: preview.report.nota,
    };
    if (!preview.balance) return { columnas: [], filas: [] };
    return {
      columnas: [
        { label: 'Cuenta' }, { label: 'NIT / Centro' }, { label: 'Nombre' }, { label: 'Saldo anterior', money: true },
        { label: 'Débitos', money: true }, { label: 'Créditos', money: true }, { label: 'Saldo actual', money: true },
      ],
      filas: preview.balance.items.map(item => [
        item.cuenta, item.nit, item.nombre, item.saldoAnterior, item.debito, item.credito, item.saldoActual,
      ]),
      tipos: preview.balance.items.map(item => item.tipo),
      nota: `Activo: ${fmtMonto(preview.balance.totales.saldoActual)} · Pasivo y patrimonio: ${fmtMonto(preview.balance.totales.pasivoPatrimonio)} · Diferencia: ${fmtMonto(preview.balance.totales.diferencia)}.`,
    };
  }, [preview.balance, preview.report]);
  const [pagina, setPagina] = useState(0);
  const [exportando, setExportando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const paginas = Math.max(1, Math.ceil(datos.filas.length / PAGE_SIZE));
  const inicio = pagina * PAGE_SIZE;
  const visibles = datos.filas.slice(inicio, inicio + PAGE_SIZE);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  async function exportar(formato: string) {
    setExportando(formato);
    setAviso(null);
    if (preview.balance && preview.filtrosBalance && (formato === 'PDF' || formato === 'XLSX')) {
      try {
        await exportarBalanceComprobacion(preview.filtrosBalance, formato.toLowerCase() as 'pdf' | 'xlsx');
        setAviso(`Balance exportado en ${formato}.`);
      } catch (error) {
        setAviso(error instanceof Error ? error.message : `No fue posible exportar en ${formato}.`);
      } finally {
        setExportando(null);
      }
      return;
    }
    if (preview.report && preview.filtrosReport) {
      try {
        await exportarInformeAdicional(preview.inf.id, preview.filtrosReport, formato.toLowerCase() as 'pdf' | 'xlsx' | 'csv');
        setAviso(`Informe exportado en ${formato}.`);
      } catch (error) {
        setAviso(error instanceof Error ? error.message : `No fue posible exportar en ${formato}.`);
      } finally {
        setExportando(null);
      }
      return;
    }
    setExportando(null);
    setAviso('No hay datos para exportar.');
  }

  function imprimir() {
    const popup = window.open('', '_blank');
    if (!popup) {
      setAviso('El navegador bloqueó la ventana de impresión. Permita las ventanas emergentes para esta página.');
      return;
    }
    const doc = popup.document;
    doc.title = preview.inf.nombre;
    const style = doc.createElement('style');
    style.textContent = 'body{font-family:Arial,sans-serif;margin:24px;color:#25313a}h1{font-size:18px}p{font-size:12px}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #ccc;padding:4px;text-align:left}th{background:#eaf1f2}@page{size:landscape;margin:12mm}';
    doc.head.appendChild(style);
    const title = doc.createElement('h1');
    title.textContent = preview.inf.nombre;
    doc.body.appendChild(title);
    const subtitle = doc.createElement('p');
    subtitle.textContent = THIRD_DIRECTORY_IDS.has(preview.inf.id)
      ? 'Directorio compartido por todas las compañías'
      : `${preview.report?.compania.nombre ?? preview.balance?.compania.nombre} · Año ${preview.anio} · ${preview.mesDesde} a ${preview.mesHasta}`;
    doc.body.appendChild(subtitle);
    const table = doc.createElement('table');
    const header = table.createTHead().insertRow();
    for (const column of datos.columnas) {
      const cell = doc.createElement('th');
      cell.textContent = column.label;
      header.appendChild(cell);
    }
    const body = table.createTBody();
    for (const row of datos.filas) {
      const tr = body.insertRow();
      for (const value of row) tr.insertCell().textContent = String(value ?? '');
    }
    if (datos.totales) {
      const tr = table.createTFoot().insertRow();
      for (const value of datos.totales) tr.insertCell().textContent = String(value ?? '');
    }
    doc.body.appendChild(table);
    popup.focus();
    popup.print();
  }

  return (
    <Modal title={preview.inf.nombre} onClose={onClose} ancho="max-w-5xl">
      <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
        {/* Encabezado del informe */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <div className="text-center space-y-0.5">
            <div className="text-sm font-bold text-gray-800 uppercase">{preview.inf.nombre}</div>
            <div className="text-xs text-gray-600">
              {THIRD_DIRECTORY_IDS.has(preview.inf.id)
                ? 'Directorio compartido por todas las compañías'
                : `${preview.balance?.compania.nombre ?? preview.report?.compania.nombre} — NIT ${preview.balance?.compania.nit ?? preview.report?.compania.nit}`}
            </div>
            <div className="text-xs text-gray-500">
              {THIRD_DIRECTORY_IDS.has(preview.inf.id) ? 'Datos generales, sin filtro de período'
                : preview.balance ? `${preview.balance.periodo} · Nivel ${preview.balance.nombreNivel}`
                  : `Año ${preview.anio} · ${preview.mesDesde} a ${preview.mesHasta}`}
            </div>
          </div>
        </div>

        {/* Barra de herramientas */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-4 py-2.5">
          <button type="button" onClick={() => exportar('PDF')} disabled={!!exportando} className={BUTTON_SECONDARY}>
            {exportando === 'PDF' ? '⏳ Generando…' : '📄 PDF'}
          </button>
          <button type="button" onClick={() => exportar('XLSX')} disabled={!!exportando} className={BUTTON_SECONDARY}>
            {exportando === 'XLSX' ? '⏳ Generando…' : '📊 XLSX'}
          </button>
          {!preview.balance && (
            <button type="button" onClick={() => exportar('CSV')} disabled={!!exportando} className={BUTTON_SECONDARY}>
              {exportando === 'CSV' ? '⏳ Generando…' : '📝 CSV'}
            </button>
          )}
          <button type="button" onClick={imprimir} className={BUTTON_SECONDARY}>⎙ Imprimir</button>
          <div className="flex-1" />
          {aviso && <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">{aviso}</span>}
        </div>

        {/* Tabla */}
        <div className="table-fixed-header overflow-auto" style={{ maxHeight: '48vh' }}>
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {datos.columnas.map((c, i) => (
                  <th key={i} className={`px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap ${c.money ? 'text-right' : 'text-left'}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={Math.max(datos.columnas.length, 1)} className="px-3 py-10 text-center text-xs text-gray-500">
                    No hay datos para los filtros seleccionados.
                  </td>
                </tr>
              )}
              {visibles.map((fila, i) => (
                <tr key={i} className={datos.tipos?.[inicio + i] === 'seccion' ? 'bg-petroleum-500 text-white font-semibold' :
                  datos.tipos?.[inicio + i]?.startsWith('total') || datos.tipos?.[inicio + i] === 'resultado' ? 'bg-petroleum-50 font-semibold' : 'hoverable'}>
                  {datos.tipos?.[inicio + i] === 'seccion'
                    ? <td colSpan={datos.columnas.length} className="px-3 py-2 text-white font-semibold">{fila[2]}</td>
                    : fila.map((celda, j) => <CeldaValor key={j} valor={celda} money={!!datos.columnas[j]?.money} />)}
                </tr>
              ))}
            </tbody>
            {datos.totales && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  {datos.totales.map((celda, j) => (
                    <CeldaValor key={j} valor={celda} money={!!datos.columnas[j]?.money} />
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pie con paginación */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-4 py-2.5">
          <div className="text-xs text-gray-500">
            Mostrando {visibles.length ? `${inicio + 1}–${inicio + visibles.length}` : '0'} de {datos.filas.length} registros
          </div>
          {datos.nota && <div className="text-xs text-gray-400">{datos.nota}</div>}
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0} className="text-xs px-2.5 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40">‹ Anterior</button>
            <span className="text-xs text-gray-600 font-mono">Página {pagina + 1} de {paginas}</span>
            <button type="button" onClick={() => setPagina(p => Math.min(paginas - 1, p + 1))} disabled={pagina >= paginas - 1} className="text-xs px-2.5 py-1 border border-gray-200 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-40">Siguiente ›</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- componente principal

interface Props {
  onNavigate: (page: NavPage) => void;
  /** Categoría elegida en el menú lateral que debe quedar visible. */
  initialCategory: string;
  /** Compañía activa que delimita obligatoriamente los datos del informe. */
  cia: string;
}

const CATEGORY_PAGE: Record<string, NavPage> = {
  documentos: 'informes/documentos',
  libros: 'informes/libros',
  estados: 'informes/estados',
  terceros: 'informes/terceros',
  centros: 'informes/centros',
  flujo: 'informes/flujo-caja',
  niif: 'informes/nic-niif',
  generador: 'informes/generador',
};

export default function Informes({ onNavigate, initialCategory, cia }: Props) {
  const [searchInforme, setSearchInforme] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>(initialCategory);
  const [showParams, setShowParams] = useState<Informe | null>(null);
  const [favoritos, setFavoritos] = useState<string[]>(() => leerLista(STORAGE_FAVS));
  const [recientes, setRecientes] = useState<string[]>(() => leerLista(STORAGE_RECIENTES));
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [params, setParams] = useState({
    anio: '2026', mesDesde: 'Enero', mesHasta: 'Febrero', nivel: '4', incluirCeros: false,
    incluirResultados: true, incluirTerceros: false, incluirCentros: false,
    detalleCuentaDesde: '', detalleCuentaHasta: '',
    cuentaDesde: '', cuentaHasta: '', nit: '', centro: '', comprobante: '', comprobanteHasta: '',
    tipoDocumento: '', tipoDocumentoHasta: '',
    documentoDesde: '', documentoHasta: '', buscar: '',
  });
  const [generando, setGenerando] = useState(false);
  const [errorInforme, setErrorInforme] = useState<string | null>(null);
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // El mismo centro atiende todas las opciones del menú Informes. Cuando
  // cambia la opción, desplazamos el contenedor principal a su sección.
  useEffect(() => {
    setSelectedCat(initialCategory);
    setSearchInforme('');
    window.requestAnimationFrame(() => {
      categoryRefs.current[initialCategory]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [initialCategory]);

  // El año no se inventa en la interfaz: se toma del ejercicio que CONCTR
  // tiene asociado a los acumulados actuales de CONMAE.
  useEffect(() => {
    let active = true;
    consultarPeriodoOperacion(cia).then(periodo => {
      if (!active) return;
      const hoy = new Date();
      const mesActual = hoy.getFullYear() === periodo.anio ? hoy.getMonth() + 1 : periodo.mesesHabilitados.at(-1) ?? 1;
      const mesHasta = periodo.mesesHabilitados.includes(mesActual)
        ? mesActual
        : periodo.mesesHabilitados.filter(mes => mes <= mesActual).at(-1) ?? periodo.mesesHabilitados.at(-1) ?? 1;
      setParams(previous => ({ ...previous, anio: String(periodo.anio), mesDesde: MESES[0], mesHasta: MESES[mesHasta - 1] }));
    }).catch(() => {
      // La generación mostrará el error detallado si el usuario abre el informe.
    });
    return () => { active = false; };
  }, [cia]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_FAVS, JSON.stringify(favoritos)); } catch { /* sin almacenamiento */ }
  }, [favoritos]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_RECIENTES, JSON.stringify(recientes)); } catch { /* sin almacenamiento */ }
  }, [recientes]);

  const allInformes = CATEGORIAS.flatMap(c => c.informes.map(i => ({ ...i, cat: c.nombre })));
  const porId = new Map(allInformes.map(i => [i.id, i]));
  const filtered = searchInforme
    ? allInformes.filter(i => i.nombre.toLowerCase().includes(searchInforme.toLowerCase()) || i.desc.toLowerCase().includes(searchInforme.toLowerCase()))
    : [];

  function irACategoria(categoryId: string) {
    setSelectedCat(categoryId);
    setSearchInforme('');
    window.requestAnimationFrame(() => {
      categoryRefs.current[categoryId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    const destination = CATEGORY_PAGE[categoryId];
    if (destination && categoryId !== initialCategory) onNavigate(destination);
  }

  function abrirInforme(inf: Informe) {
    if (inf.page) {
      onNavigate(inf.page);
      return;
    }
    setParams(p => ({
      ...p, nivel: BALANCE_IDS.has(inf.id) ? '4' : p.nivel,
      mesDesde: BALANCE_IDS.has(inf.id) ? p.mesDesde : (MESES.includes(p.mesDesde) ? p.mesDesde : 'Enero'),
      mesHasta: BALANCE_IDS.has(inf.id) ? p.mesHasta : (MESES.includes(p.mesHasta) ? p.mesHasta : 'Diciembre'),
      cuentaDesde: '', cuentaHasta: '', nit: '', centro: '', comprobante: '',
      comprobanteHasta: '', tipoDocumento: '', tipoDocumentoHasta: '',
      documentoDesde: '', documentoHasta: '', buscar: '',
    }));
    setErrorInforme(null);
    setShowParams(inf);
  }

  async function generar(inf: Informe) {
    setErrorInforme(null);
    if (BALANCE_IDS.has(inf.id)) {
      const filtros: FiltrosBalanceComprobacion = {
        cia,
        anio: Number(params.anio),
        mesDesde: MESES_BALANCE.indexOf(params.mesDesde) + 1,
        mesHasta: MESES_BALANCE.indexOf(params.mesHasta) + 1,
        nivel: Number(params.nivel) as 4 | 6 | 9 | 12,
        incluirCeros: params.incluirCeros,
        incluirResultados: params.incluirResultados,
        incluirTerceros: params.incluirTerceros,
        incluirCentros: params.incluirCentros,
        detalleCuentaDesde: params.detalleCuentaDesde,
        detalleCuentaHasta: params.detalleCuentaHasta,
      };
      setGenerando(true);
      try {
        const balance = await consultarBalanceComprobacion(filtros);
        setShowParams(null);
        setRecientes(prev => [inf.id, ...prev.filter(id => id !== inf.id)].slice(0, 6));
        setPreview({ inf, ...params, balance, filtrosBalance: filtros });
      } catch (error) {
        setErrorInforme(error instanceof Error ? error.message : 'No fue posible generar el balance.');
      } finally {
        setGenerando(false);
      }
      return;
    }
    const filtros: FiltrosInformeAdicional = {
      cia,
      anio: Number(params.anio),
      mesDesde: MESES.indexOf(params.mesDesde) + 1,
      mesHasta: MESES.indexOf(params.mesHasta) + 1,
      cuentaDesde: params.cuentaDesde,
      cuentaHasta: params.cuentaHasta,
      nit: params.nit,
      centro: params.centro,
      comprobante: params.comprobante,
      comprobanteHasta: params.comprobanteHasta,
      tipoDocumento: params.tipoDocumento,
      tipoDocumentoHasta: params.tipoDocumentoHasta,
      documentoDesde: params.documentoDesde,
      documentoHasta: params.documentoHasta,
      buscar: params.buscar,
      nivel: Number(params.nivel),
      incluirCeros: params.incluirCeros,
    };
    setGenerando(true);
    try {
      const report = await consultarInformeAdicional(inf.id, filtros);
      setShowParams(null);
      setRecientes(prev => [inf.id, ...prev.filter(id => id !== inf.id)].slice(0, 6));
      setPreview({ inf, ...params, report, filtrosReport: filtros });
    } catch (error) {
      setErrorInforme(error instanceof Error ? error.message : 'No fue posible generar el informe.');
    } finally {
      setGenerando(false);
    }
  }

  function toggleFavorito(id: string, event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setFavoritos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const listaRecientes = recientes.map(id => porId.get(id)).filter(Boolean) as Informe[];
  const listaFavoritos = favoritos.map(id => porId.get(id)).filter(Boolean) as Informe[];

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Informes / Centro de informes</div>
          <h1 className="text-lg font-semibold text-gray-800">Centro de informes</h1>
          <p className="mt-1 text-xs text-gray-500">Documentos, libros contables, estados financieros, terceros, centros, flujo de caja y NIC/NIIF.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Informes contables</span>
      </div>

      {errorInforme && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{errorInforme}</div>
      )}

      {/* Buscador + categorías */}
      <div className="bg-white rounded border border-gray-200 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">⌕</span>
            <input
              value={searchInforme}
              onChange={e => setSearchInforme(e.target.value)}
              placeholder="Buscar informe..."
              className="w-full pl-7 pr-3 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-petroleum-500"
            />
          </div>
          {CATEGORIAS.map(c => (
            <button
              key={c.id}
              onClick={() => irACategoria(c.id)}
              aria-current={selectedCat === c.id ? 'location' : undefined}
              className={`text-xs px-2.5 py-1 rounded transition-colors font-medium hidden md:block ${
                selectedCat === c.id ? 'bg-petroleum-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </div>

        {(listaRecientes.length > 0 || listaFavoritos.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-100 pt-2.5">
            {listaRecientes.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-gray-500">Recientes:</span>
                {listaRecientes.map(inf => (
                  <button key={inf.id} onClick={() => abrirInforme(inf)} className="text-xs px-2 py-0.5 rounded-full border border-gray-200 text-gray-600 hover:border-petroleum-300 hover:text-petroleum-600">
                    🕘 {inf.nombre}
                  </button>
                ))}
              </div>
            )}
            {listaFavoritos.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-gray-500">Favoritos:</span>
                {listaFavoritos.map(inf => (
                  <button key={inf.id} onClick={() => abrirInforme(inf)} className="text-xs px-2 py-0.5 rounded-full border border-petroleum-100 bg-petroleum-50 text-petroleum-700 hover:bg-petroleum-100">
                    ⭐ {inf.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resultados de búsqueda */}
      {searchInforme && (
        <div className="bg-white rounded border border-gray-200">
          <div className="px-4 py-2.5 border-b border-gray-100 text-xs text-gray-500">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</div>
          {filtered.map(inf => (
            <div
              key={inf.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors"
            >
              <button
                type="button"
                onClick={e => toggleFavorito(inf.id, e)}
                title={favoritos.includes(inf.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                className="text-sm shrink-0"
              >
                {favoritos.includes(inf.id) ? '⭐' : '☆'}
              </button>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800">{inf.nombre}</div>
                <div className="text-xs text-gray-400 mt-0.5">{inf.desc} · {inf.cat}</div>
              </div>
              <button
                type="button"
                onClick={() => abrirInforme(inf)}
                disabled={generando}
                className="text-xs px-3 py-1 rounded shrink-0 bg-petroleum-500 text-white hover:bg-petroleum-600 disabled:opacity-60"
              >
                {inf.page ? 'Abrir pantalla' : 'Generar'}
              </button>
            </div>
          ))}
          {filtered.length === 0 && <div className="px-4 py-6 text-center text-xs text-gray-400">Sin resultados para la búsqueda.</div>}
        </div>
      )}

      {/* Grilla de categorías */}
      {!searchInforme && (
        <div className="space-y-4">
          {CATEGORIAS.map(cat => (
            <div
              key={cat.id}
              ref={element => { categoryRefs.current[cat.id] = element; }}
              className="scroll-mt-4 bg-white rounded border border-gray-200 overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
                <span className="text-sm">{cat.icon}</span>
                <h2 className="text-xs font-semibold text-gray-700">{cat.nombre}</h2>
                <span className="text-xs text-gray-400">· {cat.informes.length} informe{cat.informes.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-4">
                {cat.informes.map(inf => (
                  <div
                    key={inf.id}
                    className="border border-gray-200 rounded p-3 hover:border-petroleum-300 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-medium text-gray-800 mb-1 group-hover:text-petroleum-600">{inf.nombre}</div>
                      <button
                        type="button"
                        onClick={e => toggleFavorito(inf.id, e)}
                        title={favoritos.includes(inf.id) ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                        className="text-sm shrink-0 leading-none"
                      >
                        {favoritos.includes(inf.id) ? '⭐' : '☆'}
                      </button>
                    </div>
                    <div className="text-xs text-gray-400">{inf.desc}</div>
                    <div className="mt-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => abrirInforme(inf)}
                        disabled={generando}
                        className="text-[10px] px-2 py-0.5 rounded text-white bg-petroleum-500 hover:bg-petroleum-600 disabled:opacity-60"
                      >
                        {inf.page ? 'Abrir pantalla' : 'Generar'}
                      </button>
                      {inf.page && <span className="text-[10px] text-gray-400">→ balance existente</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de parámetros */}
      {showParams && (
        <Modal title={`Parámetros — ${showParams.nombre}`} onClose={() => setShowParams(null)}>
          <form noValidate onSubmit={e => { e.preventDefault(); generar(showParams); }}>
            <div className="px-5 py-4 grid grid-cols-2 gap-4">
              {!THIRD_DIRECTORY_IDS.has(showParams.id) && <div>
                <label htmlFor="param-anio" className="block text-xs font-medium text-gray-600 mb-1">Año</label>
                <input id="param-anio" data-initial-focus value={params.anio} onChange={e => setParams(p => ({ ...p, anio: e.target.value }))} className={`${INPUT} font-mono`} />
              </div>}
              {!THIRD_DIRECTORY_IDS.has(showParams.id) && <div>
                <label htmlFor="param-mes-desde" className="block text-xs font-medium text-gray-600 mb-1">Mes desde</label>
                <select id="param-mes-desde" value={params.mesDesde} onChange={e => setParams(p => ({ ...p, mesDesde: e.target.value }))} className={INPUT}>
                  {(BALANCE_IDS.has(showParams.id) ? MESES_BALANCE : MESES).map(m => <option key={m}>{m}</option>)}
                </select>
              </div>}
              {!THIRD_DIRECTORY_IDS.has(showParams.id) && <div>
                <label htmlFor="param-mes-hasta" className="block text-xs font-medium text-gray-600 mb-1">Mes hasta</label>
                <select id="param-mes-hasta" value={params.mesHasta} onChange={e => setParams(p => ({ ...p, mesHasta: e.target.value }))} className={INPUT}>
                  {(BALANCE_IDS.has(showParams.id) ? MESES_BALANCE : MESES).map(m => <option key={m}>{m}</option>)}
                </select>
              </div>}
              {BALANCE_IDS.has(showParams.id) && (
                <>
                  <div>
                    <label htmlFor="param-nivel" className="block text-xs font-medium text-gray-600 mb-1">Nivel máximo</label>
                    <select id="param-nivel" value={params.nivel} onChange={e => setParams(p => ({ ...p, nivel: e.target.value }))} className={INPUT}>
                      <option value="4">Cuenta</option>
                      <option value="6">Subcuenta</option>
                      <option value="9">Auxiliar 1</option>
                      <option value="12">Auxiliar 2</option>
                    </select>
                  </div>
                  <label className="col-span-2 flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={params.incluirCeros} onChange={e => setParams(p => ({ ...p, incluirCeros: e.target.checked }))} />
                    Incluir cuentas sin saldo ni movimiento
                  </label>
                  <label className="col-span-2 flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={params.incluirResultados} onChange={e => setParams(p => ({ ...p, incluirResultados: e.target.checked }))} />
                    Incluir estado de resultados
                  </label>
                  <label className="col-span-2 flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={params.incluirTerceros} onChange={e => setParams(p => ({ ...p, incluirTerceros: e.target.checked }))} />
                    Incluir detalle por terceros
                  </label>
                  <label className="col-span-2 flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={params.incluirCentros} onChange={e => setParams(p => ({ ...p, incluirCentros: e.target.checked }))} />
                    Incluir detalle por centros de costo
                  </label>
                  {(params.incluirTerceros || params.incluirCentros) && <>
                    <div>
                      <label htmlFor="param-detalle-desde" className="block text-xs font-medium text-gray-600 mb-1">Detalle: cuenta desde</label>
                      <input id="param-detalle-desde" value={params.detalleCuentaDesde} onChange={e => setParams(p => ({ ...p, detalleCuentaDesde: e.target.value }))} className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor="param-detalle-hasta" className="block text-xs font-medium text-gray-600 mb-1">Detalle: cuenta hasta</label>
                      <input id="param-detalle-hasta" value={params.detalleCuentaHasta} onChange={e => setParams(p => ({ ...p, detalleCuentaHasta: e.target.value }))} className={INPUT} />
                    </div>
                    <p className="col-span-2 text-xs text-gray-500">Si el detalle es muy extenso, indique un rango de cuentas para acotarlo.</p>
                  </>}
                </>
              )}
              {!BALANCE_IDS.has(showParams.id) && (
                <>
                  {([
                    ['cuentaDesde', 'Cuenta desde'], ['cuentaHasta', 'Cuenta hasta'],
                    ['nit', 'Tercero'], ['centro', 'Centro de costo'],
                    ['comprobante', 'Comprobante (o desde)'], ['comprobanteHasta', 'Comprobante hasta'],
                    ['tipoDocumento', 'Tipo de documento (o desde)'], ['tipoDocumentoHasta', 'Tipo de documento hasta'],
                    ['documentoDesde', 'Documento desde'], ['documentoHasta', 'Documento hasta'],
                    ['buscar', 'Buscar código o nombre'],
                  ] as const).filter(([key]) => mostrarFiltro(showParams.id, key)).map(([key, label], index) => (
                    <div key={key}>
                      <label htmlFor={`param-${key}`} className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                      <input id={`param-${key}`} data-initial-focus={THIRD_DIRECTORY_IDS.has(showParams.id) && index === 0 ? '' : undefined} value={params[key]} onChange={e => setParams(p => ({ ...p, [key]: e.target.value }))} className={INPUT} />
                    </div>
                  ))}
                  {ACCOUNT_BALANCE_IDS.has(showParams.id) && (
                    <>
                      <div>
                        <label htmlFor="param-nivel-adicional" className="block text-xs font-medium text-gray-600 mb-1">Nivel máximo</label>
                        <select id="param-nivel-adicional" value={params.nivel} onChange={e => setParams(p => ({ ...p, nivel: e.target.value }))} className={INPUT}>
                          <option value="4">Cuenta</option><option value="6">Subcuenta</option><option value="9">Auxiliar 1</option><option value="12">Auxiliar 2</option>
                        </select>
                      </div>
                      <label className="col-span-2 flex items-center gap-2 text-xs text-gray-600">
                        <input type="checkbox" checked={params.incluirCeros} onChange={e => setParams(p => ({ ...p, incluirCeros: e.target.checked }))} />
                        Incluir cuentas sin saldo ni movimiento
                      </label>
                    </>
                  )}
                </>
              )}
            </div>
            {errorInforme && <p role="alert" className="px-5 pb-3 text-xs text-red-700">{errorInforme}</p>}
            <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setShowParams(null)} className={BUTTON_SECONDARY}>Cancelar</button>
              <button type="submit" disabled={generando} className={`${BUTTON_PRIMARY} disabled:opacity-60`}>
                {generando ? 'Consultando Advantage…' : 'Generar informe'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Vista previa */}
      {preview && <VistaPrevia preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
