import { HOY, addDays, daysBetween, partyOf } from '../../../finance/selectors';
import type { FinanceState, Lease } from '../../../finance/types';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export interface FlowMovement {
  id: string;
  date: string;
  type: 'Entrada' | 'Salida';
  concept: string;
  party: string;
  account: string;
  amount: number;
}

export interface RealFlowRow {
  month: string;
  label: string;
  inflow: number;
  outflow: number;
  net: number;
  closing: number;
}

export interface ProjectedFlowRow {
  month: string;
  label: string;
  inflow: number;
  outflow: number;
  net: number;
  closing: number;
}

export interface ProjectedItem {
  id: string;
  date: string;
  party: string;
  concept: string;
  amount: number;
  overdue: boolean;
  source: string;
}

export interface LiquidityWeek {
  id: string;
  label: string;
  from: string;
  to: string;
  inflow: number;
  outflow: number;
  net: number;
  closing: number;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  return `${MONTHS[Number(month) - 1] ?? month} ${year.slice(2)}`;
}

export function yearMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);
}

/** Los próximos seis meses, empezando por el mes siguiente a HOY. */
export function projectedMonths(count = 6): string[] {
  const [year, month] = HOY.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month + index, 1));
    return date.toISOString().slice(0, 7);
  });
}

function monthDiff(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

function bucketFor(date: string, months: string[]): string {
  if (months.length === 0) return '';
  const key = date.slice(0, 7);
  if (key < months[0]) return months[0];
  if (key > months[months.length - 1]) return '';
  return key;
}

export function currentCash(state: FinanceState): { bank: number; petty: number; total: number } {
  const bank = state.accounts
    .filter(account => account.status === 'Activa')
    .reduce((total, account) => total + account.balance, 0);
  const petty = state.pettyCashes
    .filter(cash => cash.status === 'Abierta')
    .reduce((total, cash) => total + cash.balance, 0);
  return { bank, petty, total: bank + petty };
}

function accountLabel(state: FinanceState, id: string): string {
  const account = state.accounts.find(item => item.id === id);
  if (!account) return '—';
  return `${account.bank} · ${account.number}`;
}

/** Movimientos reales de caja: recibos, pagos, cheques cobrados y caja menor. */
export function realMovements(state: FinanceState): FlowMovement[] {
  const rows: FlowMovement[] = [];

  state.receipts.forEach(receipt => {
    rows.push({
      id: receipt.id,
      date: receipt.date,
      type: 'Entrada',
      concept: `Recibo ${receipt.number}`,
      party: partyOf(state, receipt.partyId)?.name ?? '—',
      account: accountLabel(state, receipt.accountId),
      amount: receipt.amount,
    });
  });

  state.payments
    .filter(payment => payment.status !== 'Anulado')
    .forEach(payment => {
      rows.push({
        id: payment.id,
        date: payment.date,
        type: 'Salida',
        concept: `Pago ${payment.number}`,
        party: partyOf(state, payment.partyId)?.name ?? '—',
        account: accountLabel(state, payment.accountId),
        amount: payment.amount,
      });
    });

  state.checks
    .filter(check => check.status === 'Cobrado')
    .forEach(check => {
      rows.push({
        id: check.id,
        date: check.dueDate,
        type: 'Salida',
        concept: `Cheque ${check.number}`,
        party: check.beneficiary,
        account: accountLabel(state, check.accountId),
        amount: check.amount,
      });
    });

  state.pettyCashes.forEach(cash => {
    cash.movements.forEach(movement => {
      rows.push({
        id: `${cash.id}-${movement.id}`,
        date: movement.date,
        type: movement.type === 'Ingreso' ? 'Entrada' : 'Salida',
        concept: `Caja menor · ${movement.concept}`,
        party: movement.responsible,
        account: cash.name,
        amount: movement.amount,
      });
    });
  });

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Flujo real mensual. El saldo de cierre del mes en curso se ancla al saldo
 * disponible actual y los demás meses se derivan del flujo neto.
 */
export function realFlow(state: FinanceState, year = Number(HOY.slice(0, 4))): RealFlowRow[] {
  const months = yearMonths(year);
  const movements = realMovements(state);
  const netByMonth = new Map(months.map(month => [month, 0]));

  movements.forEach(movement => {
    const key = movement.date.slice(0, 7);
    if (!netByMonth.has(key)) return;
    const signed = movement.type === 'Entrada' ? movement.amount : -movement.amount;
    netByMonth.set(key, (netByMonth.get(key) ?? 0) + signed);
  });

  const inflowByMonth = new Map(months.map(month => [month, 0]));
  const outflowByMonth = new Map(months.map(month => [month, 0]));
  movements.forEach(movement => {
    const key = movement.date.slice(0, 7);
    if (!netByMonth.has(key)) return;
    if (movement.type === 'Entrada') inflowByMonth.set(key, (inflowByMonth.get(key) ?? 0) + movement.amount);
    else outflowByMonth.set(key, (outflowByMonth.get(key) ?? 0) + movement.amount);
  });

  const closing = new Map<string, number>();
  const currentIndex = months.indexOf(HOY.slice(0, 7));
  const anchorIndex = currentIndex >= 0 ? currentIndex : months.length - 1;
  closing.set(months[anchorIndex], currentCash(state).total);

  for (let index = anchorIndex + 1; index < months.length; index += 1) {
    closing.set(months[index], (closing.get(months[index - 1]) ?? 0) + (netByMonth.get(months[index]) ?? 0));
  }
  for (let index = anchorIndex - 1; index >= 0; index -= 1) {
    closing.set(months[index], (closing.get(months[index + 1]) ?? 0) - (netByMonth.get(months[index + 1]) ?? 0));
  }

  return months
    .filter(month => month <= HOY.slice(0, 7))
    .map(month => ({
      month,
      label: monthLabel(month),
      inflow: inflowByMonth.get(month) ?? 0,
      outflow: outflowByMonth.get(month) ?? 0,
      net: netByMonth.get(month) ?? 0,
      closing: closing.get(month) ?? 0,
    }));
}

export function projectedInflows(state: FinanceState): ProjectedItem[] {
  return state.receivables
    .filter(receivable => receivable.balance > 0 && !['Pagada', 'Castigada', 'Revertida'].includes(receivable.status))
    .map(receivable => ({
      id: receivable.id,
      date: receivable.dueDate,
      party: partyOf(state, receivable.partyId)?.name ?? '—',
      concept: `Factura ${receivable.invoiceNumber}`,
      amount: receivable.balance,
      overdue: receivable.dueDate < HOY,
      source: 'Cartera',
    }));
}

export function projectedOutflows(state: FinanceState): ProjectedItem[] {
  const rows: ProjectedItem[] = [];

  state.payables
    .filter(payable => payable.balance > 0 && !['Pagada', 'Revertida'].includes(payable.status))
    .forEach(payable => {
      rows.push({
        id: payable.id,
        date: payable.dueDate,
        party: partyOf(state, payable.partyId)?.name ?? '—',
        concept: `Obligación ${payable.invoiceNumber}`,
        amount: payable.balance,
        overdue: payable.dueDate < HOY,
        source: 'CxP',
      });
    });

  state.amortization
    .filter(row => row.status === 'Pendiente')
    .forEach(row => {
      const loan = state.loans.find(item => item.id === row.loanId);
      rows.push({
        id: row.id,
        date: row.date,
        party: loan?.bank ?? '—',
        concept: `Cuota ${loan?.code ?? 'préstamo'} #${row.number}`,
        amount: row.payment,
        overdue: row.date < HOY,
        source: 'Deuda',
      });
    });

  projectedMonths().forEach(month => {
    const due = `${month}-01`;
    state.leases
      .filter(lease => lease.status === 'Vigente' && lease.startDate <= due && monthDiff(lease.startDate, due) < lease.termMonths)
      .forEach((lease: Lease) => {
        rows.push({
          id: `${lease.id}-${month}`,
          date: due,
          party: lease.lessor,
          concept: `Arrendamiento ${lease.code} · ${lease.assetName}`,
          amount: lease.monthlyPayment,
          overdue: false,
          source: 'Leasing',
        });
      });
  });

  state.expenses
    .filter(expense => expense.status === 'Aprobado')
    .forEach(expense => {
      rows.push({
        id: expense.id,
        date: expense.date,
        party: expense.employee,
        concept: `Reembolso ${expense.number} · ${expense.category}`,
        amount: expense.amount + expense.tax,
        overdue: expense.date < HOY,
        source: 'Gastos',
      });
    });

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export function projectedFlow(state: FinanceState): ProjectedFlowRow[] {
  const months = projectedMonths();
  const opening = currentCash(state).total;
  const inflows = projectedInflows(state);
  const outflows = projectedOutflows(state);
  let closing = opening;

  return months.map(month => {
    const inflow = inflows.filter(item => bucketFor(item.date, months) === month).reduce((total, item) => total + item.amount, 0);
    const outflow = outflows.filter(item => bucketFor(item.date, months) === month).reduce((total, item) => total + item.amount, 0);
    const net = inflow - outflow;
    closing += net;
    return { month, label: monthLabel(month), inflow, outflow, net, closing };
  });
}

function weeklyBucket(date: string, weeks: number): number {
  const difference = daysBetween(HOY, date);
  if (difference <= 0) return 0;
  return Math.min(weeks - 1, Math.floor(difference / 7));
}

export function liquidityWeeks(state: FinanceState, weeks = 4): LiquidityWeek[] {
  const horizon = addDays(HOY, weeks * 7);
  const inflows = projectedInflows(state).filter(item => item.date <= horizon);
  const outflows = projectedOutflows(state).filter(item => item.date <= horizon);
  const buckets = Array.from({ length: weeks }, () => ({ inflow: 0, outflow: 0 }));

  inflows.forEach(item => { buckets[weeklyBucket(item.date, weeks)].inflow += item.amount; });
  outflows.forEach(item => { buckets[weeklyBucket(item.date, weeks)].outflow += item.amount; });

  let closing = currentCash(state).total;
  return buckets.map((bucket, index) => {
    const net = bucket.inflow - bucket.outflow;
    closing += net;
    return {
      id: `week-${index}`,
      label: `Semana ${index + 1}`,
      from: addDays(HOY, index * 7),
      to: addDays(HOY, Math.min((index + 1) * 7, weeks * 7)),
      inflow: bucket.inflow,
      outflow: bucket.outflow,
      net,
      closing,
    };
  });
}

export function liquiditySnapshot(state: FinanceState) {
  const cash = currentCash(state);
  const horizon = addDays(HOY, 30);
  const inflows = projectedInflows(state).filter(item => item.date <= horizon).reduce((total, item) => total + item.amount, 0);
  const outflows = projectedOutflows(state).filter(item => item.date <= horizon).reduce((total, item) => total + item.amount, 0);
  const weeks = liquidityWeeks(state);
  const negativeWeeks = weeks.filter(week => week.closing < 0).length;
  return {
    cash,
    inflows,
    outflows,
    net: cash.total + inflows - outflows,
    coverage: outflows > 0 ? cash.total / outflows : 0,
    weeks,
    negativeWeeks,
  };
}
