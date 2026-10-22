import { useState } from 'react';
import { Badge, Button, Card, DataTable, KpiCard, Money, Progress, SearchInput, SectionTitle } from '../../../components/finance/ui';
import type { NavPage } from '../../../components/Shell';
import type { FinanceState } from '../../../finance/types';
import { debtTotals, loanSummary, money } from './shared';

export default function Prestamos({
  state,
  onCreate,
  onCancel,
  onNavigate,
}: {
  state: FinanceState;
  onCreate: () => void;
  onCancel: (loanId: string) => void;
  onNavigate: (page: NavPage) => void;
}) {
  const [query, setQuery] = useState('');
  const totals = debtTotals(state);

  const rows = state.loans
    .filter(loan => `${loan.code} ${loan.bank} ${loan.purpose}`.toLowerCase().includes(query.toLowerCase()))
    .map(loan => {
      const summary = loanSummary(state, loan);
      return { id: loan.id, loan, summary };
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Préstamos registrados" value={String(state.loans.length)} detail={`${totals.count} vigentes`} tone="blue" />
        <KpiCard label="Capital desembolsado" value={<Money value={state.loans.reduce((total, loan) => total + loan.principal, 0)} />} detail="Histórico" />
        <KpiCard label="Saldo de capital" value={<Money value={totals.balance} />} detail="Pendiente de amortizar" tone="cyan" />
        <KpiCard label="Cuota mensual" value={<Money value={totals.monthly} />} detail="Obligación del mes" tone="amber" />
      </div>

      <Card>
        <SectionTitle
          title="Préstamos bancarios"
          detail="Cada préstamo genera su calendario de amortización en el momento del registro."
          action={<Button variant="primary" size="sm" onClick={onCreate}>Nuevo préstamo</Button>}
        />
        <div className="border-b border-gray-100 px-4 py-3">
          <SearchInput placeholder="Buscar código, banco o destino…" value={query} onChange={event => setQuery(event.target.value)} />
        </div>
        <DataTable
          rows={rows}
          rowKey={row => row.id}
          columns={[
            { header: 'Préstamo', cell: row => <div><div className="font-medium text-gray-800">{row.loan.code}</div><div className="text-[9px] text-gray-400">{row.loan.purpose || 'Sin destino'}</div></div> },
            { header: 'Entidad', cell: row => <span className="text-gray-700">{row.loan.bank}</span> },
            { header: 'Desembolso', align: 'right', cell: row => <Money value={row.loan.principal} /> },
            { header: 'Tasa EA', align: 'right', cell: row => <span className="tabular">{row.loan.annualRate.toFixed(2)} %</span> },
            { header: 'Plazo', align: 'right', cell: row => <span className="tabular">{row.loan.termMonths} meses</span> },
            { header: 'Saldo', align: 'right', cell: row => <span className="tabular font-semibold text-gray-800">{money(row.summary.balance)}</span> },
            { header: 'Avance', cell: row => <div className="min-w-28"><Progress value={row.summary.progress} tone={row.summary.progress >= 100 ? 'green' : 'blue'} label={`${row.summary.paid.length}/${row.summary.rows.length}`} /></div> },
            { header: 'Próxima cuota', cell: row => row.summary.next ? <div><div className="tabular text-gray-700">{row.summary.next.date}</div><div className="text-[9px] text-gray-400">{money(row.summary.next.payment)}</div></div> : <span className="text-gray-400">Sin cuotas</span> },
            { header: 'Estado', cell: row => <Badge tone={row.loan.status === 'Vigente' ? 'green' : row.loan.status === 'En mora' ? 'red' : row.loan.status === 'Pagado' ? 'blue' : 'gray'}>{row.loan.status}</Badge> },
            {
              header: '',
              align: 'right',
              cell: row => (
                <div className="flex justify-end gap-1">
                  <Button size="sm" onClick={() => onNavigate('financiacion/amortizacion')}>Calendario</Button>
                  {row.loan.status === 'Vigente' && <Button size="sm" variant="danger" onClick={() => onCancel(row.loan.id)}>Cancelar</Button>}
                </div>
              ),
            },
          ]}
          footer={<div className="flex items-center justify-between text-[11px] text-gray-600"><span>{rows.length} préstamos visibles</span><span className="tabular font-semibold">Saldo: {money(rows.reduce((total, row) => total + row.summary.balance, 0))}</span></div>}
        />
      </Card>
    </div>
  );
}
