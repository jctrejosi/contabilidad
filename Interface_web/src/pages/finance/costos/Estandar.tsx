import { useState } from 'react';
import { Badge, Button, Card, DataTable, FilterBar, FilterSelect, KpiCard, Money, SearchInput, SectionTitle } from '../../../components/finance/ui';
import type { CostObject, FinanceState } from '../../../finance/types';
import { actualCost, centerById, money, objectMargin, priceVariance, quantityVariance, standardCost, totalVariance } from './shared';

export default function Estandar({
  state,
  onCreate,
  onOpen,
}: {
  state: FinanceState;
  onCreate: () => void;
  onOpen: (object: CostObject) => void;
}) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('Todos');

  const rows = state.costObjects
    .filter(object => kind === 'Todos' || object.kind === kind)
    .filter(object => `${object.code} ${object.name} ${object.productCode}`.toLowerCase().includes(query.toLowerCase()))
    .map(object => ({
      id: object.id,
      object,
      center: centerById(state, object.centerId),
      standard: standardCost(object),
      actual: actualCost(object),
      variance: totalVariance(object),
      price: priceVariance(object),
      quantity: quantityVariance(object),
      margin: objectMargin(object),
    }));

  const standard = state.costObjects.reduce((total, object) => total + standardCost(object), 0);
  const actual = state.costObjects.reduce((total, object) => total + actualCost(object), 0);
  const variance = actual - standard;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Costo estándar" value={<Money value={standard} />} detail={`${state.costObjects.length} objetos de costo`} tone="blue" />
        <KpiCard label="Costo real" value={<Money value={actual} />} detail="Cantidad y precio reales" tone="cyan" />
        <KpiCard label="Variación neta" value={<Money value={variance} />} detail={variance > 0 ? 'Desfavorable' : 'Favorable'} tone={variance > 0 ? 'red' : 'green'} />
        <KpiCard label="Variación relativa" value={`${standard > 0 ? ((variance / standard) * 100).toFixed(1) : '0.0'} %`} detail="Sobre el costo estándar" tone={Math.abs(standard > 0 ? variance / standard : 0) > 0.05 ? 'amber' : 'green'} />
      </div>

      <Card>
        <SectionTitle
          title="Costeo estándar y variaciones"
          detail="Variación de precio = (precio real − estándar) × cantidad real. Variación de cantidad = (cantidad real − estándar) × precio estándar."
          action={<Button variant="primary" size="sm" onClick={onCreate}>Nuevo objeto de costo</Button>}
        />
        <FilterBar>
          <SearchInput placeholder="Buscar objeto, código o producto…" value={query} onChange={event => setQuery(event.target.value)} />
          <FilterSelect value={kind} onChange={event => setKind(event.target.value)}>
            {['Todos', 'Producto', 'Servicio', 'Proyecto'].map(value => <option key={value}>{value}</option>)}
          </FilterSelect>
        </FilterBar>
        <DataTable
          rows={rows}
          rowKey={row => row.id}
          onRowClick={row => onOpen(row.object)}
          columns={[
            { header: 'Objeto', cell: row => <div><div className="font-medium text-gray-800">{row.object.name}</div><div className="text-[9px] text-gray-400">{row.object.code} · {row.center?.name ?? 'Sin centro'}</div></div> },
            { header: 'Tipo', cell: row => <Badge tone={row.object.kind === 'Proyecto' ? 'violet' : row.object.kind === 'Servicio' ? 'blue' : 'cyan'}>{row.object.kind}</Badge> },
            { header: 'Unidades', align: 'right', cell: row => <span className="tabular">{row.object.units.toLocaleString('es-CO')}</span> },
            { header: 'Estándar unitario', align: 'right', cell: row => <span className="tabular text-gray-600">{money((row.object.standardQty * row.object.standardPrice))}</span> },
            { header: 'Real unitario', align: 'right', cell: row => <span className="tabular text-gray-600">{money((row.object.actualQty * row.object.actualPrice))}</span> },
            { header: 'Costo estándar', align: 'right', cell: row => <Money value={row.standard} /> },
            { header: 'Costo real', align: 'right', cell: row => <Money value={row.actual} /> },
            { header: 'Var. precio', align: 'right', cell: row => <span className={row.price > 0 ? 'tabular text-red-700' : 'tabular text-emerald-700'}>{money(row.price)}</span> },
            { header: 'Var. cantidad', align: 'right', cell: row => <span className={row.quantity > 0 ? 'tabular text-red-700' : 'tabular text-emerald-700'}>{money(row.quantity)}</span> },
            { header: 'Margen', align: 'right', cell: row => <span className={row.margin >= 35 ? 'tabular font-semibold text-emerald-700' : 'tabular font-semibold text-amber-700'}>{row.margin.toFixed(1)} %</span> },
          ]}
          footer={<div className="flex items-center justify-between text-[11px] text-gray-600"><span>{rows.length} objetos visibles</span><span className="tabular font-semibold">Variación: {money(rows.reduce((total, row) => total + row.variance, 0))}</span></div>}
        />
      </Card>
    </div>
  );
}
