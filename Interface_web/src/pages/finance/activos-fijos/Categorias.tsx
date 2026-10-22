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
import { assetNetBook, isAssetActive, sum } from '../../../finance/selectors';
import type { AssetCategory, FinanceState } from '../../../finance/types';
import type { AssetActions } from './shared';
import { methodLabel } from './shared';

export default function Categorias({
  state,
  actions,
  onCreate,
  onEdit,
}: {
  state: FinanceState;
  actions: AssetActions;
  onCreate: () => void;
  onEdit: (category: AssetCategory) => void;
}) {
  const active = state.assetCategories.filter(category => category.active);
  const totalAssets = state.assets.filter(isAssetActive).length;

  const columns: Column<AssetCategory>[] = [
    { header: 'Código', cell: row => <span className="font-mono font-semibold text-gray-800">{row.code}</span> },
    { header: 'Categoría', cell: row => <span className="block max-w-52 font-medium text-gray-800">{row.name}</span> },
    {
      header: 'Cuentas PUC',
      cell: row => (
        <div className="font-mono text-[10px] leading-4 text-gray-600">
          <div>Activo {row.assetAccount}</div>
          <div className="text-gray-400">Acum. {row.accumulatedAccount} · Gasto {row.depreciationAccount}</div>
          <div className="text-gray-400">Revalúo {row.revaluationAccount}</div>
        </div>
      ),
    },
    { header: 'Vida contable', align: 'right', cell: row => row.usefulLifeMonths > 0 ? `${row.usefulLifeMonths} m` : 'No deprecia' },
    { header: 'Vida fiscal', align: 'right', cell: row => row.taxUsefulLifeMonths > 0 ? `${row.taxUsefulLifeMonths} m` : '—' },
    { header: 'Residual', align: 'right', cell: row => `${row.residualPct} %` },
    { header: 'Método', cell: row => methodLabel(row.method) },
    {
      header: 'Activos',
      align: 'right',
      cell: row => {
        const assets = state.assets.filter(asset => asset.categoryId === row.id && isAssetActive(asset));
        return <div><div className="font-semibold">{assets.length}</div><div className="text-[10px] text-gray-400"><Money value={sum(assets.map(assetNetBook))} /></div></div>;
      },
    },
    { header: 'Estado', cell: row => <Badge tone={row.active ? 'green' : 'gray'}>{row.active ? 'Activa' : 'Inactiva'}</Badge> },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => onEdit(row)}>Editar</Button>
          <Button size="sm" variant="ghost" onClick={() => actions.updateCategory(row.id, { active: !row.active })}>{row.active ? 'Inactivar' : 'Activar'}</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Categorías activas" value={String(active.length)} detail={`${state.assetCategories.length} en el catálogo`} tone="blue" />
        <KpiCard label="Activos cubiertos" value={String(totalAssets)} detail="Distribuidos por política contable" tone="green" />
        <KpiCard label="Vida útil promedio" value={`${Math.round(active.reduce((total, item) => total + item.usefulLifeMonths, 0) / Math.max(1, active.filter(item => item.usefulLifeMonths > 0).length))} meses`} detail="Solo categorías depreciables" />
        <KpiCard label="Política fiscal" value="Art. 137 ET" detail="Vidas útiles alineadas con la DIAN" tone="violet" />
      </div>

      <Card>
        <SectionTitle
          title="Categorías y políticas contables"
          detail="Cada categoría fija las cuentas PUC, la vida útil contable y fiscal, el residual y el método."
          action={<Button size="sm" variant="primary" onClick={onCreate}>Nueva categoría</Button>}
        />
        <DataTable columns={columns} rows={state.assetCategories} rowKey={row => row.id} onRowClick={row => onEdit(row)} empty="No hay categorías configuradas." />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-xs font-semibold text-gray-700">Referencia normativa</h3>
          <ul className="mt-3 space-y-2 text-[11px] leading-4 text-gray-600">
            <li><strong>NIC 16:</strong> costo, valor residual, vida útil y modelo de revaluación.</li>
            <li><strong>NIC 36:</strong> deterioro cuando el valor recuperable es menor al valor en libros.</li>
            <li><strong>Art. 128 ET:</strong> costo fiscal y deducción de depreciación.</li>
            <li><strong>Art. 137 ET:</strong> vida útil fiscal y depreciación acelerada cuando aplique.</li>
            <li><strong>Art. 134 ET:</strong> métodos de línea recta, saldos decrecientes y unidades de producción.</li>
          </ul>
        </Card>
        <Card className="p-4">
          <h3 className="text-xs font-semibold text-gray-700">Notas de las políticas</h3>
          <div className="mt-3 space-y-2">
            {state.assetCategories.map(category => (
              <div key={category.id} className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-gray-700">{category.code} · {category.name}</span>
                  <Badge tone={category.active ? 'green' : 'gray'}>{category.active ? 'Activa' : 'Inactiva'}</Badge>
                </div>
                <p className="mt-1 text-[10px] leading-4 text-gray-500">{category.note || 'Sin nota normativa.'}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
