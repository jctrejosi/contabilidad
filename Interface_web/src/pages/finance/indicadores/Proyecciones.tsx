import { useState } from 'react';
import { Badge, BarChart, Button, Card, DataTable, FilterSelect, KpiCard, Money, SectionTitle } from '../../../components/finance/ui';
import type { FinanceState } from '../../../finance/types';
import { lineTotal, money, monthlyProjection, projectionTotals } from './shared';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const compact = (value: number) => Math.round(value / 1_000_000).toLocaleString('es-CO');

export default function Proyecciones({
  state,
  onCreate,
  onSetCurrent,
}: {
  state: FinanceState;
  onCreate: () => void;
  onSetCurrent: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState(state.projections.find(projection => projection.current)?.id ?? state.projections[0]?.id ?? '');
  const projection = state.projections.find(item => item.id === selectedId) ?? state.projections[0];

  if (!projection) {
    return <Card><p className="px-4 py-8 text-xs text-gray-500">Cree una proyección para comenzar el análisis.</p></Card>;
  }

  const totals = projectionTotals(projection);
  const monthly = monthlyProjection(projection);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Ingresos del año" value={<Money value={totals.revenue} />} detail={`${projection.year} · ${projection.scenario}`} tone="blue" />
        <KpiCard label="Costo y gastos" value={<Money value={totals.cost + totals.expense} />} detail={`Costo ${((totals.cost / Math.max(1, totals.revenue)) * 100).toFixed(1)} % de ingresos`} tone="amber" />
        <KpiCard label="EBITDA" value={<Money value={totals.ebitda} />} detail={`Margen ${totals.margin.toFixed(1)} %`} tone="green" />
        <KpiCard label="Caja libre" value={<Money value={totals.cash} />} detail="Después de inversión" tone={totals.cash >= 0 ? 'cyan' : 'red'} />
      </div>

      <Card>
        <SectionTitle
          title="Proyección financiera"
          detail="Cifras mensuales en millones de pesos colombianos."
          action={(
            <div className="flex items-center gap-2">
              <FilterSelect value={projection.id} onChange={event => setSelectedId(event.target.value)}>
                {state.projections.map(item => <option key={item.id} value={item.id}>{item.name} · {item.scenario}</option>)}
              </FilterSelect>
              <Button size="sm" variant="primary" onClick={onCreate}>Nueva proyección</Button>
            </div>
          )}
        />
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
          <Badge tone={projection.scenario === 'Base' ? 'blue' : projection.scenario === 'Optimista' ? 'green' : 'amber'}>{projection.scenario}</Badge>
          {projection.current && <Badge tone="green">Vigente</Badge>}
          {!projection.current && <Button size="sm" onClick={() => onSetCurrent(projection.id)}>Marcar como vigente</Button>}
          <span className="text-[11px] text-gray-500">{projection.note}</span>
        </div>

        <div className="grid gap-4 px-4 py-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-[11px] font-medium text-gray-600">Ingresos mensuales</div>
            <BarChart data={monthly.map(item => ({ label: MONTHS[item.index], value: item.revenue }))} height={130} tone="blue" formatter={value => `${Math.round(value / 1_000_000)} M`} />
          </div>
          <div>
            <div className="mb-2 text-[11px] font-medium text-gray-600">Caja libre mensual</div>
            <BarChart data={monthly.map(item => ({ label: MONTHS[item.index], value: item.cash }))} height={130} tone={totals.cash >= 0 ? 'cyan' : 'red'} formatter={value => `${Math.round(value / 1_000_000)} M`} />
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Detalle mensual" detail="Ingresos, costos, gastos, depreciación e inversión por cuenta." />
        <div className="overflow-x-auto">
          <DataTable
            rows={projection.lines}
            rowKey={line => line.id}
            dense
            columns={[
              { header: 'Cuenta', cell: line => <div><div className="font-medium text-gray-800">{line.accountName}</div><div className="text-[9px] text-gray-400">{line.account} · {line.type}</div></div>, width: '200px' },
              ...MONTHS.map((month, index) => ({
                header: month,
                align: 'right' as const,
                cell: (line: typeof projection.lines[number]) => <span className="tabular text-[10px] text-gray-600">{compact(line.monthly[index] ?? 0)}</span>,
              })),
              { header: 'Total', align: 'right' as const, cell: (line: typeof projection.lines[number]) => <span className="tabular text-[10px] font-semibold text-gray-800">{compact(lineTotal(line))}</span> },
            ]}
          />
        </div>
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-[11px] text-gray-600">
          Total ingresos: <strong className="tabular">{money(totals.revenue)}</strong> · Total costo y gasto: <strong className="tabular">{money(totals.cost + totals.expense)}</strong> · Caja libre: <strong className="tabular">{money(totals.cash)}</strong>
        </div>
      </Card>
    </div>
  );
}
