import type {
  Empresa, Periodo, UsuarioActual, Cuenta, Tercero,
  CentroCosto, Comprobante, Lote, LoteLinea, MovimientoLinea,
  SaldoCuenta, AlertaContable
} from '../types';

export const EMPRESA: Empresa = {
  codigo: '001',
  nombre: 'Compañía Demo S.A.S.',
  nit: '900.123.456',
  digito: '7',
};

export const PERIODO: Periodo = {
  anio: 2026,
  mes: 2,
  nombre: 'Febrero 2026',
  estado: 'Abierto',
};

export const USUARIO: UsuarioActual = {
  nombre: 'Laura Gómez',
  rol: 'Contador principal',
  email: 'laura.gomez@compania.com',
};

export const CENTROS: CentroCosto[] = [
  { codigo: 'ADM', nombre: 'Administración', nivel: 1 },
  { codigo: 'VEN', nombre: 'Ventas', nivel: 1 },
  { codigo: 'OPE', nombre: 'Operaciones', nivel: 1 },
];

export const COMPROBANTES: Comprobante[] = [
  { codigo: 'CE', nombre: 'Comprobante de Egreso', tipo: 'E', consecutivo: 246 },
  { codigo: 'CI', nombre: 'Comprobante de Ingreso', tipo: 'I', consecutivo: 145 },
  { codigo: 'NO', nombre: 'Nota de Contabilidad', tipo: 'N', consecutivo: 89 },
  { codigo: 'NOM', nombre: 'Nómina', tipo: 'N', consecutivo: 12 },
  { codigo: 'DP', nombre: 'Depreciaciones', tipo: 'N', consecutivo: 3 },
];

export const CUENTAS: Cuenta[] = [
  { codigo: '1', nombre: 'ACTIVO', nivel: 1, afectable: false, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 0, movimientos: [] },
  { codigo: '11', nombre: 'DISPONIBLE', nivel: 2, afectable: false, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 0, movimientos: [] },
  { codigo: '1105', nombre: 'CAJA', nivel: 3, afectable: false, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 0, movimientos: [] },
  { codigo: '110505', nombre: 'Caja general', nivel: 4, afectable: true, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 5200000, movimientos: [{ mes: 1, debito: 3500000, credito: 2100000 }, { mes: 2, debito: 1800000, credito: 900000 }] },
  { codigo: '1110', nombre: 'BANCOS', nivel: 3, afectable: false, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 0, movimientos: [] },
  { codigo: '111005', nombre: 'Bancos moneda nacional', nivel: 4, afectable: true, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 48500000, movimientos: [{ mes: 1, debito: 12000000, credito: 9800000 }, { mes: 2, debito: 8500000, credito: 12600000 }] },
  { codigo: '13', nombre: 'DEUDORES', nivel: 2, afectable: false, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 0, movimientos: [] },
  { codigo: '1305', nombre: 'CLIENTES', nivel: 3, afectable: false, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 0, movimientos: [] },
  { codigo: '130505', nombre: 'Clientes nacionales', nivel: 4, afectable: true, requiereTercero: true, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 22400000, movimientos: [{ mes: 1, debito: 15000000, credito: 8000000 }, { mes: 2, debito: 9500000, credito: 6200000 }] },
  { codigo: '2', nombre: 'PASIVO', nivel: 1, afectable: false, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 0, movimientos: [] },
  { codigo: '23', nombre: 'CUENTAS POR PAGAR', nivel: 2, afectable: false, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 0, movimientos: [] },
  { codigo: '2365', nombre: 'RETENCIONES EN LA FUENTE', nivel: 3, afectable: false, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 0, movimientos: [] },
  { codigo: '236540', nombre: 'Retenciones y aportes de nómina', nivel: 4, afectable: true, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: 'RETFTE', saldoInicial: 0, movimientos: [{ mes: 1, debito: 200000, credito: 1100000 }, { mes: 2, debito: 0, credito: 0 }] },
  { codigo: '2408', nombre: 'IVA PASIVO', nivel: 3, afectable: false, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 0, movimientos: [] },
  { codigo: '240805', nombre: 'IVA por pagar', nivel: 4, afectable: true, requiereTercero: false, requiereCentro: false, requiereBase: true, ajuste: false, claseIVA: 'IVA19', claseRetencion: null, saldoInicial: 0, movimientos: [{ mes: 1, debito: 300000, credito: 2850000 }, { mes: 2, debito: 0, credito: 0 }] },
  { codigo: '2505', nombre: 'SALARIOS Y PRESTACIONES SOCIALES', nivel: 3, afectable: false, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 0, movimientos: [] },
  { codigo: '250505', nombre: 'Salarios por pagar', nivel: 4, afectable: true, requiereTercero: true, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 0, movimientos: [{ mes: 1, debito: 10200000, credito: 11400000 }, { mes: 2, debito: 0, credito: 0 }] },
  { codigo: '5', nombre: 'GASTOS', nivel: 1, afectable: false, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 0, movimientos: [] },
  { codigo: '51', nombre: 'GASTOS OPERACIONALES DE ADMINISTRACIÓN', nivel: 2, afectable: false, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 0, movimientos: [] },
  { codigo: '5105', nombre: 'PERSONAL', nivel: 3, afectable: false, requiereTercero: false, requiereCentro: false, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 0, movimientos: [] },
  { codigo: '510506', nombre: 'Sueldos y salarios', nivel: 4, afectable: true, requiereTercero: true, requiereCentro: true, requiereBase: false, ajuste: false, claseIVA: null, claseRetencion: null, saldoInicial: 0, movimientos: [{ mes: 1, debito: 11400000, credito: 0 }, { mes: 2, debito: 0, credito: 0 }] },
];

export const TERCEROS: Tercero[] = [
  { nit: '12.345.678', digito: '0', nombre: 'García Moreno Juan Pablo', tipo: 'Natural', tipoDoc: 'CC', direccion: 'Cra 15 # 82-25', telefono: '3001234567', ciudad: 'Bogotá D.C.', estado: 'Activo', saldo: -4500000, cupo: 20000000, fechaCreacion: '2022-03-15' },
  { nit: '23.456.789', digito: '0', nombre: 'López Vargas María Fernanda', tipo: 'Natural', tipoDoc: 'CC', direccion: 'Cl 45 # 20-10', telefono: '3109876543', ciudad: 'Bogotá D.C.', estado: 'Activo', saldo: -3200000, cupo: 15000000, fechaCreacion: '2021-07-22' },
  { nit: '34.567.890', digito: '0', nombre: 'Martínez Rojas Ana Lucía', tipo: 'Natural', tipoDoc: 'CC', direccion: 'Av El Dorado # 92-32', telefono: '3207654321', ciudad: 'Bogotá D.C.', estado: 'Activo', saldo: -2300000, cupo: 12000000, fechaCreacion: '2023-01-10' },
  { nit: '800.100.200', digito: '3', nombre: 'Empresa ABC Comercial S.A.S.', tipo: 'Jurídica', tipoDoc: 'NIT', direccion: 'Cl 72 # 10-34 Of 502', telefono: '6014567890', ciudad: 'Bogotá D.C.', estado: 'Activo', saldo: 15400000, cupo: 100000000, fechaCreacion: '2019-04-01' },
  { nit: '900.200.300', digito: '4', nombre: 'Comercial XYZ Distribuciones Ltda.', tipo: 'Jurídica', tipoDoc: 'NIT', direccion: 'Av Américas # 53-45', telefono: '6013456789', ciudad: 'Bogotá D.C.', estado: 'Activo', saldo: 9800000, cupo: 50000000, fechaCreacion: '2020-11-15' },
  { nit: '860.050.010', digito: '9', nombre: 'Suministros Técnicos del Norte Ltda.', tipo: 'Jurídica', tipoDoc: 'NIT', direccion: 'Cl 100 # 15-20', telefono: '6012345678', ciudad: 'Bogotá D.C.', estado: 'Bloqueado', motivoBloqueo: 'Cartera vencida superior a 90 días', saldo: -5200000, cupo: 0, fechaCreacion: '2018-06-30' },
];

function makeLoteLinesNOM2(): LoteLinea[] {
  return [
    { id: 'L01', cuenta: '510506', nombreCuenta: 'Sueldos y salarios', nit: '', tercero: '', centro: 'ADM', comprobante: 'CE-000245', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 4500000, credito: 0, base: 0, clase: '', docAfectado: '', concepto: 'Sueldo febrero Administración', errores: ['Cuenta requiere tercero (NIT)'] },
    { id: 'L02', cuenta: '510506', nombreCuenta: 'Sueldos y salarios', nit: '23.456.789', tercero: 'López Vargas María Fernanda', centro: 'VEN', comprobante: 'CE-000245', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 3200000, credito: 0, base: 0, clase: '', docAfectado: '', concepto: 'Sueldo febrero Ventas', errores: [] },
    { id: 'L03', cuenta: '510506', nombreCuenta: 'Sueldos y salarios', nit: '34.567.890', tercero: 'Martínez Rojas Ana Lucía', centro: '', comprobante: 'CE-000245', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 2300000, credito: 0, base: 0, clase: '', docAfectado: '', concepto: 'Sueldo febrero Operaciones', errores: ['Cuenta requiere centro de costo'] },
    { id: 'L04', cuenta: '510506', nombreCuenta: 'Sueldos y salarios', nit: '12.345.678', tercero: 'García Moreno Juan Pablo', centro: 'ADM', comprobante: 'CE-000245', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 800000, credito: 0, base: 0, clase: '', docAfectado: '', concepto: 'Prestaciones febrero ADM', errores: [] },
    { id: 'L05', cuenta: '510506', nombreCuenta: 'Sueldos y salarios', nit: '34.567.890', tercero: 'Martínez Rojas Ana Lucía', centro: 'OPE', comprobante: 'CE-000245', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 600000, credito: 0, base: 0, clase: '', docAfectado: '', concepto: 'Prestaciones febrero OPE', errores: [] },
    { id: 'L06', cuenta: '510506', nombreCuenta: 'Sueldos y salarios', nit: '12.345.678', tercero: 'García Moreno Juan Pablo', centro: 'ADM', comprobante: 'CE-000245', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 1200000, credito: 0, base: 0, clase: '', docAfectado: '', concepto: 'Aportes seguridad social feb', errores: [] },
    { id: 'L07', cuenta: '250505', nombreCuenta: 'Salarios por pagar', nit: '12.345.678', tercero: 'García Moreno Juan Pablo', centro: 'ADM', comprobante: 'CE-000245', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 0, credito: 4500000, base: 0, clase: '', docAfectado: '', concepto: 'Obligación nómina feb ADM', errores: [] },
    { id: 'L08', cuenta: '250505', nombreCuenta: 'Salarios por pagar', nit: '23.456.789', tercero: 'López Vargas María Fernanda', centro: 'VEN', comprobante: 'CE-000245', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 0, credito: 3200000, base: 0, clase: '', docAfectado: '', concepto: 'Obligación nómina feb VEN', errores: [] },
    { id: 'L09', cuenta: '250505', nombreCuenta: 'Salarios por pagar', nit: '34.567.890', tercero: 'Martínez Rojas Ana Lucía', centro: 'OPE', comprobante: 'CE-000245', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 0, credito: 2300000, base: 0, clase: '', docAfectado: '', concepto: 'Obligación nómina feb OPE', errores: [] },
    { id: 'L10', cuenta: '250505', nombreCuenta: 'Salarios por pagar', nit: '12.345.678', tercero: 'García Moreno Juan Pablo', centro: 'ADM', comprobante: 'CE-000245', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 0, credito: 800000, base: 0, clase: '', docAfectado: '', concepto: 'Prestaciones por pagar feb', errores: [] },
    { id: 'L11', cuenta: '250505', nombreCuenta: 'Salarios por pagar', nit: '34.567.890', tercero: 'Martínez Rojas Ana Lucía', centro: 'OPE', comprobante: 'CE-000245', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 0, credito: 600000, base: 0, clase: '', docAfectado: '', concepto: 'Prestaciones por pagar feb', errores: [] },
    { id: 'L12', cuenta: '236540', nombreCuenta: 'Retenciones y aportes de nómina', nit: '', tercero: '', centro: '', comprobante: 'CE-000245', documento: 'NOM-2026-02', fecha: '2026-02-28', debito: 0, credito: 1200000, base: 0, clase: 'RETFTE', docAfectado: '', concepto: 'Retención nómina febrero', errores: [] },
  ];
}

export const LOTES_INICIALES: Lote[] = [
  {
    id: 'nom2',
    codigo: 'NOM2',
    nombre: 'Nómina febrero 2026',
    periodo: '2026-02',
    usuario: 'Laura Gómez',
    origen: 'Manual',
    fecha: '2026-02-28',
    lineasCount: 12,
    debito: 12600000,
    credito: 12600000,
    diferencia: 0,
    erroresCount: 2,
    estado: 'Con errores',
    lineas: makeLoteLinesNOM2(),
  },
  {
    id: 'ce001',
    codigo: 'CE-001',
    nombre: 'Comprobante egresos enero',
    periodo: '2026-01',
    usuario: 'Laura Gómez',
    origen: 'Manual',
    fecha: '2026-01-31',
    lineasCount: 6,
    debito: 4850000,
    credito: 4850000,
    diferencia: 0,
    erroresCount: 0,
    estado: 'Contabilizado',
    lineas: [],
  },
  {
    id: 'imp01',
    codigo: 'IMP-01',
    nombre: 'Importación Excel cuentas por cobrar',
    periodo: '2026-02',
    usuario: 'Carlos Pérez',
    origen: 'Excel',
    fecha: '2026-02-15',
    lineasCount: 45,
    debito: 38200000,
    credito: 38200000,
    diferencia: 0,
    erroresCount: 3,
    estado: 'Con errores',
    lineas: [],
  },
  {
    id: 'dep01',
    codigo: 'DEP-01',
    nombre: 'Depreciaciones enero',
    periodo: '2026-01',
    usuario: 'Laura Gómez',
    origen: 'Manual',
    fecha: '2026-01-31',
    lineasCount: 8,
    debito: 1250000,
    credito: 1250000,
    diferencia: 0,
    erroresCount: 0,
    estado: 'Verificado',
    lineas: [],
  },
  {
    id: 'no001',
    codigo: 'NO-001',
    nombre: 'Ajuste cierre enero',
    periodo: '2026-01',
    usuario: 'Laura Gómez',
    origen: 'Manual',
    fecha: '2026-01-31',
    lineasCount: 4,
    debito: 890000,
    credito: 890000,
    diferencia: 0,
    erroresCount: 0,
    estado: 'Pendiente aprobación',
    lineas: [],
  },
];

export const MOVIMIENTOS_FEB: MovimientoLinea[] = [
  { id: 'M001', periodo: '2026-02', fecha: '2026-02-05', comprobante: 'CI-000145', tipoDoc: 'FV', documento: 'FV-2026-001', cuenta: '111005', nombreCuenta: 'Bancos moneda nacional', nit: '800.100.200', tercero: 'Empresa ABC Comercial S.A.S.', centro: '', debito: 8500000, credito: 0, base: 0, clase: '', docAfectado: 'FV-2025-145', concepto: 'Recaudo factura ventas', origen: 'Manual', lote: 'CI-001' },
  { id: 'M002', periodo: '2026-02', fecha: '2026-02-05', comprobante: 'CI-000145', tipoDoc: 'FV', documento: 'FV-2026-001', cuenta: '130505', nombreCuenta: 'Clientes nacionales', nit: '800.100.200', tercero: 'Empresa ABC Comercial S.A.S.', centro: '', debito: 0, credito: 8500000, base: 0, clase: '', docAfectado: 'FV-2025-145', concepto: 'Recaudo factura ventas', origen: 'Manual', lote: 'CI-001' },
  { id: 'M003', periodo: '2026-02', fecha: '2026-02-12', comprobante: 'CE-000244', tipoDoc: 'OR', documento: 'OR-2026-023', cuenta: '111005', nombreCuenta: 'Bancos moneda nacional', nit: '900.200.300', tercero: 'Comercial XYZ Distribuciones Ltda.', centro: '', debito: 0, credito: 4100000, base: 0, clase: '', docAfectado: '', concepto: 'Pago proveedor materiales', origen: 'Manual', lote: 'CE-001' },
  { id: 'M004', periodo: '2026-02', fecha: '2026-02-12', comprobante: 'CE-000244', tipoDoc: 'OR', documento: 'OR-2026-023', cuenta: '130505', nombreCuenta: 'Clientes nacionales', nit: '900.200.300', tercero: 'Comercial XYZ Distribuciones Ltda.', centro: '', debito: 4100000, credito: 0, base: 0, clase: '', docAfectado: '', concepto: 'Pago proveedor materiales', origen: 'Manual', lote: 'CE-001' },
  { id: 'M005', periodo: '2026-02', fecha: '2026-02-28', comprobante: 'CE-000245', tipoDoc: 'NOM', documento: 'NOM-2026-02', cuenta: '510506', nombreCuenta: 'Sueldos y salarios', nit: '12.345.678', tercero: 'García Moreno Juan Pablo', centro: 'ADM', debito: 4500000, credito: 0, base: 0, clase: '', docAfectado: '', concepto: 'Sueldo febrero Administración', origen: 'Nómina', lote: 'NOM2' },
  { id: 'M006', periodo: '2026-02', fecha: '2026-02-28', comprobante: 'CE-000245', tipoDoc: 'NOM', documento: 'NOM-2026-02', cuenta: '510506', nombreCuenta: 'Sueldos y salarios', nit: '23.456.789', tercero: 'López Vargas María Fernanda', centro: 'VEN', debito: 3200000, credito: 0, base: 0, clase: '', docAfectado: '', concepto: 'Sueldo febrero Ventas', origen: 'Nómina', lote: 'NOM2' },
  { id: 'M007', periodo: '2026-02', fecha: '2026-02-28', comprobante: 'CE-000245', tipoDoc: 'NOM', documento: 'NOM-2026-02', cuenta: '510506', nombreCuenta: 'Sueldos y salarios', nit: '34.567.890', tercero: 'Martínez Rojas Ana Lucía', centro: 'OPE', debito: 2300000, credito: 0, base: 0, clase: '', docAfectado: '', concepto: 'Sueldo febrero Operaciones', origen: 'Nómina', lote: 'NOM2' },
  { id: 'M008', periodo: '2026-02', fecha: '2026-02-28', comprobante: 'CE-000245', tipoDoc: 'NOM', documento: 'NOM-2026-02', cuenta: '250505', nombreCuenta: 'Salarios por pagar', nit: '12.345.678', tercero: 'García Moreno Juan Pablo', centro: 'ADM', debito: 0, credito: 4500000, base: 0, clase: '', docAfectado: '', concepto: 'Obligación nómina feb ADM', origen: 'Nómina', lote: 'NOM2' },
  { id: 'M009', periodo: '2026-02', fecha: '2026-02-28', comprobante: 'CE-000245', tipoDoc: 'NOM', documento: 'NOM-2026-02', cuenta: '250505', nombreCuenta: 'Salarios por pagar', nit: '23.456.789', tercero: 'López Vargas María Fernanda', centro: 'VEN', debito: 0, credito: 3200000, base: 0, clase: '', docAfectado: '', concepto: 'Obligación nómina feb VEN', origen: 'Nómina', lote: 'NOM2' },
  { id: 'M010', periodo: '2026-02', fecha: '2026-02-28', comprobante: 'CE-000245', tipoDoc: 'NOM', documento: 'NOM-2026-02', cuenta: '236540', nombreCuenta: 'Retenciones y aportes de nómina', nit: '', tercero: '', centro: '', debito: 0, credito: 1200000, base: 0, clase: 'RETFTE', docAfectado: '', concepto: 'Retención nómina febrero', origen: 'Nómina', lote: 'NOM2' },
];

export const SALDOS_BALANCE: SaldoCuenta[] = [
  { cuenta: '110505', nombre: 'Caja general', nivel: 4, saldoInicial: 5200000, meses: [{ debito: 3500000, credito: 2100000 }, { debito: 1800000, credito: 900000 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }] },
  { cuenta: '111005', nombre: 'Bancos moneda nacional', nivel: 4, saldoInicial: 48500000, meses: [{ debito: 12000000, credito: 9800000 }, { debito: 8500000, credito: 12600000 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }] },
  { cuenta: '130505', nombre: 'Clientes nacionales', nivel: 4, saldoInicial: 22400000, meses: [{ debito: 15000000, credito: 8000000 }, { debito: 9500000, credito: 6200000 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }] },
  { cuenta: '236540', nombre: 'Retenciones y aportes de nómina', nivel: 4, saldoInicial: 0, meses: [{ debito: 200000, credito: 1100000 }, { debito: 0, credito: 1200000 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }] },
  { cuenta: '240805', nombre: 'IVA por pagar', nivel: 4, saldoInicial: 0, meses: [{ debito: 300000, credito: 2850000 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }] },
  { cuenta: '250505', nombre: 'Salarios por pagar', nivel: 4, saldoInicial: 0, meses: [{ debito: 10200000, credito: 11400000 }, { debito: 0, credito: 12600000 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }] },
  { cuenta: '510506', nombre: 'Sueldos y salarios', nivel: 4, saldoInicial: 0, meses: [{ debito: 11400000, credito: 0 }, { debito: 12600000, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }, { debito: 0, credito: 0 }] },
];

export const ALERTAS: AlertaContable[] = [
  { id: 'A1', tipo: 'error', mensaje: 'Lote NOM2 tiene 2 errores pendientes de corrección', fecha: '2026-02-28', accion: 'movimientos/lotes' },
  { id: 'A2', tipo: 'error', mensaje: 'Lote IMP-01 tiene 3 errores de importación', fecha: '2026-02-15', accion: 'movimientos/lotes' },
  { id: 'A3', tipo: 'warning', mensaje: 'Lote DEP-01 pendiente de aprobación — lleva 3 días en espera', fecha: '2026-01-31', accion: 'movimientos/lotes' },
  { id: 'A4', tipo: 'warning', mensaje: 'Acumulado de retenciones no ha sido actualizado este período', fecha: '2026-02-25', accion: 'impuestos/retenciones' },
  { id: 'A5', tipo: 'info', mensaje: 'Período enero 2026 pendiente de cierre formal', fecha: '2026-02-01', accion: 'cierres' },
];

export const fmt = (n: number): string =>
  n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const fmtCOP = (n: number): string => `$ ${fmt(n)}`;
