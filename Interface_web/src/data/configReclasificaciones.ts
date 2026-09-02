import { CUENTAS, MOVIMIENTOS_FEB, PERIODO, USUARIO } from './mock';
import type { Lote, LoteLinea, MovimientoLinea } from '../types';

export interface ResultadoReclasificacion {
  nombre: string;
  descripcion: string;
  documentos: number;
  lineas: LoteLinea[];
}

export function lineaDesdeMovimiento(m: MovimientoLinea, cambios: Partial<Pick<LoteLinea, 'centro' | 'tercero' | 'nit' | 'concepto' | 'docAfectado'>>): LoteLinea {
  return {
    id: m.id,
    cuenta: m.cuenta,
    nombreCuenta: m.nombreCuenta,
    nit: cambios.nit !== undefined ? cambios.nit : m.nit,
    tercero: cambios.tercero !== undefined ? cambios.tercero : m.tercero,
    centro: cambios.centro !== undefined ? cambios.centro : m.centro,
    comprobante: m.comprobante,
    documento: m.documento,
    fecha: m.fecha,
    debito: m.debito,
    credito: m.credito,
    base: m.base,
    clase: m.clase,
    docAfectado: cambios.docAfectado !== undefined ? cambios.docAfectado : m.docAfectado,
    concepto: cambios.concepto !== undefined ? cambios.concepto : m.concepto,
    errores: [],
  };
}

export function cuentasAfectables(): { codigo: string; nombre: string }[] {
  return CUENTAS.filter(c => c.afectable).map(c => ({ codigo: c.codigo, nombre: c.nombre }));
}

export function totalesLineas(lineas: LoteLinea[]): { lineas: number; debito: number; credito: number; diferencia: number } {
  const debito = lineas.reduce((acc, l) => acc + l.debito, 0);
  const credito = lineas.reduce((acc, l) => acc + l.credito, 0);
  return { lineas: lineas.length, debito, credito, diferencia: debito - credito };
}

export function crearLoteReclasificacion(resultado: ResultadoReclasificacion, consecutivo: number): Lote {
  const lineas = resultado.lineas.map((l, i) => ({ ...l, id: `L${String(i + 1).padStart(2, '0')}` }));
  const totales = totalesLineas(lineas);
  return {
    id: `lote-${Date.now()}`,
    codigo: `RCL${String(consecutivo).padStart(2, '0')}`,
    nombre: resultado.nombre,
    periodo: `${PERIODO.anio}-${String(PERIODO.mes).padStart(2, '0')}`,
    usuario: USUARIO.nombre,
    origen: 'Reclasificaciones',
    fecha: '2026-02-28',
    lineasCount: totales.lineas,
    debito: totales.debito,
    credito: totales.credito,
    diferencia: 0,
    erroresCount: 0,
    estado: 'Borrador',
    lineas,
  };
}

export function movimientosPorCentro(origen: string): MovimientoLinea[] {
  return MOVIMIENTOS_FEB.filter(m => m.centro === origen);
}

export function movimientosPorTercero(nit: string): MovimientoLinea[] {
  return MOVIMIENTOS_FEB.filter(m => m.nit === nit);
}

export function movimientosPorDocumento(comprobante: string, documento: string): MovimientoLinea[] {
  return MOVIMIENTOS_FEB.filter(m => m.comprobante === comprobante && m.documento === documento);
}
