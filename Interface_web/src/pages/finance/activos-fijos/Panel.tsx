import type { NavPage } from '../../../components/Shell';
import Icon from '../../../components/Icon';
import {
  Badge,
  BarChart,
  Button,
  Card,
  DataTable,
  KpiCard,
  Money,
  Progress,
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import {
  assetCategoryOf,
  assetDepreciationPct,
  assetGross,
  assetNetBook,
  assetTotals,
  compactMoney,
  money,
  periodLabel,
} from '../../../finance/selectors';
import type { Asset, FinanceState } from '../../../finance/types';
import { FINANCIAL_MODULES } from '../../../data/finance';

export default function Panel({
  state,
  onNavigate,
  onNew,
}: {
  state: FinanceState;
  onNavigate: (page: NavPage) => void;
  onNew: () => void;
}) {
  const totals = assetTotals(state.assets);
  const active = state.assets.filter(asset => asset.status !== 'Vendido' && asset.status !== 'Dado de baja');
  const pendingRevaluations = state.revaluations.filter(item => item.status === 'Borrador' || item.status === 'Aprobada').length;
  const pendingDisposals = state.disposals.filter(item => item.status === 'Solicitada' || item.status === 'Aprobada').length;
  const differences = state.assetReconciliations.filter(item => item.status === 'Diferencia').length;
  const pendingReconciliations = state.assetReconciliations.filter(item => item.status === 'Pendiente').length;
  const inAssembly = state.assets.filter(asset => asset.status === 'En montaje').length;

  const composition = state.assetCategories
    .map(category => ({
      label: category.code,
      category: category.name,
      value: active.filter(asset => asset.categoryId === category.id).reduce((sum, asset) => sum + assetNetBook(asset), 0),
    }))
    .filter(item => item.value > 0);

  const top = [...active].sort((a, b) => assetGross(b) - assetGross(a)).slice(0, 6);
  const columns: Column<Asset>[] = [
    { header: 'Activo', cell: asset => <div><div className="font-mono text-[10px] text-gray-400">{asset.code}</div><div className="max-w-64 truncate font-medium text-gray-800">{asset.name}</div></div> },
    { header: 'Categoría', cell: asset => <span className="block max-w-44 truncate text-gray-600">{assetCategoryOf(state.assetCategories, asset.categoryId)?.name ?? '—'}</span> },
    { header: 'Costo bruto', align: 'right', cell: asset => <Money value={assetGross(asset)} /> },
    { header: 'Valor neto', align: 'right', cell: asset => <Money value={assetNetBook(asset)} className="font-semibold" /> },
    { header: 'Depreciación', width: '11rem', cell: asset => <Progress value={assetDepreciationPct(asset)} tone={assetDepreciationPct(asset) >= 100 ? 'violet' : 'blue'} /> },
    { header: 'Estado', cell: asset => <Badge tone={asset.status === 'En montaje' ? 'amber' : asset.status === 'Totalmente depreciado' ? 'violet' : 'green'}>{asset.status}</Badge> },
  ];

  const alerts: { title: string; detail: string; tone: 'danger' | 'warning' | 'info'; page: NavPage }[] = [];
  if (inAssembly) alerts.push({ title: `${inAssembly} activo${inAssembly === 1 ? '' : 's'} en montaje`, detail: 'Pendiente de puesta en servicio; aún no deprecian.', tone: 'warning', page: 'activos-fijos/registro' });
  if (pendingRevaluations) alerts.push({ title: `${pendingRevaluations} revalorización${pendingRevaluations === 1 ? '' : 'es'} pendiente${pendingRevaluations === 1 ? '' : 's'}`, detail: 'Avalúos por aprobar o aplicar contra el patrimonio.', tone: 'info', page: 'activos-fijos/revalorizaciones' });
  if (pendingDisposals) alerts.push({ title: `${pendingDisposals} baja${pendingDisposals === 1 ? '' : 's'} por gestionar`, detail: 'Solicitudes de retiro pendientes de aprobación o aplicación.', tone: 'warning', page: 'activos-fijos/bajas' });
  if (differences) alerts.push({ title: `${differences} categoría${differences === 1 ? '' : 's'} con diferencia`, detail: 'El mayor no coincide con el valor en libros del módulo.', tone: 'danger', page: 'activos-fijos/conciliacion' });
  if (pendingReconciliations) alerts.push({ title: `${pendingReconciliations} categoría${pendingReconciliations === 1 ? '' : 's'} sin revisar`, detail: 'Conciliación del periodo pendiente de verificación.', tone: 'info', page: 'activos-fijos/conciliacion' });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Costo bruto" value={money(totals.gross)} detail={`${totals.count} activos en libros`} tone="blue" />
        <KpiCard label="Depreciación acumulada" value={money(totals.accumulated)} detail={`${totals.gross > 0 ? ((totals.accumulated / totals.gross) * 100).toFixed(1) : '0,0'} % del costo`} tone="amber" />
        <KpiCard label="Valor neto en libros" value={money(totals.net)} detail="Propiedades, planta y equipo" tone="green" />
        <KpiCard label="Superávit por revalorización" value={money(totals.revaluation)} detail="Registrado en el patrimonio (3805)" tone="violet" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <SectionTitle
            title="Composición del valor neto"
            detail={`${state.assetCategories.length} categorías · ${totals.inService} activos en operación`}
            action={<Button size="sm" variant="primary" onClick={onNew}><Icon name="plus" className="h-3.5 w-3.5" /> Nuevo activo</Button>}
          />
          <div className="grid gap-4 p-4 lg:grid-cols-[1fr_15rem]">
            <BarChart
              data={composition.map(item => ({ label: item.label, value: item.value }))}
              height={180}
              tone="cyan"
              formatter={value => compactMoney(value)}
            />
            <div className="space-y-2">
              {composition.map(item => (
                <div key={item.label} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-sm bg-cyan-500" /><span className="truncate text-gray-600">{item.category}</span></span>
                  <span className="tabular font-medium text-gray-800">{compactMoney(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Alertas del ciclo de vida" detail="Prioridades de gestión del módulo" />
          <div className="divide-y divide-gray-100">
            {alerts.map(alert => (
              <button key={alert.title} type="button" onClick={() => onNavigate(alert.page)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-gray-50">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${alert.tone === 'danger' ? 'bg-red-500' : alert.tone === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-gray-800">{alert.title}</span><span className="mt-0.5 block text-[11px] leading-4 text-gray-500">{alert.detail}</span></span>
                <Icon name="chevron" className="h-4 w-4 shrink-0 text-gray-300" />
              </button>
            ))}
            {alerts.length === 0 && <div className="px-4 py-10 text-center text-xs text-gray-500">Sin alertas pendientes. El módulo está al día.</div>}
          </div>
          <div className="border-t border-gray-100 p-3">
            <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
              {FINANCIAL_MODULES['activos-fijos'].flow.map((step, index) => (
                <span key={step} className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2 py-1">{step}</span>
                  {index < FINANCIAL_MODULES['activos-fijos'].flow.length - 1 && <Icon name="arrow" className="h-3 w-3 text-gray-300" />}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Principales activos" detail="Ordenados por costo bruto en libros" action={<Button size="sm" onClick={() => onNavigate('activos-fijos/registro')}>Ver registro completo</Button>} />
        <DataTable columns={columns} rows={top} rowKey={row => row.id} onRowClick={row => { onNavigate('activos-fijos/registro'); }} empty="No hay activos registrados." />
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-[11px] font-medium text-gray-500">Totales por estado</div>
          <div className="mt-3 space-y-2 text-[11px]">
            <div className="flex justify-between"><span className="text-gray-500">En operación</span><strong>{totals.inService}</strong></div>
            <div className="flex justify-between"><span className="text-gray-500">En montaje</span><strong>{totals.inAssembly}</strong></div>
            <div className="flex justify-between"><span className="text-gray-500">Totalmente depreciados</span><strong>{totals.fullyDepreciated}</strong></div>
            <div className="flex justify-between"><span className="text-gray-500">Vendidos o dados de baja</span><strong>{state.assets.length - totals.count}</strong></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-medium text-gray-500">Últimos movimientos</div>
          <div className="mt-3 space-y-2">
            {state.assetMovements.slice(0, 4).map(movement => {
              const asset = state.assets.find(item => item.id === movement.assetId);
              return (
                <div key={movement.id} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0"><span className="block truncate font-medium text-gray-700">{asset?.code ?? movement.assetId}</span><span className="block text-gray-400">{movement.type} · {periodLabel(movement.date.slice(0, 7))}</span></span>
                  <Money value={movement.amount} className="shrink-0" />
                </div>
              );
            })}
            {state.assetMovements.length === 0 && <p className="text-[11px] text-gray-500">Sin movimientos.</p>}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-medium text-gray-500">Última depreciación</div>
          <div className="mt-3">
            <div className="text-lg font-semibold text-gray-900">{periodLabel('2026-01')}</div>
            <p className="mt-1 text-[11px] leading-4 text-gray-500">
              {state.depreciationEntries.filter(entry => entry.period === '2026-01' && entry.status === 'Contabilizada').length} asientos contabilizados por{' '}
              <Money value={state.depreciationEntries.filter(entry => entry.period === '2026-01' && entry.status === 'Contabilizada').reduce((sum, entry) => sum + entry.amount, 0)} />.
            </p>
            <Button size="sm" variant="primary" className="mt-3" onClick={() => onNavigate('activos-fijos/depreciacion')}>Cerrar febrero</Button>
          </div>
        </Card>
      </div>

      <p className="text-[10px] leading-4 text-gray-400">
        Las cifras se calculan desde el registro de activos y sus movimientos. La cuenta 1592 acumula la depreciación,
        la 1596 el deterioro y la 3805 el superávit por revalorización.
      </p>
    </div>
  );
}
