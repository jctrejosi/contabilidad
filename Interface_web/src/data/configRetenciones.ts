import { CUENTAS } from './mock';

export interface ConceptoRetencion {
  codigo: string;
  nombre: string;
  tarifa: number; // porcentaje
  baseMinima: number;
  cuentaDebito: string; // cuenta de gasto/débito
  cuentaCredito: string; // cuenta de pasivo/retención
  activo: boolean;
}

export type ErroresRetencion = Partial<Record<'codigo' | 'nombre' | 'tarifa' | 'cuentaDebito' | 'cuentaCredito', string>>;

export const RETENCIONES_INICIALES: ConceptoRetencion[] = [
  { codigo: 'RETFTE', nombre: 'Retención en la fuente por salarios', tarifa: 10, baseMinima: 0, cuentaDebito: '510506', cuentaCredito: '236540', activo: true },
  { codigo: 'RETIVA', nombre: 'Retención de IVA', tarifa: 15, baseMinima: 1200000, cuentaDebito: '240805', cuentaCredito: '236540', activo: true },
  { codigo: 'RETICA', nombre: 'Retención de ICA', tarifa: 6.9, baseMinima: 0, cuentaDebito: '510506', cuentaCredito: '236540', activo: false },
  { codigo: 'RETHON', nombre: 'Honorarios y servicios', tarifa: 11, baseMinima: 0, cuentaDebito: '510506', cuentaCredito: '236540', activo: true },
  { codigo: 'RETARR', nombre: 'Arrendamientos', tarifa: 3.5, baseMinima: 0, cuentaDebito: '510506', cuentaCredito: '236540', activo: true },
  { codigo: 'RETCREE', nombre: 'Rete-cre', tarifa: 0.6, baseMinima: 0, cuentaDebito: '510506', cuentaCredito: '236540', activo: false },
];

export function validarRetencion(form: ConceptoRetencion, existentes: ConceptoRetencion[], codigoOriginal?: string): ErroresRetencion {
  const errores: ErroresRetencion = {};
  if (!form.codigo.trim()) {
    errores.codigo = 'Ingrese el código del concepto.';
  } else if (!/^[A-Z0-9-]{3,10}$/.test(form.codigo.trim())) {
    errores.codigo = 'Use de 3 a 10 caracteres entre letras, números y guiones.';
  } else if (existentes.some(c => c.codigo === form.codigo.trim() && c.codigo !== codigoOriginal)) {
    errores.codigo = 'Ya existe un concepto con ese código.';
  }
  if (!form.nombre.trim()) errores.nombre = 'Ingrese el nombre del concepto.';
  if (!(form.tarifa > 0) || form.tarifa > 35) errores.tarifa = 'La tarifa debe estar entre 0,1% y 35%.';
  if (!form.cuentaDebito.trim()) {
    errores.cuentaDebito = 'Seleccione la cuenta de débito.';
  } else if (!CUENTAS.some(c => c.codigo === form.cuentaDebito)) {
    errores.cuentaDebito = 'La cuenta no existe en el plan de cuentas.';
  }
  if (!form.cuentaCredito.trim()) {
    errores.cuentaCredito = 'Seleccione la cuenta de retención (crédito).';
  } else if (!CUENTAS.some(c => c.codigo === form.cuentaCredito)) {
    errores.cuentaCredito = 'La cuenta no existe en el plan de cuentas.';
  }
  if (form.cuentaDebito && form.cuentaDebito === form.cuentaCredito) {
    errores.cuentaCredito = 'Las cuentas de débito y crédito deben ser distintas.';
  }
  return errores;
}

export function esRetencionesGuardadas(valor: unknown): valor is ConceptoRetencion[] {
  return Array.isArray(valor) && valor.every(c => {
    if (!c || typeof c !== 'object') return false;
    const concepto = c as Record<string, unknown>;
    return typeof concepto.codigo === 'string'
      && typeof concepto.nombre === 'string'
      && typeof concepto.tarifa === 'number'
      && typeof concepto.baseMinima === 'number'
      && typeof concepto.cuentaDebito === 'string'
      && typeof concepto.cuentaCredito === 'string'
      && typeof concepto.activo === 'boolean';
  });
}
