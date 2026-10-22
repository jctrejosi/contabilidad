import { useMemo } from 'react';
import Icon from '../../../components/Icon';
import {
  Badge,
  Button,
  Card,
  DataTable,
  KpiCard,
  Money,
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import { useFinance } from '../../../finance/store';
import { HOY, money } from '../../../finance/selectors';
import type { CostSecondaryAllocation, FinanceState } from '../../../finance/types';

interface Props {
  state: FinanceState;
  showToast: (text: string) => void;
}

export default function Secundaria({ state, showToast }: Props) {
  const { update } = useFinance();
  const centers = state.costCenters;
  const services = centers.filter(center => center.kind === 'Servicio' && center.status === 'Activo');
  const production = centers.filter(center => center.kind === 'Producción' && center.status === 'Activo');

  const rows = useMemo(
    () => [...state.secondaryAllocations].sort((a, b) => a.fromCenterId.localeCompare(b.fromCenterId)),
    [state.secondaryAllocations],
  );

  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const pending = rows.filter(row => row.status === 'Calculada');
  const applied = rows.filter(row => row.status === 'Aplicada');

  function centerName(id: string) {
    return centers.find(center => center.id === id)?.name ?? id;
  }

  function apply(row: CostSecondaryAllocation) {
    update(draft => {
      const target = draft.secondaryAllocations.find(item => item.id === row.id);
      if (target) target.status = 'Aplicada';
    }, `Distribución secundaria ${row.fromCenterId} → ${row.toCenterId} aplicada`, 'costos');
    showToast('Distribución secundaria aplicada al centro de destino.');
  }

  function recalculate() {
    if (production.length === 0) {
      showToast('No hay centros de producción activos.');
      return;
    }
    const weightOf = (id: string) => {
      const center = centers.find(item => item.id === id);
      return center ? (center.machineHours || center.driverQty || 1) : 1;
    };
    const totalWeight = production.reduce((sum, center) => sum + weightOf(center.id), 0);

    update(draft => {
      draft.secondaryAllocations = draft.secondaryAllocations.filter(row => row.status === 'Aplicada');
      let sequence = 0;
      for (const service of services) {
        for (const target of production) {
          const weight = weightOf(target.id);
          const amount = Math.round((service.directCost * weight) / totalWeight);
          sequence += 1;
          draft.secondaryAllocations.push({
            id: `sec-${Date.now()}-${sequence}`,
            period: '2026-02',
            fromCenterId: service.id,
            toCenterId: target.id,
            driver: 'Horas máquina',
            driverQty: weight,
            amount,
            status: 'Calculada',
            date: HOY,
            note: `${service.name} distribuido por horas máquina.`,
          });
        }
      }
    }, 'Distribución secundaria recalculada', 'costos');
    showToast('Distribución secundaria recalculada para los centros de producción.');
  }

  const columns: Column<CostSecondaryAllocation>[] = [
    {
      header: 'Centro de servicio',
      cell: row => (
        <div>
          <div className="font-medium text-gray-800">{centerName(row.fromCenterId)}</div>
          <div className="text-[10px] text-gray-400">
            {centers.find(center => center.id === row.fromCenterId)?.code ?? row.fromCenterId}
          </div>
        </div>
      ),
    },
    { header: 'Centro destino', cell: row => <span className="text-gray-700">{centerName(row.toCenterId)}</span> },
    { header: 'Inductor', cell: row => <Badge tone="cyan">{row.driver}</Badge> },
    { header: 'Consumo', align: 'right', cell: row => <span className="tabular">{row.driverQty.toLocaleString('es-CO')}</span> },
    { header: 'Monto', align: 'right', cell: row => <Money value={row.amount} className="font-semibold" /> },
    { header: 'Estado', cell: row => <Badge tone={row.status === 'Aplicada' ? 'green' : 'amber'}>{row.status}</Badge> },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => (
        <Button size="sm" variant="success" disabled={row.status === 'Aplicada'} onClick={() => apply(row)}>
          {row.status === 'Aplicada' ? 'Aplicada' : 'Aplicar'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total redistribuido" value={<Money value={total} />} detail={`${rows.length} asignaciones`} tone="cyan" />
        <KpiCard label="Centros de servicio" value={String(services.length)} detail="Origen de la distribución" tone="violet" />
        <KpiCard label="Pendientes" value={String(pending.length)} detail={money(pending.reduce((sum, row) => sum + row.amount, 0))} tone={pending.length > 0 ? 'amber' : 'green'} />
        <KpiCard label="Aplicadas" value={String(applied.length)} detail="Incorporadas al costo" tone="green" />
      </div>

      <Card>
        <SectionTitle
          title="Distribución secundaria"
          detail="Costos de centros de servicio redistribuidos a los centros de producción"
          action={
            <Button variant="primary" onClick={recalculate}>
              <Icon name="indicator" className="h-3.5 w-3.5" /> Recalcular distribución
            </Button>
          }
        />
        <div className="p-4">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={row => row.id}
            empty="No hay distribución secundaria registrada."
            footer={
              <span className="text-[11px] text-gray-500">
                Recalcular conserva las distribuciones aplicadas y regenera las calculadas por horas máquina.
              </span>
            }
          />
        </div>
      </Card>

      <Card>
        <SectionTitle title="Centros de servicio" detail="Costo directo acumulado y base de distribución" />
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {services.map(center => (
            <div key={center.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800">{center.name}</span>
                <Badge tone="violet">{center.code}</Badge>
              </div>
              <div className="mt-2 flex items-center justify-between text-gray-500">
                <span>Costo directo</span>
                <Money value={center.directCost} className="font-semibold text-gray-900" />
              </div>
              <div className="mt-1 flex items-center justify-between text-gray-500">
                <span>{center.driver}</span>
                <span className="tabular">{center.driverQty.toLocaleString('es-CO')} {center.driverUnit}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
