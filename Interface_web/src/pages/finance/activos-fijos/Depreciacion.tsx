import { useMemo, useState } from 'react';
import Icon from '../../../components/Icon';
import {
  Badge,
  BarChart,
  Button,
  Card,
  DataTable,
  Field,
  INPUT,
  KpiCard,
  Modal,
  Money,
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import {
  addMonthsToPeriod,
  assetCategoryOf,
  assetGross,
  assetProjection,
  assetMonthlyDepreciation,
  compactMoney,
  fmtDate,
  isAssetActive,
  money,
  periodLabel,
} from '../../../finance/selectors';
import type { Asset, DepreciationEntry, FinanceState } from '../../../finance/types';
import type { AssetActions } from './shared';
import { methodLabel } from './shared';

export default function Depreciacion({ state, actions }: { state: FinanceState; actions: AssetActions }) {
  const [period, setPeriod] = useState('2026-02');
  const [units, setUnits] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState(false);

  const preview = useMemo(() => {
    return state.assets
      .filter(asset => isAssetActive(asset) && asset.status !== 'En montaje' && asset.usefulLifeMonths > 0)
      .map(asset => {
        const existing = state.depreciationEntries.find(entry => entry.assetId === asset.id && entry.period === period && entry.status === 'Contabilizada');
        const amount = existing?.amount ?? Math.round(assetMonthlyDepreciation(asset, units[asset.id] ?? 0));
        return { asset, existing, amount };
      })
      .sort((a, b) => a.asset.code.localeCompare(b.asset.code));
  }, [state.assets, state.depreciationEntries, period, units]);

  const pending = preview.filter(row => !row.existing && row.amount > 0);
  const total = pending.reduce((sum, row) => sum + row.amount, 0);
  const postedTotal = preview.filter(row => row.existing?.status === 'Contabilizada').reduce((sum, row) => sum + (row.existing?.amount ?? 0), 0);

  const projection = useMemo(() => {
    const values: Record<string, number> = {};
    for (const asset of state.assets.filter(item => isAssetActive(item) && item.status !== 'En montaje')) {
      for (const row of assetProjection(asset, 12)) {
        values[row.period] = (values[row.period] ?? 0) + row.amount;
      }
    }
    return Object.entries(values).map(([key, value]) => ({ label: key.slice(5), value }));
  }, [state.assets]);

  const annualProjection = projection.reduce((sum, row) => sum + row.value, 0);

  const postedPeriods = useMemo(() => {
    const grouped = new Map<string, { period: string; count: number; amount: number }>();
    for (const entry of state.depreciationEntries.filter(item => item.status === 'Contabilizada')) {
      const current = grouped.get(entry.period) ?? { period: entry.period, count: 0, amount: 0 };
      current.count += 1;
      current.amount += entry.amount;
      grouped.set(entry.period, current);
    }
    return Array.from(grouped.values()).sort((a, b) => b.period.localeCompare(a.period));
  }, [state.depreciationEntries]);

  const history = useMemo(() => {
    return [...state.depreciationEntries]
      .sort((a, b) => b.period.localeCompare(a.period) || a.assetId.localeCompare(b.assetId))
      .slice(0, 60);
  }, [state.depreciationEntries]);

  const previewColumns: Column<{ asset: Asset; existing?: DepreciationEntry; amount: number }>[] = [
    { header: 'Activo', cell: row => <div><div className="font-mono text-[10px] text-gray-400">{row.asset.code}</div><div className="max-w-48 truncate text-gray-700">{row.asset.name}</div></div> },
    { header: 'Categoría', cell: row => <span className="block max-w-36 truncate text-gray-600">{assetCategoryOf(state.assetCategories, row.asset.categoryId)?.name ?? '—'}</span> },
    { header: 'Método', cell: row => methodLabel(row.asset.method) },
    { header: 'Acumulado / base', align: 'right', cell: row => <div><Money value={row.asset.accumulatedDepreciation} /><div className="text-[9px] text-gray-400">Base <Money value={Math.max(0, assetGross(row.asset) - row.asset.impairment - row.asset.residualValue)} /></div></div> },
    {
      header: 'Unidades',
      align: 'right',
      cell: row => row.asset.method === 'Unidades de producción' ? (
        <input
          type="number"
          min={0}
          className={`${INPUT} w-24 text-right`}
          value={units[row.asset.id] ?? 0}
          disabled={Boolean(row.existing)}
          onChange={event => setUnits(current => ({ ...current, [row.asset.id]: Number(event.target.value) }))}
          aria-label={`Unidades de ${row.asset.code}`}
        />
      ) : <span className="text-gray-300">—</span>,
    },
    { header: 'Cuota', align: 'right', cell: row => <Money value={row.amount} className="font-semibold" /> },
    { header: 'Estado', cell: row => row.existing ? <Badge tone={row.existing.status === 'Contabilizada' ? 'green' : 'red'}>{row.existing.status}</Badge> : row.amount <= 0 ? <Badge tone="gray">Sin cuota</Badge> : <Badge tone="amber">Pendiente</Badge> },
  ];

  const historyColumns: Column<DepreciationEntry>[] = [
    { header: 'Periodo', cell: row => periodLabel(row.period) },
    { header: 'Activo', cell: row => { const asset = state.assets.find(item => item.id === row.assetId); return <span className="block max-w-56 truncate text-gray-700">{asset ? `${asset.code} · ${asset.name}` : row.assetId}</span>; } },
    { header: 'Cuenta', cell: row => <span className="font-mono text-[10px]">{row.account}</span> },
    { header: 'Valor', align: 'right', cell: row => <Money value={row.amount} /> },
    { header: 'Acumulado', align: 'right', cell: row => <Money value={row.accumulatedAfter} /> },
    { header: 'Estado', cell: row => <Badge tone={row.status === 'Contabilizada' ? 'green' : row.status === 'Reversada' ? 'red' : 'amber'}>{row.status}</Badge> },
    { header: 'Contabilizado', cell: row => fmtDate(row.postedAt) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Pendiente del periodo" value={money(total)} detail={`${pending.length} activos por depreciar`} tone="amber" />
        <KpiCard label="Ya contabilizado" value={money(postedTotal)} detail={periodLabel(period)} tone="green" />
        <KpiCard label="Proyección 12 meses" value={compactMoney(annualProjection)} detail="Cuota agregada de toda la compañía" tone="blue" />
        <KpiCard label="Activos en montaje" value={String(state.assets.filter(asset => asset.status === 'En montaje').length)} detail="No deprecian hasta la puesta en servicio" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_19rem]">
        <Card className="min-w-0">
          <SectionTitle
            title="Cierre de depreciación"
            detail="La vista previa se recalcula con la base, el residual y los meses restantes de cada activo."
            action={<Badge tone={pending.length ? 'amber' : 'green'}>{pending.length ? `${pending.length} pendientes` : 'Periodo cerrado'}</Badge>}
          />
          <div className="flex flex-wrap items-end gap-2 border-b border-gray-100 px-4 py-3">
            <Field label="Periodo a contabilizar">
              <select className={INPUT} value={period} onChange={event => setPeriod(event.target.value)}>
                {Array.from({ length: 12 }, (_, index) => addMonthsToPeriod('2026-01', index)).map(item => (
                  <option key={item} value={item}>{periodLabel(item)}</option>
                ))}
              </select>
            </Field>
            <Button variant="primary" disabled={pending.length === 0 || total <= 0} onClick={() => setConfirm(true)}>
              <Icon name="check" className="h-3.5 w-3.5" /> Contabilizar depreciación
            </Button>
            <div className="ml-auto text-right text-[11px] text-gray-500">
              <div>Total a contabilizar</div>
              <div className="text-base font-semibold text-gray-900"><Money value={total} /></div>
            </div>
          </div>
          <DataTable columns={previewColumns} rows={preview} rowKey={row => row.asset.id} empty="No hay activos depreciables." footer={
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gray-500">{preview.length} activos en la vista · {pending.length} pendientes</span>
              <span className="font-semibold text-gray-800">Total del periodo: <Money value={total} /></span>
            </div>
          } />
        </Card>

        <div className="min-w-0 space-y-4">
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-gray-700">Reglas del cierre</h3>
            <ul className="mt-3 space-y-2 text-[11px] leading-4 text-gray-600">
              <li>La depreciación inicia el mes siguiente a la puesta en servicio.</li>
              <li>Un activo en montaje no deprecia hasta quedar en operación.</li>
              <li>La cuota de línea recta se recalcula sobre el valor neto menos el residual y los meses restantes; así absorbe mejoras y revalorizaciones.</li>
              <li>Un periodo ya contabilizado no se duplica: los activos aparecen como contabilizados.</li>
              <li>Si un activo llega al valor residual, queda en estado totalmente depreciado.</li>
            </ul>
          </Card>

          <Card>
            <SectionTitle title="Periodos cerrados" detail="Reversión con trazabilidad" />
            <div className="divide-y divide-gray-100">
              {postedPeriods.map(row => (
                <div key={row.period} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div>
                    <div className="text-[11px] font-medium text-gray-700">{periodLabel(row.period)}</div>
                    <div className="text-[10px] text-gray-400">{row.count} activos · {money(row.amount)}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => actions.reverseDepreciation(row.period)}>Revertir</Button>
                </div>
              ))}
              {postedPeriods.length === 0 && <div className="px-4 py-6 text-center text-[11px] text-gray-500">Sin periodos contabilizados.</div>}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <SectionTitle title="Proyección de depreciación" detail="Próximos doce meses, suma de todos los activos" />
          <div className="p-4">
            <BarChart data={projection} height={170} tone="cyan" formatter={value => compactMoney(value)} />
            <p className="mt-3 text-[10px] text-gray-400">La proyección usa la cuota vigente y no incluye adquisiciones o revalorizaciones futuras.</p>
          </div>
        </Card>
        <Card>
          <SectionTitle title="Historial reciente" detail="Últimos 60 asientos" />
          <div className="max-h-[22rem] overflow-y-auto">
            <DataTable columns={historyColumns} rows={history} rowKey={row => row.id} empty="Sin asientos de depreciación." dense />
          </div>
        </Card>
      </div>

      {confirm && (
        <Modal
          title={`Contabilizar depreciación de ${periodLabel(period)}`}
          subtitle="Se generará un asiento por activo contra la cuenta de gasto y la depreciación acumulada."
          onClose={() => setConfirm(false)}
        >
          <div className="space-y-3 text-xs text-gray-600">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><div className="text-[10px] text-gray-500">Activos</div><div className="text-sm font-semibold text-gray-900">{pending.length}</div></div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><div className="text-[10px] text-gray-500">Valor total</div><div className="text-sm font-semibold text-gray-900"><Money value={total} /></div></div>
            </div>
            <p className="leading-5">La operación es idempotente: si vuelve a ejecutarse el mismo periodo, no se duplican los asientos. La cuenta de gasto sale de la categoría de cada activo (5160 por defecto) y la contrapartida es la 1592.</p>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setConfirm(false)}>Cancelar</Button>
            <Button variant="primary" onClick={() => { actions.runDepreciation(period, units); setConfirm(false); }}>Contabilizar periodo</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
