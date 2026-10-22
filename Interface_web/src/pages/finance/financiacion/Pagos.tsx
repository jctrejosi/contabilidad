import { useState } from 'react';
import { Badge, Button, Card, DataTable, FilterBar, FilterSelect, KpiCard, Money, SectionTitle } from '../../../components/finance/ui';
import type { FinanceState } from '../../../finance/types';
import { money } from './shared';

export default function Pagos({ state, onPay }: { state: FinanceState; onPay: (rowId: string) => void }) {
  const [loanFilter, setLoanFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');

  const rows = state.amortization
    .filter(row => row.date.slice(0, 4) === '2026')
    .filter(row => loanFilter === 'Todos' || row.loanId === loanFilter)
    .filter(row => statusFilter === 'Todos' || row.status === statusFilter)
    .map(row => ({ id: row.id, row, loan: state.loans.find(loan => loan.id === row.loanId) }))
    .sort((a, b) => a.row.date.localeCompare(b.row.date));

  const yearRows = state.amortization.filter(row => row.date.slice(0, 4) === '2026');
  const paid = yearRows.filter(row => row.status === 'Pagado');
  const pending = yearRows.filter(row => row.status === 'Pendiente');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Pagos del año" value={String(yearRows.length)} detail="Cuotas programadas en 2026" tone="blue" />
        <KpiCard label="Capital pagado" value={<Money value={paid.reduce((total, row) => total + row.principal, 0)} />} detail={`${paid.length} cuotas pagadas`} tone="green" />
        <KpiCard label="Intereses pagados" value={<Money value={paid.reduce((total, row) => total + row.interest, 0)} />} detail="Gasto financiero causado" tone="amber" />
        <KpiCard label="Pendiente del año" value={<Money value={pending.reduce((total, row) => total + row.payment, 0)} />} detail={`${pending.length} cuotas por pagar`} tone="cyan" />
      </div>

      <Card>
        <SectionTitle title="Intereses y pagos" detail="Registro de cuotas del año con aplicación a capital e intereses." />
        <FilterBar>
          <FilterSelect value={loanFilter} onChange={event => setLoanFilter(event.target.value)}>
            <option value="Todos">Todos los préstamos</option>
            {state.loans.map(loan => <option key={loan.id} value={loan.id}>{loan.code} · {loan.bank}</option>)}
          </FilterSelect>
          <FilterSelect value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            {['Todos', 'Pendiente', 'Pagado'].map(value => <option key={value}>{value}</option>)}
          </FilterSelect>
        </FilterBar>
        <DataTable
          rows={rows}
          rowKey={row => row.id}
          dense
          columns={[
            { header: 'Fecha', cell: row => <span className="tabular text-gray-700">{row.row.date}</span> },
            { header: 'Préstamo', cell: row => <div><div className="font-medium text-gray-800">{row.loan?.code ?? '—'}</div><div className="text-[9px] text-gray-400">{row.loan?.bank ?? ''}</div></div> },
            { header: 'Cuota', cell: row => <span className="tabular text-gray-500">#{row.row.number}</span> },
            { header: 'Capital', align: 'right', cell: row => <Money value={row.row.principal} /> },
            { header: 'Interés', align: 'right', cell: row => <span className="tabular text-amber-700">{money(row.row.interest)}</span> },
            { header: 'Total', align: 'right', cell: row => <span className="tabular font-semibold text-gray-800">{money(row.row.payment)}</span> },
            { header: 'Estado', cell: row => <Badge tone={row.row.status === 'Pagado' ? 'green' : 'amber'}>{row.row.status}</Badge> },
            {
              header: '',
              align: 'right',
              cell: row => (
                <Button size="sm" disabled={row.row.status === 'Pagado'} onClick={() => onPay(row.row.id)}>
                  {row.row.status === 'Pagado' ? 'Pagada' : 'Registrar pago'}
                </Button>
              ),
            },
          ]}
          footer={<div className="flex items-center justify-between text-[11px] text-gray-600"><span>{rows.length} cuotas visibles</span><span className="tabular font-semibold">Total: {money(rows.reduce((total, row) => total + row.row.payment, 0))}</span></div>}
        />
      </Card>
    </div>
  );
}
