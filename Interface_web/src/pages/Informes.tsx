import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import type { NavPage } from '../components/Shell';
import {
  consultarBalanceComprobacion,
  consultarBalanceMensual,
  exportarBalanceComprobacion,
  exportarBalanceMensual,
  urlImpresionBalanceMensual,
  type BalanceComprobacion,
  type FiltrosBalanceComprobacion,
} from '../api/balanceComprobacion';
import { consultarPeriodoOperacion } from '../api/periodoOperacion';
import { consultarInformeAdicional, consultarPaginaInformeAdicional, exportarInformeAdicional, procesarAcumulacionIva, urlImpresionInformeAdicional, type FiltrosInformeAdicional, type InformeAdicional } from '../api/informesAdicionales';
import IvaAnalisis from './IvaAnalisis';

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
      { id: 'balance-mensual', nombre: 'Balance mensual por cuenta', desc: 'Movimiento y saldo por mes' },
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
    id: 'iva',
    nombre: 'IVA',
    icon: '%',
    informes: [
      { id: 'iva-acumulacion', nombre: 'Acumulación general', desc: 'Reconstruye los acumulados de IVA por cuenta y tercero para el período elegido' },
      { id: 'iva-analisis', nombre: 'Análisis acumulados y certificados', desc: 'Consulta y corrige los valores mensuales; emite certificados de IVA' },
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
      { id: 'balance-mensual-centro', nombre: 'Balance mensual por centro de costo', desc: 'Movimiento mensual por centro' },
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

/** Orden y submenús de MENU_INFOR en CONTABDSI.PRG. La acumulación de IVA
 * se habilita como proceso explícito porque alimenta sus informes posteriores.
 * Una opción sin id sigue visible, pero no promete una consulta aún no migrada.
 */
interface EntradaMenuInforme {
  numero: string;
  nombre: string;
  id?: string;
  opciones?: EntradaMenuInforme[];
}

const MENU_INFORMES: EntradaMenuInforme[] = [
  { numero: '1', nombre: 'Impresión de documentos', opciones: [
    { numero: '1', nombre: 'Impresión de documentos por formato', id: 'doc-formato' },
    { numero: '2', nombre: 'Impresión de documentos por planilla', id: 'doc-planilla' },
  ] },
  { numero: '2', nombre: 'Listado de cuentas', id: 'listado-cuentas' },
  { numero: '3', nombre: 'Balance de comprobación', opciones: [
    { numero: '1', nombre: 'Acumulado', id: 'balance-comp' },
    { numero: '2', nombre: 'Mensual', id: 'balance-mensual' },
  ] },
  { numero: '4', nombre: 'Libro auxiliar', opciones: [
    { numero: '1', nombre: 'Libro auxiliar general', id: 'aux-gral' },
    { numero: '2', nombre: 'Libro auxiliar documento afectado', id: 'aux-doc-afectado' },
  ] },
  { numero: '5', nombre: 'Balance general y estado de resultados', id: 'bal-gral-resultados' },
  { numero: '6', nombre: 'Informe de retenciones', opciones: [
    { numero: '1', nombre: 'Acumulación general' },
    { numero: '2', nombre: 'Análisis acumulados y certificados' },
    { numero: '3', nombre: 'Relación acumulados' },
    { numero: '4', nombre: 'Relación totales por cuenta' },
    { numero: '5', nombre: 'Soportes y anexos' },
    { numero: '7', nombre: 'Plano reporte anual retenciones' },
  ] },
  { numero: '7', nombre: 'Informe de IVA', opciones: [
    { numero: '1', nombre: 'Acumulación general', id: 'iva-acumulacion' },
    { numero: '2', nombre: 'Análisis acumulados y certificados', id: 'iva-analisis' },
    { numero: '3', nombre: 'Relación acumulados' },
    { numero: '4', nombre: 'Relación totales por cuenta' },
    { numero: '5', nombre: 'Soportes y anexos' },
  ] },
  { numero: '8', nombre: 'Informe de terceros', opciones: [
    { numero: '1', nombre: 'Acumulación general', id: 'tercero-acumulacion' },
    { numero: '2', nombre: 'Consulta', id: 'tercero-general' },
    { numero: '3', nombre: 'Movimiento cuenta-tercero', id: 'tercero-cuenta-tercero' },
    { numero: '4', nombre: 'Movimiento específico por tercero', id: 'tercero-especifico' },
  ] },
  { numero: '9', nombre: 'Informe por centros de costos', opciones: [
    { numero: '1', nombre: 'Acumulación general' },
    { numero: '2', nombre: 'Consulta' },
    { numero: '3', nombre: 'Informes', opciones: [
      { numero: '1', nombre: 'Cuenta por centro de costo' },
      { numero: '2', nombre: 'Centro de costo por cuenta' },
      { numero: '3', nombre: 'Tercero por centro de costo' },
      { numero: '4', nombre: 'Detallado cuenta por centro de costo' },
      { numero: '5', nombre: 'Centro de costo por cuenta y columnas' },
    ] },
    { numero: '5', nombre: 'Consulta acumulada por nivel' },
  ] },
  { numero: 'A', nombre: 'Movimiento por comprobante', id: 'mov-comprobante' },
  { numero: 'B', nombre: 'Inventario y balance', id: 'inventario-bal' },
  { numero: 'C', nombre: 'Mayor y balance', id: 'mayor-bal' },
  { numero: 'D', nombre: 'Diario por cuenta', id: 'diario-cta' },
  { numero: 'E', nombre: 'Caja diario por comprobante', id: 'caja-diario-comp' },
  { numero: 'F', nombre: 'Caja diario por cuenta', id: 'caja-diario-cta' },
  { numero: 'G', nombre: 'Saldos por cuenta', id: 'saldos-cuenta' },
  { numero: 'H', nombre: 'Balance comparativo mensual', id: 'bal-comparativo-mensual' },
  { numero: 'I', nombre: 'Análisis anual balances', opciones: [
    { numero: '1', nombre: 'Acumulado', id: 'analisis-anual-acum' },
    { numero: '2', nombre: 'Mensual', id: 'analisis-anual-mens' },
  ] },
  { numero: 'J', nombre: 'Balance de prueba anual', id: 'balance-prueba-anual' },
  { numero: 'K', nombre: 'Diario por centro de costo', opciones: [
    { numero: '1', nombre: 'Rangos continuos', id: 'diario-rangos-continuos' },
    { numero: '2', nombre: 'Rangos fijos', id: 'diario-rangos-fijos' },
  ] },
  { numero: 'L', nombre: 'Balance de comprobación por centro de costo', opciones: [
    { numero: '2', nombre: 'Acumulado', id: 'balance-acumulado' },
    { numero: '3', nombre: 'Mensual', id: 'balance-mensual-centro' },
    { numero: '4', nombre: 'Clasificando centros de costos', id: 'clasificacion-centros' },
    { numero: '5', nombre: 'Clasificando centros de costos y tercero', id: 'clasificacion-centro-tercero' },
    { numero: '6', nombre: 'Discriminando centros de costos por mes', id: 'discriminados-mes' },
  ] },
  { numero: 'M', nombre: 'Flujo de caja comparativo anual', opciones: [
    { numero: '1', nombre: 'Definición de cuentas', id: 'def-cuentas-flujo' },
    { numero: '2', nombre: 'Generación informe', id: 'flujo-comparativo' },
  ] },
  { numero: 'N', nombre: 'Movimiento por tipo de documento', id: 'mov-tipo-doc' },
  { numero: 'O', nombre: 'Movimiento por cuenta', id: 'mov-cuenta' },
  { numero: 'P', nombre: 'Comparativo cuentas-tercero', id: 'comp-cta-tercero' },
  { numero: 'Q', nombre: 'Resumen movimiento por tipo de contribuyente', id: 'resumen-tipo-contribuyente' },
  { numero: 'R', nombre: 'Informes NIC - INVAMA', opciones: [
    { numero: '1', nombre: 'Estado de situación financiera de apertura - convergencia', id: 'esfa-apertura' },
    { numero: '2', nombre: 'Información contable saldos y movimientos', id: 'nic-saldos' },
  ] },
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
const MESES_LIBRO = ['Mes 00', ...MESES];
const MESES_BALANCE = [...MESES, 'Mes 13', 'Mes 14', 'Mes 15', 'Mes 16', 'Mes 17', 'Mes 18'];
const BALANCE_IDS = new Set(['balance-comp', 'balance-mensual']);
const ACCOUNT_BALANCE_IDS = new Set([
  'inventario-bal', 'mayor-bal', 'saldos-cuenta',
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
  if (id === 'listado-cuentas') return ['cuentaDesde', 'cuentaHasta'].includes(key);
  if (id === 'aux-gral') return ['cuentaDesde', 'cuentaHasta'].includes(key);
  if (id === 'aux-doc-afectado') return false;
  if (id === 'bal-gral-resultados') return false;
  if (id === 'iva-acumulacion') return false;
  if (ACCOUNT_BALANCE_IDS.has(id)) return account;
  if (THIRD_DIRECTORY_IDS.has(id)) return ['nit', 'buscar'].includes(key);
  if (THIRD_SUMMARY_IDS.has(id)) return third;
  if (CENTER_REPORT_IDS.has(id)) return center;
  if (id === 'doc-formato') return ['tipoDocumento', 'documentoDesde', 'documentoHasta'].includes(key);
  if (id === 'doc-planilla') return ['comprobante', 'comprobanteHasta', 'tipoDocumento', 'tipoDocumentoHasta', 'documentoDesde', 'documentoHasta'].includes(key);
  return true;
}

/** Enter recorre los filtros presentes; solo el botón final confirma el informe. */
function avanzarFiltroConEnter(event: KeyboardEvent<HTMLFormElement>): void {
  if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
  const fields = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement>(
    'input:not([type="hidden"]), select, textarea, button[data-report-submit]',
  )).filter(field => !field.disabled && field.getClientRects().length > 0);
  const index = fields.indexOf(target);
  if (index < 0) return;
  event.preventDefault();
  fields[index + 1]?.focus();
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
      if (Array.isArray(value) && value.every(x => typeof x === 'string')) {
        // Conserva favoritos y recientes guardados con la opción duplicada anterior.
        return [...new Set(value.map(id => id === 'balance-comp-lib' ? 'balance-comp' : id))];
      }
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
  const [reportPage, setReportPage] = useState(preview.report);
  const datos = useMemo<DatosInforme>(() => {
    if (reportPage) return {
      columnas: reportPage.columnas,
      filas: reportPage.filas,
      totales: reportPage.totales,
      nota: reportPage.nota,
      tipos: reportPage.tipos,
    };
    if (!preview.balance) return { columnas: [], filas: [] };
    const mensual = preview.balance.tipoInforme === 'mensual';
    return {
      columnas: mensual
        ? [{ label: 'Código' }, { label: 'NIT / Centro' }, { label: 'Cuenta' }, { label: 'Débitos', money: true }, { label: 'Créditos', money: true }, { label: 'Saldo actual', money: true }]
        : [{ label: 'Cuenta' }, { label: 'NIT / Centro' }, { label: 'Nombre' }, { label: 'Saldo anterior', money: true },
          { label: 'Débitos', money: true }, { label: 'Créditos', money: true }, { label: 'Saldo actual', money: true }],
      filas: preview.balance.items.map(item => mensual
        ? [item.cuenta, item.nit, item.nombre, item.debito, item.credito, item.saldoActual]
        : [item.cuenta, item.nit, item.nombre, item.saldoAnterior, item.debito, item.credito, item.saldoActual]),
      tipos: preview.balance.items.map(item => item.tipo),
      nota: `${mensual ? 'Movimiento del período' : 'Saldo acumulado'} · Activo: ${fmtMonto(preview.balance.totales.saldoActual)} · Pasivo y patrimonio: ${fmtMonto(preview.balance.totales.pasivoPatrimonio)} · Diferencia: ${fmtMonto(preview.balance.totales.diferencia)}.`,
    };
  }, [preview.balance, reportPage]);
  const [pagina, setPagina] = useState(0);
  const [cargandoPagina, setCargandoPagina] = useState(false);
  const [exportando, setExportando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const paginadoServidor = !!preview.report?.snapshotId;
  const totalFilas = paginadoServidor ? preview.report?.count ?? 0 : datos.filas.length;
  const paginas = Math.max(1, Math.ceil(totalFilas / PAGE_SIZE));
  const inicio = pagina * PAGE_SIZE;
  const visibles = cargandoPagina ? [] : paginadoServidor ? datos.filas : datos.filas.slice(inicio, inicio + PAGE_SIZE);

  useEffect(() => {
    const snapshotId = preview.report?.snapshotId;
    if (!snapshotId || pagina === 0) {
      setReportPage(preview.report);
      setCargandoPagina(false);
      return;
    }
    let active = true;
    setCargandoPagina(true);
    consultarPaginaInformeAdicional(preview.inf.id, snapshotId, pagina)
      .then(report => { if (active) setReportPage(report); })
      .catch(error => {
        if (!active) return;
        setAviso(error instanceof Error ? error.message : 'No fue posible cargar esta página.');
        setPagina(0);
      })
      .finally(() => { if (active) setCargandoPagina(false); });
    return () => { active = false; };
  }, [pagina, preview.inf.id, preview.report]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  async function exportar(formato: string) {
    setExportando(formato);
    setAviso(null);
    if (preview.balance && preview.filtrosBalance && (formato === 'PDF' || formato === 'XLSX')) {
      try {
        if (preview.inf.id === 'balance-mensual') {
          await exportarBalanceMensual(preview.filtrosBalance, formato.toLowerCase() as 'pdf' | 'xlsx');
        } else {
          await exportarBalanceComprobacion(preview.filtrosBalance, formato.toLowerCase() as 'pdf' | 'xlsx');
        }
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
        await exportarInformeAdicional(preview.inf.id, preview.filtrosReport, formato.toLowerCase() as 'pdf' | 'xlsx' | 'csv', preview.report.snapshotId);
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
    if (preview.report?.snapshotId) {
      const popup = window.open(urlImpresionInformeAdicional(preview.inf.id, preview.report.snapshotId), '_blank');
      if (!popup) setAviso('El navegador bloqueó la impresión. Permita las ventanas emergentes.');
      return;
    }
    if (preview.inf.id === 'balance-mensual' && preview.filtrosBalance) {
      const popup = window.open(urlImpresionBalanceMensual(preview.filtrosBalance), '_blank');
      if (!popup) setAviso('El navegador bloqueó la impresión. Permita las ventanas emergentes.');
      return;
    }
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
      : preview.inf.id === 'listado-cuentas'
        ? `${preview.report?.compania.nombre} · Catálogo de cuentas`
      : preview.inf.id === 'aux-gral'
        ? `${preview.report?.compania.nombre} · ${preview.report?.fechaDesde} a ${preview.report?.fechaHasta}`
      : preview.inf.id === 'doc-formato'
        ? `${preview.report?.compania.nombre} · Mes o lote ${String(preview.report?.mesDesde ?? '').padStart(2, '0')}`
      : `${preview.report?.compania.nombre ?? preview.balance?.compania.nombre} · Año ${preview.anio} · ${preview.mesDesde} a ${preview.mesHasta}`;
    doc.body.appendChild(subtitle);
    if (datos.nota) {
      const note = doc.createElement('p');
      note.textContent = datos.nota;
      doc.body.appendChild(note);
    }
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
                : preview.inf.id === 'listado-cuentas' ? 'Catálogo de cuentas'
                : preview.inf.id === 'aux-gral' ? `${preview.report?.fechaDesde} a ${preview.report?.fechaHasta}`
                : preview.inf.id === 'doc-formato' ? `Mes o lote ${String(preview.report?.mesDesde ?? '').padStart(2, '0')} · ${preview.mesDesde}`
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
                    {cargandoPagina ? 'Cargando página…' : 'No hay datos para los filtros seleccionados.'}
                  </td>
                </tr>
              )}
              {visibles.map((fila, i) => (
                <tr key={i} className={datos.tipos?.[paginadoServidor ? i : inicio + i] === 'seccion' && preview.inf.id !== 'aux-gral' ? 'bg-petroleum-500 text-white font-semibold' :
                  datos.tipos?.[paginadoServidor ? i : inicio + i]?.startsWith('total') || datos.tipos?.[paginadoServidor ? i : inicio + i] === 'resultado' ||
                  datos.tipos?.[paginadoServidor ? i : inicio + i] === 'seccion' || datos.tipos?.[paginadoServidor ? i : inicio + i] === 'subtotal' ||
                  datos.tipos?.[paginadoServidor ? i : inicio + i] === 'apertura' ? 'bg-petroleum-50 font-semibold' : 'hoverable'}>
                  {datos.tipos?.[paginadoServidor ? i : inicio + i] === 'seccion' && preview.inf.id !== 'aux-gral'
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
            Mostrando {visibles.length ? `${inicio + 1}–${inicio + visibles.length}` : '0'} de {totalFilas} registros
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
  /** Compañía activa que delimita obligatoriamente los datos del informe. */
  cia: string;
}

function entradasConInforme(entries: EntradaMenuInforme[], path = ''): Array<Informe & { ruta: string }> {
  const available = new Map(CATEGORIAS.flatMap(category => category.informes.map(inf => [inf.id, inf] as const)));
  return entries.flatMap(entry => {
    const ruta = `${path}${entry.numero}`;
    if (entry.opciones) return entradasConInforme(entry.opciones, `${ruta}.`);
    const informe = entry.id ? available.get(entry.id) : undefined;
    return informe ? [{ ...informe, nombre: entry.nombre, ruta }] : [];
  });
}

export default function Informes({ onNavigate, cia }: Props) {
  const [searchInforme, setSearchInforme] = useState('');
  const [showParams, setShowParams] = useState<Informe | null>(null);
  const [showIvaAnalisis, setShowIvaAnalisis] = useState(false);
  const [favoritos, setFavoritos] = useState<string[]>(() => leerLista(STORAGE_FAVS));
  const [recientes, setRecientes] = useState<string[]>(() => leerLista(STORAGE_RECIENTES));
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [params, setParams] = useState({
    mesDesde: 'Enero', mesHasta: 'Febrero', mesLote: '1', nivel: '4', incluirCeros: false,
    incluirResultados: true, incluirTerceros: false, incluirCentros: false,
    detalleCuentaDesde: '', detalleCuentaHasta: '',
    cuentaDesde: '', cuentaHasta: '', nit: '', centro: '', comprobante: '', comprobanteHasta: '',
    tipoDocumento: '', tipoDocumentoHasta: '',
    documentoDesde: '', documentoHasta: '', buscar: '',
    fechaDesde: '', fechaHasta: '', modalidad: 'detallado' as 'detallado' | 'resumido',
    documentoAfectado: '',
  });
  const [generando, setGenerando] = useState(false);
  const [errorInforme, setErrorInforme] = useState<string | null>(null);
  const [anioOperacion, setAnioOperacion] = useState<number | null>(null);
  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);
  // El año no se inventa en la interfaz: se toma del ejercicio que CONCTR
  // tiene asociado a los acumulados actuales de CONMAE.
  useEffect(() => {
    let active = true;
    setAnioOperacion(null);
    setErrorPeriodo(null);
    consultarPeriodoOperacion(cia).then(periodo => {
      if (!active) return;
      setAnioOperacion(periodo.anio);
      const hoy = new Date();
      const mesActual = hoy.getFullYear() === periodo.anio ? hoy.getMonth() + 1 : periodo.mesesHabilitados.at(-1) ?? 1;
      const mesHasta = periodo.mesesHabilitados.includes(mesActual)
        ? mesActual
        : periodo.mesesHabilitados.filter(mes => mes <= mesActual).at(-1) ?? periodo.mesesHabilitados.at(-1) ?? 1;
      setParams(previous => ({
        ...previous, mesDesde: MESES[0],
        mesHasta: MESES[mesHasta - 1], mesLote: String(mesHasta),
        fechaDesde: `${periodo.anio}-01-01`,
        fechaHasta: `${periodo.anio}-12-31`,
      }));
    }).catch((error: unknown) => {
      if (active) setErrorPeriodo(error instanceof Error ? error.message : 'No fue posible consultar el período operativo.');
    });
    return () => { active = false; };
  }, [cia]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_FAVS, JSON.stringify(favoritos)); } catch { /* sin almacenamiento */ }
  }, [favoritos]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_RECIENTES, JSON.stringify(recientes)); } catch { /* sin almacenamiento */ }
  }, [recientes]);

  const allInformes = entradasConInforme(MENU_INFORMES);
  const porId = new Map(allInformes.map(i => [i.id, i]));
  const filtered = searchInforme
    ? allInformes.filter(i => i.nombre.toLowerCase().includes(searchInforme.toLowerCase()) || i.desc.toLowerCase().includes(searchInforme.toLowerCase()) || i.ruta.toLowerCase().includes(searchInforme.toLowerCase()))
    : [];

  function abrirInforme(inf: Informe) {
    if (inf.id === 'iva-analisis') {
      setShowIvaAnalisis(true);
      setShowParams(null);
      setPreview(null);
      return;
    }
    if (inf.page) {
      onNavigate(inf.page);
      return;
    }
    setParams(p => ({
      ...p, nivel: BALANCE_IDS.has(inf.id) || inf.id === 'bal-gral-resultados' ? '4' : p.nivel,
      mesDesde: inf.id === 'iva-acumulacion' ? (MESES[Number(p.mesLote) - 1] ?? 'Enero')
        : BALANCE_IDS.has(inf.id) ? p.mesDesde : (MESES.includes(p.mesDesde) ? p.mesDesde : 'Enero'),
      mesHasta: inf.id === 'iva-acumulacion' ? (MESES[Number(p.mesLote) - 1] ?? 'Enero')
        : BALANCE_IDS.has(inf.id) || inf.id === 'bal-gral-resultados'
        ? (MESES_BALANCE.includes(p.mesHasta) ? p.mesHasta : 'Diciembre')
        : (MESES.includes(p.mesHasta) ? p.mesHasta : 'Diciembre'),
      cuentaDesde: '', cuentaHasta: '', nit: '', centro: '', comprobante: '',
      comprobanteHasta: '', tipoDocumento: '', tipoDocumentoHasta: '',
      documentoDesde: '', documentoHasta: '', buscar: '',
      modalidad: 'detallado', documentoAfectado: '',
      ...(inf.id === 'bal-gral-resultados' ? {
        incluirResultados: true, incluirCeros: false, incluirTerceros: false,
      } : {}),
    }));
    setErrorInforme(null);
    setShowParams(inf);
  }

  async function generar(inf: Informe) {
    setErrorInforme(null);
    if (anioOperacion === null) {
      setErrorInforme(errorPeriodo || 'No fue posible determinar el período operativo de la compañía.');
      return;
    }
    if (BALANCE_IDS.has(inf.id)) {
      const filtros: FiltrosBalanceComprobacion = {
        cia,
        anio: anioOperacion,
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
        const balance = inf.id === 'balance-mensual'
          ? await consultarBalanceMensual(filtros)
          : await consultarBalanceComprobacion(filtros);
        setShowParams(null);
        setRecientes(prev => [inf.id, ...prev.filter(id => id !== inf.id)].slice(0, 6));
        setPreview({ inf, ...params, anio: String(anioOperacion), balance, filtrosBalance: filtros });
      } catch (error) {
        setErrorInforme(error instanceof Error ? error.message : 'No fue posible generar el balance.');
      } finally {
        setGenerando(false);
      }
      return;
    }
    const mesSeleccionado = Number(params.mesLote);
    const filtros: FiltrosInformeAdicional = {
      cia,
      anio: anioOperacion,
      mesDesde: inf.id === 'bal-gral-resultados' ? MESES_BALANCE.indexOf(params.mesHasta) + 1
        : inf.id === 'doc-formato' ? mesSeleccionado
        : inf.id === 'aux-doc-afectado' ? MESES_LIBRO.indexOf(params.mesDesde)
        : inf.id === 'aux-gral' ? Number(params.fechaDesde.slice(5, 7))
        : MESES.indexOf(params.mesDesde) + 1,
      mesHasta: inf.id === 'bal-gral-resultados' ? MESES_BALANCE.indexOf(params.mesHasta) + 1
        : inf.id === 'doc-formato' ? mesSeleccionado
        : inf.id === 'aux-doc-afectado' ? MESES_LIBRO.indexOf(params.mesHasta)
        : inf.id === 'aux-gral' ? Number(params.fechaHasta.slice(5, 7))
        : MESES.indexOf(params.mesHasta) + 1,
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
      fechaDesde: params.fechaDesde,
      fechaHasta: params.fechaHasta,
      modalidad: params.modalidad,
      documentoAfectado: params.documentoAfectado,
      nivel: Number(params.nivel),
      incluirCeros: params.incluirCeros,
      ...(inf.id === 'bal-gral-resultados' ? {
        incluirResultados: params.incluirResultados,
        incluirTerceros: params.incluirTerceros,
      } : {}),
    };
    if (inf.id === 'iva-acumulacion' && filtros.mesDesde > filtros.mesHasta) {
      setErrorInforme('El mes inicial no puede ser posterior al mes final.');
      return;
    }
    setGenerando(true);
    try {
      const report = inf.id === 'iva-acumulacion'
        ? await procesarAcumulacionIva(filtros)
        : await consultarInformeAdicional(inf.id, filtros);
      setShowParams(null);
      setRecientes(prev => [inf.id, ...prev.filter(id => id !== inf.id)].slice(0, 6));
        setPreview({
          inf, ...params, anio: String(anioOperacion),
          ...(inf.id === 'doc-formato' ? {
            mesDesde: MESES[mesSeleccionado - 1], mesHasta: MESES[mesSeleccionado - 1],
          } : inf.id === 'bal-gral-resultados' ? {
            mesDesde: params.mesHasta, mesHasta: params.mesHasta,
          } : {}),
          report, filtrosReport: filtros,
        });
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

  function renderEntrada(entry: EntradaMenuInforme, nivel = 0): ReactNode {
    const informe = entry.id ? porId.get(entry.id) : undefined;
    const numero = `${entry.numero}-`;
    if (entry.opciones) return (
      <details key={`${nivel}-${entry.numero}-${entry.nombre}`} className={nivel === 0 ? 'border-b border-gray-100 last:border-b-0' : 'border-t border-gray-100'}>
        <summary className={`flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm text-gray-800 hover:bg-petroleum-50/50 ${nivel > 0 ? 'pl-8' : ''}`}>
          <span className="w-7 shrink-0 font-mono font-semibold text-petroleum-700">{numero}</span>
          <span className="flex-1 font-medium">{entry.nombre}</span>
          <span className="text-xs text-gray-400">▾</span>
        </summary>
        <div className="bg-gray-50/60">
          {entry.opciones.map(opcion => renderEntrada(opcion, nivel + 1))}
        </div>
      </details>
    );
    return (
      <div key={`${nivel}-${entry.numero}-${entry.nombre}`} className={`flex items-center gap-3 border-b border-gray-100 px-4 py-2.5 last:border-b-0 ${nivel > 0 ? 'pl-8' : ''}`}>
        <span className="w-7 shrink-0 font-mono text-xs font-semibold text-petroleum-700">{numero}</span>
        {informe ? <>
          <button type="button" disabled={generando} onClick={() => abrirInforme(informe)} className="min-w-0 flex-1 text-left text-sm text-gray-800 hover:text-petroleum-700 disabled:opacity-50">
            {entry.nombre}
          </button>
          <button type="button" onClick={event => toggleFavorito(informe.id, event)} aria-label={favoritos.includes(informe.id) ? `Quitar ${entry.nombre} de favoritos` : `Añadir ${entry.nombre} a favoritos`} className="rounded px-1 text-gray-500 hover:bg-white">
            {favoritos.includes(informe.id) ? '★' : '☆'}
          </button>
          <button type="button" onClick={() => abrirInforme(informe)} disabled={generando} className="rounded bg-petroleum-500 px-3 py-1 text-xs font-medium text-white hover:bg-petroleum-600 disabled:opacity-50">Generar</button>
        </> : <>
          <span className="min-w-0 flex-1 text-sm text-gray-500">{entry.nombre}</span>
          <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">Pendiente</span>
        </>}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Informes / Centro de informes</div>
          <h1 className="text-lg font-semibold text-gray-800">Centro de informes</h1>
          <p className="mt-1 text-xs text-gray-500">Informes en el orden del programa original, del 1 al R.</p>
        </div>
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Informes contables</span>
      </div>

      {errorInforme && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{errorInforme}</div>
      )}
      {errorPeriodo && !errorInforme && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">No fue posible consultar el período operativo: {errorPeriodo}</div>
      )}

      {showIvaAnalisis && anioOperacion !== null && <IvaAnalisis cia={cia} anio={anioOperacion} onClose={() => setShowIvaAnalisis(false)} />}

      {/* Búsqueda transversal y accesos frecuentes */}
      {!showIvaAnalisis && <div className="bg-white rounded border border-gray-200 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-lg">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">⌕</span>
            <input
              value={searchInforme}
              onChange={e => setSearchInforme(e.target.value)}
              placeholder="Buscar informe por nombre o número..."
              aria-label="Buscar informe"
              className="w-full pl-7 pr-3 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-petroleum-500"
            />
          </div>
          <span className="text-xs text-gray-500">{MENU_INFORMES.length} opciones principales · {allInformes.length} informes disponibles</span>
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
      </div>}

      {/* Resultados de búsqueda */}
      {!showIvaAnalisis && searchInforme && (
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
                <div className="text-xs text-gray-400 mt-0.5">{inf.ruta} · {inf.desc}</div>
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

      {/* Numeración y jerarquía literal del menú Harbour MENU_INFOR. */}
      {!showIvaAnalisis && !searchInforme && (
        <section className="overflow-hidden rounded border border-gray-200 bg-white" aria-label="Informes del 1 al R">
          {MENU_INFORMES.map(entry => renderEntrada(entry))}
        </section>
      )}

      {/* Modal de parámetros */}
      {showParams && (
        <Modal title={`Parámetros — ${showParams.nombre}`} onClose={() => setShowParams(null)}>
          <form noValidate onKeyDown={avanzarFiltroConEnter} onSubmit={e => { e.preventDefault(); generar(showParams); }}>
            <div className="px-5 py-4 grid grid-cols-2 gap-4">
              {showParams.id === 'iva-acumulacion' && <p className="col-span-2 text-xs text-gray-600">
                Se recalcularán los acumulados de IVA de los meses elegidos para la compañía actual. Los demás meses no se modificarán.
              </p>}
              {showParams.id === 'doc-formato' && <div>
                <label htmlFor="param-mes-lote" className="block text-xs font-medium text-gray-600 mb-1">Mes o lote</label>
                <select id="param-mes-lote" data-initial-focus value={params.mesLote} onChange={e => setParams(p => ({ ...p, mesLote: e.target.value }))} className={INPUT}>
                  {MESES.map((mes, index) => <option key={mes} value={index + 1}>{String(index + 1).padStart(2, '0')} — {mes}</option>)}
                </select>
              </div>}
              {!THIRD_DIRECTORY_IDS.has(showParams.id) && showParams.id !== 'doc-formato' && showParams.id !== 'listado-cuentas' && showParams.id !== 'aux-gral' && showParams.id !== 'bal-gral-resultados' && <div>
                <label htmlFor="param-mes-desde" className="block text-xs font-medium text-gray-600 mb-1">Mes desde</label>
                <select id="param-mes-desde" data-initial-focus value={params.mesDesde} onChange={e => setParams(p => ({ ...p, mesDesde: e.target.value }))} className={INPUT}>
                  {(BALANCE_IDS.has(showParams.id) ? MESES_BALANCE : showParams.id === 'aux-doc-afectado' ? MESES_LIBRO : MESES).map(m => <option key={m}>{m}</option>)}
                </select>
              </div>}
              {!THIRD_DIRECTORY_IDS.has(showParams.id) && showParams.id !== 'doc-formato' && showParams.id !== 'listado-cuentas' && showParams.id !== 'aux-gral' && showParams.id !== 'bal-gral-resultados' && <div>
                <label htmlFor="param-mes-hasta" className="block text-xs font-medium text-gray-600 mb-1">Mes hasta</label>
                <select id="param-mes-hasta" value={params.mesHasta} onChange={e => setParams(p => ({ ...p, mesHasta: e.target.value }))} className={INPUT}>
                  {(BALANCE_IDS.has(showParams.id) ? MESES_BALANCE : showParams.id === 'aux-doc-afectado' ? MESES_LIBRO : MESES).map(m => <option key={m}>{m}</option>)}
                </select>
              </div>}
              {showParams.id === 'bal-gral-resultados' && <>
                <div className="col-span-2">
                  <label htmlFor="param-mes-balance-general" className="block text-xs font-medium text-gray-600 mb-1">Mes del informe</label>
                  <select id="param-mes-balance-general" data-initial-focus value={params.mesHasta} onChange={e => setParams(p => ({ ...p, mesHasta: e.target.value }))} className={INPUT}>
                    {MESES_BALANCE.map((mes, index) => <option key={mes} value={mes}>{String(index + 1).padStart(2, '0')} — {mes}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="param-nivel-balance-general" className="block text-xs font-medium text-gray-600 mb-1">Nivel</label>
                  <select id="param-nivel-balance-general" value={params.nivel} onChange={e => setParams(p => ({ ...p, nivel: e.target.value }))} className={INPUT}>
                    <option value="4">Cuenta</option><option value="6">Subcuenta</option>
                    <option value="9">Auxiliar 1</option><option value="12">Auxiliar 2</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirResultados} onChange={e => setParams(p => ({ ...p, incluirResultados: e.target.checked }))} />Imprimir Estado de resultados</label>
                  <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirCeros} onChange={e => setParams(p => ({ ...p, incluirCeros: e.target.checked }))} />Incluir saldos en cero</label>
                  <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirTerceros} onChange={e => setParams(p => ({ ...p, incluirTerceros: e.target.checked }))} />Incluir terceros</label>
                </div>
              </>}
              {showParams.id === 'aux-gral' && <>
                <div>
                  <label htmlFor="param-fecha-desde" className="block text-xs font-medium text-gray-600 mb-1">Fecha desde</label>
                  <input id="param-fecha-desde" data-initial-focus type="date" required value={params.fechaDesde} onChange={e => setParams(p => ({ ...p, fechaDesde: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label htmlFor="param-fecha-hasta" className="block text-xs font-medium text-gray-600 mb-1">Fecha hasta</label>
                  <input id="param-fecha-hasta" type="date" required value={params.fechaHasta} onChange={e => setParams(p => ({ ...p, fechaHasta: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label htmlFor="param-modalidad" className="block text-xs font-medium text-gray-600 mb-1">Detalle</label>
                  <select id="param-modalidad" value={params.modalidad} onChange={e => setParams(p => ({ ...p, modalidad: e.target.value as 'detallado' | 'resumido' }))} className={INPUT}>
                    <option value="detallado">Detallado</option><option value="resumido">Resumido</option>
                  </select>
                </div>
              </>}
              {showParams.id === 'aux-doc-afectado' && <div className="col-span-2">
                <label htmlFor="param-documento-afectado" className="block text-xs font-medium text-gray-600 mb-1">Documento afectado</label>
                <input id="param-documento-afectado" required maxLength={12} value={params.documentoAfectado} onChange={e => setParams(p => ({ ...p, documentoAfectado: e.target.value }))} className={INPUT} />
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
              {!BALANCE_IDS.has(showParams.id) && showParams.id !== 'bal-gral-resultados' && (
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
                      <input id={`param-${key}`} data-initial-focus={index === 0 ? '' : undefined} value={params[key]} onChange={e => setParams(p => ({ ...p, [key]: e.target.value }))} className={INPUT} />
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
            {(errorInforme || errorPeriodo) && <p role="alert" className="px-5 pb-3 text-xs text-red-700">{errorInforme || errorPeriodo}</p>}
            <div className="flex justify-end gap-2 border-t border-gray-200 p-4">
              <button type="button" onClick={() => setShowParams(null)} className={BUTTON_SECONDARY}>Cancelar</button>
              <button type="submit" data-report-submit disabled={generando || anioOperacion === null} className={`${BUTTON_PRIMARY} disabled:opacity-60`}>
                {generando ? (showParams.id === 'iva-acumulacion' ? 'Acumulando IVA…' : 'Consultando Advantage…')
                  : anioOperacion === null && !errorPeriodo ? 'Consultando período…'
                  : showParams.id === 'iva-acumulacion' ? 'Procesar acumulación' : 'Generar informe'}
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
