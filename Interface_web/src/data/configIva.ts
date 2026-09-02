import { CUENTAS } from './mock';

export interface TarifaIVA {
  tarifa: number; // 0, 5 o 19 (fijas por norma)
  nombre: string;
  cuentaGenerado: string; // pasivo IVA generado (crédito)
  cuentaDescontable: string; // activo IVA descontable (débito)
  activa: boolean;
}

export type ErroresTarifaIVA = Partial<Record<'nombre' | 'cuentaGenerado' | 'cuentaDescontable', string>>;

export const TARIFAS_IVA_INICIALES: TarifaIVA[] = [
  { tarifa: 19, nombre: 'IVA general', cuentaGenerado: '240805', cuentaDescontable: '130505', activa: true },
  { tarifa: 5, nombre: 'IVA reducido', cuentaGenerado: '240805', cuentaDescontable: '130505', activa: true },
  { tarifa: 0, nombre: 'Exento / excluido', cuentaGenerado: '', cuentaDescontable: '', activa: true },
];

export function validarTarifaIVA(form: TarifaIVA): ErroresTarifaIVA {
  const errores: ErroresTarifaIVA = {};
  if (!form.nombre.trim()) errores.nombre = 'Ingrese el nombre de la tarifa.';
  if (form.cuentaGenerado && !CUENTAS.some(c => c.codigo === form.cuentaGenerado)) {
    errores.cuentaGenerado = 'La cuenta no existe en el plan de cuentas.';
  }
  if (form.cuentaDescontable && !CUENTAS.some(c => c.codigo === form.cuentaDescontable)) {
    errores.cuentaDescontable = 'La cuenta no existe en el plan de cuentas.';
  }
  if (form.cuentaGenerado && form.cuentaGenerado === form.cuentaDescontable) {
    errores.cuentaDescontable = 'Las cuentas de IVA generado y descontable deben ser distintas.';
  }
  return errores;
}

export function esTarifasIVAGuardadas(valor: unknown): valor is TarifaIVA[] {
  return Array.isArray(valor) && valor.every(t => {
    if (!t || typeof t !== 'object') return false;
    const tarifa = t as Record<string, unknown>;
    return (tarifa.tarifa === 0 || tarifa.tarifa === 5 || tarifa.tarifa === 19)
      && typeof tarifa.nombre === 'string'
      && typeof tarifa.cuentaGenerado === 'string'
      && typeof tarifa.cuentaDescontable === 'string'
      && typeof tarifa.activa === 'boolean';
  });
}
