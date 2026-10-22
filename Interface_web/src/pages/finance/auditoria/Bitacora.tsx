import { useMemo, useState } from 'react';
import Icon from '../../../components/Icon';
import {
  Badge,
  Button,
  Card,
  DataTable,
  FilterSelect,
  KpiCard,
  SearchInput,
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import { FINANCIAL_MODULES } from '../../../data/finance';
import { useFinance } from '../../../finance/store';
import type { AuditEntry } from '../../../finance/types';

export default function Bitacora({ showToast }: { showToast: (text: string) => void }) {
  const { state } = useFinance();
  const [query, setQuery] = useState('');
  const [module, setModule] = useState('Todos');

  const rows = useMemo(
    () => state.audit
      .filter(row => module === 'Todos' || row.module === module)
      .filter(row => {
        const haystack = `${row.user} ${row.action} ${row.module}`.toLowerCase();
        return query.trim() === '' || haystack.includes(query.toLowerCase());
      }),
    [state.audit, module, query],
  );

  const users = new Set(state.audit.map(row => row.user));
  const modules = new Set(state.audit.map(row => row.module));

  const columns: Column<AuditEntry>[] = [
    {
      header: 'Fecha',
      cell: row => <span className="tabular text-[11px] text-gray-600">{row.at}</span>,
    },
    {
      header: 'Usuario',
      cell: row => (
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-petroleum-100 text-[10px] font-semibold text-petroleum-700">
            {row.user.split(' ').map(part => part[0]).slice(0, 2).join('')}
          </span>
          <span className="text-gray-800">{row.user}</span>
        </div>
      ),
    },
    {
      header: 'Módulo',
      cell: row => (
        <Badge tone="cyan">
          {row.module === 'suite' ? 'Suite' : FINANCIAL_MODULES[row.module]?.shortName ?? row.module}
        </Badge>
      ),
    },
    { header: 'Acción', cell: row => <span className="text-gray-700">{row.action}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Eventos" value={String(state.audit.length)} detail="Bitácora persistente" tone="cyan" />
        <KpiCard label="Usuarios" value={String(users.size)} detail="Con actividad registrada" tone="blue" />
        <KpiCard label="Módulos" value={String(modules.size)} detail="Origen de los eventos" tone="violet" />
        <KpiCard label="Último evento" value={state.audit[0]?.at ?? '—'} detail={state.audit[0]?.user ?? 'Sin registros'} tone="green" />
      </div>

      <Card>
        <SectionTitle
          title="Bitácora de eventos"
          detail="Trazabilidad de las acciones realizadas en la suite"
          action={
            <Button onClick={() => showToast('Bitácora exportada para auditoría.')}>
              <Icon name="download" className="h-3.5 w-3.5" /> Exportar bitácora
            </Button>
          }
        />
        <div className="flex flex-wrap gap-2 border-b border-gray-100 px-4 py-3">
          <SearchInput
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Buscar por usuario, acción o módulo"
          />
          <FilterSelect value={module} onChange={event => setModule(event.target.value)}>
            <option value="Todos">Todos los módulos</option>
            <option value="suite">Suite</option>
            {Object.values(FINANCIAL_MODULES).map(item => (
              <option key={item.id} value={item.id}>{item.shortName}</option>
            ))}
          </FilterSelect>
        </div>
        <div className="p-4">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={row => row.id}
            empty="No hay eventos para los filtros seleccionados."
            footer={
              <span className="text-[11px] text-gray-500">
                La bitácora conserva los últimos 80 eventos por compañía en el almacenamiento local.
              </span>
            }
          />
        </div>
      </Card>
    </div>
  );
}
