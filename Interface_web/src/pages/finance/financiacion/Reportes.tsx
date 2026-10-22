import { Button, Card, DataTable, KpiCard, Money, Progress, SectionTitle } from '../../../components/finance/ui';
import type { FinanceState } from '../../../finance/types';
import { debtTotals, loanSummary, maturityBuckets, money } from './shared';

export default function Reportes({ state, onExport }: { state: FinanceState; onExport: () => void }) {
  const totals = debtTotals(state);

  const byBank = Object.values(
    state.loans
      .filter(loan => loan.status === 'Vigente' || loan.status === 'En mora')
      .reduce<Record<string, { bank: string; loans: number; principal: number; balance: number; interest: number }>>((accumulator, loan) => {
        const summary = loanSummary(state, loan);
        const current = accumulator[loan.bank] ?? { bank: loan.bank, loans: 0, principal: 0, balance: 0, interest: 0 };
        current.loans += 1;
        current.principal += loan.principal;
        current.balance += summary.balance;
        current.interest += summary.pending.reduce((total, row) => total + row.interest, 0);
        accumulator[loan.bank] = current;
        return accumulator;
      }, {}),
  ).sort((a, b) => b.balance - a.balance);

  const weightedRate = totals.balance > 0
    ? state.loans
        .filter(loan => loan.status === 'Vigente' || loan.status === 'En mora')
        .reduce((total, loan) => total + loanSummary(state, loan).balance * loan.annualRate, 0) / totals.balance
    : 0;

  const maturity = maturityBuckets(state);

  const interestRows = state.loans
    .filter(loan => loan.status === 'Vigente' || loan.status === 'En mora')
    .map(loan => {
      const summary = loanSummary(state, loan);
      return {
        id: loan.id,
        loan,
        balance: summary.balance,
        interest: summary.pending.reduce((total, row) => total + row.interest, 0),
        paidInterest: summary.paidInterest,
        totalInterest: summary.totalInterest,
        rate: loan.annualRate,
      };
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Deuda total" value={<Money value={totals.balance} />} detail={`Tasa promedio ${weightedRate.toFixed(2)} % EA`} tone="blue" />
        <KpiCard label="Porción corriente" value={<Money value={totals.current} />} detail="Capital a 12 meses" tone="amber" />
        <KpiCard label="Porción no corriente" value={<Money value={totals.nonCurrent} />} detail="Más de 12 meses" tone="cyan" />
        <KpiCard label="Intereses proyectados" value={<Money value={interestRows.reduce((total, row) => total + row.interest, 0)} />} detail="Saldo pendiente" tone="violet" />
      </div>

      <Card>
        <SectionTitle
          title="Deuda por entidad"
          detail="Participación de cada banco en el saldo de capital."
          action={<Button size="sm" onClick={onExport}>Exportar</Button>}
        />
        <div className="space-y-3 px-4 py-4">
          {byBank.map(row => (
            <div key={row.bank} className="text-[11px]">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-gray-700">{row.bank} <span className="text-gray-400">· {row.loans} préstamo(s)</span></span>
                <Money value={row.balance} className="text-gray-700" />
              </div>
              <Progress value={totals.balance > 0 ? (row.balance / totals.balance) * 100 : 0} tone="blue" label="" />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Perfil de vencimientos" detail="Capital e intereses por año de pago." />
        <DataTable
          rows={state.loans
            .filter(loan => loan.status === 'Vigente' || loan.status === 'En mora')
            .flatMap(loan => loanSummary(state, loan).pending)
            .reduce<Array<{ year: string; principal: number; interest: number }>>((accumulator, row) => {
              const year = row.date.slice(0, 4);
              const current = accumulator.find(item => item.year === year);
              if (current) {
                current.principal += row.principal;
                current.interest += row.interest;
              } else {
                accumulator.push({ year, principal: row.principal, interest: row.interest });
              }
              return accumulator;
            }, [])
            .sort((a, b) => a.year.localeCompare(b.year))}
          rowKey={row => row.year}
          columns={[
            { header: 'Año', cell: row => <span className="font-medium text-gray-800">{row.year}</span> },
            { header: 'Capital', align: 'right', cell: row => <Money value={row.principal} /> },
            { header: 'Intereses', align: 'right', cell: row => <Money value={row.interest} /> },
            { header: 'Total a pagar', align: 'right', cell: row => <span className="tabular font-semibold text-gray-800">{money(row.principal + row.interest)}</span> },
          ]}
          footer={<div className="text-[11px] text-gray-600">Capital por vencer: <strong className="tabular">{money(maturity.reduce((total, bucket) => total + bucket.value, 0))}</strong></div>}
        />
      </Card>

      <Card>
        <SectionTitle title="Intereses por préstamo" detail="Costo financiero pendiente y causado." />
        <DataTable
          rows={interestRows}
          rowKey={row => row.id}
          dense
          columns={[
            { header: 'Préstamo', cell: row => <div><div className="font-medium text-gray-800">{row.loan.code}</div><div className="text-[9px] text-gray-400">{row.loan.bank}</div></div> },
            { header: 'Saldo', align: 'right', cell: row => <Money value={row.balance} /> },
            { header: 'Tasa EA', align: 'right', cell: row => <span className="tabular">{row.rate.toFixed(2)} %</span> },
            { header: 'Interés pagado', align: 'right', cell: row => <span className="tabular text-emerald-700">{money(row.paidInterest)}</span> },
            { header: 'Interés pendiente', align: 'right', cell: row => <span className="tabular text-amber-700">{money(row.interest)}</span> },
            { header: 'Interés total', align: 'right', cell: row => <span className="tabular font-semibold text-gray-800">{money(row.totalInterest)}</span> },
          ]}
        />
      </Card>
    </div>
  );
}
