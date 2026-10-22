import { useState } from 'react';
import { Badge, Button, Card, DataTable, FilterSelect, KpiCard, Money, Progress, SectionTitle } from '../../../components/finance/ui';
import type { FinanceState } from '../../../finance/types';
import { allocatedForPool, centerById, money } from './shared';

export default function Cif({
  state,
  onDistribute,
  onCloseRun,
}: {
  state: FinanceState;
  onDistribute: (poolId: string) => void;
  onCloseRun: () => void;
}) {
  const [period, setPeriod] = useState('2026-02');

  const pools = state.costPools
    .filter(pool => pool.period === period)
    .map(pool => ({
      id: pool.id,
      pool,
      allocated: allocatedForPool(state, pool.id),
      pending: pool.amount - allocatedForPool(state, pool.id),
    }));

  const total = pools.reduce((value, row) => value + row.pool.amount, 0);
  const allocated = pools.reduce((value, row) => value + row.allocated, 0);
  const pending = total - allocated;

  const allocations = state.costAllocations
    .filter(item => item.period === period)
    .map(item => ({
      id: item.id,
      item,
      center: centerById(state, item.centerId),
      pool: state.costPools.find(pool => pool.id === item.poolId),
    }));

  const periods = [...new Set(state.costPools.map(pool => pool.period))].sort().reverse();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="CIF del período" value={<Money value={total} />} detail={`${pools.length} pools`} tone="blue" />
        <KpiCard label="Distribuido" value={<Money value={allocated} />} detail={`${total > 0 ? ((allocated / total) * 100).toFixed(1) : '0.0'} % del total`} tone="green" />
        <KpiCard label="Pendiente" value={<Money value={pending} />} detail={`${pools.filter(row => row.pending > 0).length} pools sin cerrar`} tone={pending > 0 ? 'amber' : 'green'} />
        <KpiCard label="Asignaciones registradas" value={String(allocations.length)} detail="Filas pool → centro" />
      </div>

      <Card>
        <SectionTitle
          title="Pools de costos indirectos"
          detail="La distribución reparte cada pool entre los centros según la base del inductor."
          action={<FilterSelect value={period} onChange={event => setPeriod(event.target.value)}>{periods.map(value => <option key={value}>{value}</option>)}</FilterSelect>}
        />
        <DataTable
          rows={pools}
          rowKey={row => row.id}
          columns={[
            { header: 'Pool', cell: row => <div><div className="font-medium text-gray-800">{row.pool.name}</div><div className="text-[9px] text-gray-400">{row.pool.code} · cuenta {row.pool.account}</div></div> },
            { header: 'Inductor', cell: row => <div><div className="text-gray-700">{row.pool.driver}</div><div className="text-[9px] text-gray-400">{row.pool.driverUnit}</div></div> },
            { header: 'Valor', align: 'right', cell: row => <Money value={row.pool.amount} /> },
            { header: 'Distribuido', align: 'right', cell: row => <div className="min-w-28"><Progress value={row.pool.amount > 0 ? (row.allocated / row.pool.amount) * 100 : 0} tone={row.pending > 0 ? 'amber' : 'green'} label="" /></div> },
            { header: 'Pendiente', align: 'right', cell: row => <span className={row.pending > 0 ? 'tabular font-semibold text-amber-700' : 'tabular text-gray-500'}>{money(row.pending)}</span> },
            { header: 'Estado', cell: row => <Badge tone={row.pending > 0 ? 'amber' : 'green'}>{row.pending > 0 ? 'Pendiente' : 'Distribuido'}</Badge> },
            {
              header: '',
              align: 'right',
              cell: row => (
                <Button size="sm" variant={row.pending > 0 ? 'primary' : 'secondary'} disabled={row.pending <= 0} onClick={() => onDistribute(row.pool.id)}>
                  {row.pending > 0 ? 'Distribuir' : 'Completo'}
                </Button>
              ),
            },
          ]}
          footer={<div className="flex items-center justify-between text-[11px] text-gray-600"><span>Distribución del período {period}</span><span className="tabular font-semibold">Pendiente: {money(pending)}</span></div>}
        />
      </Card>

      <Card>
        <SectionTitle title="Detalle de asignaciones" detail="Valor trasladado desde cada pool hacia cada centro de costo." />
        <DataTable
          rows={allocations}
          rowKey={row => row.id}
          dense
          columns={[
            { header: 'Centro', cell: row => <div><div className="font-medium text-gray-800">{row.center?.name ?? 'Centro eliminado'}</div><div className="text-[9px] text-gray-400">{row.center?.code ?? '—'}</div></div> },
            { header: 'Pool', cell: row => <div><div className="text-gray-700">{row.pool?.name ?? 'Pool eliminado'}</div><div className="text-[9px] text-gray-400">{row.pool?.code ?? '—'}</div></div> },
            { header: 'Base aplicada', align: 'right', cell: row => <span className="tabular">{row.item.driverQty.toLocaleString('es-CO')} {row.pool?.driverUnit}</span> },
            { header: 'Valor asignado', align: 'right', cell: row => <Money value={row.item.amount} /> },
            { header: 'Fecha', cell: row => <span className="tabular text-gray-500">{row.item.date}</span> },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle
          title="Corridas de distribución"
          detail="Cada corrida deja el total distribuido y su estado contable."
          action={<Button size="sm" onClick={onCloseRun} disabled={!state.costRuns.some(run => run.status === 'Calculada')}>Contabilizar última corrida</Button>}
        />
        <DataTable
          rows={[...state.costRuns].reverse()}
          rowKey={run => run.id}
          dense
          columns={[
            { header: 'Número', cell: run => <span className="font-mono text-gray-800">{run.number}</span> },
            { header: 'Fecha', cell: run => <span className="tabular text-gray-600">{run.date}</span> },
            { header: 'Período', cell: run => run.period },
            { header: 'Método', cell: run => <Badge tone={run.method === 'CIF' ? 'cyan' : 'violet'}>{run.method}</Badge> },
            { header: 'Total', align: 'right', cell: run => <Money value={run.total} /> },
            { header: 'Estado', cell: run => <Badge tone={run.status === 'Contabilizada' ? 'green' : 'amber'}>{run.status}</Badge> },
            { header: 'Usuario', cell: run => <span className="text-gray-500">{run.user}</span> },
          ]}
        />
      </Card>
    </div>
  );
}
