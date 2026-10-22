import { useState } from 'react';
import { Button, Field, INPUT, Modal } from '../../../components/finance/ui';
import { HOY } from '../../../finance/selectors';
import type { AmortizationRow, CreditLine, FinanceState, Loan, LoanStatus } from '../../../finance/types';

export interface FundingActions {
  createLoan: (draft: Loan) => void;
  registerPayment: (rowId: string) => void;
  cancelLoan: (loanId: string) => void;
  createCreditLine: (draft: CreditLine) => void;
  updateCreditLine: (id: string, patch: Partial<CreditLine>) => void;
  showToast: (message: string) => void;
}

export const LOAN_STATUS: LoanStatus[] = ['Vigente', 'Pagado', 'En mora', 'Cancelado'];

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
}

export function money(value: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

export function monthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate / 100, 1 / 12) - 1;
}

export function fixedPayment(principal: number, annualRate: number, termMonths: number): number {
  const rate = monthlyRate(annualRate);
  if (rate === 0) return principal / Math.max(1, termMonths);
  return (principal * rate) / (1 - Math.pow(1 + rate, -termMonths));
}

export function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(day, lastDay));
  return base.toISOString().slice(0, 10);
}

export function buildSchedule(loan: Loan): AmortizationRow[] {
  const rate = monthlyRate(loan.annualRate);
  const payment = fixedPayment(loan.principal, loan.annualRate, loan.termMonths);
  const rows: AmortizationRow[] = [];
  let opening = loan.principal;

  for (let index = 1; index <= loan.termMonths; index += 1) {
    const interest = Math.round(opening * rate);
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
      status: 'Pendiente',
    });
    opening = closing;
  }
  return rows;
}

export function loanRows(state: FinanceState, loanId: string): AmortizationRow[] {
  return state.amortization.filter(row => row.loanId === loanId).sort((a, b) => a.number - b.number);
}

export function loanSummary(state: FinanceState, loan: Loan) {
  const rows = loanRows(state, loan.id);
  const paid = rows.filter(row => row.status === 'Pagado');
  const pending = rows.filter(row => row.status === 'Pendiente');
  return {
    rows,
    paid,
    pending,
    paidPrincipal: paid.reduce((total, row) => total + row.principal, 0),
    paidInterest: paid.reduce((total, row) => total + row.interest, 0),
    totalInterest: rows.reduce((total, row) => total + row.interest, 0),
    balance: pending.length > 0 ? pending[0].opening : 0,
    next: pending[0],
    progress: rows.length > 0 ? (paid.length / rows.length) * 100 : 0,
  };
}

export function debtTotals(state: FinanceState) {
  const active = state.loans.filter(loan => loan.status === 'Vigente' || loan.status === 'En mora');
  let balance = 0;
  let current = 0;
  let monthly = 0;
  let interestYear = 0;
  const horizon = addMonths(HOY, 12);

  active.forEach(loan => {
    const summary = loanSummary(state, loan);
    balance += summary.balance;
    if (summary.next) monthly += summary.next.payment;
    summary.pending.forEach(row => {
      if (row.date.slice(0, 4) === '2026') interestYear += row.interest;
      if (row.date <= horizon) current += row.principal;
    });
  });

  return { balance, current, nonCurrent: Math.max(0, balance - current), monthly, interestYear, count: active.length };
}

export function maturityBuckets(state: FinanceState) {
  const buckets = new Map<string, number>();
  state.loans
    .filter(loan => loan.status === 'Vigente' || loan.status === 'En mora')
    .forEach(loan => {
      loanSummary(state, loan).pending.forEach(row => {
        const year = row.date.slice(0, 4);
        buckets.set(year, (buckets.get(year) ?? 0) + row.principal);
      });
    });
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([year, value]) => ({ year, value }));
}

function loanDraft(creditLines: CreditLine[], nextCode: string, loan?: Loan): Loan {
  return loan
    ? { ...loan }
    : {
        id: '',
        code: nextCode,
        bank: creditLines[0]?.bank ?? '',
        principal: 0,
        annualRate: creditLines[0]?.annualRate ?? 14,
        termMonths: 36,
        startDate: '2026-02-28',
        purpose: '',
        status: 'Vigente',
        creditLineId: creditLines[0]?.id ?? '',
        note: '',
      };
}

export function LoanEditor({
  loan,
  creditLines,
  nextCode,
  onClose,
  onSave,
}: {
  loan?: Loan;
  creditLines: CreditLine[];
  nextCode: string;
  onClose: () => void;
  onSave: (draft: Loan) => void;
}) {
  const [draft, setDraft] = useState<Loan>(() => loanDraft(creditLines, nextCode, loan));

  function patch(changes: Partial<Loan>) {
    setDraft(previous => ({ ...previous, ...changes }));
  }

  const payment = fixedPayment(draft.principal, draft.annualRate, draft.termMonths);
  const totalInterest = payment * draft.termMonths - draft.principal;
  const line = creditLines.find(item => item.id === draft.creditLineId);
  const exceeds = Boolean(line) && draft.principal > line!.approved - line!.used;
  const valid = draft.code.trim().length > 0 && draft.principal > 0 && draft.annualRate > 0 && draft.termMonths > 0 && !exceeds && Boolean(line);

  return (
    <Modal
      title={loan ? `Editar ${loan.code}` : 'Nuevo préstamo'}
      subtitle="El calendario de amortización se genera con el sistema francés y tasa efectiva anual."
      onClose={onClose}
      wide
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Código"><input className={INPUT} value={draft.code} onChange={event => patch({ code: event.target.value })} /></Field>
        <Field label="Cupo de crédito">
          <select
            className={INPUT}
            value={draft.creditLineId}
            onChange={event => {
              const selected = creditLines.find(item => item.id === event.target.value);
              patch({ creditLineId: event.target.value, bank: selected?.bank ?? draft.bank, annualRate: selected?.annualRate ?? draft.annualRate });
            }}
          >
            {creditLines.map(item => <option key={item.id} value={item.id}>{item.code} · {item.bank}</option>)}
          </select>
        </Field>
        <Field label="Entidad"><input className={INPUT} value={draft.bank} onChange={event => patch({ bank: event.target.value })} /></Field>
        <Field label="Destino"><input className={INPUT} value={draft.purpose} onChange={event => patch({ purpose: event.target.value })} /></Field>
        <Field label="Valor desembolsado"><input type="number" min={0} className={INPUT} value={draft.principal} onChange={event => patch({ principal: Number(event.target.value) })} /></Field>
        <Field label="Tasa efectiva anual (%)"><input type="number" min={0} step="0.01" className={INPUT} value={draft.annualRate} onChange={event => patch({ annualRate: Number(event.target.value) })} /></Field>
        <Field label="Plazo en meses"><input type="number" min={1} className={INPUT} value={draft.termMonths} onChange={event => patch({ termMonths: Number(event.target.value) })} /></Field>
        <Field label="Fecha de desembolso"><input type="date" className={INPUT} value={draft.startDate} onChange={event => patch({ startDate: event.target.value })} /></Field>
        <Field label="Estado">
          <select className={INPUT} value={draft.status} onChange={event => patch({ status: event.target.value as LoanStatus })}>
            {LOAN_STATUS.map(value => <option key={value}>{value}</option>)}
          </select>
        </Field>
        <Field label="Nota" className="sm:col-span-2"><input className={INPUT} value={draft.note} onChange={event => patch({ note: event.target.value })} /></Field>
      </div>

      {exceeds && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">El valor excede el cupo disponible de {line?.code}. Disponible: {money((line?.approved ?? 0) - (line?.used ?? 0))}.</p>}

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600 sm:grid-cols-4">
        <div><div className="text-gray-400">Cuota fija</div><div className="tabular font-semibold text-gray-800">{money(payment)}</div></div>
        <div><div className="text-gray-400">Intereses totales</div><div className="tabular font-semibold text-gray-800">{money(totalInterest)}</div></div>
        <div><div className="text-gray-400">Total a pagar</div><div className="tabular font-semibold text-gray-800">{money(draft.principal + totalInterest)}</div></div>
        <div><div className="text-gray-400">Cupo disponible</div><div className="tabular font-semibold text-gray-800">{money((line?.approved ?? 0) - (line?.used ?? 0))}</div></div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave({ ...draft, code: draft.code.trim() })}>
          {loan ? 'Guardar cambios' : 'Crear préstamo'}
        </Button>
      </div>
    </Modal>
  );
}

export function CreditLineEditor({
  line,
  nextCode,
  onClose,
  onSave,
}: {
  line?: CreditLine;
  nextCode: string;
  onClose: () => void;
  onSave: (draft: CreditLine) => void;
}) {
  const [draft, setDraft] = useState<CreditLine>(() => line ? { ...line } : {
    id: '',
    code: nextCode,
    bank: '',
    approved: 0,
    used: 0,
    annualRate: 14,
    expiresAt: '2027-12-31',
    status: 'Vigente',
  });

  function patch(changes: Partial<CreditLine>) {
    setDraft(previous => ({ ...previous, ...changes }));
  }

  const valid = draft.code.trim().length > 0 && draft.bank.trim().length > 0 && draft.approved > 0 && draft.used <= draft.approved;

  return (
    <Modal title={line ? `Editar ${line.code}` : 'Nuevo cupo de crédito'} subtitle="Cupo aprobado, utilizado y tasa de referencia." onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Código"><input className={INPUT} value={draft.code} onChange={event => patch({ code: event.target.value })} /></Field>
        <Field label="Entidad"><input className={INPUT} value={draft.bank} onChange={event => patch({ bank: event.target.value })} /></Field>
        <Field label="Cupo aprobado"><input type="number" min={0} className={INPUT} value={draft.approved} onChange={event => patch({ approved: Number(event.target.value) })} /></Field>
        <Field label="Valor utilizado"><input type="number" min={0} className={INPUT} value={draft.used} onChange={event => patch({ used: Number(event.target.value) })} /></Field>
        <Field label="Tasa efectiva anual (%)"><input type="number" min={0} step="0.01" className={INPUT} value={draft.annualRate} onChange={event => patch({ annualRate: Number(event.target.value) })} /></Field>
        <Field label="Vencimiento"><input type="date" className={INPUT} value={draft.expiresAt} onChange={event => patch({ expiresAt: event.target.value })} /></Field>
        <Field label="Estado">
          <select className={INPUT} value={draft.status} onChange={event => patch({ status: event.target.value as CreditLine['status'] })}>
            {['Vigente', 'Vencida', 'Cerrada'].map(value => <option key={value}>{value}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave({ ...draft, code: draft.code.trim(), bank: draft.bank.trim() })}>
          {line ? 'Guardar cambios' : 'Crear cupo'}
        </Button>
      </div>
    </Modal>
  );
}
