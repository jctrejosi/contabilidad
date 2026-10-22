import { Badge, Button, Card, DataTable, KpiCard, Money, Progress, SectionTitle } from '../../../components/finance/ui';
import type { NavPage } from '../../../components/Shell';
import { HOY, addDays, daysBetween, fmtDate } from '../../../finance/selectors';
import type { FinanceState } from '../../../finance/types';
import { liquiditySnapshot, projectedInflows, projectedOutflows, type ProjectedItem } from './cashflow';

function dueLabel(date: string): { text: string; tone: 'red' | 'amber' | 'green' } {
  const days = daysBetween(HOY, date);
  if (days < 0) return { text: `Vencido ${Math.abs(days)} d`, tone: 'red' };
  if (days === 0) return { text: 'Vence hoy', tone: 'amber' };
  if (days <= 7) return { text: `${days} días`, tone: 'amber' };
  return { text: `${days} días`, tone: 'green' };
}

export default function Liquidez({ state, onNavigate }: { state: FinanceState; onNavigate: (page: NavPage) => void }) {
  const snapshot = liquiditySnapshot(state);
  const horizon = addDays(HOY, 30);

  const collections = projectedInflows(state).filter(item => item.date <= horizon).sort((a, b) => a.date.localeCompare(b.date));
  const payments = projectedOutflows(state).filter(item => item.date <= horizon).sort((a, b) => a.date.localeCompare(b.date));
  const coverageDays = snapshot.outflows > 0 ? snapshot.cash.total / (snapshot.outflows / 30) : 0;
  const coverage = Math.min(100, snapshot.coverage * 100);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Disponible hoy" value={<Money value={snapshot.cash.total} />} detail={`Bancos ${Math.round(snapshot.cash.bank / 1_000_000)} M · Caja ${Math.round(snapshot.cash.petty / 1_000_000)} M`} tone="blue" />
        <KpiCard label="Recaudos próximos 30 días" value={<Money value={snapshot.inflows} />} detail={`${collections.length} partidas de cartera`} tone="green" />
        <KpiCard label="Pagos próximos 30 días" value={<Money value={snapshot.outflows} />} detail={`${payments.length} compromisos`} tone="amber" />
        <KpiCard label="Liquidez neta a 30 días" value={<Money value={snapshot.net} />} detail={snapshot.net >= 0 ? 'Cubre los compromisos' : 'Requiere financiación o gestión'} tone={snapshot.net >= 0 ? 'cyan' : 'red'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <SectionTitle title="Indicadores de liquidez" detail="Capacidad de cubrir las obligaciones del próximo mes." />
          <div className="space-y-4 px-4 py-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px]"><span className="text-gray-600">Cobertura de pagos</span><span className="tabular font-semibold text-gray-800">{snapshot.coverage.toFixed(2)}×</span></div>
              <Progress value={coverage} tone={snapshot.coverage >= 1 ? 'green' : snapshot.coverage >= 0.7 ? 'amber' : 'red'} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="text-[10px] text-gray-500">Días de caja</div>
                <div className="tabular mt-1 text-sm font-semibold text-gray-900">{coverageDays.toFixed(0)} días</div>
                <div className="text-[9px] text-gray-400">Al ritmo de pagos actual</div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="text-[10px] text-gray-500">Semanas con déficit</div>
                <div className={`tabular mt-1 text-sm font-semibold ${snapshot.negativeWeeks > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{snapshot.negativeWeeks} de {snapshot.weeks.length}</div>
                <div className="text-[9px] text-gray-400">Saldo proyectado semanal</div>
              </div>
            </div>
            <div className={`rounded-lg border px-3 py-2 text-[11px] leading-5 ${snapshot.net >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
              {snapshot.net >= 0
                ? `La caja disponible más los recaudos cubren los compromisos de 30 días con un excedente de ${Math.round(snapshot.net / 1_000_000)} M.`
                : `Faltan ${Math.abs(Math.round(snapshot.net / 1_000_000))} M para cubrir los compromisos de 30 días. Priorice recaudo o reprograme pagos.`}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => onNavigate('cartera/partidas')}>Gestionar cartera</Button>
              <Button size="sm" onClick={() => onNavigate('cuentas-pagar/programacion')}>Reprogramar pagos</Button>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Posición semanal" detail="Saldo de cierre por semana con los movimientos esperados." />
          <DataTable
            rows={snapshot.weeks}
            rowKey={week => week.id}
            dense
            columns={[
              { header: 'Semana', cell: week => <div><div className="font-medium text-gray-800">{week.label}</div><div className="text-[9px] text-gray-400">{fmtDate(week.from)} – {fmtDate(week.to)}</div></div> },
              { header: 'Entradas', align: 'right', cell: week => <span className="tabular text-emerald-700">{week.inflow.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> },
              { header: 'Salidas', align: 'right', cell: week => <span className="tabular text-red-700">{week.outflow.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> },
              { header: 'Neto', align: 'right', cell: week => <span className={week.net >= 0 ? 'tabular font-semibold text-emerald-700' : 'tabular font-semibold text-red-700'}>{week.net.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> },
              { header: 'Saldo cierre', align: 'right', cell: week => <span className={week.closing < 0 ? 'tabular font-semibold text-red-700' : 'tabular font-semibold text-gray-800'}>{week.closing.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> },
              { header: 'Estado', cell: week => <Badge tone={week.closing < 0 ? 'red' : week.net < 0 ? 'amber' : 'green'}>{week.closing < 0 ? 'Déficit' : week.net < 0 ? 'Ajustado' : 'Holgado'}</Badge> },
            ]}
          />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionTitle
            title="Calendario de recaudos"
            detail={`${collections.length} partidas con vencimiento en los próximos 30 días.`}
            action={<Button size="sm" onClick={() => onNavigate('cartera/partidas')}>Ver cartera</Button>}
          />
          <DataTable
            rows={collections.slice(0, 10)}
            rowKey={item => item.id}
            dense
            empty="No hay recaudos programados en los próximos 30 días."
            columns={[
              { header: 'Vencimiento', cell: item => <div><div className="tabular text-gray-700">{fmtDate(item.date)}</div><div className={`text-[9px] font-medium ${dueLabel(item.date).tone === 'red' ? 'text-red-600' : dueLabel(item.date).tone === 'amber' ? 'text-amber-600' : 'text-gray-400'}`}>{dueLabel(item.date).text}</div></div> },
              { header: 'Cliente', cell: (item: ProjectedItem) => <div><div className="font-medium text-gray-800">{item.party}</div><div className="text-[9px] text-gray-400">{item.concept}</div></div> },
              { header: 'Valor', align: 'right', cell: item => <span className="tabular font-semibold text-emerald-700">{item.amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> },
            ]}
            footer={collections.length > 10 ? <div className="text-[11px] text-gray-500">+{collections.length - 10} partidas adicionales</div> : undefined}
          />
        </Card>

        <Card>
          <SectionTitle
            title="Calendario de pagos"
            detail={`${payments.length} compromisos con vencimiento en los próximos 30 días.`}
            action={<Button size="sm" onClick={() => onNavigate('cuentas-pagar/programacion')}>Ver CxP</Button>}
          />
          <DataTable
            rows={payments.slice(0, 10)}
            rowKey={item => item.id}
            dense
            empty="No hay pagos programados en los próximos 30 días."
            columns={[
              { header: 'Vencimiento', cell: item => <div><div className="tabular text-gray-700">{fmtDate(item.date)}</div><div className={`text-[9px] font-medium ${dueLabel(item.date).tone === 'red' ? 'text-red-600' : dueLabel(item.date).tone === 'amber' ? 'text-amber-600' : 'text-gray-400'}`}>{dueLabel(item.date).text}</div></div> },
              { header: 'Tercero', cell: (item: ProjectedItem) => <div><div className="font-medium text-gray-800">{item.party}</div><div className="text-[9px] text-gray-400">{item.concept}</div></div> },
              { header: 'Origen', cell: item => <Badge tone={item.source === 'Deuda' ? 'violet' : item.source === 'Leasing' ? 'cyan' : item.source === 'Gastos' ? 'amber' : 'gray'}>{item.source}</Badge> },
              { header: 'Valor', align: 'right', cell: item => <span className="tabular font-semibold text-red-700">{item.amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> },
            ]}
            footer={payments.length > 10 ? <div className="text-[11px] text-gray-500">+{payments.length - 10} compromisos adicionales</div> : undefined}
          />
        </Card>
      </div>
    </div>
  );
}
