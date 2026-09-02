// Extiende el catálogo CENTROS del mock con jerarquía (nivel y padre) para la pantalla Centros.
export interface CentroJerarquico {
  codigo: string;
  nombre: string;
  nivel: 1 | 2 | 3;
  padre: string; // Código del centro padre; '' cuando es de nivel 1.
}

export type ErroresCentro = Partial<Record<'codigo' | 'nombre' | 'nivel' | 'padre', string>>;

export const CENTROS_JERARQUICOS_INICIALES: CentroJerarquico[] = [
  { codigo: 'ADM', nombre: 'Administración', nivel: 1, padre: '' },
  { codigo: 'ADM-GER', nombre: 'Gerencia general', nivel: 2, padre: 'ADM' },
  { codigo: 'ADM-CON', nombre: 'Contabilidad', nivel: 2, padre: 'ADM' },
  { codigo: 'ADM-CON-TES', nombre: 'Tesorería', nivel: 3, padre: 'ADM-CON' },
  { codigo: 'VEN', nombre: 'Ventas', nivel: 1, padre: '' },
  { codigo: 'VEN-NAC', nombre: 'Ventas nacionales', nivel: 2, padre: 'VEN' },
  { codigo: 'VEN-INT', nombre: 'Ventas internacionales', nivel: 2, padre: 'VEN' },
  { codigo: 'OPE', nombre: 'Operaciones', nivel: 1, padre: '' },
  { codigo: 'OPE-PLA', nombre: 'Planta de producción', nivel: 2, padre: 'OPE' },
  { codigo: 'OPE-PLA-A', nombre: 'Planta línea A', nivel: 3, padre: 'OPE-PLA' },
];

export function validarCentro(form: CentroJerarquico, existentes: CentroJerarquico[], codigoOriginal?: string): ErroresCentro {
  const errores: ErroresCentro = {};
  if (!form.codigo.trim()) {
    errores.codigo = 'Ingrese el código del centro de costo.';
  } else if (!/^[A-Z0-9-]{2,12}$/.test(form.codigo.trim())) {
    errores.codigo = 'Use de 2 a 12 caracteres entre letras, números y guiones.';
  } else if (existentes.some(c => c.codigo === form.codigo.trim() && c.codigo !== codigoOriginal)) {
    errores.codigo = 'Ya existe un centro con ese código.';
  }
  if (!form.nombre.trim()) errores.nombre = 'Ingrese el nombre del centro de costo.';
  const nivel = Number(form.nivel);
  if (nivel < 1 || nivel > 3) errores.nivel = 'El nivel debe estar entre 1 y 3.';
  if (nivel > 1) {
    if (!form.padre) {
      errores.padre = 'Seleccione el centro padre.';
    } else {
      const padre = existentes.find(c => c.codigo === form.padre);
      if (!padre) errores.padre = 'El centro padre no existe.';
      else if (padre.nivel !== nivel - 1) errores.padre = `El centro padre debe ser de nivel ${nivel - 1}.`;
    }
  }
  if (form.codigo.trim() && form.padre && form.codigo.trim() === form.padre) {
    errores.padre = 'Un centro no puede ser padre de sí mismo.';
  }
  return errores;
}

export function esCentrosGuardados(valor: unknown): valor is CentroJerarquico[] {
  return Array.isArray(valor) && valor.every(c => {
    if (!c || typeof c !== 'object') return false;
    const centro = c as Record<string, unknown>;
    return typeof centro.codigo === 'string'
      && typeof centro.nombre === 'string'
      && (centro.nivel === 1 || centro.nivel === 2 || centro.nivel === 3)
      && typeof centro.padre === 'string';
  });
}

export function centrosHijos(codigo: string, centros: CentroJerarquico[]): CentroJerarquico[] {
  return centros.filter(c => c.padre === codigo);
}
