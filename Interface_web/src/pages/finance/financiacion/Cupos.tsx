import { Badge, Button, Card, DataTable, KpiCard, Money, Progress, SectionTitle } from '../../../components/finance/ui';
import type { CreditLine, FinanceState } from '../../../finance/types';
import { money } from './shared';

export default function Cupos({
  state,
  onCreate,
  onEdit,
}: {
  state: FinanceState;
  onCreate: () => void;
  onEdit: (line: CreditLine) => void;
}) {
  const active = state.creditLines.filter(line => line.status === 'Vigente');
  const approved = active.reduce((total, line) => total + line.approved, 0);
  const used = active.reduce((total, line) => total + line.used, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Cupo aprobado" value={<Money value={approved} />} detail={`${active.length} líneas vigentes`} tone="blue" />
        <KpiCard label="Cupo utilizado" value={<Money value={used} />} detail={`${approved > 0 ? ((used / approved) * 100).toFixed(1) : '0.0'} % del total`} tone="amber" />
        <KpiCard label="Cupo disponible" value={<Money value={approved - used} />} detail="Para nuevas disposiciones" tone="green" />
        <KpiCard label="Líneas vencidas" value={String(state.creditLines.filter(line => line.status === 'Vencida').length)} detail="Requieren renovación o cierre" tone={state.creditLines.some(line => line.status === 'Vencida') ? 'red' : 'gray'} />
      </div>

      <Card>
        <SectionTitle
          title="Cupos de crédito"
          detail="Líneas aprobadas por entidad, uso y tasa de referencia."
          action={<Button variant="primary" size="sm" onClick={onCreate}>Nuevo cupo</Button>}
        />
        <DataTable
          rows={state.creditLines}
          rowKey={line => line.id}
          onRowClick={onEdit}
          columns={[
            { header: 'Cupo', cell: line => <div><div className="font-medium text-gray-800">{line.bank}</div><div className="text-[9px] text-gray-400">{line.code}</div></div> },
            { header: 'Aprobado', align: 'right', cell: line => <Money value={line.approved} /> },
            { header: 'Utilizado', align: 'right', cell: line => <Money value={line.used} /> },
            { header: 'Disponible', align: 'right', cell: line => <span className="tabular font-semibold text-gray-800">{money(line.approved - line.used)}</span> },
            { header: 'Uso', cell: line => <div className="min-w-32"><Progress value={line.approved > 0 ? (line.used / line.approved) * 100 : 0} tone={line.used / Math.max(1, line.approved) > 0.8 ? 'amber' : 'blue'} label="" /></div> },
            { header: 'Tasa EA', align: 'right', cell: line => <span className="tabular">{line.annualRate.toFixed(2)} %</span> },
            { header: 'Vence', cell: line => <span className="tabular text-gray-600">{line.expiresAt}</span> },
            { header: 'Estado', cell: line => <Badge tone={line.status === 'Vigente' ? 'green' : line.status === 'Vencida' ? 'red' : 'gray'}>{line.status}</Badge> },
            { header: '', align: 'right', cell: line => <Button size="sm" onClick={event => { event.stopPropagation(); onEdit(line); }}>Editar</Button> },
          ]}
          footer={<div className="flex items-center justify-between text-[11px] text-gray-600"><span>{state.creditLines.length} líneas registradas</span><span className="tabular font-semibold">Disponible: {money(approved - used)}</span></div>}
        />
      </Card>
    </div>
  );
}
