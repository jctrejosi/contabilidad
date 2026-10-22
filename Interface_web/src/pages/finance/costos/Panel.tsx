import { BarChart, Badge, Button, Card, DataTable, KpiCard, Money, Progress, SectionTitle } from '../../../components/finance/ui';
import type { NavPage } from '../../../components/Shell';
import type { FinanceState } from '../../../finance/types';
import {
  actualCost,
  allocatedForCenter,
  allocatedForPool,
  centerById,
  money,
  objectMargin,
  totalVariance,
} from './shared';

export default function Panel({ state, onNavigate }: { state: FinanceState; onNavigate: (page: NavPage) => void }) {
  const centers = state.costCenters.filter(center => center.status === 'Activo');
  const direct = centers.reduce((total, center) => total + center.directCost, 0);
  const cif = state.costPools.reduce((total, pool) => total + pool.amount, 0);
  const allocated = state.costAllocations.reduce((total, item) => total + item.amount, 0);
  const variance = state.costObjects.reduce((total, object) => total + totalVariance(object), 0);
  const revenue = state.costObjects.reduce((total, object) => total + object.revenue, 0);
  const actualTotal = state.costObjects.reduce((total, object) => total + actualCost(object), 0);
  const margin = revenue > 0 ? ((revenue - actualTotal) / revenue) * 100 : 0;
  const pendingPools = state.costPools.filter(pool => allocatedForPool(state, pool.id) < pool.amount);

  const centerRows = centers.map(center => ({
    id: center.id,
    center,
    direct: center.directCost,
    indirect: allocatedForCenter(state, center.id),
  }));

  const topObjects = [...state.costObjects]
    .sort((a, b) => actualCost(b) - actualCost(a))
    .slice(0, 5)
    .map(object => ({
      id: object.id,
      object,
      center: centerById(state, object.centerId),
      standard: object.standardQty * object.standardPrice * object.units,
      actual: actualCost(object),
      variance: totalVariance(object),
      margin: objectMargin(object),
    }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Costo total del período" value={<Money value={direct + cif} />} detail={`${centers.length} centros activos`} tone="blue" />
        <KpiCard label="CIF distribuido" value={<Money value={allocated} />} detail={`${state.costPools.length - pendingPools.length} de ${state.costPools.length} pools`} tone="cyan" />
        <KpiCard label="Variación neta" value={<Money value={variance} />} detail={variance > 0 ? 'Desfavorable frente al estándar' : 'Favorable frente al estándar'} tone={variance > 0 ? 'red' : 'green'} />
        <KpiCard label="Margen bruto" value={`${margin.toFixed(1)} %`} detail="Sobre el costo real del período" tone={margin >= 35 ? 'green' : 'amber'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <SectionTitle
            title="Costo por centro"
            detail="Costo directo más CIF asignado en el período."
            action={<Button size="sm" onClick={() => onNavigate('costos/reportes')}>Ver reportes</Button>}
          />
          <div className="px-4 py-4">
            <BarChart
              data={centerRows.map(row => ({ label: row.center.code.replace('CC-', ''), value: row.direct + row.indirect }))}
              height={150}
              tone="cyan"
              formatter={value => `${Math.round(value / 1_000_000)} M`}
            />
          </div>
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="space-y-2">
              {centerRows.map(row => {
                const total = row.direct + row.indirect;
                return (
                  <div key={row.id} className="flex items-center gap-3 text-[11px]">
                    <span className="w-24 shrink-0 font-medium text-gray-700">{row.center.name}</span>
                    <div className="flex-1"><Progress value={direct + cif > 0 ? (total / (direct + cif)) * 100 : 0} tone="cyan" label="" /></div>
                    <Money value={total} className="w-24 text-right text-gray-700" />
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Pendientes de distribución" detail="Pools de CIF sin asignar a los centros." />
          <div className="divide-y divide-gray-50">
            {pendingPools.length === 0 && <p className="px-4 py-6 text-xs text-gray-500">Todos los pools del período están distribuidos.</p>}
            {pendingPools.map(pool => {
              const assigned = allocatedForPool(state, pool.id);
              return (
                <div key={pool.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="text-xs font-medium text-gray-800">{pool.name}</div>
                    <div className="mt-0.5 text-[10px] text-gray-400">{pool.driver} · {pool.driverUnit}</div>
                  </div>
                  <div className="text-right">
                    <Money value={pool.amount - assigned} className="text-xs font-semibold text-amber-700" />
                    <div className="text-[10px] text-gray-400">de {money(pool.amount)}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-gray-100 px-4 py-3">
            <Button variant="primary" size="sm" onClick={() => onNavigate('costos/cif')}>Ir a distribución de CIF</Button>
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle
          title="Objetos de costo con mayor participación"
          detail="Costo real del período y variación frente al estándar."
          action={<Button size="sm" onClick={() => onNavigate('costos/estandar')}>Ver costeo estándar</Button>}
        />
        <DataTable
          rows={topObjects}
          rowKey={row => row.id}
          columns={[
            { header: 'Objeto', cell: row => <div><div className="font-medium text-gray-800">{row.object.name}</div><div className="text-[9px] text-gray-400">{row.object.code} · {row.center?.name ?? 'Sin centro'}</div></div> },
            { header: 'Tipo', cell: row => <Badge tone={row.object.kind === 'Proyecto' ? 'violet' : row.object.kind === 'Servicio' ? 'blue' : 'cyan'}>{row.object.kind}</Badge> },
            { header: 'Costo estándar', align: 'right', cell: row => <Money value={row.standard} /> },
            { header: 'Costo real', align: 'right', cell: row => <Money value={row.actual} /> },
            { header: 'Variación', align: 'right', cell: row => <span className={row.variance > 0 ? 'tabular font-semibold text-red-700' : 'tabular font-semibold text-emerald-700'}>{money(row.variance)}</span> },
            { header: 'Margen', align: 'right', cell: row => <span className={row.margin >= 35 ? 'tabular text-emerald-700' : 'tabular text-amber-700'}>{row.margin.toFixed(1)} %</span> },
          ]}
        />
      </Card>
    </div>
  );
}
