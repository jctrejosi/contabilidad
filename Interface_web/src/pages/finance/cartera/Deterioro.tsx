import { useMemo } from 'react';
import Icon from '../../../components/Icon';
import {
  Badge,
  Button,
  Card,
  DataTable,
  KpiCard,
  Money,
  Progress,
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import { USUARIO } from '../../../data/mock';
import { useFinance } from '../../../finance/store';
import {
  AGING_BUCKETS,
  HOY,
  agingBucket,
  fmtDate,
  money,
  periodLabel,
  periodOf,
} from '../../../finance/selectors';
import type { AgingBucket } from '../../../finance/selectors';
import type { ImpairmentProvision, ImpairmentStatus } from '../../../finance/types';

const RATES: Record<AgingBucket, number> = {
  Corriente: 0,
  '1–30': 1,
  '31–60': 5,
  '61–90': 15,
  '+90': 35,
};

const STATUS_TONE: Record<ImpairmentStatus, 'gray' | 'blue' | 'green' | 'amber'> = {
  Calculada: 'amber',
  Aprobada: 'blue',
  Contabilizada: 'green',
  Reversada: 'gray',
};

const CURRENT_PERIOD = periodOf(HOY);

export default function Deterioro({ showToast }: { showToast: (text: string) => void }) {
  const { state, update } = useFinance();

  const open = useMemo(
    () => state.receivables.filter(receivable => receivable.balance > 0),
    [state.receivables],
  );

  const buckets = useMemo(() => {
    const result = Object.fromEntries(AGING_BUCKETS.map(bucket => [bucket, 0])) as Record<AgingBucket, number>;
    for (const receivable of open) {
      result[agingBucket(receivable.dueDate)] += receivable.balance;
    }
    return result;
  }, [open]);

  const required = useMemo(
    () => AGING_BUCKETS.reduce((total, bucket) => total + buckets[bucket] * (RATES[bucket] / 100), 0),
    [buckets],
  );

  const history = useMemo(
    () => [...state.impairmentProvisions].sort((a, b) => b.period.localeCompare(a.period)),
    [state.impairmentProvisions],
  );

  const lastClosing = history.find(
    provision => provision.period < CURRENT_PERIOD && provision.status !== 'Reversada',
  )?.closing ?? 0;
  const posted = history.find(provision => provision.status === 'Contabilizada');
  const current = history.find(provision => provision.period === CURRENT_PERIOD);
  const totalReceivable = open.reduce((total, receivable) => total + receivable.balance, 0);
  const coverage = totalReceivable > 0 ? (required / totalReceivable) * 100 : 0;
  const charge = Math.max(0, required - lastClosing);
  const recovery = Math.max(0, lastClosing - required);

  function calculate() {
    const record: ImpairmentProvision = {
      id: `imp-${CURRENT_PERIOD}`,
      period: CURRENT_PERIOD,
      date: HOY,
      basis: 'NIIF 9',
      opening: lastClosing,
      required,
      charge,
      recovery,
      closing: required,
      status: 'Calculada',
      approvedBy: '',
      note: `Provisión calculada por edades de cartera al ${fmtDate(HOY)}.`,
    };
    update(draft => {
      const index = draft.impairmentProvisions.findIndex(provision => provision.period === CURRENT_PERIOD);
      if (index >= 0) draft.impairmentProvisions[index] = record;
      else draft.impairmentProvisions.unshift(record);
    }, `Provisión por deterioro de ${periodLabel(CURRENT_PERIOD)} calculada`, 'cartera');
    showToast(`Provisión de ${periodLabel(CURRENT_PERIOD)} calculada por ${money(required)}.`);
  }

  function approve(id: string) {
    update(draft => {
      const target = draft.impairmentProvisions.find(provision => provision.id === id);
      if (!target) return;
      target.status = 'Aprobada';
      target.approvedBy = USUARIO.nombre;
    }, 'Provisión por deterioro aprobada', 'cartera');
    showToast('Provisión aprobada. Pendiente de contabilización.');
  }

  function post(id: string) {
    update(draft => {
      const target = draft.impairmentProvisions.find(provision => provision.id === id);
      if (!target) return;
      target.status = 'Contabilizada';
      target.approvedBy = target.approvedBy || USUARIO.nombre;
    }, 'Provisión por deterioro contabilizada', 'cartera');
    showToast('Provisión contabilizada contra el gasto por deterioro.');
  }

  const columns: Column<ImpairmentProvision>[] = [
    {
      header: 'Período',
      cell: row => (
        <div>
          <div className="font-medium text-gray-800">{periodLabel(row.period)}</div>
          <div className="text-[10px] text-gray-400">{row.basis}</div>
        </div>
      ),
    },
    { header: 'Apertura', align: 'right', cell: row => <Money value={row.opening} /> },
    {
      header: 'Cargo del período',
      align: 'right',
      cell: row => (
        <div>
          <Money value={row.charge} className={row.charge > 0 ? 'text-red-700' : 'text-gray-400'} />
          {row.recovery > 0 && <div className="text-[10px] text-emerald-700">Recuperación {money(row.recovery)}</div>}
        </div>
      ),
    },
    { header: 'Cierre', align: 'right', cell: row => <Money value={row.closing} className="font-semibold" /> },
    { header: 'Estado', cell: row => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge> },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => (
        <div className="flex justify-end gap-1.5">
          {row.status === 'Calculada' && (
            <Button size="sm" variant="primary" onClick={() => approve(row.id)}>Aprobar</Button>
          )}
          {row.status === 'Aprobada' && (
            <Button size="sm" variant="success" onClick={() => post(row.id)}>Contabilizar</Button>
          )}
          {row.status === 'Contabilizada' && <span className="text-[10px] text-gray-400">{row.approvedBy}</span>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Cartera sujeta" value={<Money value={totalReceivable} />} detail={`${open.length} partidas abiertas`} tone="cyan" />
        <KpiCard label="Provisión requerida" value={<Money value={required} />} detail={`Política NIIF 9 · ${coverage.toFixed(1)} % de cobertura`} tone="amber" />
        <KpiCard label="Provisión registrada" value={<Money value={posted?.closing ?? 0} />} detail={posted ? `Contabilizada en ${periodLabel(posted.period)}` : 'Sin provisión contabilizada'} tone="green" />
        <KpiCard label="Variación del período" value={<Money value={charge - recovery} />} detail={charge >= recovery ? 'Cargo adicional al gasto' : 'Recuperación de provisión'} tone={charge >= recovery ? 'red' : 'green'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Card>
          <SectionTitle
            title="Cartera sujeta por edades"
            detail="Saldos abiertos al cierre agrupados por vencimiento"
            action={<Badge tone="cyan">{periodLabel(CURRENT_PERIOD)}</Badge>}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-gray-100 bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Rango</th>
                  <th className="px-4 py-2 text-right font-semibold">Saldo</th>
                  <th className="px-4 py-2 text-right font-semibold">Tasa</th>
                  <th className="px-4 py-2 text-right font-semibold">Provisión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {AGING_BUCKETS.map(bucket => (
                  <tr key={bucket}>
                    <td className="px-4 py-2 text-gray-700">{bucket}</td>
                    <td className="px-4 py-2 text-right"><Money value={buckets[bucket]} /></td>
                    <td className="px-4 py-2 text-right text-gray-500">{RATES[bucket].toFixed(0)} %</td>
                    <td className="px-4 py-2 text-right"><Money value={buckets[bucket] * (RATES[bucket] / 100)} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 bg-gray-50 text-gray-800">
                <tr>
                  <td className="px-4 py-2 font-semibold">Total</td>
                  <td className="px-4 py-2 text-right font-semibold"><Money value={totalReceivable} /></td>
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2 text-right font-semibold"><Money value={required} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Política de deterioro" detail="Modelo de pérdida esperada por tramos de mora" />
          <div className="space-y-4 p-4">
            <div className="rounded-lg border border-cyan-100 bg-cyan-50/60 px-3 py-2 text-[11px] text-cyan-900">
              La provisión se calcula sobre el saldo abierto de cada partida. El cargo del período es
              la diferencia entre el cierre requerido y la provisión acumulada al inicio.
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Cobertura sobre cartera</span>
                <span className="tabular font-semibold text-gray-800">{coverage.toFixed(1)} %</span>
              </div>
              <div className="mt-2"><Progress value={coverage} tone="amber" label="Provisión / cartera" /></div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-gray-500">Apertura acumulada</dt>
                <dd className="mt-0.5 font-semibold text-gray-900"><Money value={lastClosing} /></dd>
              </div>
              <div>
                <dt className="text-gray-500">Cierre requerido</dt>
                <dd className="mt-0.5 font-semibold text-gray-900"><Money value={required} /></dd>
              </div>
              <div>
                <dt className="text-gray-500">Cargo estimado</dt>
                <dd className="mt-0.5 font-semibold text-red-700"><Money value={charge} /></dd>
              </div>
              <div>
                <dt className="text-gray-500">Recuperación</dt>
                <dd className="mt-0.5 font-semibold text-emerald-700"><Money value={recovery} /></dd>
              </div>
            </dl>
            <Button variant="primary" className="w-full" onClick={calculate} disabled={required <= 0}>
              <Icon name="ledger" className="h-3.5 w-3.5" />
              {current ? 'Recalcular provisión' : `Calcular provisión de ${periodLabel(CURRENT_PERIOD)}`}
            </Button>
            {current && (
              <p className="text-[10px] text-gray-500">
                Último cálculo: {money(current.required)} en estado {current.status}.
              </p>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Historial de provisiones" detail="Cálculo, aprobación y contabilización por período" />
        <div className="p-4">
          <DataTable
            columns={columns}
            rows={history}
            rowKey={row => row.id}
            empty="No hay provisiones registradas."
            footer={
              <span className="text-[11px] text-gray-500">
                La provisión aprobada se contabiliza contra la cuenta 5195 y la 1399 de deterioro.
              </span>
            }
          />
        </div>
      </Card>
    </div>
  );
}
