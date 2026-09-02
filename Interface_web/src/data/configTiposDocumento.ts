export type TipoNumeracion = 'MANUAL' | 'AUTOMATICA';

export interface TipoDocumentoConfig {
  codigo: string;
  nombre: string;
  numeracion: TipoNumeracion;
  consecutivo: number;
  terceroObligatorio: boolean;
  centroObligatorio: boolean;
}

export type ErroresTipoDocumento = Partial<Record<'codigo' | 'nombre' | 'numeracion' | 'consecutivo', string>>;

export const TIPOS_DOCUMENTO_INICIALES: TipoDocumentoConfig[] = [
  { codigo: 'FV', nombre: 'Factura de venta', numeracion: 'AUTOMATICA', consecutivo: 1523, terceroObligatorio: true, centroObligatorio: false },
  { codigo: 'RC', nombre: 'Recibo de caja', numeracion: 'MANUAL', consecutivo: 0, terceroObligatorio: false, centroObligatorio: false },
  { codigo: 'OR', nombre: 'Orden de pago', numeracion: 'MANUAL', consecutivo: 0, terceroObligatorio: true, centroObligatorio: false },
  { codigo: 'NOM', nombre: 'Documento de nómina', numeracion: 'AUTOMATICA', consecutivo: 2, terceroObligatorio: false, centroObligatorio: true },
  { codigo: 'CC', nombre: 'Cuenta de cobro', numeracion: 'MANUAL', consecutivo: 0, terceroObligatorio: true, centroObligatorio: false },
  { codigo: 'CA', nombre: 'Comprobante de ajuste', numeracion: 'AUTOMATICA', consecutivo: 41, terceroObligatorio: false, centroObligatorio: false },
];

export function validarTipoDocumento(form: TipoDocumentoConfig, existentes: TipoDocumentoConfig[], codigoOriginal?: string): ErroresTipoDocumento {
  const errores: ErroresTipoDocumento = {};
  if (!form.codigo.trim()) {
    errores.codigo = 'Ingrese el código del tipo de documento.';
  } else if (!/^[A-Z0-9]{2,3}$/.test(form.codigo.trim())) {
    errores.codigo = 'Use de 2 a 3 letras o números en mayúscula.';
  } else if (existentes.some(t => t.codigo === form.codigo.trim() && t.codigo !== codigoOriginal)) {
    errores.codigo = 'Ya existe un tipo de documento con ese código.';
  }
  if (!form.nombre.trim()) errores.nombre = 'Ingrese el nombre del tipo de documento.';
  if (form.numeracion !== 'MANUAL' && form.numeracion !== 'AUTOMATICA') errores.numeracion = 'Seleccione el tipo de numeración.';
  if (form.numeracion === 'AUTOMATICA' && (!Number.isInteger(form.consecutivo) || form.consecutivo < 0)) {
    errores.consecutivo = 'La numeración automática exige un consecutivo entero mayor o igual a cero.';
  }
  return errores;
}

export function esTiposDocumentoGuardados(valor: unknown): valor is TipoDocumentoConfig[] {
  return Array.isArray(valor) && valor.every(t => {
    if (!t || typeof t !== 'object') return false;
    const tipo = t as Record<string, unknown>;
    return typeof tipo.codigo === 'string'
      && typeof tipo.nombre === 'string'
      && (tipo.numeracion === 'MANUAL' || tipo.numeracion === 'AUTOMATICA')
      && typeof tipo.consecutivo === 'number'
      && typeof tipo.terceroObligatorio === 'boolean'
      && typeof tipo.centroObligatorio === 'boolean';
  });
}
