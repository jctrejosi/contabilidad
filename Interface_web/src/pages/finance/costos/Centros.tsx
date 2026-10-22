import { useState } from 'react';
import { Badge, Button, Card, DataTable, FilterBar, FilterSelect, KpiCard, Money, SearchInput, SectionTitle } from '../../../components/finance/ui';
import type { CostCenter, FinanceState } from '../../../finance/types';
import { allocatedForCenter, driverBasis, money } from './shared';

export default function Centros({
  state,
  onCreate,
  onEdit,
}: {
  state: FinanceState;
  onCreate: () => void;
  onEdit: (center: CostCenter) => void;
}) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('Todos');

  const rows = state.costCenters
    .filter(center => kind === 'Todos' || center.kind === kind)
    .filter(center => `${center.code} ${center.name} ${center.manager}`.toLowerCase().includes(query.toLowerCase()))
    .map(center => ({
      id: center.id,
      center,
      cif: allocatedForCenter(state, center.id),
      total: center.directCost + allocatedForCenter(state, center.id),
      basis: driverBasis(center, center.driver),
    }));

  const direct = state.costCenters.reduce((total, center) => total + center.directCost, 0);
  const active = state.costCenters.filter(center => center.status === 'Activo').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Centros registrados" value={String(state.costCenters.length)} detail={`${active} activos`} tone="blue" />
        <KpiCard label="Costo directo acumulado" value={<Money value={direct} />} detail="Antes de CIF" />
        <KpiCard label="CIF asignado" value={<Money value={state.costAllocations.reduce((total, item) => total + item.amount, 0)} />} detail={`${state.costPools.length} pools del período`} tone="cyan" />
        <KpiCard label="Tipos de centro" value={String(new Set(state.costCenters.map(center => center.kind)).size)} detail="Producción, servicio, administración y comercial" />
      </div>

      <Card>
        <SectionTitle
          title="Centros de costo"
          detail="Cada centro acumula costos directos y recibe CIF según su base de distribución."
          action={<Button variant="primary" size="sm" onClick={onCreate}>Nuevo centro</Button>}
        />
        <FilterBar>
          <SearchInput placeholder="Buscar código, nombre o responsable…" value={query} onChange={event => setQuery(event.target.value)} />
          <FilterSelect value={kind} onChange={event => setKind(event.target.value)}>
            {['Todos', 'Producción', 'Servicio', 'Administrativo', 'Comercial'].map(value => <option key={value}>{value}</option>)}
          </FilterSelect>
        </FilterBar>
        <DataTable
          rows={rows}
          rowKey={row => row.id}
          onRowClick={row => onEdit(row.center)}
          columns={[
            { header: 'Centro', cell: row => <div><div className="font-medium text-gray-800">{row.center.name}</div><div className="text-[9px] text-gray-400">{row.center.code} · {row.center.manager}</div></div> },
            { header: 'Tipo', cell: row => <Badge tone={row.center.kind === 'Producción' ? 'blue' : row.center.kind === 'Servicio' ? 'cyan' : row.center.kind === 'Comercial' ? 'violet' : 'gray'}>{row.center.kind}</Badge> },
            { header: 'Inductor', cell: row => <div><div className="text-gray-700">{row.center.driver}</div><div className="text-[9px] text-gray-400">{row.basis.toLocaleString('es-CO')} {row.center.driverUnit}</div></div> },
            { header: 'Costo directo', align: 'right', cell: row => <Money value={row.center.directCost} /> },
            { header: 'CIF asignado', align: 'right', cell: row => <Money value={row.cif} /> },
            { header: 'Costo total', align: 'right', cell: row => <span className="tabular font-semibold text-gray-800">{money(row.total)}</span> },
            { header: 'Estado', cell: row => <Badge tone={row.center.status === 'Activo' ? 'green' : 'gray'}>{row.center.status}</Badge> },
            { header: '', align: 'right', cell: row => <Button size="sm" onClick={event => { event.stopPropagation(); onEdit(row.center); }}>Editar</Button> },
          ]}
          footer={<div className="flex items-center justify-between text-[11px] text-gray-600"><span>{rows.length} centros visibles</span><span className="tabular font-semibold">Costo directo: {money(rows.reduce((total, row) => total + row.center.directCost, 0))}</span></div>}
        />
      </Card>
    </div>
  );
}
