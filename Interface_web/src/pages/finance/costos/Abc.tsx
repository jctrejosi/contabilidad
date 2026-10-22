import { Badge, Button, Card, DataTable, KpiCard, Money, SectionTitle } from '../../../components/finance/ui';
import type { FinanceState } from '../../../finance/types';
import { actualCost, centerById, money } from './shared';

export default function Abc({ state, onRun }: { state: FinanceState; onRun: () => void }) {
  const activities = state.costActivities.map(activity => ({
    id: activity.id,
    activity,
    center: centerById(state, activity.centerId),
    rate: activity.driverQty > 0 ? activity.totalCost / activity.driverQty : 0,
  }));

  const totalCost = state.costActivities.reduce((total, activity) => total + activity.totalCost, 0);

  const byCenter = state.costCenters.map(center => {
    const cost = state.costActivities
      .filter(activity => activity.centerId === center.id)
      .reduce((total, activity) => total + activity.totalCost, 0);
    const objects = state.costObjects.filter(object => object.centerId === center.id);
    const base = objects.reduce((total, object) => total + actualCost(object), 0);
    return { center, cost, objects, base };
  }).filter(row => row.cost > 0 || row.objects.length > 0);

  const objectRows = byCenter.flatMap(row => row.objects.map(object => {
    const share = row.base > 0 ? actualCost(object) / row.base : 0;
    return {
      id: object.id,
      object,
      center: row.center,
      share,
      assigned: row.cost * share,
      unit: object.units > 0 ? (row.cost * share) / object.units : 0,
    };
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Actividades" value={String(state.costActivities.length)} detail="Centros de actividad del período" tone="violet" />
        <KpiCard label="Costo por actividades" value={<Money value={totalCost} />} detail="Acumulado ABC" tone="blue" />
        <KpiCard label="Objetos asignados" value={String(objectRows.length)} detail="Productos, servicios y proyectos" tone="cyan" />
        <KpiCard label="Corridas ABC" value={String(state.costRuns.filter(run => run.method === 'ABC').length)} detail="Historial de ejecuciones" />
      </div>

      <Card>
        <SectionTitle
          title="Actividades y conductores"
          detail="El costo de cada actividad se reparte según el consumo del conductor."
          action={<Button variant="primary" size="sm" onClick={onRun}>Ejecutar ABC</Button>}
        />
        <DataTable
          rows={activities}
          rowKey={row => row.id}
          columns={[
            { header: 'Actividad', cell: row => <div><div className="font-medium text-gray-800">{row.activity.name}</div><div className="text-[9px] text-gray-400">{row.activity.code} · {row.center?.name ?? 'Sin centro'}</div></div> },
            { header: 'Conductor', cell: row => <div><div className="text-gray-700">{row.activity.driver}</div><div className="text-[9px] text-gray-400">{row.activity.driverUnit}</div></div> },
            { header: 'Consumo', align: 'right', cell: row => <span className="tabular">{row.activity.driverQty.toLocaleString('es-CO')}</span> },
            { header: 'Costo total', align: 'right', cell: row => <Money value={row.activity.totalCost} /> },
            { header: 'Tasa por unidad', align: 'right', cell: row => <span className="tabular font-semibold text-gray-800">{money(row.rate)}</span> },
          ]}
          footer={<div className="flex items-center justify-between text-[11px] text-gray-600"><span>{activities.length} actividades</span><span className="tabular font-semibold">Costo ABC: {money(totalCost)}</span></div>}
        />
      </Card>

      <Card>
        <SectionTitle title="Asignación a objetos de costo" detail="Distribución del costo de las actividades del centro entre sus objetos, proporcional al costo real." />
        <DataTable
          rows={objectRows}
          rowKey={row => row.id}
          dense
          columns={[
            { header: 'Objeto', cell: row => <div><div className="font-medium text-gray-800">{row.object.name}</div><div className="text-[9px] text-gray-400">{row.object.code}</div></div> },
            { header: 'Centro', cell: row => <span className="text-gray-600">{row.center.name}</span> },
            { header: 'Participación', align: 'right', cell: row => <span className="tabular">{(row.share * 100).toFixed(1)} %</span> },
            { header: 'Costo ABC asignado', align: 'right', cell: row => <Money value={row.assigned} /> },
            { header: 'Costo ABC unitario', align: 'right', cell: row => <span className="tabular text-gray-700">{money(row.unit)}</span> },
            { header: 'Costo real unitario', align: 'right', cell: row => <span className="tabular text-gray-500">{money(row.object.actualQty * row.object.actualPrice)}</span> },
            { header: 'Comparación', cell: row => {
              const real = row.object.actualQty * row.object.actualPrice;
              const diff = row.unit - real;
              return <Badge tone={Math.abs(diff) < real * 0.05 ? 'green' : diff > 0 ? 'red' : 'amber'}>{Math.abs(real) > 0 ? `${((diff / real) * 100).toFixed(1)} %` : '—'}</Badge>;
            } },
          ]}
        />
      </Card>
    </div>
  );
}
