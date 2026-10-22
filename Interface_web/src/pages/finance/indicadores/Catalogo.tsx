import { useState } from 'react';
import { Badge, Button, Card, DataTable, FilterBar, FilterSelect, KpiCard, Progress, SearchInput, SectionTitle } from '../../../components/finance/ui';
import type { FinanceState, Indicator } from '../../../finance/types';
import { formatIndicator, indicatorAchieved, indicatorCompliance } from './shared';

export default function Catalogo({
  state,
  onCreate,
  onEdit,
}: {
  state: FinanceState;
  onCreate: () => void;
  onEdit: (indicator: Indicator) => void;
}) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('Todos');

  const rows = state.indicators
    .filter(indicator => group === 'Todos' || indicator.group === group)
    .filter(indicator => `${indicator.code} ${indicator.name} ${indicator.formula}`.toLowerCase().includes(query.toLowerCase()))
    .map(indicator => ({ id: indicator.id, indicator, ok: indicatorAchieved(indicator), compliance: indicatorCompliance(indicator) }));

  const achieved = state.indicators.filter(indicatorAchieved).length;
  const groups = [...new Set(state.indicators.map(indicator => indicator.group))];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Indicadores" value={String(state.indicators.length)} detail={`${groups.length} grupos de análisis`} tone="blue" />
        <KpiCard label="En meta" value={String(achieved)} detail={`${state.indicators.length - achieved} en riesgo`} tone="green" />
        <KpiCard label="Cumplimiento promedio" value={`${state.indicators.length > 0 ? (state.indicators.reduce((total, indicator) => total + Math.min(100, indicatorCompliance(indicator)), 0) / state.indicators.length).toFixed(1) : '0.0'} %`} detail="Sobre la meta definida" tone="cyan" />
        <KpiCard label="Grupos" value={String(groups.length)} detail={groups.join(' · ')} />
      </div>

      <Card>
        <SectionTitle
          title="Catálogo de indicadores"
          detail="Meta, valor actual, valor anterior y dirección de mejora."
          action={<Button variant="primary" size="sm" onClick={onCreate}>Nuevo indicador</Button>}
        />
        <FilterBar>
          <SearchInput placeholder="Buscar código, nombre o fórmula…" value={query} onChange={event => setQuery(event.target.value)} />
          <FilterSelect value={group} onChange={event => setGroup(event.target.value)}>
            {['Todos', ...groups].map(value => <option key={value}>{value}</option>)}
          </FilterSelect>
        </FilterBar>
        <DataTable
          rows={rows}
          rowKey={row => row.id}
          onRowClick={row => onEdit(row.indicator)}
          columns={[
            { header: 'Indicador', cell: row => <div><div className="font-medium text-gray-800">{row.indicator.name}</div><div className="text-[9px] text-gray-400">{row.indicator.code} · {row.indicator.formula}</div></div> },
            { header: 'Grupo', cell: row => <Badge tone={row.indicator.group === 'Rentabilidad' ? 'green' : row.indicator.group === 'Liquidez' ? 'blue' : row.indicator.group === 'Endeudamiento' ? 'amber' : row.indicator.group === 'Actividad' ? 'violet' : 'cyan'}>{row.indicator.group}</Badge> },
            { header: 'Meta', align: 'right', cell: row => <span className="tabular text-gray-600">{formatIndicator(row.indicator, row.indicator.target)}</span> },
            { header: 'Actual', align: 'right', cell: row => <span className="tabular font-semibold text-gray-800">{formatIndicator(row.indicator, row.indicator.actual)}</span> },
            { header: 'Anterior', align: 'right', cell: row => <span className="tabular text-gray-500">{formatIndicator(row.indicator, row.indicator.previous)}</span> },
            { header: 'Cumplimiento', cell: row => <div className="min-w-32"><Progress value={row.compliance} tone={row.ok ? 'green' : row.compliance >= 80 ? 'amber' : 'red'} label="" /></div> },
            { header: 'Estado', cell: row => <Badge tone={row.ok ? 'green' : 'red'}>{row.ok ? 'Cumple' : 'En riesgo'}</Badge> },
            { header: 'Dirección', cell: row => <span className="text-[10px] text-gray-500">{row.indicator.direction}</span> },
            { header: '', align: 'right', cell: row => <Button size="sm" onClick={event => { event.stopPropagation(); onEdit(row.indicator); }}>Editar</Button> },
          ]}
          footer={<div className="flex items-center justify-between text-[11px] text-gray-600"><span>{rows.length} indicadores visibles</span><span className="tabular font-semibold">{rows.filter(row => row.ok).length} en meta</span></div>}
        />
      </Card>
    </div>
  );
}
