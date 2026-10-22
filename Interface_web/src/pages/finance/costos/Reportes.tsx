import { BarChart, Button, Card, DataTable, KpiCard, Money, Progress, SectionTitle } from '../../../components/finance/ui';
import type { FinanceState } from '../../../finance/types';
import type { CostActions } from './shared';
import { actualCost, allocatedForCenter, objectMargin, standardCost, totalVariance } from './shared';

export default function Reportes({ state, actions }: { state: FinanceState; actions: CostActions }) {
  const direct = state.costCenters.reduce((total, center) => total + center.directCost, 0);
  const cif = state.costPools.reduce((total, pool) => total + pool.amount, 0);
  const standard = state.costObjects.reduce((total, object) => total + standardCost(object), 0);
  const actual = state.costObjects.reduce((total, object) => total + actualCost(object), 0);
  const variance = actual - standard;
  const revenue = state.costObjects.reduce((total, object) => total + object.revenue, 0);

  const centerRows = state.costCenters.map(center => {
    const indirect = allocatedForCenter(state, center.id);
    return { id: center.id, center, indirect, total: center.directCost + indirect, share: direct + cif > 0 ? ((center.directCost + indirect) / (direct + cif)) * 100 : 0 };
  });

  const objectRows = state.costObjects.map(object => ({
    id: object.id,
    object,
    standard: standardCost(object),
    actual: actualCost(object),
    variance: totalVariance(object),
    margin: objectMargin(object),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Costo acumulado" value={<Money value={direct + cif} />} detail="Directo más CIF del período" tone="blue" />
        <KpiCard label="Costo estándar" value={<Money value={standard} />} detail="Base de comparación" tone="cyan" />
        <KpiCard label="Costo real" value={<Money value={actual} />} detail="Objetos de costo del período" tone="violet" />
        <KpiCard label="Variación neta" value={<Money value={variance} />} detail={variance > 0 ? 'Desfavorable' : 'Favorable'} tone={variance > 0 ? 'red' : 'green'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Margen por objeto de costo" detail="Porcentaje de margen sobre el costo real." action={<Button size="sm" onClick={() => actions.showToast('Reporte de márgenes exportado (simulación).')}>Exportar</Button>} />
          <div className="px-4 py-4">
            <BarChart
              data={objectRows.map(row => ({ label: row.object.code.replace('CO-00', 'CO'), value: Math.max(0, row.margin) }))}
              height={150}
              tone="green"
              formatter={value => `${value.toFixed(0)} %`}
            />
          </div>
        </Card>

        <Card>
          <SectionTitle title="Participación por centro" detail="Peso de cada centro en el costo total." />
          <div className="space-y-2 px-4 py-4">
            {centerRows.map(row => (
              <div key={row.id} className="flex items-center gap-3 text-[11px]">
                <span className="w-28 shrink-0 font-medium text-gray-700">{row.center.name}</span>
                <div className="flex-1"><Progress value={row.share} tone="cyan" label="" /></div>
                <Money value={row.total} className="w-24 text-right text-gray-700" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle
          title="Comparativo estándar vs. real"
          detail="Detalle que soporta el cierre de costos y la explicación de variaciones."
          action={<Button size="sm" onClick={() => actions.showToast('Comparativo de costos exportado (simulación).')}>Exportar comparativo</Button>}
        />
        <DataTable
          rows={objectRows}
          rowKey={row => row.id}
          columns={[
            { header: 'Objeto', cell: row => <div><div className="font-medium text-gray-800">{row.object.name}</div><div className="text-[9px] text-gray-400">{row.object.code} · {row.object.kind}</div></div> },
            { header: 'Unidades', align: 'right', cell: row => <span className="tabular">{row.object.units.toLocaleString('es-CO')}</span> },
            { header: 'Costo estándar', align: 'right', cell: row => <Money value={row.standard} /> },
            { header: 'Costo real', align: 'right', cell: row => <Money value={row.actual} /> },
            { header: 'Variación', align: 'right', cell: row => <span className={row.variance > 0 ? 'tabular font-semibold text-red-700' : 'tabular font-semibold text-emerald-700'}>{row.variance.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> },
            { header: 'Margen', align: 'right', cell: row => <span className={row.margin >= 35 ? 'tabular text-emerald-700' : 'tabular text-amber-700'}>{row.margin.toFixed(1)} %</span> },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle title="Resumen ejecutivo" detail={`Ingresos del período ${revenue.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })} · costo real ${actual.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}`} />
        <p className="px-4 py-4 text-[11px] leading-5 text-gray-600">
          El período cierra con una variación neta {variance > 0 ? 'desfavorable' : 'favorable'} de {Math.abs(variance).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })},
          equivalente a {standard > 0 ? Math.abs((variance / standard) * 100).toFixed(1) : '0.0'} % del costo estándar. La variación se explica por precio de compra y por consumo de cantidades;
          el detalle por objeto permite dirigir la revisión a los productos con mayor desviación antes del cierre contable.
        </p>
      </Card>
    </div>
  );
}
