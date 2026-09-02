import type { Comprobante } from '../types';

export type ErroresComprobante = Partial<Record<keyof Comprobante, string>>;

export const TIPOS_COMPROBANTE = [
  { valor: 'E', nombre: 'Egreso' },
  { valor: 'I', nombre: 'Ingreso' },
  { valor: 'N', nombre: 'Nota de contabilidad' },
] as const;

export function validarComprobante(form: Comprobante, existentes: Comprobante[], codigoOriginal?: string): ErroresComprobante {
  const errores: ErroresComprobante = {};
  if (!form.codigo.trim()) {
    errores.codigo = 'Ingrese el código del comprobante.';
  } else if (!/^[A-Z0-9]{2,4}$/.test(form.codigo.trim())) {
    errores.codigo = 'Use de 2 a 4 letras o números, sin espacios.';
  } else if (existentes.some(c => c.codigo === form.codigo.trim() && c.codigo !== codigoOriginal)) {
    errores.codigo = 'Ya existe un comprobante con ese código.';
  }
  if (!form.nombre.trim()) errores.nombre = 'Ingrese el nombre del comprobante.';
  if (!form.tipo.trim()) errores.tipo = 'Seleccione el tipo de comprobante.';
  if (!Number.isInteger(form.consecutivo) || form.consecutivo < 0) errores.consecutivo = 'El consecutivo debe ser un entero mayor o igual a cero.';
  return errores;
}

export function esComprobantesGuardados(valor: unknown): valor is Comprobante[] {
  return Array.isArray(valor) && valor.every(c =>
    !!c && typeof c === 'object'
    && typeof (c as Comprobante).codigo === 'string'
    && typeof (c as Comprobante).nombre === 'string'
    && typeof (c as Comprobante).tipo === 'string'
    && typeof (c as Comprobante).consecutivo === 'number');
}
