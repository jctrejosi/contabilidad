/* ============================================================
   CONTABDSI · Datos simulados (capa de servicios)
   Compañía: 001 — Compañía Demo S.A.S. | NIT 900.123.456-7
   Año 2026 · Febrero ABIERTO
   ============================================================ */

import type {
  Account,
  BitacoraEntry,
  Centro,
  ConceptoRetencion,
  DocumentoContable,
  Lote,
  RoleDef,
  TarifaIVA,
  Tercero,
  TipoDocumento,
  User,
  Voucher,
} from '@/core/types'

export const ROLES: RoleDef[] = [
  { key: 'ADMIN', label: 'Administrador', description: 'Acceso total a configuración y administración' },
  { key: 'CONTADOR', label: 'Contador principal', description: 'Aprueba, contabiliza, cierra y consolida' },
  { key: 'AUXILIAR', label: 'Auxiliar contable', description: 'Captura, lotes, importaciones y consultas' },
  { key: 'AUDITOR', label: 'Auditor', description: 'Reprocesos de auditoría y trazabilidad' },
  { key: 'TRIBUTARIO', label: 'Analista tributario', description: 'Retenciones, IVA y medios magnéticos' },
  { key: 'GERENCIA', label: 'Consulta gerencial', description: 'Solo lectura de tableros e informes' },
]

export const USERS: User[] = [
  { id: 'u1', nombre: 'Laura Gómez', role: 'CONTADOR', iniciales: 'LG' },
  { id: 'u2', nombre: 'Carlos Ruiz', role: 'AUXILIAR', iniciales: 'CR' },
  { id: 'u3', nombre: 'Ana Martínez', role: 'ADMIN', iniciales: 'AM' },
  { id: 'u4', nombre: 'Jorge Peña', role: 'AUDITOR', iniciales: 'JP' },
  { id: 'u5', nombre: 'Diana Torres', role: 'TRIBUTARIO', iniciales: 'DT' },
  { id: 'u6', nombre: 'Roberto Silva', role: 'GERENCIA', iniciales: 'RS' },
]

/* ---------------- Plan de cuentas ---------------- */

export const ACCOUNTS: Account[] = [
  { code: '1', nombre: 'ACTIVO', nivel: 1, afectable: false, controlaTercero: false, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 385000000, meses: [382000000, 390000000], hijos: ['11', '13'] },
  { code: '11', nombre: 'DISPONIBLE', nivel: 2, afectable: false, controlaTercero: false, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 95000000, meses: [88000000, 91500000], parent: '1', hijos: ['1105', '1110'] },
  { code: '1105', nombre: 'CAJA', nivel: 4, afectable: true, controlaTercero: false, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 5000000, meses: [4500000, 4200000], parent: '11', hijos: ['110505'] },
  { code: '110505', nombre: 'Caja General', nivel: 6, afectable: true, controlaTercero: false, ajuste: true, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 5000000, meses: [4500000, 4200000], parent: '1105' },
  { code: '1110', nombre: 'BANCOS', nivel: 4, afectable: true, controlaTercero: false, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 90000000, meses: [83500000, 87300000], parent: '11', hijos: ['111005'] },
  { code: '111005', nombre: 'Bancos Nacionales', nivel: 6, afectable: true, controlaTercero: true, ajuste: true, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 90000000, meses: [83500000, 87300000], parent: '1110' },
  { code: '13', nombre: 'DEUDORES', nivel: 2, afectable: false, controlaTercero: false, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 290000000, meses: [294000000, 298500000], parent: '1', hijos: ['1305'] },
  { code: '1305', nombre: 'CLIENTES', nivel: 4, afectable: true, controlaTercero: true, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 290000000, meses: [294000000, 298500000], parent: '13', hijos: ['130505'] },
  { code: '130505', nombre: 'Clientes Nacionales', nivel: 6, afectable: true, controlaTercero: true, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 290000000, meses: [294000000, 298500000], parent: '1305', hijos: ['13050501'] },
  { code: '13050501', nombre: 'Cliente La Montaña', nivel: 9, afectable: true, controlaTercero: true, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'PORCENTAJE', porcentaje: 60, cuentaBase: '510506', saldoInicial: 174000000, meses: [176000000, 179000000], parent: '130505', hijos: ['13050501001'] },
  { code: '13050501001', nombre: 'Cliente La Montaña — Sede Norte', nivel: 12, afectable: true, controlaTercero: true, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 174000000, meses: [176000000, 179000000], parent: '13050501' },
  { code: '2', nombre: 'PASIVO', nivel: 1, afectable: false, controlaTercero: false, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 195000000, meses: [201000000, 206000000], hijos: ['23', '24', '25'] },
  { code: '23', nombre: 'OBLIGACIONES FINANCIERAS', nivel: 2, afectable: false, controlaTercero: false, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 120000000, meses: [125000000, 127000000], parent: '2', hijos: ['2365'] },
  { code: '2365', nombre: 'RETENCIÓN EN LA FUENTE', nivel: 4, afectable: true, controlaTercero: false, ajuste: false, centroCosto: false, clase: 'RETENCION', movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 8000000, meses: [8500000, 9200000], parent: '23', hijos: ['236540'] },
  { code: '236540', nombre: 'Retención por salarios', nivel: 6, afectable: true, controlaTercero: false, ajuste: true, centroCosto: false, clase: 'RETENCION', movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 8000000, meses: [8500000, 9200000], parent: '2365' },
  { code: '24', nombre: 'IMPUESTOS, GRAVÁMENES Y TASAS', nivel: 2, afectable: false, controlaTercero: false, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 15000000, meses: [16000000, 17500000], parent: '2', hijos: ['2408'] },
  { code: '2408', nombre: 'IVA', nivel: 4, afectable: true, controlaTercero: false, ajuste: false, centroCosto: false, clase: 'IVA', movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 15000000, meses: [16000000, 17500000], parent: '24', hijos: ['240805'] },
  { code: '240805', nombre: 'IVA Generado', nivel: 6, afectable: true, controlaTercero: false, ajuste: true, centroCosto: false, clase: 'IVA', movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 15000000, meses: [16000000, 17500000], parent: '2408' },
  { code: '25', nombre: 'OBLIGACIONES LABORALES', nivel: 2, afectable: false, controlaTercero: false, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 60000000, meses: [59500000, 61500000], parent: '2', hijos: ['2505'] },
  { code: '2505', nombre: 'SALARIOS POR PAGAR', nivel: 4, afectable: true, controlaTercero: true, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 60000000, meses: [59500000, 61500000], parent: '25', hijos: ['250505'] },
  { code: '250505', nombre: 'Salarios por pagar', nivel: 6, afectable: true, controlaTercero: true, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 60000000, meses: [59500000, 61500000], parent: '2505' },
  { code: '5', nombre: 'GASTOS', nivel: 1, afectable: false, controlaTercero: false, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 0, meses: [82000000, 96500000], hijos: ['51'] },
  { code: '51', nombre: 'OPERACIONALES DE ADMINISTRACIÓN', nivel: 2, afectable: false, controlaTercero: false, ajuste: false, centroCosto: false, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 0, meses: [82000000, 96500000], parent: '5', hijos: ['5105'] },
  { code: '5105', nombre: 'GASTOS DE PERSONAL', nivel: 4, afectable: true, controlaTercero: false, ajuste: false, centroCosto: true, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 0, meses: [82000000, 96500000], parent: '51', hijos: ['510506'] },
  { code: '510506', nombre: 'Sueldos', nivel: 6, afectable: true, controlaTercero: false, ajuste: false, centroCosto: true, clase: null, movimiento: true, distribucion: 'NINGUNA', porcentaje: 0, saldoInicial: 0, meses: [82000000, 96500000], parent: '5105' },
]

/* ---------------- Terceros ---------------- */

export const TERCEROS: Tercero[] = [
  { zona: 'Z1', nit: '900111222', digito: '3', tipoDoc: 'NIT', nombre: 'EMPLEADOS VARIOS NÓMINA', direccion: 'Cra 10 # 20-30', telefono: '601 555 0101', ciudad: 'BOGOTÁ', nitRelacionado: '', estado: 'ACTIVO', fechaCreacion: '2021-03-15', saldo: 61500000, cupo: 0, sexo: 'J', nacimiento: '', estadoWeb: 'INACTIVO', etiquetas: ['NÓMINA', 'INTERNO'] },
  { zona: 'Z1', nit: '890999888', digito: '1', tipoDoc: 'NIT', nombre: 'CLIENTE LA MONTAÑA LTDA', direccion: 'Av. El Dorado 45-12', telefono: '601 744 2233', ciudad: 'BOGOTÁ', nitRelacionado: '', estado: 'ACTIVO', fechaCreacion: '2020-01-10', saldo: 179000000, cupo: 200000000, sexo: 'J', nacimiento: '', estadoWeb: 'ACTIVO', etiquetas: ['CLIENTE', 'VIP'] },
  { zona: 'Z2', nit: '900333444', digito: '7', tipoDoc: 'NIT', nombre: 'PROVEEDORES DEL VALLE S.A.S.', direccion: 'Calle 12 # 8-45', telefono: '602 321 4455', ciudad: 'CALI', nitRelacionado: '', estado: 'ACTIVO', fechaCreacion: '2019-07-22', saldo: 8700000, cupo: 50000000, sexo: 'J', nacimiento: '', estadoWeb: 'INACTIVO', etiquetas: ['PROVEEDOR'] },
  { zona: 'Z1', nit: '800456789', digito: '5', tipoDoc: 'NIT', nombre: 'SEGUROS ANDINOS S.A.', direccion: 'Cra 7 # 71-21', telefono: '601 313 9000', ciudad: 'BOGOTÁ', nitRelacionado: '', estado: 'ACTIVO', fechaCreacion: '2021-11-02', saldo: 12500000, cupo: 30000000, sexo: 'J', nacimiento: '', estadoWeb: 'INACTIVO', etiquetas: ['SEGUROS'] },
  { zona: 'Z3', nit: '901555666', digito: '2', tipoDoc: 'NIT', nombre: 'DIAN — DIRECCIÓN DE IMPUESTOS', direccion: 'Cra 8 # 6C-38', telefono: '601 307 8066', ciudad: 'BOGOTÁ', nitRelacionado: '830000297', estado: 'ACTIVO', fechaCreacion: '2018-05-30', saldo: 17500000, cupo: 0, sexo: 'J', nacimiento: '', estadoWeb: 'INACTIVO', etiquetas: ['IMPUESTOS'] },
  { zona: 'Z2', nit: '10345567', digito: '9', tipoDoc: 'CC', nombre: 'GÓMEZ PÉREZ MARÍA', direccion: 'Cll 5 # 9-12', telefono: '311 555 7788', ciudad: 'MEDELLÍN', nitRelacionado: '', estado: 'BLOQUEADO', motivoBloqueo: 'Saldo vencido mayor a 90 días', fechaCreacion: '2022-02-14', saldo: 2450000, cupo: 10000000, sexo: 'F', nacimiento: '1988-04-12', estadoWeb: 'ACTIVO', etiquetas: ['MORA'] },
  { zona: 'Z3', nit: '52987654', digito: '1', tipoDoc: 'CC', nombre: 'RODRÍGUEZ SUÁREZ JUAN', direccion: 'Cra 3 # 15-40', telefono: '300 111 2233', ciudad: 'CARTAGENA', nitRelacionado: '', estado: 'ACTIVO', fechaCreacion: '2023-08-19', saldo: 890000, cupo: 5000000, sexo: 'M', nacimiento: '1975-09-23', estadoWeb: 'INACTIVO', etiquetas: [] },
]

/* ---------------- Centros ---------------- */

export const CENTROS: Centro[] = [
  { code: 'ADM', nombre: 'ADMINISTRACIÓN', nivel: 1 },
  { code: 'ADM-GER', nombre: 'Gerencia general', nivel: 2, parent: 'ADM' },
  { code: 'ADM-CON', nombre: 'Contabilidad y finanzas', nivel: 2, parent: 'ADM' },
  { code: 'VEN', nombre: 'VENTAS', nivel: 1 },
  { code: 'VEN-REG1', nombre: 'Regional Andina', nivel: 2, parent: 'VEN' },
  { code: 'OPE', nombre: 'OPERACIONES', nivel: 1 },
]

/* ---------------- Comprobantes y documentos ---------------- */

export const VOUCHERS: Voucher[] = [
  { code: 'RC', nombre: 'Recibo de caja', consecutivo: 128, activo: true, tipoDocumentoDefecto: 'RC' },
  { code: 'CE', nombre: 'Comprobante de egreso', consecutivo: 245, activo: true, tipoDocumentoDefecto: 'CE' },
  { code: 'CP', nombre: 'Comprobante de pago', consecutivo: 92, activo: true, tipoDocumentoDefecto: 'CP' },
  { code: 'NI', nombre: 'Nota interna', consecutivo: 31, activo: true, tipoDocumentoDefecto: 'NI' },
  { code: 'NV', nombre: 'Nota de venta', consecutivo: 56, activo: true, tipoDocumentoDefecto: 'NV' },
]

export const TIPOS_DOCUMENTO: TipoDocumento[] = [
  { code: 'NOM', nombre: 'Nómina', numeracion: 'MANUAL', consecutivo: 2, terceroObligatorio: true, centroObligatorio: true },
  { code: 'CE', nombre: 'Comprobante de egreso', numeracion: 'AUTOMATICA', consecutivo: 245, terceroObligatorio: true, centroObligatorio: false },
  { code: 'FAC', nombre: 'Factura de compra', numeracion: 'MANUAL', consecutivo: 1203, terceroObligatorio: true, centroObligatorio: false },
  { code: 'RC', nombre: 'Recibo de caja', numeracion: 'AUTOMATICA', consecutivo: 128, terceroObligatorio: true, centroObligatorio: false },
  { code: 'AJ', nombre: 'Ajuste contable', numeracion: 'MANUAL', consecutivo: 17, terceroObligatorio: false, centroObligatorio: false },
  { code: 'RE', nombre: 'Reembolso de caja menor', numeracion: 'MANUAL', consecutivo: 9, terceroObligatorio: true, centroObligatorio: true },
]

export const CONCEPTOS_RETENCION: ConceptoRetencion[] = [
  { code: 'R01', nombre: 'Compras generales', tarifa: 2.5, cuenta: '236540', baseMinima: 917000 },
  { code: 'R02', nombre: 'Servicios', tarifa: 4, cuenta: '236540', baseMinima: 917000 },
  { code: 'R03', nombre: 'Honorarios', tarifa: 10, cuenta: '236540', baseMinima: 0 },
  { code: 'R04', nombre: 'Salarios', tarifa: 10, cuenta: '236540', baseMinima: 0 },
  { code: 'R05', nombre: 'Arrendamientos', tarifa: 3.5, cuenta: '236540', baseMinima: 917000 },
]

export const TARIFAS_IVA: TarifaIVA[] = [
  { code: 'IV19', nombre: 'IVA general', tarifa: 19, cuenta: '240805' },
  { code: 'IV05', nombre: 'IVA reducido', tarifa: 5, cuenta: '240805' },
  { code: 'IVE', nombre: 'Excluido', tarifa: 0, cuenta: '240805' },
]

/* ---------------- Líneas base para lotes ---------------- */

export function makeLinea(p: Partial<import('@/core/types').LineaMovimiento> = {}): import('@/core/types').LineaMovimiento {
  return {
    id: `l-${Math.random().toString(36).slice(2, 9)}`,
    cuenta: '',
    nit: '',
    centro: '',
    comprobante: 'CE',
    documento: '',
    fecha: '2026-02-28',
    debito: 0,
    credito: 0,
    base: 0,
    clase: '',
    docAfectado: '',
    concepto: '',
    origen: 'CAPTURA',
    ...p,
  }
}

/* ---------------- Lotes ---------------- */

const L_NOM2: Lote = {
  codigo: 'NOM2',
  nombre: 'Nómina febrero',
  periodo: '202602',
  usuario: 'Carlos Ruiz',
  origen: 'NÓMINA',
  fecha: '2026-02-28',
  estado: 'CON_ERRORES',
  comprobante: 'CE',
  documento: 'NOM-2026-02',
  audit: [
    { id: 'a1', fecha: '2026-02-27T10:15:00', usuario: 'Carlos Ruiz', rol: 'AUXILIAR', accion: 'Creación del lote', detalle: 'Lote NOM2 creado desde Integración de nómina', resultado: 'INFO' },
  ],
  lineas: [
    makeLinea({ cuenta: '510506', centro: 'ADM', comprobante: 'CE', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 12000000, concepto: 'Sueldos febrero — Administración', origen: 'NÓMINA' }),
    makeLinea({ cuenta: '510506', centro: 'VEN', comprobante: 'CE', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 8000000, concepto: 'Sueldos febrero — Ventas', origen: 'NÓMINA' }),
    makeLinea({ cuenta: '510506', centro: 'OPE', comprobante: 'CE', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 5000000, concepto: 'Sueldos febrero — Operaciones', origen: 'NÓMINA' }),
    makeLinea({ cuenta: '510506', centro: 'ADM', comprobante: 'CE', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 5000000, concepto: 'Horas extras — Administración', origen: 'NÓMINA' }),
    makeLinea({ cuenta: '510506', centro: 'VEN', comprobante: 'CE', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 4000000, concepto: 'Comisiones — Ventas', origen: 'NÓMINA' }),
    makeLinea({ cuenta: '510506', centro: 'OPE', comprobante: 'CE', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 3000000, concepto: 'Recargos nocturnos — Operaciones', origen: 'NÓMINA' }),
    makeLinea({ cuenta: '510506', centro: '', comprobante: 'CE', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 8000000, concepto: 'Sueldos febrero — por distribuir', origen: 'NÓMINA' }),
    makeLinea({ cuenta: '236540', nit: '901555666', comprobante: 'CE', documento: 'NOM-2026-02', fecha: '2026-02-28', credito: 2250000, base: 45000000, clase: 'RETENCION', concepto: 'Retención en la fuente por salarios', origen: 'NÓMINA' }),
    makeLinea({ cuenta: '236540', nit: '901555666', comprobante: 'CE', documento: 'NOM-2026-02', fecha: '2026-02-28', credito: 2250000, base: 45000000, clase: 'RETENCION', concepto: 'Retención en la fuente por salarios (2)', origen: 'NÓMINA' }),
    makeLinea({ cuenta: '250505', nit: '900111222', comprobante: 'CE', documento: 'NOM-2026-02', fecha: '2026-02-28', credito: 15000000, concepto: 'Salarios por pagar — quincena 1', origen: 'NÓMINA' }),
    makeLinea({ cuenta: '250505', nit: '', comprobante: 'CE', documento: 'NOM-2026-02', fecha: '2026-02-28', credito: 15000000, concepto: 'Salarios por pagar — quincena 2', origen: 'NÓMINA' }),
    makeLinea({ cuenta: '250505', nit: '900111222', comprobante: 'CE', documento: 'NOM-2026-02', fecha: '2026-02-28', credito: 10500000, concepto: 'Salarios por pagar — prestaciones', origen: 'NÓMINA' }),
  ],
  issues: [
    { id: 'e1', severidad: 'ERROR', ambito: 'LINEA', tipo: 'CENTRO_OBLIGATORIO', mensaje: 'La cuenta 510506 (Sueldos) controla centro de costo. Asigne un centro válido.', lineaId: '', campo: 'centro' },
    { id: 'e2', severidad: 'ERROR', ambito: 'LINEA', tipo: 'TERCERO_OBLIGATORIO', mensaje: 'La cuenta 250505 (Salarios por pagar) controla tercero. Asigne un NIT válido.', lineaId: '', campo: 'nit' },
    { id: 'w1', severidad: 'ADVERTENCIA', ambito: 'LINEA', tipo: 'NIT_INVALIDO', mensaje: 'El tercero 900.111.222 no tiene dirección registrada. Verifique antes de contabilizar.', lineaId: '' },
  ],
}

// Enlazar issues a las líneas correctas (línea 7 -> centro, línea 11 -> tercero)
L_NOM2.issues[0].lineaId = L_NOM2.lineas[6].id
L_NOM2.issues[1].lineaId = L_NOM2.lineas[10].id
L_NOM2.issues[2].lineaId = L_NOM2.lineas[9].id

const L_EGR: Lote = {
  codigo: 'CE2',
  nombre: 'Egresos febrero',
  periodo: '202602',
  usuario: 'Carlos Ruiz',
  origen: 'CAPTURA',
  fecha: '2026-02-15',
  estado: 'CONTABILIZADO',
  comprobante: 'CE',
  documento: 'CE-2026-02-018',
  audit: [
    { id: 'a1', fecha: '2026-02-15T09:00:00', usuario: 'Carlos Ruiz', rol: 'AUXILIAR', accion: 'Creación del lote', detalle: 'Lote CE2 creado desde Captura directa', resultado: 'INFO' },
    { id: 'a2', fecha: '2026-02-15T09:30:00', usuario: 'Laura Gómez', rol: 'CONTADOR', accion: 'Aprobación', detalle: 'Lote aprobado para contabilización', resultado: 'EXITO' },
    { id: 'a3', fecha: '2026-02-15T09:31:00', usuario: 'Laura Gómez', rol: 'CONTADOR', accion: 'Contabilización', detalle: 'Comprobante CE-000244 · Documento CE-2026-02-018', resultado: 'EXITO' },
  ],
  lineas: [
    makeLinea({ cuenta: '510506', centro: 'ADM', comprobante: 'CE', documento: 'CE-2026-02-018', fecha: '2026-02-15', debito: 8500000, concepto: 'Honorarios asesoría contable', origen: 'CAPTURA' }),
    makeLinea({ cuenta: '111005', nit: '900777000', comprobante: 'CE', documento: 'CE-2026-02-018', fecha: '2026-02-15', credito: 8500000, concepto: 'Pago banco', origen: 'CAPTURA' }),
  ],
  issues: [],
}

const L_PROV: Lote = {
  codigo: 'PROV2',
  nombre: 'Provisiones febrero',
  periodo: '202602',
  usuario: 'Carlos Ruiz',
  origen: 'CAPTURA',
  fecha: '2026-02-26',
  estado: 'PENDIENTE_APROBACION',
  comprobante: 'NI',
  documento: 'NI-2026-02-031',
  audit: [
    { id: 'a1', fecha: '2026-02-26T14:00:00', usuario: 'Carlos Ruiz', rol: 'AUXILIAR', accion: 'Verificación', detalle: 'Lote verificado y enviado a aprobación', resultado: 'EXITO' },
  ],
  lineas: [
    makeLinea({ cuenta: '510506', centro: 'ADM', comprobante: 'NI', documento: 'NI-2026-02-031', fecha: '2026-02-26', debito: 3200000, concepto: 'Provisión servicios públicos', origen: 'CAPTURA' }),
    makeLinea({ cuenta: '250505', nit: '900333444', comprobante: 'NI', documento: 'NI-2026-02-031', fecha: '2026-02-26', credito: 3200000, concepto: 'Provisión servicios públicos por pagar', origen: 'CAPTURA' }),
  ],
  issues: [],
}

const L_AJU: Lote = {
  codigo: 'AJU2',
  nombre: 'Ajustes varios febrero',
  periodo: '202602',
  usuario: 'Carlos Ruiz',
  origen: 'IMPORTACIÓN',
  fecha: '2026-02-20',
  estado: 'BORRADOR',
  comprobante: 'AJ',
  documento: 'AJ-2026-02-017',
  audit: [],
  lineas: [
    makeLinea({ cuenta: '510506', centro: 'ADM', comprobante: 'AJ', documento: 'AJ-2026-02-017', fecha: '2026-02-20', debito: 1500000, concepto: 'Ajuste gastos', origen: 'IMPORTACIÓN' }),
    makeLinea({ cuenta: '111005', nit: '900777000', comprobante: 'AJ', documento: 'AJ-2026-02-017', fecha: '2026-02-20', credito: 1200000, concepto: 'Ajuste bancos', origen: 'IMPORTACIÓN' }),
  ],
  issues: [
    { id: 'd1', severidad: 'ERROR', ambito: 'GLOBAL', tipo: 'DESCUADRE', mensaje: 'El lote está descuadrado: Débito $1.500.000 vs Crédito $1.200.000. Diferencia $300.000.' },
  ],
}

export const LOTES_INICIALES: Lote[] = [L_NOM2, L_EGR, L_PROV, L_AJU]

/* ---------------- Documentos contabilizados ---------------- */

export function makeDocumento(p: Partial<DocumentoContable>): DocumentoContable {
  return {
    id: `doc-${Math.random().toString(36).slice(2, 9)}`,
    comprobante: 'CE',
    documento: 'CE-2026-02-001',
    fecha: '2026-02-01',
    periodo: '202602',
    tercero: '',
    nit: '',
    concepto: '',
    estado: 'CONTABILIZADO',
    lineas: [],
    lote: '',
    usuario: 'Laura Gómez',
    ...p,
  }
}

export const DOCUMENTOS_INICIALES: DocumentoContable[] = [
  makeDocumento({
    comprobante: 'RC', documento: 'RC-2026-01-005', fecha: '2026-01-08', periodo: '202601',
    tercero: 'CLIENTE LA MONTAÑA LTDA', nit: '890999888', concepto: 'Abono a cartera — factura FV-1042',
    lote: 'RC1', usuario: 'Laura Gómez',
    lineas: [
      makeLinea({ cuenta: '110505', comprobante: 'RC', documento: 'RC-2026-01-005', fecha: '2026-01-08', debito: 48000000, concepto: 'Recaudo en caja', origen: 'CAPTURA' }),
      makeLinea({ cuenta: '130505', nit: '890999888', comprobante: 'RC', documento: 'RC-2026-01-005', fecha: '2026-01-08', credito: 48000000, concepto: 'Abono cartera cliente', origen: 'CAPTURA' }),
    ],
  }),
  makeDocumento({
    comprobante: 'CE', documento: 'CE-2026-01-014', fecha: '2026-01-15', periodo: '202601',
    tercero: 'PROVEEDORES DEL VALLE S.A.S.', nit: '900333444', concepto: 'Pago factura FVC-2210',
    lote: 'CE1', usuario: 'Laura Gómez',
    lineas: [
      makeLinea({ cuenta: '510506', centro: 'ADM', comprobante: 'CE', documento: 'CE-2026-01-014', fecha: '2026-01-15', debito: 12800000, base: 12800000, clase: 'OTRO', concepto: 'Compra de insumos de oficina', origen: 'CAPTURA' }),
      makeLinea({ cuenta: '240805', comprobante: 'CE', documento: 'CE-2026-01-014', fecha: '2026-01-15', debito: 2432000, base: 12800000, clase: 'IVA', concepto: 'IVA compras 19%', origen: 'CAPTURA' }),
      makeLinea({ cuenta: '236540', nit: '900333444', comprobante: 'CE', documento: 'CE-2026-01-014', fecha: '2026-01-15', credito: 320000, base: 12800000, clase: 'RETENCION', concepto: 'Retefuente compras 2,5%', origen: 'CAPTURA' }),
      makeLinea({ cuenta: '111005', nit: '900777000', comprobante: 'CE', documento: 'CE-2026-01-014', fecha: '2026-01-15', credito: 14912000, concepto: 'Pago neto banco', origen: 'CAPTURA' }),
    ],
  }),
  makeDocumento({
    comprobante: 'CE', documento: 'CE-2026-02-018', fecha: '2026-02-15', periodo: '202602',
    tercero: 'EMPLEADOS VARIOS NÓMINA', nit: '900111222', concepto: 'Honorarios asesoría contable',
    lote: 'CE2', usuario: 'Laura Gómez',
    lineas: L_EGR.lineas,
  }),
]

/* ---------------- Bitácora inicial ---------------- */

export const BITACORA_INICIAL: BitacoraEntry[] = [
  { id: 'b1', fecha: '2026-02-15T09:31:00', usuario: 'Laura Gómez', rol: 'CONTADOR', accion: 'Contabilización de lote', modulo: 'Lotes', detalle: 'Lote CE2 → CE-000244 · CE-2026-02-018 (2 líneas)', resultado: 'EXITO' },
  { id: 'b2', fecha: '2026-02-15T09:30:00', usuario: 'Laura Gómez', rol: 'CONTADOR', accion: 'Aprobación de lote', modulo: 'Lotes', detalle: 'Lote CE2 aprobado', resultado: 'EXITO' },
  { id: 'b3', fecha: '2026-02-27T10:15:00', usuario: 'Carlos Ruiz', rol: 'AUXILIAR', accion: 'Creación de lote', modulo: 'Lotes', detalle: 'Lote NOM2 creado desde Integración de nómina', resultado: 'INFO' },
  { id: 'b4', fecha: '2026-02-27T11:02:00', usuario: 'Diana Torres', rol: 'TRIBUTARIO', accion: 'Actualización de tarifa', modulo: 'Retenciones', detalle: 'Concepto R01 — tarifa modificada (Pendiente de validación funcional)', resultado: 'INFO' },
  { id: 'b5', fecha: '2026-01-31T17:45:00', usuario: 'Laura Gómez', rol: 'CONTADOR', accion: 'Cierre de período', modulo: 'Cierres', detalle: 'Período 202601 cerrado', resultado: 'EXITO' },
  { id: 'b6', fecha: '2026-01-31T18:10:00', usuario: 'Ana Martínez', rol: 'ADMIN', accion: 'Respaldo completo', modulo: 'Reorganización', detalle: 'Respaldo de la compañía 001 antes de cierre', resultado: 'EXITO' },
]
