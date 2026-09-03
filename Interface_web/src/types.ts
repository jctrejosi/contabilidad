export type LoteEstado =
  | 'Borrador'
  | 'Con errores'
  | 'Verificado'
  | 'Pendiente aprobación'
  | 'Aprobado'
  | 'Contabilizando'
  | 'Contabilizado'
  | 'Fallido'
  | 'Anulado';

export type Rol =
  | 'Administrador'
  | 'Contador principal'
  | 'Auxiliar contable'
  | 'Auditor'
  | 'Analista tributario'
  | 'Consulta gerencial';

export interface Empresa {
  codigo: string;
  nombre: string;
  nit: string;
  digito: string;
}

/** Compañía contable seleccionable desde la tabla real CONEMP. */
export interface CompaniaSesion {
  codigo: string;
  nombre: string;
  nit: string;
  habilitada: boolean;
}

export interface Periodo {
  anio: number;
  mes: number;
  nombre: string;
  estado: 'Abierto' | 'Cerrado';
}

export interface UsuarioActual {
  nombre: string;
  rol: Rol;
  email: string;
}

export interface Cuenta {
  codigo: string;
  nombre: string;
  nivel: number;
  afectable: boolean;
  requiereTercero: boolean;
  requiereCentro: boolean;
  requiereBase: boolean;
  ajuste: boolean;
  claseIVA: string | null;
  claseRetencion: string | null;
  saldoInicial: number;
  movimientos: { mes: number; debito: number; credito: number }[];
}

export interface Tercero {
  nit: string;
  digito: string;
  nombre: string;
  tipo: 'Natural' | 'Jurídica';
  tipoDoc: string;
  direccion: string;
  telefono: string;
  ciudad: string;
  estado: 'Activo' | 'Bloqueado';
  motivoBloqueo?: string;
  saldo: number;
  cupo: number;
  fechaCreacion: string;
}

export interface CentroCosto {
  codigo: string;
  nombre: string;
  nivel: number;
}

export interface Comprobante {
  codigo: string;
  nombre: string;
  tipo: string;
  consecutivo: number;
}

export interface LoteLinea {
  id: string;
  cuenta: string;
  nombreCuenta: string;
  nit: string;
  tercero: string;
  centro: string;
  comprobante: string;
  documento: string;
  fecha: string;
  debito: number;
  credito: number;
  base: number;
  clase: string;
  docAfectado: string;
  concepto: string;
  errores: string[];
}

export interface Lote {
  id: string;
  codigo: string;
  nombre: string;
  periodo: string;
  usuario: string;
  origen: string;
  fecha: string;
  lineasCount: number;
  debito: number;
  credito: number;
  diferencia: number;
  erroresCount: number;
  estado: LoteEstado;
  lineas: LoteLinea[];
}

export interface MovimientoLinea {
  id: string;
  periodo: string;
  fecha: string;
  comprobante: string;
  tipoDoc: string;
  documento: string;
  cuenta: string;
  nombreCuenta: string;
  nit: string;
  tercero: string;
  centro: string;
  debito: number;
  credito: number;
  base: number;
  clase: string;
  docAfectado: string;
  concepto: string;
  origen: string;
  lote: string;
}

export interface SaldoCuenta {
  cuenta: string;
  nombre: string;
  nivel: number;
  saldoInicial: number;
  meses: { debito: number; credito: number }[];
}

export interface AlertaContable {
  id: string;
  tipo: 'error' | 'warning' | 'info';
  mensaje: string;
  fecha: string;
  accion?: string;
}

export interface TareasPendientes {
  id: string;
  tipo: string;
  descripcion: string;
  prioridad: 'Alta' | 'Media' | 'Baja';
  fecha: string;
}
