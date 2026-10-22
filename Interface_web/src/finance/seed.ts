import type {
  Advance,
  ApprovalRequest,
  ApprovalRule,
  Asset,
  AssetCategory,
  AssetDisposal,
  AssetMovement,
  AssetReconciliation,
  AssetRevaluation,
  AssetTransfer,
  BankAccount,
  BankStatement,
  BudgetLine,
  BudgetProjection,
  BudgetVersion,
  CashMovement,
  Check,
  CollectionAction,
  ConsolidationCompany,
  CostActivity,
  CostAllocation,
  CostCenter,
  CostObject,
  CostPool,
  CostRun,
  CostSecondaryAllocation,
  CreditLine,
  CustomerReconciliation,
  DepreciationEntry,
  DianEvent,
  EliminationEntry,
  Expense,
  ExogenousReport,
  FinanceState,
  FinancialModuleId,
  ImpairmentProvision,
  Indicator,
  Invoice,
  InvoiceKind,
  InvoiceLine,
  Lease,
  Loan,
  AmortizationRow,
  Party,
  Payable,
  Payment,
  PaymentApplication,
  PaymentProposal,
  PettyCash,
  Product,
  Projection,
  ProjectionLine,
  Receivable,
  Receipt,
  Reconciliation,
  ReconciliationRule,
  Resolution,
  Retention,
  Role,
  RolePermission,
  StatementLine,
  SupplierAdjustment,
  SupplierReconciliation,
  TaxFiling,
  Transfer,
  WriteOff,
} from './types';
import { addDays, agingBucket, assetMonthlyDepreciation, invoiceTotals } from './selectors';
import { buildFiling } from './tax';

let sequence = 0;
const uid = (prefix: string) => `${prefix}-${++sequence}`;

const parties: Party[] = [
  { id: 'p-abc', name: 'Empresa ABC Comercial S.A.S.', nit: '800.100.200-3', kind: 'Cliente', city: 'Bogotá', email: 'cartera@abccomercial.co', phone: '601 555 0101', term: 30, cupo: 80_000_000 },
  { id: 'p-xyz', name: 'Comercial XYZ Distribuciones Ltda.', nit: '900.200.300-4', kind: 'Cliente', city: 'Medellín', email: 'pagos@xyz.com.co', phone: '604 555 0202', term: 30, cupo: 50_000_000 },
  { id: 'p-horizonte', name: 'Constructora Horizonte S.A.S.', nit: '901.445.812-1', kind: 'Cliente', city: 'Cali', email: 'financiera@horizonte.co', phone: '602 555 0303', term: 30, cupo: 120_000_000 },
  { id: 'p-andinos', name: 'Servicios Integrados Andinos S.A.S.', nit: '901.228.617-5', kind: 'Cliente', city: 'Bogotá', email: 'cuentas@andinos.co', phone: '601 555 0404', term: 30, cupo: 60_000_000 },
  { id: 'p-logistico', name: 'Grupo Logístico Capital S.A.S.', nit: '900.781.441-2', kind: 'Cliente', city: 'Bogotá', email: 'tesoreria@logistico.co', phone: '601 555 0505', term: 30, cupo: 70_000_000 },
  { id: 'p-suministros', name: 'Suministros Técnicos del Norte Ltda.', nit: '860.050.010-9', kind: 'Proveedor', city: 'Barranquilla', email: 'cobros@suministros.co', phone: '605 555 0606', term: 30, cupo: 0 },
  { id: 'p-tecnologia', name: 'Tecnología y Procesos S.A.S.', nit: '901.018.224-6', kind: 'Proveedor', city: 'Bogotá', email: 'facturacion@typrocesos.co', phone: '601 555 0707', term: 30, cupo: 0 },
  { id: 'p-arriendos', name: 'Arrendamientos Capital S.A.S.', nit: '800.772.911-4', kind: 'Proveedor', city: 'Bogotá', email: 'cartera@arriendos.co', phone: '601 555 0808', term: 30, cupo: 0 },
  { id: 'p-servicios', name: 'Servicios Públicos Bogotá', nit: '899.999.061-9', kind: 'Proveedor', city: 'Bogotá', email: 'pagos@servicios.co', phone: '601 555 0909', term: 15, cupo: 0 },
  { id: 'p-auditores', name: 'Auditores & Asociados Ltda.', nit: '900.336.708-2', kind: 'Proveedor', city: 'Bogotá', email: 'facturas@auditores.co', phone: '601 555 1010', term: 30, cupo: 0 },
];

const products: Product[] = [
  { id: 'prod-1', code: 'SRV-CONS', name: 'Consultoría financiera', unit: 'Hora', price: 280_000, taxRate: 19, account: '4155', active: true },
  { id: 'prod-2', code: 'LIC-SW', name: 'Licencia de software anual', unit: 'Unidad', price: 4_800_000, taxRate: 19, account: '4155', active: true },
  { id: 'prod-3', code: 'SOP-ANU', name: 'Soporte técnico anual', unit: 'Unidad', price: 2_400_000, taxRate: 19, account: '4155', active: true },
  { id: 'prod-4', code: 'EQ-PORT', name: 'Equipo portátil corporativo', unit: 'Unidad', price: 3_900_000, taxRate: 19, account: '1528', active: true },
  { id: 'prod-5', code: 'SERV-NUBE', name: 'Servicio en la nube', unit: 'Mes', price: 1_250_000, taxRate: 19, account: '4155', active: true },
  { id: 'prod-6', code: 'PAP-IMP', name: 'Papelería impresa', unit: 'Unidad', price: 85_000, taxRate: 19, account: '5195', active: false },
];

function line(
  productCode: string,
  description: string,
  quantity: number,
  price: number,
  taxRate = 19,
  withholdingRate = 0,
  account = '4155',
  costCenter = 'ADM',
): InvoiceLine {
  return {
    id: uid('line'),
    productCode,
    description,
    quantity,
    price,
    discountPct: 0,
    taxRate,
    withholdingRate,
    account,
    costCenter,
  };
}

function invoice(
  partial: Omit<Invoice, 'id' | 'paymentTerm' | 'cufe' | 'resolutionId' | 'referenceId' | 'motive' | 'notes' | 'createdAt'> & {
    paymentTerm?: number;
    cufe?: string;
    resolutionId?: string;
    referenceId?: string;
    motive?: string;
    notes?: string;
    createdAt?: string;
  },
): Invoice {
  return {
    id: uid('inv'),
    paymentTerm: 30,
    cufe: '',
    resolutionId: '',
    referenceId: '',
    motive: '',
    notes: '',
    createdAt: partial.date,
    ...partial,
  };
}

const invoices: Invoice[] = [
  invoice({
    kind: 'FV', number: 'FV-1048', partyId: 'p-abc', date: '2026-02-28', dueDate: '2026-03-30',
    status: 'Contabilizada', dianStatus: 'Aceptada', cufe: 'CUFE-8C1A-1048', resolutionId: 'res-fv',
    lines: [
      line('SRV-CONS', 'Consultoría para cierre financiero', 40, 287_500, 19, 0, '4155', 'ADM'),
      line('SOP-ANU', 'Soporte técnico febrero', 1, 4_004_202, 19, 0, '4155', 'ADM'),
    ],
  }),
  invoice({
    kind: 'FV', number: 'FV-1047', partyId: 'p-xyz', date: '2026-02-27', dueDate: '2026-03-29',
    status: 'Por enviar', dianStatus: 'Pendiente', resolutionId: 'res-fv',
    lines: [
      line('LIC-SW', 'Licencia anual plataforma XYZ', 1, 4_800_000, 19, 0, '4155', 'VEN'),
      line('SERV-NUBE', 'Servicio en la nube febrero', 2, 1_500_000, 19, 0, '4155', 'VEN'),
    ],
  }),
  invoice({
    kind: 'FV', number: 'FV-1046', partyId: 'p-horizonte', date: '2026-02-26', dueDate: '2026-03-28',
    status: 'Contabilizada', dianStatus: 'Rechazada', resolutionId: 'res-fv',
    lines: [
      line('SRV-CONS', 'Interventoría obra norte', 60, 263_157, 19, 0, '4155', 'OPE'),
      line('EQ-PORT', 'Equipos para supervisión', 2, 2_000_000, 19, 0, '1528', 'OPE'),
    ],
  }),
  invoice({
    kind: 'FV', number: 'FV-1045', partyId: 'p-andinos', date: '2026-02-20', dueDate: '2026-03-22',
    status: 'Contabilizada', dianStatus: 'Aceptada', cufe: 'CUFE-4B2C-1045', resolutionId: 'res-fv',
    lines: [
      line('SOP-ANU', 'Soporte aplicaciones Andinos', 1, 3_200_000, 19, 0, '4155', 'ADM'),
      line('SERV-NUBE', 'Consumo nube febrero', 2, 1_488_235, 19, 0, '4155', 'ADM'),
    ],
  }),
  invoice({
    kind: 'FV', number: 'FV-1044', partyId: 'p-logistico', date: '2026-02-18', dueDate: '2026-03-20',
    status: 'Contabilizada', dianStatus: 'Aceptada', cufe: 'CUFE-9D31-1044', resolutionId: 'res-fv',
    lines: [
      line('SRV-CONS', 'Optimización de rutas', 30, 260_000, 19, 0, '4155', 'OPE'),
      line('LIC-SW', 'Licencia logística', 1, 3_031_933, 19, 0, '4155', 'VEN'),
    ],
  }),
  invoice({
    kind: 'FV', number: 'FV-1043', partyId: 'p-abc', date: '2026-01-15', dueDate: '2026-02-14',
    status: 'Contabilizada', dianStatus: 'Aceptada', cufe: 'CUFE-1A77-1043', resolutionId: 'res-fv',
    lines: [
      line('SRV-CONS', 'Consultoría tributaria enero', 35, 250_000, 19, 0, '4155', 'ADM'),
      line('SOP-ANU', 'Soporte enero', 1, 4_191_176, 19, 0, '4155', 'ADM'),
    ],
  }),
  invoice({
    kind: 'FV', number: 'FV-1042', partyId: 'p-xyz', date: '2026-02-02', dueDate: '2026-03-04',
    status: 'Contabilizada', dianStatus: 'Aceptada', cufe: 'CUFE-7F02-1042', resolutionId: 'res-fv',
    lines: [
      line('LIC-SW', 'Licencia adicional', 1, 4_500_000, 19, 0, '4155', 'VEN'),
      line('SERV-NUBE', 'Nube febrero', 3, 1_245_098, 19, 0, '4155', 'VEN'),
    ],
  }),
  invoice({
    kind: 'FV', number: 'FV-1041', partyId: 'p-horizonte', date: '2026-02-22', dueDate: '2026-03-24',
    status: 'Contabilizada', dianStatus: 'Aceptada', cufe: 'CUFE-3C55-1041', resolutionId: 'res-fv',
    lines: [
      line('SRV-CONS', 'Gerencia de proyecto', 50, 300_000, 19, 0, '4155', 'OPE'),
      line('EQ-PORT', 'Equipos de obra', 1, 3_613_445, 19, 0, '1528', 'OPE'),
    ],
  }),
  invoice({
    kind: 'FV', number: 'FV-1035', partyId: 'p-andinos', date: '2025-11-10', dueDate: '2025-12-10',
    status: 'Contabilizada', dianStatus: 'Aceptada', cufe: 'CUFE-0B15-1035', resolutionId: 'res-fv',
    lines: [line('SERV-NUBE', 'Servicio nube noviembre', 1, 1_008_403, 19, 0, '4155', 'ADM')],
  }),
  invoice({
    kind: 'FC', number: 'FC-8831', partyId: 'p-suministros', date: '2026-01-20', dueDate: '2026-02-19',
    status: 'Contabilizada', dianStatus: 'No aplica', paymentTerm: 30,
    lines: [line('PAP-IMP', 'Insumos de oficina', 60, 94_286, 19, 2.5, '5195', 'ADM')],
  }),
  invoice({
    kind: 'FC', number: 'FC-8845', partyId: 'p-tecnologia', date: '2026-02-03', dueDate: '2026-03-05',
    status: 'Contabilizada', dianStatus: 'No aplica',
    lines: [
      line('LIC-SW', 'Licencias ERP', 2, 3_500_000, 19, 2.5, '5195', 'ADM'),
      line('SERV-NUBE', 'Infraestructura nube', 3, 1_812_325, 19, 2.5, '5195', 'ADM'),
    ],
  }),
  invoice({
    kind: 'FC', number: 'FC-8852', partyId: 'p-arriendos', date: '2026-02-08', dueDate: '2026-03-10',
    status: 'Contabilizada', dianStatus: 'No aplica',
    lines: [line('SERV-NUBE', 'Arrendamiento sede principal', 1, 7_478_992, 19, 3.5, '5120', 'OPE')],
  }),
  invoice({
    kind: 'FC', number: 'FC-8864', partyId: 'p-servicios', date: '2026-02-16', dueDate: '2026-03-02',
    status: 'Contabilizada', dianStatus: 'No aplica', paymentTerm: 15,
    lines: [line('SERV-NUBE', 'Servicios públicos febrero', 1, 3_537_815, 19, 0, '5135', 'OPE')],
  }),
  invoice({
    kind: 'FC', number: 'FC-8870', partyId: 'p-auditores', date: '2026-02-22', dueDate: '2026-03-24',
    status: 'Contabilizada', dianStatus: 'No aplica',
    lines: [line('SRV-CONS', 'Auditoría externa', 20, 250_000, 19, 4, '5110', 'ADM')],
  }),
  invoice({
    kind: 'NC', number: 'NC-0098', partyId: 'p-abc', date: '2026-02-24', dueDate: '2026-02-24',
    status: 'Contabilizada', dianStatus: 'Aceptada', cufe: 'CUFE-NC-0098', resolutionId: 'res-nc',
    referenceId: 'inv-1', motive: 'Devolución parcial de servicios',
    lines: [line('SOP-ANU', 'Ajuste soporte febrero', 1, 1_042_017, 19, 0, '4155', 'ADM')],
  }),
  invoice({
    kind: 'ND', number: 'ND-0012', partyId: 'p-horizonte', date: '2026-02-25', dueDate: '2026-03-25',
    status: 'Borrador', dianStatus: 'No aplica', resolutionId: 'res-nc',
    referenceId: 'inv-8', motive: 'Intereses por mora',
    lines: [line('SRV-CONS', 'Intereses de financiación', 1, 1_554_622, 19, 0, '4155', 'OPE')],
  }),
];

// Los identificadores de documento son estables y se referencian desde cartera,
// CxP, DIAN y notas. Se asignan después de construir el arreglo.
invoices.forEach((item, index) => { item.id = `inv-${index + 1}`; });

const resolutions: Resolution[] = [
  { id: 'res-fv', prefix: 'FV', from: 1000, to: 1999, current: 1049, validFrom: '2026-01-01', validTo: '2026-12-31', type: 'Venta', active: true },
  { id: 'res-nc', prefix: 'NC', from: 1, to: 500, current: 99, validFrom: '2026-01-01', validTo: '2026-12-31', type: 'Venta', active: true },
  { id: 'res-fc', prefix: 'FC', from: 8000, to: 8999, current: 8871, validFrom: '2025-07-01', validTo: '2026-06-30', type: 'Compra', active: true },
];

const dianEvents: DianEvent[] = [
  { id: uid('dian'), invoiceId: 'inv-1', at: '2026-02-28 16:42', status: 'Aceptada', code: '00', message: 'Documento validado y aceptado por la DIAN.' },
  { id: uid('dian'), invoiceId: 'inv-3', at: '2026-02-26 10:18', status: 'Rechazada', code: 'FAB10', message: 'El municipio del adquiriente no corresponde al código de la dirección.' },
  { id: uid('dian'), invoiceId: 'inv-2', at: '2026-02-27 09:02', status: 'Pendiente', code: '—', message: 'Documento pendiente de envío al proveedor tecnológico.' },
  { id: uid('dian'), invoiceId: 'inv-5', at: '2026-02-18 17:31', status: 'Aceptada', code: '00', message: 'Acuse de recibo recibido. Documento aceptado.' },
];

const total = (inv: Invoice) => invoiceTotals(inv).total;

const receivables: Receivable[] = [
  { id: 'cxc-1', invoiceId: 'inv-1', invoiceNumber: 'FV-1048', partyId: 'p-abc', issueDate: '2026-02-28', dueDate: '2026-03-30', original: total(invoices[0]), balance: total(invoices[0]) - 1_240_000, status: 'Al día', owner: 'Laura Gómez', lastAction: 'Nota crédito NC-0098 aplicada', promiseDate: '', promiseAmount: 0 },
  { id: 'cxc-2', invoiceId: 'inv-4', invoiceNumber: 'FV-1045', partyId: 'p-andinos', issueDate: '2026-02-20', dueDate: '2026-03-22', original: total(invoices[3]), balance: total(invoices[3]), status: 'Por vencer', owner: 'Carlos Pérez', lastAction: 'Correo de bienvenida enviado', promiseDate: '', promiseAmount: 0 },
  { id: 'cxc-3', invoiceId: 'inv-5', invoiceNumber: 'FV-1044', partyId: 'p-logistico', issueDate: '2026-02-18', dueDate: '2026-03-20', original: total(invoices[4]), balance: total(invoices[4]), status: 'Por vencer', owner: 'Carlos Pérez', lastAction: 'Sin gestión', promiseDate: '', promiseAmount: 0 },
  { id: 'cxc-4', invoiceId: 'inv-6', invoiceNumber: 'FV-1043', partyId: 'p-abc', issueDate: '2026-01-15', dueDate: '2026-02-14', original: total(invoices[5]), balance: total(invoices[5]) - 7_000_000, status: 'Vencida', owner: 'Laura Gómez', lastAction: 'Promesa de pago para 05/03', promiseDate: '2026-03-05', promiseAmount: 5_000_000 },
  { id: 'cxc-5', invoiceId: 'inv-7', invoiceNumber: 'FV-1042', partyId: 'p-xyz', issueDate: '2026-02-02', dueDate: '2026-03-04', original: total(invoices[6]), balance: total(invoices[6]), status: 'Por vencer', owner: 'María Restrepo', lastAction: 'Recordatorio enviado', promiseDate: '', promiseAmount: 0 },
  { id: 'cxc-6', invoiceId: 'inv-8', invoiceNumber: 'FV-1041', partyId: 'p-horizonte', issueDate: '2026-02-22', dueDate: '2026-03-24', original: total(invoices[7]), balance: total(invoices[7]), status: 'Acuerdo de pago', owner: 'Laura Gómez', lastAction: 'Acuerdo firmado en dos cuotas', promiseDate: '2026-03-10', promiseAmount: 10_000_000 },
  { id: 'cxc-7', invoiceId: 'inv-9', invoiceNumber: 'FV-1035', partyId: 'p-andinos', issueDate: '2025-11-10', dueDate: '2025-12-10', original: total(invoices[8]), balance: 0, status: 'Castigada', owner: 'Laura Gómez', lastAction: 'Castigo aprobado en diciembre', promiseDate: '', promiseAmount: 0 },
];

const receipts: Receipt[] = [
  { id: 'rec-1', number: 'REC-1201', partyId: 'p-abc', date: '2026-02-20', method: 'Transferencia', accountId: 'acc-bcol', amount: 8_000_000, applied: 7_000_000, reference: 'Transferencia 884521', status: 'Parcial' },
  { id: 'rec-2', number: 'REC-1202', partyId: 'p-andinos', date: '2026-02-24', method: 'PSE', accountId: 'acc-bogota', amount: 2_000_000, applied: 0, reference: 'PSE 771204', status: 'Sin aplicar' },
  { id: 'rec-3', number: 'REC-1203', partyId: 'p-logistico', date: '2026-02-26', method: 'Cheque', accountId: 'acc-bcol', amount: 3_200_000, applied: 0, reference: 'Cheque 004512', status: 'Sin aplicar' },
  { id: 'rec-4', number: 'REC-1204', partyId: 'p-xyz', date: '2026-02-27', method: 'Transferencia', accountId: 'acc-davivienda', amount: 4_420_000, applied: 0, reference: 'ACH 620193', status: 'Sin aplicar' },
];

const applications: PaymentApplication[] = [
  { id: uid('app'), receiptId: 'rec-1', receivableId: 'cxc-4', amount: 7_000_000, date: '2026-02-20' },
];

const collections: CollectionAction[] = [
  { id: uid('col'), receivableId: 'cxc-4', date: '2026-02-18', channel: 'Llamada', result: 'Promesa', note: 'Cliente solicita plazo hasta el 5 de marzo por flujo de caja.', user: 'Laura Gómez', promiseDate: '2026-03-05', promiseAmount: 5_000_000, fulfilled: 'Pendiente' },
  { id: uid('col'), receivableId: 'cxc-4', date: '2026-02-10', channel: 'Correo', result: 'Sin respuesta', note: 'Recordatorio de vencimiento enviado a cartera.', user: 'Carlos Pérez', promiseDate: '', promiseAmount: 0, fulfilled: 'No aplica' },
  { id: uid('col'), receivableId: 'cxc-6', date: '2026-02-24', channel: 'Visita', result: 'Acuerdo', note: 'Se firma acuerdo de pago en dos cuotas.', user: 'Laura Gómez', promiseDate: '2026-03-10', promiseAmount: 10_000_000, fulfilled: 'Pendiente' },
  { id: uid('col'), receivableId: 'cxc-5', date: '2026-02-26', channel: 'Correo', result: 'Promesa', note: 'Confirman pago para el 4 de marzo.', user: 'María Restrepo', promiseDate: '2026-03-04', promiseAmount: 9_800_000, fulfilled: 'Pendiente' },
  { id: uid('col'), receivableId: 'cxc-4', date: '2026-01-20', channel: 'Llamada', result: 'Disputa', note: 'Cliente reclama una línea de soporte no prestada.', user: 'Laura Gómez', promiseDate: '', promiseAmount: 0, fulfilled: 'No aplica' },
];

const writeOffs: WriteOff[] = [
  { id: uid('wo'), receivableId: 'cxc-7', date: '2025-12-20', amount: total(invoices[8]), reason: 'Cliente sin contacto tras 90 días; agotadas las gestiones.', status: 'Aprobado', requestedBy: 'Laura Gómez' },
];

const IMPAIRMENT_RATE: Record<'Corriente' | '1–30' | '31–60' | '61–90' | '+90', number> = {
  Corriente: 0,
  '1–30': 1,
  '31–60': 5,
  '61–90': 15,
  '+90': 35,
};

const openReceivables = receivables.filter(receivable => receivable.balance > 0);

function impairmentRequired(rows: Receivable[]): number {
  return rows.reduce((total, receivable) => {
    const bucket = agingBucket(receivable.dueDate);
    return total + receivable.balance * (IMPAIRMENT_RATE[bucket] / 100);
  }, 0);
}

const impairmentProvisions: ImpairmentProvision[] = [
  {
    id: 'imp-2026-01',
    period: '2026-01',
    date: '2026-01-31',
    basis: 'NIIF 9',
    opening: 0,
    required: 7_850_000,
    charge: 7_850_000,
    recovery: 0,
    closing: 7_850_000,
    status: 'Contabilizada',
    approvedBy: 'María Restrepo',
    note: 'Provisión inicial calculada por edades de cartera.',
  },
];

const customerBalance = (partyId: string) => openReceivables
  .filter(receivable => receivable.partyId === partyId)
  .reduce((sum, receivable) => sum + receivable.balance, 0);

function reconciliation(partyId: string, adjustment: number, status: CustomerReconciliation['status'], note: string): CustomerReconciliation {
  const ledgerBalance = customerBalance(partyId);
  const statementBalance = ledgerBalance - adjustment;
  return {
    id: `conc-${partyId}`,
    period: '2026-02',
    partyId,
    ledgerBalance,
    statementBalance,
    difference: ledgerBalance - statementBalance,
    status,
    note,
    checkedBy: status === 'Conciliada' ? 'Laura Gómez' : '',
    checkedAt: status === 'Conciliada' ? '2026-02-27' : '',
    confirmedByClient: status === 'Conciliada',
  };
}

const customerReconciliations: CustomerReconciliation[] = [
  reconciliation('p-abc', -1_240_000, 'Con diferencia', 'El cliente no registra la nota crédito NC-0098; su estado de cuenta muestra mayor saldo.'),
  reconciliation('p-andinos', 0, 'Conciliada', 'Saldo confirmado por el cliente el 26 de febrero.'),
  reconciliation('p-logistico', 320_000, 'Pendiente', 'Pendiente respuesta del área contable del cliente.'),
  reconciliation('p-horizonte', 0, 'Conciliada', 'Acuerdo de pago conciliado con el estado de cuenta.'),
];

const advances: Advance[] = [
  { id: uid('adv'), number: 'ANT-0021', partyId: 'p-abc', date: '2026-02-12', amount: 5_000_000, applied: 0, reference: 'Anticipo orden de servicio OS-441', direction: 'AR' },
  { id: uid('adv'), number: 'ANT-0020', partyId: 'p-horizonte', date: '2026-02-05', amount: 3_000_000, applied: 1_000_000, reference: 'Anticipo interventoría', direction: 'AR' },
  { id: uid('adv'), number: 'ANT-P-0031', partyId: 'p-tecnologia', date: '2026-02-10', amount: 4_000_000, applied: 0, reference: 'Anticipo licencias', direction: 'AP' },
  { id: uid('adv'), number: 'ANT-P-0030', partyId: 'p-suministros', date: '2026-01-28', amount: 2_000_000, applied: 500_000, reference: 'Anticipo insumos', direction: 'AP' },
];

const payables: Payable[] = [
  { id: 'cxp-1', invoiceId: 'inv-10', invoiceNumber: 'FC-8831', partyId: 'p-suministros', issueDate: '2026-01-20', dueDate: '2026-02-19', original: total(invoices[9]), withholdings: invoiceTotals(invoices[9]).withholding, balance: total(invoices[9]), status: 'Vencida', priority: 'Alta', owner: 'Carlos Pérez' },
  { id: 'cxp-2', invoiceId: 'inv-11', invoiceNumber: 'FC-8845', partyId: 'p-tecnologia', issueDate: '2026-02-03', dueDate: '2026-03-05', original: total(invoices[10]), withholdings: invoiceTotals(invoices[10]).withholding, balance: total(invoices[10]), status: 'En propuesta', priority: 'Alta', owner: 'Laura Gómez' },
  { id: 'cxp-3', invoiceId: 'inv-12', invoiceNumber: 'FC-8852', partyId: 'p-arriendos', issueDate: '2026-02-08', dueDate: '2026-03-10', original: total(invoices[11]), withholdings: invoiceTotals(invoices[11]).withholding, balance: total(invoices[11]) - 3_000_000, status: 'Abierta', priority: 'Media', owner: 'María Restrepo' },
  { id: 'cxp-4', invoiceId: 'inv-13', invoiceNumber: 'FC-8864', partyId: 'p-servicios', issueDate: '2026-02-16', dueDate: '2026-03-02', original: total(invoices[12]), withholdings: invoiceTotals(invoices[12]).withholding, balance: 0, status: 'Pagada', priority: 'Media', owner: 'Carlos Pérez' },
  { id: 'cxp-5', invoiceId: 'inv-14', invoiceNumber: 'FC-8870', partyId: 'p-auditores', issueDate: '2026-02-22', dueDate: '2026-03-24', original: total(invoices[13]), withholdings: invoiceTotals(invoices[13]).withholding, balance: total(invoices[13]), status: 'Abierta', priority: 'Baja', owner: 'Laura Gómez' },
];

const proposals: PaymentProposal[] = [
  { id: 'prop-1', number: 'PROP-028', date: '2026-02-26', cutoff: '2026-03-05', payableIds: ['cxp-2'], status: 'Pendiente aprobación', createdBy: 'Carlos Pérez', approvedBy: '', rejectedReason: '', note: 'Pago de licencias e infraestructura.', accountId: 'acc-bcol' },
  { id: 'prop-2', number: 'PROP-027', date: '2026-02-20', cutoff: '2026-02-25', payableIds: ['cxp-4'], status: 'Pagada', createdBy: 'Carlos Pérez', approvedBy: 'Laura Gómez', rejectedReason: '', note: 'Servicios públicos febrero.', accountId: 'acc-bcol' },
  { id: 'prop-3', number: 'PROP-026', date: '2026-02-18', cutoff: '2026-02-20', payableIds: ['cxp-3'], status: 'Aprobada', createdBy: 'María Restrepo', approvedBy: 'Laura Gómez', rejectedReason: '', note: 'Abono arrendamiento sede principal.', accountId: 'acc-bogota' },
];

const payments: Payment[] = [
  { id: 'pay-1', number: 'PAG-4412', date: '2026-02-22', partyId: 'p-servicios', accountId: 'acc-bcol', amount: total(invoices[12]), applied: total(invoices[12]), method: 'Transferencia', reference: 'Pago servicios febrero', status: 'Aplicado', applications: [{ payableId: 'cxp-4', amount: total(invoices[12]) }] },
  { id: 'pay-2', number: 'PAG-4411', date: '2026-02-20', partyId: 'p-arriendos', accountId: 'acc-bogota', amount: 3_000_000, applied: 3_000_000, method: 'ACH', reference: 'Abono arriendo', status: 'Aplicado', applications: [{ payableId: 'cxp-3', amount: 3_000_000 }] },
];

const retentions: Retention[] = [
  { id: uid('ret'), invoiceId: 'inv-10', partyId: 'p-suministros', concept: 'Retención en la fuente', base: invoiceTotals(invoices[9]).subtotal, rate: 2.5, amount: invoiceTotals(invoices[9]).withholding, period: '2026-02', certificateNumber: '', status: 'Calculada', date: '2026-02-19' },
  { id: uid('ret'), invoiceId: 'inv-11', partyId: 'p-tecnologia', concept: 'Retención en la fuente', base: invoiceTotals(invoices[10]).subtotal, rate: 2.5, amount: invoiceTotals(invoices[10]).withholding, period: '2026-02', certificateNumber: '', status: 'Calculada', date: '2026-02-03' },
  { id: uid('ret'), invoiceId: 'inv-12', partyId: 'p-arriendos', concept: 'Retención en la fuente', base: invoiceTotals(invoices[11]).subtotal, rate: 3.5, amount: invoiceTotals(invoices[11]).withholding, period: '2026-02', certificateNumber: 'RET-2026-0012', status: 'Certificada', date: '2026-02-08' },
  { id: uid('ret'), invoiceId: 'inv-14', partyId: 'p-auditores', concept: 'Retención en la fuente', base: invoiceTotals(invoices[13]).subtotal, rate: 4, amount: invoiceTotals(invoices[13]).withholding, period: '2026-02', certificateNumber: 'RET-2026-0013', status: 'Certificada', date: '2026-02-22' },
  { id: uid('ret'), invoiceId: 'inv-10', partyId: 'p-suministros', concept: 'ReteICA', base: invoiceTotals(invoices[9]).subtotal, rate: 0.414, amount: 23_420, period: '2026-02', certificateNumber: '', status: 'Calculada', date: '2026-02-19' },
];

const taxFilings: TaxFiling[] = [
  {
    ...buildFiling({ invoices, retentions }, '300', '2026-02'),
    note: 'IVA del primer bimestre de 2026, calculado desde las facturas contabilizadas.',
  },
  {
    ...buildFiling({ invoices, retentions }, '350', '2026-02'),
    status: 'Borrador',
    note: 'Retenciones de febrero pendientes de revisión por el área tributaria.',
  },
  {
    ...buildFiling({ invoices, retentions }, '110', '2025'),
    status: 'Presentada',
    presentedAt: '2026-04-10',
    receipt: 'DIAN-110-2025-004217',
    note: 'Declaración de renta del ejercicio 2025 presentada en abril de 2026.',
  },
];

const exogenousReports: ExogenousReport[] = [
  {
    id: 'exo-2025',
    year: 2025,
    status: 'En preparación',
    dueDate: '2026-05-22',
    rows: [
      { id: 'exo-1001', format: '1001', concept: 'Pagos y abonos en cuenta', thirdParties: 38, total: 1_842_000_000, issues: 0 },
      { id: 'exo-1005', format: '1005', concept: 'IVA descontable', thirdParties: 24, total: 94_300_000, issues: 2 },
      { id: 'exo-1006', format: '1006', concept: 'IVA generado', thirdParties: 31, total: 148_900_000, issues: 0 },
      { id: 'exo-1007', format: '1007', concept: 'Retenciones en la fuente', thirdParties: 22, total: 52_640_000, issues: 1 },
      { id: 'exo-1008', format: '1008', concept: 'Retenciones de IVA', thirdParties: 4, total: 0, issues: 0 },
      { id: 'exo-1009', format: '1009', concept: 'Retenciones y autorretenciones', thirdParties: 19, total: 47_800_000, issues: 0 },
      { id: 'exo-1010', format: '1010', concept: 'Pagos al exterior', thirdParties: 3, total: 86_400_000, issues: 0 },
    ],
    note: 'Medios magnéticos del ejercicio 2025; faltan dos terceros por validar en el formato 1005.',
    presentedAt: '',
    receipt: '',
  },
];

const expenses: Expense[] = [
  { id: 'gas-1', number: 'GAS-0101', date: '2026-02-14', employee: 'Laura Gómez', category: 'Viaje', costCenter: 'ADM', amount: 1_850_000, tax: 0, support: 'Factura hotel y tiquetes', status: 'Aprobado', note: 'Visita a cliente en Medellín.' },
  { id: 'gas-2', number: 'GAS-0102', date: '2026-02-21', employee: 'Carlos Pérez', category: 'Papelería', costCenter: 'ADM', amount: 320_000, tax: 60_800, support: 'Factura papelería', status: 'Pendiente aprobación', note: 'Insumos para archivo.' },
  { id: 'gas-3', number: 'GAS-0103', date: '2026-02-05', employee: 'María Restrepo', category: 'Capacitación', costCenter: 'ADM', amount: 2_400_000, tax: 0, support: 'Certificado curso', status: 'Reembolsado', note: 'Curso de normativa tributaria.' },
  { id: 'gas-4', number: 'GAS-0104', date: '2026-02-27', employee: 'Carlos Pérez', category: 'Transporte', costCenter: 'OPE', amount: 480_000, tax: 0, support: '', status: 'Borrador', note: 'Desplazamientos operativos.' },
];

const supplierAdjustments: SupplierAdjustment[] = [
  {
    id: 'adj-1', number: 'ADJ-0001', payableId: 'cxp-1', partyId: 'p-suministros', date: '2026-02-19',
    kind: 'Descuento pronto pago', base: 6_732_000, rate: 2, amount: 134_640,
    status: 'Aplicado', requestedBy: 'Carlos Pérez', approvedBy: 'Laura Gómez',
    note: 'Descuento del 2 % por pago dentro de los 10 días.',
  },
  {
    id: 'adj-2', number: 'ADJ-0002', payableId: 'cxp-3', partyId: 'p-arriendos', date: '2026-02-24',
    kind: 'Nota débito', base: 8_900_000, rate: 0, amount: 450_000,
    status: 'Aprobado', requestedBy: 'María Restrepo', approvedBy: 'Laura Gómez',
    note: 'Servicios públicos del inmueble facturados por el arrendador.',
  },
  {
    id: 'adj-3', number: 'ADJ-0003', payableId: 'cxp-2', partyId: 'p-tecnologia', date: '2026-02-27',
    kind: 'Nota crédito', base: 14_800_000, rate: 0, amount: 980_000,
    status: 'Borrador', requestedBy: 'Carlos Pérez', approvedBy: '',
    note: 'Licencias no entregadas en la factura FC-8845.',
  },
];

const supplierBalance = (partyId: string) => payables
  .filter(payable => payable.partyId === partyId)
  .reduce((sum, payable) => sum + payable.balance, 0);

function supplierReconciliation(partyId: string, adjustment: number, status: SupplierReconciliation['status'], note: string, confirmed: boolean): SupplierReconciliation {
  const ledgerBalance = supplierBalance(partyId);
  const statementBalance = ledgerBalance - adjustment;
  return {
    id: `sconc-${partyId}`,
    period: '2026-02',
    partyId,
    ledgerBalance,
    statementBalance,
    difference: ledgerBalance - statementBalance,
    status,
    note,
    checkedBy: confirmed ? 'Carlos Pérez' : '',
    checkedAt: confirmed ? '2026-02-27' : '',
    confirmedBySupplier: confirmed,
  };
}

const supplierReconciliations: SupplierReconciliation[] = [
  supplierReconciliation('p-suministros', 0, 'Conciliada', 'Proveedor confirmó el saldo y el descuento pronto pago.', true),
  supplierReconciliation('p-tecnologia', 980_000, 'Con diferencia', 'Falta aplicar la nota crédito ADJ-0003.', false),
  supplierReconciliation('p-arriendos', 450_000, 'Pendiente', 'Nota débito ADJ-0002 en revisión por el proveedor.', false),
  supplierReconciliation('p-auditores', 0, 'Conciliada', 'Saldo confirmado por correo el 25 de febrero.', true),
];

const accounts: BankAccount[] = [
  { id: 'acc-bcol', kind: 'Banco', bank: 'Bancolombia', number: '4589', currency: 'COP', ledgerAccount: '11100501', initial: 120_000_000, balance: 128_450_000, status: 'Activa', responsible: 'Laura Gómez' },
  { id: 'acc-bogota', kind: 'Banco', bank: 'Banco de Bogotá', number: '1821', currency: 'COP', ledgerAccount: '11100502', initial: 42_000_000, balance: 46_220_000, status: 'Activa', responsible: 'María Restrepo' },
  { id: 'acc-davivienda', kind: 'Banco', bank: 'Davivienda', number: '9012', currency: 'COP', ledgerAccount: '11100503', initial: 28_000_000, balance: 28_730_000, status: 'Activa', responsible: 'Carlos Pérez' },
  { id: 'acc-caja', kind: 'Caja', bank: 'Caja general', number: 'CAJA-01', currency: 'COP', ledgerAccount: '11050501', initial: 11_300_000, balance: 11_300_000, status: 'Activa', responsible: 'Carlos Pérez' },
];

const statements: BankStatement[] = [
  { id: 'ext-1', accountId: 'acc-bcol', from: '2026-02-01', to: '2026-02-28', opening: 120_000_000, closing: 128_450_000, status: 'Abierto', fileName: 'bancolombia_4589_feb2026.csv' },
  { id: 'ext-2', accountId: 'acc-bogota', from: '2026-02-01', to: '2026-02-28', opening: 42_000_000, closing: 46_220_000, status: 'Validado', fileName: 'bogota_1821_feb2026.xlsx' },
  { id: 'ext-3', accountId: 'acc-davivienda', from: '2026-02-01', to: '2026-02-28', opening: 28_000_000, closing: 28_730_000, status: 'Abierto', fileName: 'davivienda_9012_feb2026.ofx' },
];

const statementLines: StatementLine[] = [
  { id: 'sl-1', statementId: 'ext-1', date: '2026-02-03', reference: 'REC-1201', description: 'Transferencia recibida ABC Comercial', debit: 0, credit: 8_000_000, balance: 128_000_000, matched: 0, suggestion: 'Recibo REC-1201 · 100 %', status: 'Sugerido' },
  { id: 'sl-2', statementId: 'ext-1', date: '2026-02-05', reference: 'PAG-4411', description: 'Pago ACH arrendamientos', debit: 3_000_000, credit: 0, balance: 125_000_000, matched: 0, suggestion: 'Pago PAG-4411 · 100 %', status: 'Sugerido' },
  { id: 'sl-3', statementId: 'ext-1', date: '2026-02-10', reference: 'TRF-088', description: 'Transferencia entre cuentas propias', debit: 12_000_000, credit: 0, balance: 113_000_000, matched: 0, suggestion: 'Transferencia TRF-088 · 95 %', status: 'Pendiente' },
  { id: 'sl-4', statementId: 'ext-1', date: '2026-02-15', reference: 'COM-0221', description: 'Comisión por transferencia ACH', debit: 385_000, credit: 0, balance: 112_615_000, matched: 0, suggestion: 'Ajuste por comisión bancaria', status: 'Diferencia' },
  { id: 'sl-5', statementId: 'ext-1', date: '2026-02-20', reference: 'REC-1198', description: 'Recaudo cliente XYZ', debit: 0, credit: 15_835_000, balance: 128_450_000, matched: 0, suggestion: 'Recibo no registrado', status: 'Pendiente' },
  { id: 'sl-6', statementId: 'ext-2', date: '2026-02-12', reference: 'PAG-4410', description: 'Pago proveedor servicios', debit: 4_210_000, credit: 0, balance: 37_790_000, matched: 4_210_000, suggestion: 'Pago PAG-4410 · 100 %', status: 'Conciliado' },
  { id: 'sl-7', statementId: 'ext-2', date: '2026-02-18', reference: 'REC-1195', description: 'Recaudo cliente Andinos', debit: 0, credit: 8_430_000, balance: 46_220_000, matched: 8_430_000, suggestion: 'Recibo REC-1195 · 100 %', status: 'Conciliado' },
  { id: 'sl-8', statementId: 'ext-3', date: '2026-02-22', reference: 'REN-0226', description: 'Rendimientos financieros', debit: 0, credit: 730_000, balance: 28_730_000, matched: 0, suggestion: 'Ajuste por rendimientos', status: 'Diferencia' },
];

const rules: ReconciliationRule[] = [
  { id: 'rule-1', name: 'Recaudos por referencia', field: 'Referencia', operator: 'Contiene', value: 'REC-', action: 'Cruzar con recibos de caja', priority: 1, active: true, matches: 42 },
  { id: 'rule-2', name: 'Pagos por referencia', field: 'Referencia', operator: 'Contiene', value: 'PAG-', action: 'Cruzar con pagos', priority: 2, active: true, matches: 31 },
  { id: 'rule-3', name: 'Comisiones bancarias', field: 'Descripción', operator: 'Contiene', value: 'COMISI', action: 'Crear ajuste de comisión', priority: 3, active: true, matches: 9 },
  { id: 'rule-4', name: 'Transferencias ACH', field: 'Importe', operator: 'Igual a', value: '12000000', action: 'Cruzar con transferencias', priority: 4, active: false, matches: 0 },
];

const reconciliations: Reconciliation[] = [
  { id: uid('con'), statementLineId: 'sl-6', bookType: 'Pago', bookRef: 'PAG-4410', amount: 4_210_000, difference: 0, note: '', date: '2026-02-28', user: 'Laura Gómez' },
  { id: uid('con'), statementLineId: 'sl-7', bookType: 'Recibo', bookRef: 'REC-1195', amount: 8_430_000, difference: 0, note: '', date: '2026-02-28', user: 'María Restrepo' },
];

const transfers: Transfer[] = [
  { id: 'trf-1', number: 'TRF-088', date: '2026-02-10', fromId: 'acc-bcol', toId: 'acc-bogota', amount: 12_000_000, fee: 0, reference: 'Traslado a cuenta operativa', status: 'Registrada' },
  { id: 'trf-2', number: 'TRF-087', date: '2026-02-04', fromId: 'acc-bogota', toId: 'acc-caja', amount: 2_000_000, fee: 0, reference: 'Reposición caja menor', status: 'Conciliada' },
  { id: 'trf-3', number: 'TRF-086', date: '2026-01-28', fromId: 'acc-davivienda', toId: 'acc-bcol', amount: 6_500_000, fee: 12_000, reference: 'Consolidación de disponibilidad', status: 'Conciliada' },
];

const checks: Check[] = [
  { id: 'chk-1', number: 'CH-1042', accountId: 'acc-bogota', beneficiary: 'Arrendamientos Capital S.A.S.', amount: 2_500_000, issueDate: '2026-02-24', dueDate: '2026-03-05', status: 'Emitido' },
  { id: 'chk-2', number: 'CH-1041', accountId: 'acc-bcol', beneficiary: 'Tecnología y Procesos S.A.S.', amount: 4_000_000, issueDate: '2026-02-12', dueDate: '2026-02-25', status: 'Cobrado' },
  { id: 'chk-3', number: 'CH-1040', accountId: 'acc-bcol', beneficiary: 'Suministros Técnicos del Norte Ltda.', amount: 1_200_000, issueDate: '2026-02-02', dueDate: '2026-02-15', status: 'Anulado' },
];

const cashMovements = (prefix: string, rows: Array<Omit<CashMovement, 'id'>>): CashMovement[] =>
  rows.map(row => ({ ...row, id: uid(prefix) }));

const pettyCashes: PettyCash[] = [
  {
    id: 'cash-1', name: 'Caja menor Administración', responsible: 'Laura Gómez', opening: 2_000_000, balance: 1_350_000, status: 'Abierta',
    movements: cashMovements('cm', [
      { date: '2026-02-03', type: 'Egreso', concept: 'Mensajería', amount: 120_000, support: 'Recibo 001', responsible: 'Laura Gómez' },
      { date: '2026-02-12', type: 'Egreso', concept: 'Papelería', amount: 280_000, support: 'Factura 884', responsible: 'Laura Gómez' },
      { date: '2026-02-25', type: 'Egreso', concept: 'Cafetería reunión', amount: 250_000, support: 'Recibo 002', responsible: 'Laura Gómez' },
    ]),
  },
  {
    id: 'cash-2', name: 'Caja menor Operaciones', responsible: 'Carlos Pérez', opening: 1_500_000, balance: 1_500_000, status: 'Cerrada',
    movements: [],
  },
];

function splitAnnual(annual: number): number[] {
  const base = Math.round(annual / 12);
  const months = Array.from({ length: 12 }, () => base);
  months[11] += annual - base * 12;
  return months;
}

function budgetLine(
  account: string,
  accountName: string,
  costCenter: string,
  annual: number,
  executed: number,
  committed: number,
): BudgetLine {
  return {
    id: uid('bline'),
    account,
    accountName,
    costCenter,
    monthly: splitAnnual(annual),
    executed,
    committed,
  };
}

const budgets: BudgetVersion[] = [
  {
    id: 'bgt-v3', name: 'Presupuesto 2026 V3', year: 2026, scenario: 'Base', status: 'Aprobada', owner: 'Laura Gómez',
    approvedBy: 'María del Pilar Restrepo', approvedAt: '2026-01-20', note: 'Versión vigente aprobada por comité de presupuesto.', current: true,
    lines: [
      budgetLine('5105', 'Gastos de personal', 'ADM', 486_000_000, 58_700_000, 12_000_000),
      budgetLine('5110', 'Honorarios', 'ADM', 96_000_000, 18_800_000, 4_000_000),
      budgetLine('5120', 'Arrendamientos', 'OPE', 144_000_000, 21_600_000, 8_000_000),
      budgetLine('5135', 'Servicios', 'OPE', 82_000_000, 20_900_000, 6_000_000),
      budgetLine('5195', 'Diversos', 'VEN', 68_000_000, 22_600_000, 9_000_000),
      budgetLine('5205', 'Transporte', 'OPE', 120_000_000, 15_000_000, 10_000_000),
      budgetLine('5305', 'Financieros', 'ADM', 70_000_000, 9_000_000, 2_000_000),
      budgetLine('5405', 'Impuestos', 'ADM', 218_000_000, 18_000_000, 41_800_000),
    ],
  },
  {
    id: 'bgt-v4', name: 'Presupuesto 2026 V4', year: 2026, scenario: 'Base', status: 'En revisión', owner: 'Carlos Pérez',
    approvedBy: '', approvedAt: '', note: 'Ajuste por mayor gasto de personal y servicios.', current: false,
    lines: [
      budgetLine('5105', 'Gastos de personal', 'ADM', 507_000_000, 0, 0),
      budgetLine('5110', 'Honorarios', 'ADM', 100_000_000, 0, 0),
      budgetLine('5120', 'Arrendamientos', 'OPE', 150_000_000, 0, 0),
      budgetLine('5135', 'Servicios', 'OPE', 86_000_000, 0, 0),
      budgetLine('5195', 'Diversos', 'VEN', 71_000_000, 0, 0),
      budgetLine('5205', 'Transporte', 'OPE', 125_000_000, 0, 0),
      budgetLine('5305', 'Financieros', 'ADM', 73_000_000, 0, 0),
      budgetLine('5405', 'Impuestos', 'ADM', 228_000_000, 0, 0),
    ],
  },
  {
    id: 'bgt-v2', name: 'Presupuesto 2025 V2', year: 2025, scenario: 'Base', status: 'Cerrada', owner: 'Laura Gómez',
    approvedBy: 'María del Pilar Restrepo', approvedAt: '2025-01-15', note: 'Cerrado al 31 de diciembre de 2025.', current: false,
    lines: [
      budgetLine('5105', 'Gastos de personal', 'ADM', 410_000_000, 410_000_000, 0),
      budgetLine('5110', 'Honorarios', 'ADM', 88_000_000, 88_000_000, 0),
      budgetLine('5120', 'Arrendamientos', 'OPE', 132_000_000, 132_000_000, 0),
      budgetLine('5135', 'Servicios', 'OPE', 78_000_000, 78_000_000, 0),
      budgetLine('5195', 'Diversos', 'VEN', 60_000_000, 60_000_000, 0),
      budgetLine('5205', 'Transporte', 'OPE', 110_000_000, 110_000_000, 0),
      budgetLine('5305', 'Financieros', 'ADM', 65_000_000, 65_000_000, 0),
      budgetLine('5405', 'Impuestos', 'ADM', 177_000_000, 177_000_000, 0),
    ],
  },
  {
    id: 'bgt-v5', name: 'Escenario optimista 2026', year: 2026, scenario: 'Optimista', status: 'Borrador', owner: 'María Restrepo',
    approvedBy: '', approvedAt: '', note: 'Simulación con crecimiento de ventas del 12 %.', current: false,
    lines: [
      budgetLine('5105', 'Gastos de personal', 'ADM', 540_000_000, 0, 0),
      budgetLine('5110', 'Honorarios', 'ADM', 110_000_000, 0, 0),
      budgetLine('5120', 'Arrendamientos', 'OPE', 160_000_000, 0, 0),
      budgetLine('5135', 'Servicios', 'OPE', 95_000_000, 0, 0),
      budgetLine('5195', 'Diversos', 'VEN', 82_000_000, 0, 0),
      budgetLine('5205', 'Transporte', 'OPE', 140_000_000, 0, 0),
      budgetLine('5305', 'Financieros', 'ADM', 75_000_000, 0, 0),
      budgetLine('5405', 'Impuestos', 'ADM', 258_000_000, 0, 0),
    ],
  },
];

const budgetAlerts = [
  { id: 'alert-1', versionId: 'bgt-v3', account: '5195', center: 'VEN', type: 'Umbral' as const, message: 'Diversos alcanzó 79,4 % de ejecución y compromiso.', severity: 'Alta' as const, status: 'Abierta' as const, date: '2026-02-27' },
  { id: 'alert-2', versionId: 'bgt-v3', account: '5135', center: 'OPE', type: 'Desviación' as const, message: 'Servicios supera el presupuesto mensual en 8,2 %.', severity: 'Media' as const, status: 'Abierta' as const, date: '2026-02-25' },
  { id: 'alert-3', versionId: 'bgt-v3', account: '5405', center: 'ADM', type: 'Compromiso' as const, message: 'Compromisos de impuestos superan el 19 % del anual.', severity: 'Media' as const, status: 'Abierta' as const, date: '2026-02-22' },
  { id: 'alert-4', versionId: 'bgt-v3', account: '5110', center: 'ADM', type: 'Umbral' as const, message: 'Honorarios llegó al 23,8 % de ejecución con dos contratos nuevos.', severity: 'Baja' as const, status: 'Silenciada' as const, date: '2026-02-18' },
];

const budgetProjections: BudgetProjection[] = [
  {
    id: 'bproj-1', versionId: 'bgt-v3', project: 'Expansión zona norte', center: 'OPE', owner: 'Laura Gómez',
    budget: 168_000_000, executed: 52_400_000,
    monthly: [8_000_000, 9_200_000, 9_800_000, 10_500_000, 11_000_000, 11_800_000, 12_400_000, 13_100_000, 14_000_000, 15_200_000, 16_400_000, 17_600_000],
    status: 'En curso', note: 'Apertura de dos puntos de distribución en la zona norte.',
  },
  {
    id: 'bproj-2', versionId: 'bgt-v3', project: 'Automatización de empaque', center: 'OPE', owner: 'Jorge Ramírez',
    budget: 240_000_000, executed: 118_000_000,
    monthly: [12_000_000, 14_000_000, 16_000_000, 18_000_000, 19_000_000, 20_000_000, 21_000_000, 22_000_000, 23_000_000, 24_000_000, 25_000_000, 26_000_000],
    status: 'En curso', note: 'Segunda fase de la línea de empaque automatizada.',
  },
  {
    id: 'bproj-3', versionId: 'bgt-v3', project: 'Transformación digital', center: 'TI', owner: 'Diana Rojas',
    budget: 96_000_000, executed: 71_500_000,
    monthly: [9_000_000, 9_000_000, 8_500_000, 8_000_000, 7_500_000, 7_000_000, 6_500_000, 6_000_000, 5_500_000, 5_000_000, 4_500_000, 4_000_000],
    status: 'Cierre estimado', note: 'Migración de ERP y tablero gerencial; cierra en el tercer trimestre.',
  },
  {
    id: 'bproj-4', versionId: 'bgt-v3', project: 'Programa de fidelización', center: 'VEN', owner: 'Carlos Pérez',
    budget: 54_000_000, executed: 12_300_000,
    monthly: [3_000_000, 3_500_000, 4_000_000, 4_500_000, 5_000_000, 5_500_000, 5_500_000, 5_000_000, 5_000_000, 4_500_000, 4_500_000, 4_000_000],
    status: 'En curso', note: 'Lanzamiento del programa de puntos y CRM comercial.',
  },
];

const assetCategories: AssetCategory[] = [
  {
    id: 'cat-edif', code: '1516', name: 'Construcciones y edificaciones',
    assetAccount: '1516', depreciationAccount: '5160', accumulatedAccount: '1592',
    impairmentAccount: '1596', revaluationAccount: '3805',
    usefulLifeMonths: 240, taxUsefulLifeMonths: 240, residualPct: 10,
    method: 'Línea recta', depreciable: true, active: true,
    note: 'NIC 16 · Art. 137 ET: 20 años de vida útil fiscal.',
  },
  {
    id: 'cat-maq', code: '1520', name: 'Maquinaria y equipo',
    assetAccount: '1520', depreciationAccount: '5160', accumulatedAccount: '1592',
    impairmentAccount: '1596', revaluationAccount: '3805',
    usefulLifeMonths: 120, taxUsefulLifeMonths: 120, residualPct: 0,
    method: 'Línea recta', depreciable: true, active: true,
    note: 'NIC 16 · Art. 137 ET: 10 años de vida útil fiscal.',
  },
  {
    id: 'cat-ofi', code: '1524', name: 'Muebles y equipo de oficina',
    assetAccount: '1524', depreciationAccount: '5160', accumulatedAccount: '1592',
    impairmentAccount: '1596', revaluationAccount: '3805',
    usefulLifeMonths: 120, taxUsefulLifeMonths: 120, residualPct: 0,
    method: 'Línea recta', depreciable: true, active: true,
    note: 'NIC 16 · Art. 137 ET: 10 años de vida útil fiscal.',
  },
  {
    id: 'cat-comp', code: '1528', name: 'Equipo de computación y comunicación',
    assetAccount: '1528', depreciationAccount: '5160', accumulatedAccount: '1592',
    impairmentAccount: '1596', revaluationAccount: '3805',
    usefulLifeMonths: 60, taxUsefulLifeMonths: 60, residualPct: 0,
    method: 'Línea recta', depreciable: true, active: true,
    note: 'NIC 16 · Art. 137 ET: 5 años de vida útil fiscal.',
  },
  {
    id: 'cat-flota', code: '1540', name: 'Flota y equipo de transporte',
    assetAccount: '1540', depreciationAccount: '5160', accumulatedAccount: '1592',
    impairmentAccount: '1596', revaluationAccount: '3805',
    usefulLifeMonths: 60, taxUsefulLifeMonths: 60, residualPct: 10,
    method: 'Línea recta', depreciable: true, active: true,
    note: 'NIC 16 · Art. 137 ET: 5 años de vida útil fiscal.',
  },
  {
    id: 'cat-terreno', code: '1504', name: 'Terrenos',
    assetAccount: '1504', depreciationAccount: '5160', accumulatedAccount: '1592',
    impairmentAccount: '1596', revaluationAccount: '3805',
    usefulLifeMonths: 0, taxUsefulLifeMonths: 0, residualPct: 0,
    method: 'Línea recta', depreciable: false, active: true,
    note: 'NIC 16: los terrenos no se deprecian; solo admiten deterioro o revalorización.',
  },
];

const assets: Asset[] = [
  {
    id: 'af-0001', code: 'AF-0001', name: 'Sede administrativa principal',
    description: 'Edificio administrativo de tres pisos, sede principal en Bogotá.',
    categoryId: 'cat-edif', serial: 'INM-SEDE-001', plate: '', location: 'Sede principal · Bogotá',
    costCenter: 'ADM', responsible: 'María del Pilar Restrepo', supplier: 'Constructora Horizonte S.A.S.',
    invoiceRef: 'FC-2018-0412', acquisitionDate: '2018-03-15', inServiceDate: '2018-04-01',
    acquisitionCost: 2_400_000_000, improvements: 0, revaluation: 180_000_000, impairment: 0,
    residualValue: 240_000_000, usefulLifeMonths: 240, method: 'Línea recta',
    depreciatedMonths: 93, accumulatedDepreciation: 837_000_000, lastDepreciation: '2026-01',
    estimatedUnits: 0, producedUnits: 0, status: 'En operación',
    insurancePolicy: 'POL-INM-88412', warrantyUntil: '', disposedAt: '', disposalValue: 0,
    notes: 'Avalúo técnico de diciembre de 2025 aplicado por $ 180.000.000.',
  },
  {
    id: 'af-0002', code: 'AF-0002', name: 'Bodega de distribución norte',
    description: 'Bodega logística con oficinas anexas y zona de despacho.',
    categoryId: 'cat-edif', serial: 'INM-BOD-002', plate: '', location: 'Bodega norte · Bogotá',
    costCenter: 'OPE', responsible: 'Carlos Pérez', supplier: 'Constructora Horizonte S.A.S.',
    invoiceRef: 'FC-2020-1187', acquisitionDate: '2020-07-01', inServiceDate: '2020-08-01',
    acquisitionCost: 1_200_000_000, improvements: 0, revaluation: 0, impairment: 0,
    residualValue: 120_000_000, usefulLifeMonths: 240, method: 'Línea recta',
    depreciatedMonths: 65, accumulatedDepreciation: 292_500_000, lastDepreciation: '2026-01',
    estimatedUnits: 0, producedUnits: 0, status: 'En operación',
    insurancePolicy: 'POL-INM-88413', warrantyUntil: '', disposedAt: '', disposalValue: 0,
    notes: 'Avalúo 2026 aprobado, pendiente de aplicación al mayor.',
  },
  {
    id: 'af-0003', code: 'AF-0003', name: 'Línea de empaque automatizada',
    description: 'Línea de empaque primario y secundario con banda transportadora.',
    categoryId: 'cat-maq', serial: 'MAQ-EMP-310', plate: '', location: 'Planta de producción · Bogotá',
    costCenter: 'OPE', responsible: 'Jorge Ramírez', supplier: 'Tecnología y Procesos S.A.S.',
    invoiceRef: 'FC-2021-0771', acquisitionDate: '2021-05-20', inServiceDate: '2021-06-01',
    acquisitionCost: 850_000_000, improvements: 0, revaluation: 0, impairment: 0,
    residualValue: 0, usefulLifeMonths: 120, method: 'Línea recta',
    depreciatedMonths: 55, accumulatedDepreciation: 389_583_333, lastDepreciation: '2026-01',
    estimatedUnits: 0, producedUnits: 0, status: 'En operación',
    insurancePolicy: 'POL-MAQ-22018', warrantyUntil: '2026-06-30', disposedAt: '', disposalValue: 0,
    notes: 'Activo principal de la planta; mantenimiento preventivo trimestral.',
  },
  {
    id: 'af-0004', code: 'AF-0004', name: 'Compresor industrial 75 HP',
    description: 'Compresor de tornillo para línea neumática de la planta.',
    categoryId: 'cat-maq', serial: 'MAQ-COM-118', plate: '', location: 'Planta de producción · Bogotá',
    costCenter: 'OPE', responsible: 'Jorge Ramírez', supplier: 'Suministros Técnicos del Norte Ltda.',
    invoiceRef: 'FC-2022-0934', acquisitionDate: '2022-09-10', inServiceDate: '2022-10-01',
    acquisitionCost: 180_000_000, improvements: 0, revaluation: 0, impairment: 0,
    residualValue: 0, usefulLifeMonths: 120, method: 'Línea recta',
    depreciatedMonths: 39, accumulatedDepreciation: 58_500_000, lastDepreciation: '2026-01',
    estimatedUnits: 0, producedUnits: 0, status: 'En operación',
    insurancePolicy: 'POL-MAQ-22019', warrantyUntil: '2025-09-10', disposedAt: '', disposalValue: 0,
    notes: '',
  },
  {
    id: 'af-0005', code: 'AF-0005', name: 'Montacargas eléctrico 2,5 T',
    description: 'Montacargas eléctrico para movimiento de producto terminado.',
    categoryId: 'cat-maq', serial: 'MAQ-MON-045', plate: '', location: 'Bodega norte · Bogotá',
    costCenter: 'OPE', responsible: 'Andrés Molina', supplier: 'Equipos y Montajes S.A.S.',
    invoiceRef: 'FC-2023-0210', acquisitionDate: '2023-02-15', inServiceDate: '2023-03-01',
    acquisitionCost: 145_000_000, improvements: 0, revaluation: 0, impairment: 0,
    residualValue: 0, usefulLifeMonths: 120, method: 'Unidades de producción',
    depreciatedMonths: 34, accumulatedDepreciation: 49_300_000, lastDepreciation: '2026-01',
    estimatedUnits: 100_000, producedUnits: 34_000, status: 'En operación',
    insurancePolicy: 'POL-MAQ-22020', warrantyUntil: '2026-02-15', disposedAt: '', disposalValue: 0,
    notes: 'Deprecia por horas de operación acumuladas. Unidades estimadas: 100.000 horas.',
  },
  {
    id: 'af-0006', code: 'AF-0006', name: 'Camión de reparto NPR',
    description: 'Camión de reparto de 4 toneladas para distribución urbana.',
    categoryId: 'cat-flota', serial: 'VEH-NPR-771', plate: 'JKL-482', location: 'Centro de distribución · Bogotá',
    costCenter: 'VEN', responsible: 'Luis Cárdenas', supplier: 'Autos y Camiones del Sur S.A.S.',
    invoiceRef: 'FC-2022-0455', acquisitionDate: '2022-04-01', inServiceDate: '2022-05-01',
    acquisitionCost: 320_000_000, improvements: 0, revaluation: 0, impairment: 0,
    residualValue: 32_000_000, usefulLifeMonths: 60, method: 'Línea recta',
    depreciatedMonths: 44, accumulatedDepreciation: 211_200_000, lastDepreciation: '2026-01',
    estimatedUnits: 0, producedUnits: 0, status: 'En operación',
    insurancePolicy: 'POL-FLT-5512', warrantyUntil: '', disposedAt: '', disposalValue: 0,
    notes: '',
  },
  {
    id: 'af-0007', code: 'AF-0007', name: 'Camioneta de gerencia',
    description: 'Camioneta blindada asignada a la gerencia general.',
    categoryId: 'cat-flota', serial: 'VEH-CAM-204', plate: 'HQR-913', location: 'Sede principal · Bogotá',
    costCenter: 'ADM', responsible: 'María del Pilar Restrepo', supplier: 'Autos y Camiones del Sur S.A.S.',
    invoiceRef: 'FC-2023-0688', acquisitionDate: '2023-06-15', inServiceDate: '2023-07-01',
    acquisitionCost: 185_000_000, improvements: 0, revaluation: 0, impairment: 0,
    residualValue: 18_500_000, usefulLifeMonths: 60, method: 'Línea recta',
    depreciatedMonths: 30, accumulatedDepreciation: 83_250_000, lastDepreciation: '2026-01',
    estimatedUnits: 0, producedUnits: 0, status: 'En operación',
    insurancePolicy: 'POL-FLT-5513', warrantyUntil: '', disposedAt: '', disposalValue: 0,
    notes: '',
  },
  {
    id: 'af-0008', code: 'AF-0008', name: 'Servidores y almacenamiento',
    description: 'Clúster de virtualización y arreglo de almacenamiento.',
    categoryId: 'cat-comp', serial: 'TI-SRV-0091', plate: '', location: 'Data center · Bogotá',
    costCenter: 'TI', responsible: 'Diana Rojas', supplier: 'Tecnología y Procesos S.A.S.',
    invoiceRef: 'FC-2023-1022', acquisitionDate: '2023-11-01', inServiceDate: '2023-12-01',
    acquisitionCost: 96_000_000, improvements: 0, revaluation: 0, impairment: 0,
    residualValue: 0, usefulLifeMonths: 60, method: 'Línea recta',
    depreciatedMonths: 25, accumulatedDepreciation: 40_000_000, lastDepreciation: '2026-01',
    estimatedUnits: 0, producedUnits: 0, status: 'En operación',
    insurancePolicy: 'POL-TI-9031', warrantyUntil: '2026-11-01', disposedAt: '', disposalValue: 0,
    notes: '',
  },
  {
    id: 'af-0009', code: 'AF-0009', name: 'Equipos de cómputo administrativos',
    description: 'Lote de 34 equipos portátiles y periféricos.',
    categoryId: 'cat-comp', serial: 'TI-PC-0234', plate: '', location: 'Sede principal · Bogotá',
    costCenter: 'ADM', responsible: 'Diana Rojas', supplier: 'Tecnología y Procesos S.A.S.',
    invoiceRef: 'FC-2024-0511', acquisitionDate: '2024-05-10', inServiceDate: '2024-06-01',
    acquisitionCost: 68_000_000, improvements: 0, revaluation: 0, impairment: 0,
    residualValue: 0, usefulLifeMonths: 60, method: 'Saldos decrecientes',
    depreciatedMonths: 19, accumulatedDepreciation: 32_293_200, lastDepreciation: '2026-01',
    estimatedUnits: 0, producedUnits: 0, status: 'En operación',
    insurancePolicy: 'POL-TI-9032', warrantyUntil: '2027-05-10', disposedAt: '', disposalValue: 0,
    notes: 'Política de saldos decrecientes al doble del lineal.',
  },
  {
    id: 'af-0010', code: 'AF-0010', name: 'Mobiliario de oficinas',
    description: 'Puestos de trabajo, sillas ergonómicas y archivadores.',
    categoryId: 'cat-ofi', serial: 'MOB-OFI-015', plate: '', location: 'Sede principal · Bogotá',
    costCenter: 'ADM', responsible: 'Laura Gómez', supplier: 'Muebles Corporativos Ltda.',
    invoiceRef: 'FC-2021-0988', acquisitionDate: '2021-08-01', inServiceDate: '2021-09-01',
    acquisitionCost: 42_000_000, improvements: 0, revaluation: 0, impairment: 0,
    residualValue: 0, usefulLifeMonths: 120, method: 'Línea recta',
    depreciatedMonths: 52, accumulatedDepreciation: 18_200_000, lastDepreciation: '2026-01',
    estimatedUnits: 0, producedUnits: 0, status: 'En operación',
    insurancePolicy: 'POL-MOB-4401', warrantyUntil: '', disposedAt: '', disposalValue: 0,
    notes: '',
  },
  {
    id: 'af-0011', code: 'AF-0011', name: 'Terreno bodega norte',
    description: 'Lote de 8.400 m² donde opera la bodega de distribución.',
    categoryId: 'cat-terreno', serial: 'INM-TER-003', plate: '', location: 'Bodega norte · Bogotá',
    costCenter: 'OPE', responsible: 'Carlos Pérez', supplier: 'Inversiones del Norte S.A.S.',
    invoiceRef: 'FC-2020-1186', acquisitionDate: '2020-07-01', inServiceDate: '2020-07-01',
    acquisitionCost: 680_000_000, improvements: 0, revaluation: 0, impairment: 0,
    residualValue: 0, usefulLifeMonths: 0, method: 'Línea recta',
    depreciatedMonths: 0, accumulatedDepreciation: 0, lastDepreciation: '',
    estimatedUnits: 0, producedUnits: 0, status: 'En operación',
    insurancePolicy: 'POL-INM-88414', warrantyUntil: '', disposedAt: '', disposalValue: 0,
    notes: 'No depreciable. Sujeto a deterioro y revalorización.',
  },
  {
    id: 'af-0012', code: 'AF-0012', name: 'Planta eléctrica de respaldo',
    description: 'Generador diésel de 250 kVA para contingencia de planta.',
    categoryId: 'cat-maq', serial: 'MAQ-GEN-250', plate: '', location: 'Planta de producción · Bogotá',
    costCenter: 'OPE', responsible: 'Jorge Ramírez', supplier: 'Suministros Técnicos del Norte Ltda.',
    invoiceRef: 'FC-2019-1450', acquisitionDate: '2019-12-01', inServiceDate: '2020-01-01',
    acquisitionCost: 120_000_000, improvements: 0, revaluation: 0, impairment: 0,
    residualValue: 0, usefulLifeMonths: 120, method: 'Línea recta',
    depreciatedMonths: 72, accumulatedDepreciation: 72_000_000, lastDepreciation: '2026-01',
    estimatedUnits: 0, producedUnits: 0, status: 'En operación',
    insurancePolicy: 'POL-MAQ-22021', warrantyUntil: '', disposedAt: '', disposalValue: 0,
    notes: '',
  },
  {
    id: 'af-0013', code: 'AF-0013', name: 'Servidor de nómina obsoleto',
    description: 'Servidor físico fuera de soporte, reemplazado por la nube.',
    categoryId: 'cat-comp', serial: 'TI-SRV-0004', plate: '', location: 'Depósito TI · Bogotá',
    costCenter: 'TI', responsible: 'Diana Rojas', supplier: 'Tecnología y Procesos S.A.S.',
    invoiceRef: 'FC-2017-0088', acquisitionDate: '2017-01-10', inServiceDate: '2017-02-01',
    acquisitionCost: 24_000_000, improvements: 0, revaluation: 0, impairment: 0,
    residualValue: 0, usefulLifeMonths: 60, method: 'Línea recta',
    depreciatedMonths: 60, accumulatedDepreciation: 24_000_000, lastDepreciation: '2022-01',
    estimatedUnits: 0, producedUnits: 0, status: 'Totalmente depreciado',
    insurancePolicy: '', warrantyUntil: '', disposedAt: '', disposalValue: 0,
    notes: 'Solicitud de baja por obsolescencia en curso.',
  },
  {
    id: 'af-0014', code: 'AF-0014', name: 'Vehículo de reparto retirado',
    description: 'Camioneta de reparto vendida en noviembre de 2025.',
    categoryId: 'cat-flota', serial: 'VEH-REP-119', plate: 'GHT-208', location: 'Baja · Vendido',
    costCenter: 'VEN', responsible: 'Luis Cárdenas', supplier: 'Autos y Camiones del Sur S.A.S.',
    invoiceRef: 'FC-2022-0101', acquisitionDate: '2022-02-10', inServiceDate: '2022-03-01',
    acquisitionCost: 95_000_000, improvements: 0, revaluation: 0, impairment: 0,
    residualValue: 9_500_000, usefulLifeMonths: 60, method: 'Línea recta',
    depreciatedMonths: 43, accumulatedDepreciation: 61_275_000, lastDepreciation: '2025-10',
    estimatedUnits: 0, producedUnits: 0, status: 'Vendido',
    insurancePolicy: '', warrantyUntil: '', disposedAt: '2025-11-30', disposalValue: 18_000_000,
    notes: 'Venta autorizada mediante acta de baja 2025-11-30.',
  },
  {
    id: 'af-0015', code: 'AF-0015', name: 'Empacadora secundaria en montaje',
    description: 'Equipo nuevo adquirido para ampliar la capacidad de empaque.',
    categoryId: 'cat-maq', serial: 'MAQ-EMP-412', plate: '', location: 'Planta de producción · Bogotá',
    costCenter: 'OPE', responsible: 'Jorge Ramírez', supplier: 'Tecnología y Procesos S.A.S.',
    invoiceRef: 'FC-2026-0042', acquisitionDate: '2026-01-15', inServiceDate: '',
    acquisitionCost: 260_000_000, improvements: 0, revaluation: 0, impairment: 0,
    residualValue: 0, usefulLifeMonths: 120, method: 'Línea recta',
    depreciatedMonths: 0, accumulatedDepreciation: 0, lastDepreciation: '',
    estimatedUnits: 0, producedUnits: 0, status: 'En montaje',
    insurancePolicy: 'POL-MAQ-22022', warrantyUntil: '2027-01-15', disposedAt: '', disposalValue: 0,
    notes: 'No deprecia hasta la puesta en servicio.',
  },
];

const revaluations: AssetRevaluation[] = [
  {
    id: 'rev-1', assetId: 'af-0001', date: '2025-12-31',
    previousValue: 2_400_000_000, newValue: 2_580_000_000, surplus: 180_000_000,
    appraiser: 'Valorar S.A.S.', report: 'AV-2025-118', status: 'Aplicada',
    approvedBy: 'María del Pilar Restrepo',
    note: 'Avalúo técnico de la sede administrativa aplicado al cierre de 2025.',
  },
  {
    id: 'rev-2', assetId: 'af-0002', date: '2026-02-20',
    previousValue: 907_500_000, newValue: 1_080_000_000, surplus: 172_500_000,
    appraiser: 'Valorar S.A.S.', report: 'AV-2026-014', status: 'Aprobada',
    approvedBy: 'María del Pilar Restrepo',
    note: 'Avalúo de la bodega norte aprobado por comité; pendiente de aplicación.',
  },
  {
    id: 'rev-3', assetId: 'af-0003', date: '2026-02-26',
    previousValue: 460_416_667, newValue: 520_000_000, surplus: 59_583_333,
    appraiser: 'Ingeniería de Activos Ltda.', report: 'AV-2026-021', status: 'Borrador',
    approvedBy: '',
    note: 'Avalúo preliminar de la línea de empaque; pendiente de revisión.',
  },
];

const disposals: AssetDisposal[] = [
  {
    id: 'disp-1', assetId: 'af-0014', date: '2025-11-30', type: 'Venta',
    proceeds: 18_000_000, netBookValue: 33_725_000, gainLoss: -15_725_000,
    status: 'Aplicada', requestedBy: 'Carlos Pérez', approvedBy: 'María del Pilar Restrepo',
    note: 'Venta del vehículo de reparto; acta de baja 2025-11-30.', invoiceRef: 'FV-0912',
  },
  {
    id: 'disp-2', assetId: 'af-0013', date: '2026-02-25', type: 'Obsolescencia',
    proceeds: 0, netBookValue: 0, gainLoss: 0,
    status: 'Solicitada', requestedBy: 'Laura Gómez', approvedBy: '',
    note: 'Equipo fuera de soporte; se solicita retiro del inventario.', invoiceRef: '',
  },
];

const assetReconciliations: AssetReconciliation[] = [
  {
    id: 'ar-1', period: '2026-01', categoryId: 'cat-edif',
    ledgerGross: 3_780_000_000, ledgerAccumulated: 1_129_500_000, ledgerImpairment: 0,
    status: 'Conciliada', note: 'Cuadre sin diferencias contra el libro mayor.',
    checkedBy: 'Laura Gómez', checkedAt: '2026-02-05',
  },
  {
    id: 'ar-2', period: '2026-01', categoryId: 'cat-maq',
    ledgerGross: 1_555_000_000, ledgerAccumulated: 567_383_333, ledgerImpairment: 0,
    status: 'Diferencia', note: 'Diferencia de $ 2.000.000 en depreciación acumulada.',
    checkedBy: 'Carlos Pérez', checkedAt: '2026-02-06',
  },
  {
    id: 'ar-3', period: '2026-01', categoryId: 'cat-comp',
    ledgerGross: 188_000_000, ledgerAccumulated: 96_293_200, ledgerImpairment: 0,
    status: 'Conciliada', note: 'Cuadre sin diferencias contra el libro mayor.',
    checkedBy: 'Diana Rojas', checkedAt: '2026-02-05',
  },
  {
    id: 'ar-4', period: '2026-01', categoryId: 'cat-flota',
    ledgerGross: 505_000_000, ledgerAccumulated: 294_450_000, ledgerImpairment: 0,
    status: 'Pendiente', note: '', checkedBy: '', checkedAt: '',
  },
  {
    id: 'ar-5', period: '2026-01', categoryId: 'cat-ofi',
    ledgerGross: 42_000_000, ledgerAccumulated: 18_000_000, ledgerImpairment: 0,
    status: 'Diferencia', note: 'Diferencia de $ 200.000 en depreciación acumulada.',
    checkedBy: 'Laura Gómez', checkedAt: '2026-02-06',
  },
  {
    id: 'ar-6', period: '2026-01', categoryId: 'cat-terreno',
    ledgerGross: 680_000_000, ledgerAccumulated: 0, ledgerImpairment: 0,
    status: 'Conciliada', note: 'Terreno sin depreciación; valor coincide con el mayor.',
    checkedBy: 'Laura Gómez', checkedAt: '2026-02-05',
  },
];

const assetTransfers: AssetTransfer[] = [
  {
    id: 'tr-1', assetId: 'af-0005', date: '2026-02-10',
    fromLocation: 'Bodega norte · Bogotá', toLocation: 'Planta de producción · Bogotá',
    fromCenter: 'OPE', toCenter: 'OPE',
    fromResponsible: 'Andrés Molina', toResponsible: 'Jorge Ramírez',
    reason: 'Reasignación operativa para carga de producto terminado en planta.',
    status: 'Aplicado', requestedBy: 'Carlos Pérez', approvedBy: 'Laura Gómez',
    note: 'Acta de traslado TR-2026-001 firmada por almacén y producción.',
  },
  {
    id: 'tr-2', assetId: 'af-0010', date: '2026-02-26',
    fromLocation: 'Sede principal · Bogotá', toLocation: 'Bodega norte · Bogotá',
    fromCenter: 'ADM', toCenter: 'OPE',
    fromResponsible: 'Laura Gómez', toResponsible: 'Carlos Pérez',
    reason: 'Mobiliario excedente reasignado al área operativa de la bodega.',
    status: 'Solicitado', requestedBy: 'María Restrepo', approvedBy: '',
    note: 'Pendiente aprobación de la dirección administrativa.',
  },
];

const depreciationEntries: DepreciationEntry[] = assets
  .filter(asset => asset.depreciatedMonths > 0
    && asset.usefulLifeMonths > 0
    && asset.status !== 'Vendido'
    && asset.status !== 'En montaje')
  .map(asset => ({
    id: uid('dep'),
    period: '2026-01',
    assetId: asset.id,
    amount: Math.round(assetMonthlyDepreciation(asset, 1_100)),
    accumulatedAfter: asset.accumulatedDepreciation,
    status: 'Contabilizada' as const,
    postedAt: '2026-02-05',
    costCenter: asset.costCenter,
    account: assetCategories.find(category => category.id === asset.categoryId)?.depreciationAccount ?? '5160',
  }))
  .filter(entry => entry.amount > 0);

function categoryAccount(asset: Asset, field: 'assetAccount' | 'accumulatedAccount' | 'revaluationAccount' | 'impairmentAccount' | 'depreciationAccount') {
  return assetCategories.find(category => category.id === asset.categoryId)?.[field] ?? '1516';
}

const assetMovements: AssetMovement[] = [];
for (const asset of assets) {
  assetMovements.push({
    id: uid('mov'),
    assetId: asset.id,
    date: asset.acquisitionDate,
    type: 'Adquisición',
    description: `Capitalización de ${asset.name}`,
    debitAccount: categoryAccount(asset, 'assetAccount'),
    creditAccount: '2205',
    amount: asset.acquisitionCost,
    reference: asset.invoiceRef,
    user: 'Laura Gómez',
  });
}
for (const entry of depreciationEntries) {
  const asset = assets.find(item => item.id === entry.assetId);
  if (!asset) continue;
  assetMovements.push({
    id: uid('mov'),
    assetId: entry.assetId,
    date: entry.postedAt,
    type: 'Depreciación',
    description: `Depreciación de ${entry.period}`,
    debitAccount: entry.account,
    creditAccount: categoryAccount(asset, 'accumulatedAccount'),
    amount: entry.amount,
    reference: `DEP-${entry.period}`,
    user: 'Sistema',
  });
}
for (const revaluation of revaluations.filter(item => item.status === 'Aplicada')) {
  const asset = assets.find(item => item.id === revaluation.assetId);
  if (!asset) continue;
  assetMovements.push({
    id: uid('mov'),
    assetId: revaluation.assetId,
    date: revaluation.date,
    type: 'Revalorización',
    description: `Superávit por revalorización · ${revaluation.report}`,
    debitAccount: categoryAccount(asset, 'assetAccount'),
    creditAccount: categoryAccount(asset, 'revaluationAccount'),
    amount: revaluation.surplus,
    reference: revaluation.report,
    user: 'María del Pilar Restrepo',
  });
}
for (const disposal of disposals.filter(item => item.status === 'Aplicada')) {
  const asset = assets.find(item => item.id === disposal.assetId);
  if (!asset) continue;
  assetMovements.push({
    id: uid('mov'),
    assetId: disposal.assetId,
    date: disposal.date,
    type: disposal.type === 'Venta' ? 'Venta' : 'Baja',
    description: `Retiro del activo · valor en libros $ ${disposal.netBookValue.toLocaleString('es-CO')} · resultado $ ${disposal.gainLoss.toLocaleString('es-CO')}`,
    debitAccount: `${categoryAccount(asset, 'accumulatedAccount')} / 1110 / 5395`,
    creditAccount: categoryAccount(asset, 'assetAccount'),
    amount: asset.acquisitionCost,
    reference: disposal.invoiceRef || `ACTA-${disposal.date}`,
    user: disposal.approvedBy || disposal.requestedBy,
  });
}

// ── Costos ──────────────────────────────────────────────────────────────────

const costCenters: CostCenter[] = [
  { id: 'cc-prod', code: 'CC-PROD', name: 'Producción', kind: 'Producción', manager: 'Jorge Ramírez', driver: 'Horas máquina', driverUnit: 'h', driverQty: 3200, areaM2: 4200, energyKwh: 68000, machineHours: 3200, insuredValue: 1800, directCost: 420_000_000, status: 'Activo' },
  { id: 'cc-empa', code: 'CC-EMPA', name: 'Empaque y despacho', kind: 'Producción', manager: 'Andrés Molina', driver: 'Horas hombre', driverUnit: 'h', driverQty: 1850, areaM2: 2400, energyKwh: 29130, machineHours: 1850, insuredValue: 950, directCost: 168_000_000, status: 'Activo' },
  { id: 'cc-mant', code: 'CC-MANT', name: 'Mantenimiento', kind: 'Servicio', manager: 'Jorge Ramírez', driver: 'Órdenes de trabajo', driverUnit: 'OT', driverQty: 240, areaM2: 800, energyKwh: 6400, machineHours: 420, insuredValue: 320, directCost: 96_000_000, status: 'Activo' },
  { id: 'cc-adm', code: 'CC-ADM', name: 'Administración', kind: 'Administrativo', manager: 'María del Pilar Restrepo', driver: 'Empleados', driverUnit: 'personas', driverQty: 42, areaM2: 1400, energyKwh: 9800, machineHours: 0, insuredValue: 260, directCost: 210_000_000, status: 'Activo' },
  { id: 'cc-ven', code: 'CC-VEN', name: 'Comercial', kind: 'Comercial', manager: 'Luis Cárdenas', driver: 'Pedidos', driverUnit: 'pedidos', driverQty: 1260, areaM2: 600, energyKwh: 4200, machineHours: 0, insuredValue: 140, directCost: 145_000_000, status: 'Activo' },
  { id: 'cc-ti', code: 'CC-TI', name: 'Tecnología', kind: 'Servicio', manager: 'Diana Rojas', driver: 'Usuarios', driverUnit: 'usuarios', driverQty: 68, areaM2: 320, energyKwh: 12400, machineHours: 0, insuredValue: 480, directCost: 88_000_000, status: 'Activo' },
];

const costPools: CostPool[] = [
  { id: 'cif-arrend', code: 'CIF-001', name: 'Arrendamientos de planta', account: '5120', amount: 96_000_000, driver: 'Área ocupada', driverUnit: 'm²', period: '2026-02' },
  { id: 'cif-energia', code: 'CIF-002', name: 'Energía eléctrica', account: '5135', amount: 78_000_000, driver: 'Consumo eléctrico', driverUnit: 'kWh', period: '2026-02' },
  { id: 'cif-depre', code: 'CIF-003', name: 'Depreciación de planta', account: '5160', amount: 64_000_000, driver: 'Horas máquina', driverUnit: 'h', period: '2026-02' },
  { id: 'cif-serv', code: 'CIF-004', name: 'Servicios generales', account: '5135', amount: 32_000_000, driver: 'Área ocupada', driverUnit: 'm²', period: '2026-02' },
  { id: 'cif-seguro', code: 'CIF-005', name: 'Seguros de propiedad', account: '5130', amount: 18_000_000, driver: 'Valor asegurado', driverUnit: '$ M', period: '2026-02' },
];

const costAllocations: CostAllocation[] = [
  { id: 'cal-1', poolId: 'cif-arrend', centerId: 'cc-prod', driverQty: 4200, amount: 41_481_481, period: '2026-02', date: '2026-02-28' },
  { id: 'cal-2', poolId: 'cif-arrend', centerId: 'cc-empa', driverQty: 2400, amount: 23_703_704, period: '2026-02', date: '2026-02-28' },
  { id: 'cal-3', poolId: 'cif-arrend', centerId: 'cc-mant', driverQty: 800, amount: 7_901_235, period: '2026-02', date: '2026-02-28' },
  { id: 'cal-4', poolId: 'cif-arrend', centerId: 'cc-adm', driverQty: 1400, amount: 13_827_160, period: '2026-02', date: '2026-02-28' },
  { id: 'cal-5', poolId: 'cif-arrend', centerId: 'cc-ven', driverQty: 600, amount: 5_925_926, period: '2026-02', date: '2026-02-28' },
  { id: 'cal-6', poolId: 'cif-arrend', centerId: 'cc-ti', driverQty: 320, amount: 3_160_494, period: '2026-02', date: '2026-02-28' },
  { id: 'cal-7', poolId: 'cif-energia', centerId: 'cc-prod', driverQty: 68000, amount: 40_819_672, period: '2026-02', date: '2026-02-28' },
  { id: 'cal-8', poolId: 'cif-energia', centerId: 'cc-empa', driverQty: 29130, amount: 17_486_726, period: '2026-02', date: '2026-02-28' },
  { id: 'cal-9', poolId: 'cif-energia', centerId: 'cc-mant', driverQty: 6400, amount: 3_841_722, period: '2026-02', date: '2026-02-28' },
  { id: 'cal-10', poolId: 'cif-energia', centerId: 'cc-adm', driverQty: 9800, amount: 5_882_635, period: '2026-02', date: '2026-02-28' },
  { id: 'cal-11', poolId: 'cif-energia', centerId: 'cc-ven', driverQty: 4200, amount: 2_521_130, period: '2026-02', date: '2026-02-28' },
  { id: 'cal-12', poolId: 'cif-energia', centerId: 'cc-ti', driverQty: 12400, amount: 7_448_115, period: '2026-02', date: '2026-02-28' },
];

const costObjects: CostObject[] = [
  { id: 'co-1', code: 'CO-001', name: 'Consultoría financiera', kind: 'Servicio', productCode: 'SRV-CONS', centerId: 'cc-adm', units: 320, period: '2026-02', standardQty: 1, actualQty: 1.08, standardPrice: 180_000, actualPrice: 192_000, revenue: 89_600_000 },
  { id: 'co-2', code: 'CO-002', name: 'Licencia de software anual', kind: 'Producto', productCode: 'LIC-SW', centerId: 'cc-ti', units: 120, period: '2026-02', standardQty: 1, actualQty: 1, standardPrice: 2_650_000, actualPrice: 2_720_000, revenue: 576_000_000 },
  { id: 'co-3', code: 'CO-003', name: 'Soporte técnico anual', kind: 'Servicio', productCode: 'SOP-ANU', centerId: 'cc-ti', units: 210, period: '2026-02', standardQty: 1, actualQty: 1.05, standardPrice: 1_280_000, actualPrice: 1_310_000, revenue: 504_000_000 },
  { id: 'co-4', code: 'CO-004', name: 'Equipo portátil corporativo', kind: 'Producto', productCode: 'EQ-PORT', centerId: 'cc-prod', units: 85, period: '2026-02', standardQty: 1, actualQty: 0.97, standardPrice: 3_050_000, actualPrice: 2_980_000, revenue: 331_500_000 },
  { id: 'co-5', code: 'CO-005', name: 'Servicio en la nube', kind: 'Servicio', productCode: 'SERV-NUBE', centerId: 'cc-ti', units: 480, period: '2026-02', standardQty: 1, actualQty: 1.12, standardPrice: 720_000, actualPrice: 705_000, revenue: 600_000_000 },
  { id: 'co-6', code: 'CO-006', name: 'Implantación ERP', kind: 'Proyecto', productCode: 'PRY-ERP', centerId: 'cc-adm', units: 1, period: '2026-02', standardQty: 1, actualQty: 1.18, standardPrice: 180_000_000, actualPrice: 196_000_000, revenue: 250_000_000 },
];

const costActivities: CostActivity[] = [
  { id: 'act-1', code: 'AC-001', name: 'Programación de producción', centerId: 'cc-prod', driver: 'Órdenes de producción', driverUnit: 'órdenes', driverQty: 480, totalCost: 38_000_000, period: '2026-02' },
  { id: 'act-2', code: 'AC-002', name: 'Montaje de máquinas', centerId: 'cc-prod', driver: 'Setups', driverUnit: 'setups', driverQty: 220, totalCost: 52_000_000, period: '2026-02' },
  { id: 'act-3', code: 'AC-003', name: 'Control de calidad', centerId: 'cc-empa', driver: 'Inspecciones', driverUnit: 'inspecciones', driverQty: 960, totalCost: 44_000_000, period: '2026-02' },
  { id: 'act-4', code: 'AC-004', name: 'Despacho de pedidos', centerId: 'cc-ven', driver: 'Envíos', driverUnit: 'envíos', driverQty: 1180, totalCost: 36_000_000, period: '2026-02' },
  { id: 'act-5', code: 'AC-005', name: 'Gestión de proveedores', centerId: 'cc-adm', driver: 'Órdenes de compra', driverUnit: 'OC', driverQty: 340, totalCost: 28_000_000, period: '2026-02' },
  { id: 'act-6', code: 'AC-006', name: 'Soporte de TI', centerId: 'cc-ti', driver: 'Tickets', driverUnit: 'tickets', driverQty: 720, totalCost: 31_000_000, period: '2026-02' },
];

const costRuns: CostRun[] = [
  { id: 'cr-1', number: 'CR-2026-01', date: '2026-01-31', period: '2026-01', method: 'CIF', total: 288_000_000, status: 'Contabilizada', user: 'Laura Gómez' },
  { id: 'cr-2', number: 'CR-2026-02', date: '2026-02-28', period: '2026-02', method: 'CIF', total: 145_200_000, status: 'Calculada', user: 'Laura Gómez' },
];

// ── Financiación y deuda ────────────────────────────────────────────────────

const creditLines: CreditLine[] = [
  { id: 'cl-1', code: 'CL-001', bank: 'Bancolombia', approved: 500_000_000, used: 240_000_000, annualRate: 13.2, expiresAt: '2027-06-30', status: 'Vigente' },
  { id: 'cl-2', code: 'CL-002', bank: 'Banco de Bogotá', approved: 300_000_000, used: 120_000_000, annualRate: 14.1, expiresAt: '2026-12-31', status: 'Vigente' },
  { id: 'cl-3', code: 'CL-003', bank: 'Davivienda', approved: 200_000_000, used: 60_000_000, annualRate: 15.4, expiresAt: '2026-03-31', status: 'Vigente' },
  { id: 'cl-4', code: 'CL-004', bank: 'BBVA Colombia', approved: 150_000_000, used: 0, annualRate: 15.9, expiresAt: '2025-12-31', status: 'Vencida' },
];

const loans: Loan[] = [
  { id: 'loan-1', code: 'LB-2025-01', bank: 'Bancolombia', principal: 240_000_000, annualRate: 13.8, termMonths: 30, startDate: '2025-06-30', purpose: 'Capital de trabajo', status: 'Vigente', creditLineId: 'cl-1', note: 'Desembolso único, amortización mensual vencida.' },
  { id: 'loan-2', code: 'LB-2024-07', bank: 'Banco de Bogotá', principal: 120_000_000, annualRate: 14.6, termMonths: 24, startDate: '2024-09-30', purpose: 'Compra de maquinaria', status: 'Vigente', creditLineId: 'cl-2', note: 'Garantía sobre la línea de empaque.' },
  { id: 'loan-3', code: 'LB-2025-03', bank: 'Davivienda', principal: 60_000_000, annualRate: 15.2, termMonths: 18, startDate: '2025-01-31', purpose: 'Modernización de TI', status: 'Vigente', creditLineId: 'cl-3', note: 'Tasa efectiva anual fija.' },
];

function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(day, lastDay));
  return base.toISOString().slice(0, 10);
}

function amortizationFor(loan: Loan): AmortizationRow[] {
  const monthlyRate = Math.pow(1 + loan.annualRate / 100, 1 / 12) - 1;
  const payment = monthlyRate === 0
    ? loan.principal / loan.termMonths
    : (loan.principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -loan.termMonths));
  const rows: AmortizationRow[] = [];
  let opening = loan.principal;
  for (let index = 1; index <= loan.termMonths; index += 1) {
    const interest = Math.round(opening * monthlyRate);
    const principal = index === loan.termMonths ? opening : Math.min(opening, Math.round(payment - interest));
    const closing = Math.max(0, opening - principal);
    const date = addMonths(loan.startDate, index);
    rows.push({
      id: `${loan.id}-cuota-${index}`,
      loanId: loan.id,
      number: index,
      date,
      opening: Math.round(opening),
      payment: principal + interest,
      interest,
      principal,
      closing: Math.round(closing),
      status: date <= '2026-02-28' ? 'Pagado' : 'Pendiente',
    });
    opening = closing;
  }
  return rows;
}

const amortization: AmortizationRow[] = loans.flatMap(amortizationFor);

const leases: Lease[] = [
  { id: 'lease-1', code: 'AR-2024-01', assetName: 'Camión de reparto NPR 2024', lessor: 'Leasing Bancolombia', monthlyPayment: 9_800_000, termMonths: 48, startDate: '2024-04-01', annualRate: 15.1, option: 'Compra', status: 'Vigente' },
  { id: 'lease-2', code: 'AR-2025-02', assetName: 'Servidores de data center', lessor: 'Leasing Bogotá', monthlyPayment: 3_200_000, termMonths: 36, startDate: '2025-02-01', annualRate: 14.4, option: 'Devolución', status: 'Vigente' },
];

// ── Indicadores y proyecciones ──────────────────────────────────────────────

const indicators: Indicator[] = [
  { id: 'ind-1', code: 'LIQ-01', name: 'Razón corriente', group: 'Liquidez', formula: 'Activo corriente / Pasivo corriente', unit: 'veces', target: 1.5, actual: 1.62, previous: 1.48, direction: 'Mayor es mejor', note: 'Cobertura de obligaciones de corto plazo.' },
  { id: 'ind-2', code: 'LIQ-02', name: 'Prueba ácida', group: 'Liquidez', formula: '(Activo corriente − Inventario) / Pasivo corriente', unit: 'veces', target: 1, actual: 1.04, previous: 0.93, direction: 'Mayor es mejor', note: 'Liquidez sin depender de la venta de inventario.' },
  { id: 'ind-3', code: 'LIQ-03', name: 'Capital de trabajo', group: 'Liquidez', formula: 'Activo corriente − Pasivo corriente', unit: '$', target: 400_000_000, actual: 468_000_000, previous: 392_000_000, direction: 'Mayor es mejor', note: 'Recursos disponibles para operar.' },
  { id: 'ind-4', code: 'END-01', name: 'Endeudamiento total', group: 'Endeudamiento', formula: 'Pasivo total / Activo total', unit: '%', target: 45, actual: 41.8, previous: 44.2, direction: 'Menor es mejor', note: 'Participación de terceros en los activos.' },
  { id: 'ind-5', code: 'END-02', name: 'Deuda financiera / EBITDA', group: 'Endeudamiento', formula: 'Deuda financiera / EBITDA anualizado', unit: 'veces', target: 2.5, actual: 2.1, previous: 2.4, direction: 'Menor es mejor', note: 'Capacidad de pago de la deuda financiera.' },
  { id: 'ind-6', code: 'END-03', name: 'Cobertura de intereses', group: 'Endeudamiento', formula: 'EBITDA / Gastos financieros', unit: 'veces', target: 4, actual: 5.3, previous: 4.8, direction: 'Mayor es mejor', note: 'Holgura para cubrir los intereses.' },
  { id: 'ind-7', code: 'REN-01', name: 'Margen bruto', group: 'Rentabilidad', formula: '(Ingresos − Costo de ventas) / Ingresos', unit: '%', target: 38, actual: 41.2, previous: 39.5, direction: 'Mayor es mejor', note: 'Rentabilidad antes de gastos operativos.' },
  { id: 'ind-8', code: 'REN-02', name: 'Margen neto', group: 'Rentabilidad', formula: 'Utilidad neta / Ingresos', unit: '%', target: 12, actual: 13.4, previous: 11.8, direction: 'Mayor es mejor', note: 'Rentabilidad final del ejercicio.' },
  { id: 'ind-9', code: 'REN-03', name: 'Rentabilidad del patrimonio', group: 'Rentabilidad', formula: 'Utilidad neta / Patrimonio', unit: '%', target: 18, actual: 19.6, previous: 17.2, direction: 'Mayor es mejor', note: 'Retorno para los accionistas.' },
  { id: 'ind-10', code: 'ACT-01', name: 'Rotación de cartera', group: 'Actividad', formula: 'Cartera promedio / Ventas × 30', unit: 'días', target: 45, actual: 52, previous: 57, direction: 'Menor es mejor', note: 'Días promedio de recaudo.' },
  { id: 'ind-11', code: 'ACT-02', name: 'Rotación de proveedores', group: 'Actividad', formula: 'CxP promedio / Compras × 30', unit: 'días', target: 40, actual: 43, previous: 41, direction: 'Menor es mejor', note: 'Días promedio de pago a proveedores.' },
  { id: 'ind-12', code: 'PRE-01', name: 'Cumplimiento de recaudo', group: 'Presupuesto', formula: 'Recaudo real / Meta de recaudo', unit: '%', target: 100, actual: 92, previous: 96, direction: 'Mayor es mejor', note: 'Avance frente a la meta comercial.' },
  { id: 'ind-13', code: 'PRE-02', name: 'Desviación presupuestal', group: 'Presupuesto', formula: '|Ejecutado − Presupuesto| / Presupuesto', unit: '%', target: 5, actual: 3.1, previous: 6.4, direction: 'Menor es mejor', note: 'Alejamiento del gasto frente al presupuesto.' },
];

function monthlySeries(start: number, growth: number, months = 12): number[] {
  const values: number[] = [];
  let value = start;
  for (let index = 0; index < months; index += 1) {
    values.push(Math.round(value));
    value *= 1 + growth;
  }
  return values;
}

function projectionLines(prefix: string, revenueStart: number, growth: number, costRatio: number, adminStart: number, salesStart: number): ProjectionLine[] {
  const revenue = monthlySeries(revenueStart, growth);
  return [
    { id: `${prefix}-ing`, account: '4105', accountName: 'Ingresos operacionales', type: 'Ingreso', monthly: revenue },
    { id: `${prefix}-cos`, account: '6135', accountName: 'Costo de ventas', type: 'Costo', monthly: revenue.map(value => Math.round(value * costRatio)) },
    { id: `${prefix}-adm`, account: '5105', accountName: 'Gastos administrativos', type: 'Gasto', monthly: monthlySeries(adminStart, 0.004) },
    { id: `${prefix}-ven`, account: '5205', accountName: 'Gastos de ventas', type: 'Gasto', monthly: monthlySeries(salesStart, 0.005) },
    { id: `${prefix}-dep`, account: '5160', accountName: 'Depreciación', type: 'Gasto', monthly: Array.from({ length: 12 }, () => 62_000_000) },
    { id: `${prefix}-cap`, account: '1524', accountName: 'Inversión en activos', type: 'Inversión', monthly: Array.from({ length: 12 }, () => 25_000_000) },
  ];
}

const projections: Projection[] = [
  { id: 'proj-base', name: 'Presupuesto 2026', year: 2026, scenario: 'Base', current: true, note: 'Crecimiento mensual de 1,5 % y costo de ventas del 58 %.', lines: projectionLines('base', 480_000_000, 0.015, 0.58, 96_000_000, 48_000_000) },
  { id: 'proj-opt', name: 'Escenario optimista 2026', year: 2026, scenario: 'Optimista', current: false, note: 'Mayor crecimiento comercial y mejora del margen bruto.', lines: projectionLines('opt', 480_000_000, 0.023, 0.55, 94_000_000, 46_000_000) },
  { id: 'proj-con', name: 'Escenario conservador 2026', year: 2026, scenario: 'Conservador', current: false, note: 'Menor crecimiento y presión de costos.', lines: projectionLines('con', 480_000_000, 0.008, 0.61, 99_000_000, 51_000_000) },
];

// ── Aprobaciones ────────────────────────────────────────────────────────────

const approvalRules: ApprovalRule[] = [
  {
    id: 'rule-pagos-1', name: 'Pagos menores a $ 20 M', module: 'cuentas-pagar', concept: 'Propuesta de pago',
    minAmount: 0, maxAmount: 20_000_000, active: true,
    levels: [{ level: 1, role: 'Tesorería', minAmount: 0 }],
    note: 'Aprobación simple de tesorería para pagos operativos menores.',
  },
  {
    id: 'rule-pagos-2', name: 'Pagos desde $ 20 M', module: 'cuentas-pagar', concept: 'Propuesta de pago',
    minAmount: 20_000_000, maxAmount: 500_000_000, active: true,
    levels: [
      { level: 1, role: 'Tesorería', minAmount: 0 },
      { level: 2, role: 'Dirección financiera', minAmount: 20_000_000 },
    ],
    note: 'Doble aprobación para pagos relevantes.',
  },
  {
    id: 'rule-bajas', name: 'Bajas de activos', module: 'activos-fijos', concept: 'Baja de activo',
    minAmount: 0, maxAmount: 1_000_000_000, active: true,
    levels: [{ level: 1, role: 'Comité de activos', minAmount: 0 }],
    note: 'Toda baja requiere concepto del comité de activos.',
  },
  {
    id: 'rule-reval', name: 'Revalorizaciones', module: 'activos-fijos', concept: 'Revalorización',
    minAmount: 0, maxAmount: 5_000_000_000, active: true,
    levels: [
      { level: 1, role: 'Contabilidad', minAmount: 0 },
      { level: 2, role: 'Dirección financiera', minAmount: 0 },
    ],
    note: 'Avalúo y aprobación financiera antes de aplicar el superávit.',
  },
  {
    id: 'rule-compras', name: 'Compras de bienes y servicios', module: 'facturacion', concept: 'Factura de compra',
    minAmount: 0, maxAmount: 100_000_000, active: false,
    levels: [{ level: 1, role: 'Contabilidad', minAmount: 0 }],
    note: 'Regla en revisión: falta umbral para el segundo nivel.',
  },
];

const approvalRequests: ApprovalRequest[] = [
  {
    id: 'apr-1', number: 'APR-0201', module: 'cuentas-pagar', concept: 'Propuesta de pago',
    reference: 'PROP-028', party: 'Tecnología y Procesos S.A.S.', amount: 27_680_000,
    requestedBy: 'Carlos Pérez', requestedAt: '2026-02-26', dueDate: '2026-02-28',
    status: 'Pendiente', currentLevel: 1, totalLevels: 2, ruleId: 'rule-pagos-2',
    history: [
      { id: 'apr-1-h1', level: 1, role: 'Tesorería', user: '', action: 'Pendiente', at: '', note: '' },
      { id: 'apr-1-h2', level: 2, role: 'Dirección financiera', user: '', action: 'Pendiente', at: '', note: '' },
    ],
    note: 'Pago de licencias e infraestructura de febrero.',
  },
  {
    id: 'apr-2', number: 'APR-0200', module: 'activos-fijos', concept: 'Baja de activo',
    reference: 'AF-0013', party: 'Servidor de nómina obsoleto', amount: 0,
    requestedBy: 'Diana Rojas', requestedAt: '2026-02-25', dueDate: '2026-02-27',
    status: 'Pendiente', currentLevel: 1, totalLevels: 1, ruleId: 'rule-bajas',
    history: [{ id: 'apr-2-h1', level: 1, role: 'Comité de activos', user: '', action: 'Pendiente', at: '', note: '' }],
    note: 'Equipo fuera de soporte, reemplazado por la nube.',
  },
  {
    id: 'apr-3', number: 'APR-0199', module: 'cuentas-pagar', concept: 'Ajuste de proveedor',
    reference: 'ADJ-0002', party: 'Arrendamientos Capital S.A.S.', amount: 450_000,
    requestedBy: 'María Restrepo', requestedAt: '2026-02-24', dueDate: '2026-02-26',
    status: 'Aprobada', currentLevel: 1, totalLevels: 1, ruleId: 'rule-pagos-1',
    history: [{ id: 'apr-3-h1', level: 1, role: 'Tesorería', user: 'Laura Gómez', action: 'Aprobada', at: '2026-02-24 15:20', note: 'Soporte verificado.' }],
    note: 'Nota débito por servicios públicos del inmueble.',
  },
  {
    id: 'apr-4', number: 'APR-0198', module: 'activos-fijos', concept: 'Revalorización',
    reference: 'AV-2026-014', party: 'Bodega de distribución norte', amount: 172_500_000,
    requestedBy: 'Laura Gómez', requestedAt: '2026-02-22', dueDate: '2026-02-24',
    status: 'Aprobada', currentLevel: 2, totalLevels: 2, ruleId: 'rule-reval',
    history: [
      { id: 'apr-4-h1', level: 1, role: 'Contabilidad', user: 'Laura Gómez', action: 'Aprobada', at: '2026-02-23 09:10', note: 'Avalúo revisado.' },
      { id: 'apr-4-h2', level: 2, role: 'Dirección financiera', user: 'María Restrepo', action: 'Aprobada', at: '2026-02-23 16:40', note: 'Superávit aprobado.' },
    ],
    note: 'Avalúo técnico aprobado, pendiente de aplicación al mayor.',
  },
  {
    id: 'apr-5', number: 'APR-0197', module: 'tesoreria', concept: 'Pago',
    reference: 'PAG-4413', party: 'Servicios Públicos Bogotá', amount: 3_100_000,
    requestedBy: 'Carlos Pérez', requestedAt: '2026-02-19', dueDate: '2026-02-21',
    status: 'Vencida', currentLevel: 2, totalLevels: 2, ruleId: 'rule-pagos-1',
    history: [
      { id: 'apr-5-h1', level: 1, role: 'Tesorería', user: 'Carlos Pérez', action: 'Aprobada', at: '2026-02-19 10:00', note: '' },
      { id: 'apr-5-h2', level: 2, role: 'Dirección financiera', user: '', action: 'Pendiente', at: '', note: '' },
    ],
    note: 'Pago de servicios públicos de febrero.',
  },
];

// ── Auditoría y permisos ────────────────────────────────────────────────────

const roles: Role[] = [
  { id: 'rol-admin', name: 'Administrador', description: 'Acceso total a la suite y a la configuración.', users: ['Laura Gómez'], active: true },
  { id: 'rol-fin', name: 'Dirección financiera', description: 'Aprueba pagos, presupuestos y revalorizaciones.', users: ['María Restrepo'], active: true },
  { id: 'rol-tes', name: 'Tesorería', description: 'Opera bancos, pagos y recaudos.', users: ['Carlos Pérez'], active: true },
  { id: 'rol-cont', name: 'Contabilidad', description: 'Registra y revisa información contable y tributaria.', users: ['Laura Gómez'], active: true },
  { id: 'rol-aud', name: 'Auditoría', description: 'Consulta bitácora y permisos sin editar operaciones.', users: ['Diana Rojas'], active: true },
];

const ALL_MODULES: FinancialModuleId[] = [
  'facturacion', 'cartera', 'cuentas-pagar', 'tesoreria', 'presupuesto',
  'activos-fijos', 'costos', 'financiacion', 'indicadores',
  'aprobaciones', 'auditoria', 'consolidacion',
];

const rolePermissions: RolePermission[] = [
  ...ALL_MODULES.map(module => ({ id: `perm-rol-admin-${module}`, roleId: 'rol-admin', module, level: 'Administrar' as const })),
  ...ALL_MODULES.map(module => ({ id: `perm-rol-fin-${module}`, roleId: 'rol-fin', module, level: 'Aprobar' as const })),
  { id: 'perm-rol-fin-auditoria', roleId: 'rol-fin', module: 'auditoria', level: 'Ver' as const },
  { id: 'perm-rol-tes-tesoreria', roleId: 'rol-tes', module: 'tesoreria', level: 'Editar' as const },
  { id: 'perm-rol-tes-cartera', roleId: 'rol-tes', module: 'cartera', level: 'Editar' as const },
  { id: 'perm-rol-tes-cuentas-pagar', roleId: 'rol-tes', module: 'cuentas-pagar', level: 'Aprobar' as const },
  { id: 'perm-rol-tes-aprobaciones', roleId: 'rol-tes', module: 'aprobaciones', level: 'Editar' as const },
  { id: 'perm-rol-cont-facturacion', roleId: 'rol-cont', module: 'facturacion', level: 'Editar' as const },
  { id: 'perm-rol-cont-cartera', roleId: 'rol-cont', module: 'cartera', level: 'Editar' as const },
  { id: 'perm-rol-cont-cuentas-pagar', roleId: 'rol-cont', module: 'cuentas-pagar', level: 'Editar' as const },
  { id: 'perm-rol-cont-activos-fijos', roleId: 'rol-cont', module: 'activos-fijos', level: 'Editar' as const },
  { id: 'perm-rol-cont-auditoria', roleId: 'rol-cont', module: 'auditoria', level: 'Ver' as const },
  ...ALL_MODULES.map(module => ({ id: `perm-rol-aud-${module}`, roleId: 'rol-aud', module, level: 'Ver' as const })),
];

// ── Consolidación ───────────────────────────────────────────────────────────

const consolidationCompanies: ConsolidationCompany[] = [
  { id: 'cia-001', code: 'CIA-001', name: 'Compañía Demo S.A.S.', nit: '900.123.456-7', country: 'Colombia', ownership: 100, status: 'Incluida', assets: 4_820_000_000, liabilities: 2_140_000_000, equity: 2_680_000_000, revenue: 3_640_000_000, expenses: 3_120_000_000, intercompanyReceivable: 232_000_000, intercompanyPayable: 86_000_000 },
  { id: 'cia-002', code: 'CIA-002', name: 'Servicios Logísticos del Norte S.A.S.', nit: '901.556.221-8', country: 'Colombia', ownership: 85, status: 'Incluida', assets: 1_640_000_000, liabilities: 720_000_000, equity: 920_000_000, revenue: 1_280_000_000, expenses: 1_090_000_000, intercompanyReceivable: 86_000_000, intercompanyPayable: 148_000_000 },
  { id: 'cia-003', code: 'CIA-003', name: 'Comercializadora Andina Ltda.', nit: '800.442.117-2', country: 'Colombia', ownership: 70, status: 'Incluida', assets: 1_020_000_000, liabilities: 460_000_000, equity: 560_000_000, revenue: 860_000_000, expenses: 740_000_000, intercompanyReceivable: 0, intercompanyPayable: 84_000_000 },
  { id: 'cia-004', code: 'CIA-004', name: 'Operaciones Panamá S.A.', nit: 'PA-8841-2026', country: 'Panamá', ownership: 51, status: 'En revisión', assets: 860_000_000, liabilities: 390_000_000, equity: 470_000_000, revenue: 520_000_000, expenses: 430_000_000, intercompanyReceivable: 0, intercompanyPayable: 0 },
];

const eliminations: EliminationEntry[] = [
  { id: 'elim-1', period: '2026-02', concept: 'Ventas intercompañía', fromCompany: 'cia-001', toCompany: 'cia-002', account: '4145 / 6135', debit: 148_000_000, credit: 148_000_000, status: 'Aplicada', note: 'Eliminación de ingresos y costo por venta interna de febrero.' },
  { id: 'elim-2', period: '2026-02', concept: 'Préstamo intercompañía', fromCompany: 'cia-001', toCompany: 'cia-003', account: '1305 / 2205', debit: 84_000_000, credit: 84_000_000, status: 'Pendiente', note: 'Cuenta por cobrar y por pagar entre matriz y subordinada.' },
  { id: 'elim-3', period: '2026-02', concept: 'Servicios administrativos', fromCompany: 'cia-001', toCompany: 'cia-002', account: '4145 / 5195', debit: 86_000_000, credit: 86_000_000, status: 'Pendiente', note: 'Reembolso de servicios administrativos del período.' },
];

// ── Distribución secundaria de costos ────────────────────────────────────────

const secondaryAllocations: CostSecondaryAllocation[] = [
  { id: 'sec-1', period: '2026-02', fromCenterId: 'cc-mant', toCenterId: 'cc-prod', driver: 'Horas máquina', driverQty: 3200, amount: 60_831_683, status: 'Aplicada', date: '2026-02-28', note: 'Mantenimiento distribuido por horas máquina.' },
  { id: 'sec-2', period: '2026-02', fromCenterId: 'cc-mant', toCenterId: 'cc-empa', driver: 'Horas máquina', driverQty: 1850, amount: 35_168_317, status: 'Aplicada', date: '2026-02-28', note: 'Mantenimiento distribuido por horas máquina.' },
  { id: 'sec-3', period: '2026-02', fromCenterId: 'cc-ti', toCenterId: 'cc-prod', driver: 'Horas máquina', driverQty: 3200, amount: 55_762_376, status: 'Calculada', date: '2026-02-28', note: 'Tecnología distribuida por horas máquina.' },
  { id: 'sec-4', period: '2026-02', fromCenterId: 'cc-ti', toCenterId: 'cc-empa', driver: 'Horas máquina', driverQty: 1850, amount: 32_237_624, status: 'Calculada', date: '2026-02-28', note: 'Tecnología distribuida por horas máquina.' },
];

export function createSeed(): FinanceState {
  sequence = 0;
  return {
    parties,
    invoices,
    resolutions,
    dianEvents,
    products,
    taxFilings,
    exogenousReports,
    receivables,
    receipts,
    applications,
    collections,
    writeOffs,
    advances,
    impairmentProvisions,
    customerReconciliations,
    payables,
    proposals,
    payments,
    retentions,
    expenses,
    supplierAdjustments,
    supplierReconciliations,
    accounts,
    statements,
    statementLines,
    rules,
    reconciliations,
    transfers,
    checks,
    pettyCashes,
    budgets,
    budgetAlerts,
    budgetProjections,
    assetCategories,
    assets,
    depreciationEntries,
    assetMovements,
    revaluations,
    disposals,
    assetReconciliations,
    assetTransfers,
    costCenters,
    costPools,
    costAllocations,
    costObjects,
    costActivities,
    costRuns,
    loans,
    amortization,
    creditLines,
    leases,
    indicators,
    projections,
    approvalRules,
    approvalRequests,
    roles,
    rolePermissions,
    consolidationCompanies,
    eliminations,
    secondaryAllocations,
    audit: [
      { id: uid('audit'), at: '2026-02-28 16:42', user: 'Laura Gómez', module: 'facturacion', action: 'Factura FV-1048 aceptada por la DIAN' },
      { id: uid('audit'), at: '2026-02-27 11:10', user: 'Carlos Pérez', module: 'cartera', action: 'Recibo REC-1204 registrado por $ 4.420.000' },
      { id: uid('audit'), at: '2026-02-26 09:35', user: 'Laura Gómez', module: 'cuentas-pagar', action: 'Propuesta PROP-028 enviada a aprobación' },
      { id: uid('audit'), at: '2026-02-25 15:20', user: 'María Restrepo', module: 'tesoreria', action: 'Extracto EXT-001 importado con 5 movimientos' },
      { id: uid('audit'), at: '2026-02-20 10:05', user: 'Laura Gómez', module: 'presupuesto', action: 'Presupuesto 2026 V3 aprobado como versión vigente' },
      { id: uid('audit'), at: '2026-02-26 17:10', user: 'Laura Gómez', module: 'activos-fijos', action: 'Revalorización AV-2026-014 aprobada para la bodega norte' },
    ],
  };
}

export { addDays };
