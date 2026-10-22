import { Badge, BarChart, Button, Card, KpiCard, Money, Progress, SectionTitle } from '../../../components/finance/ui';
import type { NavPage } from '../../../components/Shell';
import type { FinanceState } from '../../../finance/types';
import {
  currentProjection,
  formatIndicator,
  indicatorAchieved,
  indicatorCompliance,
  monthlyProjection,
  projectionTotals,
} from './shared';

export default function Panel({ state, onNavigate }: { state: FinanceState; onNavigate: (page: NavPage) => void }) {
  const projection = currentProjection(state);
  const totals = projection ? projectionTotals(projection) : null;
  const monthly = projection ? monthlyProjection(projection) : [];

  const achieved = state.indicators.filter(indicatorAchieved);
  const atRisk = state.indicators.filter(indicator => !indicatorAchieved(indicator));
  const groups = [...new Set(state.indicators.map(indicator => indicator.group))];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Ingresos proyectados 2026" value={<Money value={totals?.revenue ?? 0} />} detail={projection?.name ?? 'Sin proyección vigente'} tone="blue" />
        <KpiCard label="EBITDA proyectado" value={<Money value={totals?.ebitda ?? 0} />} detail={`Margen ${(totals?.margin ?? 0).toFixed(1)} %`} tone="green" />
        <KpiCard label="Caja libre" value={<Money value={totals?.cash ?? 0} />} detail="EBITDA menos inversión" tone={(totals?.cash ?? 0) >= 0 ? 'cyan' : 'red'} />
        <KpiCard label="Indicadores en meta" value={`${achieved.length} / ${state.indicators.length}`} detail={`${atRisk.length} requieren acción`} tone={atRisk.length === 0 ? 'green' : 'amber'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <SectionTitle
            title="EBITDA mensual proyectado"
            detail="Escenario vigente, doce meses."
            action={<Button size="sm" onClick={() => onNavigate('indicadores/proyecciones')}>Ver proyección</Button>}
          />
          <div className="px-4 py-4">
            <BarChart
              data={monthly.map(item => ({ label: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][item.index], value: item.ebitda }))}
              height={170}
              tone="green"
              formatter={value => `${Math.round(value / 1_000_000)} M`}
            />
          </div>
        </Card>

        <Card>
          <SectionTitle title="Indicadores fuera de meta" detail="Ordenados por nivel de cumplimiento." action={<Button size="sm" onClick={() => onNavigate('indicadores/catalogo')}>Catálogo</Button>} />
          <div className="divide-y divide-gray-50">
            {atRisk.length === 0 && <p className="px-4 py-6 text-xs text-emerald-700">Todos los indicadores cumplen la meta del período.</p>}
            {atRisk
              .slice()
              .sort((a, b) => indicatorCompliance(a) - indicatorCompliance(b))
              .map(indicator => (
                <div key={indicator.id} className="px-4 py-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-gray-800">{indicator.name}</span>
                    <Badge tone={indicatorCompliance(indicator) < 80 ? 'red' : 'amber'}>{indicatorCompliance(indicator).toFixed(0)} %</Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                    <span>Meta {formatIndicator(indicator, indicator.target)}</span>
                    <span>Actual {formatIndicator(indicator, indicator.actual)}</span>
                  </div>
                  <div className="mt-1"><Progress value={indicatorCompliance(indicator)} tone={indicatorCompliance(indicator) < 80 ? 'red' : 'amber'} label="" /></div>
                </div>
              ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map(group => {
          const items = state.indicators.filter(indicator => indicator.group === group);
          const ok = items.filter(indicatorAchieved).length;
          return (
            <Card key={group}>
              <SectionTitle title={group} detail={`${ok} de ${items.length} en meta`} action={<Badge tone={ok === items.length ? 'green' : 'amber'}>{items.length - ok} en riesgo</Badge>} />
              <div className="divide-y divide-gray-50">
                {items.map(indicator => (
                  <div key={indicator.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-700">{indicator.name}</span>
                      <span className={`tabular font-semibold ${indicatorAchieved(indicator) ? 'text-emerald-700' : 'text-red-700'}`}>{formatIndicator(indicator, indicator.actual)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400">
                      <span>Meta {formatIndicator(indicator, indicator.target)}</span>
                      <span>{indicator.direction}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
