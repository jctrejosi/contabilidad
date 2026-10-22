import type {
  Asset,
  AssetCategory,
  AssetReconciliation,
  BudgetLine,
  BudgetVersion,
  FinanceState,
  Invoice,
  Payable,
  PaymentProposal,
  Receivable,
} from './types';

export const HOY = '2026-02-28';
export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export function money(value: number): string {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0);
}

export function compactMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$ ${(value / 1_000_000_000).toFixed(1)} mil M`;
  if (abs >= 1_000_000) return `$ ${(value / 1_000_000).toFixed(1)} M`;
  if (abs >= 1_000) return `$ ${(value / 1_000).toFixed(0)} K`;
  return money(value);
}

export function pct(value: number): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)} %`;
}

export function fmtDate(value: string): string {
  if (!value) return '—';
  const [y, m, d] = value.split('-');
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export function toDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);
}

export function daysOverdue(dueDate: string, today = HOY): number {
  return Math.max(0, daysBetween(dueDate, today));
}

export function addDays(value: string, days: number): string {
  const date = toDate(value);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function monthLabel(value: string): string {
  if (!value) return '—';
  const [, m] = value.split('-');
  return MESES[Number(m) - 1] ?? value;
}

export function invoiceTotals(invoice: Invoice) {
  let subtotal = 0;
  let discount = 0;
  let tax = 0;
  let withholding = 0;
  for (const line of invoice.lines) {
    const gross = line.quantity * line.price;
    const base = gross * (1 - line.discountPct / 100);
    subtotal += base;
    discount += gross - base;
    tax += base * (line.taxRate / 100);
    withholding += base * (line.withholdingRate / 100);
  }
  return {
    subtotal,
    discount,
    tax,
    withholding,
    total: subtotal + tax - withholding,
  };
}

export function partyOf(state: FinanceState, id: string) {
  return state.parties.find(party => party.id === id);
}

export function invoiceOf(state: FinanceState, id: string): Invoice | undefined {
  return state.invoices.find(invoice => invoice.id === id);
}

export function proposalTotal(state: FinanceState, proposal: PaymentProposal): number {
  return proposal.payableIds.reduce((total, id) => {
    const payable = state.payables.find(item => item.id === id);
    return total + (payable?.balance ?? 0);
  }, 0);
}

export function budgetAnnual(line: BudgetLine): number {
  return line.monthly.reduce((total, value) => total + value, 0);
}

export function budgetTotal(version: BudgetVersion): number {
  return version.lines.reduce((total, line) => total + budgetAnnual(line), 0);
}

export function budgetExecuted(version: BudgetVersion): number {
  return version.lines.reduce((total, line) => total + line.executed, 0);
}

export function budgetCommitted(version: BudgetVersion): number {
  return version.lines.reduce((total, line) => total + line.committed, 0);
}

export function budgetAvailable(version: BudgetVersion): number {
  return budgetTotal(version) - budgetExecuted(version) - budgetCommitted(version);
}

export function currentVersion(state: FinanceState): BudgetVersion | undefined {
  return state.budgets.find(version => version.current) ?? state.budgets[0];
}

export type AgingBucket = 'Corriente' | '1–30' | '31–60' | '61–90' | '+90';

export const AGING_BUCKETS: AgingBucket[] = ['Corriente', '1–30', '31–60', '61–90', '+90'];

export function agingBucket(dueDate: string, today = HOY): AgingBucket {
  const days = daysBetween(dueDate, today);
  if (days <= 0) return 'Corriente';
  if (days <= 30) return '1–30';
  if (days <= 60) return '31–60';
  if (days <= 90) return '61–90';
  return '+90';
}

export function receivableAging(rows: Receivable[]): Record<AgingBucket, number> {
  const result: Record<AgingBucket, number> = {
    Corriente: 0, '1–30': 0, '31–60': 0, '61–90': 0, '+90': 0,
  };
  for (const row of rows) {
    if (row.balance <= 0) continue;
    result[agingBucket(row.dueDate)] += row.balance;
  }
  return result;
}

export function payableAging(rows: Payable[]): Record<AgingBucket, number> {
  const result: Record<AgingBucket, number> = {
    Corriente: 0, '1–30': 0, '31–60': 0, '61–90': 0, '+90': 0,
  };
  for (const row of rows) {
    if (row.balance <= 0) continue;
    result[agingBucket(row.dueDate)] += row.balance;
  }
  return result;
}

export function statusTone(status: string): 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'cyan' {
  const value = status.toLowerCase();
  if (/(aceptad|aprobad|pagada|pagado|conciliad|cumplida|reembolsad|cerrada|activa|al día|vigente|contabilizada)/.test(value)) return 'green';
  if (/(rechaz|anulad|vencid|castigad|revertid|incumplid|diferencia|en disputa|sobre|bloque)/.test(value)) return 'red';
  if (/(pendiente|por enviar|por vencer|programad|revisión|acuerdo|sugerido|parcial|abierta|emitido|solicitado)/.test(value)) return 'amber';
  if (/(enviad|en propuesta|transferencia|recibo|pago|aplicad)/.test(value)) return 'blue';
  if (/(contingencia|nota|anticipo)/.test(value)) return 'violet';
  if (/(conciliad|validado)/.test(value)) return 'cyan';
  return 'gray';
}

export function shortName(name: string, max = 26): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

export function groupBy<T>(rows: T[], key: (row: T) => string): Record<string, T[]> {
  return rows.reduce<Record<string, T[]>>((acc, row) => {
    const value = key(row);
    acc[value] = acc[value] ?? [];
    acc[value].push(row);
    return acc;
  }, {});
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function periodOf(value: string): string {
  return value.slice(0, 7);
}

export function monthsBetweenPeriods(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split('-').map(Number);
  const [toYear, toMonth] = to.split('-').map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

export function addMonthsToPeriod(period: string, months: number): string {
  const [year, month] = period.split('-').map(Number);
  const total = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

export function periodLabel(period: string): string {
  const [year, month] = period.split('-');
  if (!year || !month) return period;
  return `${MESES[Number(month) - 1] ?? month} ${year}`;
}

export function assetGross(asset: Asset): number {
  return asset.acquisitionCost + asset.improvements + asset.revaluation;
}

export function assetNetBook(asset: Asset): number {
  return assetGross(asset) - asset.impairment - asset.accumulatedDepreciation;
}

export function assetDepreciableBase(asset: Asset): number {
  return Math.max(0, assetGross(asset) - asset.impairment - asset.residualValue);
}

export function assetRemainingMonths(asset: Asset): number {
  return Math.max(0, asset.usefulLifeMonths - asset.depreciatedMonths);
}

export function isAssetActive(asset: Asset): boolean {
  return asset.status !== 'Dado de baja' && asset.status !== 'Vendido';
}

export function assetIsFullyDepreciated(asset: Asset): boolean {
  return asset.usefulLifeMonths > 0 && asset.accumulatedDepreciation >= assetDepreciableBase(asset) - 1;
}

export function assetMonthlyDepreciation(asset: Asset, unitsThisPeriod = 0): number {
  if (!isAssetActive(asset) || asset.status === 'En montaje' || asset.usefulLifeMonths <= 0) return 0;
  if (assetIsFullyDepreciated(asset)) return 0;
  const net = assetNetBook(asset);
  const residual = asset.residualValue;
  const depreciable = Math.max(0, net - residual);
  if (depreciable <= 0) return 0;

  if (asset.method === 'Unidades de producción') {
    if (asset.estimatedUnits <= 0) return 0;
    return Math.min(depreciable, assetDepreciableBase(asset) * (unitsThisPeriod / asset.estimatedUnits));
  }

  if (asset.method === 'Saldos decrecientes') {
    const years = asset.usefulLifeMonths / 12;
    const gross = Math.max(1, assetGross(asset) - asset.impairment);
    const rate = residual > 0 && residual < gross ? 1 - Math.pow(residual / gross, 1 / years) : 2 / years;
    return Math.min(depreciable, net * (rate / 12));
  }

  const remaining = assetRemainingMonths(asset);
  if (remaining <= 0) return 0;
  return depreciable / remaining;
}

export function assetDepreciationPct(asset: Asset): number {
  const base = assetDepreciableBase(asset);
  if (base <= 0) return 0;
  return Math.min(100, (asset.accumulatedDepreciation / base) * 100);
}

export function assetProjection(asset: Asset, months = 12): { period: string; amount: number; accumulated: number }[] {
  const rows: { period: string; amount: number; accumulated: number }[] = [];
  const base = assetDepreciableBase(asset);
  let accumulated = asset.accumulatedDepreciation;
  let projectedMonths = asset.depreciatedMonths;
  let period = periodOf(HOY);
  for (let index = 0; index < months; index += 1) {
    period = addMonthsToPeriod(period, 1);
    const remaining = Math.max(0, asset.usefulLifeMonths - projectedMonths);
    let amount = 0;
    if (asset.usefulLifeMonths > 0 && remaining > 0 && isAssetActive(asset) && asset.status !== 'En montaje') {
      if (asset.method === 'Unidades de producción') {
        amount = (base - accumulated) / remaining;
      } else if (asset.method === 'Saldos decrecientes') {
        const years = asset.usefulLifeMonths / 12;
        const gross = Math.max(1, assetGross(asset) - asset.impairment);
        const rate = asset.residualValue > 0 && asset.residualValue < gross ? 1 - Math.pow(asset.residualValue / gross, 1 / years) : 2 / years;
        const net = assetGross(asset) - asset.impairment - accumulated;
        amount = Math.max(0, Math.min(net - asset.residualValue, net * (rate / 12)));
      } else {
        amount = Math.max(0, (assetGross(asset) - asset.impairment - asset.residualValue - accumulated) / remaining);
      }
    }
    accumulated += amount;
    projectedMonths += 1;
    rows.push({ period, amount, accumulated });
  }
  return rows;
}

export function assetTotals(assets: Asset[]) {
  const active = assets.filter(isAssetActive);
  return {
    count: active.length,
    gross: sum(active.map(assetGross)),
    accumulated: sum(active.map(asset => asset.accumulatedDepreciation)),
    impairment: sum(active.map(asset => asset.impairment)),
    revaluation: sum(active.map(asset => asset.revaluation)),
    net: sum(active.map(assetNetBook)),
    inService: active.filter(asset => asset.status === 'En operación').length,
    inAssembly: active.filter(asset => asset.status === 'En montaje').length,
    fullyDepreciated: active.filter(asset => asset.status === 'Totalmente depreciado' || assetIsFullyDepreciated(asset)).length,
  };
}

export function assetCategoryOf(categories: AssetCategory[], id: string): AssetCategory | undefined {
  return categories.find(category => category.id === id);
}

export function assetReconciliationValues(assets: Asset[], categoryId: string) {
  const rows = assets.filter(asset => asset.categoryId === categoryId && isAssetActive(asset));
  return {
    gross: sum(rows.map(assetGross)),
    accumulated: sum(rows.map(asset => asset.accumulatedDepreciation)),
    impairment: sum(rows.map(asset => asset.impairment)),
    net: sum(rows.map(assetNetBook)),
  };
}

export function assetReconciliationDifference(
  assets: Asset[],
  reconciliation: AssetReconciliation,
): number {
  const system = assetReconciliationValues(assets, reconciliation.categoryId);
  const ledgerNet = reconciliation.ledgerGross - reconciliation.ledgerAccumulated - reconciliation.ledgerImpairment;
  return ledgerNet - system.net;
}
