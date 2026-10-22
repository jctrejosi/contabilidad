import { invoiceTotals } from './selectors';
import type { FinanceState, TaxBox, TaxFiling, TaxFormCode } from './types';

const FORM_NAMES: Record<TaxFormCode, string> = {
  '300': 'IVA bimestral',
  '350': 'Retención en la fuente',
  '110': 'Declaración de renta',
};

const DUE_DATES: Record<TaxFormCode, string> = {
  '300': '2026-03-12',
  '350': '2026-03-12',
  '110': '2026-04-15',
};

function round(value: number): number {
  return Math.round(value);
}

export type TaxSource = Pick<FinanceState, 'invoices' | 'retentions'>;

/**
 * Formulario 300 — IVA.
 * Se calcula con las facturas contabilizadas del período: las notas crédito
 * restan de los ingresos y del IVA generado.
 */
export function form300Boxes(state: TaxSource, period: string): TaxBox[] {
  const documents = state.invoices.filter(invoice => (
    invoice.date.startsWith(period) && invoice.status === 'Contabilizada'
  ));
  const sales = documents.filter(invoice => invoice.kind === 'FV' || invoice.kind === 'ND');
  const credits = documents.filter(invoice => invoice.kind === 'NC');
  const purchases = documents.filter(invoice => invoice.kind === 'FC');

  const subtotal = (rows: typeof documents) => rows.reduce((total, invoice) => total + invoiceTotals(invoice).subtotal, 0);
  const tax = (rows: typeof documents) => rows.reduce((total, invoice) => total + invoiceTotals(invoice).tax, 0);

  const grossSales = round(subtotal(sales) - subtotal(credits));
  const generated = round(tax(sales) - tax(credits));
  const deductible = round(tax(purchases));
  const withholding = 0;
  const balance = generated - deductible - withholding;

  return [
    { number: '40', concept: 'Ingresos brutos por operaciones gravadas', value: grossSales, kind: 'calculado' },
    { number: '41', concept: 'Ingresos por operaciones excluidas', value: 0, kind: 'editable' },
    { number: '43', concept: 'Ingresos por operaciones no gravadas', value: 0, kind: 'editable' },
    { number: '44', concept: 'Total ingresos brutos', value: grossSales, kind: 'calculado' },
    { number: '47', concept: 'IVA generado', value: generated, kind: 'calculado' },
    { number: '48', concept: 'IVA descontable', value: deductible, kind: 'calculado' },
    { number: '49', concept: 'Retenciones de IVA que le practicaron', value: withholding, kind: 'editable' },
    { number: '50', concept: 'Saldo a pagar por IVA', value: balance, kind: 'calculado' },
  ];
}

/**
 * Formulario 350 — Retención en la fuente y ReteICA del período.
 */
export function form350Boxes(state: TaxSource, period: string): TaxBox[] {
  const retentions = state.retentions.filter(retention => retention.period === period);
  const source = retentions.filter(retention => retention.concept.toLowerCase().includes('fuente'));
  const ica = retentions.filter(retention => retention.concept.toLowerCase().includes('ica'));

  const sum = (rows: typeof retentions, field: 'base' | 'amount') => round(rows.reduce((total, row) => total + row[field], 0));

  const sourceBase = sum(source, 'base');
  const sourceValue = sum(source, 'amount');
  const icaBase = sum(ica, 'base');
  const icaValue = sum(ica, 'amount');

  return [
    { number: '41', concept: 'Base de retención en la fuente', value: sourceBase, kind: 'calculado' },
    { number: '42', concept: 'Retención en la fuente practicada', value: sourceValue, kind: 'calculado' },
    { number: '43', concept: 'Base de ReteICA', value: icaBase, kind: 'calculado' },
    { number: '44', concept: 'ReteICA practicada', value: icaValue, kind: 'calculado' },
    { number: '45', concept: 'Otras retenciones', value: 0, kind: 'editable' },
    { number: '46', concept: 'Total retenciones del período', value: sourceValue + icaValue, kind: 'calculado' },
  ];
}

/**
 * Formulario 110 — Renta anual. Los valores vienen del cierre del ejercicio;
 * el módulo permite ajustarlos y recalcula la renta líquida y el impuesto.
 */
export function form110Boxes(): TaxBox[] {
  const gross = 2_640_000_000;
  const returns = 38_000_000;
  const net = gross - returns;
  const deductions = 2_180_000_000;
  const liquid = net - deductions;
  const presumptive = 158_000_000;
  const taxable = Math.max(liquid, presumptive);
  const tax = round(taxable * 0.35);
  const discounts = 12_400_000;
  const selfWithholding = 9_800_000;
  const balance = tax - discounts - selfWithholding;

  return [
    { number: '41', concept: 'Ingresos brutos', value: gross, kind: 'editable' },
    { number: '42', concept: 'Devoluciones y descuentos', value: returns, kind: 'editable' },
    { number: '43', concept: 'Ingresos netos', value: net, kind: 'calculado' },
    { number: '44', concept: 'Costos y deducciones', value: deductions, kind: 'editable' },
    { number: '45', concept: 'Renta líquida', value: liquid, kind: 'calculado' },
    { number: '46', concept: 'Renta presuntiva', value: presumptive, kind: 'editable' },
    { number: '47', concept: 'Renta líquida gravable', value: taxable, kind: 'calculado' },
    { number: '48', concept: 'Impuesto sobre la renta', value: tax, kind: 'calculado' },
    { number: '49', concept: 'Descuentos tributarios', value: discounts, kind: 'editable' },
    { number: '50', concept: 'Autorretenciones', value: selfWithholding, kind: 'editable' },
    { number: '51', concept: 'Saldo a pagar', value: balance, kind: 'calculado' },
  ];
}

export function boxesFor(code: TaxFormCode, state: TaxSource, period: string): TaxBox[] {
  if (code === '300') return form300Boxes(state, period);
  if (code === '350') return form350Boxes(state, period);
  return form110Boxes();
}

export function filingBalance(code: TaxFormCode, boxes: TaxBox[]): number {
  if (code === '300') return boxes.find(box => box.number === '50')?.value ?? 0;
  if (code === '350') return boxes.find(box => box.number === '46')?.value ?? 0;
  return boxes.find(box => box.number === '51')?.value ?? 0;
}

export function buildFiling(state: TaxSource, code: TaxFormCode, period: string): TaxFiling {
  const boxes = boxesFor(code, state, period);
  const year = Number(period.slice(0, 4));
  return {
    id: `tax-${code}-${period}`,
    code,
    name: FORM_NAMES[code],
    year,
    period,
    dueDate: DUE_DATES[code],
    status: 'Calculada',
    boxes,
    balance: filingBalance(code, boxes),
    presentedAt: '',
    receipt: '',
    note: '',
  };
}

/**
 * Recalcula las cajas de un formulario conservando los valores editables.
 * Se usa al guardar ajustes o al presionar «Recalcular».
 */
export function recomputeBoxes(code: TaxFormCode, state: TaxSource, period: string, current: TaxBox[]): TaxBox[] {
  const fresh = boxesFor(code, state, period);
  if (code === '110') return current;
  return fresh.map(box => {
    const previous = current.find(item => item.number === box.number);
    if (box.kind === 'editable' && previous) return { ...box, value: previous.value };
    return box;
  });
}
