export type FinancialModuleId =
  | 'facturacion'
  | 'cartera'
  | 'cuentas-pagar'
  | 'tesoreria'
  | 'presupuesto'
  | 'activos-fijos'
  | 'costos'
  | 'financiacion'
  | 'indicadores'
  | 'aprobaciones'
  | 'auditoria'
  | 'consolidacion';

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

export type TaxFormCode = '300' | '350' | '110';
export type TaxFilingStatus =
  | 'Borrador'
  | 'Calculada'
  | 'Validada'
  | 'Presentada'
  | 'Aceptada'
  | 'Rechazada';

export type TaxBoxKind = 'informativo' | 'calculado' | 'editable';

export interface TaxBox {
  number: string;
  concept: string;
  value: number;
  kind: TaxBoxKind;
}

export interface TaxFiling {
  id: string;
  code: TaxFormCode;
  name: string;
  year: number;
  period: string;
  dueDate: string;
  status: TaxFilingStatus;
  boxes: TaxBox[];
  balance: number;
  presentedAt: string;
  receipt: string;
  note: string;
}

export type ExogenousStatus = 'En preparación' | 'Validada' | 'Presentada';

export interface ExogenousRow {
  id: string;
  format: string;
  concept: string;
  thirdParties: number;
  total: number;
  issues: number;
}

export interface ExogenousReport {
  id: string;
  year: number;
  status: ExogenousStatus;
  dueDate: string;
  rows: ExogenousRow[];
  note: string;
  presentedAt: string;
  receipt: string;
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

export type ImpairmentBasis = 'NIIF 9' | 'Fiscal' | 'Interna';
export type ImpairmentStatus = 'Calculada' | 'Aprobada' | 'Contabilizada' | 'Reversada';

export interface ImpairmentProvision {
  id: string;
  period: string;
  date: string;
  basis: ImpairmentBasis;
  opening: number;
  required: number;
  charge: number;
  recovery: number;
  closing: number;
  status: ImpairmentStatus;
  approvedBy: string;
  note: string;
}

export type ReconciliationStatus = 'Pendiente' | 'Conciliada' | 'Con diferencia';

export interface CustomerReconciliation {
  id: string;
  period: string;
  partyId: string;
  ledgerBalance: number;
  statementBalance: number;
  difference: number;
  status: ReconciliationStatus;
  note: string;
  checkedBy: string;
  checkedAt: string;
  confirmedByClient: boolean;
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

export type SupplierAdjustmentKind =
  | 'Descuento pronto pago'
  | 'Nota débito'
  | 'Nota crédito'
  | 'Devolución'
  | 'Ajuste de precio';

export type SupplierAdjustmentStatus = 'Borrador' | 'Aprobado' | 'Aplicado' | 'Rechazado';

export interface SupplierAdjustment {
  id: string;
  number: string;
  payableId: string;
  partyId: string;
  date: string;
  kind: SupplierAdjustmentKind;
  base: number;
  rate: number;
  amount: number;
  status: SupplierAdjustmentStatus;
  requestedBy: string;
  approvedBy: string;
  note: string;
}

export interface SupplierReconciliation {
  id: string;
  period: string;
  partyId: string;
  ledgerBalance: number;
  statementBalance: number;
  difference: number;
  status: ReconciliationStatus;
  note: string;
  checkedBy: string;
  checkedAt: string;
  confirmedBySupplier: boolean;
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

export interface BudgetProjection {
  id: string;
  versionId: string;
  project: string;
  center: string;
  owner: string;
  budget: number;
  executed: number;
  monthly: number[];
  status: 'En curso' | 'Cierre estimado' | 'Cerrado';
  note: string;
}

export type AssetStatus =
  | 'En operación'
  | 'En montaje'
  | 'Totalmente depreciado'
  | 'Dado de baja'
  | 'Vendido';

export type DepreciationMethod = 'Línea recta' | 'Saldos decrecientes' | 'Unidades de producción';

export interface AssetCategory {
  id: string;
  code: string;
  name: string;
  assetAccount: string;
  depreciationAccount: string;
  accumulatedAccount: string;
  impairmentAccount: string;
  revaluationAccount: string;
  usefulLifeMonths: number;
  taxUsefulLifeMonths: number;
  residualPct: number;
  method: DepreciationMethod;
  depreciable: boolean;
  active: boolean;
  note: string;
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  description: string;
  categoryId: string;
  serial: string;
  plate: string;
  location: string;
  costCenter: string;
  responsible: string;
  supplier: string;
  invoiceRef: string;
  acquisitionDate: string;
  inServiceDate: string;
  acquisitionCost: number;
  improvements: number;
  revaluation: number;
  impairment: number;
  residualValue: number;
  usefulLifeMonths: number;
  method: DepreciationMethod;
  depreciatedMonths: number;
  accumulatedDepreciation: number;
  lastDepreciation: string;
  estimatedUnits: number;
  producedUnits: number;
  status: AssetStatus;
  insurancePolicy: string;
  warrantyUntil: string;
  disposedAt: string;
  disposalValue: number;
  notes: string;
}

export type DepreciationStatus = 'Proyectada' | 'Contabilizada' | 'Reversada';

export interface DepreciationEntry {
  id: string;
  period: string;
  assetId: string;
  amount: number;
  accumulatedAfter: number;
  status: DepreciationStatus;
  postedAt: string;
  costCenter: string;
  account: string;
}

export type AssetMovementType =
  | 'Adquisición'
  | 'Mejora'
  | 'Depreciación'
  | 'Revalorización'
  | 'Deterioro'
  | 'Baja'
  | 'Venta'
  | 'Traslado'
  | 'Ajuste';

export interface AssetMovement {
  id: string;
  assetId: string;
  date: string;
  type: AssetMovementType;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  reference: string;
  user: string;
}

export type RevaluationStatus = 'Borrador' | 'Aprobada' | 'Aplicada' | 'Rechazada';

export interface AssetRevaluation {
  id: string;
  assetId: string;
  date: string;
  previousValue: number;
  newValue: number;
  surplus: number;
  appraiser: string;
  report: string;
  status: RevaluationStatus;
  approvedBy: string;
  note: string;
}

export type DisposalType = 'Venta' | 'Obsolescencia' | 'Donación' | 'Pérdida' | 'Chatarra';
export type DisposalStatus = 'Solicitada' | 'Aprobada' | 'Aplicada' | 'Rechazada';

export interface AssetDisposal {
  id: string;
  assetId: string;
  date: string;
  type: DisposalType;
  proceeds: number;
  netBookValue: number;
  gainLoss: number;
  status: DisposalStatus;
  requestedBy: string;
  approvedBy: string;
  note: string;
  invoiceRef: string;
}

export type AssetReconciliationStatus = 'Conciliada' | 'Diferencia' | 'Pendiente';

export interface AssetReconciliation {
  id: string;
  period: string;
  categoryId: string;
  ledgerGross: number;
  ledgerAccumulated: number;
  ledgerImpairment: number;
  status: AssetReconciliationStatus;
  note: string;
  checkedBy: string;
  checkedAt: string;
}

export type AssetTransferStatus = 'Solicitado' | 'Aprobado' | 'Aplicado' | 'Rechazado';

export interface AssetTransfer {
  id: string;
  assetId: string;
  date: string;
  fromLocation: string;
  toLocation: string;
  fromCenter: string;
  toCenter: string;
  fromResponsible: string;
  toResponsible: string;
  reason: string;
  status: AssetTransferStatus;
  requestedBy: string;
  approvedBy: string;
  note: string;
}

// ── Costos ──────────────────────────────────────────────────────────────────

export type CostCenterKind = 'Producción' | 'Servicio' | 'Administrativo' | 'Comercial';
export type CostObjectKind = 'Producto' | 'Servicio' | 'Proyecto';

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  kind: CostCenterKind;
  manager: string;
  /** Inductor con el que recibe costos indirectos. */
  driver: string;
  driverUnit: string;
  /** Consumo del inductor en el período. */
  driverQty: number;
  /** Bases de distribución para los pools de CIF. */
  areaM2: number;
  energyKwh: number;
  machineHours: number;
  insuredValue: number;
  directCost: number;
  status: 'Activo' | 'Inactivo';
}

export interface CostPool {
  id: string;
  code: string;
  name: string;
  account: string;
  amount: number;
  driver: string;
  driverUnit: string;
  period: string;
}

export interface CostAllocation {
  id: string;
  poolId: string;
  centerId: string;
  driverQty: number;
  amount: number;
  period: string;
  date: string;
}

export interface CostObject {
  id: string;
  code: string;
  name: string;
  kind: CostObjectKind;
  productCode: string;
  centerId: string;
  units: number;
  period: string;
  /** Cantidad estándar por unidad. */
  standardQty: number;
  /** Cantidad real por unidad. */
  actualQty: number;
  standardPrice: number;
  actualPrice: number;
  revenue: number;
}

export interface CostActivity {
  id: string;
  code: string;
  name: string;
  centerId: string;
  driver: string;
  driverUnit: string;
  driverQty: number;
  totalCost: number;
  period: string;
}

export interface CostRun {
  id: string;
  number: string;
  date: string;
  period: string;
  method: 'CIF' | 'ABC';
  total: number;
  status: 'Calculada' | 'Contabilizada';
  user: string;
}

// ── Financiación y deuda ────────────────────────────────────────────────────

export type LoanStatus = 'Vigente' | 'Pagado' | 'En mora' | 'Cancelado';

export interface Loan {
  id: string;
  code: string;
  bank: string;
  principal: number;
  /** Tasa efectiva anual, en porcentaje. */
  annualRate: number;
  termMonths: number;
  startDate: string;
  purpose: string;
  status: LoanStatus;
  creditLineId: string;
  note: string;
}

export interface AmortizationRow {
  id: string;
  loanId: string;
  number: number;
  date: string;
  opening: number;
  payment: number;
  interest: number;
  principal: number;
  closing: number;
  status: 'Pendiente' | 'Pagado';
}

export interface CreditLine {
  id: string;
  code: string;
  bank: string;
  approved: number;
  used: number;
  annualRate: number;
  expiresAt: string;
  status: 'Vigente' | 'Vencida' | 'Cerrada';
}

export interface Lease {
  id: string;
  code: string;
  assetName: string;
  lessor: string;
  monthlyPayment: number;
  termMonths: number;
  startDate: string;
  annualRate: number;
  option: 'Compra' | 'Devolución';
  status: 'Vigente' | 'Finalizado';
}

// ── Indicadores y proyecciones ──────────────────────────────────────────────

export type IndicatorGroup = 'Liquidez' | 'Endeudamiento' | 'Rentabilidad' | 'Actividad' | 'Presupuesto';

export interface Indicator {
  id: string;
  code: string;
  name: string;
  group: IndicatorGroup;
  formula: string;
  unit: 'veces' | '%' | 'días' | '$';
  target: number;
  actual: number;
  previous: number;
  direction: 'Mayor es mejor' | 'Menor es mejor';
  note: string;
}

export type ProjectionScenario = 'Base' | 'Optimista' | 'Conservador';

export interface ProjectionLine {
  id: string;
  account: string;
  accountName: string;
  type: 'Ingreso' | 'Costo' | 'Gasto' | 'Inversión';
  monthly: number[];
}

export interface Projection {
  id: string;
  name: string;
  year: number;
  scenario: ProjectionScenario;
  current: boolean;
  note: string;
  lines: ProjectionLine[];
}

export interface AuditEntry {
  id: string;
  at: string;
  user: string;
  module: FinancialModuleId | 'suite';
  action: string;
}

// ── Aprobaciones ────────────────────────────────────────────────────────────

export type ApprovalStatus = 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Delegada' | 'Vencida';

export interface ApprovalLevel {
  level: number;
  role: string;
  minAmount: number;
}

export interface ApprovalRule {
  id: string;
  name: string;
  module: FinancialModuleId;
  concept: string;
  minAmount: number;
  maxAmount: number;
  levels: ApprovalLevel[];
  active: boolean;
  note: string;
}

export interface ApprovalStep {
  id: string;
  level: number;
  role: string;
  user: string;
  action: 'Pendiente' | 'Aprobada' | 'Rechazada' | 'Delegada';
  at: string;
  note: string;
}

export interface ApprovalRequest {
  id: string;
  number: string;
  module: FinancialModuleId;
  concept: string;
  reference: string;
  party: string;
  amount: number;
  requestedBy: string;
  requestedAt: string;
  dueDate: string;
  status: ApprovalStatus;
  currentLevel: number;
  totalLevels: number;
  ruleId: string;
  history: ApprovalStep[];
  note: string;
}

// ── Auditoría y permisos ────────────────────────────────────────────────────

export type PermissionLevel = 'Administrar' | 'Aprobar' | 'Editar' | 'Ver' | 'Sin acceso';

export interface Role {
  id: string;
  name: string;
  description: string;
  users: string[];
  active: boolean;
}

export interface RolePermission {
  id: string;
  roleId: string;
  module: FinancialModuleId | 'suite';
  level: PermissionLevel;
}

// ── Consolidación ───────────────────────────────────────────────────────────

export type ConsolidationCompanyStatus = 'Incluida' | 'En revisión' | 'Excluida';

export interface ConsolidationCompany {
  id: string;
  code: string;
  name: string;
  nit: string;
  country: string;
  ownership: number;
  status: ConsolidationCompanyStatus;
  assets: number;
  liabilities: number;
  equity: number;
  revenue: number;
  expenses: number;
  intercompanyReceivable: number;
  intercompanyPayable: number;
}

export type EliminationStatus = 'Pendiente' | 'Aplicada' | 'Revisada';

export interface EliminationEntry {
  id: string;
  period: string;
  concept: string;
  fromCompany: string;
  toCompany: string;
  account: string;
  debit: number;
  credit: number;
  status: EliminationStatus;
  note: string;
}

export interface CostSecondaryAllocation {
  id: string;
  period: string;
  fromCenterId: string;
  toCenterId: string;
  driver: string;
  driverQty: number;
  amount: number;
  status: 'Calculada' | 'Aplicada';
  date: string;
  note: string;
}

export interface FinanceState {
  parties: Party[];
  invoices: Invoice[];
  resolutions: Resolution[];
  dianEvents: DianEvent[];
  products: Product[];
  taxFilings: TaxFiling[];
  exogenousReports: ExogenousReport[];
  receivables: Receivable[];
  receipts: Receipt[];
  applications: PaymentApplication[];
  collections: CollectionAction[];
  writeOffs: WriteOff[];
  advances: Advance[];
  impairmentProvisions: ImpairmentProvision[];
  customerReconciliations: CustomerReconciliation[];
  payables: Payable[];
  proposals: PaymentProposal[];
  payments: Payment[];
  retentions: Retention[];
  expenses: Expense[];
  supplierAdjustments: SupplierAdjustment[];
  supplierReconciliations: SupplierReconciliation[];
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
  budgetProjections: BudgetProjection[];
  assetCategories: AssetCategory[];
  assets: Asset[];
  depreciationEntries: DepreciationEntry[];
  assetMovements: AssetMovement[];
  revaluations: AssetRevaluation[];
  disposals: AssetDisposal[];
  assetReconciliations: AssetReconciliation[];
  assetTransfers: AssetTransfer[];
  costCenters: CostCenter[];
  costPools: CostPool[];
  costAllocations: CostAllocation[];
  costObjects: CostObject[];
  costActivities: CostActivity[];
  costRuns: CostRun[];
  loans: Loan[];
  amortization: AmortizationRow[];
  creditLines: CreditLine[];
  leases: Lease[];
  indicators: Indicator[];
  projections: Projection[];
  approvalRules: ApprovalRule[];
  approvalRequests: ApprovalRequest[];
  roles: Role[];
  rolePermissions: RolePermission[];
  consolidationCompanies: ConsolidationCompany[];
  eliminations: EliminationEntry[];
  secondaryAllocations: CostSecondaryAllocation[];
  audit: AuditEntry[];
}
