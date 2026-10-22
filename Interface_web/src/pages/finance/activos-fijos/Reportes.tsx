import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  INPUT,
  KpiCard,
  Money,
  SectionTitle,
  Tabs,
  type Column,
} from '../../../components/finance/ui';
import {
  assetCategoryOf,
  assetGross,
  assetMonthlyDepreciation,
  assetNetBook,
  assetProjection,
  compactMoney,
  fmtDate,
  isAssetActive,
  money,
  periodLabel,
} from '../../../finance/selectors';
import type { Asset, FinanceState } from '../../../finance/types';
import type { AssetActions } from './shared';

export default function Reportes({ state, actions }: { state: FinanceState; actions: AssetActions }) {
  const [tab, setTab] = useState('libro');
  const [selectedAsset, setSelectedAsset] = useState(state.assets.find(isAssetActive)?.id ?? state.assets[0]?.id ?? '');

  const active = state.assets.filter(isAssetActive);
  const totals = {
    gross: active.reduce((sum, asset) => sum + assetGross(asset), 0),
    net: active.reduce((sum, asset) => sum + assetNetBook(asset), 0),
    accumulated: active.reduce((sum, asset) => sum + asset.accumulatedDepreciation, 0),
    impairment: active.reduce((sum, asset) => sum + asset.impairment, 0),
  };

  const asset = state.assets.find(item => item.id === selectedAsset);
  const projection = useMemo(() => asset ? assetProjection(asset, 12) : [], [asset]);

  const fiscalRows = active.map(item => {
    const category = assetCategoryOf(state.assetCategories, item.categoryId);
    const taxLife = category?.taxUsefulLifeMonths ?? 0;
    const accountingMonthly = item.method === 'Unidades de producción'
      ? Math.max(0, assetGross(item) - item.residualValue) / Math.max(1, item.usefulLifeMonths)
      : assetMonthlyDepreciation(item);
    const taxMonthly = taxLife > 0 ? Math.max(0, assetGross(item) - item.residualValue) / taxLife : 0;
    return {
      asset: item,
      category,
      accountingMonthly,
      taxMonthly,
      annualDifference: (taxMonthly - accountingMonthly) * 12,
    };
  });
  const totalAnnualDifference = fiscalRows.reduce((sum, row) => sum + row.annualDifference, 0);

  const libroColumns: Column<Asset>[] = [
    { header: 'Código', cell: row => <span className="whitespace-nowrap font-mono text-[10px] font-semibold text-petroleum-600">{row.code}</span> },
    { header: 'Activo', cell: row => <span className="block max-w-52 truncate font-medium text-gray-800">{row.name}</span> },
    { header: 'Categoría', cell: row => <span className="block max-w-40 truncate text-gray-600">{assetCategoryOf(state.assetCategories, row.categoryId)?.name ?? '—'}</span> },
    { header: 'Adquisición', cell: row => fmtDate(row.acquisitionDate) },
    {
      header: 'Costo y ajustes',
      align: 'right',
      cell: row => (
        <div>
          <Money value={row.acquisitionCost} />
          <div className="text-[9px] text-gray-400">Mejoras <Money value={row.improvements} /> · Revalúo <Money value={row.revaluation} /></div>
        </div>
      ),
    },
    {
      header: 'Depreciación',
      align: 'right',
      cell: row => (
        <div>
          <Money value={row.accumulatedDepreciation} />
          <div className="text-[9px] text-gray-400">Deterioro <Money value={row.impairment} /></div>
        </div>
      ),
    },
    { header: 'Valor neto', align: 'right', cell: row => <Money value={assetNetBook(row)} className="font-semibold" /> },
    { header: 'Estado', cell: row => <Badge tone={row.status === 'En montaje' ? 'amber' : row.status === 'Totalmente depreciado' ? 'violet' : row.status === 'Vendido' || row.status === 'Dado de baja' ? 'gray' : 'green'}>{row.status}</Badge> },
  ];

  const fiscalColumns: Column<typeof fiscalRows[number]>[] = [
    { header: 'Activo', cell: row => <div><div className="font-mono text-[10px] text-gray-400">{row.asset.code}</div><div className="max-w-52 truncate text-gray-700">{row.asset.name}</div></div> },
    { header: 'Categoría', cell: row => <span className="block max-w-40 truncate text-gray-600">{row.category?.name ?? '—'}</span> },
    { header: 'Vida contable', align: 'right', cell: row => `${Math.round((row.category?.usefulLifeMonths ?? 0) / 12)} años` },
    { header: 'Vida fiscal', align: 'right', cell: row => `${Math.round((row.category?.taxUsefulLifeMonths ?? 0) / 12)} años` },
    { header: 'Cuota contable', align: 'right', cell: row => <Money value={row.accountingMonthly} /> },
    { header: 'Cuota fiscal', align: 'right', cell: row => <Money value={row.taxMonthly} /> },
    { header: 'Diferencia anual', align: 'right', cell: row => <Money value={row.annualDifference} className={Math.abs(row.annualDifference) < 1 ? 'text-emerald-700' : 'text-amber-700'} /> },
    { header: 'Efecto', cell: row => Math.abs(row.annualDifference) < 1 ? 'Sin diferencia' : row.annualDifference > 0 ? 'Deducción adicional' : 'Diferencia temporaria' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Costo bruto" value={money(totals.gross)} detail={`${active.length} activos vigentes`} tone="blue" />
        <KpiCard label="Depreciación acumulada" value={money(totals.accumulated)} detail={`Deterioro ${money(totals.impairment)}`} tone="amber" />
        <KpiCard label="Valor neto" value={money(totals.net)} detail="Base para el libro de activos" tone="green" />
        <KpiCard label="Diferencia fiscal anual" value={compactMoney(totalAnnualDifference)} detail="Cuota fiscal menos cuota contable" tone={Math.abs(totalAnnualDifference) < 1 ? 'green' : 'violet'} />
      </div>

      <Card>
        <Tabs
          items={[
            { id: 'libro', label: 'Libro de activos' },
            { id: 'cedula', label: 'Cédula de depreciación' },
            { id: 'fiscal', label: 'Fiscal vs. NIIF' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'libro' && (
          <div>
            <SectionTitle
              title="Libro de propiedades, planta y equipo"
              detail="Costo, mejoras, revalorización, depreciación, deterioro y valor neto por activo."
              action={<Button size="sm" onClick={() => actions.showToast('Libro de activos exportado (simulación).')}>Exportar</Button>}
            />
            <DataTable columns={libroColumns} rows={active} rowKey={row => row.id} empty="No hay activos registrados." />
            <p className="border-t border-gray-100 px-4 py-2 text-[10px] text-gray-400">El libro incluye solo activos vigentes. Los vendidos y dados de baja conservan su histórico en el registro de activos.</p>
          </div>
        )}

        {tab === 'cedula' && (
          <div>
            <SectionTitle title="Cédula de depreciación" detail="Proyección mensual del activo seleccionado para los próximos doce meses." />
            <div className="flex flex-wrap items-end gap-2 border-b border-gray-100 px-4 py-3">
              <Field label="Activo">
                <select className={INPUT} value={selectedAsset} onChange={event => setSelectedAsset(event.target.value)}>
                  {state.assets.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
                </select>
              </Field>
              <Button size="sm" onClick={() => actions.showToast('Cédula de depreciación exportada (simulación).')}>Exportar cédula</Button>
            </div>
            {asset && (
              <div className="grid grid-cols-2 gap-2 p-4 lg:grid-cols-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><div className="text-[10px] text-gray-500">Costo bruto</div><div className="mt-1 text-sm font-semibold"><Money value={assetGross(asset)} /></div></div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><div className="text-[10px] text-gray-500">Depreciación acumulada</div><div className="mt-1 text-sm font-semibold"><Money value={asset.accumulatedDepreciation} /></div></div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><div className="text-[10px] text-gray-500">Valor neto</div><div className="mt-1 text-sm font-semibold"><Money value={assetNetBook(asset)} /></div></div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><div className="text-[10px] text-gray-500">Cuota mensual</div><div className="mt-1 text-sm font-semibold"><Money value={assetMonthlyDepreciation(asset)} /></div></div>
              </div>
            )}
            <DataTable
              columns={[
                { header: 'Periodo', cell: row => periodLabel(row.period) },
                { header: 'Depreciación', align: 'right', cell: row => <Money value={row.amount} /> },
                { header: 'Acumulado', align: 'right', cell: row => <Money value={row.accumulated} /> },
                { header: 'Valor neto proyectado', align: 'right', cell: row => asset ? <Money value={Math.max(0, assetGross(asset) - asset.impairment - row.accumulated)} /> : <span>—</span> },
              ]}
              rows={projection}
              rowKey={row => row.period}
              empty="Seleccione un activo depreciable."
              dense
            />
          </div>
        )}

        {tab === 'fiscal' && (
          <div>
            <SectionTitle
              title="Comparativo fiscal vs. NIIF"
              detail="La vida útil fiscal del Art. 137 ET puede diferir de la vida útil contable y genera diferencias temporales."
              action={<Button size="sm" onClick={() => actions.showToast('Reporte fiscal exportado (simulación).')}>Exportar reporte</Button>}
            />
            <DataTable columns={fiscalColumns} rows={fiscalRows} rowKey={row => row.asset.id} empty="No hay activos vigentes." />
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-[11px] text-gray-600">
              Diferencia anual total: <strong><Money value={totalAnnualDifference} /></strong>. Un valor positivo indica mayor deducción fiscal; uno negativo, una diferencia temporaria que se revierte en los años siguientes.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
