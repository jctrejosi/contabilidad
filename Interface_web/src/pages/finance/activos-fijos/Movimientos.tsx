import { useMemo, useState } from 'react';
import Icon from '../../../components/Icon';
import {
  Badge,
  Button,
  Card,
  DataTable,
  FilterBar,
  FilterSelect,
  Money,
  SearchInput,
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import { fmtDate, periodLabel, periodOf } from '../../../finance/selectors';
import type { AssetMovement, FinanceState } from '../../../finance/types';

const TYPE_TONE: Record<string, 'blue' | 'violet' | 'amber' | 'red' | 'gray' | 'green' | 'cyan'> = {
  Adquisición: 'blue',
  Mejora: 'cyan',
  Depreciación: 'blue',
  Revalorización: 'violet',
  Deterioro: 'red',
  Baja: 'gray',
  Venta: 'green',
  Traslado: 'gray',
  Ajuste: 'amber',
};

export default function Movimientos({
  state,
  onOpen,
  onNewAsset,
  onImprove,
}: {
  state: FinanceState;
  onOpen: (id: string) => void;
  onNewAsset: () => void;
  onImprove: () => void;
}) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('Todos');
  const [period, setPeriod] = useState('');

  const movements = useMemo(() => {
    const haystack = query.trim().toLowerCase();
    return state.assetMovements
      .filter(movement => {
        const asset = state.assets.find(item => item.id === movement.assetId);
        const matchesText = haystack === ''
          || movement.description.toLowerCase().includes(haystack)
          || movement.reference.toLowerCase().includes(haystack)
          || (asset?.code.toLowerCase().includes(haystack) ?? false)
          || (asset?.name.toLowerCase().includes(haystack) ?? false);
        const matchesType = type === 'Todos' || movement.type === type;
        const matchesPeriod = period === '' || periodOf(movement.date) === period;
        return matchesText && matchesType && matchesPeriod;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [state.assetMovements, state.assets, query, type, period]);

  const totals = useMemo(() => {
    const result: Record<string, number> = {};
    for (const movement of state.assetMovements) {
      result[movement.type] = (result[movement.type] ?? 0) + movement.amount;
    }
    return result;
  }, [state.assetMovements]);

  const columns: Column<AssetMovement>[] = [
    { header: 'Fecha', cell: row => fmtDate(row.date) },
    { header: 'Activo', cell: row => { const asset = state.assets.find(item => item.id === row.assetId); return <div><div className="font-mono text-[10px] text-gray-400">{asset?.code ?? '—'}</div><div className="max-w-52 truncate text-gray-700">{asset?.name ?? 'Activo eliminado'}</div></div>; } },
    { header: 'Tipo', cell: row => <Badge tone={TYPE_TONE[row.type] ?? 'gray'}>{row.type}</Badge> },
    { header: 'Detalle', cell: row => <span className="block max-w-72 truncate text-gray-600">{row.description}</span> },
    { header: 'Débito', cell: row => <span className="font-mono text-[10px]">{row.debitAccount}</span> },
    { header: 'Crédito', cell: row => <span className="font-mono text-[10px]">{row.creditAccount}</span> },
    { header: 'Valor', align: 'right', cell: row => <Money value={row.amount} className="font-semibold" /> },
    { header: 'Soporte', cell: row => <span className="block max-w-32 truncate text-[10px] text-gray-500">{row.reference || '—'}</span> },
    { header: 'Usuario', cell: row => <span className="text-[10px] text-gray-500">{row.user}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {['Adquisición', 'Mejora', 'Depreciación', 'Revalorización', 'Ajuste'].map(key => (
          <div key={key} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="text-[10px] font-medium text-gray-500">{key}</div>
            <div className="mt-1 text-sm font-semibold text-gray-900"><Money value={totals[key] ?? 0} /></div>
            <div className="text-[10px] text-gray-400">{state.assetMovements.filter(item => item.type === key).length} movimientos</div>
          </div>
        ))}
      </div>

      <Card>
        <SectionTitle
          title="Libro de movimientos de activos fijos"
          detail={`${movements.length} asientos · el módulo deja débito, crédito y documento soporte en cada hecho económico`}
          action={<div className="flex gap-2"><Button size="sm" onClick={onImprove}>Registrar mejora</Button><Button size="sm" variant="primary" onClick={onNewAsset}><Icon name="plus" className="h-3.5 w-3.5" /> Registrar adquisición</Button></div>}
        />
        <FilterBar>
          <SearchInput placeholder="Buscar activo, detalle o soporte…" value={query} onChange={event => setQuery(event.target.value)} />
          <FilterSelect value={type} onChange={event => setType(event.target.value)} aria-label="Tipo">
            {['Todos', 'Adquisición', 'Mejora', 'Depreciación', 'Revalorización', 'Deterioro', 'Baja', 'Venta', 'Traslado', 'Ajuste'].map(value => <option key={value}>{value}</option>)}
          </FilterSelect>
          <input type="month" className="w-48 flex-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100" value={period} onChange={event => setPeriod(event.target.value)} aria-label="Periodo" />
          {period && <Button size="sm" variant="ghost" onClick={() => setPeriod('')}>Limpiar periodo</Button>}
        </FilterBar>
        <DataTable columns={columns} rows={movements} rowKey={row => row.id} onRowClick={row => onOpen(row.assetId)} empty="No hay movimientos con los filtros aplicados." />
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
          <Icon name="document" className="h-4 w-4 text-petroleum-500" />
          <span>Contrapartidas: proveedores (2205), bancos (1110), depreciación acumulada (1592), deterioro (1596), patrimonio (3805), utilidad (4245) y pérdida (5395).</span>
        </div>
      </Card>

      <p className="text-[10px] text-gray-400">Periodo de referencia: {period ? periodLabel(period) : 'todos los periodos'}.</p>
    </div>
  );
}
