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
import { consultarInformeAdicional, consultarMovimientoAnualCentro, consultarMovimientoAnualTercero, consultarPaginaInformeAdicional, exportarInformeAdicional, procesarAcumulacionIva, procesarAcumulacionRetenciones, urlImpresionInformeAdicional, type FiltrosInformeAdicional, type InformeAdicional, type MovimientoAnualCentro, type MovimientoAnualTercero } from '../api/informesAdicionales';
import IvaAnalisis from './IvaAnalisis';
import RetencionesAnalisis from './RetencionesAnalisis';
import DefinicionesFlujo from './DefinicionesFlujo';

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
    id: 'retenciones',
    nombre: 'Retenciones',
    icon: '%',
    informes: [
      { id: 'ret-acumulacion', nombre: 'Acumulación general', desc: 'Reconstruye los acumulados de retención por cuenta y tercero' },
      { id: 'ret-analisis', nombre: 'Análisis acumulados y certificados', desc: 'Consulta y corrige acumulados; genera certificados de retenciones' },
      { id: 'ret-relacion', nombre: 'Relación acumulados', desc: 'Relaciona acumulados por cuenta o tercero' },
      { id: 'ret-totales-cuenta', nombre: 'Relación totales por cuenta', desc: 'Consolida bases y valores por cuenta' },
      { id: 'ret-soportes', nombre: 'Soportes y anexos', desc: 'Detalle de movimientos sujetos a retención' },
    ],
  },
  {
    id: 'iva',
    nombre: 'IVA',
    icon: '%',
    informes: [
      { id: 'iva-acumulacion', nombre: 'Acumulación general', desc: 'Reconstruye los acumulados de IVA por cuenta y tercero para el período elegido' },
      { id: 'iva-analisis', nombre: 'Análisis acumulados y certificados', desc: 'Consulta y corrige los valores mensuales; emite certificados de IVA' },
      { id: 'iva-relacion', nombre: 'Relación acumulados', desc: 'Bases y valores de IVA por cuenta o tercero, resumidos o por mes' },
      { id: 'iva-totales-cuenta', nombre: 'Relación totales por cuenta', desc: 'Bases y valores de IVA consolidados por cuenta' },
      { id: 'iva-soportes', nombre: 'Soportes y anexos', desc: 'Partidas de IVA por cuenta y tercero con subtotales y consolidados' },
    ],
  },
  {
    id: 'terceros',
    nombre: 'Terceros',
    icon: '👤',
    informes: [
      { id: 'tercero-general', nombre: 'Consulta', desc: 'Saldos anteriores, débitos, créditos y saldos por cuenta y tercero' },
      { id: 'tercero-cuenta-tercero', nombre: 'Movimiento cuenta-tercero', desc: 'Partidas detalladas o resumidas por cuenta y tercero' },
      { id: 'tercero-especifico', nombre: 'Movimiento específico por tercero', desc: 'Resumen o partidas de un tercero en las cuentas seleccionadas' },
      { id: 'tercero-cumpleanos', nombre: 'Cumpleaños', desc: 'Fechas de cumpleaños de los terceros' },
      { id: 'tercero-etiquetas', nombre: 'Etiquetas', desc: 'Terceros organizados por zona comercial' },
    ],
  },
  {
    id: 'centros',
    nombre: 'Centros de costo',
    icon: '🏢',
    informes: [
      { id: 'centro-consulta', nombre: 'Consulta', desc: 'Acumulados por cuenta, centro y tercero' },
      { id: 'centro-cuenta-centro', nombre: 'Cuenta por centro de costo', desc: 'Saldo y movimiento del mes por cuenta y centro' },
      { id: 'centro-por-cuenta', nombre: 'Centro de costo por cuenta', desc: 'Informe por centros y cuentas seleccionadas' },
      { id: 'centro-tercero-centro', nombre: 'Tercero por centro de costo', desc: 'Movimiento agrupado por tercero, centro y cuenta' },
      { id: 'centro-detallado', nombre: 'Detallado cuenta por centro de costo', desc: 'Partidas contables por fecha, cuenta y centro' },
      { id: 'centro-columnas-5152', nombre: 'Centro por cuenta · columnas 51–52', desc: 'Débitos y créditos mensuales de cuentas 51 y 52' },
      { id: 'centro-por-nivel', nombre: 'Consulta acumulada por nivel', desc: 'Saldo al mes por nivel de cuenta y centro' },
      { id: 'diario-rangos-continuos', nombre: 'Diario rangos continuos', desc: 'Diario de centros con rangos continuos de documentos' },
      { id: 'diario-rangos-fijos', nombre: 'Diario rangos fijos', desc: 'Diario de centros con rangos fijos por centro' },
      { id: 'balance-acumulado', nombre: 'Balance acumulado', desc: 'Saldos acumulados por centro' },
      { id: 'balance-mensual-centro', nombre: 'Balance mensual por centro de costo', desc: 'Movimiento mensual por centro' },
      { id: 'clasificacion-centros', nombre: 'Clasificación por centros', desc: 'Cuentas clasificadas por centro de costo' },
      { id: 'clasificacion-centro-tercero', nombre: 'Clasificación centro-tercero', desc: 'Cruce de centros contra terceros' },
      { id: 'discriminados-mes', nombre: 'Discriminados por mes', desc: 'Balance acumulado de los centros seleccionados, al nivel auxiliar 2' },
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
    { numero: '1', nombre: 'Acumulación general', id: 'ret-acumulacion' },
    { numero: '2', nombre: 'Análisis acumulados y certificados', id: 'ret-analisis' },
    { numero: '3', nombre: 'Relación acumulados', id: 'ret-relacion' },
    { numero: '4', nombre: 'Relación totales por cuenta', id: 'ret-totales-cuenta' },
    { numero: '5', nombre: 'Soportes y anexos', id: 'ret-soportes' },
    { numero: '7', nombre: 'Plano reporte anual retenciones', id: 'ret-plano-anual' },
  ] },
  { numero: '7', nombre: 'Informe de IVA', opciones: [
    { numero: '1', nombre: 'Acumulación general', id: 'iva-acumulacion' },
    { numero: '2', nombre: 'Análisis acumulados y certificados', id: 'iva-analisis' },
    { numero: '3', nombre: 'Relación acumulados', id: 'iva-relacion' },
    { numero: '4', nombre: 'Relación totales por cuenta', id: 'iva-totales-cuenta' },
    { numero: '5', nombre: 'Soportes y anexos', id: 'iva-soportes' },
  ] },
  { numero: '8', nombre: 'Informe de terceros', opciones: [
    { numero: '2', nombre: 'Consulta', id: 'tercero-general' },
    { numero: '3', nombre: 'Movimiento cuenta-tercero', id: 'tercero-cuenta-tercero' },
    { numero: '4', nombre: 'Movimiento específico por tercero', id: 'tercero-especifico' },
  ] },
  { numero: '9', nombre: 'Informe por centros de costos', opciones: [
    { numero: '2', nombre: 'Consulta', id: 'centro-consulta' },
    { numero: '3', nombre: 'Informes', opciones: [
      { numero: '1', nombre: 'Cuenta por centro de costo', id: 'centro-cuenta-centro' },
      { numero: '2', nombre: 'Centro de costo por cuenta', id: 'centro-por-cuenta' },
      { numero: '3', nombre: 'Tercero por centro de costo', id: 'centro-tercero-centro' },
      { numero: '4', nombre: 'Detallado cuenta por centro de costo', id: 'centro-detallado' },
      { numero: '5', nombre: 'Centro de costo por cuenta y columnas (51–52)', id: 'centro-columnas-5152' },
    ] },
    { numero: '5', nombre: 'Consulta acumulada por nivel', id: 'centro-por-nivel' },
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
const MESES_NIVEL_CENTROS = ['Mes 00', ...MESES_BALANCE];
const BALANCE_IDS = new Set(['balance-comp', 'balance-mensual']);
const ACCOUNT_BALANCE_IDS = new Set([
  'inventario-bal', 'mayor-bal', 'saldos-cuenta',
  'bal-comparativo-mensual', 'analisis-anual-acum', 'analisis-anual-mens', 'balance-prueba-anual',
]);
const ANNUAL_ANALYSIS_IDS = new Set(['analisis-anual-acum', 'analisis-anual-mens']);
// El CONINFOR.PRG recibido no imprime ninguna de estas dos salidas.
const PENDING_NIC_IDS = new Set(['esfa-apertura', 'nic-saldos']);
const CENTER_JOURNAL_IDS = new Set(['diario-rangos-continuos', 'diario-rangos-fijos']);
const CENTER_BALANCE_IDS = new Set(['balance-acumulado', 'balance-mensual-centro',
  'clasificacion-centros', 'clasificacion-centro-tercero', 'discriminados-mes']);
const CENTER_REPORT_IDS = new Set([
  'balance-acumulado', 'balance-mensual-centro', 'clasificacion-centros',
  'clasificacion-centro-tercero', 'discriminados-mes',
]);
const THIRD_SUMMARY_IDS = new Set([
  'tercero-acumulacion', 'tercero-cuenta-tercero', 'comp-cta-tercero', 'resumen-tipo-contribuyente',
]);
const THIRD_DIRECTORY_IDS = new Set(['tercero-cumpleanos', 'tercero-etiquetas']);
const THIRD_ORIGINAL_IDS = new Set(['tercero-general', 'tercero-cuenta-tercero']);
const CENTER_ORIGINAL_IDS = new Set(['centro-consulta', 'centro-cuenta-centro', 'centro-por-cuenta',
  'centro-tercero-centro', 'centro-detallado', 'centro-columnas-5152', 'centro-por-nivel']);
const CENTER_SINGLE_MONTH_IDS = new Set(['centro-cuenta-centro', 'centro-por-cuenta',
  'centro-tercero-centro', 'centro-columnas-5152', 'centro-por-nivel']);
const CENTER_ZERO_MONTH_IDS = new Set(['centro-cuenta-centro', 'centro-por-cuenta', 'centro-tercero-centro']);

function mostrarFiltro(id: string, key: string): boolean {
  const account = ['cuentaDesde', 'cuentaHasta', 'buscar'].includes(key);
  const third = ['cuentaDesde', 'cuentaHasta', 'nit', 'buscar'].includes(key);
  const center = ['cuentaDesde', 'cuentaHasta', 'nit', 'centro', 'buscar'].includes(key);
  if (id === 'listado-cuentas') return ['cuentaDesde', 'cuentaHasta'].includes(key);
  if (id === 'aux-gral') return ['cuentaDesde', 'cuentaHasta'].includes(key);
  if (id === 'aux-doc-afectado') return false;
  if (id === 'bal-gral-resultados') return false;
  if (id === 'iva-acumulacion' || id === 'ret-acumulacion') return false;
  if (id === 'iva-relacion' || id === 'iva-totales-cuenta') return ['cuentaDesde', 'cuentaHasta'].includes(key);
  if (id === 'iva-soportes') return ['cuentaDesde', 'cuentaHasta'].includes(key);
  if (id === 'tercero-especifico') return key === 'nit';
  if (id === 'mov-comprobante' || id === 'mov-tipo-doc') return false;
  if (CENTER_JOURNAL_IDS.has(id)) return false;
  if (CENTER_BALANCE_IDS.has(id)) return false;
  if (id === 'mov-cuenta') return false;
  if (id === 'resumen-tipo-contribuyente' || id === 'comp-cta-tercero') return false;
  if (id === 'flujo-comparativo') return false;
  if (id === 'diario-cta') return ['cuentaDesde', 'cuentaHasta'].includes(key);
  if (id === 'caja-diario-comp') return false;
  if (id === 'caja-diario-cta') return false;
  if (id === 'saldos-cuenta') return false;
  if (id === 'bal-comparativo-mensual') return false;
  if (ANNUAL_ANALYSIS_IDS.has(id)) return false;
  if (id === 'balance-prueba-anual') return false;
  if (id === 'ret-relacion' || id === 'ret-totales-cuenta') return ['cuentaDesde', 'cuentaHasta', 'nit', 'buscar'].includes(key);
  if (id === 'ret-soportes') return ['cuentaDesde', 'cuentaHasta', 'nit', 'fechaDesde', 'fechaHasta', 'buscar'].includes(key);
  if (ACCOUNT_BALANCE_IDS.has(id)) return account;
  if (THIRD_DIRECTORY_IDS.has(id)) return ['nit', 'buscar'].includes(key);
  if (THIRD_ORIGINAL_IDS.has(id)) return ['cuentaDesde', 'cuentaHasta'].includes(key);
  if (CENTER_ORIGINAL_IDS.has(id)) return ['centro-consulta', 'centro-cuenta-centro', 'centro-tercero-centro', 'centro-detallado'].includes(id)
    && ['cuentaDesde', 'cuentaHasta'].includes(key);
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
  const [annualThird, setAnnualThird] = useState<MovimientoAnualTercero | MovimientoAnualCentro | null>(null);
  const [annualLoading, setAnnualLoading] = useState(false);
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

  async function abrirAnualTercero(row: Celda[]) {
    if (!['tercero-general', 'centro-consulta'].includes(preview.inf.id) || !preview.filtrosReport || String(row[0]).startsWith('TOTAL')) return;
    setAnnualLoading(true);
    setAviso(null);
    try {
      setAnnualThird(preview.inf.id === 'centro-consulta'
        ? await consultarMovimientoAnualCentro(preview.filtrosReport.cia, preview.filtrosReport.anio,
            String(row[0]), String(row[2]), String(row[4]))
        : await consultarMovimientoAnualTercero(preview.filtrosReport.cia, preview.filtrosReport.anio,
            String(row[0]), String(row[2])));
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'No fue posible abrir el movimiento anual.');
    } finally {
      setAnnualLoading(false);
    }
  }

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
          {annualLoading && <span className="text-xs text-gray-500">Consultando movimiento anual…</span>}
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
                <tr key={i} onClick={() => abrirAnualTercero(fila)} className={datos.tipos?.[paginadoServidor ? i : inicio + i] === 'seccion' && preview.inf.id !== 'aux-gral' ? 'bg-petroleum-500 text-white font-semibold' :
                  datos.tipos?.[paginadoServidor ? i : inicio + i]?.startsWith('total') || datos.tipos?.[paginadoServidor ? i : inicio + i] === 'resultado' ||
                  datos.tipos?.[paginadoServidor ? i : inicio + i] === 'seccion' || datos.tipos?.[paginadoServidor ? i : inicio + i] === 'subtotal' ||
                  datos.tipos?.[paginadoServidor ? i : inicio + i] === 'apertura' ? 'bg-petroleum-50 font-semibold' : ['tercero-general', 'centro-consulta'].includes(preview.inf.id) && !String(fila[0]).startsWith('TOTAL') ? 'hoverable cursor-pointer' : 'hoverable'}>
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
      {annualThird && <Modal title={`Movimiento anual · ${annualThird.cuenta} · ${'centro' in annualThird ? `${annualThird.centro} · ` : ''}${annualThird.tercero}`} onClose={() => setAnnualThird(null)} ancho="max-w-3xl">
        <div className="px-5 py-4 text-xs text-gray-600">{annualThird.nombreCuenta} · {'nombreCentro' in annualThird ? `${annualThird.nombreCentro} · ` : ''}{annualThird.nombreTercero}</div>
        <div className="overflow-auto px-5 pb-5">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-600"><tr><th className="px-3 py-2 text-left">Mes</th><th className="px-3 py-2 text-right">Débitos</th><th className="px-3 py-2 text-right">Créditos</th><th className="px-3 py-2 text-right">Saldo</th></tr></thead>
            <tbody>
              <tr className="border-t border-gray-100 font-semibold"><td className="px-3 py-2">Saldo inicial</td><td /><td /><td className="px-3 py-2 text-right">{fmtMonto(annualThird.saldoInicial)}</td></tr>
              {annualThird.meses.map(item => <tr key={item.mes} className="border-t border-gray-100"><td className="px-3 py-2">{MESES[item.mes - 1]}</td><td className="px-3 py-2 text-right">{fmtMonto(item.debito)}</td><td className="px-3 py-2 text-right">{fmtMonto(item.credito)}</td><td className="px-3 py-2 text-right">{fmtMonto(item.saldo)}</td></tr>)}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold"><tr><td className="px-3 py-2">Saldo final</td><td /><td /><td className="px-3 py-2 text-right">{fmtMonto(annualThird.saldoFinal)}</td></tr></tfoot>
          </table>
        </div>
      </Modal>}
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
  const [showRetAnalisis, setShowRetAnalisis] = useState(false);
  const [favoritos, setFavoritos] = useState<string[]>(() => leerLista(STORAGE_FAVS));
  const [recientes, setRecientes] = useState<string[]>(() => leerLista(STORAGE_RECIENTES));
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [params, setParams] = useState({
    mesDesde: 'Enero', mesHasta: 'Febrero', mesLote: '1', nivel: '4', incluirCeros: false,
    incluirSubtotales: false,
    incluirResultados: true, incluirTerceros: false, incluirCentros: false,
    modoComparativo: 'saldo' as 'saldo' | 'movimiento',
    operacionComparativa: 'diferencia' as 'diferencia' | 'sumatoria',
    detalleCuentaDesde: '', detalleCuentaHasta: '',
    cuentaDesde: '', cuentaHasta: '', nit: '', centro: '', comprobante: '', comprobanteHasta: '',
    nitDesde: '', nitHasta: '', ordenTerceros: 'cuenta' as 'cuenta' | 'tercero',
    ordenMovimiento: 'documento' as 'documento' | 'fecha',
    centroDesde: '', centroHasta: '', ordenCentros: 'cuenta' as 'cuenta' | 'centro',
    cuentasSeleccionadas: '', centrosSeleccionados: '', prefijoCuenta: '', incluirSaldoAnterior: true,
    tipoDocumento: '', tipoDocumentoHasta: '', tipoContribuyente: '', companiaAnterior: '',
    documentoDesde: '', documentoHasta: '', buscar: '',
    fechaDesde: '', fechaHasta: '', modalidad: 'detallado' as 'detallado' | 'resumido',
    documentoAfectado: '',
  });
  const [generando, setGenerando] = useState(false);
  const [showFlowDefinitions, setShowFlowDefinitions] = useState(false);
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

  const allInformes = entradasConInforme(MENU_INFORMES).filter(inf => !PENDING_NIC_IDS.has(inf.id));
  const porId = new Map(allInformes.map(i => [i.id, i]));
  const filtered = searchInforme
    ? allInformes.filter(i => i.nombre.toLowerCase().includes(searchInforme.toLowerCase()) || i.desc.toLowerCase().includes(searchInforme.toLowerCase()) || i.ruta.toLowerCase().includes(searchInforme.toLowerCase()))
    : [];

  function abrirInforme(inf: Informe) {
    if (inf.id === 'def-cuentas-flujo') {
      setShowFlowDefinitions(true);
      setShowParams(null);
      setPreview(null);
      return;
    }
    if (inf.id === 'ret-analisis') {
      setShowRetAnalisis(true);
      setShowParams(null);
      setPreview(null);
      return;
    }
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
      mesDesde: ['iva-acumulacion', 'ret-acumulacion', 'iva-relacion', 'iva-totales-cuenta', 'tercero-especifico', 'mov-comprobante', 'mov-tipo-doc'].includes(inf.id) || THIRD_ORIGINAL_IDS.has(inf.id) || CENTER_ORIGINAL_IDS.has(inf.id) ? (MESES[Number(p.mesLote) - 1] ?? 'Enero')
        : BALANCE_IDS.has(inf.id) ? p.mesDesde : (MESES.includes(p.mesDesde) ? p.mesDesde : 'Enero'),
      mesHasta: ['iva-acumulacion', 'ret-acumulacion', 'iva-relacion', 'iva-totales-cuenta', 'tercero-especifico', 'mov-comprobante', 'mov-tipo-doc'].includes(inf.id) || THIRD_ORIGINAL_IDS.has(inf.id) || CENTER_ORIGINAL_IDS.has(inf.id) ? (MESES[Number(p.mesLote) - 1] ?? 'Enero')
        : BALANCE_IDS.has(inf.id) || inf.id === 'bal-gral-resultados'
        ? (MESES_BALANCE.includes(p.mesHasta) ? p.mesHasta : 'Diciembre')
        : (MESES.includes(p.mesHasta) ? p.mesHasta : 'Diciembre'),
      cuentaDesde: '', cuentaHasta: '', nit: '', nitDesde: '', nitHasta: '', ordenTerceros: 'cuenta', ordenMovimiento: 'documento', centro: '', comprobante: '',
      centroDesde: '', centroHasta: '', ordenCentros: 'cuenta', cuentasSeleccionadas: '', centrosSeleccionados: '', prefijoCuenta: '', incluirSaldoAnterior: true,
      comprobanteHasta: '', tipoDocumento: '', tipoDocumentoHasta: '', tipoContribuyente: '', companiaAnterior: '',
      documentoDesde: '', documentoHasta: '', buscar: '',
      modalidad: ['iva-relacion', 'tercero-especifico'].includes(inf.id) ? 'resumido' : 'detallado', documentoAfectado: '',
      ...(['mov-comprobante', 'mov-tipo-doc'].includes(inf.id) ? { ordenMovimiento: 'fecha' as const, incluirSubtotales: false } : {}),
      ...(CENTER_ORIGINAL_IDS.has(inf.id) ? { incluirTerceros: true } : {}),
      ...(['bal-gral-resultados', 'inventario-bal'].includes(inf.id) ? {
        incluirResultados: true, incluirCeros: false, incluirTerceros: false,
      } : {}),
      ...(inf.id === 'inventario-bal' ? { mesHasta: MESES_BALANCE[new Date().getMonth()] } : {}),
      ...(inf.id === 'mayor-bal' ? {
        mesDesde: MESES_BALANCE[new Date().getMonth()],
        mesHasta: MESES_BALANCE[new Date().getMonth()],
        nivel: '1', incluirCeros: false,
      } : {}),
      ...(inf.id === 'diario-cta' ? { mesHasta: MESES_BALANCE[new Date().getMonth()] } : {}),
      ...(CENTER_JOURNAL_IDS.has(inf.id) ? {
        mesHasta: MESES_BALANCE[new Date().getMonth()],
        ordenCentros: 'cuenta' as const, modalidad: 'detallado' as const,
      } : {}),
      ...(CENTER_BALANCE_IDS.has(inf.id) ? {
        mesDesde: MESES_BALANCE[new Date().getMonth()],
        mesHasta: MESES_BALANCE[new Date().getMonth()],
        nivel: '4', incluirResultados: true, incluirCeros: false, incluirTerceros: false,
      } : {}),
      ...(inf.id === 'caja-diario-comp' ? {
        mesHasta: MESES_BALANCE[new Date().getMonth()],
        nivel: '1', comprobante: '', comprobanteHasta: '',
      } : {}),
      ...(inf.id === 'caja-diario-cta' ? {
        mesHasta: MESES_BALANCE[new Date().getMonth()],
        nivel: '1', cuentaDesde: '', cuentaHasta: '',
      } : {}),
      ...(inf.id === 'saldos-cuenta' ? {
        mesHasta: MESES_BALANCE[new Date().getMonth()],
        nivel: '4', cuentaDesde: '', cuentaHasta: '',
        incluirCeros: false, incluirTerceros: false,
      } : {}),
      ...(inf.id === 'bal-comparativo-mensual' ? {
        mesDesde: MESES_BALANCE[new Date().getMonth()],
        mesHasta: MESES_BALANCE[new Date().getMonth()], nivel: '4',
        incluirResultados: true, incluirCeros: false, incluirTerceros: false,
        modoComparativo: 'saldo' as const,
        operacionComparativa: 'diferencia' as const,
      } : {}),
      ...(ANNUAL_ANALYSIS_IDS.has(inf.id) ? {
        mesDesde: 'Enero', mesHasta: 'Diciembre', nivel: '4',
      } : {}),
      ...(inf.id === 'balance-prueba-anual' ? {
        nivel: '4', incluirResultados: true, incluirCeros: false,
        incluirTerceros: false, incluirCentros: false,
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
      mesDesde: ANNUAL_ANALYSIS_IDS.has(inf.id) || ['balance-prueba-anual', 'flujo-comparativo'].includes(inf.id) ? 1
        : ['bal-gral-resultados', 'inventario-bal', 'diario-cta', 'caja-diario-comp', 'caja-diario-cta', 'saldos-cuenta', 'comp-cta-tercero'].includes(inf.id) || CENTER_JOURNAL_IDS.has(inf.id) || CENTER_BALANCE_IDS.has(inf.id) ? MESES_BALANCE.indexOf(params.mesHasta) + 1
        : inf.id === 'doc-formato' ? mesSeleccionado
        : ['mov-comprobante', 'mov-tipo-doc'].includes(inf.id) ? MESES_LIBRO.indexOf(params.mesHasta)
        : inf.id === 'tercero-especifico' ? MESES_BALANCE.indexOf(params.mesDesde) + 1
        : inf.id === 'iva-soportes' || inf.id === 'mov-cuenta' ? Number(params.fechaDesde.slice(5, 7))
        : inf.id === 'centro-detallado' ? Number(params.fechaDesde.slice(5, 7))
        : inf.id === 'centro-por-nivel' ? MESES_NIVEL_CENTROS.indexOf(params.mesHasta)
        : CENTER_ZERO_MONTH_IDS.has(inf.id) ? MESES_LIBRO.indexOf(params.mesHasta)
        : CENTER_SINGLE_MONTH_IDS.has(inf.id) ? MESES.indexOf(params.mesHasta) + 1
        : inf.id === 'aux-doc-afectado' || THIRD_ORIGINAL_IDS.has(inf.id) || inf.id === 'centro-consulta' ? MESES_LIBRO.indexOf(params.mesDesde)
        : inf.id === 'aux-gral' ? Number(params.fechaDesde.slice(5, 7))
        : ['mayor-bal', 'bal-comparativo-mensual'].includes(inf.id) ? MESES_BALANCE.indexOf(params.mesDesde) + 1
        : MESES.indexOf(params.mesDesde) + 1,
      mesHasta: inf.id === 'balance-prueba-anual' ? 13
        : inf.id === 'flujo-comparativo' ? 12
        : ANNUAL_ANALYSIS_IDS.has(inf.id) ? 12
        : ['bal-gral-resultados', 'inventario-bal', 'diario-cta', 'caja-diario-comp', 'caja-diario-cta', 'saldos-cuenta', 'comp-cta-tercero'].includes(inf.id) || CENTER_JOURNAL_IDS.has(inf.id) || CENTER_BALANCE_IDS.has(inf.id) ? MESES_BALANCE.indexOf(params.mesHasta) + 1
        : inf.id === 'doc-formato' ? mesSeleccionado
        : ['mov-comprobante', 'mov-tipo-doc'].includes(inf.id) ? MESES_LIBRO.indexOf(params.mesHasta)
        : inf.id === 'tercero-especifico' ? MESES_BALANCE.indexOf(params.mesHasta) + 1
        : inf.id === 'iva-soportes' || inf.id === 'mov-cuenta' ? Number(params.fechaHasta.slice(5, 7))
        : inf.id === 'centro-detallado' ? Number(params.fechaHasta.slice(5, 7))
        : inf.id === 'centro-por-nivel' ? MESES_NIVEL_CENTROS.indexOf(params.mesHasta)
        : CENTER_ZERO_MONTH_IDS.has(inf.id) ? MESES_LIBRO.indexOf(params.mesHasta)
        : CENTER_SINGLE_MONTH_IDS.has(inf.id) ? MESES.indexOf(params.mesHasta) + 1
        : inf.id === 'aux-doc-afectado' || THIRD_ORIGINAL_IDS.has(inf.id) || inf.id === 'centro-consulta' ? MESES_LIBRO.indexOf(params.mesHasta)
        : inf.id === 'aux-gral' ? Number(params.fechaHasta.slice(5, 7))
        : ['mayor-bal', 'bal-comparativo-mensual'].includes(inf.id) ? MESES_BALANCE.indexOf(params.mesHasta) + 1
        : MESES.indexOf(params.mesHasta) + 1,
      cuentaDesde: params.cuentaDesde,
      cuentaHasta: params.cuentaHasta,
      nit: params.nit,
      nitDesde: params.nitDesde,
      nitHasta: params.nitHasta,
      ordenTerceros: params.ordenTerceros,
      ordenMovimiento: params.ordenMovimiento,
      centro: params.centro,
      centroDesde: params.centroDesde,
      centroHasta: params.centroHasta,
      ordenCentros: params.ordenCentros,
      cuentasSeleccionadas: params.cuentasSeleccionadas,
      centrosSeleccionados: params.centrosSeleccionados,
      prefijoCuenta: params.prefijoCuenta,
      incluirSaldoAnterior: params.incluirSaldoAnterior,
      incluirSubtotales: params.incluirSubtotales,
      comprobante: params.comprobante,
      comprobanteHasta: params.comprobanteHasta,
      tipoDocumento: params.tipoDocumento,
      tipoDocumentoHasta: params.tipoDocumentoHasta,
      tipoContribuyente: params.tipoContribuyente,
      companiaAnterior: params.companiaAnterior,
      documentoDesde: params.documentoDesde,
      documentoHasta: params.documentoHasta,
      buscar: params.buscar,
      fechaDesde: params.fechaDesde,
      fechaHasta: params.fechaHasta,
      modalidad: params.modalidad,
      documentoAfectado: params.documentoAfectado,
      nivel: Number(params.nivel),
      incluirCeros: params.incluirCeros,
      ...((CENTER_ORIGINAL_IDS.has(inf.id) || CENTER_BALANCE_IDS.has(inf.id) || ['saldos-cuenta', 'bal-comparativo-mensual'].includes(inf.id)) ? { incluirTerceros: params.incluirTerceros } : {}),
      ...(CENTER_BALANCE_IDS.has(inf.id) ? { incluirResultados: params.incluirResultados } : {}),
      ...(inf.id === 'bal-comparativo-mensual' ? {
        incluirResultados: params.incluirResultados,
        modoComparativo: params.modoComparativo,
        operacionComparativa: params.operacionComparativa,
      } : {}),
      ...(inf.id === 'balance-prueba-anual' ? {
        incluirResultados: params.incluirResultados,
        incluirTerceros: params.incluirTerceros,
        incluirCentros: params.incluirCentros,
      } : {}),
      ...(['bal-gral-resultados', 'inventario-bal'].includes(inf.id) ? {
        incluirResultados: params.incluirResultados,
        ...(inf.id === 'bal-gral-resultados' ? { incluirTerceros: params.incluirTerceros } : {}),
      } : {}),
    };
    if (['iva-acumulacion', 'ret-acumulacion'].includes(inf.id) && filtros.mesDesde > filtros.mesHasta) {
      setErrorInforme('El mes inicial no puede ser posterior al mes final.');
      return;
    }
    setGenerando(true);
    try {
      const report = inf.id === 'iva-acumulacion'
        ? await procesarAcumulacionIva(filtros)
        : inf.id === 'ret-acumulacion'
        ? await procesarAcumulacionRetenciones(filtros)
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
      {showRetAnalisis && anioOperacion !== null && <RetencionesAnalisis cia={cia} anio={anioOperacion} onClose={() => setShowRetAnalisis(false)} />}

      {/* Búsqueda transversal y accesos frecuentes */}
      {!showIvaAnalisis && !showRetAnalisis && <div className="bg-white rounded border border-gray-200 p-3 space-y-2.5">
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

      {showFlowDefinitions && <DefinicionesFlujo cia={cia} onClose={() => setShowFlowDefinitions(false)} />}

      {/* Resultados de búsqueda */}
      {!showFlowDefinitions && !showIvaAnalisis && !showRetAnalisis && searchInforme && (
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
      {!showFlowDefinitions && !showIvaAnalisis && !showRetAnalisis && !searchInforme && (
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
              {showParams.id === 'ret-acumulacion' && <p className="col-span-2 text-xs text-gray-600">
                Se reemplazarán los acumulados de retenciones de los meses elegidos para la compañía actual. Los demás meses no se modificarán.
              </p>}
              {THIRD_ORIGINAL_IDS.has(showParams.id) && <p className="col-span-2 text-xs text-gray-600">
                Consulte los saldos y movimientos de los terceros para el período y rangos elegidos.
              </p>}
              {showParams.id === 'doc-formato' && <div>
                <label htmlFor="param-mes-lote" className="block text-xs font-medium text-gray-600 mb-1">Mes o lote</label>
                <select id="param-mes-lote" data-initial-focus value={params.mesLote} onChange={e => setParams(p => ({ ...p, mesLote: e.target.value }))} className={INPUT}>
                  {MESES.map((mes, index) => <option key={mes} value={index + 1}>{String(index + 1).padStart(2, '0')} — {mes}</option>)}
                </select>
              </div>}
              {['mov-comprobante', 'mov-tipo-doc'].includes(showParams.id) && <>
                <div className="col-span-2"><label htmlFor="param-mes-comprobante" className="block text-xs font-medium text-gray-600 mb-1">Mes del movimiento</label>
                  <select id="param-mes-comprobante" data-initial-focus value={params.mesHasta} onChange={e => setParams(p => ({ ...p, mesHasta: e.target.value }))} className={INPUT}>
                    {MESES_LIBRO.map((mes, index) => <option key={mes} value={mes}>{String(index).padStart(2, '0')} — {mes}</option>)}
                  </select></div>
                <div><label htmlFor="param-comprobante-desde" className="block text-xs font-medium text-gray-600 mb-1">{showParams.id === 'mov-tipo-doc' ? 'Tipo documental desde' : 'Comprobante desde'}</label>
                  <input id="param-comprobante-desde" maxLength={2} value={showParams.id === 'mov-tipo-doc' ? params.tipoDocumento : params.comprobante} onChange={e => setParams(p => ({ ...p, [showParams.id === 'mov-tipo-doc' ? 'tipoDocumento' : 'comprobante']: e.target.value }))} className={INPUT} /></div>
                <div><label htmlFor="param-comprobante-hasta" className="block text-xs font-medium text-gray-600 mb-1">{showParams.id === 'mov-tipo-doc' ? 'Tipo documental hasta' : 'Comprobante hasta'}</label>
                  <input id="param-comprobante-hasta" maxLength={2} value={showParams.id === 'mov-tipo-doc' ? params.tipoDocumentoHasta : params.comprobanteHasta} onChange={e => setParams(p => ({ ...p, [showParams.id === 'mov-tipo-doc' ? 'tipoDocumentoHasta' : 'comprobanteHasta']: e.target.value }))} className={INPUT} /></div>
                <div><label htmlFor="param-orden-comprobante" className="block text-xs font-medium text-gray-600 mb-1">Ordenar dentro del {showParams.id === 'mov-tipo-doc' ? 'tipo documental' : 'comprobante'}</label>
                  <select id="param-orden-comprobante" value={params.ordenMovimiento} onChange={e => setParams(p => ({ ...p, ordenMovimiento: e.target.value as 'documento' | 'fecha' }))} className={INPUT}>
                    <option value="fecha">Por fecha</option><option value="documento">Por documento</option>
                  </select></div>
                <label className="flex items-center gap-2 self-end pb-1 text-xs text-gray-600">
                  <input type="checkbox" checked={params.incluirSubtotales} onChange={e => setParams(p => ({ ...p, incluirSubtotales: e.target.checked }))} />Subtotal por fecha/documento
                </label>
              </>}
              {CENTER_JOURNAL_IDS.has(showParams.id) && <>
                <div className="col-span-2"><label htmlFor="param-mes-diario-centro" className="block text-xs font-medium text-gray-600 mb-1">Mes del diario</label>
                  <select id="param-mes-diario-centro" data-initial-focus value={params.mesHasta} onChange={e => setParams(p => ({ ...p, mesHasta: e.target.value }))} className={INPUT}>
                    {MESES_BALANCE.map((mes, index) => <option key={mes} value={mes}>{String(index + 1).padStart(2, '0')} — {mes}</option>)}
                  </select></div>
                <div><label htmlFor="param-k-cuenta-desde" className="block text-xs font-medium text-gray-600 mb-1">Cuenta desde</label>
                  <input id="param-k-cuenta-desde" maxLength={12} value={params.cuentaDesde} onChange={e => setParams(p => ({ ...p, cuentaDesde: e.target.value }))} className={INPUT} /></div>
                <div><label htmlFor="param-k-cuenta-hasta" className="block text-xs font-medium text-gray-600 mb-1">Cuenta hasta</label>
                  <input id="param-k-cuenta-hasta" maxLength={12} value={params.cuentaHasta} onChange={e => setParams(p => ({ ...p, cuentaHasta: e.target.value }))} className={INPUT} /></div>
                {showParams.id === 'diario-rangos-continuos' ? <>
                  <div><label htmlFor="param-k-centro-desde" className="block text-xs font-medium text-gray-600 mb-1">Centro desde</label>
                    <input id="param-k-centro-desde" maxLength={7} value={params.centroDesde} onChange={e => setParams(p => ({ ...p, centroDesde: e.target.value }))} className={INPUT} /></div>
                  <div><label htmlFor="param-k-centro-hasta" className="block text-xs font-medium text-gray-600 mb-1">Centro hasta</label>
                    <input id="param-k-centro-hasta" maxLength={7} value={params.centroHasta} onChange={e => setParams(p => ({ ...p, centroHasta: e.target.value }))} className={INPUT} /></div>
                </> : <div className="col-span-2"><label htmlFor="param-k-centros-fijos" className="block text-xs font-medium text-gray-600 mb-1">Centros fijos (máximo 10, separados por coma)</label>
                  <input id="param-k-centros-fijos" value={params.centrosSeleccionados} onChange={e => setParams(p => ({ ...p, centrosSeleccionados: e.target.value }))} className={INPUT} /></div>}
                <div><label htmlFor="param-k-orden" className="block text-xs font-medium text-gray-600 mb-1">Presentación</label>
                  <select id="param-k-orden" value={params.ordenCentros} onChange={e => setParams(p => ({ ...p, ordenCentros: e.target.value as 'cuenta' | 'centro' }))} className={INPUT}>
                    <option value="cuenta">Por cuenta y centro</option><option value="centro">Unificado por centro</option>
                  </select></div>
                {showParams.id === 'diario-rangos-continuos' && params.ordenCentros === 'centro' && <div><label htmlFor="param-k-detalle" className="block text-xs font-medium text-gray-600 mb-1">Información</label>
                  <select id="param-k-detalle" value={params.modalidad} onChange={e => setParams(p => ({ ...p, modalidad: e.target.value as 'detallado' | 'resumido' }))} className={INPUT}>
                    <option value="detallado">Detallada</option><option value="resumido">Resumida por día</option>
                  </select></div>}
              </>}
              {CENTER_BALANCE_IDS.has(showParams.id) && <>
                {['balance-acumulado', 'balance-mensual-centro'].includes(showParams.id)
                  ? <div className="col-span-2"><label htmlFor="param-l-centro" className="block text-xs font-medium text-gray-600 mb-1">Centro de costo</label>
                      <input id="param-l-centro" data-initial-focus maxLength={7} value={params.centro} onChange={e => setParams(p => ({ ...p, centro: e.target.value }))} className={INPUT} /></div>
                  : <div className="col-span-2"><label htmlFor="param-l-centros" className="block text-xs font-medium text-gray-600 mb-1">Centros a clasificar (separados por coma)</label>
                      <input id="param-l-centros" data-initial-focus value={params.centrosSeleccionados} onChange={e => setParams(p => ({ ...p, centrosSeleccionados: e.target.value }))} className={INPUT} /></div>}
                <div><label htmlFor="param-l-mes" className="block text-xs font-medium text-gray-600 mb-1">Mes de corte</label>
                  <select id="param-l-mes" value={params.mesHasta} onChange={e => setParams(p => ({ ...p, mesHasta: e.target.value, mesDesde: e.target.value }))} className={INPUT}>
                    {MESES_BALANCE.map((mes, index) => <option key={mes} value={mes}>{String(index + 1).padStart(2, '0')} — {mes}</option>)}
                  </select></div>
                <div><label htmlFor="param-l-nivel" className="block text-xs font-medium text-gray-600 mb-1">Nivel máximo</label>
                  <select id="param-l-nivel" value={params.nivel} onChange={e => setParams(p => ({ ...p, nivel: e.target.value }))} className={INPUT}>
                    <option value="4">Cuenta</option><option value="6">Subcuenta</option><option value="9">Auxiliar 1</option><option value="12">Auxiliar 2</option>
                  </select></div>
                <div className="col-span-2 space-y-2">
                  <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirResultados} onChange={e => setParams(p => ({ ...p, incluirResultados: e.target.checked }))} />Incluir estado de resultados</label>
                  <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirCeros} onChange={e => setParams(p => ({ ...p, incluirCeros: e.target.checked }))} />Incluir cuentas sin movimiento</label>
                  <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirTerceros} onChange={e => setParams(p => ({ ...p, incluirTerceros: e.target.checked }))} />Incluir terceros</label>
                </div>
              </>}
              {showParams.id === 'mov-cuenta' && <>
                <div><label htmlFor="param-o-fecha-desde" className="block text-xs font-medium text-gray-600 mb-1">Fecha desde</label>
                  <input id="param-o-fecha-desde" data-initial-focus type="date" value={params.fechaDesde} onChange={e => setParams(p => ({ ...p, fechaDesde: e.target.value }))} className={INPUT} /></div>
                <div><label htmlFor="param-o-fecha-hasta" className="block text-xs font-medium text-gray-600 mb-1">Fecha hasta</label>
                  <input id="param-o-fecha-hasta" type="date" value={params.fechaHasta} onChange={e => setParams(p => ({ ...p, fechaHasta: e.target.value }))} className={INPUT} /></div>
                <div><label htmlFor="param-o-cuenta-desde" className="block text-xs font-medium text-gray-600 mb-1">Cuenta desde</label>
                  <input id="param-o-cuenta-desde" maxLength={12} value={params.cuentaDesde} onChange={e => setParams(p => ({ ...p, cuentaDesde: e.target.value }))} className={INPUT} /></div>
                <div><label htmlFor="param-o-cuenta-hasta" className="block text-xs font-medium text-gray-600 mb-1">Cuenta hasta</label>
                  <input id="param-o-cuenta-hasta" maxLength={12} value={params.cuentaHasta} onChange={e => setParams(p => ({ ...p, cuentaHasta: e.target.value }))} className={INPUT} /></div>
              </>}
              {showParams.id === 'comp-cta-tercero' && <>
                <div className="col-span-2"><label htmlFor="param-p-mes" className="block text-xs font-medium text-gray-600 mb-1">Mes del informe</label>
                  <select id="param-p-mes" data-initial-focus value={params.mesHasta} onChange={e => setParams(p => ({ ...p, mesHasta: e.target.value, mesDesde: e.target.value }))} className={INPUT}>
                    {MESES_BALANCE.map((mes, index) => <option key={mes} value={mes}>{String(index + 1).padStart(2, '0')} — {mes}</option>)}
                  </select></div>
                <div><label htmlFor="param-p-cuenta-desde" className="block text-xs font-medium text-gray-600 mb-1">Cuenta desde</label>
                  <input id="param-p-cuenta-desde" maxLength={12} value={params.cuentaDesde} onChange={e => setParams(p => ({ ...p, cuentaDesde: e.target.value }))} className={INPUT} /></div>
                <div><label htmlFor="param-p-cuenta-hasta" className="block text-xs font-medium text-gray-600 mb-1">Cuenta hasta</label>
                  <input id="param-p-cuenta-hasta" maxLength={12} value={params.cuentaHasta} onChange={e => setParams(p => ({ ...p, cuentaHasta: e.target.value }))} className={INPUT} /></div>
              </>}
              {showParams.id === 'resumen-tipo-contribuyente' && <>
                <div className="col-span-2"><label htmlFor="param-q-tipo" className="block text-xs font-medium text-gray-600 mb-1">Tipo de contribuyente</label>
                  <input id="param-q-tipo" data-initial-focus maxLength={2} value={params.tipoContribuyente} onChange={e => setParams(p => ({ ...p, tipoContribuyente: e.target.value }))} className={INPUT} /></div>
                <div><label htmlFor="param-q-cuenta-uno" className="block text-xs font-medium text-gray-600 mb-1">Primera cuenta a reportar</label>
                  <input id="param-q-cuenta-uno" maxLength={12} value={params.cuentaDesde} onChange={e => setParams(p => ({ ...p, cuentaDesde: e.target.value }))} className={INPUT} /></div>
                <div><label htmlFor="param-q-cuenta-dos" className="block text-xs font-medium text-gray-600 mb-1">Segunda cuenta a reportar</label>
                  <input id="param-q-cuenta-dos" maxLength={12} value={params.cuentaHasta} onChange={e => setParams(p => ({ ...p, cuentaHasta: e.target.value }))} className={INPUT} /></div>
              </>}
              {showParams.id === 'flujo-comparativo' && <div className="col-span-2">
                <label htmlFor="param-m-compania" className="block text-xs font-medium text-gray-600 mb-1">Compañía comparativa (ejercicio anterior)</label>
                <input id="param-m-compania" data-initial-focus maxLength={3} value={params.companiaAnterior} onChange={e => setParams(p => ({ ...p, companiaAnterior: e.target.value }))} className={INPUT} />
              </div>}
              {showParams.id !== 'flujo-comparativo' && showParams.id !== 'comp-cta-tercero' && showParams.id !== 'mov-cuenta' && !CENTER_BALANCE_IDS.has(showParams.id) && !CENTER_JOURNAL_IDS.has(showParams.id) && !THIRD_DIRECTORY_IDS.has(showParams.id) && !CENTER_SINGLE_MONTH_IDS.has(showParams.id) && !ANNUAL_ANALYSIS_IDS.has(showParams.id) && showParams.id !== 'balance-prueba-anual' && showParams.id !== 'centro-detallado' && showParams.id !== 'doc-formato' && showParams.id !== 'listado-cuentas' && showParams.id !== 'aux-gral' && showParams.id !== 'iva-soportes' && showParams.id !== 'mov-comprobante' && showParams.id !== 'mov-tipo-doc' && showParams.id !== 'bal-gral-resultados' && showParams.id !== 'inventario-bal' && showParams.id !== 'mayor-bal' && showParams.id !== 'diario-cta' && showParams.id !== 'caja-diario-comp' && showParams.id !== 'caja-diario-cta' && showParams.id !== 'saldos-cuenta' && showParams.id !== 'bal-comparativo-mensual' && <div>
                <label htmlFor="param-mes-desde" className="block text-xs font-medium text-gray-600 mb-1">Mes desde</label>
                <select id="param-mes-desde" data-initial-focus value={params.mesDesde} onChange={e => setParams(p => ({ ...p, mesDesde: e.target.value }))} className={INPUT}>
                  {(BALANCE_IDS.has(showParams.id) || showParams.id === 'tercero-especifico' ? MESES_BALANCE : showParams.id === 'aux-doc-afectado' || THIRD_ORIGINAL_IDS.has(showParams.id) || showParams.id === 'centro-consulta' ? MESES_LIBRO : MESES).map(m => <option key={m}>{m}</option>)}
                </select>
              </div>}
              {showParams.id !== 'flujo-comparativo' && showParams.id !== 'comp-cta-tercero' && showParams.id !== 'mov-cuenta' && !CENTER_BALANCE_IDS.has(showParams.id) && !CENTER_JOURNAL_IDS.has(showParams.id) && !THIRD_DIRECTORY_IDS.has(showParams.id) && !CENTER_SINGLE_MONTH_IDS.has(showParams.id) && !ANNUAL_ANALYSIS_IDS.has(showParams.id) && showParams.id !== 'balance-prueba-anual' && showParams.id !== 'centro-detallado' && showParams.id !== 'doc-formato' && showParams.id !== 'listado-cuentas' && showParams.id !== 'aux-gral' && showParams.id !== 'iva-soportes' && showParams.id !== 'mov-comprobante' && showParams.id !== 'mov-tipo-doc' && showParams.id !== 'bal-gral-resultados' && showParams.id !== 'inventario-bal' && showParams.id !== 'mayor-bal' && showParams.id !== 'diario-cta' && showParams.id !== 'caja-diario-comp' && showParams.id !== 'caja-diario-cta' && showParams.id !== 'saldos-cuenta' && showParams.id !== 'bal-comparativo-mensual' && <div>
                <label htmlFor="param-mes-hasta" className="block text-xs font-medium text-gray-600 mb-1">Mes hasta</label>
                <select id="param-mes-hasta" value={params.mesHasta} onChange={e => setParams(p => ({ ...p, mesHasta: e.target.value }))} className={INPUT}>
                  {(BALANCE_IDS.has(showParams.id) || showParams.id === 'tercero-especifico' ? MESES_BALANCE : showParams.id === 'aux-doc-afectado' || THIRD_ORIGINAL_IDS.has(showParams.id) || showParams.id === 'centro-consulta' ? MESES_LIBRO : MESES).map(m => <option key={m}>{m}</option>)}
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
              {showParams.id === 'inventario-bal' && <>
                <div className="col-span-2">
                  <label htmlFor="param-mes-inventario" className="block text-xs font-medium text-gray-600 mb-1">Mes del informe</label>
                  <select id="param-mes-inventario" data-initial-focus value={params.mesHasta} onChange={e => setParams(p => ({ ...p, mesHasta: e.target.value }))} className={INPUT}>
                    {MESES_BALANCE.map((mes, index) => <option key={mes} value={mes}>{String(index + 1).padStart(2, '0')} — {mes}</option>)}
                  </select>
                </div>
                <label className="col-span-2 flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirResultados} onChange={e => setParams(p => ({ ...p, incluirResultados: e.target.checked }))} />Incluir estado de resultados</label>
                <label className="col-span-2 flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirCeros} onChange={e => setParams(p => ({ ...p, incluirCeros: e.target.checked }))} />Incluir cuentas sin saldo ni movimiento</label>
              </>}
              {showParams.id === 'mayor-bal' && <>
                <div><label htmlFor="param-mayor-desde" className="block text-xs font-medium text-gray-600 mb-1">Mes desde</label>
                  <select id="param-mayor-desde" data-initial-focus value={params.mesDesde} onChange={e => setParams(p => ({ ...p, mesDesde: e.target.value }))} className={INPUT}>
                    {MESES_BALANCE.map((mes, index) => <option key={mes} value={mes}>{String(index + 1).padStart(2, '0')} — {mes}</option>)}
                  </select></div>
                <div><label htmlFor="param-mayor-hasta" className="block text-xs font-medium text-gray-600 mb-1">Mes hasta</label>
                  <select id="param-mayor-hasta" value={params.mesHasta} onChange={e => setParams(p => ({ ...p, mesHasta: e.target.value }))} className={INPUT}>
                    {MESES_BALANCE.map((mes, index) => <option key={mes} value={mes}>{String(index + 1).padStart(2, '0')} — {mes}</option>)}
                  </select></div>
                <div><label htmlFor="param-mayor-nivel" className="block text-xs font-medium text-gray-600 mb-1">Nivel</label>
                  <select id="param-mayor-nivel" value={params.nivel} onChange={e => setParams(p => ({ ...p, nivel: e.target.value }))} className={INPUT}>
                    <option value="1">Clase</option><option value="2">Grupo</option><option value="4">Cuenta</option>
                    <option value="6">Subcuenta</option><option value="9">Auxiliar 1</option><option value="12">Auxiliar 2</option>
                  </select></div>
                <label className="col-span-2 flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirCeros} onChange={e => setParams(p => ({ ...p, incluirCeros: e.target.checked }))} />Incluir cuentas sin saldo ni movimiento</label>
              </>}
              {showParams.id === 'diario-cta' && <div className="col-span-2">
                <label htmlFor="param-mes-diario-cuenta" className="block text-xs font-medium text-gray-600 mb-1">Mes del diario</label>
                <select id="param-mes-diario-cuenta" data-initial-focus value={params.mesHasta} onChange={e => setParams(p => ({ ...p, mesHasta: e.target.value }))} className={INPUT}>
                  {MESES_BALANCE.map((mes, index) => <option key={mes} value={mes}>{String(index + 1).padStart(2, '0')} — {mes}</option>)}
                </select>
              </div>}
              {showParams.id === 'caja-diario-comp' && <>
                <div className="col-span-2"><label htmlFor="param-mes-caja-comprobante" className="block text-xs font-medium text-gray-600 mb-1">Mes del libro</label>
                  <select id="param-mes-caja-comprobante" data-initial-focus value={params.mesHasta} onChange={e => setParams(p => ({ ...p, mesHasta: e.target.value }))} className={INPUT}>
                    {MESES_BALANCE.map((mes, index) => <option key={mes} value={mes}>{String(index + 1).padStart(2, '0')} — {mes}</option>)}
                  </select></div>
                <div><label htmlFor="param-caja-comprobante-desde" className="block text-xs font-medium text-gray-600 mb-1">Comprobante desde</label>
                  <input id="param-caja-comprobante-desde" maxLength={2} value={params.comprobante} onChange={e => setParams(p => ({ ...p, comprobante: e.target.value }))} className={INPUT} /></div>
                <div><label htmlFor="param-caja-comprobante-hasta" className="block text-xs font-medium text-gray-600 mb-1">Comprobante hasta</label>
                  <input id="param-caja-comprobante-hasta" maxLength={2} value={params.comprobanteHasta} onChange={e => setParams(p => ({ ...p, comprobanteHasta: e.target.value }))} className={INPUT} /></div>
                <div className="col-span-2"><label htmlFor="param-caja-nivel" className="block text-xs font-medium text-gray-600 mb-1">Nivel de cuentas</label>
                  <select id="param-caja-nivel" value={params.nivel} onChange={e => setParams(p => ({ ...p, nivel: e.target.value }))} className={INPUT}>
                    <option value="1">1 — Grupo</option><option value="2">2 — Cuenta</option>
                    <option value="3">3 — Subcuenta</option><option value="4">4 — Auxiliar 1</option>
                  </select></div>
              </>}
              {showParams.id === 'caja-diario-cta' && <>
                <div className="col-span-2"><label htmlFor="param-mes-caja-cuenta" className="block text-xs font-medium text-gray-600 mb-1">Mes del libro</label>
                  <select id="param-mes-caja-cuenta" data-initial-focus value={params.mesHasta} onChange={e => setParams(p => ({ ...p, mesHasta: e.target.value }))} className={INPUT}>
                    {MESES_BALANCE.map((mes, index) => <option key={mes} value={mes}>{String(index + 1).padStart(2, '0')} — {mes}</option>)}
                  </select></div>
                <div><label htmlFor="param-caja-cuenta-desde" className="block text-xs font-medium text-gray-600 mb-1">Cuenta desde</label>
                  <input id="param-caja-cuenta-desde" maxLength={12} value={params.cuentaDesde} onChange={e => setParams(p => ({ ...p, cuentaDesde: e.target.value }))} className={INPUT} /></div>
                <div><label htmlFor="param-caja-cuenta-hasta" className="block text-xs font-medium text-gray-600 mb-1">Cuenta hasta</label>
                  <input id="param-caja-cuenta-hasta" maxLength={12} value={params.cuentaHasta} onChange={e => setParams(p => ({ ...p, cuentaHasta: e.target.value }))} className={INPUT} /></div>
                <div className="col-span-2"><label htmlFor="param-caja-cuenta-nivel" className="block text-xs font-medium text-gray-600 mb-1">Nivel de cuentas</label>
                  <select id="param-caja-cuenta-nivel" value={params.nivel} onChange={e => setParams(p => ({ ...p, nivel: e.target.value }))} className={INPUT}>
                    <option value="1">1 — Grupo</option><option value="2">2 — Cuenta</option>
                    <option value="3">3 — Subcuenta</option><option value="4">4 — Auxiliar 1</option>
                  </select></div>
              </>}
              {showParams.id === 'saldos-cuenta' && <>
                <div className="col-span-2"><label htmlFor="param-mes-saldos-cuenta" className="block text-xs font-medium text-gray-600 mb-1">Mes del informe</label>
                  <select id="param-mes-saldos-cuenta" data-initial-focus value={params.mesHasta} onChange={e => setParams(p => ({ ...p, mesHasta: e.target.value }))} className={INPUT}>
                    {MESES_BALANCE.map((mes, index) => <option key={mes} value={mes}>{String(index + 1).padStart(2, '0')} — {mes}</option>)}
                  </select></div>
                <div><label htmlFor="param-saldos-cuenta-desde" className="block text-xs font-medium text-gray-600 mb-1">Cuenta desde</label>
                  <input id="param-saldos-cuenta-desde" maxLength={12} value={params.cuentaDesde} onChange={e => setParams(p => ({ ...p, cuentaDesde: e.target.value }))} className={INPUT} /></div>
                <div><label htmlFor="param-saldos-cuenta-hasta" className="block text-xs font-medium text-gray-600 mb-1">Cuenta hasta</label>
                  <input id="param-saldos-cuenta-hasta" maxLength={12} value={params.cuentaHasta} onChange={e => setParams(p => ({ ...p, cuentaHasta: e.target.value }))} className={INPUT} /></div>
                <div><label htmlFor="param-saldos-cuenta-nivel" className="block text-xs font-medium text-gray-600 mb-1">Nivel máximo</label>
                  <select id="param-saldos-cuenta-nivel" value={params.nivel} onChange={e => setParams(p => ({ ...p, nivel: e.target.value }))} className={INPUT}>
                    <option value="4">Cuenta</option><option value="6">Subcuenta</option>
                    <option value="9">Auxiliar 1</option><option value="12">Auxiliar 2</option>
                  </select></div>
                <label className="col-span-2 flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirCeros} onChange={e => setParams(p => ({ ...p, incluirCeros: e.target.checked }))} />Incluir cuentas sin saldo ni movimiento</label>
                <label className="col-span-2 flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirTerceros} onChange={e => setParams(p => ({ ...p, incluirTerceros: e.target.checked }))} />Incluir terceros</label>
              </>}
              {showParams.id === 'bal-comparativo-mensual' && <>
                <div><label htmlFor="param-comparativo-desde" className="block text-xs font-medium text-gray-600 mb-1">Primer mes</label>
                  <select id="param-comparativo-desde" data-initial-focus value={params.mesDesde} onChange={e => setParams(p => ({ ...p, mesDesde: e.target.value }))} className={INPUT}>
                    {MESES_BALANCE.map((mes, index) => <option key={mes} value={mes}>{String(index + 1).padStart(2, '0')} — {mes}</option>)}
                  </select></div>
                <div><label htmlFor="param-comparativo-hasta" className="block text-xs font-medium text-gray-600 mb-1">Segundo mes</label>
                  <select id="param-comparativo-hasta" value={params.mesHasta} onChange={e => setParams(p => ({ ...p, mesHasta: e.target.value }))} className={INPUT}>
                    {MESES_BALANCE.map((mes, index) => <option key={mes} value={mes}>{String(index + 1).padStart(2, '0')} — {mes}</option>)}
                  </select></div>
                <div><label htmlFor="param-comparativo-nivel" className="block text-xs font-medium text-gray-600 mb-1">Nivel máximo</label>
                  <select id="param-comparativo-nivel" value={params.nivel} onChange={e => setParams(p => ({ ...p, nivel: e.target.value }))} className={INPUT}>
                    <option value="4">Cuenta</option><option value="6">Subcuenta</option><option value="9">Auxiliar 1</option><option value="12">Auxiliar 2</option>
                  </select></div>
                <div><label htmlFor="param-comparativo-dato" className="block text-xs font-medium text-gray-600 mb-1">Comparar</label>
                  <select id="param-comparativo-dato" value={params.modoComparativo} onChange={e => setParams(p => ({ ...p, modoComparativo: e.target.value as 'saldo' | 'movimiento' }))} className={INPUT}>
                    <option value="saldo">Saldo de cada mes</option><option value="movimiento">Movimiento de cada mes</option>
                  </select></div>
                <div><label htmlFor="param-comparativo-operacion" className="block text-xs font-medium text-gray-600 mb-1">Tercera columna</label>
                  <select id="param-comparativo-operacion" value={params.operacionComparativa} onChange={e => setParams(p => ({ ...p, operacionComparativa: e.target.value as 'diferencia' | 'sumatoria' }))} className={INPUT}>
                    <option value="diferencia">Diferencia: primero − segundo</option><option value="sumatoria">Sumatoria</option>
                  </select></div>
                <div className="col-span-2 space-y-2">
                  <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirResultados} onChange={e => setParams(p => ({ ...p, incluirResultados: e.target.checked }))} />Incluir estado de resultados</label>
                  <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirCeros} onChange={e => setParams(p => ({ ...p, incluirCeros: e.target.checked }))} />Incluir cuentas sin saldo ni movimiento</label>
                  <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirTerceros} onChange={e => setParams(p => ({ ...p, incluirTerceros: e.target.checked }))} />Incluir terceros</label>
                </div>
              </>}
              {ANNUAL_ANALYSIS_IDS.has(showParams.id) && <div className="col-span-2">
                <label htmlFor="param-analisis-anual-nivel" className="block text-xs font-medium text-gray-600 mb-1">Nivel máximo</label>
                <select id="param-analisis-anual-nivel" data-initial-focus value={params.nivel} onChange={e => setParams(p => ({ ...p, nivel: e.target.value }))} className={INPUT}>
                  <option value="4">Cuenta</option><option value="6">Subcuenta</option>
                  <option value="9">Auxiliar 1</option><option value="12">Auxiliar 2</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">El análisis incluye enero a diciembre del ejercicio.</p>
              </div>}
              {showParams.id === 'balance-prueba-anual' && <>
                <div className="col-span-2"><label htmlFor="param-balance-anual-nivel" className="block text-xs font-medium text-gray-600 mb-1">Nivel máximo</label>
                  <select id="param-balance-anual-nivel" data-initial-focus value={params.nivel} onChange={e => setParams(p => ({ ...p, nivel: e.target.value }))} className={INPUT}>
                    <option value="4">Cuenta</option><option value="6">Subcuenta</option>
                    <option value="9">Auxiliar 1</option><option value="12">Auxiliar 2</option>
                  </select></div>
                <div className="col-span-2 space-y-2">
                  <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirResultados} onChange={e => setParams(p => ({ ...p, incluirResultados: e.target.checked }))} />Incluir estado de resultados</label>
                  <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirCeros} onChange={e => setParams(p => ({ ...p, incluirCeros: e.target.checked }))} />Incluir cuentas sin saldo ni movimiento</label>
                  <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirTerceros} onChange={e => setParams(p => ({ ...p, incluirTerceros: e.target.checked }))} />Incluir terceros</label>
                  <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirCentros} onChange={e => setParams(p => ({ ...p, incluirCentros: e.target.checked }))} />Incluir centros de costo</label>
                </div>
              </>}
              {CENTER_SINGLE_MONTH_IDS.has(showParams.id) && <div className="col-span-2">
                <label htmlFor="param-mes-centro" className="block text-xs font-medium text-gray-600 mb-1">Mes a reportar</label>
                <select id="param-mes-centro" data-initial-focus value={params.mesHasta} onChange={e => setParams(p => ({ ...p, mesHasta: e.target.value }))} className={INPUT}>
                  {(showParams.id === 'centro-por-nivel' ? MESES_NIVEL_CENTROS : CENTER_ZERO_MONTH_IDS.has(showParams.id) ? MESES_LIBRO : MESES).map((mes, index) => <option key={mes} value={mes}>{String(index + (showParams.id === 'centro-por-nivel' || CENTER_ZERO_MONTH_IDS.has(showParams.id) ? 0 : 1)).padStart(2, '0')} — {mes}</option>)}
                </select>
              </div>}
              {showParams.id === 'centro-detallado' && <>
                <div><label htmlFor="param-fecha-centro-desde" className="block text-xs font-medium text-gray-600 mb-1">Fecha desde</label>
                  <input id="param-fecha-centro-desde" data-initial-focus type="date" value={params.fechaDesde} onChange={e => setParams(p => ({ ...p, fechaDesde: e.target.value }))} className={INPUT} /></div>
                <div><label htmlFor="param-fecha-centro-hasta" className="block text-xs font-medium text-gray-600 mb-1">Fecha hasta</label>
                  <input id="param-fecha-centro-hasta" type="date" value={params.fechaHasta} onChange={e => setParams(p => ({ ...p, fechaHasta: e.target.value }))} className={INPUT} /></div>
              </>}
              {CENTER_ORIGINAL_IDS.has(showParams.id) && <>
                {['centro-consulta', 'centro-cuenta-centro', 'centro-tercero-centro', 'centro-detallado'].includes(showParams.id) && <>
                  <div><label htmlFor="param-centro-desde" className="block text-xs font-medium text-gray-600 mb-1">Centro desde</label>
                    <input id="param-centro-desde" maxLength={7} value={params.centroDesde} onChange={e => setParams(p => ({ ...p, centroDesde: e.target.value }))} className={INPUT} /></div>
                  <div><label htmlFor="param-centro-hasta" className="block text-xs font-medium text-gray-600 mb-1">Centro hasta</label>
                    <input id="param-centro-hasta" maxLength={7} value={params.centroHasta} onChange={e => setParams(p => ({ ...p, centroHasta: e.target.value }))} className={INPUT} /></div>
                </>}
                {['centro-consulta', 'centro-cuenta-centro', 'centro-por-cuenta', 'centro-tercero-centro'].includes(showParams.id) && <>
                  <div><label htmlFor="param-centro-nit-desde" className="block text-xs font-medium text-gray-600 mb-1">Tercero desde</label>
                    <input id="param-centro-nit-desde" maxLength={15} value={params.nitDesde} onChange={e => setParams(p => ({ ...p, nitDesde: e.target.value }))} className={INPUT} /></div>
                  <div><label htmlFor="param-centro-nit-hasta" className="block text-xs font-medium text-gray-600 mb-1">Tercero hasta</label>
                    <input id="param-centro-nit-hasta" maxLength={15} value={params.nitHasta} onChange={e => setParams(p => ({ ...p, nitHasta: e.target.value }))} className={INPUT} /></div>
                </>}
                {showParams.id === 'centro-consulta' && <div className="col-span-2"><label htmlFor="param-orden-centros" className="block text-xs font-medium text-gray-600 mb-1">Ordenar por</label>
                  <select id="param-orden-centros" value={params.ordenCentros} onChange={e => setParams(p => ({ ...p, ordenCentros: e.target.value as 'cuenta' | 'centro' }))} className={INPUT}>
                    <option value="cuenta">Cuenta y centro</option><option value="centro">Centro y cuenta</option>
                  </select></div>}
                {showParams.id === 'centro-por-cuenta' && <div className="col-span-2"><label htmlFor="param-cuentas-seleccionadas" className="block text-xs font-medium text-gray-600 mb-1">Cuentas seleccionadas</label>
                  <input id="param-cuentas-seleccionadas" required value={params.cuentasSeleccionadas} onChange={e => setParams(p => ({ ...p, cuentasSeleccionadas: e.target.value }))} placeholder="Separe varios códigos con coma" className={INPUT} /></div>}
                {['centro-por-cuenta', 'centro-columnas-5152'].includes(showParams.id) && <div className="col-span-2"><label htmlFor="param-centros-seleccionados" className="block text-xs font-medium text-gray-600 mb-1">Centros seleccionados</label>
                  <input id="param-centros-seleccionados" value={params.centrosSeleccionados} onChange={e => setParams(p => ({ ...p, centrosSeleccionados: e.target.value }))} placeholder="Deje vacío para todos, o separe códigos con coma" className={INPUT} /></div>}
                {showParams.id === 'centro-por-nivel' && <div className="col-span-2"><label htmlFor="param-prefijo-cuenta" className="block text-xs font-medium text-gray-600 mb-1">Cuenta o nivel</label>
                  <input id="param-prefijo-cuenta" required maxLength={12} value={params.prefijoCuenta} onChange={e => setParams(p => ({ ...p, prefijoCuenta: e.target.value }))} className={INPUT} /></div>}
                {['centro-cuenta-centro', 'centro-por-cuenta', 'centro-tercero-centro'].includes(showParams.id) && <div className="col-span-2 space-y-2">
                  {showParams.id !== 'centro-tercero-centro' && <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirTerceros} onChange={e => setParams(p => ({ ...p, incluirTerceros: e.target.checked }))} />Detalle por tercero</label>}
                  <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={params.incluirSaldoAnterior} onChange={e => setParams(p => ({ ...p, incluirSaldoAnterior: e.target.checked }))} />Mostrar saldo anterior</label>
                </div>}
              </>}
              {(showParams.id === 'aux-gral' || showParams.id === 'ret-soportes' || showParams.id === 'iva-soportes') && <>
                <div>
                  <label htmlFor="param-fecha-desde" className="block text-xs font-medium text-gray-600 mb-1">Fecha desde</label>
                  <input id="param-fecha-desde" data-initial-focus type="date" required value={params.fechaDesde} onChange={e => setParams(p => ({ ...p, fechaDesde: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label htmlFor="param-fecha-hasta" className="block text-xs font-medium text-gray-600 mb-1">Fecha hasta</label>
                  <input id="param-fecha-hasta" type="date" required value={params.fechaHasta} onChange={e => setParams(p => ({ ...p, fechaHasta: e.target.value }))} className={INPUT} />
                </div>
                {showParams.id !== 'iva-soportes' && <div>
                  <label htmlFor="param-modalidad" className="block text-xs font-medium text-gray-600 mb-1">Detalle</label>
                  <select id="param-modalidad" value={params.modalidad} onChange={e => setParams(p => ({ ...p, modalidad: e.target.value as 'detallado' | 'resumido' }))} className={INPUT}>
                    <option value="detallado">Detallado</option><option value="resumido">Resumido</option>
                  </select>
                </div>}
              </>}
              {showParams.id === 'aux-doc-afectado' && <div className="col-span-2">
                <label htmlFor="param-documento-afectado" className="block text-xs font-medium text-gray-600 mb-1">Documento afectado</label>
                <input id="param-documento-afectado" required maxLength={12} value={params.documentoAfectado} onChange={e => setParams(p => ({ ...p, documentoAfectado: e.target.value }))} className={INPUT} />
              </div>}
              {THIRD_ORIGINAL_IDS.has(showParams.id) && <>
                <div>
                  <label htmlFor="param-nit-desde" className="block text-xs font-medium text-gray-600 mb-1">Tercero desde</label>
                  <input id="param-nit-desde" maxLength={15} value={params.nitDesde} onChange={e => setParams(p => ({ ...p, nitDesde: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label htmlFor="param-nit-hasta" className="block text-xs font-medium text-gray-600 mb-1">Tercero hasta</label>
                  <input id="param-nit-hasta" maxLength={15} value={params.nitHasta} onChange={e => setParams(p => ({ ...p, nitHasta: e.target.value }))} className={INPUT} />
                </div>
                <div>
                  <label htmlFor="param-orden-terceros" className="block text-xs font-medium text-gray-600 mb-1">Ordenar por</label>
                  <select id="param-orden-terceros" value={params.ordenTerceros} onChange={e => setParams(p => ({ ...p, ordenTerceros: e.target.value as 'cuenta' | 'tercero' }))} className={INPUT}>
                    <option value="cuenta">Cuenta y tercero</option><option value="tercero">Tercero y cuenta</option>
                  </select>
                </div>
                {showParams.id === 'tercero-cuenta-tercero' && <div>
                  <label htmlFor="param-modalidad-terceros" className="block text-xs font-medium text-gray-600 mb-1">Presentación</label>
                  <select id="param-modalidad-terceros" value={params.modalidad} onChange={e => setParams(p => ({ ...p, modalidad: e.target.value as 'detallado' | 'resumido' }))} className={INPUT}>
                    <option value="detallado">Detallado</option><option value="resumido">Resumido</option>
                  </select>
                </div>}
                {showParams.id === 'tercero-cuenta-tercero' && <div>
                  <label htmlFor="param-orden-movimiento" className="block text-xs font-medium text-gray-600 mb-1">Orden del movimiento</label>
                  <select id="param-orden-movimiento" value={params.ordenMovimiento} onChange={e => setParams(p => ({ ...p, ordenMovimiento: e.target.value as 'documento' | 'fecha' }))} className={INPUT}>
                    <option value="documento">Documento y fecha</option><option value="fecha">Fecha y documento</option>
                  </select>
                </div>}
              </>}
              {['iva-relacion', 'iva-totales-cuenta', 'iva-soportes'].includes(showParams.id) && <>
                <div><label htmlFor="param-iva-nit-desde" className="block text-xs font-medium text-gray-600 mb-1">Tercero desde</label>
                  <input id="param-iva-nit-desde" maxLength={15} value={params.nitDesde} onChange={e => setParams(p => ({ ...p, nitDesde: e.target.value }))} className={INPUT} /></div>
                <div><label htmlFor="param-iva-nit-hasta" className="block text-xs font-medium text-gray-600 mb-1">Tercero hasta</label>
                  <input id="param-iva-nit-hasta" maxLength={15} value={params.nitHasta} onChange={e => setParams(p => ({ ...p, nitHasta: e.target.value }))} className={INPUT} /></div>
                {showParams.id === 'iva-relacion' && <div><label htmlFor="param-iva-orden" className="block text-xs font-medium text-gray-600 mb-1">Ordenar por</label>
                  <select id="param-iva-orden" value={params.ordenTerceros} onChange={e => setParams(p => ({ ...p, ordenTerceros: e.target.value as 'cuenta' | 'tercero' }))} className={INPUT}>
                    <option value="cuenta">Cuenta y tercero</option><option value="tercero">Tercero y cuenta</option>
                  </select></div>}
                {showParams.id === 'iva-relacion' && <div><label htmlFor="param-iva-presentacion" className="block text-xs font-medium text-gray-600 mb-1">Presentación</label>
                  <select id="param-iva-presentacion" value={params.modalidad} onChange={e => setParams(p => ({ ...p, modalidad: e.target.value as 'detallado' | 'resumido' }))} className={INPUT}>
                    <option value="resumido">Resumido</option><option value="detallado">Detallado por mes</option>
                  </select></div>}
              </>}
              {showParams.id === 'tercero-especifico' && <>
                <div className="col-span-2"><label htmlFor="param-tercero-cuentas" className="block text-xs font-medium text-gray-600 mb-1">Cuentas seleccionadas</label>
                  <input id="param-tercero-cuentas" required value={params.cuentasSeleccionadas} onChange={e => setParams(p => ({ ...p, cuentasSeleccionadas: e.target.value }))} placeholder="Códigos de cuentas separados por coma" className={INPUT} />
                  <p className="mt-1 text-xs text-gray-500">Solo cuentas de movimiento que manejan terceros.</p></div>
                <div className="col-span-2"><label htmlFor="param-tercero-presentacion" className="block text-xs font-medium text-gray-600 mb-1">Presentación</label>
                  <select id="param-tercero-presentacion" value={params.modalidad} onChange={e => setParams(p => ({ ...p, modalidad: e.target.value as 'detallado' | 'resumido' }))} className={INPUT}>
                    <option value="resumido">Resumen por cuenta</option><option value="detallado">Partidas detalladas</option>
                  </select></div>
              </>}
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
              {!BALANCE_IDS.has(showParams.id) && !ANNUAL_ANALYSIS_IDS.has(showParams.id) && showParams.id !== 'balance-prueba-anual' && showParams.id !== 'bal-gral-resultados' && showParams.id !== 'inventario-bal' && showParams.id !== 'mayor-bal' && showParams.id !== 'caja-diario-comp' && showParams.id !== 'caja-diario-cta' && showParams.id !== 'saldos-cuenta' && showParams.id !== 'bal-comparativo-mensual' && (
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
                {generando ? (showParams.id === 'iva-acumulacion' ? 'Acumulando IVA…' : showParams.id === 'ret-acumulacion' ? 'Acumulando retenciones…' : 'Consultando Advantage…')
                  : anioOperacion === null && !errorPeriodo ? 'Consultando período…'
                  : ['iva-acumulacion', 'ret-acumulacion'].includes(showParams.id) ? 'Procesar acumulación' : 'Generar informe'}
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
