import { useMemo, useState } from 'react';
import Icon from '../../../components/Icon';
import {
  Badge,
  Button,
  Card,
  DataTable,
  FilterBar,
  FilterSelect,
  KpiCard,
  Money,
  Progress,
  SearchInput,
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import {
  assetCategoryOf,
  assetDepreciationPct,
  assetGross,
  assetNetBook,
  assetTotals,
  fmtDate,
  money,
} from '../../../finance/selectors';
import type { Asset, FinanceState } from '../../../finance/types';
import { assetStatusTone } from './shared';

export default function Registro({
  state,
  onOpen,
  onNew,
}: {
  state: FinanceState;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const [status, setStatus] = useState('Todos');
  const [center, setCenter] = useState('Todos');

  const totals = assetTotals(state.assets);
  const centers = Array.from(new Set(state.assets.map(asset => asset.costCenter))).sort();

  const rows = useMemo(() => {
    const haystack = query.trim().toLowerCase();
    return state.assets
      .filter(asset => {
        const matchesText = haystack === ''
          || asset.code.toLowerCase().includes(haystack)
          || asset.name.toLowerCase().includes(haystack)
          || asset.serial.toLowerCase().includes(haystack)
          || asset.plate.toLowerCase().includes(haystack)
          || asset.responsible.toLowerCase().includes(haystack);
        const matchesCategory = category === 'Todas' || asset.categoryId === category;
        const matchesStatus = status === 'Todos' || asset.status === status;
        const matchesCenter = center === 'Todos' || asset.costCenter === center;
        return matchesText && matchesCategory && matchesStatus && matchesCenter;
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [state.assets, query, category, status, center]);

  const columns: Column<Asset>[] = [
    {
      header: 'Activo',
      cell: asset => (
        <div>
          <div className="font-mono text-[10px] font-semibold text-petroleum-600">{asset.code}</div>
          <div className="max-w-64 truncate font-medium text-gray-800">{asset.name}</div>
          <div className="text-[10px] text-gray-400">{asset.serial || asset.plate || 'Sin identificación'}</div>
        </div>
      ),
    },
    { header: 'Categoría', cell: asset => <span className="block max-w-44 truncate text-gray-600">{assetCategoryOf(state.assetCategories, asset.categoryId)?.name ?? '—'}</span> },
    { header: 'Centro', cell: asset => <span className="font-mono text-[10px] text-gray-500">{asset.costCenter}</span> },
    { header: 'Adquisición', cell: asset => fmtDate(asset.acquisitionDate) },
    { header: 'Costo bruto', align: 'right', cell: asset => <Money value={assetGross(asset)} /> },
    { header: 'Valor neto', align: 'right', cell: asset => <Money value={assetNetBook(asset)} className="font-semibold" /> },
    { header: 'Depreciación', width: '9rem', cell: asset => <Progress value={assetDepreciationPct(asset)} tone={assetDepreciationPct(asset) >= 100 ? 'violet' : 'blue'} /> },
    { header: 'Estado', cell: asset => <Badge tone={assetStatusTone(asset.status)}>{asset.status}</Badge> },
    { header: '', align: 'right', cell: () => <span className="text-[10px] font-medium text-petroleum-600">Ver ficha</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Activos en libros" value={String(totals.count)} detail={`${totals.inService} en operación · ${totals.inAssembly} en montaje`} tone="blue" />
        <KpiCard label="Costo bruto" value={money(totals.gross)} detail="Incluye mejoras y revalorizaciones" />
        <KpiCard label="Valor neto" value={money(totals.net)} detail="Después de depreciación y deterioro" tone="green" />
        <KpiCard label="Totalmente depreciados" value={String(totals.fullyDepreciated)} detail="Requieren revisión de reemplazo" tone="violet" />
      </div>

      <Card>
        <SectionTitle
          title="Inventario de propiedades, planta y equipo"
          detail={`${rows.length} activos con los filtros aplicados`}
          action={<Button size="sm" variant="primary" onClick={onNew}><Icon name="plus" className="h-3.5 w-3.5" /> Nuevo activo</Button>}
        />
        <FilterBar>
          <SearchInput placeholder="Buscar código, nombre, serial, placa o responsable…" value={query} onChange={event => setQuery(event.target.value)} />
          <FilterSelect value={category} onChange={event => setCategory(event.target.value)} aria-label="Categoría">
            <option value="Todas">Todas las categorías</option>
            {state.assetCategories.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
          </FilterSelect>
          <FilterSelect value={status} onChange={event => setStatus(event.target.value)} aria-label="Estado">
            {['Todos', 'En operación', 'En montaje', 'Totalmente depreciado', 'Vendido', 'Dado de baja'].map(value => <option key={value}>{value}</option>)}
          </FilterSelect>
          <FilterSelect value={center} onChange={event => setCenter(event.target.value)} aria-label="Centro de costo">
            <option value="Todos">Todos los centros</option>
            {centers.map(value => <option key={value}>{value}</option>)}
          </FilterSelect>
        </FilterBar>
        <DataTable columns={columns} rows={rows} rowKey={row => row.id} onRowClick={row => onOpen(row.id)} empty="No hay activos con los filtros aplicados." />
      </Card>

      <div className="flex flex-wrap items-center gap-4 text-[10px] text-gray-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> En operación</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> En montaje: no deprecia</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-500" /> Totalmente depreciado</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gray-400" /> Vendido o dado de baja: conserva histórico</span>
      </div>
    </div>
  );
}
