export interface CompaniaConfig {
  codigo: string;
  nombre: string;
  nit: string;
  estado: 'Activa' | 'Inactiva' | 'En proceso';
  anio: number;
}

export type ErroresCompania = Partial<Record<'codigo' | 'nombre' | 'nit' | 'anio', string>>;

export const COMPANIAS_INICIALES: CompaniaConfig[] = [
  { codigo: '001', nombre: 'Compañía Demo S.A.S.', nit: '900.123.456-7', estado: 'Activa', anio: 2026 },
  { codigo: '002', nombre: 'Inversiones Beta Ltda.', nit: '800.200.300-1', estado: 'Inactiva', anio: 2026 },
  { codigo: '003', nombre: 'Comercial Gamma S.A.', nit: '830.400.500-2', estado: 'Activa', anio: 2025 },
  { codigo: '004', nombre: 'Servicios Delta S.A.S.', nit: '901.600.700-3', estado: 'En proceso', anio: 2026 },
];

export const TABLAS_AFECTADAS_LIMPIAR = [
  'CONCTR — Tabla de control y parámetros',
  'CONPLA — Plan de cuentas y saldos',
  'CONTER — Terceros y saldos',
  'CONCEN — Centros de costo',
  'CONCOMP — Comprobantes contabilizados',
  'CONMOV — Movimientos del año y acumulados',
  'CONRET — Acumulados de retención en la fuente',
  'CONIVA — Acumulados de IVA',
] as const;

export function validarCompania(form: CompaniaConfig, existentes: CompaniaConfig[], codigoOriginal?: string): ErroresCompania {
  const errores: ErroresCompania = {};
  if (!form.codigo.trim()) {
    errores.codigo = 'Ingrese el código de la compañía.';
  } else if (!/^\d{3}$/.test(form.codigo.trim())) {
    errores.codigo = 'El código debe tener exactamente 3 dígitos.';
  } else if (existentes.some(c => c.codigo === form.codigo.trim() && c.codigo !== codigoOriginal)) {
    errores.codigo = 'Ya existe una compañía con ese código.';
  }
  if (!form.nombre.trim()) errores.nombre = 'Ingrese el nombre de la compañía.';
  if (!form.nit.trim()) {
    errores.nit = 'Ingrese el NIT de la compañía.';
  } else if (!/^\d{3}\.\d{3}\.\d{3}-\d$/.test(form.nit.trim())) {
    errores.nit = 'El NIT debe tener el formato 999.999.999-9.';
  }
  if (!Number.isInteger(form.anio) || form.anio < 2000 || form.anio > 2100) {
    errores.anio = 'Ingrese un año entre 2000 y 2100.';
  }
  return errores;
}

export function esCompaniasGuardadas(valor: unknown): valor is CompaniaConfig[] {
  return Array.isArray(valor) && valor.every(c => {
    if (!c || typeof c !== 'object') return false;
    const compania = c as Record<string, unknown>;
    return typeof compania.codigo === 'string'
      && typeof compania.nombre === 'string'
      && typeof compania.nit === 'string'
      && (compania.estado === 'Activa' || compania.estado === 'Inactiva' || compania.estado === 'En proceso')
      && typeof compania.anio === 'number';
  });
}
