/* ============================================================
   CONTABDSI · Catálogo de informes (38 informes del legado)
   ============================================================ */

import type { ReportCategory, ReportDef } from '@/core/types'

const P: ReportDef['params'] = [
  { key: 'periodo', label: 'Período', tipo: 'periodo', defaultValue: '02' },
]

const col = (key: string, label: string, opts: Partial<ReportDef['columns'][number]> = {}): ReportDef['columns'][number] => ({
  key, label, ...opts,
})

const DOC_COLS = [
  col('comprobante', 'Comp.', { width: 60 }),
  col('documento', 'Documento', { width: 130 }),
  col('fecha', 'Fecha', { width: 80 }),
  col('tercero', 'Tercero', { width: 160 }),
  col('concepto', 'Concepto', { width: 200 }),
  col('debito', 'Débito', { money: true, align: 'right' }),
  col('credito', 'Crédito', { money: true, align: 'right' }),
]

const MOV_COLS = [
  col('cuenta', 'Cuenta', { width: 90 }),
  col('nombre', 'Nombre cuenta', { width: 200 }),
  col('nit', 'NIT', { width: 100 }),
  col('tercero', 'Tercero', { width: 150 }),
  col('centro', 'Centro', { width: 70 }),
  col('comprobante', 'Comp.', { width: 55 }),
  col('documento', 'Documento', { width: 120 }),
  col('fecha', 'Fecha', { width: 80 }),
  col('debito', 'Débito', { money: true, align: 'right' }),
  col('credito', 'Crédito', { money: true, align: 'right' }),
  col('base', 'Base', { money: true, align: 'right' }),
  col('clase', 'Clase', { width: 60 }),
]

const SALDO_COLS = [
  col('cuenta', 'Cuenta', { width: 90 }),
  col('nombre', 'Nombre cuenta', { width: 220 }),
  col('saldoInicial', 'Saldo inicial', { money: true, align: 'right' }),
  col('debito', 'Débito mes', { money: true, align: 'right' }),
  col('credito', 'Crédito mes', { money: true, align: 'right' }),
  col('saldo', 'Saldo final', { money: true, align: 'right' }),
]

export const REPORT_CATEGORIES: Record<ReportCategory, string> = {
  documentos: 'Documentos',
  libros: 'Libros',
  estados: 'Estados y balances',
  terceros: 'Terceros',
  centros: 'Centros',
  flujo: 'Flujo de caja',
  nic: 'NIC/NIIF',
  generador: 'Generador personalizado',
}

export const REPORTS: ReportDef[] = [
  /* Documentos */
  { id: 'doc-formato', nombre: 'Documento por formato', categoria: 'documentos', descripcion: 'Documentos impresos según el formato documental configurado.', params: [...P, { key: 'comprobante', label: 'Comprobante', tipo: 'texto', defaultValue: '' }], columns: DOC_COLS },
  { id: 'doc-planilla', nombre: 'Documento por planilla', categoria: 'documentos', descripcion: 'Listado de documentos según plantilla de impresión.', params: P, columns: DOC_COLS },
  /* Libros */
  { id: 'lib-listado-cuentas', nombre: 'Listado de cuentas', categoria: 'libros', descripcion: 'Plan de cuentas con saldos.', params: [{ key: 'nivel', label: 'Desde nivel', tipo: 'nivel', defaultValue: '1' }, ...P], columns: SALDO_COLS },
  { id: 'lib-balance-acumulado', nombre: 'Balance de comprobación acumulado', categoria: 'libros', descripcion: 'Balance de comprobación acumulado a la fecha.', params: P, columns: SALDO_COLS },
  { id: 'lib-balance-mensual', nombre: 'Balance mensual', categoria: 'libros', descripcion: 'Balance de comprobación de un mes específico.', params: P, columns: SALDO_COLS },
  { id: 'lib-acumulado-corriente', nombre: 'Acumulado corriente / no corriente', categoria: 'libros', descripcion: 'Saldos acumulados clasificados corriente y no corriente.', params: P, columns: SALDO_COLS },
  { id: 'lib-auxiliar-general', nombre: 'Libro auxiliar general', categoria: 'libros', descripcion: 'Movimiento detallado por cuenta.', params: [{ key: 'cuenta', label: 'Cuenta', tipo: 'cuenta', defaultValue: '' }, ...P], columns: MOV_COLS },
  { id: 'lib-auxiliar-afectado', nombre: 'Auxiliar por documento afectado', categoria: 'libros', descripcion: 'Movimientos que afectan un documento específico.', params: [...P, { key: 'documento', label: 'Documento afectado', tipo: 'texto', defaultValue: '' }], columns: MOV_COLS },
  { id: 'lib-mov-comprobante', nombre: 'Movimiento por comprobante', categoria: 'libros', descripcion: 'Movimientos agrupados por comprobante.', params: P, columns: DOC_COLS },
  { id: 'lib-inventario-balance', nombre: 'Inventario y balance', categoria: 'libros', descripcion: 'Inventario y balance de comprobación.', params: P, columns: SALDO_COLS },
  { id: 'lib-mayor-balance', nombre: 'Mayor y balance', categoria: 'libros', descripcion: 'Libro mayor con totales por cuenta.', params: P, columns: SALDO_COLS },
  { id: 'lib-diario-cuenta', nombre: 'Diario por cuenta', categoria: 'libros', descripcion: 'Diario oficial ordenado por cuenta.', params: P, columns: MOV_COLS },
  { id: 'lib-caja-comprobante', nombre: 'Caja diario por comprobante', categoria: 'libros', descripcion: 'Caja diario ordenado por comprobante.', params: P, columns: DOC_COLS },
  { id: 'lib-caja-cuenta', nombre: 'Caja diario por cuenta', categoria: 'libros', descripcion: 'Caja diario ordenado por cuenta.', params: P, columns: MOV_COLS },
  { id: 'lib-saldos-cuenta', nombre: 'Saldos por cuenta', categoria: 'libros', descripcion: 'Resumen de saldos por cuenta.', params: P, columns: SALDO_COLS },
  /* Estados */
  { id: 'est-balance-general', nombre: 'Balance general y estado de resultados', categoria: 'estados', descripcion: 'Estados financieros básicos.', params: P, columns: SALDO_COLS },
  { id: 'est-balance-comparativo', nombre: 'Balance comparativo mensual', categoria: 'estados', descripcion: 'Comparación de balances entre meses.', params: P, columns: [col('cuenta', 'Cuenta', { width: 90 }), col('nombre', 'Nombre', { width: 220 }), col('mesA', 'Mes anterior', { money: true, align: 'right' }), col('mesB', 'Mes actual', { money: true, align: 'right' }), col('var', 'Variación', { money: true, align: 'right' })] },
  { id: 'est-analisis-anual-acum', nombre: 'Análisis anual acumulado', categoria: 'estados', descripcion: 'Análisis anual con acumulados.', params: P, columns: SALDO_COLS },
  { id: 'est-analisis-anual-mensual', nombre: 'Análisis anual mensual', categoria: 'estados', descripcion: 'Análisis anual mes a mes.', params: P, columns: SALDO_COLS },
  { id: 'est-balance-prueba-anual', nombre: 'Balance de prueba anual', categoria: 'estados', descripcion: 'Balance de prueba del año completo.', params: P, columns: SALDO_COLS },
  { id: 'est-mov-tipo-doc', nombre: 'Movimiento por tipo de documento', categoria: 'estados', descripcion: 'Movimientos agrupados por tipo de documento.', params: P, columns: DOC_COLS },
  { id: 'est-mov-cuenta', nombre: 'Movimiento por cuenta', categoria: 'estados', descripcion: 'Movimientos detallados por cuenta.', params: P, columns: MOV_COLS },
  { id: 'est-comparativo-cta-tercero', nombre: 'Comparativo cuenta-tercero', categoria: 'estados', descripcion: 'Comparativo entre cuenta y tercero.', params: P, columns: [col('cuenta', 'Cuenta', { width: 90 }), col('nit', 'NIT', { width: 100 }), col('tercero', 'Tercero', { width: 160 }), col('debito', 'Débito', { money: true, align: 'right' }), col('credito', 'Crédito', { money: true, align: 'right' }), col('saldo', 'Saldo', { money: true, align: 'right' })] },
  { id: 'est-resumen-contribuyente', nombre: 'Resumen por tipo de contribuyente', categoria: 'estados', descripcion: 'Resumen de movimientos por tipo de contribuyente.', params: P, columns: [col('tipoDoc', 'Tipo doc.', { width: 80 }), col('cantidad', 'Cantidad', { width: 80, align: 'right' }), col('debito', 'Débito', { money: true, align: 'right' }), col('credito', 'Crédito', { money: true, align: 'right' })] },
  /* Terceros */
  { id: 'ter-general', nombre: 'Informe general de terceros', categoria: 'terceros', descripcion: 'Listado general con datos básicos.', params: P, columns: [col('nit', 'NIT', { width: 100 }), col('nombre', 'Nombre', { width: 200 }), col('ciudad', 'Ciudad', { width: 100 }), col('saldo', 'Saldo', { money: true, align: 'right' }), col('estado', 'Estado', { width: 90 })] },
  { id: 'ter-acumulacion', nombre: 'Acumulación de terceros', categoria: 'terceros', descripcion: 'Acumulados por tercero.', params: P, columns: [col('nit', 'NIT', { width: 100 }), col('nombre', 'Nombre', { width: 200 }), col('debito', 'Débito', { money: true, align: 'right' }), col('credito', 'Crédito', { money: true, align: 'right' })] },
  { id: 'ter-cuenta-tercero', nombre: 'Cuenta-tercero', categoria: 'terceros', descripcion: 'Movimientos por cuenta y tercero.', params: P, columns: [col('cuenta', 'Cuenta', { width: 90 }), col('nit', 'NIT', { width: 100 }), col('nombre', 'Tercero', { width: 180 }), col('debito', 'Débito', { money: true, align: 'right' }), col('credito', 'Crédito', { money: true, align: 'right' })] },
  { id: 'ter-especifico', nombre: 'Tercero específico', categoria: 'terceros', descripcion: 'Movimiento de un tercero puntual.', params: [...P, { key: 'tercero', label: 'NIT tercero', tipo: 'tercero', defaultValue: '' }], columns: MOV_COLS },
  { id: 'ter-cumpleanos', nombre: 'Cumpleaños', categoria: 'terceros', descripcion: 'Terceros por fecha de nacimiento.', params: [{ key: 'mes', label: 'Mes', tipo: 'select', defaultValue: 'Febrero', options: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'] }], columns: [col('nit', 'NIT', { width: 100 }), col('nombre', 'Nombre', { width: 200 }), col('nacimiento', 'Nacimiento', { width: 100 }), col('ciudad', 'Ciudad', { width: 100 })] },
  { id: 'ter-etiquetas', nombre: 'Informe por etiquetas', categoria: 'terceros', descripcion: 'Terceros agrupados por etiquetas.', params: P, columns: [col('nit', 'NIT', { width: 100 }), col('nombre', 'Nombre', { width: 200 }), col('etiquetas', 'Etiquetas', { width: 160 }), col('saldo', 'Saldo', { money: true, align: 'right' })] },
  /* Centros */
  { id: 'cen-diario-continuo', nombre: 'Diario por centro con rangos continuos', categoria: 'centros', descripcion: 'Diario por centro con rangos continuos de documento.', params: P, columns: MOV_COLS },
  { id: 'cen-diario-fijo', nombre: 'Diario por centro con rangos fijos', categoria: 'centros', descripcion: 'Diario por centro con rangos fijos de documento.', params: P, columns: MOV_COLS },
  { id: 'cen-balance-acum', nombre: 'Balance de centro acumulado', categoria: 'centros', descripcion: 'Balance acumulado por centro de costo.', params: P, columns: [col('centro', 'Centro', { width: 90 }), col('nombre', 'Nombre', { width: 180 }), col('saldoInicial', 'Saldo inicial', { money: true, align: 'right' }), col('debito', 'Débito', { money: true, align: 'right' }), col('credito', 'Crédito', { money: true, align: 'right' }), col('saldo', 'Saldo', { money: true, align: 'right' })] },
  { id: 'cen-balance-mensual', nombre: 'Balance de centro mensual', categoria: 'centros', descripcion: 'Balance mensual por centro de costo.', params: P, columns: [col('centro', 'Centro', { width: 90 }), col('nombre', 'Nombre', { width: 180 }), col('debito', 'Débito', { money: true, align: 'right' }), col('credito', 'Crédito', { money: true, align: 'right' }), col('saldo', 'Saldo', { money: true, align: 'right' })] },
  { id: 'cen-clasificacion', nombre: 'Clasificación por centros', categoria: 'centros', descripcion: 'Movimientos clasificados por centro.', params: P, columns: MOV_COLS },
  { id: 'cen-clasif-tercero', nombre: 'Clasificación centro-tercero', categoria: 'centros', descripcion: 'Movimientos por centro y tercero.', params: P, columns: [col('centro', 'Centro', { width: 90 }), col('nit', 'NIT', { width: 100 }), col('nombre', 'Tercero', { width: 180 }), col('debito', 'Débito', { money: true, align: 'right' }), col('credito', 'Crédito', { money: true, align: 'right' })] },
  { id: 'cen-discriminado-mes', nombre: 'Centros discriminados por mes', categoria: 'centros', descripcion: 'Centros discriminados mes a mes (columnas 51-52).', params: P, columns: [col('centro', 'Centro', { width: 90 }), col('nombre', 'Nombre', { width: 180 }), col('enero', 'Ene', { money: true, align: 'right' }), col('febrero', 'Feb', { money: true, align: 'right' }), col('marzo', 'Mar', { money: true, align: 'right' })] },
  /* Flujo */
  { id: 'flujo-definicion', nombre: 'Definición de cuentas de flujo de caja', categoria: 'flujo', descripcion: 'Cuentas asignadas al flujo de caja.', params: P, columns: [col('cuenta', 'Cuenta', { width: 90 }), col('nombre', 'Nombre', { width: 220 }), col('actividad', 'Actividad', { width: 140 })] },
  { id: 'flujo-comparativo', nombre: 'Flujo de caja comparativo anual', categoria: 'flujo', descripcion: 'Flujo de caja comparativo entre años.', params: P, columns: [col('concepto', 'Concepto', { width: 220 }), col('anioActual', '2026', { money: true, align: 'right' }), col('anioAnterior', '2025', { money: true, align: 'right' }), col('var', 'Variación', { money: true, align: 'right' })] },
  /* NIC */
  { id: 'nic-apertura', nombre: 'Estado de situación financiera de apertura / convergencia NIC', categoria: 'nic', descripcion: 'Estado de situación financiera de apertura bajo NIC.', params: P, columns: SALDO_COLS },
  { id: 'nic-saldos', nombre: 'Información NIC de saldos y movimientos', categoria: 'nic', descripcion: 'Información NIC/NIIF de saldos y movimientos.', params: P, columns: MOV_COLS },
]
