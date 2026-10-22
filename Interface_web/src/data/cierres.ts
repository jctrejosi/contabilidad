import { EMPRESA, USUARIO } from './mock';
import { HOY } from '../finance/selectors';

const STORAGE_KEY = `contabdsi:cierres:v1:${EMPRESA.codigo}`;
const RESULT_ACCOUNT = '330505';

export type PeriodStatus = 'Abierto' | 'En cierre' | 'Cerrado';

export interface PeriodCheck {
  id: string;
  label: string;
  desc: string;
  bloqueante: boolean;
  checked: boolean;
  automatico?: boolean;
}

export interface EntryLine {
  account: string;
  name: string;
  debit: number;
  credit: number;
}

export interface PeriodEntry {
  number: string;
  date: string;
  type: 'Cierre' | 'Apertura';
  lines: EntryLine[];
  debit: number;
  credit: number;
  status: 'Generado';
  generatedAt: string;
  generatedBy: string;
}

export interface PeriodRecord {
  id: string;
  year: number;
  month: number;
  label: string;
  status: PeriodStatus;
  checks: PeriodCheck[];
  closingEntry?: PeriodEntry;
  openingEntry?: PeriodEntry;
  closedAt?: string;
  closedBy?: string;
  note?: string;
}

export interface CloseAudit {
  id: string;
  at: string;
  user: string;
  action: string;
}

export interface CloseState {
  periods: PeriodRecord[];
  audit: CloseAudit[];
}

interface AccountBalance {
  account: string;
  name: string;
  /** Saldo con signo: positivo = débito, negativo = crédito. */
  balance: number;
}

interface PeriodSnapshot {
  result: AccountBalance[];
  balance: AccountBalance[];
}

const ACCOUNT_NAMES: Record<string, string> = {
  '110505': 'Caja general',
  '111005': 'Bancos moneda nacional',
  '130505': 'Clientes nacionales',
  '143505': 'Inventarios',
  '152405': 'Equipo de oficina',
  '159205': 'Depreciación acumulada',
  '220505': 'Proveedores nacionales',
  '236540': 'Retenciones y aportes de nómina',
  '240805': 'IVA por pagar',
  '250505': 'Salarios por pagar',
  '310505': 'Capital suscrito y pagado',
  '330505': 'Resultados acumulados',
  '4105': 'Ingresos operacionales',
  '5105': 'Gastos de personal',
  '5135': 'Servicios',
  '5195': 'Diversos',
  '5205': 'Gastos de ventas',
};

const SNAPSHOTS: Record<string, PeriodSnapshot> = {
  '2026-02': {
    result: [
      { account: '4105', name: ACCOUNT_NAMES['4105'], balance: -186_000_000 },
      { account: '5105', name: ACCOUNT_NAMES['5105'], balance: 62_000_000 },
      { account: '5135', name: ACCOUNT_NAMES['5135'], balance: 24_000_000 },
      { account: '5195', name: ACCOUNT_NAMES['5195'], balance: 18_000_000 },
      { account: '5205', name: ACCOUNT_NAMES['5205'], balance: 22_000_000 },
    ],
    balance: [
      { account: '110505', name: ACCOUNT_NAMES['110505'], balance: 7_500_000 },
      { account: '111005', name: ACCOUNT_NAMES['111005'], balance: 46_600_000 },
      { account: '130505', name: ACCOUNT_NAMES['130505'], balance: 32_700_000 },
      { account: '143505', name: ACCOUNT_NAMES['143505'], balance: 18_000_000 },
      { account: '152405', name: ACCOUNT_NAMES['152405'], balance: 85_000_000 },
      { account: '159205', name: ACCOUNT_NAMES['159205'], balance: -15_000_000 },
      { account: '220505', name: ACCOUNT_NAMES['220505'], balance: -24_000_000 },
      { account: '236540', name: ACCOUNT_NAMES['236540'], balance: -2_100_000 },
      { account: '240805', name: ACCOUNT_NAMES['240805'], balance: -2_550_000 },
      { account: '250505', name: ACCOUNT_NAMES['250505'], balance: -13_800_000 },
      { account: '310505', name: ACCOUNT_NAMES['310505'], balance: -90_000_000 },
      { account: '330505', name: ACCOUNT_NAMES['330505'], balance: 17_650_000 },
    ],
  },
};

const CHECK_TEMPLATE: Omit<PeriodCheck, 'checked'>[] = [
  { id: 'c1', label: 'Todos los lotes contabilizados', desc: 'No deben quedar lotes pendientes de contabilizar en el período', bloqueante: true },
  { id: 'c2', label: 'Balance cuadrado (diferencia = 0)', desc: 'El total de débitos debe igualar el total de créditos', bloqueante: true, automatico: true },
  { id: 'c3', label: 'Conciliaciones bancarias completas', desc: 'Cuentas de tesorería conciliadas con extractos', bloqueante: false },
  { id: 'c4', label: 'Retenciones acumuladas', desc: 'Acumulados de retenciones actualizados al período', bloqueante: false },
  { id: 'c5', label: 'IVA acumulado', desc: 'Acumulados de IVA actualizados al período', bloqueante: false },
  { id: 'c6', label: 'Respaldo de base de datos realizado', desc: 'Copia de seguridad antes del cierre', bloqueante: true },
  { id: 'c7', label: 'Usuarios informados del cierre', desc: 'Se notificó a los usuarios que el período se cerrará', bloqueante: false },
];

export function periodLabel(year: number, month: number): string {
  const names = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${names[month - 1] ?? month} ${year}`;
}

export function periodId(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function lastDay(year: number, month: number): string {
  const date = new Date(Date.UTC(year, month, 0));
  return date.toISOString().slice(0, 10);
}

function firstDay(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function nextPeriod(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

function snapshotFor(id: string): PeriodSnapshot {
  return SNAPSHOTS[id] ?? SNAPSHOTS['2026-02'];
}

function nowStamp(): string {
  const now = new Date();
  return `${HOY} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function entryId(prefix: string, year: number, month: number): string {
  return `${prefix}-${year}-${String(month).padStart(2, '0')}`;
}

export function trialBalanceDifference(id: string): number {
  const snapshot = snapshotFor(id);
  return [...snapshot.result, ...snapshot.balance].reduce((total, account) => total + account.balance, 0);
}

export function resultPreview(id: string) {
  const snapshot = snapshotFor(id);
  const revenue = snapshot.result.filter(account => account.balance < 0).reduce((total, account) => total + Math.abs(account.balance), 0);
  const expense = snapshot.result.filter(account => account.balance > 0).reduce((total, account) => total + account.balance, 0);
  return { revenue, expense, result: revenue - expense, accounts: snapshot.result };
}

export function buildClosingEntry(id: string, user: string): PeriodEntry {
  const [year, month] = id.split('-').map(Number);
  const snapshot = snapshotFor(id);
  const lines: EntryLine[] = [];
  let debit = 0;
  let credit = 0;

  snapshot.result.forEach(account => {
    if (account.balance < 0) {
      const value = Math.abs(account.balance);
      lines.push({ account: account.account, name: account.name, debit: value, credit: 0 });
      debit += value;
    } else if (account.balance > 0) {
      lines.push({ account: account.account, name: account.name, debit: 0, credit: account.balance });
      credit += account.balance;
    }
  });

  const net = snapshot.result.reduce((total, account) => total + account.balance, 0);
  if (net < 0) {
    lines.push({ account: RESULT_ACCOUNT, name: 'Resultados del ejercicio', debit: 0, credit: -net });
    credit += -net;
  } else if (net > 0) {
    lines.push({ account: RESULT_ACCOUNT, name: 'Resultados del ejercicio', debit: net, credit: 0 });
    debit += net;
  }

  return {
    number: entryId('NO', year, month),
    date: lastDay(year, month),
    type: 'Cierre',
    lines,
    debit,
    credit,
    status: 'Generado',
    generatedAt: nowStamp(),
    generatedBy: user,
  };
}

export function buildOpeningEntry(id: string, user: string): PeriodEntry {
  const [year, month] = id.split('-').map(Number);
  const next = nextPeriod(year, month);
  const snapshot = snapshotFor(id);
  const net = snapshot.result.reduce((total, account) => total + account.balance, 0);
  const balances = new Map(snapshot.balance.map(account => [account.account, account.balance]));
  balances.set('330505', (balances.get('330505') ?? 0) + net);

  const lines: EntryLine[] = [];
  let debit = 0;
  let credit = 0;

  [...balances.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([account, balance]) => {
      if (balance === 0) return;
      const name = ACCOUNT_NAMES[account] ?? account;
      if (balance > 0) {
        lines.push({ account, name, debit: balance, credit: 0 });
        debit += balance;
      } else {
        lines.push({ account, name, debit: 0, credit: Math.abs(balance) });
        credit += Math.abs(balance);
      }
    });

  return {
    number: entryId('AP', next.year, next.month),
    date: firstDay(next.year, next.month),
    type: 'Apertura',
    lines,
    debit,
    credit,
    status: 'Generado',
    generatedAt: nowStamp(),
    generatedBy: user,
  };
}

function checkTemplate(checkedResult: boolean): PeriodCheck[] {
  return CHECK_TEMPLATE.map(check => ({
    ...check,
    checked: check.id === 'c2' ? checkedResult : check.id === 'c7',
  }));
}

export function createSeedCloseState(): CloseState {
  return {
    periods: [
      {
        id: '2026-02',
        year: 2026,
        month: 2,
        label: 'Febrero 2026',
        status: 'Abierto',
        checks: checkTemplate(trialBalanceDifference('2026-02') === 0),
      },
    ],
    audit: [],
  };
}

function isCloseState(value: unknown): value is CloseState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as CloseState;
  return Array.isArray(candidate.periods) && Array.isArray(candidate.audit);
}

export function loadCloseState(): CloseState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isCloseState(parsed)) return parsed;
    }
  } catch {
    // Almacenamiento deshabilitado o datos dañados: se usa el estado inicial.
  }
  return createSeedCloseState();
}

export function saveCloseState(state: CloseState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function currentPeriod(state: CloseState): PeriodRecord | undefined {
  return [...state.periods]
    .filter(period => period.status === 'Abierto' || period.status === 'En cierre')
    .sort((a, b) => a.id.localeCompare(b.id))[0];
}

export function sortedPeriods(state: CloseState): PeriodRecord[] {
  return [...state.periods].sort((a, b) => b.id.localeCompare(a.id));
}

function addAudit(state: CloseState, action: string): void {
  state.audit = [
    { id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, at: nowStamp(), user: USUARIO.nombre, action },
    ...state.audit,
  ].slice(0, 60);
}

export function toggleCheck(state: CloseState, periodIdValue: string, checkId: string): CloseState {
  const next = structuredClone(state);
  const period = next.periods.find(item => item.id === periodIdValue);
  const check = period?.checks.find(item => item.id === checkId);
  if (!period || !check || check.automatico) return state;
  check.checked = !check.checked;
  addAudit(next, `Checklist ${periodIdValue}: ${check.label} ${check.checked ? 'marcado' : 'desmarcado'}`);
  return next;
}

export function generateClosing(state: CloseState, periodIdValue: string, user: string): CloseState {
  const next = structuredClone(state);
  const period = next.periods.find(item => item.id === periodIdValue);
  if (!period || period.closingEntry) return state;
  period.closingEntry = buildClosingEntry(periodIdValue, user);
  period.status = 'En cierre';
  addAudit(next, `Comprobante de cierre ${period.closingEntry.number} generado para ${period.label}`);
  return next;
}

export function blockingPending(period: PeriodRecord): PeriodCheck[] {
  return period.checks.filter(check => check.bloqueante && !check.checked);
}

export function canClose(period: PeriodRecord): boolean {
  return period.status !== 'Cerrado' && blockingPending(period).length === 0 && Boolean(period.closingEntry);
}

export function closePeriod(state: CloseState, periodIdValue: string, user: string, note: string): CloseState {
  const next = structuredClone(state);
  const period = next.periods.find(item => item.id === periodIdValue);
  if (!period || !canClose(period)) return state;

  period.status = 'Cerrado';
  period.closedAt = nowStamp();
  period.closedBy = user;
  period.note = note.trim();

  const nextRef = nextPeriod(period.year, period.month);
  const nextId = periodId(nextRef.year, nextRef.month);
  if (!next.periods.some(item => item.id === nextId)) {
    next.periods.push({
      id: nextId,
      year: nextRef.year,
      month: nextRef.month,
      label: periodLabel(nextRef.year, nextRef.month),
      status: 'Abierto',
      checks: checkTemplate(trialBalanceDifference(nextId) === 0),
      openingEntry: buildOpeningEntry(periodIdValue, user),
    });
  }

  addAudit(next, `Período ${period.label} cerrado con comprobante ${period.closingEntry?.number}`);
  addAudit(next, `Período ${periodLabel(nextRef.year, nextRef.month)} abierto con asiento de apertura`);
  return next;
}

export function reopenPeriod(state: CloseState, periodIdValue: string, user: string, note: string): CloseState {
  const next = structuredClone(state);
  const period = next.periods.find(item => item.id === periodIdValue);
  if (!period || period.status !== 'Cerrado') return state;

  const laterClosed = next.periods.some(item => item.id > periodIdValue && item.status === 'Cerrado');
  if (laterClosed) return state;

  next.periods = next.periods.filter(item => {
    if (item.id <= periodIdValue) return true;
    return Boolean(item.closingEntry);
  });

  period.status = 'Abierto';
  period.closingEntry = undefined;
  period.closedAt = undefined;
  period.closedBy = undefined;
  period.note = note.trim();

  addAudit(next, `Período ${period.label} reabierto. Motivo: ${note.trim() || 'sin nota'}`);
  return next;
}
