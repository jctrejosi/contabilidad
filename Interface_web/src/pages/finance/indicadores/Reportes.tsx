import { Badge, Button, Card, DataTable, KpiCard, Money, Progress, SectionTitle } from '../../../components/finance/ui';
import type { FinanceState } from '../../../finance/types';
import {
  currentProjection,
  formatIndicator,
  indicatorAchieved,
  indicatorCompliance,
  projectionTotals,
} from './shared';

export default function Reportes({ state, onExport }: { state: FinanceState; onExport: () => void }) {
  const projection = currentProjection(state);
  const totals = projection ? projectionTotals(projection) : null;
  const achieved = state.indicators.filter(indicatorAchieved);
  const average = state.indicators.length > 0
    ? state.indicators.reduce((total, indicator) => total + Math.min(100, indicatorCompliance(indicator)), 0) / state.indicators.length
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Cumplimiento promedio" value={`${average.toFixed(1)} %`} detail={`${achieved.length} de ${state.indicators.length} indicadores en meta`} tone={average >= 90 ? 'green' : 'amber'} />
        <KpiCard label="Ingresos proyectados" value={<Money value={totals?.revenue ?? 0} />} detail={projection?.name ?? 'Sin escenario vigente'} tone="blue" />
        <KpiCard label="EBITDA proyectado" value={<Money value={totals?.ebitda ?? 0} />} detail={`Margen ${(totals?.margin ?? 0).toFixed(1)} %`} tone="green" />
        <KpiCard label="Caja libre" value={<Money value={totals?.cash ?? 0} />} detail="Después de inversión" tone={(totals?.cash ?? 0) >= 0 ? 'cyan' : 'red'} />
      </div>

      <Card>
        <SectionTitle
          title="Informe gerencial"
          detail="Resumen de indicadores y del escenario vigente para el comité de dirección."
          action={<Button size="sm" onClick={onExport}>Exportar informe</Button>}
        />
        <p className="px-4 py-4 text-[11px] leading-5 text-gray-600">
          El período cierra con {achieved.length} de {state.indicators.length} indicadores en meta y un cumplimiento promedio de {average.toFixed(1)} %.
          El escenario vigente <strong>{projection?.name ?? 'sin definir'}</strong> proyecta ingresos por {totals ? totals.revenue.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }) : '0'}
          y un EBITDA de {totals ? totals.ebitda.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }) : '0'}, con margen de {(totals?.margin ?? 0).toFixed(1)} %.
          {state.indicators.filter(indicator => !indicatorAchieved(indicator)).length > 0
            ? ` Los indicadores que requieren acción son: ${state.indicators.filter(indicator => !indicatorAchieved(indicator)).map(indicator => indicator.name).join(', ')}.`
            : ' No hay indicadores fuera de meta.'}
        </p>
      </Card>

      <Card>
        <SectionTitle title="Detalle de indicadores" detail="Comparación entre meta, valor actual y cumplimiento." />
        <DataTable
          rows={state.indicators}
          rowKey={indicator => indicator.id}
          dense
          columns={[
            { header: 'Indicador', cell: indicator => <div><div className="font-medium text-gray-800">{indicator.name}</div><div className="text-[9px] text-gray-400">{indicator.code}</div></div> },
            { header: 'Grupo', cell: indicator => <span className="text-gray-600">{indicator.group}</span> },
            { header: 'Meta', align: 'right', cell: indicator => <span className="tabular text-gray-600">{formatIndicator(indicator, indicator.target)}</span> },
            { header: 'Actual', align: 'right', cell: indicator => <span className="tabular font-semibold text-gray-800">{formatIndicator(indicator, indicator.actual)}</span> },
            { header: 'Cumplimiento', cell: indicator => <div className="min-w-28"><Progress value={indicatorCompliance(indicator)} tone={indicatorAchieved(indicator) ? 'green' : 'red'} label="" /></div> },
            { header: 'Estado', cell: indicator => <Badge tone={indicatorAchieved(indicator) ? 'green' : 'red'}>{indicatorAchieved(indicator) ? 'Cumple' : 'En riesgo'}</Badge> },
          ]}
          footer={<div className="text-[11px] text-gray-600">Cumplimiento promedio: <strong className="tabular">{average.toFixed(1)} %</strong></div>}
        />
      </Card>

      <Card>
        <SectionTitle title="Resumen de escenarios" detail="Cifras anuales de cada proyección registrada." />
        <DataTable
          rows={state.projections}
          rowKey={item => item.id}
          dense
          columns={[
            { header: 'Escenario', cell: item => <div><div className="font-medium text-gray-800">{item.name}</div><div className="text-[9px] text-gray-400">{item.scenario} · {item.year}</div></div> },
            { header: 'Ingresos', align: 'right', cell: item => <Money value={projectionTotals(item).revenue} /> },
            { header: 'EBITDA', align: 'right', cell: item => <span className="tabular font-semibold text-gray-800">{projectionTotals(item).ebitda.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> },
            { header: 'Margen', align: 'right', cell: item => <span className="tabular">{projectionTotals(item).margin.toFixed(1)} %</span> },
            { header: 'Caja libre', align: 'right', cell: item => <span className={projectionTotals(item).cash >= 0 ? 'tabular text-emerald-700' : 'tabular text-red-700'}>{projectionTotals(item).cash.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> },
            { header: 'Estado', cell: item => item.current ? <Badge tone="green">Vigente</Badge> : <Badge tone="gray">Alterno</Badge> },
          ]}
        />
      </Card>
    </div>
  );
}
