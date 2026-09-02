/* ============================================================
   CONTABDSI · Modelo de dominio (tipos compartidos)
   ============================================================ */

export type Role =
  | 'ADMIN'
  | 'CONTADOR'
  | 'AUXILIAR'
  | 'AUDITOR'
  | 'TRIBUTARIO'
  | 'GERENCIA'

export interface RoleDef {
  key: Role
  label: string
  description: string
}

export type Permission =
  | 'mov.capturar'
  | 'mov.lotes'
  | 'mov.lotes.aprobar'
  | 'mov.lotes.contabilizar'
  | 'mov.anular'
  | 'mov.importar'
  | 'mov.nomina'
  | 'mov.reembolsos'
  | 'consulta.ver'
  | 'informes.ver'
  | 'informes.exportar'
  | 'impuestos.retenciones'
  | 'impuestos.iva'
  | 'impuestos.medios'
  | 'reprocesos.auditar'
  | 'reprocesos.corregir'
  | 'cierres.ejecutar'
  | 'consolidacion.ejecutar'
  | 'config.ver'
  | 'config.editar'
  | 'config.especiales'
  | 'config.reclasificaciones'
  | 'admin.usuarios'
  | 'admin.bitacora'
  | 'admin.integraciones'
  | 'admin.reorganizacion'
  | 'presupuesto.ver'

export interface User {
  id: string
  nombre: string
  role: Role
  iniciales: string
}

export interface Company {
  codigo: string
  nombre: string
  nit: string
}

export interface Session {
  user: User
  company: Company
  year: number
  period: number // 1..12
  periodName: string
  periodStatus: 'ABIERTO' | 'CERRADO'
}

/* ---------------- Plan de cuentas ---------------- */

export type ClaseFiscal = 'IVA' | 'RETENCION' | 'OTRO' | null
export type Distribucion = 'NINGUNA' | 'FIJA' | 'PORCENTAJE'

export interface Account {
  code: string
  nit?: string
  nombre: string
  nivel: number
  afectable: boolean
  controlaTercero: boolean
  ajuste: boolean
  centroCosto: boolean
  clase: ClaseFiscal
  movimiento: boolean
  distribucion: Distribucion
  porcentaje: number
  cuentaBase?: string
  saldoInicial: number
  meses: number[] // 12 posiciones, saldos/movimientos por mes
  parent?: string
  hijos?: string[]
}

/* ---------------- Terceros ---------------- */

export interface Tercero {
  zona: string
  nit: string
  digito: string
  tipoDoc: string
  nombre: string
  direccion: string
  telefono: string
  ciudad: string
  nitRelacionado: string
  estado: 'ACTIVO' | 'BLOQUEADO'
  motivoBloqueo?: string
  fechaCreacion: string
  saldo: number
  cupo: number
  sexo: 'M' | 'F' | 'J' | ''
  nacimiento: string
  estadoWeb: 'ACTIVO' | 'INACTIVO'
  etiquetas: string[]
}

/* ---------------- Centros de costo ---------------- */

export interface Centro {
  code: string
  nombre: string
  nivel: number
  parent?: string
}

/* ---------------- Comprobantes ---------------- */

export interface Voucher {
  code: string
  nombre: string
  consecutivo: number
  consecutivoFin?: number
  activo: boolean
  tipoDocumentoDefecto: string
}

export interface TipoDocumento {
  code: string
  nombre: string
  numeracion: 'MANUAL' | 'AUTOMATICA'
  consecutivo: number
  terceroObligatorio: boolean
  centroObligatorio: boolean
}

/* ---------------- Retenciones e IVA ---------------- */

export interface ConceptoRetencion {
  code: string
  nombre: string
  tarifa: number
  cuenta: string
  baseMinima: number
}

export interface TarifaIVA {
  code: string
  nombre: string
  tarifa: number
  cuenta: string
}

/* ---------------- Movimientos ---------------- */

export type ClaseLinea = 'IVA' | 'RETENCION' | 'OTRO' | ''

export interface LineaMovimiento {
  id: string
  cuenta: string
  nit: string
  centro: string
  comprobante: string
  documento: string
  fecha: string
  debito: number
  credito: number
  base: number
  clase: ClaseLinea
  docAfectado: string
  concepto: string
  origen: string
}

export type LoteEstado =
  | 'BORRADOR'
  | 'CON_ERRORES'
  | 'VERIFICADO'
  | 'PENDIENTE_APROBACION'
  | 'APROBADO'
  | 'CONTABILIZANDO'
  | 'CONTABILIZADO'
  | 'FALLIDO'
  | 'ANULADO'

export const LOTE_ESTADOS: Record<LoteEstado, string> = {
  BORRADOR: 'Borrador',
  CON_ERRORES: 'Con errores',
  VERIFICADO: 'Verificado',
  PENDIENTE_APROBACION: 'Pendiente aprobación',
  APROBADO: 'Aprobado',
  CONTABILIZANDO: 'Contabilizando',
  CONTABILIZADO: 'Contabilizado',
  FALLIDO: 'Fallido',
  ANULADO: 'Anulado',
}

export interface ValidationIssue {
  id: string
  severidad: 'ERROR' | 'ADVERTENCIA'
  ambito: 'GLOBAL' | 'DOCUMENTO' | 'COMPROBANTE' | 'LINEA'
  tipo:
    | 'CUENTA_INVALIDA'
    | 'CUENTA_NO_AFECTABLE'
    | 'TERCERO_OBLIGATORIO'
    | 'CENTRO_OBLIGATORIO'
    | 'BASE_OBLIGATORIA'
    | 'PERIODO'
    | 'FECHA'
    | 'DUPLICADO'
    | 'YA_CONTABILIZADO'
    | 'DESCUADRE'
    | 'IMPUESTO_BASE'
    | 'NIT_INVALIDO'
    | 'ORIGEN'
  mensaje: string
  lineaId?: string
  campo?: 'cuenta' | 'nit' | 'tercero' | 'centro' | 'base' | 'fecha' | 'debito' | 'credito' | 'concepto' | 'documento'
}

export interface AuditEvent {
  id: string
  fecha: string
  usuario: string
  rol: Role
  accion: string
  detalle: string
  resultado: 'EXITO' | 'FALLO' | 'INFO'
}

export interface Lote {
  codigo: string
  nombre: string
  periodo: string
  usuario: string
  origen: string
  fecha: string
  lineas: LineaMovimiento[]
  estado: LoteEstado
  issues: ValidationIssue[]
  comprobante?: string
  documento?: string
  audit: AuditEvent[]
  motivo?: string
}

export interface DocumentoContable {
  id: string
  comprobante: string
  documento: string
  fecha: string
  periodo: string
  tercero?: string
  nit?: string
  concepto: string
  estado: 'CONTABILIZADO' | 'ANULADO'
  lineas: LineaMovimiento[]
  lote: string
  usuario: string
  reversoDe?: string
  reversadoPor?: string
}

/* ---------------- Bitácora / auditoría ---------------- */

export interface BitacoraEntry {
  id: string
  fecha: string
  usuario: string
  rol: Role
  accion: string
  modulo: string
  detalle: string
  resultado: 'EXITO' | 'FALLO' | 'INFO'
}

/* ---------------- Procesos ---------------- */

export type ProcessState =
  | 'CONFIGURAR'
  | 'SIMULAR'
  | 'RESPALDO'
  | 'CONFIRMAR'
  | 'EJECUTANDO'
  | 'RESULTADO'

export interface ProcessResult {
  ok: boolean
  resumen: string[]
  diferencias?: { descripcion: string; valor: number }[]
}

/* ---------------- Medios magnéticos ---------------- */

export interface FormatoMedio {
  code: string
  nombre: string
  anual: boolean
  concepto: string
  filas: number
}

/* ---------------- Informes ---------------- */

export type ReportCategory =
  | 'documentos'
  | 'libros'
  | 'estados'
  | 'terceros'
  | 'centros'
  | 'flujo'
  | 'nic'
  | 'generador'

export interface ReportDef {
  id: string
  nombre: string
  categoria: ReportCategory
  descripcion: string
  params: ReportParam[]
  columns: ReportColumn[]
}

export interface ReportParam {
  key: string
  label: string
  tipo: 'periodo' | 'texto' | 'select' | 'checkbox' | 'cuenta' | 'tercero' | 'centro' | 'nivel'
  defaultValue?: string | number | boolean
  options?: string[]
}

export interface ReportColumn {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  money?: boolean
  width?: number
}

/* ---------------- Estado global de la app ---------------- */

export interface AppState {
  session: Session
  role: Role
  sidebarCollapsed: boolean
  density: 'compact' | 'comfortable'
  periodStatus: 'ABIERTO' | 'CERRADO'
  massiveLock: { activo: boolean; proceso: string; usuario: string } | null
  accounts: Account[]
  terceros: Tercero[]
  centros: Centro[]
  vouchers: Voucher[]
  tiposDocumento: TipoDocumento[]
  conceptosRetencion: ConceptoRetencion[]
  tarifasIVA: TarifaIVA[]
  lotes: Lote[]
  documentos: DocumentoContable[]
  bitacora: BitacoraEntry[]
  acumuladosFecha: string
  featureFlags: { presupuesto: boolean }
}
