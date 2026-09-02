import { CUENTAS } from './mock';

export interface RenglonRenta {
  codigo: string;
  nombre: string;
  cuenta: string;
  signo: '+' | '-';
}

export type ErroresRenglon = Partial<Record<'codigo' | 'nombre' | 'cuenta' | 'signo', string>>;

export const RENGLONES_RENTA_INICIALES: RenglonRenta[] = [
  { codigo: 'ING', nombre: 'Ingresos brutos del período', cuenta: '130505', signo: '+' },
  { codigo: 'GAS-PER', nombre: 'Gastos de personal', cuenta: '510506', signo: '-' },
  { codigo: 'RET-FTE', nombre: 'Retenciones en la fuente', cuenta: '236540', signo: '-' },
  { codigo: 'IVA-GEN', nombre: 'IVA generado', cuenta: '240805', signo: '-' },
  { codigo: 'DISP-BCO', nombre: 'Disponible en bancos', cuenta: '111005', signo: '+' },
  { codigo: 'DISP-CJA', nombre: 'Disponible en caja', cuenta: '110505', signo: '+' },
];

// Total acumulado (saldo inicial + movimientos del año) de una cuenta del catálogo.
export function totalCuentaRenta(codigoCuenta: string): number {
  const cuenta = CUENTAS.find(c => c.codigo === codigoCuenta);
  if (!cuenta) return 0;
  let total = cuenta.saldoInicial;
  for (const m of cuenta.movimientos) total += m.debito - m.credito;
  return total;
}

export function validarRenglon(form: RenglonRenta, existentes: RenglonRenta[], codigoOriginal?: string): ErroresRenglon {
  const errores: ErroresRenglon = {};
  if (!form.codigo.trim()) {
    errores.codigo = 'Ingrese el código del renglón.';
  } else if (!/^[A-Z0-9-]{2,10}$/.test(form.codigo.trim())) {
    errores.codigo = 'Use de 2 a 10 caracteres entre letras, números y guiones.';
  } else if (existentes.some(r => r.codigo === form.codigo.trim() && r.codigo !== codigoOriginal)) {
    errores.codigo = 'Ya existe un renglón con ese código.';
  }
  if (!form.nombre.trim()) errores.nombre = 'Ingrese el nombre del renglón.';
  if (!form.cuenta.trim()) {
    errores.cuenta = 'Seleccione la cuenta asociada.';
  } else if (!CUENTAS.some(c => c.codigo === form.cuenta)) {
    errores.cuenta = 'La cuenta no existe en el plan de cuentas.';
  }
  if (form.signo !== '+' && form.signo !== '-') errores.signo = 'Seleccione el signo del renglón.';
  return errores;
}

export function esRenglonesGuardados(valor: unknown): valor is RenglonRenta[] {
  return Array.isArray(valor) && valor.every(r => {
    if (!r || typeof r !== 'object') return false;
    const renglon = r as Record<string, unknown>;
    return typeof renglon.codigo === 'string'
      && typeof renglon.nombre === 'string'
      && typeof renglon.cuenta === 'string'
      && (renglon.signo === '+' || renglon.signo === '-');
  });
}
