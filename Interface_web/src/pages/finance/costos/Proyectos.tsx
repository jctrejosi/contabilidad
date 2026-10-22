import { Badge, Card, DataTable, KpiCard, Money, Progress, SectionTitle } from '../../../components/finance/ui';
import type { FinanceState } from '../../../finance/types';
import { actualCost, centerById, money, objectMargin, standardCost, totalVariance } from './shared';

export default function Proyectos({ state }: { state: FinanceState }) {
  const projects = state.costObjects
    .filter(object => object.kind === 'Proyecto')
    .map(object => ({
      id: object.id,
      object,
      center: centerById(state, object.centerId),
      standard: standardCost(object),
      actual: actualCost(object),
      variance: totalVariance(object),
      margin: objectMargin(object),
    }));

  const contract = projects.reduce((total, row) => total + row.object.revenue, 0);
  const cost = projects.reduce((total, row) => total + row.actual, 0);
  const margin = contract > 0 ? ((contract - cost) / contract) * 100 : 0;
  const overrun = projects.filter(row => row.variance > 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Proyectos activos" value={String(projects.length)} detail="Objetos de costo tipo proyecto" tone="violet" />
        <KpiCard label="Valor contratado" value={<Money value={contract} />} detail="Ingreso presupuestado" tone="blue" />
        <KpiCard label="Costo real acumulado" value={<Money value={cost} />} detail="Materiales, mano de obra y CIF" tone="cyan" />
        <KpiCard label="Margen del proyecto" value={`${margin.toFixed(1)} %`} detail={overrun > 0 ? `${overrun} con sobrecosto` : 'Todos dentro del estándar'} tone={margin >= 25 ? 'green' : 'amber'} />
      </div>

      <Card>
        <SectionTitle title="Costos por proyecto" detail="Acumulación de costo estándar, real y resultado esperado de cada proyecto." />
        <DataTable
          rows={projects}
          rowKey={row => row.id}
          columns={[
            { header: 'Proyecto', cell: row => <div><div className="font-medium text-gray-800">{row.object.name}</div><div className="text-[9px] text-gray-400">{row.object.code} · {row.object.productCode || 'Sin código'}</div></div> },
            { header: 'Centro', cell: row => <span className="text-gray-600">{row.center?.name ?? 'Sin centro'}</span> },
            { header: 'Valor contratado', align: 'right', cell: row => <Money value={row.object.revenue} /> },
            { header: 'Costo estándar', align: 'right', cell: row => <Money value={row.standard} /> },
            { header: 'Costo real', align: 'right', cell: row => <Money value={row.actual} /> },
            { header: 'Variación', align: 'right', cell: row => <span className={row.variance > 0 ? 'tabular font-semibold text-red-700' : 'tabular font-semibold text-emerald-700'}>{money(row.variance)}</span> },
            { header: 'Ejecución del costo', cell: row => <div className="min-w-32"><Progress value={row.object.revenue > 0 ? (row.actual / row.object.revenue) * 100 : 0} tone={row.margin < 20 ? 'amber' : 'green'} label="" /></div> },
            { header: 'Margen', align: 'right', cell: row => <Badge tone={row.margin >= 25 ? 'green' : row.margin >= 15 ? 'amber' : 'red'}>{row.margin.toFixed(1)} %</Badge> },
          ]}
          footer={<div className="flex items-center justify-between text-[11px] text-gray-600"><span>{projects.length} proyectos</span><span className="tabular font-semibold">Resultado esperado: {money(contract - cost)}</span></div>}
        />
      </Card>

      <Card>
        <SectionTitle title="Lectura del resultado" detail="Cómo interpretar la variación y el margen del proyecto." />
        <div className="grid gap-3 px-4 py-4 text-[11px] leading-5 text-gray-600 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-1 font-semibold text-gray-800">Variación</div>
            Diferencia entre el costo real y el costo estándar. Un valor positivo indica sobrecosto y exige revisión de cantidades o precios.
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-1 font-semibold text-gray-800">Ejecución</div>
            Porcentaje del valor contratado consumido por el costo real. Superar el 100 % implica que el proyecto ya no cubre su costo.
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-1 font-semibold text-gray-800">Margen</div>
            Resultado del proyecto sobre el valor contratado. Se compara contra el margen objetivo definido para la línea de negocio.
          </div>
        </div>
      </Card>
    </div>
  );
}
