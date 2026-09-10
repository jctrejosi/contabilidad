import { useEffect, useId, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { NavPage } from '../components/Shell';
import { CUENTAS, TERCEROS, MOVIMIENTOS_FEB, SALDOS_BALANCE, CENTROS, EMPRESA, PERIODO, fmtCOP } from '../data/mock';
import {
  consultarBalanceComprobacion,
  exportarBalanceComprobacion,
  type BalanceComprobacion,
  type FiltrosBalanceComprobacion,
} from '../api/balanceComprobacion';
import { consultarPeriodoOperacion } from '../api/periodoOperacion';

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
      { id: 'tercero-acumulacion', nombre: 'Acumulación', desc: 'Saldo acumulado y uso de cupo por tercero' },
      { id: 'tercero-cuenta-tercero', nombre: 'Cuenta-tercero', desc: 'Movimiento por cuenta y tercero' },
      { id: 'tercero-especifico', nombre: 'Tercero específico', desc: 'Detalle de movimiento de un tercero puntual' },
      { id: 'tercero-cumpleanos', nombre: 'Cumpleaños', desc: 'Fechas de cumpleaños de los terceros' },
      { id: 'tercero-etiquetas', nombre: 'Etiquetas', desc: 'Terceros agrupados por etiquetas de negocio' },
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
}

const MESES_ABR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const BALANCE_IDS = new Set(['balance-comp', 'balance-comp-lib']);

// Balance de comprobación cuadrada (débitos = créditos = 85.000.000).
const BALANCE_COMP = [
  { cuenta: '110505', nombre: 'Caja general', debito: 5300000, credito: 3000000 },
  { cuenta: '111005', nombre: 'Bancos moneda nacional', debito: 20500000, credito: 22400000 },
  { cuenta: '130505', nombre: 'Clientes nacionales', debito: 24500000, credito: 14200000 },
  { cuenta: '236540', nombre: 'Retenciones y aportes de nómina', debito: 200000, credito: 2300000 },
  { cuenta: '240805', nombre: 'IVA por pagar', debito: 300000, credito: 2850000 },
  { cuenta: '250505', nombre: 'Salarios por pagar', debito: 10200000, credito: 24000000 },
  { cuenta: '510506', nombre: 'Sueldos y salarios', debito: 24000000, credito: 0 },
  { cuenta: '413505', nombre: 'Comercio al por mayor y al por menor', debito: 0, credito: 12450000 },
  { cuenta: '423505', nombre: 'Servicio de asesoría y consultoría', debito: 0, credito: 3800000 },
];

const TOTAL_DEB = BALANCE_COMP.reduce((s, r) => s + r.debito, 0);
const TOTAL_CRED = BALANCE_COMP.reduce((s, r) => s + r.credito, 0);

function sumDebCred(meses: { debito: number; credito: number }[], hasta = meses.length): { debito: number; credito: number } {
  let debito = 0;
  let credito = 0;
  for (let i = 0; i < Math.min(hasta, meses.length); i++) {
    debito += meses[i].debito;
    credito += meses[i].credito;
  }
  return { debito, credito };
}

function datosDe(id: string): DatosInforme {
  const MOV = MOVIMIENTOS_FEB;

  switch (id) {
    case 'doc-formato': {
      const map = new Map<string, { fecha: string; tipo: string; nit: string; tercero: string; debito: number; credito: number }>();
      for (const m of MOV) {
        const e = map.get(m.documento) ?? { fecha: m.fecha, tipo: m.tipoDoc, nit: m.nit, tercero: m.tercero, debito: 0, credito: 0 };
        e.debito += m.debito;
        e.credito += m.credito;
        map.set(m.documento, e);
      }
      const filas: Celda[][] = [...map.entries()].map(([doc, d]) => [doc, d.fecha, d.tipo, d.tercero || '—', d.nit || '—', d.debito, d.credito, 'Contabilizado']);
      return {
        columnas: [
          { label: 'Documento' }, { label: 'Fecha' }, { label: 'Tipo doc.' }, { label: 'Tercero' }, { label: 'NIT' },
          { label: 'Débito', money: true }, { label: 'Crédito', money: true }, { label: 'Estado' },
        ],
        filas,
        totales: ['', '', '', '', 'TOTALES', MOV.reduce((s, m) => s + m.debito, 0), MOV.reduce((s, m) => s + m.credito, 0), ''],
      };
    }

    case 'doc-planilla':
      return {
        columnas: [
          { label: 'Planilla' }, { label: 'Documento' }, { label: 'Período' }, { label: 'Líneas' },
          { label: 'Débito', money: true }, { label: 'Crédito', money: true },
        ],
        filas: [
          ['Nómina febrero 2026', 'NOM-2026-02', '2026-02', 12, 12600000, 12600000],
          ['Prestaciones sociales febrero', 'CE-000245', '2026-02', 4, 1400000, 1400000],
          ['Aportes seguridad social', 'CE-000245', '2026-02', 3, 1200000, 1200000],
        ],
        totales: ['', '', '', 19, 15200000, 15200000],
        nota: 'Documentos generados por planilla — el detalle concuerda con el lote NOM2 (12.600.000 = 12.600.000).',
      };

    case 'listado-cuentas': {
      const filas: Celda[][] = CUENTAS.map(c => [
        c.codigo, c.nombre, c.nivel, c.afectable ? 'Sí' : 'No', c.requiereTercero ? 'Sí' : 'No',
        c.requiereCentro ? 'Sí' : 'No', c.requiereBase ? 'Sí' : 'No', c.claseIVA ?? '—', c.claseRetencion ?? '—',
      ]);
      return {
        columnas: [
          { label: 'Código' }, { label: 'Nombre' }, { label: 'Nivel' }, { label: 'Afectable' }, { label: 'Tercero' },
          { label: 'Centro' }, { label: 'Base' }, { label: 'Clase IVA' }, { label: 'Clase retención' },
        ],
        filas,
        nota: `${CUENTAS.length} cuentas del plan — solo las cuentas afectables aceptan movimiento.`,
      };
    }

    case 'balance-comp-lib':
    case 'balance-prueba-anual': {
      const columnas = id === 'balance-comp-lib'
        ? [{ label: 'Cuenta' }, { label: 'Nombre' }, { label: 'Débito acum.', money: true }, { label: 'Crédito acum.', money: true }, { label: 'Saldo', money: true }]
        : [{ label: 'Cuenta' }, { label: 'Nombre' }, { label: 'Débito', money: true }, { label: 'Crédito', money: true }];
      const filas: Celda[][] = BALANCE_COMP.map(r => id === 'balance-comp-lib'
        ? [r.cuenta, r.nombre, r.debito, r.credito, r.debito - r.credito]
        : [r.cuenta, r.nombre, r.debito, r.credito]);
      return {
        columnas,
        filas,
        totales: id === 'balance-comp-lib'
          ? ['', 'TOTALES', TOTAL_DEB, TOTAL_CRED, 0]
          : ['', 'TOTALES', TOTAL_DEB, TOTAL_CRED],
        nota: `Débitos (${fmtCOP(TOTAL_DEB)}) = Créditos (${fmtCOP(TOTAL_CRED)}): cuadrado.`,
      };
    }

    case 'balance-mensual': {
      const filas: Celda[][] = SALDOS_BALANCE.map(s => {
        const { debito: d1, credito: c1 } = sumDebCred(s.meses, 1);
        const { debito: d2, credito: c2 } = sumDebCred(s.meses, 2);
        return [s.cuenta, s.nombre, d1, c1, d2 - d1, c2 - c1, s.saldoInicial + d2 - c2];
      });
      const t = (k: number) => SALDOS_BALANCE.reduce((sum, s) => sum + s.meses[k].debito, 0);
      const c = (k: number) => SALDOS_BALANCE.reduce((sum, s) => sum + s.meses[k].credito, 0);
      return {
        columnas: [
          { label: 'Cuenta' }, { label: 'Nombre' }, { label: 'Déb. ene', money: true }, { label: 'Créd. ene', money: true },
          { label: 'Déb. feb', money: true }, { label: 'Créd. feb', money: true }, { label: 'Saldo', money: true },
        ],
        filas,
        totales: ['', 'TOTALES', t(0), c(0), t(1), c(1), SALDOS_BALANCE.reduce((sum, s) => sum + s.saldoInicial + s.meses[0].debito - s.meses[0].credito + s.meses[1].debito - s.meses[1].credito, 0)],
      };
    }

    case 'acum-corriente':
      return {
        columnas: [
          { label: 'Cuenta' }, { label: 'Nombre' }, { label: 'Corriente', money: true }, { label: 'No corriente', money: true },
        ],
        filas: [
          ['110505', 'Caja general', 7500000, 0],
          ['111005', 'Bancos moneda nacional', 46600000, 0],
          ['130505', 'Clientes nacionales', 32700000, 0],
          ['236540', 'Retenciones y aportes de nómina', -2100000, 0],
          ['240805', 'IVA por pagar', -2550000, 0],
          ['250505', 'Salarios por pagar', -13800000, 0],
          ['150405', 'Construcciones en curso', 0, 35000000],
          ['152405', 'Maquinaria y equipo', 0, 12000000],
        ],
        totales: ['', 'TOTALES', 68350000, 47000000],
        nota: 'Clasificación corriente / no corriente con base en la naturaleza de la cuenta (demostración).',
      };

    case 'aux-gral': {
      const filas: Celda[][] = MOV.map(m => [m.fecha, m.comprobante, m.documento, m.cuenta, m.nombreCuenta, m.nit, m.tercero, m.centro, m.debito, m.credito]);
      return {
        columnas: [
          { label: 'Fecha' }, { label: 'Comprobante' }, { label: 'Documento' }, { label: 'Cuenta' }, { label: 'Nombre cuenta' },
          { label: 'NIT' }, { label: 'Tercero' }, { label: 'Centro' }, { label: 'Débito', money: true }, { label: 'Crédito', money: true },
        ],
        filas,
        totales: ['', '', '', '', '', '', '', 'TOTALES', MOV.reduce((s, m) => s + m.debito, 0), MOV.reduce((s, m) => s + m.credito, 0)],
      };
    }

    case 'aux-doc-afectado': {
      const base = MOV.filter(m => m.docAfectado).map(m => [m.documento, m.docAfectado, m.fecha, m.tercero, m.nit, m.debito, m.credito]);
      const filas: Celda[][] = [
        ...base,
        ['RE-2026-011', 'FV-2025-130', '2026-02-18', 'Comercial XYZ Distribuciones Ltda.', '900.200.300', 0, 620000],
        ['ND-2026-005', 'FV-2025-098', '2026-02-20', 'Empresa ABC Comercial S.A.S.', '800.100.200', 150000, 0],
      ];
      const td = filas.reduce((s, f) => s + (typeof f[5] === 'number' ? f[5] : 0), 0);
      const tc = filas.reduce((s, f) => s + (typeof f[6] === 'number' ? f[6] : 0), 0);
      return {
        columnas: [
          { label: 'Documento' }, { label: 'Doc. afectado' }, { label: 'Fecha' }, { label: 'Tercero' }, { label: 'NIT' },
          { label: 'Débito', money: true }, { label: 'Crédito', money: true },
        ],
        filas,
        totales: ['', '', '', '', 'TOTALES', td, tc],
      };
    }

    case 'mov-comprobante': {
      const map = new Map<string, { docs: number; debito: number; credito: number }>();
      for (const m of MOV) {
        const e = map.get(m.comprobante) ?? { docs: 0, debito: 0, credito: 0 };
        e.docs += 1;
        e.debito += m.debito;
        e.credito += m.credito;
        map.set(m.comprobante, e);
      }
      const filas: Celda[][] = [...map.entries()].map(([comp, e]) => [comp, '', e.docs, e.debito, e.credito]);
      return {
        columnas: [
          { label: 'Comprobante' }, { label: 'Tipo' }, { label: 'Líneas' }, { label: 'Débito', money: true }, { label: 'Crédito', money: true },
        ],
        filas,
        totales: ['TOTALES', '', MOV.length, MOV.reduce((s, m) => s + m.debito, 0), MOV.reduce((s, m) => s + m.credito, 0)],
      };
    }

    case 'inventario-bal': {
      const si = new Map(SALDOS_BALANCE.map(s => [s.cuenta, s.saldoInicial]));
      const filas: Celda[][] = BALANCE_COMP.map(r => {
        const inicial = si.get(r.cuenta) ?? 0;
        return [r.cuenta, r.nombre, inicial, r.debito, r.credito, inicial + r.debito - r.credito];
      });
      const tsi = BALANCE_COMP.reduce((s, r) => s + (si.get(r.cuenta) ?? 0), 0);
      return {
        columnas: [
          { label: 'Código' }, { label: 'Nombre' }, { label: 'Saldo inicial', money: true }, { label: 'Débito', money: true },
          { label: 'Crédito', money: true }, { label: 'Saldo final', money: true },
        ],
        filas,
        totales: ['', 'TOTALES', tsi, TOTAL_DEB, TOTAL_CRED, tsi],
        nota: 'Inventario y balance: saldo inicial + débitos − créditos = saldo final (cuadrado).',
      };
    }

    case 'mayor-bal': {
      const filas: Celda[][] = BALANCE_COMP.map(r => [r.cuenta, r.nombre, r.debito, r.credito, r.debito - r.credito]);
      return {
        columnas: [
          { label: 'Código' }, { label: 'Nombre' }, { label: 'Débito', money: true }, { label: 'Crédito', money: true }, { label: 'Saldo', money: true },
        ],
        filas,
        totales: ['', 'TOTALES', TOTAL_DEB, TOTAL_CRED, 0],
      };
    }

    case 'diario-cta': {
      const ordenadas = [...MOV].sort((a, b) => a.cuenta.localeCompare(b.cuenta));
      const filas: Celda[][] = ordenadas.map(m => [m.fecha, m.comprobante, m.documento, m.cuenta, m.nombreCuenta, m.concepto, m.debito, m.credito]);
      return {
        columnas: [
          { label: 'Fecha' }, { label: 'Comprobante' }, { label: 'Documento' }, { label: 'Cuenta' }, { label: 'Nombre' },
          { label: 'Concepto' }, { label: 'Débito', money: true }, { label: 'Crédito', money: true },
        ],
        filas,
        totales: ['', '', '', '', '', 'TOTALES', MOV.reduce((s, m) => s + m.debito, 0), MOV.reduce((s, m) => s + m.credito, 0)],
      };
    }

    case 'caja-diario-comp':
      return {
        columnas: [
          { label: 'Comprobante' }, { label: 'Documento' }, { label: 'Fecha' }, { label: 'Concepto' }, { label: 'Tercero' },
          { label: 'Débito', money: true }, { label: 'Crédito', money: true },
        ],
        filas: [
          ['CE-000246', 'CJA-2026-01', '2026-02-03', 'Papelería de oficina', 'Papelería El Estudiante', 85000, 0],
          ['CE-000246', 'CJA-2026-02', '2026-02-10', 'Transporte de mensajería', 'Mensajeros Urbanos S.A.S.', 120000, 0],
          ['CE-000246', 'CJA-2026-03', '2026-02-19', 'Cafetería de reuniones', 'Café y Más S.A.S.', 64000, 0],
          ['CE-000247', 'CJA-2026-04', '2026-02-27', 'Mantenimiento de equipo', 'Servitec Ltda.', 200000, 0],
        ],
        totales: ['', '', '', 'TOTALES', '', 469000, 0],
      };

    case 'caja-diario-cta':
      return {
        columnas: [
          { label: 'Cuenta' }, { label: 'Nombre' }, { label: 'Documento' }, { label: 'Fecha' }, { label: 'Débito', money: true }, { label: 'Crédito', money: true },
        ],
        filas: [
          ['519525', 'Elementos de aseo y cafetería', 'CJA-2026-01', '2026-02-03', 85000, 0],
          ['519530', 'Transporte, fletes y acarreos', 'CJA-2026-02', '2026-02-10', 120000, 0],
          ['519525', 'Elementos de aseo y cafetería', 'CJA-2026-03', '2026-02-19', 64000, 0],
          ['519545', 'Reparaciones locativas', 'CJA-2026-04', '2026-02-27', 200000, 0],
        ],
        totales: ['', 'TOTALES', '', '', 469000, 0],
      };

    case 'saldos-cuenta': {
      const filas: Celda[][] = SALDOS_BALANCE.map(s => {
        const { debito, credito } = sumDebCred(s.meses, 2);
        return [s.cuenta, s.nombre, s.saldoInicial, debito, credito, s.saldoInicial + debito - credito];
      });
      const t = (fn: (s: (typeof SALDOS_BALANCE)[number]) => number) => SALDOS_BALANCE.reduce((sum, s) => sum + fn(s), 0);
      return {
        columnas: [
          { label: 'Cuenta' }, { label: 'Nombre' }, { label: 'Saldo inicial', money: true }, { label: 'Débito', money: true },
          { label: 'Crédito', money: true }, { label: 'Saldo final', money: true },
        ],
        filas,
        totales: ['', 'TOTALES', t(s => s.saldoInicial), t(s => sumDebCred(s.meses, 2).debito), t(s => sumDebCred(s.meses, 2).credito), t(s => s.saldoInicial + sumDebCred(s.meses, 2).debito - sumDebCred(s.meses, 2).credito)],
      };
    }

    case 'bal-gral-resultados':
      return {
        columnas: [{ label: 'Concepto' }, { label: 'Valor', money: true }],
        filas: [
          ['ACTIVO', ''],
          ['Disponible (caja y bancos)', 54100000],
          ['Deudores', 36150000],
          ['Total activo', 90250000],
          ['PASIVO', ''],
          ['Obligaciones laborales y fiscales', 28150000],
          ['Total pasivo', 28150000],
          ['PATRIMONIO', ''],
          ['Capital social', 59550000],
          ['Utilidad del ejercicio', 2550000],
          ['Total patrimonio', 62100000],
          ['RESULTADOS', ''],
          ['Ingresos operacionales', 25000000],
          ['Gastos operacionales', 22450000],
          ['Utilidad neta', 2550000],
        ],
        nota: 'Activo (90.250.000) = Pasivo (28.150.000) + Patrimonio (62.100.000).',
      };

    case 'bal-comparativo-mensual': {
      const filas: Celda[][] = SALDOS_BALANCE.map(s => {
        const saldoEne = s.saldoInicial + s.meses[0].debito - s.meses[0].credito;
        const saldoFeb = saldoEne + s.meses[1].debito - s.meses[1].credito;
        return [s.cuenta, s.nombre, saldoEne, saldoFeb, saldoFeb - saldoEne];
      });
      const t = (k: number) => SALDOS_BALANCE.reduce((sum, s) => {
        const ene = s.saldoInicial + s.meses[0].debito - s.meses[0].credito;
        const feb = ene + s.meses[1].debito - s.meses[1].credito;
        return sum + (k === 0 ? ene : k === 1 ? feb : feb - ene);
      }, 0);
      return {
        columnas: [
          { label: 'Cuenta' }, { label: 'Nombre' }, { label: 'Saldo ene', money: true }, { label: 'Saldo feb', money: true }, { label: 'Variación', money: true },
        ],
        filas,
        totales: ['', 'TOTALES', t(0), t(1), t(2)],
      };
    }

    case 'analisis-anual-acum': {
      const filas: Celda[][] = SALDOS_BALANCE.map(s => {
        const { debito, credito } = sumDebCred(s.meses, 2);
        return [s.cuenta, s.nombre, debito, credito, s.saldoInicial + debito - credito];
      });
      return {
        columnas: [
          { label: 'Cuenta' }, { label: 'Nombre' }, { label: 'Débito', money: true }, { label: 'Crédito', money: true }, { label: 'Saldo', money: true },
        ],
        filas,
        totales: ['', 'TOTALES',
          SALDOS_BALANCE.reduce((s, x) => s + sumDebCred(x.meses, 2).debito, 0),
          SALDOS_BALANCE.reduce((s, x) => s + sumDebCred(x.meses, 2).credito, 0),
          SALDOS_BALANCE.reduce((s, x) => s + x.saldoInicial + sumDebCred(x.meses, 2).debito - sumDebCred(x.meses, 2).credito, 0),
        ],
      };
    }

    case 'analisis-anual-mens': {
      const columnas: Columna[] = [
        { label: 'Cuenta' }, { label: 'Nombre' },
        ...MESES_ABR.map(m => ({ label: m, money: true })),
        { label: 'Total', money: true },
      ];
      const filas: Celda[][] = SALDOS_BALANCE.map(s => {
        const saldos = s.meses.map(m => m.debito - m.credito);
        const total = s.saldoInicial + saldos.reduce((a, b) => a + b, 0);
        return [s.cuenta, s.nombre, ...saldos, total];
      });
      const totales: Celda[] = ['', 'TOTALES'];
      for (let i = 0; i < 12; i++) totales.push(SALDOS_BALANCE.reduce((s, x) => s + (x.meses[i]?.debito ?? 0) - (x.meses[i]?.credito ?? 0), 0));
      totales.push(SALDOS_BALANCE.reduce((s, x) => s + x.saldoInicial + x.meses.reduce((a, m) => a + m.debito - m.credito, 0), 0));
      return { columnas, filas, totales };
    }

    case 'mov-tipo-doc': {
      const map = new Map<string, { nombre: string; docs: number; debito: number; credito: number }>();
      const nombres: Record<string, string> = { FV: 'Factura de venta', OR: 'Orden de recaudo', NOM: 'Nómina' };
      for (const m of MOV) {
        const e = map.get(m.tipoDoc) ?? { nombre: nombres[m.tipoDoc] ?? m.tipoDoc, docs: 0, debito: 0, credito: 0 };
        e.docs += 1;
        e.debito += m.debito;
        e.credito += m.credito;
        map.set(m.tipoDoc, e);
      }
      const filas: Celda[][] = [...map.entries()].map(([tipo, e]) => [tipo, e.nombre, e.docs, e.debito, e.credito]);
      return {
        columnas: [
          { label: 'Tipo doc.' }, { label: 'Nombre' }, { label: 'Documentos' }, { label: 'Débito', money: true }, { label: 'Crédito', money: true },
        ],
        filas,
        totales: ['', 'TOTALES', MOV.length, MOV.reduce((s, m) => s + m.debito, 0), MOV.reduce((s, m) => s + m.credito, 0)],
      };
    }

    case 'mov-cuenta': {
      const map = new Map<string, { nombre: string; debito: number; credito: number }>();
      for (const m of MOV) {
        const e = map.get(m.cuenta) ?? { nombre: m.nombreCuenta, debito: 0, credito: 0 };
        e.debito += m.debito;
        e.credito += m.credito;
        map.set(m.cuenta, e);
      }
      const filas: Celda[][] = [...map.entries()].map(([cuenta, e]) => [cuenta, e.nombre, e.debito, e.credito]);
      return {
        columnas: [
          { label: 'Cuenta' }, { label: 'Nombre' }, { label: 'Débito', money: true }, { label: 'Crédito', money: true },
        ],
        filas,
        totales: ['', 'TOTALES', MOV.reduce((s, m) => s + m.debito, 0), MOV.reduce((s, m) => s + m.credito, 0)],
      };
    }

    case 'comp-cta-tercero':
    case 'tercero-cuenta-tercero': {
      const filas: Celda[][] = MOV.map(m => [m.cuenta, m.nombreCuenta, m.nit, m.tercero, m.debito, m.credito]);
      return {
        columnas: [
          { label: 'Cuenta' }, { label: 'Nombre' }, { label: 'NIT' }, { label: 'Tercero' }, { label: 'Débito', money: true }, { label: 'Crédito', money: true },
        ],
        filas,
        totales: ['', '', '', 'TOTALES', MOV.reduce((s, m) => s + m.debito, 0), MOV.reduce((s, m) => s + m.credito, 0)],
      };
    }

    case 'resumen-tipo-contribuyente':
      return {
        columnas: [
          { label: 'Tipo de contribuyente' }, { label: 'Terceros' }, { label: 'Saldo', money: true },
        ],
        filas: [
          ['Régimen común', 3, 25400000],
          ['Gran contribuyente', 1, 15400000],
          ['No responsable de IVA', 1, 9800000],
          ['Bloqueados', 1, -5200000],
        ],
        totales: ['TOTALES', 6, 45400000],
      };

    case 'tercero-general': {
      const filas: Celda[][] = TERCEROS.map(t => [t.nit, t.nombre, t.tipo, t.tipoDoc, t.ciudad, t.telefono, t.saldo, t.cupo, t.estado]);
      return {
        columnas: [
          { label: 'NIT' }, { label: 'Nombre' }, { label: 'Tipo' }, { label: 'Doc.' }, { label: 'Ciudad' }, { label: 'Teléfono' },
          { label: 'Saldo', money: true }, { label: 'Cupo', money: true }, { label: 'Estado' },
        ],
        filas,
        totales: ['', '', '', '', '', 'TOTALES',
          TERCEROS.reduce((s, t) => s + t.saldo, 0),
          TERCEROS.reduce((s, t) => s + t.cupo, 0), ''],
      };
    }

    case 'tercero-acumulacion': {
      const filas: Celda[][] = TERCEROS.map(t => {
        const pct = t.cupo > 0 ? Math.round(Math.max(0, t.saldo) * 100 / t.cupo) : 0;
        return [t.nit, t.nombre, t.saldo, t.cupo, pct];
      });
      return {
        columnas: [
          { label: 'NIT' }, { label: 'Tercero' }, { label: 'Saldo acumulado', money: true }, { label: 'Cupo', money: true }, { label: '% cupo' },
        ],
        filas,
        totales: ['', 'TOTALES',
          TERCEROS.reduce((s, t) => s + t.saldo, 0),
          TERCEROS.reduce((s, t) => s + t.cupo, 0), ''],
      };
    }

    case 'tercero-especifico': {
      const propio = MOV.filter(m => m.nit === '800.100.200').map(m => [m.fecha, m.comprobante, m.documento, m.cuenta, m.nombreCuenta, m.debito, m.credito]);
      const filas: Celda[][] = [
        ...propio,
        ['2026-02-20', 'CI-000146', 'FV-2026-002', '130505', 'Clientes nacionales', 3200000, 0],
        ['2026-02-20', 'CI-000146', 'FV-2026-002', '111005', 'Bancos moneda nacional', 0, 3200000],
      ];
      return {
        columnas: [
          { label: 'Fecha' }, { label: 'Comprobante' }, { label: 'Documento' }, { label: 'Cuenta' }, { label: 'Nombre' },
          { label: 'Débito', money: true }, { label: 'Crédito', money: true },
        ],
        filas,
        totales: ['', '', '', '', 'TOTALES',
          filas.reduce((s, f) => s + (typeof f[5] === 'number' ? f[5] : 0), 0),
          filas.reduce((s, f) => s + (typeof f[6] === 'number' ? f[6] : 0), 0)],
        nota: 'Tercero específico: Empresa ABC Comercial S.A.S. — NIT 800.100.200-3.',
      };
    }

    case 'tercero-cumpleanos':
      return {
        columnas: [
          { label: 'Tercero' }, { label: 'NIT' }, { label: 'Fecha de nacimiento' }, { label: 'Estado' },
        ],
        filas: [
          ['García Moreno Juan Pablo', '12.345.678', '1985-02-12', 'Cumplió el 12-feb'],
          ['López Vargas María Fernanda', '23.456.789', '1990-02-28', 'Cumplió el 28-feb'],
          ['Martínez Rojas Ana Lucía', '34.567.890', '1992-03-05', 'Próximo: 05-mar'],
          ['Contacto gerencia — Empresa ABC', '800.100.200', '1978-03-21', 'Próximo: 21-mar'],
          ['Contacto compras — Comercial XYZ', '900.200.300', '1983-04-09', 'Próximo: 09-abr'],
          ['Contacto cartera — Suministros Técnicos', '860.050.010', '1965-12-30', 'Próximo: 30-dic'],
        ],
      };

    case 'tercero-etiquetas':
      return {
        columnas: [
          { label: 'Etiqueta' }, { label: 'Terceros' }, { label: 'Saldo', money: true },
        ],
        filas: [
          ['Clientes frecuentes', 2, 25200000],
          ['Proveedores críticos', 2, 9800000],
          ['VIP', 1, 15400000],
          ['En riesgo', 1, -5200000],
        ],
        totales: ['TOTALES', 6, 45200000],
      };

    case 'diario-rangos-continuos':
    case 'diario-rangos-fijos': {
      let filas: Celda[][] = MOV.filter(m => m.centro).map(m => [m.centro, m.documento, m.fecha, m.cuenta, m.nombreCuenta, m.debito, m.credito]);
      filas = [
        ...filas,
        ['ADM', 'CE-000245', '2026-02-28', '510506', 'Sueldos y salarios', 1200000, 0],
        ['ADM', 'CE-000245', '2026-02-28', '250505', 'Salarios por pagar', 0, 1200000],
      ];
      if (id === 'diario-rangos-fijos') filas = [...filas].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      return {
        columnas: [
          { label: 'Centro' }, { label: 'Documento' }, { label: 'Fecha' }, { label: 'Cuenta' }, { label: 'Nombre' },
          { label: 'Débito', money: true }, { label: 'Crédito', money: true },
        ],
        filas,
        totales: ['', '', '', '', 'TOTALES',
          filas.reduce((s, f) => s + (typeof f[5] === 'number' ? f[5] : 0), 0),
          filas.reduce((s, f) => s + (typeof f[6] === 'number' ? f[6] : 0), 0)],
      };
    }

    case 'balance-acumulado': {
      const nombres: Record<string, string> = Object.fromEntries(CENTROS.map(c => [c.codigo, c.nombre]));
      const filas: Celda[][] = [
        ['ADM', nombres.ADM ?? 'Administración', 9800000],
        ['VEN', nombres.VEN ?? 'Ventas', 6400000],
        ['OPE', nombres.OPE ?? 'Operaciones', 4600000],
      ];
      return {
        columnas: [
          { label: 'Centro' }, { label: 'Nombre' }, { label: 'Saldo acumulado', money: true },
        ],
        filas,
        totales: ['', 'TOTALES', 20800000],
      };
    }

    case 'balance-mensual-centro':
      return {
        columnas: [
          { label: 'Centro' }, { label: 'Ene', money: true }, { label: 'Feb', money: true }, { label: 'Total', money: true },
        ],
        filas: [
          ['ADM', 7400000, 2400000, 9800000],
          ['VEN', 4000000, 2400000, 6400000],
          ['OPE', 2800000, 1800000, 4600000],
        ],
        totales: ['TOTALES', 14200000, 6600000, 20800000],
      };

    case 'clasificacion-centros':
      return {
        columnas: [
          { label: 'Cuenta' }, { label: 'Nombre' }, { label: 'ADM', money: true }, { label: 'VEN', money: true }, { label: 'OPE', money: true }, { label: 'Total', money: true },
        ],
        filas: [
          ['510506', 'Sueldos y salarios', 5700000, 3200000, 2900000, 11800000],
          ['250505', 'Salarios por pagar', 5300000, 3200000, 2900000, 11400000],
          ['236540', 'Retenciones y aportes de nómina', 1200000, 0, 0, 1200000],
        ],
        totales: ['', 'TOTALES', 12200000, 6400000, 5800000, 24400000],
      };

    case 'clasificacion-centro-tercero':
      return {
        columnas: [
          { label: 'Centro' }, { label: 'NIT' }, { label: 'Tercero' }, { label: 'Valor', money: true },
        ],
        filas: [
          ['ADM', '12.345.678', 'García Moreno Juan Pablo', 6900000],
          ['ADM', '34.567.890', 'Martínez Rojas Ana Lucía', 5300000],
          ['VEN', '23.456.789', 'López Vargas María Fernanda', 6400000],
          ['OPE', '34.567.890', 'Martínez Rojas Ana Lucía', 5800000],
        ],
        totales: ['', '', 'TOTALES', 24400000],
      };

    case 'discriminados-mes': {
      const columnas: Columna[] = [
        { label: 'Centro' }, ...MESES_ABR.map(m => ({ label: m, money: true })), { label: 'Total', money: true },
      ];
      const datos: Record<string, { ene: number; feb: number }> = {
        ADM: { ene: 7400000, feb: 2400000 },
        VEN: { ene: 4000000, feb: 2400000 },
        OPE: { ene: 2800000, feb: 1800000 },
      };
      const filas: Celda[][] = Object.entries(datos).map(([centro, d]) => [
        centro, d.ene, d.feb, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, d.ene + d.feb,
      ]);
      const totales: Celda[] = ['TOTALES', 14200000, 6600000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 20800000];
      return { columnas, filas, totales };
    }

    case 'def-cuentas-flujo':
      return {
        columnas: [
          { label: 'Código' }, { label: 'Nombre' }, { label: 'Clasificación' }, { label: 'Signo' },
        ],
        filas: [
          ['110505', 'Caja general', 'Operación', '+'],
          ['111005', 'Bancos moneda nacional', 'Operación', '+'],
          ['130505', 'Clientes nacionales', 'Operación', '+'],
          ['236540', 'Retenciones y aportes de nómina', 'Operación', '−'],
          ['240805', 'IVA por pagar', 'Operación', '−'],
          ['250505', 'Salarios por pagar', 'Operación', '−'],
          ['510506', 'Sueldos y salarios', 'Operación', '−'],
          ['150405', 'Construcciones en curso', 'Inversión', '+'],
          ['152405', 'Maquinaria y equipo', 'Inversión', '+'],
        ],
        nota: 'Definición de cuentas para el flujo de caja (método indirecto).',
      };

    case 'flujo-comparativo':
      return {
        columnas: [
          { label: 'Concepto' }, { label: '2025', money: true }, { label: '2026', money: true }, { label: 'Variación', money: true },
        ],
        filas: [
          ['Saldo inicial', 48000000, 53700000, 5700000],
          ['Ingresos de operación', 25000000, 25000000, 0],
          ['Egresos de operación', 22450000, 24150000, 1700000],
          ['Flujo neto de operación', 2550000, 850000, -1700000],
          ['Flujo de inversión', 12000000, 0, -12000000],
          ['Flujo de financiación', 0, 0, 0],
          ['Flujo neto del período', -9450000, 850000, 10300000],
          ['Saldo final', 38550000, 54550000, 16000000],
        ],
        nota: 'Saldo final 2026 = saldo inicial + flujo neto (53.700.000 + 850.000).',
      };

    case 'esfa-apertura': {
      const saldos: Record<string, number> = {
        '110505': 7500000, '111005': 46600000, '130505': 32700000,
        '236540': -2100000, '240805': -2550000, '250505': -13800000,
      };
      const filas: Celda[][] = [
        ['110505', 'Caja general', saldos['110505'], 0, saldos['110505']],
        ['111005', 'Bancos moneda nacional', saldos['111005'], 0, saldos['111005']],
        ['130505', 'Clientes nacionales', saldos['130505'], -2700000, 30000000],
        ['150405', 'Construcciones en curso', 0, 35000000, 35000000],
        ['236540', 'Retenciones y aportes de nómina', saldos['236540'], 0, saldos['236540']],
        ['240805', 'IVA por pagar', saldos['240805'], 0, saldos['240805']],
        ['250505', 'Salarios por pagar', saldos['250505'], 0, saldos['250505']],
      ];
      return {
        columnas: [
          { label: 'Cuenta' }, { label: 'Nombre' }, { label: 'Saldo local', money: true }, { label: 'Ajuste NIIF', money: true }, { label: 'Saldo NIIF', money: true },
        ],
        filas,
        totales: ['', 'TOTALES', 68350000, 32300000, 100650000],
        nota: 'ESFA de apertura — convergencia a NIIF con ajustes simulados (deterioro de cartera, reconocimiento de construcciones en curso).',
      };
    }

    case 'nic-saldos': {
      const si = new Map(SALDOS_BALANCE.map(s => [s.cuenta, s.saldoInicial]));
      const filas: Celda[][] = SALDOS_BALANCE.map(s => {
        const { debito, credito } = sumDebCred(s.meses, 2);
        return [s.cuenta, s.nombre, si.get(s.cuenta) ?? 0, debito, credito, (si.get(s.cuenta) ?? 0) + debito - credito];
      });
      return {
        columnas: [
          { label: 'Cuenta' }, { label: 'Nombre' }, { label: 'Saldo inicial NIIF', money: true }, { label: 'Débito', money: true },
          { label: 'Crédito', money: true }, { label: 'Saldo final NIIF', money: true },
        ],
        filas,
        totales: ['', 'TOTALES',
          SALDOS_BALANCE.reduce((s, x) => s + x.saldoInicial, 0),
          SALDOS_BALANCE.reduce((s, x) => s + sumDebCred(x.meses, 2).debito, 0),
          SALDOS_BALANCE.reduce((s, x) => s + sumDebCred(x.meses, 2).credito, 0),
          SALDOS_BALANCE.reduce((s, x) => s + x.saldoInicial + sumDebCred(x.meses, 2).debito - sumDebCred(x.meses, 2).credito, 0),
        ],
        nota: 'Información NIC de saldos y movimientos — período 2026-02.',
      };
    }

    default: {
      const filas: Celda[][] = MOV.map(m => [m.fecha, m.comprobante, m.documento, m.cuenta, m.nombreCuenta, m.debito, m.credito]);
      return {
        columnas: [
          { label: 'Fecha' }, { label: 'Comprobante' }, { label: 'Documento' }, { label: 'Cuenta' }, { label: 'Nombre' },
          { label: 'Débito', money: true }, { label: 'Crédito', money: true },
        ],
        filas,
        totales: ['', '', '', '', 'TOTALES', MOV.reduce((s, m) => s + m.debito, 0), MOV.reduce((s, m) => s + m.credito, 0)],
      };
    }
  }
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
const STORAGE_FAVS = `contabdsi:informes:favoritos:v1:${EMPRESA.codigo}`;
const STORAGE_RECIENTES = `contabdsi:informes:recientes:v1:${EMPRESA.codigo}`;

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
    <dialog ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); onClose(); }} className={`fixed inset-0 m-auto w-[calc(100%_-_2rem)] ${ancho} rounded-lg border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/40`}>
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
  formato: string;
  balance?: BalanceComprobacion;
  filtrosBalance?: FiltrosBalanceComprobacion;
}

function VistaPrevia({ preview, onClose }: { preview: PreviewState; onClose: () => void }) {
  const datos = useMemo<DatosInforme>(() => {
    if (!preview.balance) return datosDe(preview.inf.id);
    return {
      columnas: [
        { label: 'Cuenta' }, { label: 'Nombre' }, { label: 'Saldo anterior', money: true },
        { label: 'Débitos', money: true }, { label: 'Créditos', money: true }, { label: 'Saldo actual', money: true },
      ],
      filas: preview.balance.items.map(item => [
        item.cuenta, item.nombre, item.saldoAnterior, item.debito, item.credito, item.saldoActual,
      ]),
      totales: [
        '', 'TOTALES DE CONTROL', preview.balance.totales.saldoAnterior,
        preview.balance.totales.debito, preview.balance.totales.credito, preview.balance.totales.saldoActual,
      ],
      nota: preview.balance.totales.diferencia === 0
        ? `Balance cuadrado. Fuente: ${preview.balance.source}.`
        : `Diferencia contable: ${fmtMonto(preview.balance.totales.diferencia)}.`,
    };
  }, [preview.balance, preview.inf.id]);
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
    timer.current = window.setTimeout(() => {
      setExportando(null);
      setAviso(`Archivo «${preview.inf.nombre}» exportado en ${formato} (simulado).`);
    }, 900);
  }

  return (
    <Modal title={preview.inf.nombre} onClose={onClose} ancho="max-w-5xl">
      <div className="flex flex-col" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
        {/* Encabezado del informe */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <div className="text-center space-y-0.5">
            <div className="text-sm font-bold text-gray-800 uppercase">{preview.inf.nombre}</div>
            <div className="text-xs text-gray-600">
              {preview.balance ? preview.balance.compania.nombre : EMPRESA.nombre} — NIT {preview.balance ? preview.balance.compania.nit : `${EMPRESA.nit}-${EMPRESA.digito}`}
            </div>
            <div className="text-xs text-gray-500">
              {preview.balance ? `${preview.balance.periodo} · Nivel ${preview.balance.nombreNivel}` : `Año ${preview.anio} · ${preview.mesDesde} a ${preview.mesHasta} · Período ${PERIODO.nombre}`}
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
          {!preview.balance && <button type="button" onClick={() => { setAviso('Impresión enviada a la cola de impresión (simulado).'); }} className={BUTTON_SECONDARY}>⎙ Imprimir</button>}
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
              {visibles.map((fila, i) => (
                <tr key={i} className="hoverable">
                  {fila.map((celda, j) => (
                    <CeldaValor key={j} valor={celda} money={!!datos.columnas[j]?.money} />
                  ))}
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
  const [params, setParams] = useState({ anio: '2026', mesDesde: 'Enero', mesHasta: 'Febrero', formato: 'PDF', nivel: '6', incluirCeros: false });
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
    setShowParams(inf);
  }

  async function generar(inf: Informe) {
    setErrorInforme(null);
    if (BALANCE_IDS.has(inf.id)) {
      const filtros: FiltrosBalanceComprobacion = {
        cia,
        anio: Number(params.anio),
        mesDesde: MESES.indexOf(params.mesDesde) + 1,
        mesHasta: MESES.indexOf(params.mesHasta) + 1,
        nivel: Number(params.nivel) as 4 | 6 | 9 | 12,
        incluirCeros: params.incluirCeros,
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
    setShowParams(null);
    setRecientes(prev => [inf.id, ...prev.filter(id => id !== inf.id)].slice(0, 6));
    setPreview({ inf, ...params });
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
        <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Balance conectado a Advantage</span>
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
              className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 transition-colors"
              onClick={() => abrirInforme(inf)}
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
              <button className="text-xs px-3 py-1 rounded bg-petroleum-500 text-white shrink-0 hover:bg-petroleum-600">
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
                    className="border border-gray-200 rounded p-3 hover:border-petroleum-300 hover:shadow-sm transition-all cursor-pointer group"
                    onClick={() => abrirInforme(inf)}
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
                      <button className="text-[10px] px-2 py-0.5 rounded text-white bg-petroleum-500 hover:bg-petroleum-600">
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
              <div>
                <label htmlFor="param-anio" className="block text-xs font-medium text-gray-600 mb-1">Año</label>
                <input id="param-anio" data-initial-focus value={params.anio} onChange={e => setParams(p => ({ ...p, anio: e.target.value }))} className={`${INPUT} font-mono`} />
              </div>
              <div>
                <label htmlFor="param-formato" className="block text-xs font-medium text-gray-600 mb-1">Formato</label>
                <select id="param-formato" value={params.formato} onChange={e => setParams(p => ({ ...p, formato: e.target.value }))} className={INPUT}>
                  <option>PDF</option>
                  <option>XLSX</option>
                  <option>CSV</option>
                </select>
              </div>
              <div>
                <label htmlFor="param-mes-desde" className="block text-xs font-medium text-gray-600 mb-1">Mes desde</label>
                <select id="param-mes-desde" value={params.mesDesde} onChange={e => setParams(p => ({ ...p, mesDesde: e.target.value }))} className={INPUT}>
                  {MESES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="param-mes-hasta" className="block text-xs font-medium text-gray-600 mb-1">Mes hasta</label>
                <select id="param-mes-hasta" value={params.mesHasta} onChange={e => setParams(p => ({ ...p, mesHasta: e.target.value }))} className={INPUT}>
                  {MESES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
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
                </>
              )}
            </div>
            <p className="px-5 pb-3 text-xs text-gray-400">
              {BALANCE_IDS.has(showParams.id)
                ? 'El informe se calcula con MSALDO y los acumulados mensuales de CONMAE. PDF y XLSX descargan datos reales.'
                : 'La vista previa se abre paginada en un modal amplio. Las exportaciones de este informe continúan en demostración.'}
            </p>
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
