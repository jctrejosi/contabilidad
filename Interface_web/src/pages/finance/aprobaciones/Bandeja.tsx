import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  FilterSelect,
  INPUT,
  KpiCard,
  Modal,
  Money,
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import { FINANCIAL_MODULES } from '../../../data/finance';
import { USUARIO } from '../../../data/mock';
import { useFinance } from '../../../finance/store';
import { HOY, fmtDate, money } from '../../../finance/selectors';
import type { ApprovalRequest, ApprovalStatus } from '../../../finance/types';

const STATUS_TONE: Record<ApprovalStatus, 'gray' | 'green' | 'red' | 'amber' | 'blue'> = {
  Pendiente: 'amber',
  Aprobada: 'green',
  Rechazada: 'red',
  Delegada: 'blue',
  Vencida: 'red',
};

export default function Bandeja({ showToast }: { showToast: (text: string) => void }) {
  const { state, update } = useFinance();
  const [module, setModule] = useState('Todos');
  const [status, setStatus] = useState('Todos');
  const [decision, setDecision] = useState<{ request: ApprovalRequest; action: 'Aprobar' | 'Rechazar' } | null>(null);
  const [note, setNote] = useState('');

  const rows = useMemo(
    () => [...state.approvalRequests]
      .filter(row => module === 'Todos' || row.module === module)
      .filter(row => status === 'Todos' || row.status === status)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [state.approvalRequests, module, status],
  );

  const pending = state.approvalRequests.filter(row => row.status === 'Pendiente');
  const overdue = state.approvalRequests.filter(row => row.status === 'Vencida');
  const approved = state.approvalRequests.filter(row => row.status === 'Aprobada');
  const amount = pending.reduce((total, row) => total + row.amount, 0);

  function open(request: ApprovalRequest, action: 'Aprobar' | 'Rechazar') {
    setDecision({ request, action });
    setNote('');
  }

  function confirm() {
    if (!decision) return;
    const { request, action } = decision;
    update(draft => {
      const target = draft.approvalRequests.find(row => row.id === request.id);
      if (!target) return;
      const index = Math.max(0, target.currentLevel - 1);
      const step = target.history[index];
      if (step) {
        step.action = action === 'Aprobar' ? 'Aprobada' : 'Rechazada';
        step.user = USUARIO.nombre;
        step.at = `${HOY} ${new Date().toTimeString().slice(0, 5)}`;
        step.note = note.trim();
      }
      if (action === 'Rechazar') {
        target.status = 'Rechazada';
        target.note = note.trim() || target.note;
      } else if (target.currentLevel < target.totalLevels) {
        target.currentLevel += 1;
        target.status = 'Pendiente';
      } else {
        target.status = 'Aprobada';
      }
    }, `${request.number} ${action === 'Aprobar' ? 'aprobada' : 'rechazada'} en nivel ${request.currentLevel}`, 'aprobaciones');
    showToast(`${request.number} ${action === 'Aprobar' ? 'aprobada' : 'rechazada'}.`);
    setDecision(null);
  }

  const columns: Column<ApprovalRequest>[] = [
    {
      header: 'Solicitud',
      cell: row => (
        <div>
          <div className="font-medium text-gray-800">{row.number}</div>
          <div className="text-[10px] text-gray-400">{row.reference} · {row.concept}</div>
        </div>
      ),
    },
    {
      header: 'Módulo',
      cell: row => <Badge tone="cyan">{FINANCIAL_MODULES[row.module]?.shortName ?? row.module}</Badge>,
    },
    { header: 'Tercero', cell: row => <span className="text-gray-700">{row.party}</span> },
    { header: 'Valor', align: 'right', cell: row => <Money value={row.amount} /> },
    {
      header: 'Nivel',
      align: 'center',
      cell: row => <span className="tabular text-[11px] text-gray-600">{row.currentLevel} de {row.totalLevels}</span>,
    },
    { header: 'Vence', cell: row => fmtDate(row.dueDate) },
    { header: 'Estado', cell: row => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge> },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => (
        <div className="flex justify-end gap-1.5">
          {row.status !== 'Aprobada' && row.status !== 'Rechazada' && (
            <>
              <Button size="sm" onClick={() => open(row, 'Rechazar')}>Rechazar</Button>
              <Button size="sm" variant="success" onClick={() => open(row, 'Aprobar')}>Aprobar</Button>
            </>
          )}
          {(row.status === 'Aprobada' || row.status === 'Rechazada') && (
            <span className="text-[10px] text-gray-400">{row.history.at(-1)?.user || '—'}</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Pendientes" value={String(pending.length)} detail={`${money(amount)} en revisión`} tone="amber" />
        <KpiCard label="Vencidas" value={String(overdue.length)} detail="Requieren escalamiento" tone={overdue.length > 0 ? 'red' : 'green'} />
        <KpiCard label="Aprobadas" value={String(approved.length)} detail="Histórico del período" tone="green" />
        <KpiCard label="Reglas activas" value={String(state.approvalRules.filter(rule => rule.active).length)} detail={`${state.approvalRules.length} reglas configuradas`} tone="cyan" />
      </div>

      <Card>
        <SectionTitle
          title="Bandeja de aprobaciones"
          detail="Solicitudes de todos los módulos con nivel actual, vencimiento y decisión"
        />
        <div className="flex flex-wrap gap-2 border-b border-gray-100 px-4 py-3">
          <FilterSelect value={module} onChange={event => setModule(event.target.value)}>
            <option value="Todos">Todos los módulos</option>
            {Array.from(new Set(state.approvalRequests.map(row => row.module))).map(item => (
              <option key={item} value={item}>{FINANCIAL_MODULES[item]?.shortName ?? item}</option>
            ))}
          </FilterSelect>
          <FilterSelect value={status} onChange={event => setStatus(event.target.value)}>
            {['Todos', 'Pendiente', 'Vencida', 'Aprobada', 'Rechazada'].map(item => (
              <option key={item} value={item}>{item}</option>
            ))}
          </FilterSelect>
        </div>
        <div className="p-4">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={row => row.id}
            empty="No hay solicitudes para los filtros seleccionados."
          />
        </div>
      </Card>

      {decision && (
        <Modal
          title={`${decision.action} ${decision.request.number}`}
          subtitle={`${decision.request.concept} · nivel ${decision.request.currentLevel} de ${decision.request.totalLevels}`}
          onClose={() => setDecision(null)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
              <div>
                <div className="text-gray-500">Tercero</div>
                <div className="mt-0.5 font-semibold text-gray-900">{decision.request.party}</div>
              </div>
              <div>
                <div className="text-gray-500">Valor</div>
                <div className="mt-0.5 font-semibold text-gray-900"><Money value={decision.request.amount} /></div>
              </div>
              <div>
                <div className="text-gray-500">Vence</div>
                <div className="mt-0.5 font-semibold text-gray-900">{fmtDate(decision.request.dueDate)}</div>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600">
              {decision.request.note}
            </div>
            <Field label="Nota de la decisión" hint="Queda registrada en el histórico de la solicitud.">
              <textarea
                className={`${INPUT} min-h-20`}
                value={note}
                onChange={event => setNote(event.target.value)}
                placeholder="Soporte de la aprobación o motivo del rechazo."
              />
            </Field>
            {decision.action === 'Rechazar' && !note.trim() && (
              <p className="text-xs text-amber-700">El rechazo sin nota quedará sin justificación.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button onClick={() => setDecision(null)}>Cancelar</Button>
              <Button
                variant={decision.action === 'Aprobar' ? 'success' : 'danger'}
                onClick={confirm}
              >
                Confirmar {decision.action === 'Aprobar' ? 'aprobación' : 'rechazo'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
