import { useMemo, useState } from 'react';
import type { NavPage } from '../../components/Shell';
import Icon from '../../components/Icon';
import {
  Badge,
  BarChart,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  FilterSelect,
  INPUT,
  KpiCard,
  Modal,
  Money,
  PageHeader,
  Progress,
  SectionTitle,
  type Column,
} from '../../components/finance/ui';
import { FINANCIAL_MODULES } from '../../data/finance';
import { USUARIO } from '../../data/mock';
import { useFinance } from '../../finance/store';
import {
  HOY,
  MESES,
  MESES_CORTOS,
  budgetAnnual,
  budgetAvailable,
  budgetCommitted,
  budgetExecuted,
  budgetTotal,
  compactMoney,
  currentVersion,
  fmtDate,
  money,
  pct,
  statusTone,
} from '../../finance/selectors';
import type {
  BudgetAlert,
  BudgetLine,
  BudgetVersion,
  FinanceState,
  FinancialModuleId,
} from '../../finance/types';
import Proyectos from './presupuesto/Proyectos';

interface Props {
  page: string;
  onNavigate: (page: NavPage) => void;
}

type UpdateFn = (
  mutator: (draft: FinanceState) => void,
  action?: string,
  module?: FinancialModuleId | 'suite',
) => void;

type ToastFn = (text: string) => void;
type Scenario = BudgetVersion['scenario'];
type DistributionMethod = 'uniforme' | 'porcentual' | 'manual';

const MODULE = FINANCIAL_MODULES.presupuesto;
const SLUGS = MODULE.nav.map(item => item.slug);
const MODULE_ID = MODULE.id;

const NAV_TITLES: Record<string, { title: string; subtitle: string }> = {
  versiones: {
    title: 'Bandeja de presupuestos',
    subtitle: 'Versiones por año y escenario, control de vigencia y acceso directo al editor.',
  },
  editor: {
    title: 'Editor de presupuesto',
    subtitle: 'Grilla anual por cuenta y centro de costo con ajuste mensual y control de disponibilidad.',
  },
  distribucion: {
    title: 'Distribución mensual',
    subtitle: 'Distribuya el valor anual de una línea o de toda la versión entre los doce meses.',
  },
  aprobacion: {
    title: 'Aprobación de versiones',
    subtitle: 'Revisión de versiones en borrador o revisión, acta de aprobación y rechazo motivado.',
  },
  ejecucion: {
    title: 'Ejecución y compromisos',
    subtitle: 'Seguimiento por cuenta y centro, compromisos presupuestales y semáforo de consumo.',
  },
  comparativo: {
    title: 'Comparativo y escenarios',
    subtitle: 'Contraste de dos versiones o escenarios con variaciones por línea y por cuenta.',
  },
  alertas: {
    title: 'Alertas presupuestales',
    subtitle: 'Seguimiento de umbrales, desviaciones y compromisos con control de silencio.',
  },
  proyectos: {
    title: 'Proyección por proyecto',
    subtitle: 'Presupuesto, ejecución y cierre estimado de cada iniciativa con desviación proyectada.',
  },
};

const DISTRIBUTION_METHODS: { id: DistributionMethod; label: string }[] = [
  { id: 'uniforme', label: 'Uniforme' },
  { id: 'porcentual', label: 'Porcentual' },
  { id: 'manual', label: 'Manual' },
];

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function toAmount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function cloneLines(lines: BudgetLine[]): BudgetLine[] {
  return lines.map(line => ({ ...line, monthly: [...line.monthly] }));
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function distributeAnnual(annual: number): number[] {
  const target = Math.max(0, Math.round(annual));
  const base = Math.round(target / 12);
  const months = Array.from({ length: 12 }, () => base);
  months[11] += target - base * 12;
  return months;
}

function applyPercentages(annual: number, percentages: number[]): number[] {
  const target = Math.max(0, Math.round(annual));
  const months = percentages.map(value => Math.round((target * Math.max(0, value)) / 100));
  const difference = target - sum(months);
  months[11] = Math.max(0, months[11] + difference);
  return months;
}

function equalPercentages(): number[] {
  return Array.from({ length: 12 }, (_, index) => (index === 11 ? 8.37 : 8.33));
}

function percentagesFrom(monthly: number[], annual: number): number[] {
  if (annual <= 0) return equalPercentages();
  const values = monthly.map(value => Math.round((value / annual) * 1000) / 10);
  const difference = 100 - sum(values);
  values[11] = Math.round((values[11] + difference) * 10) / 10;
  return values;
}

function lineAvailable(line: BudgetLine): number {
  return budgetAnnual(line) - line.executed - line.committed;
}

function usedPercentage(line: BudgetLine): number {
  const annual = budgetAnnual(line);
  return annual > 0 ? ((line.executed + line.committed) / annual) * 100 : 0;
}

function executionPercentage(line: BudgetLine): number {
  const annual = budgetAnnual(line);
  return annual > 0 ? (line.executed / annual) * 100 : 0;
}

function trafficLight(value: number): { tone: 'green' | 'amber' | 'red'; label: string } {
  if (value >= 90) return { tone: 'red', label: 'Crítico' };
  if (value >= 70) return { tone: 'amber', label: 'Atención' };
  return { tone: 'green', label: 'Normal' };
}

function scenarioTone(scenario: Scenario): 'blue' | 'green' | 'amber' {
  if (scenario === 'Optimista') return 'green';
  if (scenario === 'Conservador') return 'amber';
  return 'blue';
}

function severityTone(severity: BudgetAlert['severity']): 'red' | 'amber' | 'blue' {
  if (severity === 'Alta') return 'red';
  if (severity === 'Media') return 'amber';
  return 'blue';
}

function isBudgetLocked(version: BudgetVersion): boolean {
  return version.status === 'Aprobada' || version.status === 'Cerrada';
}

function downloadCsv(fileName: string, rows: (string | number)[][]): void {
  const content = rows
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\n');
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function VersionPicker({
  versions,
  value,
  onChange,
  label = 'Versión',
  disabled = false,
}: {
  versions: BudgetVersion[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label} className="min-w-56">
      <FilterSelect value={value} onChange={event => onChange(event.target.value)} disabled={disabled}>
        {versions.map(version => (
          <option key={version.id} value={version.id}>
            {version.name} · {version.year} · {version.scenario}
          </option>
        ))}
      </FilterSelect>
    </Field>
  );
}

function LockNotice({ version, action = 'editar' }: { version: BudgetVersion; action?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        La versión <strong>{version.name}</strong> está en estado <strong>{version.status}</strong> y no admite {action}.
        Las versiones aprobadas y cerradas son inmutables para proteger las cifras oficiales.
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone = 'gray',
  strong = false,
}: {
  label: string;
  value: number;
  tone?: 'gray' | 'green' | 'amber' | 'red' | 'blue';
  strong?: boolean;
}) {
  const colors: Record<'gray' | 'green' | 'amber' | 'red' | 'blue', string> = {
    gray: 'text-gray-800',
    green: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
    blue: 'text-blue-700',
  };
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-gray-500">{label}</span>
      <Money value={value} className={`${strong ? 'font-semibold' : ''} ${colors[tone]}`} />
    </div>
  );
}

function VersionKpis({ version }: { version: BudgetVersion }) {
  const total = budgetTotal(version);
  const executed = budgetExecuted(version);
  const committed = budgetCommitted(version);
  const available = budgetAvailable(version);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard label="Presupuesto anual" value={<Money value={total} />} detail={`${version.lines.length} líneas · ${version.scenario}`} tone="blue" />
      <KpiCard label="Ejecutado" value={<Money value={executed} />} detail={pct(total > 0 ? (executed / total) * 100 : 0)} tone="green" />
      <KpiCard label="Comprometido" value={<Money value={committed} />} detail={pct(total > 0 ? (committed / total) * 100 : 0)} tone="amber" />
      <KpiCard label="Disponible" value={<Money value={available} />} detail={pct(total > 0 ? (available / total) * 100 : 0)} tone={available < 0 ? 'red' : 'cyan'} />
    </div>
  );
}

interface VersionsViewProps {
  state: FinanceState;
  update: UpdateFn;
  onEdit: (id: string) => void;
  onCompare: (id: string) => void;
  onNew: () => void;
  showToast: ToastFn;
}

function VersionsView({ state, update, onEdit, onCompare, onNew, showToast }: VersionsViewProps) {
  const vigente = state.budgets.find(version => version.current) ?? currentVersion(state);
  const totalVigente = vigente ? budgetTotal(vigente) : 0;
  const executedVigente = vigente ? budgetExecuted(vigente) : 0;
  const availableVigente = vigente ? budgetAvailable(vigente) : 0;
  const approved = state.budgets.filter(version => version.status === 'Aprobada').length;
  const drafts = state.budgets.filter(version => version.status === 'Borrador').length;

  function markCurrent(version: BudgetVersion) {
    if (version.status !== 'Aprobada') return;
    update(draft => {
      draft.budgets.forEach(item => {
        item.current = item.id === version.id;
      });
    }, `Versión ${version.name} marcada como vigente`, 'presupuesto');
    showToast(`${version.name} quedó marcada como versión vigente.`);
  }

  function closeVersion(version: BudgetVersion) {
    if (version.status !== 'Aprobada' || version.current) return;
    if (budgetCommitted(version) > 0) {
      showToast('No se puede cerrar: la versión tiene compromisos abiertos. Libere los compromisos primero.');
      return;
    }
    const reason = window.prompt('Motivo del cierre de la versión', 'Cierre de vigencia');
    if (!reason || !reason.trim()) return;
    update(draft => {
      const target = draft.budgets.find(item => item.id === version.id);
      if (!target) return;
      target.status = 'Cerrada';
      target.current = false;
      target.note = `${target.note} Cerrada: ${reason.trim()}.`;
    }, `Versión ${version.name} cerrada: ${reason.trim()}`, 'presupuesto');
    showToast(`${version.name} cerrada. El histórico queda disponible solo para consulta.`);
  }

  function duplicate(version: BudgetVersion) {
    const id = newId('bgt');
    update(draft => {
      const source = draft.budgets.find(item => item.id === version.id);
      if (!source) return;
      draft.budgets.unshift({
        ...source,
        id,
        name: `${source.name} (copia)`,
        status: 'Borrador',
        approvedBy: '',
        approvedAt: '',
        note: `Duplicada desde ${source.name}.`,
        current: false,
        lines: source.lines.map(line => ({
          ...line,
          id: newId('bline'),
          monthly: [...line.monthly],
        })),
      });
    }, `Versión ${version.name} duplicada`, 'presupuesto');
    showToast(`Versión duplicada como borrador: ${version.name} (copia).`);
  }

  const columns: Column<BudgetVersion>[] = [
    {
      header: 'Año',
      width: '64px',
      cell: version => <span className="font-medium text-gray-700">{version.year}</span>,
    },
    {
      header: 'Versión',
      cell: version => (
        <div className="min-w-48">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-gray-800">{version.name}</span>
            {version.current && <Badge tone="green">Vigente</Badge>}
          </div>
          <div className="mt-0.5 text-[10px] text-gray-500">
            {version.lines.length} líneas · {version.owner}
          </div>
        </div>
      ),
    },
    {
      header: 'Escenario',
      cell: version => <Badge tone={scenarioTone(version.scenario)}>{version.scenario}</Badge>,
    },
    {
      header: 'Estado',
      cell: version => <Badge tone={statusTone(version.status)}>{version.status}</Badge>,
    },
    {
      header: 'Responsable',
      cell: version => (
        <div>
          <div className="text-gray-700">{version.owner}</div>
          <div className="text-[10px] text-gray-500">
            {version.approvedBy ? `Aprobó: ${version.approvedBy}` : 'Sin aprobador'}
          </div>
        </div>
      ),
    },
    {
      header: 'Total',
      align: 'right',
      cell: version => <Money value={budgetTotal(version)} />,
    },
    {
      header: 'Ejecutado',
      align: 'right',
      cell: version => <Money value={budgetExecuted(version)} />,
    },
    {
      header: 'Disponible',
      align: 'right',
      cell: version => (
        <Money
          value={budgetAvailable(version)}
          className={budgetAvailable(version) < 0 ? 'font-semibold text-red-700' : 'text-gray-800'}
        />
      ),
    },
    {
      header: 'Acciones',
      align: 'right',
      cell: version => (
        <div className="flex flex-wrap justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => onEdit(version.id)}>Editar</Button>
          <Button size="sm" variant="ghost" onClick={() => duplicate(version)}>Duplicar</Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={version.status !== 'Aprobada' || version.current}
            title={version.status !== 'Aprobada' ? 'Solo una versión aprobada puede marcarse vigente' : undefined}
            onClick={() => markCurrent(version)}
          >
            Marcar vigente
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={version.status !== 'Aprobada' || version.current}
            title={version.status !== 'Aprobada' ? 'Solo una versión aprobada puede cerrarse' : version.current ? 'Marque otra versión como vigente antes de cerrar' : undefined}
            onClick={() => closeVersion(version)}
          >
            Cerrar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onCompare(version.id)}>Ver comparativo</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Versiones registradas"
          value={String(state.budgets.length)}
          detail={`${approved} aprobadas · ${drafts} en borrador`}
          tone="blue"
        />
        <KpiCard
          label="Presupuesto vigente"
          value={<Money value={totalVigente} />}
          detail={vigente ? `${vigente.name} · ${vigente.scenario}` : 'Sin versión vigente'}
          tone="cyan"
        />
        <KpiCard
          label="Ejecutado vigente"
          value={<Money value={executedVigente} />}
          detail={pct(totalVigente > 0 ? (executedVigente / totalVigente) * 100 : 0)}
          tone="green"
        />
        <KpiCard
          label="Disponible vigente"
          value={<Money value={availableVigente} />}
          detail={pct(totalVigente > 0 ? (availableVigente / totalVigente) * 100 : 0)}
          tone={availableVigente < 0 ? 'red' : 'amber'}
        />
      </div>

      <Card>
        <SectionTitle
          title="Versiones presupuestales"
          detail="La versión vigente alimenta los indicadores de ejecución y compromisos."
          action={<Button variant="primary" onClick={onNew}><Icon name="plus" className="h-3.5 w-3.5" /> Nueva versión</Button>}
        />
        <div className="p-4">
          <DataTable
            columns={columns}
            rows={state.budgets}
            rowKey={version => version.id}
            empty="No hay versiones registradas. Cree la primera versión presupuestal."
          />
        </div>
      </Card>
    </div>
  );
}

interface NewVersionPayload {
  year: number;
  scenario: Scenario;
  name: string;
  owner: string;
}

function VersionForm({ onClose, onCreate }: { onClose: () => void; onCreate: (payload: NewVersionPayload) => void }) {
  const [year, setYear] = useState(String(HOY.slice(0, 4)));
  const [scenario, setScenario] = useState<Scenario>('Base');
  const [name, setName] = useState(`Presupuesto ${HOY.slice(0, 4)} nueva versión`);
  const [owner, setOwner] = useState(USUARIO.nombre);
  const [error, setError] = useState('');

  function submit() {
    const parsedYear = Number(year);
    if (!Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      setError('Indique un año válido entre 2000 y 2100.');
      return;
    }
    if (!name.trim()) {
      setError('El nombre de la versión es obligatorio.');
      return;
    }
    if (!owner.trim()) {
      setError('El responsable de la versión es obligatorio.');
      return;
    }
    onCreate({ year: parsedYear, scenario, name: name.trim(), owner: owner.trim() });
  }

  return (
    <Modal
      title="Nueva versión presupuestal"
      subtitle="La versión se crea en estado Borrador y sin líneas."
      onClose={onClose}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Año">
          <input
            type="number"
            min={2000}
            max={2100}
            className={INPUT}
            value={year}
            onChange={event => setYear(event.target.value)}
          />
        </Field>
        <Field label="Escenario">
          <select
            className={INPUT}
            value={scenario}
            onChange={event => setScenario(event.target.value as Scenario)}
          >
            <option value="Base">Base</option>
            <option value="Optimista">Optimista</option>
            <option value="Conservador">Conservador</option>
          </select>
        </Field>
        <Field label="Nombre de la versión" className="sm:col-span-2">
          <input
            className={INPUT}
            value={name}
            onChange={event => setName(event.target.value)}
            maxLength={80}
          />
        </Field>
        <Field label="Responsable" className="sm:col-span-2">
          <input
            className={INPUT}
            value={owner}
            onChange={event => setOwner(event.target.value)}
            maxLength={60}
          />
        </Field>
      </div>
      <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-[11px] leading-5 text-gray-500">
        Las líneas se agregan desde el editor. Si desea partir de una versión existente, use la acción Duplicar
        en la bandeja de presupuestos.
      </p>
      {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={submit}>Crear versión</Button>
      </div>
    </Modal>
  );
}

interface AddLinePayload {
  account: string;
  accountName: string;
  costCenter: string;
  annual: number;
}

function AddLineModal({
  lines,
  onClose,
  onAdd,
}: {
  lines: BudgetLine[];
  onClose: () => void;
  onAdd: (payload: AddLinePayload) => void;
}) {
  const [account, setAccount] = useState('');
  const [accountName, setAccountName] = useState('');
  const [costCenter, setCostCenter] = useState('ADM');
  const [annual, setAnnual] = useState(0);
  const [error, setError] = useState('');

  function submit() {
    if (!account.trim()) {
      setError('La cuenta contable es obligatoria.');
      return;
    }
    if (!accountName.trim()) {
      setError('El nombre de la cuenta es obligatorio.');
      return;
    }
    if (!costCenter.trim()) {
      setError('El centro de costo es obligatorio.');
      return;
    }
    if (lines.some(line => line.account === account.trim() && line.costCenter === costCenter.trim())) {
      setError('Ya existe una línea para esa cuenta y centro de costo.');
      return;
    }
    onAdd({
      account: account.trim(),
      accountName: accountName.trim(),
      costCenter: costCenter.trim(),
      annual: Math.max(0, Math.round(annual)),
    });
  }

  return (
    <Modal
      title="Agregar línea presupuestal"
      subtitle="El valor anual se distribuye uniformemente entre los doce meses."
      onClose={onClose}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cuenta">
          <input className={INPUT} value={account} maxLength={12} onChange={event => setAccount(event.target.value)} />
        </Field>
        <Field label="Centro de costo">
          <input className={INPUT} value={costCenter} maxLength={12} onChange={event => setCostCenter(event.target.value)} />
        </Field>
        <Field label="Nombre de la cuenta" className="sm:col-span-2">
          <input className={INPUT} value={accountName} maxLength={80} onChange={event => setAccountName(event.target.value)} />
        </Field>
        <Field label="Valor anual" className="sm:col-span-2">
          <input
            type="number"
            min={0}
            step={1000}
            className={INPUT}
            value={annual}
            onChange={event => setAnnual(toAmount(event.target.value))}
          />
        </Field>
      </div>
      <p className="mt-3 text-[11px] text-gray-500">
        Cuota mensual aproximada: <Money value={Math.round(annual / 12)} />.
      </p>
      {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={submit}>Agregar línea</Button>
      </div>
    </Modal>
  );
}

interface EditorViewProps {
  versions: BudgetVersion[];
  version: BudgetVersion;
  update: UpdateFn;
  showToast: ToastFn;
  onVersionChange: (id: string) => void;
}

function EditorView({ versions, version, update, showToast, onVersionChange }: EditorViewProps) {
  const locked = isBudgetLocked(version);
  const [lines, setLines] = useState<BudgetLine[]>(() => cloneLines(version.lines));
  const [dirty, setDirty] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const total = lines.reduce((value, line) => value + budgetAnnual(line), 0);
  const executed = lines.reduce((value, line) => {
    const original = version.lines.find(item => item.id === line.id);
    return value + (original?.executed ?? 0);
  }, 0);
  const committed = lines.reduce((value, line) => {
    const original = version.lines.find(item => item.id === line.id);
    return value + (original?.committed ?? 0);
  }, 0);
  const available = total - executed - committed;
  const used = total > 0 ? ((executed + committed) / total) * 100 : 0;
  const monthlyTotals = MESES.map((_, month) => lines.reduce((value, line) => value + (line.monthly[month] ?? 0), 0));
  const deleteLine = deleteId ? lines.find(line => line.id === deleteId) : undefined;

  function changeVersion(id: string) {
    if (id === version.id) return;
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Desea cambiar de versión y descartarlos?')) return;
    onVersionChange(id);
  }

  function changeMonth(lineId: string, month: number, raw: string) {
    if (locked) return;
    const value = toAmount(raw);
    setLines(previous => previous.map(line => {
      if (line.id !== lineId) return line;
      const monthly = [...line.monthly];
      monthly[month] = value;
      return { ...line, monthly };
    }));
    setDirty(true);
  }

  function addLine(payload: AddLinePayload) {
    setLines(previous => [
      ...previous,
      {
        id: newId('bline'),
        account: payload.account,
        accountName: payload.accountName,
        costCenter: payload.costCenter,
        monthly: distributeAnnual(payload.annual),
        executed: 0,
        committed: 0,
      },
    ]);
    setDirty(true);
    setAddOpen(false);
    showToast('Línea agregada al borrador local. Guarde los cambios para aplicarla.');
  }

  function removeLine() {
    if (!deleteId || locked) return;
    setLines(previous => previous.filter(line => line.id !== deleteId));
    setDirty(true);
    setDeleteId(null);
    showToast('Línea eliminada del borrador local. Guarde los cambios para aplicarla.');
  }

  function discard() {
    setLines(cloneLines(version.lines));
    setDirty(false);
  }

  function save() {
    if (locked) return;
    const clean = lines.map(line => ({
      ...line,
      monthly: line.monthly.map(value => Math.max(0, Math.round(value))),
      executed: Math.max(0, line.executed),
      committed: Math.max(0, line.committed),
    }));
    update(draft => {
      const target = draft.budgets.find(item => item.id === version.id);
      if (!target || isBudgetLocked(target)) return;
      target.lines = clean.map(line => ({ ...line, monthly: [...line.monthly] }));
    }, `Actualización de líneas de ${version.name}`, 'presupuesto');
    setLines(clean);
    setDirty(false);
    showToast(`Cambios guardados en ${version.name}.`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <VersionPicker versions={versions} value={version.id} onChange={changeVersion} />
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(version.status)}>{version.status}</Badge>
          <Badge tone={scenarioTone(version.scenario)}>{version.scenario}</Badge>
          <span className="text-[11px] text-gray-500">{version.year} · Responsable: {version.owner}</span>
        </div>
      </div>

      {locked && <LockNotice version={version} />}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <SectionTitle
            title="Grilla presupuestal"
            detail={`${lines.length} líneas · los valores mensuales se editan en pesos`}
            action={(
              <div className="flex flex-wrap items-center gap-2">
                {dirty && <Badge tone="amber">Cambios sin guardar</Badge>}
                <Button size="sm" onClick={() => setAddOpen(true)} disabled={locked}>
                  <Icon name="plus" className="h-3.5 w-3.5" /> Añadir línea
                </Button>
                <Button size="sm" onClick={discard} disabled={!dirty || locked}>Descartar</Button>
                <Button size="sm" variant="primary" onClick={save} disabled={!dirty || locked}>Guardar cambios</Button>
              </div>
            )}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1480px] text-xs">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Cuenta</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Centro</th>
                  {MESES_CORTOS.map(month => (
                    <th key={month} className="px-1 py-2.5 text-right font-semibold text-gray-600">{month}</th>
                  ))}
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Total</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lines.length === 0 && (
                  <tr>
                    <td colSpan={17} className="px-4 py-12 text-center text-gray-500">
                      La versión no tiene líneas. Use Añadir línea para comenzar el presupuesto.
                    </td>
                  </tr>
                )}
                {lines.map(line => (
                  <tr key={line.id} className="align-middle">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-800">{line.account}</td>
                    <td className="min-w-40 px-3 py-2 text-gray-700">{line.accountName}</td>
                    <td className="px-3 py-2"><Badge tone="gray">{line.costCenter}</Badge></td>
                    {MESES.map((monthName, month) => (
                      <td key={monthName} className="px-1 py-2">
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          disabled={locked}
                          aria-label={`${line.account} ${monthName}`}
                          className="w-24 rounded border border-gray-200 bg-white px-1.5 py-1 text-right text-[11px] text-gray-700 outline-none focus:border-petroleum-500 focus:ring-1 focus:ring-petroleum-100 disabled:bg-gray-50 disabled:text-gray-500"
                          value={line.monthly[month] ?? 0}
                          onChange={event => changeMonth(line.id, month, event.target.value)}
                        />
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-3 py-2 text-right font-semibold text-gray-800">
                      <Money value={budgetAnnual(line)} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={locked}
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteId(line.id)}
                      >
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-3 py-2.5 font-semibold text-gray-700">Total por mes</td>
                  {monthlyTotals.map((value, month) => (
                    <td key={MESES[month]} className="whitespace-nowrap px-1 py-2.5 text-right font-medium text-gray-700">
                      {compactMoney(value)}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-gray-900">
                    {compactMoney(total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <SectionTitle title="Resumen anual" detail="Cifras del borrador actual" />
            <div className="space-y-3 p-4">
              <SummaryRow label="Total anual" value={total} tone="blue" strong />
              <SummaryRow label="Ejecutado" value={executed} tone="green" />
              <SummaryRow label="Comprometido" value={committed} tone="amber" />
              <div className="border-t border-gray-100 pt-3">
                <SummaryRow label="Disponible" value={available} tone={available < 0 ? 'red' : 'gray'} strong />
              </div>
              <Progress value={used} tone={used >= 90 ? 'red' : used >= 70 ? 'amber' : 'green'} label="Ejecutado + comprometido" />
              {dirty && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
                  Existen cambios locales. El presupuesto de la versión no se actualiza hasta guardar.
                </p>
              )}
            </div>
          </Card>
          <Card>
            <SectionTitle title="Control de la versión" />
            <div className="space-y-2 p-4 text-[11px] text-gray-600">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-500">Estado</span>
                <Badge tone={statusTone(version.status)}>{version.status}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-500">Escenario</span>
                <Badge tone={scenarioTone(version.scenario)}>{version.scenario}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-500">Año</span>
                <span className="font-medium text-gray-800">{version.year}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-500">Aprobación</span>
                <span className="text-right font-medium text-gray-800">
                  {version.approvedAt ? fmtDate(version.approvedAt) : 'Pendiente'}
                </span>
              </div>
              <p className="border-t border-gray-100 pt-2 leading-5 text-gray-500">
                {version.note || 'Sin nota de la versión.'}
              </p>
            </div>
          </Card>
        </aside>
      </div>

      {addOpen && (
        <AddLineModal lines={lines} onClose={() => setAddOpen(false)} onAdd={addLine} />
      )}

      {deleteLine && (
        <Modal
          title="Eliminar línea presupuestal"
          subtitle={`${deleteLine.account} · ${deleteLine.accountName}`}
          onClose={() => setDeleteId(null)}
        >
          <p className="text-xs leading-5 text-gray-600">
            La línea se eliminará del borrador local. Los cambios se aplicarán a la versión solo al guardar.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="danger" onClick={removeLine}>Eliminar línea</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

interface DistributionViewProps {
  state: FinanceState;
  versions: BudgetVersion[];
  version: BudgetVersion;
  update: UpdateFn;
  showToast: ToastFn;
  onVersionChange: (id: string) => void;
}

function DistributionView({ state, versions, version, update, showToast, onVersionChange }: DistributionViewProps) {
  const locked = isBudgetLocked(version);
  const [lineId, setLineId] = useState(version.lines[0]?.id ?? '');
  const [method, setMethod] = useState<DistributionMethod>('uniforme');
  const [percentages, setPercentages] = useState<number[]>(() => equalPercentages());
  const [manual, setManual] = useState<number[]>(() => distributeAnnual(version.lines[0] ? budgetAnnual(version.lines[0]) : 0));

  const line = version.lines.find(item => item.id === lineId) ?? version.lines[0];
  const annual = line ? budgetAnnual(line) : 0;
  const percentageTotal = sum(percentages);
  const percentageValid = percentages.every(value => value >= 0) && Math.abs(percentageTotal - 100) <= 0.05;
  const manualTotal = sum(manual);
  const manualDifference = annual - manualTotal;
  const manualValid = manual.every(value => value >= 0) && Math.abs(manualDifference) <= 1;
  const valid = method === 'manual' ? manualValid : percentageValid;

  const previewMonths = method === 'uniforme'
    ? distributeAnnual(annual)
    : method === 'porcentual'
      ? applyPercentages(annual, percentages)
      : manual;
  const previewTotal = sum(previewMonths);

  const vigente = state.budgets.find(item => item.current) ?? currentVersion(state);
  const vigenteTotal = vigente ? budgetTotal(vigente) : 0;
  const previewVersionTotal = version.lines.reduce((value, item) => {
    const itemAnnual = budgetAnnual(item);
    if (method === 'uniforme') return value + itemAnnual;
    if (method === 'porcentual') return value + sum(applyPercentages(itemAnnual, percentages));
    return value + (line && item.id === line.id ? manualTotal : itemAnnual);
  }, 0);
  const differenceVigente = previewVersionTotal - vigenteTotal;
  const differenceVigentePct = vigenteTotal > 0 ? (differenceVigente / vigenteTotal) * 100 : 0;

  function changeLine(id: string) {
    setLineId(id);
    const next = version.lines.find(item => item.id === id);
    const nextAnnual = next ? budgetAnnual(next) : 0;
    if (method === 'manual') {
      setManual(next ? [...next.monthly] : distributeAnnual(nextAnnual));
    } else if (method === 'porcentual') {
      setPercentages(next ? percentagesFrom(next.monthly, nextAnnual) : equalPercentages());
    }
  }

  function changeMethod(nextMethod: DistributionMethod) {
    setMethod(nextMethod);
    if (nextMethod === 'uniforme') {
      setPercentages(equalPercentages());
    } else if (nextMethod === 'porcentual') {
      setPercentages(line ? percentagesFrom(line.monthly, annual) : equalPercentages());
    } else {
      setManual(line ? [...line.monthly] : distributeAnnual(annual));
    }
  }

  function changePercentage(month: number, raw: string) {
    if (locked) return;
    const value = toAmount(raw);
    setPercentages(previous => previous.map((item, index) => (index === month ? value : item)));
  }

  function changeManual(month: number, raw: string) {
    if (locked) return;
    const value = Math.round(toAmount(raw));
    setManual(previous => previous.map((item, index) => (index === month ? value : item)));
  }

  function applyOne() {
    if (!line || locked || !valid) return;
    const months = previewMonths.map(value => Math.max(0, Math.round(value)));
    update(draft => {
      const target = draft.budgets.find(item => item.id === version.id);
      const targetLine = target?.lines.find(item => item.id === line.id);
      if (!target || !targetLine || isBudgetLocked(target)) return;
      targetLine.monthly = months;
    }, `Distribución ${method} aplicada a ${line.account}`, 'presupuesto');
    showToast(`Distribución aplicada a ${line.account} · ${line.accountName}.`);
  }

  function applyAll() {
    if (locked || !valid || method === 'manual') return;
    const distributions = version.lines.map(item => ({
      id: item.id,
      monthly: method === 'uniforme'
        ? distributeAnnual(budgetAnnual(item))
        : applyPercentages(budgetAnnual(item), percentages),
    }));
    update(draft => {
      const target = draft.budgets.find(item => item.id === version.id);
      if (!target || isBudgetLocked(target)) return;
      distributions.forEach(distribution => {
        const targetLine = target.lines.find(item => item.id === distribution.id);
        if (targetLine) targetLine.monthly = [...distribution.monthly];
      });
    }, `Distribución ${method} aplicada a todas las líneas de ${version.name}`, 'presupuesto');
    showToast(`Distribución aplicada a las ${version.lines.length} líneas de ${version.name}.`);
  }

  if (!line) {
    return (
      <EmptyState
        title="La versión no tiene líneas"
        detail="Agregue líneas desde el editor para poder distribuirlas entre los meses."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <VersionPicker versions={versions} value={version.id} onChange={onVersionChange} />
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(version.status)}>{version.status}</Badge>
          <Badge tone={scenarioTone(version.scenario)}>{version.scenario}</Badge>
          <span className="text-[11px] text-gray-500">{version.lines.length} líneas</span>
        </div>
      </div>

      {locked && <LockNotice version={version} action="cambios de distribución" />}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <SectionTitle
            title="Distribución mensual"
            detail={`${line.account} · ${line.accountName} · Centro ${line.costCenter}`}
          />
          <FilterBar>
            <Field label="Línea presupuestal" className="min-w-72">
              <FilterSelect value={line.id} onChange={event => changeLine(event.target.value)}>
                {version.lines.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.account} · {item.accountName} · {item.costCenter}
                  </option>
                ))}
              </FilterSelect>
            </Field>
            <Field label="Método de distribución">
              <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
                {DISTRIBUTION_METHODS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => changeMethod(option.id)}
                    disabled={locked}
                    className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition ${method === option.id ? 'bg-petroleum-50 text-petroleum-700' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </Field>
            <div className="ml-auto rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <span className="block text-[10px] font-medium text-gray-500">Valor anual de la línea</span>
              <Money value={annual} className="font-semibold text-gray-900" />
            </div>
          </FilterBar>

          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {MESES.map((monthName, month) => (
                <label key={monthName} className="block">
                  <span className="mb-1 block text-[10px] font-medium text-gray-500">{monthName}</span>
                  {method === 'manual' ? (
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      disabled={locked}
                      aria-label={`Valor manual ${monthName}`}
                      className={INPUT}
                      value={manual[month] ?? 0}
                      onChange={event => changeManual(month, event.target.value)}
                    />
                  ) : (
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        disabled={locked || method === 'uniforme'}
                        aria-label={`Porcentaje ${monthName}`}
                        className={`${INPUT} pr-6 text-right`}
                        value={percentages[month] ?? 0}
                        onChange={event => changePercentage(month, event.target.value)}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">%</span>
                    </div>
                  )}
                </label>
              ))}
            </div>

            {method === 'manual' ? (
              <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[11px] ${manualValid ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                <span>Asignado: <Money value={manualTotal} /> · Valor anual: <Money value={annual} /></span>
                <span>Diferencia: <Money value={manualDifference} /></span>
                {!manualValid && <span>Los valores deben sumar exactamente el valor anual.</span>}
              </div>
            ) : (
              <div className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[11px] ${percentageValid ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                <span>Suma de porcentajes: <strong>{pct(percentageTotal)}</strong></span>
                <span>{percentageValid ? 'La distribución cubre el 100 % del valor anual.' : 'Los porcentajes deben sumar 100 %.'}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={applyOne} disabled={locked || !valid}>
                Aplicar a una línea
              </Button>
              <Button onClick={applyAll} disabled={locked || !valid || method === 'manual'}>
                Aplicar a todas
              </Button>
              {method === 'manual' && (
                <span className="text-[11px] text-gray-500">La aplicación masiva solo está disponible con distribución uniforme o porcentual.</span>
              )}
            </div>
          </div>
        </Card>

        <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <Card>
            <SectionTitle title="Vista previa" detail="Resultado antes de aplicar" />
            <div className="grid grid-cols-2 gap-2 p-4">
              {MESES_CORTOS.map((month, index) => (
                <div key={month} className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
                  <span className="block text-[10px] text-gray-500">{month}</span>
                  <span className="tabular text-[11px] font-medium text-gray-800">{compactMoney(previewMonths[index] ?? 0)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-gray-100 px-4 py-3">
              <SummaryRow label="Total distribuido" value={previewTotal} tone="blue" strong />
              <SummaryRow label="Valor anual original" value={annual} />
              <SummaryRow label="Diferencia" value={previewTotal - annual} tone={previewTotal === annual ? 'gray' : 'amber'} />
            </div>
          </Card>

          <Card>
            <SectionTitle title="Comparación con vigente" detail={vigente ? vigente.name : 'Sin versión vigente'} />
            <div className="space-y-3 p-4">
              <SummaryRow label="Total de la versión" value={previewVersionTotal} tone="blue" strong />
              <SummaryRow label="Presupuesto vigente" value={vigenteTotal} />
              <SummaryRow label="Variación absoluta" value={differenceVigente} tone={differenceVigente === 0 ? 'gray' : 'amber'} strong />
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-gray-500">Variación porcentual</span>
                <Badge tone={differenceVigente === 0 ? 'gray' : differenceVigente > 0 ? 'amber' : 'green'}>
                  {pct(differenceVigentePct)}
                </Badge>
              </div>
              {vigente?.id === version.id && (
                <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] leading-5 text-blue-700">
                  La versión seleccionada es la vigente; la variación refleja el efecto de la distribución propuesta.
                </p>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

interface ApprovalViewProps {
  state: FinanceState;
  update: UpdateFn;
  showToast: ToastFn;
}

function ApprovalView({ state, update, showToast }: ApprovalViewProps) {
  const candidates = state.budgets.filter(version => version.status === 'En revisión' || version.status === 'Borrador');
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? '');
  const selected = candidates.find(version => version.id === selectedId) ?? candidates[0];
  const vigente = state.budgets.find(version => version.current) ?? currentVersion(state);

  if (candidates.length === 0) {
    return (
      <EmptyState
        title="No hay versiones pendientes de aprobación"
        detail="Las versiones en borrador o en revisión aparecerán aquí para su aprobación o rechazo."
      />
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <Card className="self-start">
        <SectionTitle title="Pendientes de aprobación" detail={`${candidates.length} versiones por revisar`} />
        <div className="divide-y divide-gray-100">
          {candidates.map(version => (
            <button
              key={version.id}
              type="button"
              onClick={() => setSelectedId(version.id)}
              className={`w-full px-4 py-3 text-left transition ${selected?.id === version.id ? 'bg-petroleum-50' : 'hover:bg-gray-50'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`text-xs font-medium ${selected?.id === version.id ? 'text-petroleum-800' : 'text-gray-800'}`}>{version.name}</span>
                <Badge tone={statusTone(version.status)}>{version.status}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-gray-500">
                <span>{version.year}</span>
                <span>·</span>
                <Badge tone={scenarioTone(version.scenario)}>{version.scenario}</Badge>
                <span>·</span>
                <span>{version.owner}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-gray-500">Total</span>
                <Money value={budgetTotal(version)} className="font-medium text-gray-800" />
              </div>
            </button>
          ))}
        </div>
      </Card>

      {selected && (
        <ApprovalDetail
          key={selected.id}
          version={selected}
          vigente={vigente}
          update={update}
          showToast={showToast}
        />
      )}
    </div>
  );
}

function ApprovalDetail({
  version,
  vigente,
  update,
  showToast,
}: {
  version: BudgetVersion;
  vigente: BudgetVersion | undefined;
  update: UpdateFn;
  showToast: ToastFn;
}) {
  const [comments, setComments] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const total = budgetTotal(version);
  const executed = budgetExecuted(version);
  const committed = budgetCommitted(version);
  const available = budgetAvailable(version);
  const vigenteTotal = vigente ? budgetTotal(vigente) : 0;
  const difference = total - vigenteTotal;
  const differencePct = vigenteTotal > 0 ? (difference / vigenteTotal) * 100 : 0;

  function approve(approver: string, acta: string, markCurrent: boolean) {
    update(draft => {
      const target = draft.budgets.find(item => item.id === version.id);
      if (!target) return;
      target.status = 'Aprobada';
      target.approvedBy = approver;
      target.approvedAt = HOY;
      if (markCurrent) {
        draft.budgets.forEach(item => {
          item.current = item.id === target.id;
        });
      }
    }, `Presupuesto ${version.name} aprobado por ${approver}. Acta: ${acta}${comments.trim() ? `. Comentarios: ${comments.trim()}` : ''}`, 'presupuesto');
    setApproveOpen(false);
    showToast(`Presupuesto ${version.name} aprobado${markCurrent ? ' y marcado como vigente' : ''}.`);
  }

  function reject(reason: string) {
    update(draft => {
      const target = draft.budgets.find(item => item.id === version.id);
      if (!target) return;
      target.status = 'Borrador';
      target.note = `${target.note}${target.note ? '\n\n' : ''}Rechazo ${fmtDate(HOY)}: ${reason}`;
    }, `Presupuesto ${version.name} rechazado: ${reason}`, 'presupuesto');
    setRejectOpen(false);
    showToast(`Presupuesto ${version.name} rechazado y devuelto a borrador.`);
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          title={version.name}
          detail={`${version.year} · ${version.scenario} · Responsable: ${version.owner}`}
          action={<Badge tone={statusTone(version.status)}>{version.status}</Badge>}
        />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 p-3">
            <span className="text-[10px] font-medium text-gray-500">Presupuesto total</span>
            <div className="mt-1"><Money value={total} className="text-sm font-semibold text-gray-900" /></div>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <span className="text-[10px] font-medium text-gray-500">Ejecutado</span>
            <div className="mt-1"><Money value={executed} className="text-sm font-semibold text-emerald-700" /></div>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <span className="text-[10px] font-medium text-gray-500">Comprometido</span>
            <div className="mt-1"><Money value={committed} className="text-sm font-semibold text-amber-700" /></div>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <span className="text-[10px] font-medium text-gray-500">Disponible</span>
            <div className="mt-1"><Money value={available} className={`text-sm font-semibold ${available < 0 ? 'text-red-700' : 'text-gray-900'}`} /></div>
          </div>
        </div>
        <div className="grid gap-3 border-t border-gray-100 px-4 py-4 sm:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <span className="block text-[10px] font-medium text-gray-500">Variación contra la versión vigente</span>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Money value={difference} className="text-sm font-semibold text-gray-900" />
              <Badge tone={difference === 0 ? 'gray' : difference > 0 ? 'amber' : 'green'}>{pct(differencePct)}</Badge>
            </div>
            <span className="mt-1 block text-[10px] text-gray-500">{vigente ? vigente.name : 'Sin versión vigente'}</span>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <span className="block text-[10px] font-medium text-gray-500">Aprobación registrada</span>
            <span className="mt-1 block text-xs font-medium text-gray-800">{version.approvedBy || 'Pendiente'}</span>
            <span className="mt-0.5 block text-[10px] text-gray-500">
              {version.approvedAt ? fmtDate(version.approvedAt) : 'Sin fecha de aprobación'}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Justificación y comentarios" detail="La justificación pertenece a la versión; los comentarios son del revisor." />
        <div className="space-y-3 p-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <span className="block text-[10px] font-medium text-gray-500">Justificación de la versión</span>
            <p className="mt-1 text-xs leading-5 text-gray-700">{version.note || 'Sin justificación registrada.'}</p>
          </div>
          <Field label="Comentarios del revisor" hint="Opcional">
            <textarea
              className={`${INPUT} min-h-24`}
              value={comments}
              onChange={event => setComments(event.target.value)}
              placeholder="Observaciones sobre las cifras, supuestos o soportes de la versión."
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="danger" onClick={() => setRejectOpen(true)}>Rechazar</Button>
            <Button variant="success" onClick={() => setApproveOpen(true)}>Aprobar versión</Button>
          </div>
        </div>
      </Card>

      {approveOpen && (
        <ApproveModal
          version={version}
          onClose={() => setApproveOpen(false)}
          onApprove={approve}
        />
      )}
      {rejectOpen && (
        <RejectModal
          version={version}
          onClose={() => setRejectOpen(false)}
          onReject={reject}
        />
      )}
    </div>
  );
}

function ApproveModal({
  version,
  onClose,
  onApprove,
}: {
  version: BudgetVersion;
  onClose: () => void;
  onApprove: (approver: string, acta: string, markCurrent: boolean) => void;
}) {
  const [approver, setApprover] = useState(USUARIO.nombre);
  const [acta, setActa] = useState('');
  const [markCurrent, setMarkCurrent] = useState(false);
  const [error, setError] = useState('');

  function submit() {
    if (!approver.trim()) {
      setError('El usuario aprobador es obligatorio.');
      return;
    }
    if (approver.trim().toLowerCase() === version.owner.trim().toLowerCase()) {
      setError('El aprobador debe ser distinto del responsable de la versión.');
      return;
    }
    if (acta.trim().length < 10) {
      setError('El acta de aprobación es obligatoria y debe tener al menos 10 caracteres.');
      return;
    }
    onApprove(approver.trim(), acta.trim(), markCurrent);
  }

  return (
    <Modal
      title="Aprobar versión presupuestal"
      subtitle={`${version.name} · Responsable: ${version.owner}`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <Field label="Usuario aprobador">
          <input className={INPUT} value={approver} maxLength={60} onChange={event => setApprover(event.target.value)} />
        </Field>
        <Field label="Acta de aprobación" hint="Obligatoria">
          <textarea
            className={`${INPUT} min-h-28`}
            value={acta}
            onChange={event => setActa(event.target.value)}
            placeholder="Número de acta, comité, fecha y decisión adoptada."
          />
        </Field>
        <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={markCurrent}
            onChange={event => setMarkCurrent(event.target.checked)}
          />
          <span>Marcar esta versión como vigente y retirar la vigencia de las demás.</span>
        </label>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="success" onClick={submit}>Confirmar aprobación</Button>
      </div>
    </Modal>
  );
}

function RejectModal({
  version,
  onClose,
  onReject,
}: {
  version: BudgetVersion;
  onClose: () => void;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function submit() {
    if (reason.trim().length < 5) {
      setError('Indique un motivo de rechazo de al menos 5 caracteres.');
      return;
    }
    onReject(reason.trim());
  }

  return (
    <Modal title="Rechazar versión presupuestal" subtitle={version.name} onClose={onClose}>
      <Field label="Motivo del rechazo" hint="Obligatorio">
        <textarea
          className={`${INPUT} min-h-28`}
          value={reason}
          onChange={event => setReason(event.target.value)}
          placeholder="Explique las cifras o supuestos que deben corregirse."
        />
      </Field>
      {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="danger" onClick={submit}>Confirmar rechazo</Button>
      </div>
    </Modal>
  );
}

interface ExecutionViewProps {
  versions: BudgetVersion[];
  version: BudgetVersion;
  update: UpdateFn;
  showToast: ToastFn;
  onVersionChange: (id: string) => void;
}

function ExecutionView({ versions, version, update, showToast, onVersionChange }: ExecutionViewProps) {
  const closed = version.status === 'Cerrada';
  const [account, setAccount] = useState('Todas');
  const [center, setCenter] = useState('Todos');
  const [selectedLineId, setSelectedLineId] = useState(version.lines[0]?.id ?? '');
  const [modal, setModal] = useState<{ mode: 'commit' | 'release'; lineId: string } | null>(null);
  const [lastRefresh, setLastRefresh] = useState('Corte inicial');

  const accounts = Array.from(new Set(version.lines.map(line => line.account)));
  const centers = Array.from(new Set(version.lines.map(line => line.costCenter)));
  const rows = version.lines.filter(line => (
    (account === 'Todas' || line.account === account)
    && (center === 'Todos' || line.costCenter === center)
  ));
  const selected = rows.find(line => line.id === selectedLineId) ?? null;

  const total = rows.reduce((value, line) => value + budgetAnnual(line), 0);
  const executed = rows.reduce((value, line) => value + line.executed, 0);
  const committed = rows.reduce((value, line) => value + line.committed, 0);
  const available = total - executed - committed;

  function refresh() {
    setLastRefresh(new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }));
    showToast(`Ejecución recalculada desde el estado al corte ${fmtDate(HOY)}.`);
  }

  function submitCommitment(payload: { lineId: string; amount: number; note: string }) {
    if (!modal || closed) return;
    const line = version.lines.find(item => item.id === payload.lineId);
    if (!line) return;
    const availableLine = lineAvailable(line);
    if (modal.mode === 'commit' && payload.amount > availableLine) {
      showToast('El compromiso supera el disponible de la línea.');
      return;
    }
    if (modal.mode === 'release' && payload.amount > line.committed) {
      showToast('La liberación supera el compromiso acumulado de la línea.');
      return;
    }
    const mode = modal.mode;
    update(draft => {
      const target = draft.budgets.find(item => item.id === version.id);
      const targetLine = target?.lines.find(item => item.id === payload.lineId);
      if (!target || !targetLine || target.status === 'Cerrada') return;
      if (mode === 'commit') {
        targetLine.committed += payload.amount;
        const annual = budgetAnnual(targetLine);
        const ratio = annual > 0 ? ((targetLine.executed + targetLine.committed) / annual) * 100 : 0;
        if (ratio >= 90) {
          const exists = draft.budgetAlerts.some(alert => (
            alert.versionId === version.id
            && alert.account === targetLine.account
            && alert.center === targetLine.costCenter
            && alert.status === 'Abierta'
          ));
          if (!exists) {
            const alert: BudgetAlert = {
              id: newId('alert'),
              versionId: version.id,
              account: targetLine.account,
              center: targetLine.costCenter,
              type: 'Compromiso',
              message: `Compromisos de ${targetLine.accountName} alcanzan ${pct(ratio)} del presupuesto anual.`,
              severity: ratio >= 100 ? 'Alta' : 'Media',
              status: 'Abierta',
              date: HOY,
            };
            draft.budgetAlerts.unshift(alert);
          }
        }
      } else {
        targetLine.committed = Math.max(0, targetLine.committed - payload.amount);
      }
    }, mode === 'commit'
      ? `Compromiso registrado en ${line.account} por ${money(payload.amount)}${payload.note ? ` · ${payload.note}` : ''}`
      : `Compromiso liberado en ${line.account} por ${money(payload.amount)}${payload.note ? ` · ${payload.note}` : ''}`,
    'presupuesto');
    setModal(null);
    showToast(mode === 'commit'
      ? `Compromiso de ${money(payload.amount)} registrado en ${line.account}.`
      : `Compromiso de ${money(payload.amount)} liberado en ${line.account}.`);
  }

  function exportCsv() {
    const data: (string | number)[][] = [
      ['Cuenta', 'Nombre', 'Centro', 'Presupuesto', 'Comprometido', 'Ejecutado', 'Disponible', 'Ejecución %', 'Uso %', 'Semáforo'],
      ...rows.map(line => {
        const signal = trafficLight(usedPercentage(line));
        return [
          line.account,
          line.accountName,
          line.costCenter,
          budgetAnnual(line),
          line.committed,
          line.executed,
          lineAvailable(line),
          Number(executionPercentage(line).toFixed(1)),
          Number(usedPercentage(line).toFixed(1)),
          signal.label,
        ];
      }),
    ];
    downloadCsv(`ejecucion-${version.year}.csv`, data);
    showToast(`Exportación generada con ${rows.length} líneas de ejecución.`);
  }

  const columns: Column<BudgetLine>[] = [
    {
      header: 'Cuenta',
      cell: line => (
        <div>
          <div className="font-medium text-gray-800">{line.account}</div>
          <div className="text-[10px] text-gray-500">{line.accountName}</div>
        </div>
      ),
    },
    {
      header: 'Centro',
      cell: line => <Badge tone="gray">{line.costCenter}</Badge>,
    },
    {
      header: 'Presupuesto',
      align: 'right',
      cell: line => <Money value={budgetAnnual(line)} />,
    },
    {
      header: 'Comprometido',
      align: 'right',
      cell: line => <Money value={line.committed} />,
    },
    {
      header: 'Ejecutado',
      align: 'right',
      cell: line => <Money value={line.executed} />,
    },
    {
      header: 'Disponible',
      align: 'right',
      cell: line => (
        <Money
          value={lineAvailable(line)}
          className={lineAvailable(line) < 0 ? 'font-semibold text-red-700' : 'font-medium text-gray-800'}
        />
      ),
    },
    {
      header: '% ejecución',
      cell: line => (
        <Progress
          value={executionPercentage(line)}
          tone={usedPercentage(line) >= 90 ? 'red' : usedPercentage(line) >= 70 ? 'amber' : 'green'}
          label="Ejecutado"
        />
      ),
    },
    {
      header: 'Semáforo',
      cell: line => {
        const signal = trafficLight(usedPercentage(line));
        return <Badge tone={signal.tone}>{signal.label}</Badge>;
      },
    },
    {
      header: 'Acciones',
      align: 'right',
      cell: line => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" disabled={closed} onClick={() => setModal({ mode: 'commit', lineId: line.id })}>
            Comprometer
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={closed || line.committed <= 0}
            onClick={() => setModal({ mode: 'release', lineId: line.id })}
          >
            Liberar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <VersionPicker versions={versions} value={version.id} onChange={onVersionChange} />
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone(version.status)}>{version.status}</Badge>
          <span className="text-[11px] text-gray-500">Última actualización: {lastRefresh}</span>
        </div>
      </div>

      {closed && <LockNotice version={version} action="movimientos de compromiso" />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Presupuesto filtrado" value={<Money value={total} />} detail={`${rows.length} líneas`} tone="blue" />
        <KpiCard label="Ejecutado" value={<Money value={executed} />} detail={pct(total > 0 ? (executed / total) * 100 : 0)} tone="green" />
        <KpiCard label="Comprometido" value={<Money value={committed} />} detail={pct(total > 0 ? (committed / total) * 100 : 0)} tone="amber" />
        <KpiCard label="Disponible" value={<Money value={available} />} detail={pct(total > 0 ? (available / total) * 100 : 0)} tone={available < 0 ? 'red' : 'cyan'} />
      </div>

      <Card>
        <SectionTitle
          title="Ejecución por cuenta y centro"
          detail="El semáforo considera ejecutado más comprometido sobre el presupuesto anual."
          action={(
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={refresh}><Icon name="clock" className="h-3.5 w-3.5" /> Refrescar</Button>
              <Button size="sm" onClick={exportCsv}><Icon name="download" className="h-3.5 w-3.5" /> Exportar CSV</Button>
              <Button
                size="sm"
                variant="primary"
                disabled={closed || rows.length === 0}
                onClick={() => setModal({ mode: 'commit', lineId: selected?.id ?? rows[0]?.id ?? '' })}
              >
                <Icon name="plus" className="h-3.5 w-3.5" /> Registrar compromiso
              </Button>
            </div>
          )}
        />
        <FilterBar>
          <Field label="Cuenta" className="min-w-48">
            <FilterSelect
              value={account}
              onChange={event => {
                setAccount(event.target.value);
                setSelectedLineId('');
              }}
            >
              <option value="Todas">Todas las cuentas</option>
              {accounts.map(item => <option key={item} value={item}>{item}</option>)}
            </FilterSelect>
          </Field>
          <Field label="Centro de costo" className="min-w-40">
            <FilterSelect
              value={center}
              onChange={event => {
                setCenter(event.target.value);
                setSelectedLineId('');
              }}
            >
              <option value="Todos">Todos los centros</option>
              {centers.map(item => <option key={item} value={item}>{item}</option>)}
            </FilterSelect>
          </Field>
          <span className="pb-2 text-[11px] text-gray-500">Seleccione una fila para ver el detalle de compromisos.</span>
        </FilterBar>
        <div className="p-4">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={line => line.id}
            onRowClick={line => setSelectedLineId(line.id)}
            empty="No hay líneas que coincidan con los filtros seleccionados."
          />
        </div>
      </Card>

      {selected && (
        <Card>
          <SectionTitle
            title={`Compromisos · ${selected.account} ${selected.accountName}`}
            detail={`Centro ${selected.costCenter} · presupuesto ${money(budgetAnnual(selected))}`}
            action={(
              <div className="flex gap-2">
                <Button size="sm" disabled={closed} onClick={() => setModal({ mode: 'commit', lineId: selected.id })}>Registrar</Button>
                <Button size="sm" disabled={closed || selected.committed <= 0} onClick={() => setModal({ mode: 'release', lineId: selected.id })}>Liberar</Button>
              </div>
            )}
          />
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 p-3">
              <span className="text-[10px] font-medium text-gray-500">Compromiso acumulado</span>
              <div className="mt-1"><Money value={selected.committed} className="text-sm font-semibold text-amber-700" /></div>
              <span className="mt-1 block text-[10px] text-gray-500">{pct(budgetAnnual(selected) > 0 ? (selected.committed / budgetAnnual(selected)) * 100 : 0)} del anual</span>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <span className="text-[10px] font-medium text-gray-500">Ejecutado</span>
              <div className="mt-1"><Money value={selected.executed} className="text-sm font-semibold text-emerald-700" /></div>
              <span className="mt-1 block text-[10px] text-gray-500">{pct(executionPercentage(selected))} del anual</span>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <span className="text-[10px] font-medium text-gray-500">Disponible</span>
              <div className="mt-1"><Money value={lineAvailable(selected)} className={`text-sm font-semibold ${lineAvailable(selected) < 0 ? 'text-red-700' : 'text-gray-900'}`} /></div>
              <span className="mt-1 block text-[10px] text-gray-500">Después de compromisos y ejecución</span>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <span className="text-[10px] font-medium text-gray-500">Uso total</span>
              <div className="mt-2">
                <Progress
                  value={usedPercentage(selected)}
                  tone={usedPercentage(selected) >= 90 ? 'red' : usedPercentage(selected) >= 70 ? 'amber' : 'green'}
                  label="Ejecutado + comprometido"
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {modal && (
        <CommitmentModal
          version={version}
          mode={modal.mode}
          initialLineId={modal.lineId}
          onClose={() => setModal(null)}
          onSubmit={submitCommitment}
        />
      )}
    </div>
  );
}

function CommitmentModal({
  version,
  mode,
  initialLineId,
  onClose,
  onSubmit,
}: {
  version: BudgetVersion;
  mode: 'commit' | 'release';
  initialLineId: string;
  onClose: () => void;
  onSubmit: (payload: { lineId: string; amount: number; note: string }) => void;
}) {
  const [lineId, setLineId] = useState(initialLineId || version.lines[0]?.id || '');
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const line = version.lines.find(item => item.id === lineId);
  const limit = line ? (mode === 'commit' ? lineAvailable(line) : line.committed) : 0;

  function changeLine(id: string) {
    setLineId(id);
    setAmount(0);
    setError('');
  }

  function submit() {
    if (!line) {
      setError('Seleccione una línea presupuestal.');
      return;
    }
    const value = Math.round(amount);
    if (value <= 0) {
      setError('El monto debe ser mayor que cero.');
      return;
    }
    if (value > limit) {
      setError(mode === 'commit'
        ? `El disponible de la línea es ${money(limit)}.`
        : `El compromiso acumulado de la línea es ${money(limit)}.`);
      return;
    }
    onSubmit({ lineId: line.id, amount: value, note: note.trim() });
  }

  return (
    <Modal
      title={mode === 'commit' ? 'Registrar compromiso' : 'Liberar compromiso'}
      subtitle={version.name}
      onClose={onClose}
    >
      <div className="space-y-3">
        <Field label="Línea presupuestal">
          <select className={INPUT} value={lineId} onChange={event => changeLine(event.target.value)}>
            {version.lines.map(item => (
              <option key={item.id} value={item.id}>
                {item.account} · {item.accountName} · {item.costCenter}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Monto">
            <input
              type="number"
              min={0}
              step={1000}
              className={INPUT}
              value={amount}
              onChange={event => setAmount(toAmount(event.target.value))}
            />
          </Field>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <span className="block text-[10px] font-medium text-gray-500">
              {mode === 'commit' ? 'Disponible de la línea' : 'Compromiso acumulado'}
            </span>
            <Money value={limit} className="font-semibold text-gray-900" />
          </div>
        </div>
        {line && (
          <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-500">
            <div>Presupuesto<br /><Money value={budgetAnnual(line)} className="text-[11px] font-medium text-gray-800" /></div>
            <div>Ejecutado<br /><Money value={line.executed} className="text-[11px] font-medium text-gray-800" /></div>
            <div>Comprometido<br /><Money value={line.committed} className="text-[11px] font-medium text-gray-800" /></div>
          </div>
        )}
        <Field label="Concepto o referencia" hint="Opcional">
          <input
            className={INPUT}
            value={note}
            maxLength={120}
            onChange={event => setNote(event.target.value)}
            placeholder="Contrato, orden de compra o soporte del compromiso."
          />
        </Field>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant={mode === 'commit' ? 'primary' : 'danger'} onClick={submit} disabled={limit <= 0}>
          {mode === 'commit' ? 'Registrar compromiso' : 'Liberar compromiso'}
        </Button>
      </div>
    </Modal>
  );
}

interface ComparisonRow {
  line: BudgetLine;
  hasPair: boolean;
  comparisonAnnual: number;
  variation: number;
  variationPct: number | null;
}

interface ComparisonViewProps {
  state: FinanceState;
  version: BudgetVersion;
  showToast: ToastFn;
  onVersionChange: (id: string) => void;
}

function ComparisonView({ state, version, showToast, onVersionChange }: ComparisonViewProps) {
  const scenarios = Array.from(new Set(state.budgets.map(item => item.scenario)));
  const [scenario, setScenario] = useState<'Todos' | Scenario>('Todos');
  const [compareId, setCompareId] = useState(() => {
    const alternative = state.budgets.find(item => item.id !== version.id);
    return alternative?.id ?? version.id;
  });

  const filtered = state.budgets.filter(item => scenario === 'Todos' || item.scenario === scenario);
  const primary = filtered.find(item => item.id === version.id) ?? filtered[0] ?? version;
  const comparison = filtered.find(item => item.id === compareId) ?? filtered.find(item => item.id !== primary.id) ?? primary;

  const rows = useMemo<ComparisonRow[]>(() => primary.lines.map(line => {
    const base = comparison.lines.find(item => item.account === line.account && item.costCenter === line.costCenter);
    const comparisonAnnual = base ? budgetAnnual(base) : 0;
    const annual = budgetAnnual(line);
    const variation = annual - comparisonAnnual;
    return {
      line,
      hasPair: Boolean(base),
      comparisonAnnual,
      variation,
      variationPct: base && comparisonAnnual !== 0 ? (variation / comparisonAnnual) * 100 : null,
    };
  }), [primary, comparison]);

  const total = primary.lines.reduce((value, line) => value + budgetAnnual(line), 0);
  const executed = budgetExecuted(primary);
  const committed = budgetCommitted(primary);
  const available = budgetAvailable(primary);
  const comparisonTotal = budgetTotal(comparison);
  const difference = total - comparisonTotal;
  const differencePct = comparisonTotal > 0 ? (difference / comparisonTotal) * 100 : 0;
  const variationTotal = rows.reduce((value, row) => value + row.variation, 0);
  const chartData = Array.from(new Set(primary.lines.map(line => line.account))).map(account => ({
    label: account,
    value: primary.lines
      .filter(line => line.account === account)
      .reduce((value, line) => value + budgetAnnual(line), 0),
  }));

  function exportCsv() {
    const data: (string | number)[][] = [
      ['Cuenta', 'Nombre', 'Centro', `Presupuesto ${primary.name}`, `Presupuesto ${comparison.name}`, 'Ejecutado', 'Comprometido', 'Disponible', 'Variación', 'Variación %'],
      ...rows.map(row => [
        row.line.account,
        row.line.accountName,
        row.line.costCenter,
        budgetAnnual(row.line),
        row.comparisonAnnual,
        row.line.executed,
        row.line.committed,
        lineAvailable(row.line),
        row.variation,
        row.variationPct === null ? '' : Number(row.variationPct.toFixed(1)),
      ]),
    ];
    downloadCsv(`comparativo-${primary.year}.csv`, data);
    showToast(`Exportación generada con ${rows.length} líneas del comparativo.`);
  }

  function changePrimary(id: string) {
    onVersionChange(id);
    if (id === comparison.id) {
      const alternative = filtered.find(item => item.id !== id);
      if (alternative) setCompareId(alternative.id);
    }
  }

  const columns: Column<ComparisonRow>[] = [
    {
      header: 'Cuenta',
      cell: row => (
        <div>
          <div className="font-medium text-gray-800">{row.line.account}</div>
          <div className="text-[10px] text-gray-500">{row.line.accountName}</div>
          {!row.hasPair && <span className="text-[10px] text-amber-600">Sin par en la versión comparada</span>}
        </div>
      ),
    },
    {
      header: 'Centro',
      cell: row => <Badge tone="gray">{row.line.costCenter}</Badge>,
    },
    {
      header: 'Presupuesto',
      align: 'right',
      cell: row => <Money value={budgetAnnual(row.line)} />,
    },
    {
      header: 'Ejecutado',
      align: 'right',
      cell: row => <Money value={row.line.executed} />,
    },
    {
      header: 'Comprometido',
      align: 'right',
      cell: row => <Money value={row.line.committed} />,
    },
    {
      header: 'Disponible',
      align: 'right',
      cell: row => (
        <Money
          value={lineAvailable(row.line)}
          className={lineAvailable(row.line) < 0 ? 'font-semibold text-red-700' : 'text-gray-800'}
        />
      ),
    },
    {
      header: 'Variación',
      align: 'right',
      cell: row => (
        <Money
          value={row.variation}
          className={row.variation > 0 ? 'font-medium text-red-700' : row.variation < 0 ? 'font-medium text-emerald-700' : 'text-gray-700'}
        />
      ),
    },
    {
      header: 'Variación %',
      align: 'right',
      cell: row => (
        row.variationPct === null
          ? <span className="text-gray-400">—</span>
          : <Badge tone={row.variationPct > 0 ? 'red' : row.variationPct < 0 ? 'green' : 'gray'}>{pct(row.variationPct)}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Versión analizada"
          value={<span className="text-sm">{primary.name}</span>}
          detail={`${primary.year} · ${primary.scenario}`}
          tone="blue"
        />
        <KpiCard label="Presupuesto analizado" value={<Money value={total} />} detail={`${primary.lines.length} líneas`} tone="cyan" />
        <KpiCard label="Versión comparada" value={<span className="text-sm">{comparison.name}</span>} detail={`Total ${money(comparisonTotal)}`} tone="gray" />
        <KpiCard
          label="Variación total"
          value={<Money value={difference} />}
          detail={`${pct(differencePct)} frente a ${comparison.scenario}`}
          tone={difference === 0 ? 'gray' : difference > 0 ? 'amber' : 'green'}
        />
      </div>

      <Card>
        <SectionTitle
          title="Comparación de versiones"
          detail="La variación se calcula por cuenta y centro de costo contra la versión comparada."
          action={<Button size="sm" onClick={exportCsv}><Icon name="download" className="h-3.5 w-3.5" /> Exportar CSV</Button>}
        />
        <FilterBar>
          <Field label="Escenario" className="min-w-40">
            <FilterSelect value={scenario} onChange={event => setScenario(event.target.value as 'Todos' | Scenario)}>
              <option value="Todos">Todos los escenarios</option>
              {scenarios.map(item => <option key={item} value={item}>{item}</option>)}
            </FilterSelect>
          </Field>
          <VersionPicker
            versions={filtered}
            value={primary.id}
            onChange={changePrimary}
            label="Versión analizada"
          />
          <VersionPicker
            versions={filtered}
            value={comparison.id}
            onChange={setCompareId}
            label="Comparar con"
          />
        </FilterBar>
        <div className="p-4">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={row => row.line.id}
            empty="La versión analizada no tiene líneas para comparar."
            footer={(
              <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-gray-600">
                <span>{rows.length} líneas comparadas · {primary.name} frente a {comparison.name}</span>
                <span className="flex flex-wrap gap-4">
                  <span>Presupuesto: <Money value={total} className="font-semibold text-gray-900" /></span>
                  <span>Ejecutado: <Money value={executed} /></span>
                  <span>Comprometido: <Money value={committed} /></span>
                  <span>Disponible: <Money value={available} /></span>
                  <span>Variación: <Money value={variationTotal} /></span>
                </span>
              </div>
            )}
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <SectionTitle title="Presupuesto por cuenta" detail={`${primary.name} · ${primary.year}`} />
          <div className="p-4">
            {chartData.length > 0 ? (
              <BarChart data={chartData} height={170} tone="blue" formatter={compactMoney} />
            ) : (
              <p className="py-10 text-center text-xs text-gray-500">Sin cuentas para graficar.</p>
            )}
          </div>
        </Card>
        <Card>
          <SectionTitle title="Lectura del comparativo" />
          <div className="space-y-3 p-4">
            <SummaryRow label="Presupuesto analizado" value={total} tone="blue" strong />
            <SummaryRow label="Presupuesto comparado" value={comparisonTotal} />
            <SummaryRow label="Variación absoluta" value={difference} tone={difference === 0 ? 'gray' : 'amber'} strong />
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-gray-500">Variación porcentual</span>
              <Badge tone={difference === 0 ? 'gray' : difference > 0 ? 'amber' : 'green'}>{pct(differencePct)}</Badge>
            </div>
            <p className="border-t border-gray-100 pt-3 text-[11px] leading-5 text-gray-500">
              {primary.id === comparison.id
                ? 'La versión analizada y la comparada son la misma; seleccione otra versión para ver variaciones.'
                : `Las cifras positivas indican mayor presupuesto en ${primary.name} frente a ${comparison.name}.`}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

interface AlertsViewProps {
  state: FinanceState;
  version: BudgetVersion;
  update: UpdateFn;
  showToast: ToastFn;
}

function AlertsView({ state, version, update, showToast }: AlertsViewProps) {
  const [versionFilter, setVersionFilter] = useState('Todas');
  const [severity, setSeverity] = useState<'Todas' | BudgetAlert['severity']>('Todas');
  const [type, setType] = useState<'Todos' | BudgetAlert['type']>('Todos');
  const [status, setStatus] = useState<'Todos' | BudgetAlert['status']>('Todos');
  const [muteAlert, setMuteAlert] = useState<BudgetAlert | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const openAlerts = state.budgetAlerts.filter(alert => alert.status === 'Abierta');
  const summary = {
    alta: openAlerts.filter(alert => alert.severity === 'Alta').length,
    media: openAlerts.filter(alert => alert.severity === 'Media').length,
    baja: openAlerts.filter(alert => alert.severity === 'Baja').length,
    silenciadas: state.budgetAlerts.filter(alert => alert.status === 'Silenciada').length,
  };

  const filtered = state.budgetAlerts.filter(alert => (
    (versionFilter === 'Todas' || alert.versionId === versionFilter)
    && (severity === 'Todas' || alert.severity === severity)
    && (type === 'Todos' || alert.type === type)
    && (status === 'Todos' || alert.status === status)
  ));

  function chooseVersion(id: string) {
    setVersionFilter(id);
  }

  function mute(reason: string) {
    if (!muteAlert) return;
    update(draft => {
      const target = draft.budgetAlerts.find(alert => alert.id === muteAlert.id);
      if (target) target.status = 'Silenciada';
    }, `Alerta ${muteAlert.account}/${muteAlert.center} silenciada: ${reason}`, 'presupuesto');
    showToast(`Alerta de ${muteAlert.account} silenciada.`);
    setMuteAlert(null);
  }

  function reactivate(alert: BudgetAlert) {
    update(draft => {
      const target = draft.budgetAlerts.find(item => item.id === alert.id);
      if (target) target.status = 'Abierta';
    }, `Alerta ${alert.account}/${alert.center} reactivada`, 'presupuesto');
    showToast(`Alerta de ${alert.account} reactivada.`);
  }

  function createAlert(payload: { line: BudgetLine; type: BudgetAlert['type']; severity: BudgetAlert['severity']; threshold: number }) {
    const alert: BudgetAlert = {
      id: newId('alert'),
      versionId: version.id,
      account: payload.line.account,
      center: payload.line.costCenter,
      type: payload.type,
      message: `Umbral de ${payload.threshold} % configurado para ${payload.line.accountName} (${payload.line.account}/${payload.line.costCenter}).`,
      severity: payload.severity,
      status: 'Abierta',
      date: HOY,
    };
    update(draft => {
      draft.budgetAlerts.unshift(alert);
    }, `Umbral de ${payload.threshold} % configurado para ${payload.line.account}`, 'presupuesto');
    setConfigOpen(false);
    showToast(`Alerta creada para ${payload.line.account} con umbral de ${payload.threshold} %.`);
  }

  const columns: Column<BudgetAlert>[] = [
    {
      header: 'Versión',
      cell: alert => {
        const budget = state.budgets.find(item => item.id === alert.versionId);
        return <span className="text-[11px] text-gray-700">{budget?.name ?? 'Sin versión'}</span>;
      },
    },
    {
      header: 'Cuenta',
      cell: alert => <span className="font-medium text-gray-800">{alert.account}</span>,
    },
    {
      header: 'Centro',
      cell: alert => <Badge tone="gray">{alert.center}</Badge>,
    },
    {
      header: 'Tipo',
      cell: alert => <span className="text-gray-700">{alert.type}</span>,
    },
    {
      header: 'Mensaje',
      cell: alert => <span className="block max-w-md text-[11px] leading-5 text-gray-600">{alert.message}</span>,
    },
    {
      header: 'Severidad',
      cell: alert => <Badge tone={severityTone(alert.severity)}>{alert.severity}</Badge>,
    },
    {
      header: 'Fecha',
      cell: alert => <span className="whitespace-nowrap text-gray-600">{fmtDate(alert.date)}</span>,
    },
    {
      header: 'Estado',
      cell: alert => <Badge tone={statusTone(alert.status)}>{alert.status}</Badge>,
    },
    {
      header: 'Acciones',
      align: 'right',
      cell: alert => (
        alert.status === 'Abierta'
          ? <Button size="sm" variant="ghost" onClick={() => setMuteAlert(alert)}>Silenciar</Button>
          : <Button size="sm" variant="ghost" onClick={() => reactivate(alert)}>Reactivar</Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Alertas alta abiertas" value={String(summary.alta)} detail="Requieren revisión inmediata" tone={summary.alta > 0 ? 'red' : 'green'} />
        <KpiCard label="Alertas media abiertas" value={String(summary.media)} detail="Seguimiento del comité" tone="amber" />
        <KpiCard label="Alertas baja abiertas" value={String(summary.baja)} detail="Observación preventiva" tone="blue" />
        <KpiCard label="Alertas silenciadas" value={String(summary.silenciadas)} detail="Pueden reactivarse en cualquier momento" tone="gray" />
      </div>

      <Card>
        <SectionTitle
          title="Alertas presupuestales"
          detail="Las alertas se generan por umbral, desviación o compromiso sobre las versiones."
          action={<Button size="sm" variant="primary" onClick={() => setConfigOpen(true)}>Configurar umbrales</Button>}
        />
        <FilterBar>
          <Field label="Versión" className="min-w-52">
            <FilterSelect value={versionFilter} onChange={event => chooseVersion(event.target.value)}>
              <option value="Todas">Todas las versiones</option>
              {state.budgets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </FilterSelect>
          </Field>
          <Field label="Severidad" className="min-w-36">
            <FilterSelect value={severity} onChange={event => setSeverity(event.target.value as 'Todas' | BudgetAlert['severity'])}>
              <option value="Todas">Todas</option>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </FilterSelect>
          </Field>
          <Field label="Tipo" className="min-w-36">
            <FilterSelect value={type} onChange={event => setType(event.target.value as 'Todos' | BudgetAlert['type'])}>
              <option value="Todos">Todos</option>
              <option value="Umbral">Umbral</option>
              <option value="Desviación">Desviación</option>
              <option value="Compromiso">Compromiso</option>
            </FilterSelect>
          </Field>
          <Field label="Estado" className="min-w-36">
            <FilterSelect value={status} onChange={event => setStatus(event.target.value as 'Todos' | BudgetAlert['status'])}>
              <option value="Todos">Todos</option>
              <option value="Abierta">Abierta</option>
              <option value="Silenciada">Silenciada</option>
            </FilterSelect>
          </Field>
        </FilterBar>
        <div className="p-4">
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={alert => alert.id}
            empty="No hay alertas que coincidan con los filtros seleccionados."
          />
        </div>
      </Card>

      {muteAlert && (
        <MuteAlertModal
          alert={muteAlert}
          onClose={() => setMuteAlert(null)}
          onMute={mute}
        />
      )}

      {configOpen && (
        <ThresholdModal
          version={version}
          onClose={() => setConfigOpen(false)}
          onCreate={createAlert}
        />
      )}
    </div>
  );
}

function MuteAlertModal({
  alert,
  onClose,
  onMute,
}: {
  alert: BudgetAlert;
  onClose: () => void;
  onMute: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function submit() {
    if (reason.trim().length < 5) {
      setError('Indique un motivo de al menos 5 caracteres.');
      return;
    }
    onMute(reason.trim());
  }

  return (
    <Modal title="Silenciar alerta" subtitle={`${alert.account} · ${alert.center} · ${alert.type}`} onClose={onClose}>
      <p className="rounded-lg bg-gray-50 px-3 py-2 text-[11px] leading-5 text-gray-600">{alert.message}</p>
      <div className="mt-3">
        <Field label="Motivo del silencio" hint="Obligatorio">
          <textarea
            className={`${INPUT} min-h-24`}
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder="Justifique por qué se silencia la alerta."
          />
        </Field>
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={submit}>Silenciar alerta</Button>
      </div>
    </Modal>
  );
}

function ThresholdModal({
  version,
  onClose,
  onCreate,
}: {
  version: BudgetVersion;
  onClose: () => void;
  onCreate: (payload: { line: BudgetLine; type: BudgetAlert['type']; severity: BudgetAlert['severity']; threshold: number }) => void;
}) {
  const firstLine = version.lines[0];
  const [lineKey, setLineKey] = useState(firstLine ? `${firstLine.account}|${firstLine.costCenter}` : '');
  const [type, setType] = useState<BudgetAlert['type']>('Umbral');
  const [severity, setSeverity] = useState<BudgetAlert['severity']>('Media');
  const [threshold, setThreshold] = useState('85');
  const [error, setError] = useState('');
  const line = version.lines.find(item => `${item.account}|${item.costCenter}` === lineKey);

  function submit() {
    if (!line) {
      setError('La versión no tiene líneas sobre las cuales configurar un umbral.');
      return;
    }
    const value = Number(threshold);
    if (!Number.isFinite(value) || value < 1 || value > 100) {
      setError('El umbral debe ser un valor entre 1 % y 100 %.');
      return;
    }
    onCreate({ line, type, severity, threshold: Math.round(value) });
  }

  return (
    <Modal
      title="Configuración de umbrales"
      subtitle={`${version.name} · simulación de seguimiento presupuestal`}
      onClose={onClose}
    >
      {version.lines.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          La versión seleccionada no tiene líneas. Agregue líneas desde el editor antes de configurar umbrales.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Línea presupuestal" className="sm:col-span-2">
            <select className={INPUT} value={lineKey} onChange={event => setLineKey(event.target.value)}>
              {version.lines.map(item => (
                <option key={item.id} value={`${item.account}|${item.costCenter}`}>
                  {item.account} · {item.accountName} · {item.costCenter}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de alerta">
            <select className={INPUT} value={type} onChange={event => setType(event.target.value as BudgetAlert['type'])}>
              <option value="Umbral">Umbral</option>
              <option value="Desviación">Desviación</option>
              <option value="Compromiso">Compromiso</option>
            </select>
          </Field>
          <Field label="Severidad">
            <select className={INPUT} value={severity} onChange={event => setSeverity(event.target.value as BudgetAlert['severity'])}>
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </select>
          </Field>
          <Field label="Umbral de consumo" hint="Porcentaje">
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              className={INPUT}
              value={threshold}
              onChange={event => setThreshold(event.target.value)}
            />
          </Field>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
            <span className="block text-[10px] font-medium text-gray-500">Centro de costo</span>
            <span className="font-medium text-gray-800">{line?.costCenter ?? '—'}</span>
            <span className="mt-1 block text-[10px] text-gray-500">La configuración crea una alerta de seguimiento.</span>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-xs text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={submit} disabled={version.lines.length === 0}>Crear alerta</Button>
      </div>
    </Modal>
  );
}

export default function Presupuesto({ page, onNavigate }: Props) {
  const { state, update } = useFinance();
  const slug = page.split('/')[1] ?? 'versiones';
  const activeSlug = SLUGS.includes(slug) ? slug : 'versiones';
  const vigente = state.budgets.find(version => version.current) ?? currentVersion(state);
  const [versionId, setVersionId] = useState(vigente?.id ?? state.budgets[0]?.id ?? '');
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [toast, setToast] = useState('');

  const version = state.budgets.find(item => item.id === versionId) ?? vigente ?? state.budgets[0];
  const header = NAV_TITLES[activeSlug] ?? NAV_TITLES.versiones;

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => {
      setToast(current => (current === text ? '' : current));
    }, 3500);
  }

  function openEditor(id: string) {
    setVersionId(id);
    onNavigate(`${MODULE_ID}/editor`);
  }

  function openComparison(id: string) {
    setVersionId(id);
    onNavigate(`${MODULE_ID}/comparativo`);
  }

  function createVersion(payload: NewVersionPayload) {
    const id = newId('bgt');
    update(draft => {
      draft.budgets.unshift({
        id,
        name: payload.name,
        year: payload.year,
        scenario: payload.scenario,
        status: 'Borrador',
        owner: payload.owner,
        approvedBy: '',
        approvedAt: '',
        note: 'Versión creada desde la bandeja de presupuestos.',
        current: false,
        lines: [],
      });
    }, `Nueva versión presupuestal ${payload.name}`, 'presupuesto');
    setVersionId(id);
    setNewVersionOpen(false);
    showToast(`Versión ${payload.name} creada como borrador.`);
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4 lg:p-5">
      <PageHeader
        eyebrow="Presupuestos"
        title={header.title}
        subtitle={header.subtitle}
        actions={activeSlug === 'versiones' || !version ? (
          <Button variant="primary" onClick={() => setNewVersionOpen(true)}>
            <Icon name="plus" className="h-3.5 w-3.5" /> Nueva versión
          </Button>
        ) : undefined}
      />

      {activeSlug === 'versiones' && (
        <VersionsView
          state={state}
          update={update}
          onEdit={openEditor}
          onCompare={openComparison}
          onNew={() => setNewVersionOpen(true)}
          showToast={showToast}
        />
      )}

      {activeSlug !== 'versiones' && !version && (
        <EmptyState
          title="No hay versiones presupuestales"
          detail="Cree una versión para habilitar el editor, la distribución, la aprobación y el control de ejecución."
          action={<Button variant="primary" onClick={() => setNewVersionOpen(true)}>Nueva versión</Button>}
        />
      )}

      {version && activeSlug === 'editor' && (
        <EditorView
          key={version.id}
          versions={state.budgets}
          version={version}
          update={update}
          showToast={showToast}
          onVersionChange={setVersionId}
        />
      )}

      {version && activeSlug === 'distribucion' && (
        <DistributionView
          key={version.id}
          state={state}
          versions={state.budgets}
          version={version}
          update={update}
          showToast={showToast}
          onVersionChange={setVersionId}
        />
      )}

      {version && activeSlug === 'aprobacion' && (
        <ApprovalView state={state} update={update} showToast={showToast} />
      )}

      {version && activeSlug === 'ejecucion' && (
        <ExecutionView
          key={version.id}
          versions={state.budgets}
          version={version}
          update={update}
          showToast={showToast}
          onVersionChange={setVersionId}
        />
      )}

      {version && activeSlug === 'comparativo' && (
        <ComparisonView
          state={state}
          version={version}
          showToast={showToast}
          onVersionChange={setVersionId}
        />
      )}

      {version && activeSlug === 'alertas' && (
        <AlertsView state={state} version={version} update={update} showToast={showToast} />
      )}

      {version && activeSlug === 'proyectos' && (
        <Proyectos version={version} showToast={showToast} />
      )}

      {newVersionOpen && (
        <VersionForm onClose={() => setNewVersionOpen(false)} onCreate={createVersion} />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-xl bg-[#001F4C] px-4 py-3 text-xs text-white shadow-2xl">
          <Icon name="check" className="h-4 w-4 text-emerald-300" />
          {toast}
        </div>
      )}
    </div>
  );
}
