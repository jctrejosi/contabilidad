import { useState } from 'react';
import Icon from '../../../components/Icon';
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
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import { FINANCIAL_MODULES, MODULE_ORDER } from '../../../data/finance';
import { useFinance } from '../../../finance/store';
import { money } from '../../../finance/selectors';
import type { ApprovalRule, FinancialModuleId } from '../../../finance/types';

const ROLE_LEVELS = ['Tesorería', 'Dirección financiera', 'Comité de activos'];

export default function Reglas({ showToast }: { showToast: (text: string) => void }) {
  const { state, update } = useFinance();
  const [open, setOpen] = useState(false);

  function toggle(id: string) {
    update(draft => {
      const rule = draft.approvalRules.find(item => item.id === id);
      if (rule) rule.active = !rule.active;
    }, 'Estado de regla de aprobación actualizado', 'aprobaciones');
    showToast('Regla actualizada.');
  }

  function create(payload: {
    name: string;
    module: FinancialModuleId;
    concept: string;
    minAmount: number;
    maxAmount: number;
    levels: number;
    note: string;
  }) {
    const rule: ApprovalRule = {
      id: `rule-${Date.now()}`,
      name: payload.name,
      module: payload.module,
      concept: payload.concept,
      minAmount: payload.minAmount,
      maxAmount: payload.maxAmount,
      levels: Array.from({ length: payload.levels }, (_, index) => ({
        level: index + 1,
        role: ROLE_LEVELS[index] ?? 'Dirección financiera',
        minAmount: payload.minAmount,
      })),
      active: true,
      note: payload.note,
    };
    update(draft => {
      draft.approvalRules.unshift(rule);
    }, `Regla de aprobación ${payload.name} creada`, 'aprobaciones');
    setOpen(false);
    showToast(`Regla ${payload.name} creada con ${payload.levels} nivel(es).`);
  }

  const columns: Column<ApprovalRule>[] = [
    {
      header: 'Regla',
      cell: row => (
        <div>
          <div className="font-medium text-gray-800">{row.name}</div>
          <div className="text-[10px] text-gray-400">{row.note}</div>
        </div>
      ),
    },
    { header: 'Módulo', cell: row => <Badge tone="cyan">{FINANCIAL_MODULES[row.module]?.shortName ?? row.module}</Badge> },
    { header: 'Concepto', cell: row => <span className="text-gray-700">{row.concept}</span> },
    {
      header: 'Rango',
      align: 'right',
      cell: row => (
        <span className="tabular text-[11px] text-gray-600">
          {money(row.minAmount)} – {row.maxAmount >= 1_000_000_000 ? 'sin límite' : money(row.maxAmount)}
        </span>
      ),
    },
    {
      header: 'Niveles',
      cell: row => (
        <div className="flex flex-wrap gap-1">
          {row.levels.map(level => (
            <span key={level.level} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
              {level.level}. {level.role}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: 'Estado',
      cell: row => <Badge tone={row.active ? 'green' : 'gray'}>{row.active ? 'Activa' : 'Inactiva'}</Badge>,
    },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => (
        <Button size="sm" onClick={() => toggle(row.id)}>
          {row.active ? 'Desactivar' : 'Activar'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Reglas configuradas" value={String(state.approvalRules.length)} detail="Motor transversal" tone="cyan" />
        <KpiCard label="Activas" value={String(state.approvalRules.filter(rule => rule.active).length)} detail="Aplican a nuevas solicitudes" tone="green" />
        <KpiCard label="Módulos cubiertos" value={String(new Set(state.approvalRules.map(rule => rule.module)).size)} detail="Con al menos una regla" tone="blue" />
        <KpiCard label="Niveles máximos" value={String(Math.max(0, ...state.approvalRules.map(rule => rule.levels.length)))} detail="Aprobadores por solicitud" tone="violet" />
      </div>

      <Card>
        <SectionTitle
          title="Reglas y niveles de aprobación"
          detail="Umbrales por módulo y concepto, con uno o varios aprobadores"
          action={
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Icon name="plus" className="h-3.5 w-3.5" /> Nueva regla
            </Button>
          }
        />
        <div className="p-4">
          <DataTable
            columns={columns}
            rows={state.approvalRules}
            rowKey={row => row.id}
            empty="No hay reglas configuradas."
            footer={
              <span className="text-[11px] text-gray-500">
                Una regla inactiva no se aplica a nuevas solicitudes, pero conserva su histórico.
              </span>
            }
          />
        </div>
      </Card>

      {open && (
        <Modal
          title="Nueva regla de aprobación"
          subtitle="Defina módulo, concepto, rango y cantidad de niveles."
          onClose={() => setOpen(false)}
        >
          <RuleForm
            onCancel={() => setOpen(false)}
            onSave={create}
          />
        </Modal>
      )}
    </div>
  );
}

function RuleForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (payload: {
    name: string;
    module: FinancialModuleId;
    concept: string;
    minAmount: number;
    maxAmount: number;
    levels: number;
    note: string;
  }) => void;
}) {
  const [name, setName] = useState('');
  const [module, setModule] = useState<FinancialModuleId>('cuentas-pagar');
  const [concept, setConcept] = useState('Propuesta de pago');
  const [minAmount, setMinAmount] = useState(0);
  const [maxAmount, setMaxAmount] = useState(50_000_000);
  const [levels, setLevels] = useState(2);
  const [note, setNote] = useState('');
  const valid = name.trim().length >= 4 && concept.trim().length >= 4 && maxAmount >= minAmount;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre de la regla">
          <input className={INPUT} value={name} onChange={event => setName(event.target.value)} placeholder="Ej. Pagos desde $ 50 M" />
        </Field>
        <Field label="Módulo">
          <FilterSelect value={module} onChange={event => setModule(event.target.value as FinancialModuleId)}>
            {MODULE_ORDER.map(item => (
              <option key={item} value={item}>{FINANCIAL_MODULES[item].shortName}</option>
            ))}
          </FilterSelect>
        </Field>
        <Field label="Concepto">
          <input className={INPUT} value={concept} onChange={event => setConcept(event.target.value)} />
        </Field>
        <Field label="Número de niveles">
          <FilterSelect value={levels} onChange={event => setLevels(Number(event.target.value))}>
            {[1, 2, 3].map(item => <option key={item} value={item}>{item} nivel(es)</option>)}
          </FilterSelect>
        </Field>
        <Field label="Monto mínimo">
          <input type="number" className={INPUT} value={minAmount} onChange={event => setMinAmount(Number(event.target.value))} />
        </Field>
        <Field label="Monto máximo">
          <input type="number" className={INPUT} value={maxAmount} onChange={event => setMaxAmount(Number(event.target.value))} />
        </Field>
      </div>
      <Field label="Nota" hint="Explique cuándo aplica la regla.">
        <textarea className={`${INPUT} min-h-20`} value={note} onChange={event => setNote(event.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button onClick={onCancel}>Cancelar</Button>
        <Button
          variant="primary"
          disabled={!valid}
          onClick={() => onSave({ name: name.trim(), module, concept: concept.trim(), minAmount, maxAmount, levels, note: note.trim() })}
        >
          Crear regla
        </Button>
      </div>
    </div>
  );
}
