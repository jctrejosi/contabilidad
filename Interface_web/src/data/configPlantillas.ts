import { CUENTAS, PERIODO, USUARIO } from './mock';
import type { Lote, LoteLinea } from '../types';

export interface LineaPlantilla {
  id: string;
  cuenta: string;
  debito: number;
  credito: number;
  concepto: string;
}

export interface PlantillaContable {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  lineas: LineaPlantilla[];
}

export type ErroresPlantilla = Partial<Record<'codigo' | 'nombre' | 'lineas', string>>;

export const PLANTILLAS_INICIALES: PlantillaContable[] = [
  {
    id: 'plt-nom',
    codigo: 'NOM-MES',
    nombre: 'Nómina mensual',
    descripcion: 'Causación de nómina del mes con prestaciones, aportes y retención.',
    lineas: [
      { id: 'L01', cuenta: '510506', debito: 4500000, credito: 0, concepto: 'Sueldo Administración' },
      { id: 'L02', cuenta: '510506', debito: 3200000, credito: 0, concepto: 'Sueldo Ventas' },
      { id: 'L03', cuenta: '510506', debito: 2300000, credito: 0, concepto: 'Sueldo Operaciones' },
      { id: 'L04', cuenta: '510506', debito: 800000, credito: 0, concepto: 'Prestaciones ADM' },
      { id: 'L05', cuenta: '510506', debito: 600000, credito: 0, concepto: 'Prestaciones OPE' },
      { id: 'L06', cuenta: '510506', debito: 1200000, credito: 0, concepto: 'Aportes seguridad social' },
      { id: 'L07', cuenta: '250505', debito: 0, credito: 4500000, concepto: 'Salarios por pagar ADM' },
      { id: 'L08', cuenta: '250505', debito: 0, credito: 3200000, concepto: 'Salarios por pagar VEN' },
      { id: 'L09', cuenta: '250505', debito: 0, credito: 2300000, concepto: 'Salarios por pagar OPE' },
      { id: 'L10', cuenta: '250505', debito: 0, credito: 800000, concepto: 'Prestaciones por pagar ADM' },
      { id: 'L11', cuenta: '250505', debito: 0, credito: 600000, concepto: 'Prestaciones por pagar OPE' },
      { id: 'L12', cuenta: '236540', debito: 0, credito: 1200000, concepto: 'Retención nómina del mes' },
    ],
  },
  {
    id: 'plt-pago',
    codigo: 'PAGO-IMP',
    nombre: 'Pago de impuestos',
    descripcion: 'Pago de IVA y retenciones del período con egreso de bancos.',
    lineas: [
      { id: 'L01', cuenta: '240805', debito: 2850000, credito: 0, concepto: 'Pago IVA del período' },
      { id: 'L02', cuenta: '236540', debito: 1100000, credito: 0, concepto: 'Pago retención en la fuente' },
      { id: 'L03', cuenta: '111005', debito: 0, credito: 3950000, concepto: 'Egreso por bancos' },
    ],
  },
  {
    id: 'plt-caja',
    codigo: 'CAJA-MENOR',
    nombre: 'Reembolso caja menor',
    descripcion: 'Reembolso de gastos menores de administración.',
    lineas: [
      { id: 'L01', cuenta: '510506', debito: 150000, credito: 0, concepto: 'Gastos menores administración' },
      { id: 'L02', cuenta: '110505', debito: 0, credito: 150000, concepto: 'Salida de caja general' },
    ],
  },
];

export function totalesPlantilla(plantilla: Pick<PlantillaContable, 'lineas'>): { lineas: number; debito: number; credito: number; diferencia: number } {
  const debito = plantilla.lineas.reduce((acc, l) => acc + (l.debito || 0), 0);
  const credito = plantilla.lineas.reduce((acc, l) => acc + (l.credito || 0), 0);
  return { lineas: plantilla.lineas.length, debito, credito, diferencia: debito - credito };
}

export function validarPlantilla(form: PlantillaContable, existentes: PlantillaContable[], idOriginal?: string): ErroresPlantilla {
  const errores: ErroresPlantilla = {};
  if (!form.codigo.trim()) {
    errores.codigo = 'Ingrese el código de la plantilla.';
  } else if (!/^[A-Z0-9-]{2,12}$/.test(form.codigo.trim())) {
    errores.codigo = 'Use de 2 a 12 caracteres entre letras, números y guiones.';
  } else if (existentes.some(p => p.codigo === form.codigo.trim() && p.id !== idOriginal)) {
    errores.codigo = 'Ya existe una plantilla con ese código.';
  }
  if (!form.nombre.trim()) errores.nombre = 'Ingrese el nombre de la plantilla.';
  if (form.lineas.length < 2) {
    errores.lineas = 'La plantilla debe tener al menos dos líneas.';
  } else {
    const sinValor = form.lineas.filter(l => !(l.debito > 0) && !(l.credito > 0));
    const ambas = form.lineas.filter(l => l.debito > 0 && l.credito > 0);
    const malasCuentas = form.lineas.filter(l => {
      const cuenta = CUENTAS.find(c => c.codigo === l.cuenta);
      return !cuenta || !cuenta.afectable;
    });
    if (sinValor.length) errores.lineas = 'Todas las líneas deben tener débito o crédito.';
    else if (ambas.length) errores.lineas = 'Una línea no puede tener débito y crédito a la vez; separe el registro.';
    else if (malasCuentas.length) errores.lineas = 'Hay líneas con cuentas inexistentes o no afectables.';
    else if (totalesPlantilla(form).diferencia !== 0) errores.lineas = 'La plantilla está descuadrada: el débito debe ser igual al crédito para poder usarla.';
  }
  return errores;
}

export function esPlantillasGuardadas(valor: unknown): valor is PlantillaContable[] {
  return Array.isArray(valor) && valor.every(p => {
    if (!p || typeof p !== 'object') return false;
    const plantilla = p as Record<string, unknown>;
    return typeof plantilla.id === 'string'
      && typeof plantilla.codigo === 'string'
      && typeof plantilla.nombre === 'string'
      && typeof plantilla.descripcion === 'string'
      && Array.isArray(plantilla.lineas)
      && (plantilla.lineas as unknown[]).every(l => {
        if (!l || typeof l !== 'object') return false;
        const linea = l as Record<string, unknown>;
        return typeof linea.id === 'string'
          && typeof linea.cuenta === 'string'
          && typeof linea.debito === 'number'
          && typeof linea.credito === 'number'
          && typeof linea.concepto === 'string';
      });
  });
}

// Convierte una plantilla en un Lote Borrador cuadrado (débito = crédito), listo para onCrearLote.
export function crearLoteDePlantilla(plantilla: PlantillaContable, consecutivo: number): Lote {
  const fecha = '2026-02-28';
  const lineas: LoteLinea[] = plantilla.lineas
    .filter(l => l.debito > 0 || l.credito > 0)
    .map((l, i) => {
      const cuenta = CUENTAS.find(c => c.codigo === l.cuenta);
      return {
        id: `L${String(i + 1).padStart(2, '0')}`,
        cuenta: l.cuenta,
        nombreCuenta: cuenta ? cuenta.nombre : l.cuenta,
        nit: '',
        tercero: '',
        centro: '',
        comprobante: 'NO',
        documento: `PLT-2026-${String(consecutivo).padStart(2, '0')}`,
        fecha,
        debito: l.debito,
        credito: l.credito,
        base: 0,
        clase: '',
        docAfectado: '',
        concepto: l.concepto,
        errores: [],
      };
    });
  const debito = lineas.reduce((acc, l) => acc + l.debito, 0);
  const credito = lineas.reduce((acc, l) => acc + l.credito, 0);
  return {
    id: `lote-${Date.now()}`,
    codigo: `PLT${String(consecutivo).padStart(2, '0')}`,
    nombre: plantilla.nombre,
    periodo: `${PERIODO.anio}-${String(PERIODO.mes).padStart(2, '0')}`,
    usuario: USUARIO.nombre,
    origen: 'Plantillas',
    fecha,
    lineasCount: lineas.length,
    debito,
    credito,
    diferencia: 0,
    erroresCount: 0,
    estado: 'Borrador',
    lineas,
  };
}
