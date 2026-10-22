import { useState } from 'react';
import { Badge, Button, Card, DataTable, FilterSelect, KpiCard, Money, Progress, SectionTitle } from '../../../components/finance/ui';
import type { FinanceState } from '../../../finance/types';
import { loanSummary, money } from './shared';

export default function Amortizacion({
  state,
  onPay,
}: {
  state: FinanceState;
  onPay: (rowId: string) => void;
}) {
  const [loanId, setLoanId] = useState(state.loans[0]?.id ?? '');
  const loan = state.loans.find(item => item.id === loanId) ?? state.loans[0];

  if (!loan) {
    return <Card><p className="px-4 py-8 text-xs text-gray-500">Registre un préstamo para generar su calendario de amortización.</p></Card>;
  }

  const summary = loanSummary(state, loan);
  const paidInterest = summary.paidInterest;
  const totalInterest = summary.totalInterest;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Cuota fija" value={<Money value={summary.next?.payment ?? summary.rows[0]?.payment ?? 0} />} detail={`${loan.termMonths} cuotas mensuales`} tone="blue" />
        <KpiCard label="Intereses totales" value={<Money value={totalInterest} />} detail={`${loan.annualRate.toFixed(2)} % EA`} tone="amber" />
        <KpiCard label="Intereses pagados" value={<Money value={paidInterest} />} detail={`${summary.paid.length} cuotas pagadas`} tone="green" />
        <KpiCard label="Saldo de capital" value={<Money value={summary.balance} />} detail={`${summary.pending.length} cuotas pendientes`} tone="cyan" />
      </div>

      <Card>
        <SectionTitle
          title="Calendario de amortización"
          detail={`${loan.code} · ${loan.bank} · sistema francés con tasa efectiva anual.`}
          action={(
            <FilterSelect value={loan.id} onChange={event => setLoanId(event.target.value)}>
              {state.loans.map(item => <option key={item.id} value={item.id}>{item.code} · {item.bank}</option>)}
            </FilterSelect>
          )}
        />
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1"><Progress value={summary.progress} tone="blue" label={`Avance ${summary.paid.length} de ${summary.rows.length} cuotas`} /></div>
            <span className="text-[11px] text-gray-500">Desembolso: {loan.startDate}</span>
          </div>
        </div>
        <DataTable
          rows={summary.rows}
          rowKey={row => row.id}
          dense
          columns={[
            { header: '#', cell: row => <span className="tabular text-gray-500">{row.number}</span> },
            { header: 'Fecha', cell: row => <span className="tabular text-gray-700">{row.date}</span> },
            { header: 'Saldo inicial', align: 'right', cell: row => <Money value={row.opening} /> },
            { header: 'Cuota', align: 'right', cell: row => <span className="tabular font-semibold text-gray-800">{money(row.payment)}</span> },
            { header: 'Interés', align: 'right', cell: row => <span className="tabular text-amber-700">{money(row.interest)}</span> },
            { header: 'Capital', align: 'right', cell: row => <span className="tabular text-blue-700">{money(row.principal)}</span> },
            { header: 'Saldo final', align: 'right', cell: row => <Money value={row.closing} /> },
            { header: 'Estado', cell: row => <Badge tone={row.status === 'Pagado' ? 'green' : 'amber'}>{row.status}</Badge> },
            {
              header: '',
              align: 'right',
              cell: row => (
                <Button
                  size="sm"
                  variant={summary.next?.id === row.id ? 'primary' : 'secondary'}
                  disabled={row.status === 'Pagado' || summary.next?.id !== row.id}
                  onClick={() => onPay(row.id)}
                >
                  {row.status === 'Pagado' ? 'Pagada' : summary.next?.id === row.id ? 'Registrar pago' : 'Pendiente'}
                </Button>
              ),
            },
          ]}
          footer={<div className="flex items-center justify-between text-[11px] text-gray-600"><span>{summary.paid.length} pagadas · {summary.pending.length} pendientes</span><span className="tabular font-semibold">Intereses totales: {money(totalInterest)}</span></div>}
        />
      </Card>
    </div>
  );
}
