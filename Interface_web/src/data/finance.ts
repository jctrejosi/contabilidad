import type { IconName } from '../components/Icon';
import type { FinancialModuleId } from '../finance/types';

export type { FinancialModuleId };

export interface ModuleNavItem {
  slug: string;
  label: string;
  badge?: number;
}

export interface FinanceRow {
  id: string;
  party: string;
  nit: string;
  date: string;
  due: string;
  amount: number;
  status: string;
  meta: string;
}

export interface FinancialModuleConfig {
  id: FinancialModuleId;
  name: string;
  shortName: string;
  description: string;
  icon: IconName;
  accent: string;
  tint: string;
  border: string;
  primaryAction: string;
  nav: ModuleNavItem[];
  kpis: { label: string; value: string; detail: string; tone?: 'danger' | 'warning' | 'success' }[];
  rows: FinanceRow[];
  priorities: { title: string; detail: string; tone: 'danger' | 'warning' | 'info' }[];
  flow: string[];
}

export const FINANCIAL_MODULES: Record<FinancialModuleId, FinancialModuleConfig> = {
  facturacion: {
    id: 'facturacion',
    name: 'Facturación',
    shortName: 'Facturación',
    description: 'Emisión, recepción y gestión de documentos electrónicos ante la DIAN.',
    icon: 'invoice',
    accent: 'text-blue-700',
    tint: 'bg-blue-50',
    border: 'border-blue-200',
    primaryAction: 'Nueva factura',
    nav: [
      { slug: 'documentos', label: 'Facturas de venta', badge: 4 },
      { slug: 'compras', label: 'Facturas de compra' },
      { slug: 'notas', label: 'Notas crédito y débito' },
      { slug: 'dian', label: 'Centro DIAN', badge: 3 },
      { slug: 'resoluciones', label: 'Resoluciones y numeración' },
      { slug: 'productos', label: 'Productos y servicios' },
      { slug: 'importar', label: 'Importar documentos' },
      { slug: 'formulario-300', label: 'Formulario 300 (IVA)' },
      { slug: 'formulario-350', label: 'Formulario 350 (Retención)' },
      { slug: 'formulario-110', label: 'Formulario 110 (Renta)' },
      { slug: 'declaracion', label: 'Declaración electrónica' },
      { slug: 'exogena', label: 'Exógena y medios' },
    ],
    kpis: [
      { label: 'Facturado este mes', value: '$ 286,4 M', detail: '+12,4 % vs. enero', tone: 'success' },
      { label: 'Por enviar a DIAN', value: '4', detail: '$ 18,7 M pendientes', tone: 'warning' },
      { label: 'Rechazadas', value: '2', detail: 'Requieren corrección', tone: 'danger' },
      { label: 'Próximas a vencer', value: '12', detail: 'En los próximos 7 días' },
    ],
    rows: [
      { id: 'FE-1048', party: 'Empresa ABC Comercial S.A.S.', nit: '800.100.200-3', date: '28/02/2026', due: '30/03/2026', amount: 18450000, status: 'Aceptada DIAN', meta: 'Venta' },
      { id: 'FE-1047', party: 'Comercial XYZ Distribuciones Ltda.', nit: '900.200.300-4', date: '27/02/2026', due: '29/03/2026', amount: 9282000, status: 'Pendiente DIAN', meta: 'Venta' },
      { id: 'FE-1046', party: 'Constructora Horizonte S.A.S.', nit: '901.445.812-1', date: '26/02/2026', due: '28/03/2026', amount: 24718000, status: 'Rechazada', meta: 'Venta' },
      { id: 'FC-8831', party: 'Suministros Técnicos del Norte Ltda.', nit: '860.050.010-9', date: '25/02/2026', due: '12/03/2026', amount: 6732000, status: 'Registrada', meta: 'Compra' },
      { id: 'NC-0098', party: 'Empresa ABC Comercial S.A.S.', nit: '800.100.200-3', date: '24/02/2026', due: '—', amount: 1240000, status: 'En revisión', meta: 'Nota crédito' },
    ],
    priorities: [
      { title: '2 documentos rechazados por DIAN', detail: 'Validar municipio y responsabilidad fiscal', tone: 'danger' },
      { title: 'Resolución FV vence en 18 días', detail: 'Quedan 246 números disponibles', tone: 'warning' },
      { title: '4 documentos listos para envío', detail: 'Valor total $ 18.720.000', tone: 'info' },
    ],
    flow: ['Borrador', 'Revisión', 'Emisión', 'Validación DIAN', 'Cartera'],
  },
  cartera: {
    id: 'cartera',
    name: 'Cuentas por cobrar',
    shortName: 'Cartera',
    description: 'Control de partidas, recaudos, edades y gestión de cobro a clientes.',
    icon: 'receivable',
    accent: 'text-cyan-700',
    tint: 'bg-cyan-50',
    border: 'border-cyan-200',
    primaryAction: 'Nuevo recibo',
    nav: [
      { slug: 'partidas', label: 'Bandeja de cartera', badge: 9 },
      { slug: 'recibos', label: 'Recibos de caja' },
      { slug: 'aplicacion', label: 'Aplicación de pagos', badge: 5 },
      { slug: 'edades', label: 'Edades de cartera' },
      { slug: 'estados-cuenta', label: 'Estados de cuenta' },
      { slug: 'cobro', label: 'Cobro y promesas', badge: 3 },
      { slug: 'ajustes', label: 'Castigos y ajustes' },
      { slug: 'anticipos', label: 'Anticipos de clientes' },
      { slug: 'deterioro', label: 'Provisión por deterioro' },
      { slug: 'conciliacion', label: 'Conciliación con clientes' },
    ],
    kpis: [
      { label: 'Saldo total', value: '$ 148,6 M', detail: '42 partidas abiertas' },
      { label: 'Saldo vencido', value: '$ 31,8 M', detail: '21,4 % de la cartera', tone: 'danger' },
      { label: 'Por vencer', value: '$ 47,2 M', detail: 'Próximos 15 días', tone: 'warning' },
      { label: 'Recaudo del mes', value: '$ 82,1 M', detail: '78 % de la meta', tone: 'success' },
    ],
    rows: [
      { id: 'FE-0982', party: 'Empresa ABC Comercial S.A.S.', nit: '800.100.200-3', date: '15/01/2026', due: '14/02/2026', amount: 15400000, status: 'Vencida', meta: '14 días' },
      { id: 'FE-1011', party: 'Comercial XYZ Distribuciones Ltda.', nit: '900.200.300-4', date: '02/02/2026', due: '04/03/2026', amount: 9800000, status: 'Por vencer', meta: '4 días' },
      { id: 'FE-1018', party: 'Constructora Horizonte S.A.S.', nit: '901.445.812-1', date: '08/02/2026', due: '10/03/2026', amount: 22150000, status: 'Acuerdo de pago', meta: 'Promesa 05/03' },
      { id: 'FE-1029', party: 'Servicios Integrados Andinos S.A.S.', nit: '901.228.617-5', date: '16/02/2026', due: '18/03/2026', amount: 7350000, status: 'Al día', meta: '18 días' },
      { id: 'FE-1041', party: 'Grupo Logístico Capital S.A.S.', nit: '900.781.441-2', date: '22/02/2026', due: '24/03/2026', amount: 12890000, status: 'Al día', meta: '24 días' },
    ],
    priorities: [
      { title: '9 partidas vencidas', detail: '$ 31.840.000 requieren gestión', tone: 'danger' },
      { title: '3 promesas vencen hoy', detail: 'Contactar clientes antes de las 16:00', tone: 'warning' },
      { title: '5 recibos sin aplicar', detail: '$ 8.420.000 disponibles', tone: 'info' },
    ],
    flow: ['Factura', 'Partida abierta', 'Gestión', 'Recaudo', 'Aplicación'],
  },
  'cuentas-pagar': {
    id: 'cuentas-pagar',
    name: 'Cuentas por pagar',
    shortName: 'Cuentas por pagar',
    description: 'Obligaciones, propuestas, aprobaciones, pagos y retenciones a proveedores.',
    icon: 'payable',
    accent: 'text-violet-700',
    tint: 'bg-violet-50',
    border: 'border-violet-200',
    primaryAction: 'Nueva propuesta',
    nav: [
      { slug: 'obligaciones', label: 'Bandeja de obligaciones', badge: 7 },
      { slug: 'propuestas', label: 'Propuestas de pago', badge: 2 },
      { slug: 'pagos', label: 'Pagos' },
      { slug: 'retenciones', label: 'Retenciones y certificados' },
      { slug: 'anticipos', label: 'Anticipos y gastos' },
      { slug: 'programacion', label: 'Edades y programación' },
      { slug: 'estados-cuenta', label: 'Estados de cuenta' },
      { slug: 'gastos', label: 'Gastos y reembolsos' },
      { slug: 'notas', label: 'Notas de proveedor' },
      { slug: 'descuentos', label: 'Descuentos y notas débito' },
      { slug: 'conciliacion', label: 'Conciliación con proveedores' },
    ],
    kpis: [
      { label: 'Total por pagar', value: '$ 96,3 M', detail: '31 obligaciones abiertas' },
      { label: 'Vencido', value: '$ 12,5 M', detail: '5 obligaciones', tone: 'danger' },
      { label: 'Programado', value: '$ 38,2 M', detail: 'Próximos 7 días', tone: 'warning' },
      { label: 'Pagado este mes', value: '$ 64,8 M', detail: '18 comprobantes', tone: 'success' },
    ],
    rows: [
      { id: 'FC-8831', party: 'Suministros Técnicos del Norte Ltda.', nit: '860.050.010-9', date: '20/01/2026', due: '19/02/2026', amount: 6732000, status: 'Vencida', meta: 'Neto $ 6.530.040' },
      { id: 'FC-8845', party: 'Tecnología y Procesos S.A.S.', nit: '901.018.224-6', date: '03/02/2026', due: '05/03/2026', amount: 14800000, status: 'En propuesta', meta: 'PROP-028' },
      { id: 'FC-8852', party: 'Arrendamientos Capital S.A.S.', nit: '800.772.911-4', date: '08/02/2026', due: '10/03/2026', amount: 8900000, status: 'Por vencer', meta: 'Neto $ 8.610.000' },
      { id: 'FC-8864', party: 'Servicios Públicos Bogotá', nit: '899.999.061-9', date: '16/02/2026', due: '02/03/2026', amount: 4210000, status: 'Aprobada', meta: 'Pago 02/03' },
      { id: 'FC-8870', party: 'Auditores & Asociados Ltda.', nit: '900.336.708-2', date: '22/02/2026', due: '24/03/2026', amount: 5950000, status: 'Abierta', meta: 'Neto $ 5.652.500' },
    ],
    priorities: [
      { title: '5 obligaciones vencidas', detail: '$ 12.540.000 por programar', tone: 'danger' },
      { title: '2 propuestas por aprobar', detail: 'Valor neto $ 27.680.000', tone: 'warning' },
      { title: 'Certificados disponibles', detail: 'Retenciones enero 2026', tone: 'info' },
    ],
    flow: ['Obligación', 'Propuesta', 'Aprobación', 'Pago', 'Conciliación'],
  },
  tesoreria: {
    id: 'tesoreria',
    name: 'Tesorería y bancos',
    shortName: 'Tesorería',
    description: 'Posición de caja, flujo real y proyectado, liquidez, bancos, extractos y conciliación.',
    icon: 'bank',
    accent: 'text-emerald-700',
    tint: 'bg-emerald-50',
    border: 'border-emerald-200',
    primaryAction: 'Nueva transferencia',
    nav: [
      { slug: 'panel', label: 'Panel de tesorería' },
      { slug: 'flujo', label: 'Flujo de caja real' },
      { slug: 'proyectado', label: 'Flujo de caja proyectado' },
      { slug: 'liquidez', label: 'Liquidez y recaudos' },
      { slug: 'cuentas', label: 'Cuentas bancarias' },
      { slug: 'extractos', label: 'Extractos', badge: 3 },
      { slug: 'conciliacion', label: 'Conciliación', badge: 18 },
      { slug: 'reglas', label: 'Reglas' },
      { slug: 'transferencias', label: 'Transferencias' },
      { slug: 'cheques', label: 'Cheques' },
      { slug: 'caja', label: 'Caja menor' },
      { slug: 'partidas', label: 'Partidas conciliatorias' },
    ],
    kpis: [
      { label: 'Disponible hoy', value: '$ 214,7 M', detail: '4 cuentas activas', tone: 'success' },
      { label: 'Ingresos del día', value: '$ 18,4 M', detail: '7 movimientos', tone: 'success' },
      { label: 'Salidas del día', value: '$ 12,6 M', detail: '11 movimientos' },
      { label: 'Sin conciliar', value: '18', detail: '$ 24,3 M', tone: 'warning' },
    ],
    rows: [
      { id: 'BC-884521', party: 'Bancolombia · Corriente 4589', nit: 'Movimiento bancario', date: '28/02/2026', due: 'Hoy', amount: 8500000, status: 'Conciliado', meta: 'Recaudo FE-0982' },
      { id: 'BB-771204', party: 'Banco de Bogotá · Ahorros 1821', nit: 'Movimiento bancario', date: '28/02/2026', due: 'Hoy', amount: 4210000, status: 'Sugerencia 98 %', meta: 'Pago servicios' },
      { id: 'BC-884498', party: 'Bancolombia · Corriente 4589', nit: 'Movimiento bancario', date: '27/02/2026', due: '1 día', amount: 14800000, status: 'Sin conciliar', meta: 'Transferencia ACH' },
      { id: 'DV-620193', party: 'Davivienda · Ahorros 9012', nit: 'Movimiento bancario', date: '27/02/2026', due: '1 día', amount: 385000, status: 'Diferencia', meta: 'Comisión bancaria' },
      { id: 'BC-884401', party: 'Bancolombia · Corriente 4589', nit: 'Movimiento bancario', date: '26/02/2026', due: '2 días', amount: 9800000, status: 'Conciliado', meta: 'Recaudo cliente' },
    ],
    priorities: [
      { title: '18 partidas sin conciliar', detail: '$ 24.320.000 pendientes', tone: 'warning' },
      { title: 'Diferencia en Davivienda', detail: '$ 385.000 por comisión bancaria', tone: 'danger' },
      { title: '3 extractos por importar', detail: 'Bancolombia y Banco de Bogotá', tone: 'info' },
    ],
    flow: ['Extracto', 'Sugerencia', 'Validación', 'Conciliación', 'Contabilización'],
  },
  presupuesto: {
    id: 'presupuesto',
    name: 'Presupuestos',
    shortName: 'Presupuestos',
    description: 'Planeación, aprobación, compromisos y control de ejecución presupuestal.',
    icon: 'budget',
    accent: 'text-amber-700',
    tint: 'bg-amber-50',
    border: 'border-amber-200',
    primaryAction: 'Nueva versión',
    nav: [
      { slug: 'versiones', label: 'Bandeja de presupuestos' },
      { slug: 'editor', label: 'Editor' },
      { slug: 'distribucion', label: 'Distribución' },
      { slug: 'aprobacion', label: 'Aprobación', badge: 1 },
      { slug: 'ejecucion', label: 'Ejecución y compromisos' },
      { slug: 'comparativo', label: 'Comparativo y escenarios' },
      { slug: 'proyectos', label: 'Proyección por proyecto' },
      { slug: 'alertas', label: 'Alertas', badge: 2 },
    ],
    kpis: [
      { label: 'Presupuesto vigente', value: '$ 1.284 M', detail: 'Versión 2026 V3' },
      { label: 'Ejecutado', value: '$ 184,7 M', detail: '14,4 % del anual', tone: 'success' },
      { label: 'Comprometido', value: '$ 92,8 M', detail: '7,2 % del anual', tone: 'warning' },
      { label: 'Disponible', value: '$ 1.006 M', detail: '78,4 % restante' },
    ],
    rows: [
      { id: '5105', party: 'Gastos de personal', nit: 'Administración', date: 'Ene–Dic 2026', due: 'Ejecución 16,2 %', amount: 486000000, status: 'Dentro del rango', meta: 'Disponible $ 384,2 M' },
      { id: '5110', party: 'Honorarios', nit: 'Administración', date: 'Ene–Dic 2026', due: 'Ejecución 24,8 %', amount: 96000000, status: 'Seguimiento', meta: 'Disponible $ 67,4 M' },
      { id: '5120', party: 'Arrendamientos', nit: 'Operaciones', date: 'Ene–Dic 2026', due: 'Ejecución 18,5 %', amount: 144000000, status: 'Dentro del rango', meta: 'Disponible $ 112,6 M' },
      { id: '5135', party: 'Servicios', nit: 'Operaciones', date: 'Ene–Dic 2026', due: 'Ejecución 31,6 %', amount: 82000000, status: 'Umbral 80 %', meta: 'Disponible $ 49,7 M' },
      { id: '5195', party: 'Diversos', nit: 'Ventas', date: 'Ene–Dic 2026', due: 'Ejecución 42,1 %', amount: 68000000, status: 'Sobre ejecución', meta: 'Disponible $ 31,8 M' },
    ],
    priorities: [
      { title: '1 versión por aprobar', detail: 'Presupuesto 2026 · Versión V4', tone: 'warning' },
      { title: '4 alertas de ejecución', detail: 'Dos centros superaron el umbral', tone: 'danger' },
      { title: 'Actualización completada', detail: 'Datos reales al 28/02/2026', tone: 'info' },
    ],
    flow: ['Borrador', 'Distribución', 'Revisión', 'Aprobación', 'Ejecución'],
  },
  'activos-fijos': {
    id: 'activos-fijos',
    name: 'Activos fijos',
    shortName: 'Activos fijos',
    description: 'Registro, depreciación, revalorizaciones, bajas y conciliación de propiedades, planta y equipo.',
    icon: 'asset',
    accent: 'text-teal-700',
    tint: 'bg-teal-50',
    border: 'border-teal-200',
    primaryAction: 'Nuevo activo',
    nav: [
      { slug: 'panel', label: 'Panel de activos' },
      { slug: 'registro', label: 'Registro de activos' },
      { slug: 'movimientos', label: 'Registro contable' },
      { slug: 'depreciacion', label: 'Depreciación' },
      { slug: 'revalorizaciones', label: 'Revalorizaciones', badge: 2 },
      { slug: 'bajas', label: 'Bajas y retiros', badge: 2 },
      { slug: 'traslados', label: 'Traslados' },
      { slug: 'conciliacion', label: 'Conciliación con el mayor' },
      { slug: 'categorias', label: 'Categorías y políticas' },
      { slug: 'reportes', label: 'Reportes' },
    ],
    kpis: [
      { label: 'Costo bruto', value: '$ 6.750 M', detail: '15 activos registrados' },
      { label: 'Depreciación acumulada', value: '$ 2.108 M', detail: '31,2 % del costo' },
      { label: 'Valor neto en libros', value: '$ 4.642 M', detail: 'Propiedades, planta y equipo', tone: 'success' },
      { label: 'Superávit por revalorización', value: '$ 180 M', detail: 'Contabilizado en el patrimonio', tone: 'warning' },
    ],
    rows: [
      { id: 'AF-0001', party: 'Sede administrativa principal', nit: 'Construcciones y edificaciones', date: '15/03/2018', due: 'En operación', amount: 2580000000, status: 'En operación', meta: 'Valor neto $ 1.743 M' },
      { id: 'AF-0003', party: 'Línea de empaque automatizada', nit: 'Maquinaria y equipo', date: '20/05/2021', due: 'En operación', amount: 850000000, status: 'En operación', meta: 'Valor neto $ 460,4 M' },
      { id: 'AF-0006', party: 'Camión de reparto NPR', nit: 'Flota y equipo de transporte', date: '01/04/2022', due: 'En operación', amount: 320000000, status: 'En operación', meta: 'Valor neto $ 108,8 M' },
      { id: 'AF-0015', party: 'Empacadora secundaria en montaje', nit: 'Maquinaria y equipo', date: '15/01/2026', due: 'En montaje', amount: 260000000, status: 'En montaje', meta: 'Sin depreciación' },
      { id: 'AF-0014', party: 'Vehículo de reparto retirado', nit: 'Flota y equipo de transporte', date: '10/02/2022', due: '30/11/2025', amount: 95000000, status: 'Vendido', meta: 'Baja aplicada' },
    ],
    priorities: [
      { title: '1 revalorización por aplicar', detail: 'Bodega norte · superávit $ 172,5 M', tone: 'warning' },
      { title: '1 baja por aprobar', detail: 'Servidor de nómina obsoleto', tone: 'danger' },
      { title: '2 categorías con diferencia', detail: 'Maquinaria y muebles de oficina', tone: 'danger' },
    ],
    flow: ['Adquisición', 'Puesta en servicio', 'Depreciación', 'Revalorización', 'Baja', 'Conciliación'],
  },
  costos: {
    id: 'costos',
    name: 'Costos',
    shortName: 'Costos',
    description: 'Distribución de CIF, costeo estándar con variaciones, ABC y costos por proyecto.',
    icon: 'cost',
    accent: 'text-orange-700',
    tint: 'bg-orange-50',
    border: 'border-orange-200',
    primaryAction: 'Nuevo objeto de costo',
    nav: [
      { slug: 'panel', label: 'Panel de costos' },
      { slug: 'centros', label: 'Centros y conductores' },
      { slug: 'cif', label: 'Distribución de CIF', badge: 1 },
      { slug: 'secundaria', label: 'Distribución secundaria' },
      { slug: 'estandar', label: 'Costeo estándar' },
      { slug: 'abc', label: 'Costeo ABC' },
      { slug: 'proyectos', label: 'Costos por proyecto' },
      { slug: 'reportes', label: 'Reportes de costo' },
    ],
    kpis: [
      { label: 'Costo total del período', value: '$ 1.127 M', detail: '6 centros de costo' },
      { label: 'CIF distribuido', value: '$ 174 M', detail: '2 de 5 pools del período', tone: 'warning' },
      { label: 'Variación neta', value: '$ 18,4 M', detail: 'Desfavorable frente al estándar', tone: 'danger' },
      { label: 'Margen bruto', value: '41,2 %', detail: '+1,7 pp vs. enero', tone: 'success' },
    ],
    rows: [
      { id: 'CC-PROD', party: 'Producción', nit: 'Producción', date: 'Feb 2026', due: '3.200 h máquina', amount: 420000000, status: 'Costo directo', meta: 'CIF $ 105 M' },
      { id: 'CC-EMPA', party: 'Empaque y despacho', nit: 'Producción', date: 'Feb 2026', due: '1.850 h hombre', amount: 168000000, status: 'Costo directo', meta: 'CIF $ 52,2 M' },
      { id: 'CC-ADM', party: 'Administración', nit: 'Administrativo', date: 'Feb 2026', due: '42 empleados', amount: 210000000, status: 'Indirecto', meta: 'CIF $ 44,8 M' },
      { id: 'CC-VEN', party: 'Comercial', nit: 'Comercial', date: 'Feb 2026', due: '1.260 pedidos', amount: 145000000, status: 'Indirecto', meta: 'CIF $ 29,1 M' },
      { id: 'CO-006', party: 'Implantación ERP', nit: 'Proyecto', date: 'Feb 2026', due: '1 unidad', amount: 196000000, status: 'Sobre costo', meta: 'Variación $ 16 M' },
    ],
    priorities: [
      { title: '3 pools sin distribuir', detail: '$ 114 M pendientes de asignación', tone: 'warning' },
      { title: 'Variación desfavorable en 4 objetos', detail: 'Revisar precio real de compra', tone: 'danger' },
      { title: 'Cierre de costos de febrero', detail: 'Disponible para contabilizar', tone: 'info' },
    ],
    flow: ['Acumulación', 'Distribución CIF', 'Costeo', 'Variaciones', 'Cierre'],
  },
  financiacion: {
    id: 'financiacion',
    name: 'Financiación y deuda',
    shortName: 'Financiación',
    description: 'Préstamos, amortizaciones, intereses, cupos de crédito y arrendamientos financieros.',
    icon: 'loan',
    accent: 'text-indigo-700',
    tint: 'bg-indigo-50',
    border: 'border-indigo-200',
    primaryAction: 'Nuevo préstamo',
    nav: [
      { slug: 'panel', label: 'Panel de deuda' },
      { slug: 'prestamos', label: 'Préstamos bancarios' },
      { slug: 'amortizacion', label: 'Calendario de amortización' },
      { slug: 'pagos', label: 'Intereses y pagos' },
      { slug: 'cupos', label: 'Cupos de crédito' },
      { slug: 'leasing', label: 'Arrendamientos financieros' },
      { slug: 'reportes', label: 'Reportes de deuda' },
    ],
    kpis: [
      { label: 'Deuda financiera', value: '$ 420 M', detail: '3 préstamos vigentes' },
      { label: 'Cuota mensual', value: '$ 17,6 M', detail: 'Capital + intereses' },
      { label: 'Intereses del año', value: '$ 51,8 M', detail: 'Causados a febrero', tone: 'warning' },
      { label: 'Cupo disponible', value: '$ 730 M', detail: 'De $ 1.150 M aprobados', tone: 'success' },
    ],
    rows: [
      { id: 'LB-2025-01', party: 'Bancolombia', nit: 'Préstamo', date: '30/06/2025', due: '30/11/2027', amount: 240000000, status: 'Vigente', meta: 'Tasa 13,8 % EA' },
      { id: 'LB-2024-07', party: 'Banco de Bogotá', nit: 'Préstamo', date: '30/09/2024', due: '30/09/2026', amount: 120000000, status: 'Vigente', meta: 'Tasa 14,6 % EA' },
      { id: 'LB-2025-03', party: 'Davivienda', nit: 'Préstamo', date: '31/01/2025', due: '31/07/2026', amount: 60000000, status: 'Vigente', meta: 'Tasa 15,2 % EA' },
      { id: 'AR-2024-01', party: 'Leasing Bancolombia', nit: 'Leasing', date: '01/04/2024', due: '01/04/2028', amount: 470400000, status: 'Vigente', meta: 'Opción de compra' },
      { id: 'CL-004', party: 'BBVA Colombia', nit: 'Cupo', date: '31/12/2025', due: '31/12/2025', amount: 150000000, status: 'Vencida', meta: 'Sin uso' },
    ],
    priorities: [
      { title: '1 cupo vencido', detail: 'BBVA Colombia · renovar o cerrar', tone: 'danger' },
      { title: '2 cuotas vencen esta semana', detail: '$ 4,9 M entre capital e intereses', tone: 'warning' },
      { title: 'Cobertura de intereses en 5,3 veces', detail: 'Por encima de la meta de 4,0', tone: 'info' },
    ],
    flow: ['Solicitud', 'Desembolso', 'Amortización', 'Intereses', 'Cierre'],
  },
  indicadores: {
    id: 'indicadores',
    name: 'Indicadores y proyecciones',
    shortName: 'Indicadores',
    description: 'Tablero gerencial, catálogo de indicadores, proyecciones y escenarios financieros.',
    icon: 'indicator',
    accent: 'text-emerald-700',
    tint: 'bg-emerald-50',
    border: 'border-emerald-200',
    primaryAction: 'Nueva proyección',
    nav: [
      { slug: 'panel', label: 'Tablero gerencial' },
      { slug: 'catalogo', label: 'Catálogo de indicadores' },
      { slug: 'proyecciones', label: 'Proyecciones financieras' },
      { slug: 'escenarios', label: 'Escenarios' },
      { slug: 'reportes', label: 'Informes gerenciales' },
    ],
    kpis: [
      { label: 'Margen bruto', value: '41,2 %', detail: 'Meta 38,0 %', tone: 'success' },
      { label: 'EBITDA', value: '$ 348 M', detail: '+8,7 % vs. meta', tone: 'success' },
      { label: 'Endeudamiento', value: '41,8 %', detail: 'Meta máxima 45 %' },
      { label: 'Cumplimiento de recaudo', value: '92 %', detail: 'Meta 100 %', tone: 'warning' },
    ],
    rows: [
      { id: 'LIQ-01', party: 'Razón corriente', nit: 'Liquidez', date: 'Feb 2026', due: 'Meta 1,50', amount: 1.62, status: 'Cumple', meta: 'Anterior 1,48' },
      { id: 'END-01', party: 'Endeudamiento total', nit: 'Endeudamiento', date: 'Feb 2026', due: 'Meta 45,0 %', amount: 41.8, status: 'Cumple', meta: 'Anterior 44,2 %' },
      { id: 'REN-01', party: 'Margen bruto', nit: 'Rentabilidad', date: 'Feb 2026', due: 'Meta 38,0 %', amount: 41.2, status: 'Cumple', meta: 'Anterior 39,5 %' },
      { id: 'ACT-01', party: 'Rotación de cartera', nit: 'Actividad', date: 'Feb 2026', due: 'Meta 45 días', amount: 52, status: 'En riesgo', meta: 'Anterior 57 días' },
      { id: 'PRE-01', party: 'Cumplimiento de recaudo', nit: 'Presupuesto', date: 'Feb 2026', due: 'Meta 100 %', amount: 92, status: 'En riesgo', meta: 'Anterior 96 %' },
    ],
    priorities: [
      { title: '2 indicadores fuera de meta', detail: 'Rotación de cartera y recaudo', tone: 'danger' },
      { title: 'Escenario base con brecha de caja', detail: 'Abril y mayo en negativo', tone: 'warning' },
      { title: '13 indicadores en seguimiento', detail: 'Actualización mensual', tone: 'info' },
    ],
    flow: ['Datos', 'Indicador', 'Análisis', 'Proyección', 'Decisión'],
  },
  aprobaciones: {
    id: 'aprobaciones',
    name: 'Aprobaciones',
    shortName: 'Aprobaciones',
    description: 'Motor configurable de reglas, niveles y bandeja de solicitudes por módulo.',
    icon: 'check',
    accent: 'text-amber-700',
    tint: 'bg-amber-50',
    border: 'border-amber-200',
    primaryAction: 'Nueva regla',
    nav: [
      { slug: 'bandeja', label: 'Bandeja de aprobaciones', badge: 5 },
      { slug: 'reglas', label: 'Reglas y niveles' },
    ],
    kpis: [
      { label: 'Pendientes', value: '5', detail: '$ 31,4 M en revisión', tone: 'warning' },
      { label: 'Nivel promedio', value: '2,1', detail: 'Aprobadores por solicitud' },
      { label: 'Vencidas', value: '1', detail: 'Requieren escalamiento', tone: 'danger' },
      { label: 'Aprobadas del mes', value: '18', detail: 'Tiempo medio 6,4 h', tone: 'success' },
    ],
    rows: [
      { id: 'APR-0201', party: 'Propuesta PROP-028', nit: 'Cuentas por pagar', date: '26/02/2026', due: '28/02/2026', amount: 27680000, status: 'Pendiente', meta: 'Nivel 1 de 2' },
      { id: 'APR-0200', party: 'Baja AF-0013', nit: 'Activos fijos', date: '25/02/2026', due: '27/02/2026', amount: 0, status: 'Pendiente', meta: 'Nivel 1 de 1' },
      { id: 'APR-0199', party: 'Ajuste de proveedor ADJ-0002', nit: 'Cuentas por pagar', date: '24/02/2026', due: '26/02/2026', amount: 450000, status: 'Aprobada', meta: 'Laura Gómez' },
      { id: 'APR-0198', party: 'Revalorización AV-2026-014', nit: 'Activos fijos', date: '22/02/2026', due: '24/02/2026', amount: 172500000, status: 'Aprobada', meta: 'Comité' },
      { id: 'APR-0197', party: 'Pago PAG-4413', nit: 'Tesorería', date: '20/02/2026', due: '21/02/2026', amount: 3100000, status: 'Vencida', meta: 'Nivel 2 de 2' },
    ],
    priorities: [
      { title: '1 solicitud vencida', detail: 'Pago PAG-4413 requiere escalamiento', tone: 'danger' },
      { title: '2 propuestas esperan segundo nivel', detail: 'Monto acumulado $ 27,7 M', tone: 'warning' },
      { title: 'Regla de compras sin segundo nivel', detail: 'Revisar umbral de $ 20 M', tone: 'info' },
    ],
    flow: ['Solicitud', 'Regla', 'Nivel 1', 'Nivel 2', 'Decisión'],
  },
  auditoria: {
    id: 'auditoria',
    name: 'Auditoría y control',
    shortName: 'Auditoría',
    description: 'Bitácora de eventos, roles, permisos y segregación de funciones.',
    icon: 'ledger',
    accent: 'text-slate-700',
    tint: 'bg-slate-50',
    border: 'border-slate-200',
    primaryAction: 'Exportar bitácora',
    nav: [
      { slug: 'bitacora', label: 'Bitácora de eventos' },
      { slug: 'permisos', label: 'Roles y permisos' },
    ],
    kpis: [
      { label: 'Eventos registrados', value: '6', detail: 'Últimas 24 horas' },
      { label: 'Usuarios activos', value: '4', detail: 'Con actividad en la suite' },
      { label: 'Roles definidos', value: '5', detail: 'Con permisos por módulo' },
      { label: 'Acciones sensibles', value: '2', detail: 'Aprobaciones y reversiones', tone: 'warning' },
    ],
    rows: [
      { id: 'AUD-4412', party: 'Factura FV-1048 aceptada por la DIAN', nit: 'Facturación', date: '28/02/2026 16:42', due: 'Laura Gómez', amount: 0, status: 'Registrado', meta: 'Sistema' },
      { id: 'AUD-4411', party: 'Recibo REC-1204 registrado', nit: 'Cartera', date: '27/02/2026 11:10', due: 'Carlos Pérez', amount: 4420000, status: 'Registrado', meta: 'Usuario' },
      { id: 'AUD-4410', party: 'Propuesta PROP-028 enviada a aprobación', nit: 'Cuentas por pagar', date: '26/02/2026 09:35', due: 'Laura Gómez', amount: 27680000, status: 'Registrado', meta: 'Usuario' },
    ],
    priorities: [
      { title: '2 acciones sensibles hoy', detail: 'Revisar aprobaciones y reversiones', tone: 'warning' },
      { title: 'Rol Tesorería sin segundo aprobador', detail: 'Segregación de funciones incompleta', tone: 'danger' },
      { title: 'Bitácora persistente en el navegador', detail: 'Máximo 80 eventos recientes', tone: 'info' },
    ],
    flow: ['Evento', 'Usuario', 'Módulo', 'Registro', 'Revisión'],
  },
  consolidacion: {
    id: 'consolidacion',
    name: 'Consolidación',
    shortName: 'Consolidación',
    description: 'Estados financieros consolidados y eliminación de operaciones intercompañía.',
    icon: 'building',
    accent: 'text-indigo-700',
    tint: 'bg-indigo-50',
    border: 'border-indigo-200',
    primaryAction: 'Generar eliminaciones',
    nav: [
      { slug: 'panel', label: 'Panel de consolidación' },
      { slug: 'eliminaciones', label: 'Eliminaciones intercompañía' },
    ],
    kpis: [
      { label: 'Compañías incluidas', value: '3', detail: 'De 4 en el grupo' },
      { label: 'Activos consolidados', value: '$ 7.480 M', detail: 'Antes de eliminaciones' },
      { label: 'Eliminaciones', value: '$ 318 M', detail: 'Operaciones intercompañía' },
      { label: 'Participación promedio', value: '78 %', detail: 'Control del grupo', tone: 'success' },
    ],
    rows: [
      { id: 'CIA-001', party: 'Compañía Demo S.A.S.', nit: '900.123.456-7', date: '100 %', due: 'Colombia', amount: 4820000000, status: 'Incluida', meta: 'Matriz' },
      { id: 'CIA-002', party: 'Servicios Logísticos del Norte S.A.S.', nit: '901.556.221-8', date: '85 %', due: 'Colombia', amount: 1640000000, status: 'Incluida', meta: 'Subordinada' },
      { id: 'CIA-003', party: 'Comercializadora Andina Ltda.', nit: '800.442.117-2', date: '70 %', due: 'Colombia', amount: 1020000000, status: 'Incluida', meta: 'Subordinada' },
      { id: 'CIA-004', party: 'Operaciones Panamá S.A.', nit: 'PA-8841-2026', date: '51 %', due: 'Panamá', amount: 860000000, status: 'En revisión', meta: 'Extranjera' },
    ],
    priorities: [
      { title: '1 compañía en revisión', detail: 'Operaciones Panamá sin estados auditados', tone: 'warning' },
      { title: 'Eliminaciones pendientes', detail: '2 partidas por $ 84 M', tone: 'danger' },
      { title: 'Participación no controlante', detail: 'Calcular antes del cierre', tone: 'info' },
    ],
    flow: ['Compañías', 'Homologación', 'Suma', 'Eliminaciones', 'Consolidado'],
  },
};

export const MODULE_ORDER: FinancialModuleId[] = [
  'facturacion',
  'cartera',
  'cuentas-pagar',
  'tesoreria',
  'presupuesto',
  'activos-fijos',
  'costos',
  'financiacion',
  'indicadores',
  'aprobaciones',
  'auditoria',
  'consolidacion',
];

export function isFinancialModule(value: string): value is FinancialModuleId {
  return MODULE_ORDER.includes(value as FinancialModuleId);
}

export function getModuleFromPage(page: string): FinancialModuleConfig | null {
  const moduleId = page.split('/')[0];
  return isFinancialModule(moduleId) ? FINANCIAL_MODULES[moduleId] : null;
}
