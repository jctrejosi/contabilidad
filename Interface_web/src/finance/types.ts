export type FinancialModuleId =
  | 'facturacion'
  | 'cartera'
  | 'cuentas-pagar'
  | 'tesoreria'
  | 'presupuesto';

export type PartyKind = 'Cliente' | 'Proveedor' | 'Ambos';

export interface Party {
  id: string;
  name: string;
  nit: string;
  kind: PartyKind;
  city: string;
  email: string;
  phone: string;
  term: number;
  cupo: number;
}

export type InvoiceKind = 'FV' | 'FC' | 'NC' | 'ND';
export type InvoiceStatus =
  | 'Borrador'
  | 'Por enviar'
  | 'Contabilizada'
  | 'Anulada'
  | 'Revertida';
export type DianStatus =
  | 'No aplica'
  | 'Pendiente'
  | 'Enviada'
  | 'Aceptada'
  | 'Rechazada'
  | 'Contingencia';

export interface InvoiceLine {
  id: string;
  productCode: string;
  description: string;
  quantity: number;
  price: number;
  discountPct: number;
  taxRate: number;
  withholdingRate: number;
  account: string;
  costCenter: string;
}

export interface Invoice {
  id: string;
  kind: InvoiceKind;
  number: string;
  partyId: string;
  date: string;
  dueDate: string;
  paymentTerm: number;
  status: InvoiceStatus;
  dianStatus: DianStatus;
  cufe: string;
  resolutionId: string;
  referenceId: string;
  motive: string;
  notes: string;
  lines: InvoiceLine[];
  createdAt: string;
}

export interface Resolution {
  id: string;
  prefix: string;
  from: number;
  to: number;
  current: number;
  validFrom: string;
  validTo: string;
  type: 'Venta' | 'Compra';
  active: boolean;
}

export interface DianEvent {
  id: string;
  invoiceId: string;
  at: string;
  status: DianStatus;
  code: string;
  message: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  unit: string;
  price: number;
  taxRate: number;
  account: string;
  active: boolean;
}

export type ReceivableStatus =
  | 'Al día'
  | 'Por vencer'
  | 'Vencida'
  | 'Acuerdo de pago'
  | 'Pagada'
  | 'Castigada'
  | 'Revertida';

export interface Receivable {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  partyId: string;
  issueDate: string;
  dueDate: string;
  original: number;
  balance: number;
  status: ReceivableStatus;
  owner: string;
  lastAction: string;
  promiseDate: string;
  promiseAmount: number;
}

export type ReceiptStatus = 'Sin aplicar' | 'Parcial' | 'Aplicado';

export interface Receipt {
  id: string;
  number: string;
  partyId: string;
  date: string;
  method: 'Transferencia' | 'Efectivo' | 'Cheque' | 'PSE';
  accountId: string;
  amount: number;
  applied: number;
  reference: string;
  status: ReceiptStatus;
}

export interface PaymentApplication {
  id: string;
  receiptId: string;
  receivableId: string;
  amount: number;
  date: string;
}

export interface CollectionAction {
  id: string;
  receivableId: string;
  date: string;
  channel: 'Llamada' | 'Correo' | 'Visita' | 'WhatsApp';
  result: 'Promesa' | 'Sin respuesta' | 'Pago parcial' | 'Disputa' | 'Acuerdo';
  note: string;
  user: string;
  promiseDate: string;
  promiseAmount: number;
  fulfilled: 'Pendiente' | 'Cumplida' | 'Incumplida' | 'No aplica';
}

export interface WriteOff {
  id: string;
  receivableId: string;
  date: string;
  amount: number;
  reason: string;
  status: 'Solicitado' | 'Aprobado' | 'Rechazado';
  requestedBy: string;
}

export interface Advance {
  id: string;
  number: string;
  partyId: string;
  date: string;
  amount: number;
  applied: number;
  reference: string;
  direction: 'AR' | 'AP';
}

export type PayableStatus =
  | 'Abierta'
  | 'En propuesta'
  | 'Programada'
  | 'Pagada'
  | 'Vencida'
  | 'En disputa'
  | 'Revertida';

export interface Payable {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  partyId: string;
  issueDate: string;
  dueDate: string;
  original: number;
  withholdings: number;
  balance: number;
  status: PayableStatus;
  priority: 'Alta' | 'Media' | 'Baja';
  owner: string;
}

export type ProposalStatus =
  | 'Borrador'
  | 'Pendiente aprobación'
  | 'Aprobada'
  | 'Rechazada'
  | 'Pagada';

export interface PaymentProposal {
  id: string;
  number: string;
  date: string;
  cutoff: string;
  payableIds: string[];
  status: ProposalStatus;
  createdBy: string;
  approvedBy: string;
  rejectedReason: string;
  note: string;
  accountId: string;
}

export interface Payment {
  id: string;
  number: string;
  date: string;
  partyId: string;
  accountId: string;
  amount: number;
  applied: number;
  method: 'Transferencia' | 'Cheque' | 'Efectivo' | 'ACH';
  reference: string;
  status: 'Registrado' | 'Aplicado' | 'Anulado';
  applications: { payableId: string; amount: number }[];
}

export interface Retention {
  id: string;
  invoiceId: string;
  partyId: string;
  concept: 'Retención en la fuente' | 'Retención de IVA' | 'ReteICA';
  base: number;
  rate: number;
  amount: number;
  period: string;
  certificateNumber: string;
  status: 'Calculada' | 'Certificada';
  date: string;
}

export interface Expense {
  id: string;
  number: string;
  date: string;
  employee: string;
  category: string;
  costCenter: string;
  amount: number;
  tax: number;
  support: string;
  status: 'Borrador' | 'Pendiente aprobación' | 'Aprobado' | 'Reembolsado';
  note: string;
}

export interface BankAccount {
  id: string;
  kind: 'Banco' | 'Caja';
  bank: string;
  number: string;
  currency: 'COP' | 'USD';
  ledgerAccount: string;
  initial: number;
  balance: number;
  status: 'Activa' | 'Inactiva';
  responsible: string;
}

export interface StatementLine {
  id: string;
  statementId: string;
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  matched: number;
  suggestion: string;
  status: 'Pendiente' | 'Sugerido' | 'Conciliado' | 'Diferencia';
}

export interface BankStatement {
  id: string;
  accountId: string;
  from: string;
  to: string;
  opening: number;
  closing: number;
  status: 'Abierto' | 'Validado' | 'Conciliado';
  fileName: string;
}

export interface ReconciliationRule {
  id: string;
  name: string;
  field: 'Referencia' | 'Importe' | 'Descripción' | 'Tercero';
  operator: 'Contiene' | 'Igual a' | 'Entre';
  value: string;
  action: string;
  priority: number;
  active: boolean;
  matches: number;
}

export interface Reconciliation {
  id: string;
  statementLineId: string;
  bookType: 'Recibo' | 'Pago' | 'Transferencia' | 'Ajuste';
  bookRef: string;
  amount: number;
  difference: number;
  note: string;
  date: string;
  user: string;
}

export interface Transfer {
  id: string;
  number: string;
  date: string;
  fromId: string;
  toId: string;
  amount: number;
  fee: number;
  reference: string;
  status: 'Registrada' | 'Conciliada';
}

export interface Check {
  id: string;
  number: string;
  accountId: string;
  beneficiary: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: 'Emitido' | 'Cobrado' | 'Anulado';
}

export interface CashMovement {
  id: string;
  date: string;
  type: 'Ingreso' | 'Egreso';
  concept: string;
  amount: number;
  support: string;
  responsible: string;
}

export interface PettyCash {
  id: string;
  name: string;
  responsible: string;
  opening: number;
  balance: number;
  status: 'Abierta' | 'Cerrada';
  movements: CashMovement[];
}

export interface BudgetLine {
  id: string;
  account: string;
  accountName: string;
  costCenter: string;
  monthly: number[];
  executed: number;
  committed: number;
}

export type BudgetStatus = 'Borrador' | 'En revisión' | 'Aprobada' | 'Cerrada';

export interface BudgetVersion {
  id: string;
  name: string;
  year: number;
  scenario: 'Base' | 'Optimista' | 'Conservador';
  status: BudgetStatus;
  owner: string;
  approvedBy: string;
  approvedAt: string;
  note: string;
  current: boolean;
  lines: BudgetLine[];
}

export interface BudgetAlert {
  id: string;
  versionId: string;
  account: string;
  center: string;
  type: 'Umbral' | 'Desviación' | 'Compromiso';
  message: string;
  severity: 'Alta' | 'Media' | 'Baja';
  status: 'Abierta' | 'Silenciada';
  date: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  user: string;
  module: FinancialModuleId | 'suite';
  action: string;
}

export interface FinanceState {
  parties: Party[];
  invoices: Invoice[];
  resolutions: Resolution[];
  dianEvents: DianEvent[];
  products: Product[];
  receivables: Receivable[];
  receipts: Receipt[];
  applications: PaymentApplication[];
  collections: CollectionAction[];
  writeOffs: WriteOff[];
  advances: Advance[];
  payables: Payable[];
  proposals: PaymentProposal[];
  payments: Payment[];
  retentions: Retention[];
  expenses: Expense[];
  accounts: BankAccount[];
  statements: BankStatement[];
  statementLines: StatementLine[];
  rules: ReconciliationRule[];
  reconciliations: Reconciliation[];
  transfers: Transfer[];
  checks: Check[];
  pettyCashes: PettyCash[];
  budgets: BudgetVersion[];
  budgetAlerts: BudgetAlert[];
  audit: AuditEntry[];
}
