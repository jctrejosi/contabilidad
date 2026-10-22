import { useState, type ReactNode } from 'react';
import type { NavPage } from '../../components/Shell';
import Icon from '../../components/Icon';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  FilterBar,
  FilterSelect,
  INPUT,
  KpiCard,
  Modal,
  Money,
  PageHeader,
  Progress,
  SectionTitle,
  type Column,
} from '../../components/finance/ui';
import { FINANCIAL_MODULES } from '../../data/finance';
import { USUARIO } from '../../data/mock';
import { useFinance } from '../../finance/store';
import {
  HOY,
  addDays,
  daysBetween,
  fmtDate,
  money,
  partyOf,
  statusTone,
  sum,
} from '../../finance/selectors';
import type {
  BankAccount,
  BankStatement,
  CashMovement,
  Check,
  FinanceState,
  PettyCash,
  Reconciliation,
  ReconciliationRule,
  StatementLine,
  Transfer,
} from '../../finance/types';
import FlujoReal from './tesoreria/FlujoReal';
import FlujoProyectado from './tesoreria/FlujoProyectado';
import Liquidez from './tesoreria/Liquidez';

interface Props {
  page: string;
  onNavigate: (page: NavPage) => void;
}

type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan';

const MODULE = FINANCIAL_MODULES.tesoreria;
const SLUGS = MODULE.nav.map(item => item.slug);

const NAV_TITLE: Record<string, { title: string; subtitle: string }> = {
  panel: {
    title: 'Panel de tesorería',
    subtitle: 'Posición consolidada de bancos y caja, movimientos del día, conciliación y alertas operativas.',
  },
  flujo: {
    title: 'Flujo de caja real',
    subtitle: 'Entradas y salidas efectivas por mes, saldo de cierre y detalle de movimientos.',
  },
  proyectado: {
    title: 'Flujo de caja proyectado',
    subtitle: 'Recaudos, pagos, deuda y leasing proyectados a seis meses.',
  },
  liquidez: {
    title: 'Liquidez y recaudos',
    subtitle: 'Cobertura de pagos, posición semanal y calendario de recaudos y compromisos.',
  },
  cuentas: {
    title: 'Cuentas bancarias',
    subtitle: 'Maestro de cuentas de banco y caja con saldo, responsable y cuenta contable asociada.',
  },
  extractos: {
    title: 'Extractos bancarios',
    subtitle: 'Importación, validación y detalle de extractos por cuenta y período.',
  },
  conciliacion: {
    title: 'Conciliación bancaria',
    subtitle: 'Cruce entre las líneas del extracto y las partidas del libro con sugerencias y diferencias.',
  },
  reglas: {
    title: 'Reglas de conciliación',
    subtitle: 'Automatiza el cruce de referencias, importes y descripciones de los extractos.',
  },
  transferencias: {
    title: 'Transferencias entre cuentas',
    subtitle: 'Traslados de disponibilidad con control de saldo, comisión y trazabilidad.',
  },
  cheques: {
    title: 'Cheques',
    subtitle: 'Emisión, cobro y anulación de cheques conservando el histórico.',
  },
  caja: {
    title: 'Caja menor',
    subtitle: 'Movimientos por responsable, arqueo y cierre de cada caja.',
  },
  partidas: {
    title: 'Partidas conciliatorias',
    subtitle: 'Reporte de líneas pendientes, antigüedad, diferencia entre banco y libros y ajustes.',
  },
};

interface AccountDraft {
  kind: BankAccount['kind'];
  bank: string;
  number: string;
  currency: BankAccount['currency'];
  ledgerAccount: string;
  initial: number;
  responsible: string;
}

interface StatementDraft {
  accountId: string;
  fileName: string;
  from: string;
  to: string;
  opening: number;
  closing: number;
}

interface RuleDraft {
  name: string;
  field: ReconciliationRule['field'];
  operator: ReconciliationRule['operator'];
  value: string;
  action: string;
  priority: number;
  active: boolean;
}

interface TransferDraft {
  fromId: string;
  toId: string;
  date: string;
  amount: number;
  fee: number;
  reference: string;
}

interface CheckDraft {
  number: string;
  accountId: string;
  beneficiary: string;
  amount: number;
  issueDate: string;
  dueDate: string;
}

interface CashMoveDraft {
  date: string;
  type: CashMovement['type'];
  concept: string;
  amount: number;
  support: string;
  responsible: string;
}

interface ManualLinkDraft {
  statementLineId: string;
  bookType: Reconciliation['bookType'];
  bookRef: string;
  amount: number;
  note: string;
}

interface AdjustmentDraft {
  amount: number;
  difference: number;
  note: string;
}

interface BookEntry {
  type: 'Recibo' | 'Pago' | 'Transferencia';
  ref: string;
  date: string;
  description: string;
  amount: number;
  accountId: string;
}

interface ImportMovement {
  reference: string;
  description: string;
  debit: number;
  credit: number;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function maskNumber(value: string): string {
  const clean = value.replace(/\s+/g, '');
  return `****${clean.slice(-4)}`;
}

function accountOf(state: FinanceState, id: string): BankAccount | undefined {
  return state.accounts.find(account => account.id === id);
}

function statementOf(state: FinanceState, id: string): BankStatement | undefined {
  return state.statements.find(statement => statement.id === id);
}

function lineValue(line: StatementLine): number {
  return line.debit + line.credit;
}

function reconciledFor(state: FinanceState, lineId: string): number {
  return sum(state.reconciliations.filter(item => item.statementLineId === lineId).map(item => item.amount));
}

function reconciledForBook(state: FinanceState, type: string, ref: string): number {
  return sum(
    state.reconciliations
      .filter(item => item.bookType === type && item.bookRef === ref)
      .map(item => item.amount),
  );
}

function pendingStatementLines(state: FinanceState): StatementLine[] {
  return state.statementLines.filter(line => line.status !== 'Conciliado' || line.matched < lineValue(line));
}

function bookEntries(state: FinanceState): BookEntry[] {
  const receipts: BookEntry[] = state.receipts.map(receipt => ({
    type: 'Recibo',
    ref: receipt.number,
    date: receipt.date,
    description: `${partyOf(state, receipt.partyId)?.name ?? 'Cliente'} · ${receipt.reference}`,
    amount: receipt.amount,
    accountId: receipt.accountId,
  }));
  const payments: BookEntry[] = state.payments.map(payment => ({
    type: 'Pago',
    ref: payment.number,
    date: payment.date,
    description: `${partyOf(state, payment.partyId)?.name ?? 'Proveedor'} · ${payment.reference}`,
    amount: payment.amount,
    accountId: payment.accountId,
  }));
  const transfers: BookEntry[] = state.transfers.map(transfer => ({
    type: 'Transferencia',
    ref: transfer.number,
    date: transfer.date,
    description: `${accountOf(state, transfer.fromId)?.bank ?? 'Origen'} → ${accountOf(state, transfer.toId)?.bank ?? 'Destino'} · ${transfer.reference}`,
    amount: transfer.amount,
    accountId: transfer.toId,
  }));
  return [...receipts, ...payments, ...transfers].sort((a, b) => b.date.localeCompare(a.date));
}

function entryKey(entry: BookEntry): string {
  return `${entry.type}|${entry.ref}`;
}

function suggestFor(line: StatementLine, entries: BookEntry[]): { entry?: BookEntry; label: string; confidence: number } {
  const direct = entries.find(entry => {
    const ref = entry.ref.toLowerCase();
    return line.reference.toLowerCase() === ref || line.suggestion.toLowerCase().includes(ref);
  });
  if (direct) {
    return {
      entry: direct,
      label: `${direct.type} ${direct.ref}`,
      confidence: line.reference.toLowerCase() === direct.ref.toLowerCase() ? 100 : 98,
    };
  }
  const amount = lineValue(line);
  const byAmount = entries.find(entry => Math.abs(entry.amount - amount) < 1);
  if (byAmount && line.status !== 'Diferencia') {
    return { entry: byAmount, label: `${byAmount.type} ${byAmount.ref}`, confidence: 92 };
  }
  const reference = line.reference || line.id.toUpperCase();
  return { entry: undefined, label: `Ajuste ${reference}`, confidence: 80 };
}

function matchesRule(line: StatementLine, rule: ReconciliationRule): boolean {
  let source = '';
  if (rule.field === 'Referencia') source = line.reference;
  else if (rule.field === 'Descripción') source = line.description;
  else if (rule.field === 'Importe') source = String(lineValue(line));
  else source = line.description;

  const needle = rule.value.trim();
  if (!needle) return false;

  if (rule.operator === 'Contiene') {
    return source.toLowerCase().includes(needle.toLowerCase());
  }
  if (rule.operator === 'Igual a') {
    if (rule.field === 'Importe') {
      const expected = Number(needle.replace(/[^\d.-]/g, ''));
      return Number.isFinite(expected) && Math.abs(lineValue(line) - expected) < 0.5;
    }
    return source.trim().toLowerCase() === needle.toLowerCase();
  }
  if (rule.field !== 'Importe') return false;
  const parts = needle.split(/[,;]/);
  if (parts.length !== 2) return false;
  const first = Number(parts[0]);
  const second = Number(parts[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return false;
  const value = lineValue(line);
  return value >= Math.min(first, second) && value <= Math.max(first, second);
}

function ruleMatchCount(lines: StatementLine[], rule: ReconciliationRule): number {
  return lines.filter(line => matchesRule(line, rule)).length;
}

function syncStatementStatus(draft: FinanceState, statementId: string): void {
  const statement = draft.statements.find(item => item.id === statementId);
  if (!statement) return;
  const lines = draft.statementLines.filter(item => item.statementId === statementId);
  const allDone = lines.length > 0 && lines.every(line => line.status === 'Conciliado');
  if (allDone) statement.status = 'Conciliado';
  else if (statement.status === 'Conciliado') statement.status = 'Validado';
}

function nextSequence(rows: { number: string }[], prefix: string, width = 3): string {
  const highest = rows.reduce((max, row) => {
    const numeric = Number(row.number.replace(/[^0-9]/g, ''));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);
  return `${prefix}-${String(highest + 1).padStart(width, '0')}`;
}

function statementTone(status: BankStatement['status']): Tone {
  if (status === 'Conciliado') return 'green';
  if (status === 'Validado') return 'cyan';
  return 'amber';
}

function checkTone(status: Check['status']): Tone {
  if (status === 'Cobrado') return 'green';
  if (status === 'Anulado') return 'red';
  return 'amber';
}

function transferTone(status: Transfer['status']): Tone {
  return status === 'Conciliada' ? 'green' : 'blue';
}

function cashTone(status: PettyCash['status']): Tone {
  return status === 'Cerrada' ? 'green' : 'amber';
}

function agingTone(days: number): Tone {
  if (days <= 7) return 'green';
  if (days <= 30) return 'amber';
  return 'red';
}

function agingLabel(days: number): string {
  if (days <= 0) return 'Hoy';
  if (days === 1) return '1 día';
  return `${days} días`;
}

function buildImportMovements(opening: number, closing: number): ImportMovement[] {
  const difference = closing - opening;
  if (Math.abs(difference) < 1) {
    return [
      { reference: 'DEP-IMP-01', description: 'Consignación parcial de clientes', debit: 0, credit: 1_250_000 },
      { reference: 'PAG-IMP-02', description: 'Pago a proveedores del período', debit: 1_500_000, credit: 0 },
      { reference: 'REN-IMP-03', description: 'Rendimientos financieros', debit: 0, credit: 250_000 },
    ];
  }
  if (difference > 0) {
    const first = Math.round(difference * 0.55);
    const debit = Math.round(difference * 0.15);
    const second = difference + debit - first;
    return [
      { reference: 'DEP-IMP-01', description: 'Recaudo de cartera del período', debit: 0, credit: first },
      { reference: 'PAG-IMP-02', description: 'Pago a proveedores del período', debit, credit: 0 },
      { reference: 'DEP-IMP-03', description: 'Consignación de clientes', debit: 0, credit: second },
    ];
  }
  const absolute = Math.abs(difference);
  const first = Math.round(absolute * 0.55);
  const credit = Math.round(absolute * 0.15);
  const second = absolute + credit - first;
  return [
    { reference: 'PAG-IMP-01', description: 'Pago a proveedores del período', debit: first, credit: 0 },
    { reference: 'DEP-IMP-02', description: 'Recaudo de cartera del período', debit: 0, credit },
    { reference: 'PAG-IMP-03', description: 'Comisiones y gastos bancarios', debit: second, credit: 0 },
  ];
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function buildPartidasCsv(state: FinanceState, assigned: Record<string, string>): string {
  const header = ['Cuenta', 'Fecha', 'Referencia', 'Descripción', 'Valor', 'Antigüedad', 'Estado', 'Responsable'];
  const rows = pendingStatementLines(state).map(line => {
    const statement = statementOf(state, line.statementId);
    const account = statement ? accountOf(state, statement.accountId) : undefined;
    return [
      account ? `${account.bank} ${maskNumber(account.number)}` : '—',
      line.date,
      line.reference,
      line.description,
      lineValue(line),
      daysBetween(line.date, HOY),
      line.status,
      assigned[line.id] ?? 'Sin asignar',
    ].map(csvCell).join(';');
  });
  return `\uFEFF${[header.map(csvCell).join(';'), ...rows].join('\r\n')}`;
}

function SummaryTile({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{value}</div>
      {detail && <div className="mt-0.5 text-[10px] text-gray-500">{detail}</div>}
    </div>
  );
}

export default function Tesoreria({ page, onNavigate }: Props) {
  const { state, update } = useFinance();
  const slug = page.split('/')[1] ?? 'panel';
  const activeSlug = SLUGS.includes(slug) ? slug : 'panel';

  const [toast, setToast] = useState('');
  const [accountOpen, setAccountOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [checkOpen, setCheckOpen] = useState(false);
  const [cashMoveOpen, setCashMoveOpen] = useState(false);
  const [cashCloseOpen, setCashCloseOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [reconcileLineId, setReconcileLineId] = useState<string | null>(null);
  const [adjustLineId, setAdjustLineId] = useState<string | null>(null);
  const [assignLineId, setAssignLineId] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<Record<string, string>>({});

  const [selectedStatementId, setSelectedStatementId] = useState(state.statements[0]?.id ?? '');
  const [reconcileStatementId, setReconcileStatementId] = useState(state.statements[0]?.id ?? '');
  const [selectedCashId, setSelectedCashId] = useState(state.pettyCashes[0]?.id ?? '');

  const selectedStatement = state.statements.find(item => item.id === selectedStatementId) ?? state.statements[0] ?? null;
  const reconciliationStatement = state.statements.find(item => item.id === reconcileStatementId) ?? state.statements[0] ?? null;
  const selectedCash = state.pettyCashes.find(item => item.id === selectedCashId) ?? state.pettyCashes[0] ?? null;

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(''), 3500);
  }

  function createAccount(payload: AccountDraft) {
    const duplicate = state.accounts.some(
      account =>
        account.bank.trim().toLowerCase() === payload.bank.trim().toLowerCase()
        && account.number.replace(/\s+/g, '').toLowerCase() === payload.number.replace(/\s+/g, '').toLowerCase(),
    );
    if (duplicate) {
      showToast('Ya existe una cuenta con el mismo banco y número.');
      return;
    }
    const account: BankAccount = {
      id: newId('acc'),
      kind: payload.kind,
      bank: payload.bank.trim(),
      number: payload.number.trim(),
      currency: payload.currency,
      ledgerAccount: payload.ledgerAccount.trim(),
      initial: payload.initial,
      balance: payload.initial,
      status: 'Activa',
      responsible: payload.responsible.trim(),
    };
    update(draft => {
      draft.accounts.push(account);
    }, `Creación de la cuenta ${account.bank} ${maskNumber(account.number)}`, 'tesoreria');
    setAccountOpen(false);
    showToast(`Cuenta ${account.bank} creada con saldo inicial ${money(account.initial)}.`);
  }

  function toggleAccount(id: string) {
    const account = state.accounts.find(item => item.id === id);
    if (!account) return;
    const next = account.status === 'Activa' ? 'Inactiva' : 'Activa';
    update(draft => {
      const target = draft.accounts.find(item => item.id === id);
      if (target) target.status = next;
    }, `${next === 'Activa' ? 'Activación' : 'Inactivación'} de la cuenta ${account.bank} ${maskNumber(account.number)}`, 'tesoreria');
    showToast(
      next === 'Activa'
        ? `Cuenta ${account.bank} activada.`
        : `Cuenta ${account.bank} inactivada. Conserva su saldo y movimientos.`,
    );
  }

  function importStatement(payload: StatementDraft) {
    const account = accountOf(state, payload.accountId);
    if (!account || account.status !== 'Activa') {
      showToast('Seleccione una cuenta activa para importar el extracto.');
      return;
    }
    const movements = buildImportMovements(payload.opening, payload.closing);
    const statementId = newId('ext');
    const dates = [
      addDays(payload.from, Math.max(0, Math.round(daysBetween(payload.from, payload.to) / 3))),
      addDays(payload.from, Math.max(0, Math.round((daysBetween(payload.from, payload.to) * 2) / 3))),
      payload.to,
    ];
    let running = payload.opening;
    const lines: StatementLine[] = movements.map((movement, index) => {
      running += movement.credit - movement.debit;
      return {
        id: newId('sl'),
        statementId,
        date: dates[index] ?? payload.to,
        reference: movement.reference,
        description: movement.description,
        debit: movement.debit,
        credit: movement.credit,
        balance: running,
        matched: 0,
        suggestion: '',
        status: 'Pendiente',
      };
    });
    if (Math.abs(running - payload.closing) > 0.5) {
      showToast('El extracto no cuadra con el saldo final ingresado.');
      return;
    }
    const statement: BankStatement = {
      id: statementId,
      accountId: payload.accountId,
      from: payload.from,
      to: payload.to,
      opening: payload.opening,
      closing: payload.closing,
      status: 'Abierto',
      fileName: payload.fileName.trim(),
    };
    update(draft => {
      draft.statements.unshift(statement);
      draft.statementLines.push(...lines);
    }, `Importación del extracto ${statement.fileName}`, 'tesoreria');
    setSelectedStatementId(statementId);
    setStatementOpen(false);
    showToast(`Extracto importado con ${lines.length} líneas y cuadre validado.`);
  }

  function validateStatement(id: string) {
    const statement = statementOf(state, id);
    if (!statement) return;
    update(draft => {
      const target = draft.statements.find(item => item.id === id);
      if (target && target.status === 'Abierto') target.status = 'Validado';
    }, `Validación del extracto ${statement.fileName}`, 'tesoreria');
    showToast(`Extracto ${statement.fileName} validado.`);
  }

  function autoReconcile(statementId: string) {
    const statement = statementOf(state, statementId);
    if (!statement) {
      showToast('Seleccione un extracto para conciliar.');
      return;
    }
    const targets = state.statementLines.filter(
      line => line.statementId === statementId && line.suggestion.trim() !== '' && line.status !== 'Conciliado',
    );
    const entries = bookEntries(state);
    update(draft => {
      for (const line of draft.statementLines.filter(item => item.statementId === statementId)) {
        if (line.suggestion.trim() === '' || line.status === 'Conciliado') continue;
        const total = lineValue(line);
        const already = reconciledFor(draft, line.id);
        const remaining = total - already;
        if (remaining <= 0) {
          line.matched = total;
          line.status = 'Conciliado';
          continue;
        }
        const suggestion = suggestFor(line, entries);
        draft.reconciliations.push({
          id: newId('con'),
          statementLineId: line.id,
          bookType: suggestion.entry?.type ?? 'Ajuste',
          bookRef: suggestion.entry?.ref ?? `AJU-${line.reference || line.id}`,
          amount: remaining,
          difference: 0,
          note: `Conciliación automática · ${line.suggestion}`,
          date: HOY,
          user: USUARIO.nombre,
        });
        line.matched = total;
        line.status = 'Conciliado';
      }
      syncStatementStatus(draft, statementId);
    }, `Conciliación automática de ${targets.length} líneas del extracto ${statement.fileName}`, 'tesoreria');
    if (targets.length === 0) {
      showToast('No hay líneas con sugerencia pendientes de conciliar.');
    } else {
      showToast(`${targets.length} líneas conciliadas automáticamente.`);
    }
  }

  function manualReconcile(payload: ManualLinkDraft) {
    const line = state.statementLines.find(item => item.id === payload.statementLineId);
    if (!line) return;
    const remaining = lineValue(line) - reconciledFor(state, line.id);
    if (payload.amount <= 0) {
      showToast('El valor a conciliar debe ser mayor que cero.');
      return;
    }
    if (payload.amount > remaining + 0.5) {
      showToast('El valor excede el saldo pendiente de la línea.');
      return;
    }
    update(draft => {
      const target = draft.statementLines.find(item => item.id === payload.statementLineId);
      if (!target) return;
      const total = lineValue(target);
      const already = reconciledFor(draft, target.id);
      const room = total - already;
      if (room <= 0) return;
      const applied = Math.min(payload.amount, room);
      const pending = Math.max(0, room - applied);
      draft.reconciliations.push({
        id: newId('con'),
        statementLineId: target.id,
        bookType: payload.bookType,
        bookRef: payload.bookRef,
        amount: applied,
        difference: pending,
        note: payload.note.trim(),
        date: HOY,
        user: USUARIO.nombre,
      });
      target.matched = Math.min(total, already + applied);
      target.status = target.matched >= total ? 'Conciliado' : 'Diferencia';
      syncStatementStatus(draft, target.statementId);
    }, `Conciliación manual de la línea ${line.reference || line.id}`, 'tesoreria');
    setReconcileOpen(false);
    setReconcileLineId(null);
    showToast(`Línea ${line.reference || line.id} conciliada por ${money(payload.amount)}.`);
  }

  function unreconcile(lineId: string) {
    const line = state.statementLines.find(item => item.id === lineId);
    if (!line) return;
    const count = state.reconciliations.filter(item => item.statementLineId === lineId).length;
    if (count === 0) {
      showToast('La línea no tiene conciliaciones registradas.');
      return;
    }
    update(draft => {
      draft.reconciliations = draft.reconciliations.filter(item => item.statementLineId !== lineId);
      const target = draft.statementLines.find(item => item.id === lineId);
      if (!target) return;
      target.matched = 0;
      target.status = target.suggestion.trim() ? 'Sugerido' : 'Pendiente';
      syncStatementStatus(draft, target.statementId);
    }, `Desconciliación de la línea ${line.reference || line.id}`, 'tesoreria');
    showToast(`Línea ${line.reference || line.id} desconciliada.`);
  }

  function createRule(payload: RuleDraft) {
    const rule: ReconciliationRule = {
      id: newId('rule'),
      name: payload.name.trim(),
      field: payload.field,
      operator: payload.operator,
      value: payload.value.trim(),
      action: payload.action.trim(),
      priority: payload.priority,
      active: payload.active,
      matches: 0,
    };
    update(draft => {
      draft.rules.push(rule);
    }, `Creación de la regla ${rule.name}`, 'tesoreria');
    setRuleOpen(false);
    showToast(`Regla ${rule.name} creada.`);
  }

  function toggleRule(id: string) {
    const rule = state.rules.find(item => item.id === id);
    if (!rule) return;
    update(draft => {
      const target = draft.rules.find(item => item.id === id);
      if (target) target.active = !target.active;
    }, `${rule.active ? 'Desactivación' : 'Activación'} de la regla ${rule.name}`, 'tesoreria');
    showToast(`Regla ${rule.name} ${rule.active ? 'desactivada' : 'activada'}.`);
  }

  function simulateRule(id: string) {
    const rule = state.rules.find(item => item.id === id);
    if (!rule) return;
    const matches = ruleMatchCount(state.statementLines, rule);
    update(draft => {
      const target = draft.rules.find(item => item.id === id);
      if (target) target.matches = matches;
    }, `Simulación de la regla ${rule.name}`, 'tesoreria');
    showToast(`Regla ${rule.name}: ${matches} coincidencias sobre ${state.statementLines.length} líneas.`);
  }

  function createTransfer(payload: TransferDraft) {
    const origin = accountOf(state, payload.fromId);
    const destination = accountOf(state, payload.toId);
    if (!origin || !destination) {
      showToast('Seleccione una cuenta de origen y una de destino.');
      return;
    }
    if (origin.id === destination.id) {
      showToast('La cuenta de origen y destino deben ser diferentes.');
      return;
    }
    if (origin.status !== 'Activa' || destination.status !== 'Activa') {
      showToast('Las cuentas de la transferencia deben estar activas.');
      return;
    }
    if (payload.amount <= 0) {
      showToast('El valor de la transferencia debe ser mayor que cero.');
      return;
    }
    if (payload.fee < 0) {
      showToast('La comisión no puede ser negativa.');
      return;
    }
    if (origin.balance < payload.amount + payload.fee) {
      showToast(`Saldo insuficiente en ${origin.bank} para cubrir el valor y la comisión.`);
      return;
    }
    const transfer: Transfer = {
      id: newId('trf'),
      number: nextSequence(state.transfers, 'TRF'),
      date: payload.date,
      fromId: payload.fromId,
      toId: payload.toId,
      amount: payload.amount,
      fee: payload.fee,
      reference: payload.reference.trim(),
      status: 'Registrada',
    };
    update(draft => {
      const from = draft.accounts.find(item => item.id === payload.fromId);
      const to = draft.accounts.find(item => item.id === payload.toId);
      if (!from || !to || from.id === to.id) return;
      if (from.balance < payload.amount + payload.fee) return;
      from.balance -= payload.amount + payload.fee;
      to.balance += payload.amount;
      draft.transfers.unshift(transfer);
    }, `Registro de la transferencia ${transfer.number} por ${money(transfer.amount)}`, 'tesoreria');
    setTransferOpen(false);
    showToast(`Transferencia ${transfer.number} registrada. Comisión ${money(transfer.fee)}.`);
  }

  function createCheck(payload: CheckDraft) {
    if (state.checks.some(item => item.number.toLowerCase() === payload.number.trim().toLowerCase())) {
      showToast('El número de cheque ya existe.');
      return;
    }
    const account = accountOf(state, payload.accountId);
    if (!account || account.status !== 'Activa') {
      showToast('Seleccione una cuenta activa para el cheque.');
      return;
    }
    if (payload.amount <= 0) {
      showToast('El valor del cheque debe ser mayor que cero.');
      return;
    }
    if (payload.dueDate < payload.issueDate) {
      showToast('El vencimiento no puede ser anterior a la emisión.');
      return;
    }
    const check: Check = {
      id: newId('chk'),
      number: payload.number.trim(),
      accountId: payload.accountId,
      beneficiary: payload.beneficiary.trim(),
      amount: payload.amount,
      issueDate: payload.issueDate,
      dueDate: payload.dueDate,
      status: 'Emitido',
    };
    update(draft => {
      draft.checks.unshift(check);
    }, `Emisión del cheque ${check.number} a favor de ${check.beneficiary}`, 'tesoreria');
    setCheckOpen(false);
    showToast(`Cheque ${check.number} emitido por ${money(check.amount)}.`);
  }

  function markCheck(id: string) {
    const check = state.checks.find(item => item.id === id);
    if (!check || check.status !== 'Emitido') return;
    update(draft => {
      const target = draft.checks.find(item => item.id === id);
      if (target && target.status === 'Emitido') target.status = 'Cobrado';
    }, `Cobro del cheque ${check.number}`, 'tesoreria');
    showToast(`Cheque ${check.number} marcado como cobrado.`);
  }

  function voidCheck(id: string) {
    const check = state.checks.find(item => item.id === id);
    if (!check || check.status !== 'Emitido') return;
    update(draft => {
      const target = draft.checks.find(item => item.id === id);
      if (target && target.status === 'Emitido') target.status = 'Anulado';
    }, `Anulación del cheque ${check.number}`, 'tesoreria');
    showToast(`Cheque ${check.number} anulado. El histórico se conserva.`);
  }

  function registerCashMovement(payload: CashMoveDraft) {
    if (!selectedCash) return;
    if (selectedCash.status === 'Cerrada') {
      showToast('La caja está cerrada y no admite movimientos.');
      return;
    }
    if (payload.amount <= 0) {
      showToast('El valor del movimiento debe ser mayor que cero.');
      return;
    }
    if (payload.type === 'Egreso' && payload.amount > selectedCash.balance) {
      showToast('El egreso supera el saldo disponible de la caja.');
      return;
    }
    const movement: CashMovement = {
      id: newId('cm'),
      date: payload.date,
      type: payload.type,
      concept: payload.concept.trim(),
      amount: payload.amount,
      support: payload.support.trim(),
      responsible: payload.responsible.trim(),
    };
    update(draft => {
      const target = draft.pettyCashes.find(item => item.id === selectedCash.id);
      if (!target || target.status === 'Cerrada') return;
      if (payload.type === 'Egreso' && payload.amount > target.balance) return;
      target.balance += payload.type === 'Ingreso' ? payload.amount : -payload.amount;
      target.movements.unshift(movement);
    }, `${payload.type} de caja menor ${selectedCash.name} por ${money(payload.amount)}`, 'tesoreria');
    setCashMoveOpen(false);
    showToast(`Movimiento de ${payload.type.toLowerCase()} registrado en ${selectedCash.name}.`);
  }

  function closeCash(counted: number) {
    if (!selectedCash) return;
    if (selectedCash.status === 'Cerrada') {
      showToast('La caja ya está cerrada.');
      return;
    }
    if (counted < 0) {
      showToast('El valor contado no puede ser negativo.');
      return;
    }
    const difference = counted - selectedCash.balance;
    update(draft => {
      const target = draft.pettyCashes.find(item => item.id === selectedCash.id);
      if (!target || target.status === 'Cerrada') return;
      target.balance = counted;
      target.status = 'Cerrada';
    }, `Cierre de la caja ${selectedCash.name} con diferencia de arqueo ${money(difference)}`, 'tesoreria');
    setCashCloseOpen(false);
    showToast(`Caja cerrada. Diferencia de arqueo: ${money(difference)}.`);
  }

  function createAdjustment(lineId: string, payload: AdjustmentDraft) {
    const line = state.statementLines.find(item => item.id === lineId);
    if (!line) return;
    const pending = lineValue(line) - reconciledFor(state, line.id);
    if (payload.amount <= 0 || payload.amount > pending + 0.5) {
      showToast('El valor del ajuste excede la partida pendiente.');
      return;
    }
    if (payload.difference < 0 || payload.difference > payload.amount) {
      showToast('La diferencia debe estar entre cero y el valor del ajuste.');
      return;
    }
    update(draft => {
      const target = draft.statementLines.find(item => item.id === lineId);
      if (!target) return;
      const total = lineValue(target);
      const already = reconciledFor(draft, target.id);
      const room = total - already;
      if (room <= 0) return;
      const applied = Math.min(payload.amount, room);
      draft.reconciliations.push({
        id: newId('con'),
        statementLineId: target.id,
        bookType: 'Ajuste',
        bookRef: `AJU-${String(draft.reconciliations.filter(item => item.bookType === 'Ajuste').length + 1).padStart(4, '0')}`,
        amount: applied,
        difference: payload.difference,
        note: payload.note.trim(),
        date: HOY,
        user: USUARIO.nombre,
      });
      target.matched = Math.min(total, already + applied);
      target.status = target.matched >= total && payload.difference === 0 ? 'Conciliado' : 'Diferencia';
      syncStatementStatus(draft, target.statementId);
    }, `Ajuste conciliatorio de la línea ${line.reference || line.id} por ${money(payload.amount)}`, 'tesoreria');
    setAdjustLineId(null);
    showToast('Ajuste conciliatorio registrado.');
  }

  function assignResponsible(lineId: string, responsible: string) {
    const line = state.statementLines.find(item => item.id === lineId);
    setAssigned(current => ({ ...current, [lineId]: responsible }));
    update(() => {}, `Asignación de la partida ${line?.reference ?? lineId} a ${responsible}`, 'tesoreria');
    setAssignLineId(null);
    showToast(`Responsable asignado: ${responsible}.`);
  }

  function exportItems() {
    const rows = pendingStatementLines(state);
    const blob = new Blob([buildPartidasCsv(state, assigned)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `partidas-conciliatorias-${HOY}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`${rows.length} partidas exportadas a CSV.`);
  }

  const header = NAV_TITLE[activeSlug] ?? NAV_TITLE.panel;
  const action = (() => {
    if (activeSlug === 'panel') {
      return (
        <>
          <Button onClick={() => onNavigate('tesoreria/conciliacion')}>Abrir conciliación</Button>
          <Button variant="primary" onClick={() => setTransferOpen(true)}>
            <Icon name="plus" className="h-3.5 w-3.5" /> Nueva transferencia
          </Button>
        </>
      );
    }
    if (activeSlug === 'cuentas') {
      return <Button variant="primary" onClick={() => setAccountOpen(true)}><Icon name="plus" className="h-3.5 w-3.5" /> Nueva cuenta</Button>;
    }
    if (activeSlug === 'extractos') {
      return <Button variant="primary" onClick={() => setStatementOpen(true)}><Icon name="plus" className="h-3.5 w-3.5" /> Importar extracto</Button>;
    }
    if (activeSlug === 'conciliacion') {
      return (
        <Button
          variant="primary"
          disabled={!reconciliationStatement}
          onClick={() => reconciliationStatement && autoReconcile(reconciliationStatement.id)}
        >
          Conciliar automáticamente
        </Button>
      );
    }
    if (activeSlug === 'reglas') {
      return <Button variant="primary" onClick={() => setRuleOpen(true)}><Icon name="plus" className="h-3.5 w-3.5" /> Nueva regla</Button>;
    }
    if (activeSlug === 'transferencias') {
      return <Button variant="primary" onClick={() => setTransferOpen(true)}><Icon name="plus" className="h-3.5 w-3.5" /> Nueva transferencia</Button>;
    }
    if (activeSlug === 'cheques') {
      return <Button variant="primary" onClick={() => setCheckOpen(true)}><Icon name="plus" className="h-3.5 w-3.5" /> Nuevo cheque</Button>;
    }
    if (activeSlug === 'caja') {
      return (
        <Button
          variant="primary"
          disabled={!selectedCash || selectedCash.status === 'Cerrada'}
          onClick={() => setCashMoveOpen(true)}
        >
          <Icon name="plus" className="h-3.5 w-3.5" /> Registrar movimiento
        </Button>
      );
    }
    if (activeSlug === 'partidas') {
      return <Button onClick={exportItems}><Icon name="download" className="h-3.5 w-3.5" /> Exportar CSV</Button>;
    }
    if (activeSlug === 'flujo') {
      return <Button onClick={() => showToast('Flujo de caja real exportado (simulación).')}><Icon name="download" className="h-3.5 w-3.5" /> Exportar</Button>;
    }
    if (activeSlug === 'proyectado') {
      return <Button onClick={() => onNavigate('tesoreria/liquidez')}>Ver liquidez</Button>;
    }
    if (activeSlug === 'liquidez') {
      return <Button onClick={() => onNavigate('tesoreria/proyectado')}>Ver proyección</Button>;
    }
    return null;
  })();

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4 lg:p-5">
      <PageHeader eyebrow={MODULE.name} title={header.title} subtitle={header.subtitle} actions={action} />

      {activeSlug === 'panel' && <PanelView state={state} onNavigate={onNavigate} />}
      {activeSlug === 'flujo' && <FlujoReal state={state} />}
      {activeSlug === 'proyectado' && <FlujoProyectado state={state} />}
      {activeSlug === 'liquidez' && <Liquidez state={state} onNavigate={onNavigate} />}
      {activeSlug === 'cuentas' && (
        <AccountsView state={state} onToggle={toggleAccount} onCreate={() => setAccountOpen(true)} />
      )}
      {activeSlug === 'extractos' && (
        <StatementsView
          state={state}
          selectedId={selectedStatement?.id ?? ''}
          onSelect={setSelectedStatementId}
          onValidate={validateStatement}
          onImport={() => setStatementOpen(true)}
          onReconcile={id => { setReconcileStatementId(id); onNavigate('tesoreria/conciliacion'); }}
        />
      )}
      {activeSlug === 'conciliacion' && (
        <ReconciliationView
          state={state}
          statementId={reconciliationStatement?.id ?? ''}
          onStatement={setReconcileStatementId}
          onAuto={autoReconcile}
          onManual={lineId => { setReconcileLineId(lineId); setReconcileOpen(true); }}
          onUnreconcile={unreconcile}
        />
      )}
      {activeSlug === 'reglas' && (
        <RulesView state={state} onCreate={() => setRuleOpen(true)} onToggle={toggleRule} onSimulate={simulateRule} />
      )}
      {activeSlug === 'transferencias' && <TransfersView state={state} onCreate={() => setTransferOpen(true)} />}
      {activeSlug === 'cheques' && (
        <ChecksView state={state} onCreate={() => setCheckOpen(true)} onCollect={markCheck} onVoid={voidCheck} />
      )}
      {activeSlug === 'caja' && (
        <CashView
          state={state}
          selectedId={selectedCash?.id ?? ''}
          onSelect={setSelectedCashId}
          onMove={() => setCashMoveOpen(true)}
          onCloseCash={() => setCashCloseOpen(true)}
        />
      )}
      {activeSlug === 'partidas' && (
        <ItemsView
          state={state}
          assigned={assigned}
          onAssign={lineId => setAssignLineId(lineId)}
          onAdjust={lineId => setAdjustLineId(lineId)}
          onExport={exportItems}
        />
      )}

      {accountOpen && <AccountEditor onClose={() => setAccountOpen(false)} onSave={createAccount} />}
      {statementOpen && (
        <StatementImporter state={state} onClose={() => setStatementOpen(false)} onSave={importStatement} />
      )}
      {reconcileOpen && reconciliationStatement && (
        <ReconcileEditor
          state={state}
          statement={reconciliationStatement}
          initialLineId={reconcileLineId}
          onClose={() => { setReconcileOpen(false); setReconcileLineId(null); }}
          onSave={manualReconcile}
        />
      )}
      {ruleOpen && <RuleEditor state={state} onClose={() => setRuleOpen(false)} onSave={createRule} />}
      {transferOpen && <TransferEditor state={state} onClose={() => setTransferOpen(false)} onSave={createTransfer} />}
      {checkOpen && <CheckEditor state={state} onClose={() => setCheckOpen(false)} onSave={createCheck} />}
      {cashMoveOpen && selectedCash && (
        <CashMovementEditor cash={selectedCash} onClose={() => setCashMoveOpen(false)} onSave={registerCashMovement} />
      )}
      {cashCloseOpen && selectedCash && (
        <CashCloseEditor cash={selectedCash} onClose={() => setCashCloseOpen(false)} onSave={closeCash} />
      )}
      {adjustLineId && (
        <AdjustmentEditor
          state={state}
          lineId={adjustLineId}
          onClose={() => setAdjustLineId(null)}
          onSave={payload => createAdjustment(adjustLineId, payload)}
        />
      )}
      {assignLineId && (
        <AssignEditor
          state={state}
          lineId={assignLineId}
          onClose={() => setAssignLineId(null)}
          onSave={responsible => assignResponsible(assignLineId, responsible)}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-xl bg-[#001F4C] px-4 py-3 text-xs text-white shadow-2xl">
          <Icon name="check" className="h-4 w-4 text-emerald-300" />
          {toast}
        </div>
      )}
    </div>
  );
}

function PanelView({ state, onNavigate }: { state: FinanceState; onNavigate: (page: NavPage) => void }) {
  const activeAccounts = state.accounts.filter(account => account.status === 'Activa');
  const totalPosition = sum(activeAccounts.map(account => account.balance));
  const todayLines = state.statementLines.filter(line => line.date === HOY);
  const todayTransfers = state.transfers.filter(transfer => transfer.date === HOY);
  const usesLines = todayLines.length > 0;
  const entries = usesLines
    ? sum(todayLines.map(line => line.credit))
    : sum(todayTransfers.map(transfer => transfer.amount));
  const exits = usesLines
    ? sum(todayLines.map(line => line.debit))
    : sum(todayTransfers.map(transfer => transfer.amount + transfer.fee));
  const movementDates = [...state.statementLines.map(line => line.date), ...state.transfers.map(transfer => transfer.date)].sort();
  const lastMovementDate = movementDates[movementDates.length - 1] ?? '';
  const movementDetail = usesLines
    ? `${todayLines.length} líneas de extracto del ${fmtDate(HOY)}`
    : todayTransfers.length > 0
      ? `${todayTransfers.length} transferencias del ${fmtDate(HOY)}`
      : `Sin movimientos hoy${lastMovementDate ? ` · último ${fmtDate(lastMovementDate)}` : ''}`;

  const pending = pendingStatementLines(state);
  const pendingAmount = sum(
    pending.map(line => Math.max(0, lineValue(line) - Math.min(line.matched, lineValue(line)))),
  );
  const unreconciledStatements = state.statements.filter(statement =>
    state.statementLines.some(
      line => line.statementId === statement.id && (line.status !== 'Conciliado' || line.matched < lineValue(line)),
    ),
  );
  const pendingChecks = state.checks.filter(check => check.status === 'Emitido');
  const pendingChecksAmount = sum(pendingChecks.map(check => check.amount));
  const overdueChecks = pendingChecks.filter(check => check.dueDate < HOY);
  const openCashes = state.pettyCashes.filter(cash => cash.status === 'Abierta');
  const cashBalance = sum(openCashes.map(cash => cash.balance));
  const differenceLines = state.statementLines.filter(line => line.status === 'Diferencia');
  const differenceAmount = sum(
    differenceLines.map(line => Math.max(0, lineValue(line) - Math.min(line.matched, lineValue(line)))),
  );

  const upcoming = state.payables
    .filter(payable => payable.balance > 0 && payable.status !== 'Pagada' && payable.status !== 'En disputa')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);
  const upcomingTotal = sum(upcoming.map(payable => payable.balance));

  const totalLineAmount = sum(state.statementLines.map(line => lineValue(line)));
  const matchedAmount = sum(state.statementLines.map(line => Math.min(line.matched, lineValue(line))));
  const reconciledPct = totalLineAmount > 0 ? (matchedAmount / totalLineAmount) * 100 : 0;
  const reconciledLines = state.statementLines.filter(line => line.status === 'Conciliado').length;

  const alerts: { tone: Tone; title: string; detail: string; page: NavPage }[] = [];
  if (differenceLines.length > 0) {
    alerts.push({
      tone: 'red',
      title: `${differenceLines.length} partidas con diferencia`,
      detail: `${money(differenceAmount)} pendientes de revisión`,
      page: 'tesoreria/partidas',
    });
  }
  if (overdueChecks.length > 0) {
    alerts.push({
      tone: 'amber',
      title: `${overdueChecks.length} cheques vencidos sin cobrar`,
      detail: money(sum(overdueChecks.map(check => check.amount))),
      page: 'tesoreria/cheques',
    });
  }
  if (unreconciledStatements.length > 0) {
    alerts.push({
      tone: 'cyan',
      title: `${unreconciledStatements.length} extractos sin conciliar`,
      detail: `${pending.length} líneas abiertas por ${money(pendingAmount)}`,
      page: 'tesoreria/conciliacion',
    });
  }
  if (openCashes.some(cash => cash.opening > 0 && cash.balance < cash.opening * 0.2)) {
    alerts.push({
      tone: 'amber',
      title: 'Caja menor con saldo bajo',
      detail: `Disponible ${money(cashBalance)} en ${openCashes.length} cajas abiertas`,
      page: 'tesoreria/caja',
    });
  }
  if (upcomingTotal > totalPosition) {
    alerts.push({
      tone: 'red',
      title: 'Cobertura insuficiente para próximos pagos',
      detail: `Comprometido ${money(upcomingTotal)} frente a ${money(totalPosition)} disponibles`,
      page: 'cuentas-pagar/obligaciones',
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      tone: 'green',
      title: 'Sin alertas operativas',
      detail: 'La posición y la conciliación están al día.',
      page: 'tesoreria/panel',
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Posición consolidada" value={money(totalPosition)} detail={`${activeAccounts.length} cuentas activas`} tone="green" />
        <KpiCard label="Entradas del día" value={money(entries)} detail={movementDetail} tone="blue" />
        <KpiCard label="Salidas del día" value={money(exits)} detail={movementDetail} tone="amber" />
        <KpiCard label="Pendiente por conciliar" value={money(pendingAmount)} detail={`${pending.length} partidas abiertas`} tone="red" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Card>
            <SectionTitle
              title="Cuentas y disponibilidad"
              detail="Saldo actual por banco y caja, con su responsable."
              action={<Button size="sm" variant="secondary" onClick={() => onNavigate('tesoreria/cuentas')}>Ver cuentas</Button>}
            />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {activeAccounts.map(account => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => onNavigate('tesoreria/cuentas')}
                  className="rounded-xl border border-gray-200 p-3 text-left transition hover:border-petroleum-300 hover:bg-petroleum-50/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-gray-800">{account.bank}</div>
                      <div className="font-mono text-[10px] text-gray-400">
                        {maskNumber(account.number)} · {account.kind} · {account.currency}
                      </div>
                    </div>
                    <Badge tone={statusTone(account.status)}>{account.status}</Badge>
                  </div>
                  <div className="mt-3 text-lg font-semibold text-gray-900"><Money value={account.balance} /></div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-gray-500">
                    <span className="truncate">{account.responsible}</span>
                    <span className="font-mono">{account.ledgerAccount}</span>
                  </div>
                </button>
              ))}
              {activeAccounts.length === 0 && (
                <p className="text-xs text-gray-500">No hay cuentas activas registradas.</p>
              )}
            </div>
          </Card>

          <Card>
            <SectionTitle
              title="Próximos pagos"
              detail={`${upcoming.length} obligaciones abiertas · ${money(upcomingTotal)}`}
              action={<Button size="sm" variant="ghost" onClick={() => onNavigate('cuentas-pagar/obligaciones')}>Ver CxP</Button>}
            />
            <div className="divide-y divide-gray-50">
              {upcoming.map(payable => {
                const party = partyOf(state, payable.partyId);
                const overdue = payable.dueDate < HOY;
                return (
                  <button
                    key={payable.id}
                    type="button"
                    onClick={() => onNavigate('cuentas-pagar/obligaciones')}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-gray-800">{party?.name ?? 'Proveedor'}</div>
                      <div className="text-[10px] text-gray-400">
                        {payable.invoiceNumber} · vence {fmtDate(payable.dueDate)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-gray-900"><Money value={payable.balance} /></div>
                      <div className={`text-[10px] ${overdue ? 'text-red-600' : 'text-gray-400'}`}>
                        {overdue ? `Vencida ${daysBetween(payable.dueDate, HOY)} días` : payable.status}
                      </div>
                    </div>
                  </button>
                );
              })}
              {upcoming.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-gray-500">No hay pagos abiertos programados.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionTitle title="Conciliación bancaria" detail="Avance sobre el valor de las líneas de extracto." />
            <div className="space-y-3 p-4">
              <Progress value={reconciledPct} tone="cyan" label="Valor conciliado" />
              <div className="grid grid-cols-2 gap-2">
                <SummaryTile label="Líneas" value={`${reconciledLines} / ${state.statementLines.length}`} detail="conciliadas" />
                <SummaryTile label="Extractos" value={String(unreconciledStatements.length)} detail="sin conciliar" />
                <SummaryTile label="Sugerencias" value={String(state.statementLines.filter(line => line.suggestion.trim() !== '').length)} detail="listas para cruce" />
                <SummaryTile label="Diferencia" value={money(differenceAmount)} detail={`${differenceLines.length} partidas`} />
              </div>
              <Button variant="secondary" className="w-full" onClick={() => onNavigate('tesoreria/conciliacion')}>
                Abrir conciliación
              </Button>
            </div>
          </Card>

          <Card>
            <SectionTitle title="Pendientes operativos" detail="Cheques, extractos y caja menor." />
            <div className="divide-y divide-gray-50">
              <button type="button" onClick={() => onNavigate('tesoreria/extractos')} className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50">
                <span className="text-xs text-gray-600">Extractos sin conciliar</span>
                <span className="text-xs font-semibold text-gray-900">{unreconciledStatements.length}</span>
              </button>
              <button type="button" onClick={() => onNavigate('tesoreria/cheques')} className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50">
                <span className="text-xs text-gray-600">Cheques pendientes</span>
                <span className="text-right">
                  <span className="block text-xs font-semibold text-gray-900">{pendingChecks.length}</span>
                  <span className="block text-[10px] text-gray-400">{money(pendingChecksAmount)}</span>
                </span>
              </button>
              <button type="button" onClick={() => onNavigate('tesoreria/caja')} className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50">
                <span className="text-xs text-gray-600">Caja menor disponible</span>
                <span className="text-right">
                  <span className="block text-xs font-semibold text-gray-900">{money(cashBalance)}</span>
                  <span className="block text-[10px] text-gray-400">{openCashes.length} cajas abiertas</span>
                </span>
              </button>
            </div>
          </Card>

          <Card>
            <SectionTitle title="Alertas de tesorería" detail="Puntos que requieren atención." />
            <div className="divide-y divide-gray-50">
              {alerts.map(alert => (
                <button
                  key={`${alert.tone}-${alert.title}`}
                  type="button"
                  onClick={() => onNavigate(alert.page)}
                  className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-gray-50"
                >
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    alert.tone === 'red' ? 'bg-red-500'
                      : alert.tone === 'amber' ? 'bg-amber-500'
                        : alert.tone === 'cyan' ? 'bg-cyan-500'
                          : alert.tone === 'green' ? 'bg-emerald-500' : 'bg-blue-500'
                  }`} />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-gray-800">{alert.title}</span>
                    <span className="block text-[10px] text-gray-500">{alert.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function AccountsView({ state, onToggle, onCreate }: {
  state: FinanceState;
  onToggle: (id: string) => void;
  onCreate: () => void;
}) {
  const columns: Column<BankAccount>[] = [
    {
      header: 'Banco',
      cell: account => (
        <div>
          <div className="font-medium text-gray-800">{account.bank}</div>
          <div className="text-[10px] text-gray-400">{account.responsible}</div>
        </div>
      ),
    },
    { header: 'Tipo', cell: account => <Badge tone={account.kind === 'Banco' ? 'blue' : 'violet'}>{account.kind}</Badge> },
    { header: 'Número', cell: account => <span className="font-mono text-gray-700">{maskNumber(account.number)}</span> },
    { header: 'Moneda', cell: account => account.currency },
    { header: 'Cuenta contable', cell: account => <span className="font-mono">{account.ledgerAccount}</span> },
    { header: 'Saldo', align: 'right', cell: account => <Money value={account.balance} className="font-semibold" /> },
    { header: 'Estado', cell: account => <Badge tone={statusTone(account.status)}>{account.status}</Badge> },
    {
      header: 'Acción',
      align: 'right',
      cell: account => (
        <button
          type="button"
          onClick={() => onToggle(account.id)}
          className={`text-[10px] font-semibold hover:underline ${account.status === 'Activa' ? 'text-red-600' : 'text-emerald-700'}`}
        >
          {account.status === 'Activa' ? 'Inactivar' : 'Activar'}
        </button>
      ),
    },
  ];

  const total = sum(state.accounts.map(account => account.balance));
  const active = state.accounts.filter(account => account.status === 'Activa').length;

  return (
    <div className="space-y-3">
      <Card>
        <SectionTitle
          title="Maestro de cuentas"
          detail={`${active} cuentas activas de ${state.accounts.length} registradas.`}
          action={<Button size="sm" variant="primary" onClick={onCreate}><Icon name="plus" className="h-3.5 w-3.5" /> Nueva cuenta</Button>}
        />
        <DataTable
          columns={columns}
          rows={state.accounts}
          rowKey={account => account.id}
          footer={(
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
              <span>Las cuentas no se eliminan: se inactivan para conservar la trazabilidad de movimientos y conciliaciones.</span>
              <span className="font-semibold text-gray-800">Saldo total: <Money value={total} /></span>
            </div>
          )}
        />
      </Card>
    </div>
  );
}

function StatementsView({ state, selectedId, onSelect, onValidate, onImport, onReconcile }: {
  state: FinanceState;
  selectedId: string;
  onSelect: (id: string) => void;
  onValidate: (id: string) => void;
  onImport: () => void;
  onReconcile: (id: string) => void;
}) {
  const selected = state.statements.find(statement => statement.id === selectedId) ?? state.statements[0] ?? null;
  const selectedLines = selected
    ? state.statementLines.filter(line => line.statementId === selected.id)
    : [];

  const columns: Column<BankStatement>[] = [
    {
      header: 'Archivo',
      cell: statement => (
        <div>
          <div className="font-mono text-[11px] font-semibold text-gray-800">{statement.fileName}</div>
          <div className="text-[10px] text-gray-400">{statement.id}</div>
        </div>
      ),
    },
    {
      header: 'Cuenta',
      cell: statement => {
        const account = accountOf(state, statement.accountId);
        return account ? `${account.bank} · ${maskNumber(account.number)}` : '—';
      },
    },
    { header: 'Período', cell: statement => `${fmtDate(statement.from)} — ${fmtDate(statement.to)}` },
    { header: 'Saldo inicial', align: 'right', cell: statement => <Money value={statement.opening} /> },
    { header: 'Saldo final', align: 'right', cell: statement => <Money value={statement.closing} className="font-semibold" /> },
    {
      header: 'Líneas',
      align: 'center',
      cell: statement => state.statementLines.filter(line => line.statementId === statement.id).length,
    },
    { header: 'Estado', cell: statement => <Badge tone={statementTone(statement.status)}>{statement.status}</Badge> },
  ];

  const lineColumns: Column<StatementLine>[] = [
    { header: 'Fecha', cell: line => fmtDate(line.date) },
    { header: 'Referencia', cell: line => <span className="font-mono">{line.reference}</span> },
    { header: 'Descripción', cell: line => line.description },
    { header: 'Débito', align: 'right', cell: line => line.debit ? <Money value={line.debit} className="text-red-700" /> : '—' },
    { header: 'Crédito', align: 'right', cell: line => line.credit ? <Money value={line.credit} className="text-emerald-700" /> : '—' },
    { header: 'Saldo', align: 'right', cell: line => <Money value={line.balance} className="font-semibold" /> },
    { header: 'Estado', cell: line => <Badge tone={statusTone(line.status)}>{line.status}</Badge> },
    {
      header: 'Conciliado',
      cell: line => (
        <div className="flex items-center gap-1.5">
          <Badge tone={line.matched >= lineValue(line) && lineValue(line) > 0 ? 'green' : 'gray'}>
            {line.matched >= lineValue(line) && lineValue(line) > 0 ? 'Sí' : 'No'}
          </Badge>
          {line.matched > 0 && <span className="text-[10px] text-gray-400">{money(line.matched)}</span>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          title="Extractos importados"
          detail="Seleccione un extracto para revisar sus líneas."
          action={<Button size="sm" variant="primary" onClick={onImport}><Icon name="plus" className="h-3.5 w-3.5" /> Importar extracto</Button>}
        />
        <DataTable
          columns={columns}
          rows={state.statements}
          rowKey={statement => statement.id}
          onRowClick={statement => onSelect(statement.id)}
          empty="No hay extractos importados."
        />
      </Card>

      {selected && (
        <Card>
          <SectionTitle
            title={`Líneas de ${selected.fileName}`}
            detail={`${accountOf(state, selected.accountId)?.bank ?? 'Cuenta'} · ${fmtDate(selected.from)} a ${fmtDate(selected.to)} · ${selectedLines.length} movimientos`}
            action={(
              <div className="flex flex-wrap gap-2">
                {selected.status === 'Abierto' && (
                  <Button size="sm" variant="primary" onClick={() => onValidate(selected.id)}>Validar</Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => onReconcile(selected.id)}>Conciliar</Button>
              </div>
            )}
          />
          <DataTable
            columns={lineColumns}
            rows={selectedLines}
            rowKey={line => line.id}
            dense
            empty="El extracto no tiene líneas registradas."
          />
        </Card>
      )}
    </div>
  );
}

function ReconciliationView({ state, statementId, onStatement, onAuto, onManual, onUnreconcile }: {
  state: FinanceState;
  statementId: string;
  onStatement: (id: string) => void;
  onAuto: (id: string) => void;
  onManual: (lineId: string | null) => void;
  onUnreconcile: (lineId: string) => void;
}) {
  const statement = state.statements.find(item => item.id === statementId) ?? state.statements[0] ?? null;
  if (!statement) {
    return <Card><p className="p-6 text-center text-xs text-gray-500">No hay extractos disponibles para conciliar.</p></Card>;
  }

  const lines = state.statementLines.filter(line => line.statementId === statement.id);
  const entries = bookEntries(state);
  const total = sum(lines.map(line => lineValue(line)));
  const matched = sum(lines.map(line => Math.min(line.matched, lineValue(line))));
  const pending = Math.max(0, total - matched);
  const differences = sum(
    state.reconciliations
      .filter(item => lines.some(line => line.id === item.statementLineId))
      .map(item => item.difference),
  );
  const stats = {
    total,
    matched,
    pending,
    differences,
    reconciled: lines.filter(line => line.status === 'Conciliado').length,
    suggested: lines.filter(line => line.suggestion.trim() !== '' && line.status !== 'Conciliado').length,
  };

  const lineColumns: Column<StatementLine>[] = [
    { header: 'Fecha', cell: line => fmtDate(line.date) },
    { header: 'Referencia', cell: line => <span className="font-mono">{line.reference}</span> },
    {
      header: 'Descripción',
      cell: line => {
        const suggestion = suggestFor(line, entries);
        return (
          <div className="max-w-64">
            <div className="truncate">{line.description}</div>
            <div className="text-[10px] text-gray-400">
              {line.suggestion || suggestion.label}
              {suggestion.confidence > 0 && ` · ${suggestion.confidence} %`}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Valor',
      align: 'right',
      cell: line => (
        <span className={`font-semibold tabular ${line.credit > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
          <Money value={lineValue(line)} />
        </span>
      ),
    },
    { header: 'Estado', cell: line => <Badge tone={statusTone(line.status)}>{line.status}</Badge> },
    {
      header: 'Acción',
      align: 'right',
      cell: line => (
        line.status === 'Conciliado' ? (
          <button type="button" onClick={() => onUnreconcile(line.id)} className="text-[10px] font-semibold text-red-600 hover:underline">
            Desconciliar
          </button>
        ) : (
          <button type="button" onClick={() => onManual(line.id)} className="text-[10px] font-semibold text-petroleum-600 hover:underline">
            Conciliar
          </button>
        )
      ),
    },
  ];

  const bookColumns: Column<BookEntry>[] = [
    { header: 'Tipo', cell: entry => <Badge tone={entry.type === 'Recibo' ? 'blue' : entry.type === 'Pago' ? 'violet' : 'cyan'}>{entry.type}</Badge> },
    { header: 'Referencia', cell: entry => <span className="font-mono">{entry.ref}</span> },
    { header: 'Fecha', cell: entry => fmtDate(entry.date) },
    {
      header: 'Descripción',
      cell: entry => (
        <div className="max-w-64">
          <div className="truncate">{entry.description}</div>
          <div className="text-[10px] text-gray-400">
            {accountOf(state, entry.accountId)?.bank ?? 'Cuenta'} · {maskNumber(accountOf(state, entry.accountId)?.number ?? '')}
          </div>
        </div>
      ),
    },
    { header: 'Valor', align: 'right', cell: entry => <Money value={entry.amount} /> },
    {
      header: 'Conciliado',
      align: 'right',
      cell: entry => {
        const linked = reconciledForBook(state, entry.type, entry.ref);
        return (
          <span className={`text-[10px] font-semibold ${linked >= entry.amount ? 'text-emerald-700' : 'text-gray-400'}`}>
            {linked > 0 ? money(linked) : '—'}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <FilterBar>
          <Field label="Extracto" className="min-w-72">
            <FilterSelect value={statement.id} onChange={event => onStatement(event.target.value)}>
              {state.statements.map(item => (
                <option key={item.id} value={item.id}>
                  {item.fileName} · {accountOf(state, item.accountId)?.bank ?? 'Cuenta'} · {fmtDate(item.from)} a {fmtDate(item.to)}
                </option>
              ))}
            </FilterSelect>
          </Field>
          <div className="flex-1" />
          <Button onClick={() => onManual(null)}>Conciliación manual</Button>
          <Button variant="primary" onClick={() => onAuto(statement.id)}>Conciliar automáticamente</Button>
        </FilterBar>
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <SummaryTile label="Total extracto" value={money(stats.total)} detail={`${lines.length} líneas`} />
          <SummaryTile label="Conciliado" value={money(stats.matched)} detail={`${stats.reconciled} líneas cerradas`} />
          <SummaryTile label="Por conciliar" value={money(stats.pending)} detail={`${stats.suggested} con sugerencia`} />
          <SummaryTile label="Diferencia registrada" value={money(stats.differences)} detail="acumulada en conciliaciones" />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle title="Líneas del extracto" detail={`${accountOf(state, statement.accountId)?.bank ?? 'Cuenta'} · ${statement.fileName}`} />
          <DataTable columns={lineColumns} rows={lines} rowKey={line => line.id} dense empty="Extracto sin líneas." />
        </Card>
        <Card>
          <SectionTitle title="Partidas del libro" detail="Recibos, pagos y transferencias disponibles para cruzar." />
          <DataTable columns={bookColumns} rows={entries} rowKey={entryKey} dense empty="No hay partidas de libro registradas." />
        </Card>
      </div>

      <Card>
        <SectionTitle title="Panel de diferencia" detail="Comparación entre el valor del extracto y las partidas conciliadas." />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Valor extracto" value={money(stats.total)} />
          <SummaryTile label="Valor conciliado" value={money(stats.matched)} />
          <SummaryTile label="Saldo pendiente" value={money(stats.pending)} />
          <SummaryTile label="Diferencia" value={money(stats.differences)} detail={stats.pending === 0 ? 'Extracto cerrado' : 'Requiere revisión'} />
        </div>
        <div className="px-4 pb-4">
          <Progress value={stats.total > 0 ? (stats.matched / stats.total) * 100 : 0} tone="cyan" label="Avance de conciliación" />
        </div>
      </Card>
    </div>
  );
}

function RulesView({ state, onCreate, onToggle, onSimulate }: {
  state: FinanceState;
  onCreate: () => void;
  onToggle: (id: string) => void;
  onSimulate: (id: string) => void;
}) {
  const columns: Column<ReconciliationRule>[] = [
    { header: 'Nombre', cell: rule => <span className="font-medium text-gray-800">{rule.name}</span> },
    { header: 'Campo', cell: rule => rule.field },
    { header: 'Operador', cell: rule => rule.operator },
    { header: 'Valor', cell: rule => <span className="font-mono">{rule.value}</span> },
    { header: 'Acción', cell: rule => <span className="text-[11px] text-gray-600">{rule.action}</span> },
    { header: 'Prioridad', align: 'center', cell: rule => rule.priority },
    {
      header: 'Coincidencias',
      align: 'right',
      cell: rule => (
        <div>
          <div className="font-semibold tabular text-gray-800">{rule.matches}</div>
          <div className="text-[10px] text-gray-400">Actual: {ruleMatchCount(state.statementLines, rule)}</div>
        </div>
      ),
    },
    { header: 'Estado', cell: rule => <Badge tone={rule.active ? 'green' : 'gray'}>{rule.active ? 'Activa' : 'Inactiva'}</Badge> },
    {
      header: 'Acciones',
      align: 'right',
      cell: rule => (
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => onSimulate(rule.id)} className="text-[10px] font-semibold text-petroleum-600 hover:underline">
            Simular
          </button>
          <button type="button" onClick={() => onToggle(rule.id)} className="text-[10px] font-semibold text-gray-600 hover:underline">
            {rule.active ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <SectionTitle
        title="Reglas de cruce automático"
        detail="La prioridad define el orden de evaluación; las reglas inactivas no se aplican."
        action={<Button size="sm" variant="primary" onClick={onCreate}><Icon name="plus" className="h-3.5 w-3.5" /> Nueva regla</Button>}
      />
      <DataTable columns={columns} rows={state.rules} rowKey={rule => rule.id} empty="No hay reglas configuradas." />
      <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-[11px] text-gray-500">
        Simular recalcula las coincidencias sobre las {state.statementLines.length} líneas de extracto registradas.
      </div>
    </Card>
  );
}

function TransfersView({ state, onCreate }: { state: FinanceState; onCreate: () => void }) {
  const columns: Column<Transfer>[] = [
    { header: 'Número', cell: transfer => <span className="font-mono font-semibold text-gray-800">{transfer.number}</span> },
    { header: 'Fecha', cell: transfer => fmtDate(transfer.date) },
    {
      header: 'Origen',
      cell: transfer => {
        const account = accountOf(state, transfer.fromId);
        return account ? `${account.bank} · ${maskNumber(account.number)}` : '—';
      },
    },
    {
      header: 'Destino',
      cell: transfer => {
        const account = accountOf(state, transfer.toId);
        return account ? `${account.bank} · ${maskNumber(account.number)}` : '—';
      },
    },
    { header: 'Valor', align: 'right', cell: transfer => <Money value={transfer.amount} className="font-semibold" /> },
    { header: 'Comisión', align: 'right', cell: transfer => <Money value={transfer.fee} /> },
    { header: 'Referencia', cell: transfer => <span className="text-[11px] text-gray-600">{transfer.reference}</span> },
    { header: 'Estado', cell: transfer => <Badge tone={transferTone(transfer.status)}>{transfer.status}</Badge> },
  ];

  const total = sum(state.transfers.map(transfer => transfer.amount));
  const fees = sum(state.transfers.map(transfer => transfer.fee));

  return (
    <Card>
      <SectionTitle
        title="Transferencias registradas"
        detail={`${state.transfers.length} traslados entre cuentas propias.`}
        action={<Button size="sm" variant="primary" onClick={onCreate}><Icon name="plus" className="h-3.5 w-3.5" /> Nueva transferencia</Button>}
      />
      <DataTable
        columns={columns}
        rows={state.transfers}
        rowKey={transfer => transfer.id}
        footer={(
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
            <span>Valor trasladado: <strong className="text-gray-800"><Money value={total} /></strong></span>
            <span>Comisiones: <strong className="text-gray-800"><Money value={fees} /></strong></span>
          </div>
        )}
      />
    </Card>
  );
}

function ChecksView({ state, onCreate, onCollect, onVoid }: {
  state: FinanceState;
  onCreate: () => void;
  onCollect: (id: string) => void;
  onVoid: (id: string) => void;
}) {
  const columns: Column<Check>[] = [
    { header: 'Número', cell: check => <span className="font-mono font-semibold text-gray-800">{check.number}</span> },
    {
      header: 'Cuenta',
      cell: check => {
        const account = accountOf(state, check.accountId);
        return account ? `${account.bank} · ${maskNumber(account.number)}` : '—';
      },
    },
    { header: 'Beneficiario', cell: check => <span className="text-[11px] text-gray-700">{check.beneficiary}</span> },
    { header: 'Emisión', cell: check => fmtDate(check.issueDate) },
    { header: 'Vencimiento', cell: check => fmtDate(check.dueDate) },
    { header: 'Valor', align: 'right', cell: check => <Money value={check.amount} className="font-semibold" /> },
    {
      header: 'Estado',
      cell: check => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge tone={checkTone(check.status)}>{check.status}</Badge>
          {check.status === 'Emitido' && check.dueDate < HOY && <Badge tone="red">Vencido</Badge>}
        </div>
      ),
    },
    {
      header: 'Acciones',
      align: 'right',
      cell: check => check.status === 'Emitido' ? (
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => onCollect(check.id)} className="text-[10px] font-semibold text-emerald-700 hover:underline">
            Marcar cobrado
          </button>
          <button type="button" onClick={() => onVoid(check.id)} className="text-[10px] font-semibold text-red-600 hover:underline">
            Anular
          </button>
        </div>
      ) : <span className="text-[10px] text-gray-400">—</span>,
    },
  ];

  const pending = state.checks.filter(check => check.status === 'Emitido');

  return (
    <Card>
      <SectionTitle
        title="Cheques emitidos"
        detail={`${pending.length} cheques pendientes por ${money(sum(pending.map(check => check.amount)))}.`}
        action={<Button size="sm" variant="primary" onClick={onCreate}><Icon name="plus" className="h-3.5 w-3.5" /> Nuevo cheque</Button>}
      />
      <DataTable columns={columns} rows={state.checks} rowKey={check => check.id} empty="No hay cheques registrados." />
    </Card>
  );
}

function CashView({ state, selectedId, onSelect, onMove, onCloseCash }: {
  state: FinanceState;
  selectedId: string;
  onSelect: (id: string) => void;
  onMove: () => void;
  onCloseCash: () => void;
}) {
  const cash = state.pettyCashes.find(item => item.id === selectedId) ?? state.pettyCashes[0] ?? null;
  if (!cash) {
    return <Card><p className="p-6 text-center text-xs text-gray-500">No hay cajas menores registradas.</p></Card>;
  }

  const movements = [...cash.movements].sort((a, b) => b.date.localeCompare(a.date));
  const income = sum(cash.movements.filter(movement => movement.type === 'Ingreso').map(movement => movement.amount));
  const expenses = sum(cash.movements.filter(movement => movement.type === 'Egreso').map(movement => movement.amount));

  const movementColumns: Column<CashMovement>[] = [
    { header: 'Fecha', cell: movement => fmtDate(movement.date) },
    { header: 'Tipo', cell: movement => <Badge tone={movement.type === 'Ingreso' ? 'green' : 'amber'}>{movement.type}</Badge> },
    { header: 'Concepto', cell: movement => movement.concept },
    { header: 'Soporte', cell: movement => <span className="font-mono text-[10px]">{movement.support}</span> },
    { header: 'Responsable', cell: movement => movement.responsible },
    {
      header: 'Valor',
      align: 'right',
      cell: movement => (
        <span className={`font-semibold ${movement.type === 'Ingreso' ? 'text-emerald-700' : 'text-red-700'}`}>
          {movement.type === 'Ingreso' ? '+' : '-'} <Money value={movement.amount} />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {state.pettyCashes.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`rounded-xl border bg-white p-4 text-left shadow-sm transition ${
              cash.id === item.id ? 'border-petroleum-400 ring-2 ring-petroleum-100' : 'border-gray-200 hover:border-petroleum-200'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-gray-800">{item.name}</div>
                <div className="text-[10px] text-gray-400">{item.responsible}</div>
              </div>
              <Badge tone={cashTone(item.status)}>{item.status}</Badge>
            </div>
            <div className="mt-3 text-lg font-semibold text-gray-900"><Money value={item.balance} /></div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
              <span>Base <Money value={item.opening} /></span>
              <span>{item.movements.length} movimientos</span>
            </div>

            <div className="mt-3">
              <Progress
                value={item.opening > 0 ? (item.balance / item.opening) * 100 : 0}
                tone={item.balance < item.opening * 0.2 ? 'red' : 'green'}
                label="Saldo sobre base"
              />
            </div>
          </button>
        ))}
      </div>

      <Card>
        <SectionTitle
          title={cash.name}
          detail={`Responsable: ${cash.responsible} · Base ${money(cash.opening)}`}
          action={(
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" disabled={cash.status === 'Cerrada'} onClick={onMove}>
                <Icon name="plus" className="h-3.5 w-3.5" /> Registrar movimiento
              </Button>
              <Button size="sm" variant="secondary" disabled={cash.status === 'Cerrada'} onClick={onCloseCash}>
                Cerrar caja
              </Button>
            </div>
          )}
        />
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <SummaryTile label="Base" value={money(cash.opening)} />
          <SummaryTile label="Ingresos" value={money(income)} />
          <SummaryTile label="Egresos" value={money(expenses)} />
          <SummaryTile label="Saldo actual" value={money(cash.balance)} detail={cash.status === 'Cerrada' ? 'Caja cerrada' : 'Caja abierta'} />
        </div>
        {cash.status === 'Cerrada' && (
          <div className="mx-4 mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
            La caja está cerrada y no admite nuevos movimientos. El saldo refleja el último arqueo.
          </div>
        )}
        <DataTable
          columns={movementColumns}
          rows={movements}
          rowKey={movement => movement.id}
          dense
          empty="La caja no tiene movimientos registrados."
        />
      </Card>
    </div>
  );
}

function ItemsView({ state, assigned, onAssign, onAdjust, onExport }: {
  state: FinanceState;
  assigned: Record<string, string>;
  onAssign: (lineId: string) => void;
  onAdjust: (lineId: string) => void;
  onExport: () => void;
}) {
  const lines = pendingStatementLines(state).sort((a, b) => a.date.localeCompare(b.date));
  const activeAccounts = state.accounts.filter(account => account.status === 'Activa');
  const bankBalance = sum(activeAccounts.map(account => account.balance));
  const openForSummary = lines.filter(line => line.status !== 'Conciliado' || line.matched < lineValue(line));
  const netPending = sum(openForSummary.map(line => {
    const remaining = Math.max(0, lineValue(line) - Math.min(line.matched, lineValue(line)));
    return (line.credit > line.debit ? 1 : line.credit < line.debit ? -1 : 0) * remaining;
  }));
  const bookBalance = bankBalance - netPending;
  const difference = bankBalance - bookBalance;

  const columns: Column<StatementLine>[] = [
    {
      header: 'Cuenta',
      cell: line => {
        const statement = statementOf(state, line.statementId);
        const account = statement ? accountOf(state, statement.accountId) : undefined;
        return (
          <div>
            <div className="text-[11px] font-medium text-gray-800">{account?.bank ?? '—'}</div>
            <div className="font-mono text-[10px] text-gray-400">{account ? maskNumber(account.number) : ''}</div>
          </div>
        );
      },
    },
    { header: 'Fecha', cell: line => fmtDate(line.date) },
    { header: 'Descripción', cell: line => <div className="max-w-64"><div className="truncate">{line.description}</div><div className="text-[10px] text-gray-400">{line.reference}</div></div> },
    { header: 'Valor', align: 'right', cell: line => <Money value={lineValue(line)} className="font-semibold" /> },
    {
      header: 'Antigüedad',
      align: 'center',
      cell: line => {
        const days = daysBetween(line.date, HOY);
        return <Badge tone={agingTone(days)}>{agingLabel(days)}</Badge>;
      },
    },
    { header: 'Estado', cell: line => <Badge tone={statusTone(line.status)}>{line.status}</Badge> },
    {
      header: 'Responsable',
      cell: line => (
        <span className={assigned[line.id] ? 'text-[11px] text-gray-700' : 'text-[11px] text-gray-400'}>
          {assigned[line.id] ?? 'Sin asignar'}
        </span>
      ),
    },
    {
      header: 'Acciones',
      align: 'right',
      cell: line => (
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => onAdjust(line.id)} className="text-[10px] font-semibold text-petroleum-600 hover:underline">
            Crear ajuste
          </button>
          <button type="button" onClick={() => onAssign(line.id)} className="text-[10px] font-semibold text-gray-600 hover:underline">
            Asignar
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Saldo según banco" value={money(bankBalance)} detail={`${activeAccounts.length} cuentas activas`} tone="blue" />
        <KpiCard label="Saldo según libros" value={money(bookBalance)} detail="Banco menos partidas abiertas" tone="cyan" />
        <KpiCard label="Diferencia" value={money(difference)} detail={difference === 0 ? 'Sin diferencia pendiente' : 'Explicada por partidas'} tone={difference === 0 ? 'green' : 'amber'} />
        <KpiCard label="Partidas abiertas" value={String(lines.length)} detail={money(sum(lines.map(line => lineValue(line))))} tone="red" />
      </div>

      <Card>
        <SectionTitle
          title="Partidas conciliatorias"
          detail={`${lines.length} líneas sin conciliar o con diferencia.`}
          action={<Button size="sm" onClick={onExport}><Icon name="download" className="h-3.5 w-3.5" /> Exportar CSV</Button>}
        />
        <DataTable
          columns={columns}
          rows={lines}
          rowKey={line => line.id}
          dense
          empty="No hay partidas conciliatorias pendientes."
          footer={(
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
              <span>Antigüedad calculada frente al {fmtDate(HOY)}.</span>
              <span className="font-semibold text-gray-800">
                Total partidas: <Money value={sum(lines.map(line => lineValue(line)))} />
              </span>
            </div>
          )}
        />
      </Card>
    </div>
  );
}

function AccountEditor({ onClose, onSave }: {
  onClose: () => void;
  onSave: (payload: AccountDraft) => void;
}) {
  const [kind, setKind] = useState<BankAccount['kind']>('Banco');
  const [bank, setBank] = useState('');
  const [number, setNumber] = useState('');
  const [currency, setCurrency] = useState<BankAccount['currency']>('COP');
  const [ledgerAccount, setLedgerAccount] = useState('111005');
  const [initial, setInitial] = useState(0);
  const [responsible, setResponsible] = useState('');

  const valid = bank.trim() !== '' && number.trim().length >= 3 && ledgerAccount.trim() !== '' && responsible.trim() !== '' && initial >= 0;

  return (
    <Modal title="Nueva cuenta" subtitle="Registre una cuenta bancaria o una caja con su saldo inicial." onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            <select className={INPUT} value={kind} onChange={event => setKind(event.target.value as BankAccount['kind'])}>
              <option value="Banco">Banco</option>
              <option value="Caja">Caja</option>
            </select>
          </Field>
          <Field label="Banco o caja">
            <input className={INPUT} value={bank} onChange={event => setBank(event.target.value)} placeholder="Nombre de la entidad" />
          </Field>
          <Field label="Número de cuenta">
            <input className={INPUT} value={number} onChange={event => setNumber(event.target.value)} placeholder="4589" />
          </Field>
          <Field label="Moneda">
            <select className={INPUT} value={currency} onChange={event => setCurrency(event.target.value as BankAccount['currency'])}>
              <option value="COP">COP</option>
              <option value="USD">USD</option>
            </select>
          </Field>
          <Field label="Cuenta contable">
            <input className={INPUT} value={ledgerAccount} onChange={event => setLedgerAccount(event.target.value)} placeholder="11100501" />
          </Field>
          <Field label="Saldo inicial">
            <input type="number" min={0} className={INPUT} value={initial} onChange={event => setInitial(toNumber(event.target.value))} />
          </Field>
          <Field label="Responsable" className="sm:col-span-2">
            <input className={INPUT} value={responsible} onChange={event => setResponsible(event.target.value)} placeholder="Nombre del responsable" />
          </Field>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
          El número se mostrará enmascarado en las pantallas de tesorería. La cuenta se crea activa y su saldo inicial se convierte en el saldo actual.
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!valid} onClick={() => onSave({ kind, bank, number, currency, ledgerAccount, initial, responsible })}>
            Crear cuenta
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function StatementImporter({ state, onClose, onSave }: {
  state: FinanceState;
  onClose: () => void;
  onSave: (payload: StatementDraft) => void;
}) {
  const accounts = state.accounts.filter(account => account.status === 'Activa');
  const first = accounts[0];
  const [accountId, setAccountId] = useState(first?.id ?? '');
  const [fileName, setFileName] = useState('');
  const [from, setFrom] = useState(`${HOY.slice(0, 8)}01`);
  const [to, setTo] = useState(HOY);
  const [opening, setOpening] = useState(first?.initial ?? 0);
  const [closing, setClosing] = useState(first?.balance ?? 0);

  const movements = buildImportMovements(opening, closing);
  const computedClosing = opening + sum(movements.map(movement => movement.credit - movement.debit));
  const balanced = Math.abs(computedClosing - closing) < 1;
  const periodValid = from !== '' && to !== '' && from <= to;
  const fileValid = /\.(csv|xlsx|ofx|txt)$/i.test(fileName.trim());
  const valid = accountId !== '' && fileValid && periodValid && balanced && opening >= 0 && closing >= 0;

  function changeAccount(id: string) {
    setAccountId(id);
    const account = state.accounts.find(item => item.id === id);
    if (account) {
      setOpening(account.initial);
      setClosing(account.balance);
    }
  }

  return (
    <Modal title="Importar extracto" subtitle="Carga simulada con generación de movimientos y validación de cuadre." onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Cuenta">
            <select className={INPUT} value={accountId} onChange={event => changeAccount(event.target.value)}>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>{account.bank} · {maskNumber(account.number)}</option>
              ))}
            </select>
          </Field>
          <Field label="Archivo" hint="csv, xlsx, ofx o txt">
            <input className={INPUT} value={fileName} onChange={event => setFileName(event.target.value)} placeholder="bancolombia_4589_feb2026.csv" />
          </Field>
          <Field label="Período desde">
            <input type="date" className={INPUT} value={from} onChange={event => setFrom(event.target.value)} />
          </Field>
          <Field label="Período hasta">
            <input type="date" className={INPUT} value={to} onChange={event => setTo(event.target.value)} />
          </Field>
          <Field label="Saldo inicial">
            <input type="number" min={0} className={INPUT} value={opening} onChange={event => setOpening(toNumber(event.target.value))} />
          </Field>
          <Field label="Saldo final">
            <input type="number" min={0} className={INPUT} value={closing} onChange={event => setClosing(toNumber(event.target.value))} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile label="Cierre calculado" value={money(computedClosing)} detail="Apertura + créditos - débitos" />
          <SummaryTile label="Saldo final ingresado" value={money(closing)} />
          <SummaryTile label="Diferencia de cuadre" value={money(computedClosing - closing)} detail={balanced ? 'Cuadre validado' : 'Revise los valores'} />
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200">
          <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">Movimientos generados</div>
          <table className="w-full text-[11px]">
            <thead className="bg-white text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">Referencia</th>
                <th className="px-3 py-2 text-left">Descripción</th>
                <th className="px-3 py-2 text-right">Débito</th>
                <th className="px-3 py-2 text-right">Crédito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {movements.map(movement => (
                <tr key={movement.reference}>
                  <td className="px-3 py-2 font-mono">{movement.reference}</td>
                  <td className="px-3 py-2">{movement.description}</td>
                  <td className="px-3 py-2 text-right">{movement.debit > 0 ? <Money value={movement.debit} /> : '—'}</td>
                  <td className="px-3 py-2 text-right">{movement.credit > 0 ? <Money value={movement.credit} /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!periodValid && <p className="text-[11px] text-red-600">El período final no puede ser anterior al inicial.</p>}
        {!fileValid && fileName.trim() !== '' && <p className="text-[11px] text-red-600">El archivo debe tener extensión csv, xlsx, ofx o txt.</p>}
        {!balanced && <p className="text-[11px] text-red-600">El extracto no cuadra: revise el saldo inicial y final.</p>}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => onSave({ accountId, fileName, from, to, opening, closing })}
          >
            Importar extracto
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ReconcileEditor({ state, statement, initialLineId, onClose, onSave }: {
  state: FinanceState;
  statement: BankStatement;
  initialLineId: string | null;
  onClose: () => void;
  onSave: (payload: ManualLinkDraft) => void;
}) {
  const availableLines = state.statementLines.filter(line => {
    const value = lineValue(line);
    return line.statementId === statement.id && floatPending(state, line) > 0 && value > 0;
  });
  const entries = bookEntries(state);
  const initialLine = availableLines.find(line => line.id === initialLineId) ?? availableLines[0];
  const initialSuggested = initialLine ? suggestFor(initialLine, entries).entry : undefined;
  const initialSuggestedAvailable = initialSuggested
    ? Math.max(0, initialSuggested.amount - reconciledForBook(state, initialSuggested.type, initialSuggested.ref))
    : 0;
  const initialEntry = initialSuggested && initialSuggestedAvailable > 0 ? initialSuggested : entries[0];
  const initialPending = initialLine ? floatPending(state, initialLine) : 0;
  const initialBookAvailable = initialEntry
    ? Math.max(0, initialEntry.amount - reconciledForBook(state, initialEntry.type, initialEntry.ref))
    : initialPending;
  const [lineId, setLineId] = useState(initialLine?.id ?? '');
  const [entryKeyValue, setEntryKeyValue] = useState(initialEntry ? entryKey(initialEntry) : '');
  const [amount, setAmount] = useState(Math.min(initialPending, initialBookAvailable));
  const [note, setNote] = useState('');

  const line = state.statementLines.find(item => item.id === lineId);
  const entry = entries.find(item => entryKey(item) === entryKeyValue);
  const lineRemaining = line ? floatPending(state, line) : 0;
  const bookRemaining = entry ? Math.max(0, entry.amount - reconciledForBook(state, entry.type, entry.ref)) : 0;
  const differenceAfter = Math.max(0, lineRemaining - amount);
  const valid = Boolean(line) && Boolean(entry) && amount > 0 && amount <= lineRemaining + 0.5 && amount <= bookRemaining + 0.5;

  function changeLine(id: string) {
    setLineId(id);
    const target = state.statementLines.find(item => item.id === id);
    if (!target) return;
    const pending = floatPending(state, target);
    const suggested = suggestFor(target, entries).entry;
    const suggestedAvailable = suggested
      ? Math.max(0, suggested.amount - reconciledForBook(state, suggested.type, suggested.ref))
      : 0;
    if (suggested && suggestedAvailable > 0) setEntryKeyValue(entryKey(suggested));
    const available = suggested && suggestedAvailable > 0
      ? suggestedAvailable
      : entry
        ? Math.max(0, entry.amount - reconciledForBook(state, entry.type, entry.ref))
        : pending;
    setAmount(Math.min(pending, available));
  }

  return (
    <Modal title="Conciliación manual" subtitle={`${statement.fileName} · seleccione la línea del extracto y la partida del libro.`} onClose={onClose}>
      <div className="space-y-4">
        {availableLines.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            No hay líneas pendientes de conciliar en este extracto.
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Línea del extracto">
            <select className={INPUT} value={lineId} onChange={event => changeLine(event.target.value)} disabled={availableLines.length === 0}>
              {availableLines.map(item => (
                <option key={item.id} value={item.id}>
                  {fmtDate(item.date)} · {item.reference} · {money(floatPending(state, item))}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Partida del libro">
            <select className={INPUT} value={entryKeyValue} onChange={event => setEntryKeyValue(event.target.value)} disabled={entries.length === 0}>
              {entries.map(item => (
                <option key={entryKey(item)} value={entryKey(item)}>
                  {item.type} {item.ref} · {money(Math.max(0, item.amount - reconciledForBook(state, item.type, item.ref)))}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Valor a conciliar">
            <input type="number" min={0} className={INPUT} value={amount} onChange={event => setAmount(toNumber(event.target.value))} />
          </Field>
          <Field label="Diferencia después del cruce">
            <input className={INPUT} value={money(differenceAfter)} readOnly />
          </Field>
          <Field label="Nota" className="sm:col-span-2">
            <textarea className={`${INPUT} min-h-20`} value={note} onChange={event => setNote(event.target.value)} placeholder="Observación de la conciliación" />
          </Field>
        </div>
        {line && entry && amount > bookRemaining + 0.5 && (
          <p className="text-[11px] text-red-600">El valor supera el saldo disponible de la partida del libro ({money(bookRemaining)}).</p>
        )}
        {line && amount > lineRemaining + 0.5 && (
          <p className="text-[11px] text-red-600">El valor supera el pendiente de la línea ({money(lineRemaining)}).</p>
        )}
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
          Línea: <strong>{line ? `${line.reference} · ${line.description}` : '—'}</strong>
          <br />
          Partida: <strong>{entry ? `${entry.type} ${entry.ref}` : '—'}</strong>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => entry && onSave({
              statementLineId: lineId,
              bookType: entry.type,
              bookRef: entry.ref,
              amount,
              note,
            })}
          >
            Registrar conciliación
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function RuleEditor({ state, onClose, onSave }: {
  state: FinanceState;
  onClose: () => void;
  onSave: (payload: RuleDraft) => void;
}) {
  const [name, setName] = useState('');
  const [field, setField] = useState<ReconciliationRule['field']>('Referencia');
  const [operator, setOperator] = useState<ReconciliationRule['operator']>('Contiene');
  const [value, setValue] = useState('');
  const [action, setAction] = useState('Cruzar automáticamente');
  const [priority, setPriority] = useState(state.rules.length + 1);
  const [active, setActive] = useState(true);

  const valueValid = operator === 'Entre'
    ? /^\s*-?\d+(?:[.,]\d+)?\s*[,;]\s*-?\d+(?:[.,]\d+)?\s*$/.test(value)
    : field === 'Importe' && operator === 'Igual a'
      ? /^-?\d+(?:[.,]\d+)?$/.test(value.replace(/\s/g, ''))
      : value.trim() !== '';
  const valid = name.trim() !== '' && valueValid && action.trim() !== '' && priority > 0;

  return (
    <Modal title="Nueva regla de conciliación" subtitle="Defina el criterio y la acción que se aplicará durante el cruce automático." onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" className="sm:col-span-2">
            <input className={INPUT} value={name} onChange={event => setName(event.target.value)} placeholder="Recaudos por referencia" />
          </Field>
          <Field label="Campo">
            <select className={INPUT} value={field} onChange={event => setField(event.target.value as ReconciliationRule['field'])}>
              <option value="Referencia">Referencia</option>
              <option value="Importe">Importe</option>
              <option value="Descripción">Descripción</option>
              <option value="Tercero">Tercero</option>
            </select>
          </Field>
          <Field label="Operador">
            <select className={INPUT} value={operator} onChange={event => setOperator(event.target.value as ReconciliationRule['operator'])}>
              <option value="Contiene">Contiene</option>
              <option value="Igual a">Igual a</option>
              <option value="Entre">Entre</option>
            </select>
          </Field>
          <Field
            label="Valor"
            hint={operator === 'Entre' ? 'mínimo,máximo para importes' : field === 'Tercero' ? 'se evalúa sobre la descripción' : undefined}
          >
            <input className={INPUT} value={value} onChange={event => setValue(event.target.value)} placeholder={operator === 'Entre' ? '0, 5000000' : 'REC-'} />
          </Field>
          <Field label="Prioridad">
            <input type="number" min={1} className={INPUT} value={priority} onChange={event => setPriority(toNumber(event.target.value))} />
          </Field>
          <Field label="Acción" className="sm:col-span-2">
            <input className={INPUT} value={action} onChange={event => setAction(event.target.value)} placeholder="Cruzar con recibos de caja" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-gray-600">
          <input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />
          Crear la regla activa
        </label>
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!valid} onClick={() => onSave({ name, field, operator, value, action, priority, active })}>
            Crear regla
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TransferEditor({ state, onClose, onSave }: {
  state: FinanceState;
  onClose: () => void;
  onSave: (payload: TransferDraft) => void;
}) {
  const accounts = state.accounts.filter(account => account.status === 'Activa');
  const [fromId, setFromId] = useState(accounts[0]?.id ?? '');
  const [toId, setToId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? '');
  const [date, setDate] = useState(HOY);
  const [amount, setAmount] = useState(0);
  const [fee, setFee] = useState(0);
  const [reference, setReference] = useState('Traslado entre cuentas');

  const origin = accountOf(state, fromId);
  const destination = accountOf(state, toId);
  const different = fromId !== '' && toId !== '' && fromId !== toId;
  const enough = Boolean(origin) && amount + fee <= (origin?.balance ?? 0);
  const valid = different && Boolean(origin) && Boolean(destination) && amount > 0 && fee >= 0 && enough && reference.trim() !== '' && date !== '';
  const resultingOrigin = (origin?.balance ?? 0) - amount - fee;
  const resultingDestination = (destination?.balance ?? 0) + amount;

  function changeOrigin(id: string) {
    setFromId(id);
    if (toId === id) {
      const other = accounts.find(account => account.id !== id);
      setToId(other?.id ?? '');
    }
  }

  function changeDestination(id: string) {
    setToId(id);
    if (fromId === id) {
      const other = accounts.find(account => account.id !== id);
      setFromId(other?.id ?? '');
    }
  }

  return (
    <Modal title="Nueva transferencia" subtitle="El valor y la comisión se descuentan del origen; el destino recibe el valor." onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cuenta origen">
            <select className={INPUT} value={fromId} onChange={event => changeOrigin(event.target.value)}>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>{account.bank} · {maskNumber(account.number)}</option>
              ))}
            </select>
          </Field>
          <Field label="Cuenta destino">
            <select className={INPUT} value={toId} onChange={event => changeDestination(event.target.value)}>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>{account.bank} · {maskNumber(account.number)}</option>
              ))}
            </select>
          </Field>
          <Field label="Fecha">
            <input type="date" className={INPUT} value={date} onChange={event => setDate(event.target.value)} />
          </Field>
          <Field label="Referencia">
            <input className={INPUT} value={reference} onChange={event => setReference(event.target.value)} />
          </Field>
          <Field label="Valor">
            <input type="number" min={0} className={INPUT} value={amount} onChange={event => setAmount(toNumber(event.target.value))} />
          </Field>
          <Field label="Comisión">
            <input type="number" min={0} className={INPUT} value={fee} onChange={event => setFee(toNumber(event.target.value))} />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile label="Disponible origen" value={money(origin?.balance ?? 0)} />
          <SummaryTile label="Saldo origen resultante" value={money(resultingOrigin)} />
          <SummaryTile label="Saldo destino resultante" value={money(resultingDestination)} />
        </div>

        {!different && <p className="text-[11px] text-red-600">La cuenta de origen y destino deben ser diferentes.</p>}
        {!enough && amount > 0 && (
          <p className="text-[11px] text-red-600">Saldo insuficiente: se requieren {money(amount + fee)} y hay {money(origin?.balance ?? 0)}.</p>
        )}
        {amount === 0 && <p className="text-[11px] text-gray-500">Ingrese un valor mayor que cero para continuar.</p>}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => onSave({ fromId, toId, date, amount, fee, reference })}
          >
            Registrar transferencia
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CheckEditor({ state, onClose, onSave }: {
  state: FinanceState;
  onClose: () => void;
  onSave: (payload: CheckDraft) => void;
}) {
  const accounts = state.accounts.filter(account => account.status === 'Activa');
  const [number, setNumber] = useState(nextSequence(state.checks, 'CH', 4));
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [beneficiary, setBeneficiary] = useState('');
  const [amount, setAmount] = useState(0);
  const [issueDate, setIssueDate] = useState(HOY);
  const [dueDate, setDueDate] = useState(addDays(HOY, 30));

  const duplicate = state.checks.some(check => check.number.toLowerCase() === number.trim().toLowerCase());
  const valid = number.trim() !== '' && !duplicate && accountId !== '' && beneficiary.trim() !== '' && amount > 0 && issueDate !== '' && dueDate !== '' && dueDate >= issueDate;

  return (
    <Modal title="Nuevo cheque" subtitle="Registre la emisión del cheque para su seguimiento y posterior cobro." onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Número">
            <input className={INPUT} value={number} onChange={event => setNumber(event.target.value)} />
          </Field>
          <Field label="Cuenta">
            <select className={INPUT} value={accountId} onChange={event => setAccountId(event.target.value)}>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>{account.bank} · {maskNumber(account.number)}</option>
              ))}
            </select>
          </Field>
          <Field label="Beneficiario" className="sm:col-span-2">
            <input className={INPUT} value={beneficiary} onChange={event => setBeneficiary(event.target.value)} placeholder="Nombre del beneficiario" />
          </Field>
          <Field label="Valor">
            <input type="number" min={0} className={INPUT} value={amount} onChange={event => setAmount(toNumber(event.target.value))} />
          </Field>
          <Field label="Fecha de emisión">
            <input type="date" className={INPUT} value={issueDate} onChange={event => setIssueDate(event.target.value)} />
          </Field>
          <Field label="Fecha de vencimiento">
            <input type="date" className={INPUT} value={dueDate} onChange={event => setDueDate(event.target.value)} />
          </Field>
        </div>
        {duplicate && <p className="text-[11px] text-red-600">Ya existe un cheque con ese número.</p>}
        {dueDate < issueDate && <p className="text-[11px] text-red-600">El vencimiento no puede ser anterior a la emisión.</p>}
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => onSave({ number, accountId, beneficiary, amount, issueDate, dueDate })}
          >
            Emitir cheque
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CashMovementEditor({ cash, onClose, onSave }: {
  cash: PettyCash;
  onClose: () => void;
  onSave: (payload: CashMoveDraft) => void;
}) {
  const [date, setDate] = useState(HOY);
  const [type, setType] = useState<CashMovement['type']>('Egreso');
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState(0);
  const [support, setSupport] = useState('');
  const [responsible, setResponsible] = useState(cash.responsible);

  const enough = type !== 'Egreso' || amount <= cash.balance;
  const valid = concept.trim() !== '' && support.trim() !== '' && responsible.trim() !== '' && amount > 0 && enough && date !== '';
  const resulting = type === 'Ingreso' ? cash.balance + amount : cash.balance - amount;

  return (
    <Modal title={`Registrar movimiento · ${cash.name}`} subtitle={`Saldo actual ${money(cash.balance)} · responsable ${cash.responsible}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fecha">
            <input type="date" className={INPUT} value={date} onChange={event => setDate(event.target.value)} />
          </Field>
          <Field label="Tipo">
            <select className={INPUT} value={type} onChange={event => setType(event.target.value as CashMovement['type'])}>
              <option value="Ingreso">Ingreso</option>
              <option value="Egreso">Egreso</option>
            </select>
          </Field>
          <Field label="Concepto" className="sm:col-span-2">
            <input className={INPUT} value={concept} onChange={event => setConcept(event.target.value)} placeholder="Descripción del movimiento" />
          </Field>
          <Field label="Soporte">
            <input className={INPUT} value={support} onChange={event => setSupport(event.target.value)} placeholder="Recibo, factura o comprobante" />
          </Field>
          <Field label="Valor">
            <input type="number" min={0} className={INPUT} value={amount} onChange={event => setAmount(toNumber(event.target.value))} />
          </Field>
          <Field label="Responsable" className="sm:col-span-2">
            <input className={INPUT} value={responsible} onChange={event => setResponsible(event.target.value)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryTile label="Saldo actual" value={money(cash.balance)} />
          <SummaryTile label="Saldo resultante" value={money(resulting)} detail={enough ? 'Movimiento válido' : 'Saldo insuficiente'} />
        </div>
        {!enough && <p className="text-[11px] text-red-600">El egreso supera el saldo disponible de la caja.</p>}
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => onSave({ date, type, concept, amount, support, responsible })}
          >
            Registrar movimiento
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CashCloseEditor({ cash, onClose, onSave }: {
  cash: PettyCash;
  onClose: () => void;
  onSave: (counted: number) => void;
}) {
  const [counted, setCounted] = useState(cash.balance);
  const difference = counted - cash.balance;
  const valid = counted >= 0;

  return (
    <Modal title={`Cerrar caja · ${cash.name}`} subtitle="Ingrese el valor contado en el arqueo. La diferencia se registra en la auditoría." onClose={onClose}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile label="Saldo del sistema" value={money(cash.balance)} />
          <SummaryTile label="Valor contado" value={money(counted)} />
          <SummaryTile
            label="Diferencia"
            value={money(difference)}
            detail={difference === 0 ? 'Cuadre exacto' : difference > 0 ? 'Sobrante' : 'Faltante'}
          />
        </div>
        <Field label="Valor contado en el arqueo">
          <input type="number" min={0} className={INPUT} value={counted} onChange={event => setCounted(toNumber(event.target.value))} />
        </Field>
        <div className={`rounded-lg px-3 py-2 text-[11px] ${difference === 0 ? 'bg-emerald-50 text-emerald-800' : difference > 0 ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-800'}`}>
          {difference === 0
            ? 'El arqueo coincide con el saldo del sistema.'
            : difference > 0
              ? `Sobrante de ${money(difference)}. El saldo de la caja se ajustará al valor contado.`
              : `Faltante de ${money(Math.abs(difference))}. El saldo de la caja se ajustará al valor contado.`}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!valid} onClick={() => onSave(counted)}>Cerrar caja</Button>
        </div>
      </div>
    </Modal>
  );
}

function AdjustmentEditor({ state, lineId, onClose, onSave }: {
  state: FinanceState;
  lineId: string;
  onClose: () => void;
  onSave: (payload: AdjustmentDraft) => void;
}) {
  const line = state.statementLines.find(item => item.id === lineId);
  const pending = line ? floatPending(state, line) : 0;
  const [amount, setAmount] = useState(pending);
  const [difference, setDifference] = useState(0);
  const [note, setNote] = useState('');

  const valid = Boolean(line) && amount > 0 && amount <= pending + 0.5 && difference >= 0 && difference <= amount && note.trim() !== '';

  return (
    <Modal title="Crear ajuste conciliatorio" subtitle="El ajuste queda registrado como una conciliación de tipo Ajuste." onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
          <div><strong>{line?.reference ?? '—'}</strong> · {line?.description ?? 'Sin línea seleccionada'}</div>
          <div className="mt-1">Pendiente por conciliar: <strong>{money(pending)}</strong></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Valor del ajuste">
            <input type="number" min={0} className={INPUT} value={amount} onChange={event => setAmount(toNumber(event.target.value))} />
          </Field>
          <Field label="Diferencia">
            <input type="number" min={0} className={INPUT} value={difference} onChange={event => setDifference(toNumber(event.target.value))} />
          </Field>
          <Field label="Nota" className="sm:col-span-2">
            <textarea className={`${INPUT} min-h-20`} value={note} onChange={event => setNote(event.target.value)} placeholder="Justificación del ajuste" />
          </Field>
        </div>
        {amount > pending + 0.5 && <p className="text-[11px] text-red-600">El valor supera el pendiente de la partida.</p>}
        {difference > amount && <p className="text-[11px] text-red-600">La diferencia no puede superar el valor del ajuste.</p>}
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!valid} onClick={() => onSave({ amount, difference, note })}>
            Registrar ajuste
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AssignEditor({ state, lineId, onClose, onSave }: {
  state: FinanceState;
  lineId: string;
  onClose: () => void;
  onSave: (responsible: string) => void;
}) {
  const line = state.statementLines.find(item => item.id === lineId);
  const options = Array.from(new Set([
    ...state.accounts.map(account => account.responsible),
    ...state.pettyCashes.map(cash => cash.responsible),
    ...state.payables.map(payable => payable.owner),
    USUARIO.nombre,
  ].filter(Boolean))).sort();
  const [responsible, setResponsible] = useState(options[0] ?? USUARIO.nombre);

  return (
    <Modal title="Asignar responsable" subtitle="La asignación se registra en la bitácora para seguimiento." onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
          <strong>{line?.reference ?? '—'}</strong> · {line?.description ?? 'Partida seleccionada'}
        </div>
        <Field label="Responsable">
          <select className={INPUT} value={responsible} onChange={event => setResponsible(event.target.value)}>
            {options.map(option => <option key={option} value={option}>{option}</option>)}
          </select>
        </Field>
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => onSave(responsible)}>Asignar responsable</Button>
        </div>
      </div>
    </Modal>
  );
}

function floatPending(state: FinanceState, line: StatementLine): number {
  return Math.max(0, lineValue(line) - reconciledFor(state, line.id));
}
