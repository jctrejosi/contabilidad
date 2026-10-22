import { BarChart, Badge, Button, Card, DataTable, KpiCard, Money, Progress, SectionTitle } from '../../../components/finance/ui';
import type { NavPage } from '../../../components/Shell';
import type { FinanceState } from '../../../finance/types';
import { debtTotals, loanSummary, maturityBuckets, money } from './shared';

export default function Panel({ state, onNavigate }: { state: FinanceState; onNavigate: (page: NavPage) => void }) {
  const totals = debtTotals(state);
  const approved = state.creditLines.filter(line => line.status === 'Vigente').reduce((total, line) => total + line.approved, 0);
  const used = state.creditLines.filter(line => line.status === 'Vigente').reduce((total, line) => total + line.used, 0);

  const byBank = Object.entries(
    state.loans.reduce<Record<string, number>>((accumulator, loan) => {
      if (loan.status !== 'Vigente' && loan.status !== 'En mora') return accumulator;
      accumulator[loan.bank] = (accumulator[loan.bank] ?? 0) + loanSummary(state, loan).balance;
      return accumulator;
    }, {}),
  ).map(([bank, value]) => ({ bank, value }));

  const nextPayments = state.loans
    .filter(loan => loan.status === 'Vigente' || loan.status === 'En mora')
    .flatMap(loan => loanSummary(state, loan).pending.slice(0, 3).map(row => ({ id: row.id, row, loan })))
    .sort((a, b) => a.row.date.localeCompare(b.row.date))
    .slice(0, 6);

  const buckets = maturityBuckets(state);
  const maxBucket = Math.max(1, ...buckets.map(bucket => bucket.value));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Deuda financiera" value={<Money value={totals.balance} />} detail={`${totals.count} préstamos vigentes`} tone="blue" />
        <KpiCard label="Cuota mensual" value={<Money value={totals.monthly} />} detail="Capital más intereses" tone="cyan" />
        <KpiCard label="Intereses del año" value={<Money value={totals.interestYear} />} detail="Causados en 2026" tone="amber" />
        <KpiCard label="Cupo disponible" value={<Money value={approved - used} />} detail={`De ${money(approved)} aprobados`} tone="green" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Deuda por entidad" detail="Saldo de capital pendiente por banco." action={<Button size="sm" onClick={() => onNavigate('financiacion/reportes')}>Ver reportes</Button>} />
          <div className="px-4 py-4">
            <BarChart data={byBank.map(item => ({ label: item.bank.split(' ')[0], value: item.value }))} height={150} tone="blue" formatter={value => `${Math.round(value / 1_000_000)} M`} />
          </div>
        </Card>

        <Card>
          <SectionTitle title="Perfil de vencimientos" detail="Capital por vencer según el año de la cuota." />
          <div className="space-y-3 px-4 py-4">
            {buckets.map(bucket => (
              <div key={bucket.year} className="text-[11px]">
                <div className="mb-1 flex justify-between"><span className="font-medium text-gray-700">{bucket.year}</span><Money value={bucket.value} className="text-gray-600" /></div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${(bucket.value / maxBucket) * 100}%` }} /></div>
              </div>
            ))}
            {buckets.length === 0 && <p className="text-xs text-gray-500">No hay cuotas pendientes.</p>}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle
          title="Próximos pagos"
          detail="Cuotas pendientes ordenadas por fecha."
          action={<Button size="sm" variant="primary" onClick={() => onNavigate('financiacion/pagos')}>Registrar pago</Button>}
        />
        <DataTable
          rows={nextPayments}
          rowKey={row => row.id}
          dense
          columns={[
            { header: 'Préstamo', cell: item => <div><div className="font-medium text-gray-800">{item.loan.code}</div><div className="text-[9px] text-gray-400">{item.loan.bank}</div></div> },
            { header: 'Cuota', cell: item => <span className="tabular">#{item.row.number}</span> },
            { header: 'Vencimiento', cell: item => <span className="tabular text-gray-600">{item.row.date}</span> },
            { header: 'Capital', align: 'right', cell: item => <Money value={item.row.principal} /> },
            { header: 'Interés', align: 'right', cell: item => <Money value={item.row.interest} /> },
            { header: 'Cuota total', align: 'right', cell: item => <span className="tabular font-semibold text-gray-800">{money(item.row.payment)}</span> },
            { header: 'Estado', cell: item => <Badge tone={item.row.status === 'Pagado' ? 'green' : 'amber'}>{item.row.status}</Badge> },
          ]}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Composición de la deuda" detail="Porción corriente y no corriente." />
          <div className="space-y-4 px-4 py-4">
            <div>
              <div className="mb-1 flex justify-between text-[11px]"><span className="text-gray-600">Corriente · próximos 12 meses</span><Money value={totals.current} className="font-semibold text-gray-800" /></div>
              <Progress value={totals.balance > 0 ? (totals.current / totals.balance) * 100 : 0} tone="amber" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-[11px]"><span className="text-gray-600">No corriente</span><Money value={totals.nonCurrent} className="font-semibold text-gray-800" /></div>
              <Progress value={totals.balance > 0 ? (totals.nonCurrent / totals.balance) * 100 : 0} tone="blue" />
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Cupos de crédito" detail="Uso de las líneas aprobadas." action={<Button size="sm" onClick={() => onNavigate('financiacion/cupos')}>Ver cupos</Button>} />
          <div className="divide-y divide-gray-50">
            {state.creditLines.map(line => (
              <div key={line.id} className="px-4 py-3">
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="font-medium text-gray-700">{line.bank} <span className="text-gray-400">{line.code}</span></span>
                  <Badge tone={line.status === 'Vigente' ? 'green' : line.status === 'Vencida' ? 'red' : 'gray'}>{line.status}</Badge>
                </div>
                <Progress value={line.approved > 0 ? (line.used / line.approved) * 100 : 0} tone={line.used / Math.max(1, line.approved) > 0.8 ? 'amber' : 'blue'} label={`${money(line.used)} de ${money(line.approved)}`} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
