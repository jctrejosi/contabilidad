import { Badge, BarChart, Button, Card, DataTable, KpiCard, Money, SectionTitle } from '../../../components/finance/ui';
import type { FinanceState } from '../../../finance/types';
import { money, projectionTotals } from './shared';

export default function Escenarios({ state, onSetCurrent }: { state: FinanceState; onSetCurrent: (id: string) => void }) {
  const rows = state.projections.map(projection => ({
    id: projection.id,
    projection,
    totals: projectionTotals(projection),
  }));

  const bestRevenue = rows.reduce((best, row) => row.totals.revenue > best.totals.revenue ? row : best, rows[0]);
  const bestEbitda = rows.reduce((best, row) => row.totals.ebitda > best.totals.ebitda ? row : best, rows[0]);
  const spread = rows.length > 1 ? Math.max(...rows.map(row => row.totals.ebitda)) - Math.min(...rows.map(row => row.totals.ebitda)) : 0;

  if (rows.length === 0) {
    return <Card><p className="px-4 py-8 text-xs text-gray-500">No hay escenarios registrados.</p></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Escenarios" value={String(rows.length)} detail="Versiones comparables del año" tone="blue" />
        <KpiCard label="Mayor ingreso" value={<Money value={bestRevenue.totals.revenue} />} detail={bestRevenue.projection.name} tone="green" />
        <KpiCard label="Mayor EBITDA" value={<Money value={bestEbitda.totals.ebitda} />} detail={bestEbitda.projection.name} tone="cyan" />
        <KpiCard label="Diferencia de EBITDA" value={<Money value={spread} />} detail="Entre el mejor y el menor escenario" tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="EBITDA por escenario" detail="Resultado operativo anual de cada versión." />
          <div className="px-4 py-4">
            <BarChart
              data={rows.map(row => ({ label: row.projection.scenario, value: row.totals.ebitda }))}
              height={160}
              tone="green"
              formatter={value => `${Math.round(value / 1_000_000)} M`}
            />
          </div>
        </Card>

        <Card>
          <SectionTitle title="Lectura de escenarios" detail="Qué distingue a cada versión." />
          <div className="divide-y divide-gray-50">
            {rows.map(row => (
              <div key={row.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge tone={row.projection.scenario === 'Base' ? 'blue' : row.projection.scenario === 'Optimista' ? 'green' : 'amber'}>{row.projection.scenario}</Badge>
                    <span className="text-[11px] font-medium text-gray-800">{row.projection.name}</span>
                  </div>
                  {row.projection.current && <Badge tone="green">Vigente</Badge>}
                </div>
                <p className="mt-1 text-[10px] leading-4 text-gray-500">{row.projection.note}</p>
                {!row.projection.current && <Button size="sm" className="mt-2" onClick={() => onSetCurrent(row.projection.id)}>Marcar como vigente</Button>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Comparativo de escenarios" detail="Cifras anuales del año proyectado." />
        <DataTable
          rows={rows}
          rowKey={row => row.id}
          columns={[
            { header: 'Escenario', cell: row => <div><div className="font-medium text-gray-800">{row.projection.name}</div><div className="text-[9px] text-gray-400">{row.projection.scenario} · {row.projection.year}</div></div> },
            { header: 'Ingresos', align: 'right', cell: row => <Money value={row.totals.revenue} /> },
            { header: 'Costo de ventas', align: 'right', cell: row => <Money value={row.totals.cost} /> },
            { header: 'Gastos', align: 'right', cell: row => <Money value={row.totals.expense} /> },
            { header: 'EBITDA', align: 'right', cell: row => <span className="tabular font-semibold text-gray-800">{money(row.totals.ebitda)}</span> },
            { header: 'Margen', align: 'right', cell: row => <Badge tone={row.totals.margin >= 20 ? 'green' : row.totals.margin >= 10 ? 'amber' : 'red'}>{row.totals.margin.toFixed(1)} %</Badge> },
            { header: 'Caja libre', align: 'right', cell: row => <span className={row.totals.cash >= 0 ? 'tabular text-emerald-700' : 'tabular text-red-700'}>{money(row.totals.cash)}</span> },
          ]}
          footer={<div className="text-[11px] text-gray-600">La diferencia de EBITDA entre escenarios es de <strong className="tabular">{money(spread)}</strong>.</div>}
        />
      </Card>
    </div>
  );
}
