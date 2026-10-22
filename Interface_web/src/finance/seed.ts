import type {
  Advance,
  BankAccount,
  BankStatement,
  BudgetLine,
  BudgetVersion,
  CashMovement,
  Check,
  CollectionAction,
  DianEvent,
  Expense,
  FinanceState,
  Invoice,
  InvoiceKind,
  InvoiceLine,
  Party,
  Payable,
  Payment,
  PaymentApplication,
  PaymentProposal,
  PettyCash,
  Product,
  Receivable,
  Receipt,
  Reconciliation,
  ReconciliationRule,
  Resolution,
  Retention,
  StatementLine,
  Transfer,
  WriteOff,
} from './types';
import { addDays, invoiceTotals } from './selectors';

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

const expenses: Expense[] = [
  { id: 'gas-1', number: 'GAS-0101', date: '2026-02-14', employee: 'Laura Gómez', category: 'Viaje', costCenter: 'ADM', amount: 1_850_000, tax: 0, support: 'Factura hotel y tiquetes', status: 'Aprobado', note: 'Visita a cliente en Medellín.' },
  { id: 'gas-2', number: 'GAS-0102', date: '2026-02-21', employee: 'Carlos Pérez', category: 'Papelería', costCenter: 'ADM', amount: 320_000, tax: 60_800, support: 'Factura papelería', status: 'Pendiente aprobación', note: 'Insumos para archivo.' },
  { id: 'gas-3', number: 'GAS-0103', date: '2026-02-05', employee: 'María Restrepo', category: 'Capacitación', costCenter: 'ADM', amount: 2_400_000, tax: 0, support: 'Certificado curso', status: 'Reembolsado', note: 'Curso de normativa tributaria.' },
  { id: 'gas-4', number: 'GAS-0104', date: '2026-02-27', employee: 'Carlos Pérez', category: 'Transporte', costCenter: 'OPE', amount: 480_000, tax: 0, support: '', status: 'Borrador', note: 'Desplazamientos operativos.' },
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

export function createSeed(): FinanceState {
  sequence = 0;
  return {
    parties,
    invoices,
    resolutions,
    dianEvents,
    products,
    receivables,
    receipts,
    applications,
    collections,
    writeOffs,
    advances,
    payables,
    proposals,
    payments,
    retentions,
    expenses,
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
    audit: [
      { id: uid('audit'), at: '2026-02-28 16:42', user: 'Laura Gómez', module: 'facturacion', action: 'Factura FV-1048 aceptada por la DIAN' },
      { id: uid('audit'), at: '2026-02-27 11:10', user: 'Carlos Pérez', module: 'cartera', action: 'Recibo REC-1204 registrado por $ 4.420.000' },
      { id: uid('audit'), at: '2026-02-26 09:35', user: 'Laura Gómez', module: 'cuentas-pagar', action: 'Propuesta PROP-028 enviada a aprobación' },
      { id: uid('audit'), at: '2026-02-25 15:20', user: 'María Restrepo', module: 'tesoreria', action: 'Extracto EXT-001 importado con 5 movimientos' },
      { id: uid('audit'), at: '2026-02-20 10:05', user: 'Laura Gómez', module: 'presupuesto', action: 'Presupuesto 2026 V3 aprobado como versión vigente' },
    ],
  };
}

export { addDays };
