import type { IconName } from '../components/Icon';

export type FinancialModuleId =
  | 'facturacion'
  | 'cartera'
  | 'cuentas-pagar'
  | 'tesoreria'
  | 'presupuesto';

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
    description: 'Posición de caja, bancos, extractos, conciliación y transferencias.',
    icon: 'bank',
    accent: 'text-emerald-700',
    tint: 'bg-emerald-50',
    border: 'border-emerald-200',
    primaryAction: 'Nueva transferencia',
    nav: [
      { slug: 'panel', label: 'Panel de tesorería' },
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
      { slug: 'alertas', label: 'Alertas', badge: 4 },
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
};

export const MODULE_ORDER: FinancialModuleId[] = [
  'facturacion',
  'cartera',
  'cuentas-pagar',
  'tesoreria',
  'presupuesto',
];

export function isFinancialModule(value: string): value is FinancialModuleId {
  return MODULE_ORDER.includes(value as FinancialModuleId);
}

export function getModuleFromPage(page: string): FinancialModuleConfig | null {
  const moduleId = page.split('/')[0];
  return isFinancialModule(moduleId) ? FINANCIAL_MODULES[moduleId] : null;
}
