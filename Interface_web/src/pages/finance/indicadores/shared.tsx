import { useState } from 'react';
import { Button, Field, INPUT, Modal } from '../../../components/finance/ui';
import type {
  FinanceState,
  Indicator,
  IndicatorGroup,
  Projection,
  ProjectionLine,
  ProjectionScenario,
} from '../../../finance/types';

export interface IndicatorActions {
  createIndicator: (draft: Indicator) => void;
  updateIndicator: (id: string, patch: Partial<Indicator>) => void;
  createProjection: (draft: Projection) => void;
  setCurrentProjection: (id: string) => void;
  showToast: (message: string) => void;
}

export const INDICATOR_GROUPS: IndicatorGroup[] = ['Liquidez', 'Endeudamiento', 'Rentabilidad', 'Actividad', 'Presupuesto'];
export const SCENARIOS: ProjectionScenario[] = ['Base', 'Optimista', 'Conservador'];

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
}

export function money(value: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

export function formatIndicator(indicator: Indicator, value: number): string {
  if (indicator.unit === '%') return `${value.toFixed(1)} %`;
  if (indicator.unit === 'veces') return `${value.toFixed(2)}×`;
  if (indicator.unit === 'días') return `${value.toFixed(0)} días`;
  return money(value);
}

export function indicatorAchieved(indicator: Indicator): boolean {
  return indicator.direction === 'Mayor es mejor' ? indicator.actual >= indicator.target : indicator.actual <= indicator.target;
}

export function indicatorCompliance(indicator: Indicator): number {
  if (indicator.target === 0) return 0;
  const ratio = indicator.direction === 'Mayor es mejor' ? indicator.actual / indicator.target : indicator.target / indicator.actual;
  return Math.max(0, Math.min(150, ratio * 100));
}

export function lineTotal(line: ProjectionLine): number {
  return line.monthly.reduce((total, value) => total + value, 0);
}

export function projectionTotals(projection: Projection) {
  const byType = (type: ProjectionLine['type']) => projection.lines
    .filter(line => line.type === type)
    .reduce((total, line) => total + lineTotal(line), 0);
  const revenue = byType('Ingreso');
  const cost = byType('Costo');
  const expense = byType('Gasto');
  const capex = byType('Inversión');
  const ebitda = revenue - cost - expense;
  return {
    revenue,
    cost,
    expense,
    capex,
    ebitda,
    margin: revenue > 0 ? (ebitda / revenue) * 100 : 0,
    cash: ebitda - capex,
  };
}

export function monthlyProjection(projection: Projection) {
  return Array.from({ length: 12 }, (_, index) => {
    const byType = (type: ProjectionLine['type']) => projection.lines
      .filter(line => line.type === type)
      .reduce((total, line) => total + (line.monthly[index] ?? 0), 0);
    const revenue = byType('Ingreso');
    const cost = byType('Costo');
    const expense = byType('Gasto');
    const capex = byType('Inversión');
    const ebitda = revenue - cost - expense;
    return { index, revenue, cost, expense, capex, ebitda, cash: ebitda - capex };
  });
}

export function projectionFor(state: FinanceState, id: string): Projection | undefined {
  return state.projections.find(projection => projection.id === id);
}

export function currentProjection(state: FinanceState): Projection | undefined {
  return state.projections.find(projection => projection.current) ?? state.projections[0];
}

function indicatorDraft(nextCode: string, indicator?: Indicator): Indicator {
  return indicator
    ? { ...indicator }
    : {
        id: '',
        code: nextCode,
        name: '',
        group: 'Rentabilidad',
        formula: '',
        unit: '%',
        target: 0,
        actual: 0,
        previous: 0,
        direction: 'Mayor es mejor',
        note: '',
      };
}

export function IndicatorEditor({
  indicator,
  nextCode,
  onClose,
  onSave,
}: {
  indicator?: Indicator;
  nextCode: string;
  onClose: () => void;
  onSave: (draft: Indicator) => void;
}) {
  const [draft, setDraft] = useState<Indicator>(() => indicatorDraft(nextCode, indicator));

  function patch(changes: Partial<Indicator>) {
    setDraft(previous => ({ ...previous, ...changes }));
  }

  const valid = draft.code.trim().length > 0 && draft.name.trim().length > 0;

  return (
    <Modal title={indicator ? `Editar ${indicator.code}` : 'Nuevo indicador'} subtitle="Defina la meta, el valor actual y la dirección de mejora." onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Código"><input className={INPUT} value={draft.code} onChange={event => patch({ code: event.target.value })} /></Field>
        <Field label="Nombre"><input className={INPUT} value={draft.name} onChange={event => patch({ name: event.target.value })} /></Field>
        <Field label="Grupo">
          <select className={INPUT} value={draft.group} onChange={event => patch({ group: event.target.value as IndicatorGroup })}>
            {INDICATOR_GROUPS.map(group => <option key={group}>{group}</option>)}
          </select>
        </Field>
        <Field label="Unidad">
          <select className={INPUT} value={draft.unit} onChange={event => patch({ unit: event.target.value as Indicator['unit'] })}>
            {['%', 'veces', 'días', '$'].map(unit => <option key={unit}>{unit}</option>)}
          </select>
        </Field>
        <Field label="Fórmula" className="sm:col-span-2"><input className={INPUT} value={draft.formula} onChange={event => patch({ formula: event.target.value })} /></Field>
        <Field label="Meta"><input type="number" step="0.01" className={INPUT} value={draft.target} onChange={event => patch({ target: Number(event.target.value) })} /></Field>
        <Field label="Valor actual"><input type="number" step="0.01" className={INPUT} value={draft.actual} onChange={event => patch({ actual: Number(event.target.value) })} /></Field>
        <Field label="Valor anterior"><input type="number" step="0.01" className={INPUT} value={draft.previous} onChange={event => patch({ previous: Number(event.target.value) })} /></Field>
        <Field label="Dirección">
          <select className={INPUT} value={draft.direction} onChange={event => patch({ direction: event.target.value === 'Menor es mejor' ? 'Menor es mejor' : 'Mayor es mejor' })}>
            <option>Mayor es mejor</option>
            <option>Menor es mejor</option>
          </select>
        </Field>
        <Field label="Nota" className="sm:col-span-2"><input className={INPUT} value={draft.note} onChange={event => patch({ note: event.target.value })} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave({ ...draft, code: draft.code.trim(), name: draft.name.trim() })}>
          {indicator ? 'Guardar cambios' : 'Crear indicador'}
        </Button>
      </div>
    </Modal>
  );
}

function series(start: number, growth: number): number[] {
  const values: number[] = [];
  let value = start;
  for (let index = 0; index < 12; index += 1) {
    values.push(Math.round(value));
    value *= 1 + growth;
  }
  return values;
}

export function ProjectionEditor({
  base,
  nextName,
  onClose,
  onSave,
}: {
  base: Projection;
  nextName: string;
  onClose: () => void;
  onSave: (draft: Projection) => void;
}) {
  const [name, setName] = useState(nextName);
  const [scenario, setScenario] = useState<ProjectionScenario>('Base');
  const [growth, setGrowth] = useState(1.5);
  const [costRatio, setCostRatio] = useState(58);
  const [adminStart, setAdminStart] = useState(96_000_000);
  const [salesStart, setSalesStart] = useState(48_000_000);

  const revenueBase = base.lines.find(line => line.type === 'Ingreso')?.monthly[0] ?? 0;
  const revenue = series(revenueBase, growth / 100);
  const totalRevenue = revenue.reduce((total, value) => total + value, 0);
  const totalCost = Math.round(totalRevenue * (costRatio / 100));
  const valid = name.trim().length > 0 && revenueBase > 0 && costRatio > 0 && costRatio < 100;

  function build(): ProjectionLine[] {
    return [
      { id: 'ing', account: '4105', accountName: 'Ingresos operacionales', type: 'Ingreso', monthly: revenue },
      { id: 'cos', account: '6135', accountName: 'Costo de ventas', type: 'Costo', monthly: revenue.map(value => Math.round(value * (costRatio / 100))) },
      { id: 'adm', account: '5105', accountName: 'Gastos administrativos', type: 'Gasto', monthly: series(adminStart, 0.004) },
      { id: 'ven', account: '5205', accountName: 'Gastos de ventas', type: 'Gasto', monthly: series(salesStart, 0.005) },
      { id: 'dep', account: '5160', accountName: 'Depreciación', type: 'Gasto', monthly: Array.from({ length: 12 }, () => 62_000_000) },
      { id: 'cap', account: '1524', accountName: 'Inversión en activos', type: 'Inversión', monthly: Array.from({ length: 12 }, () => 25_000_000) },
    ];
  }

  return (
    <Modal title="Nueva proyección" subtitle="Se construye a partir de un escenario existente y supuestos de crecimiento." onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" className="sm:col-span-2"><input className={INPUT} value={name} onChange={event => setName(event.target.value)} /></Field>
        <Field label="Escenario">
          <select className={INPUT} value={scenario} onChange={event => setScenario(event.target.value as ProjectionScenario)}>
            {SCENARIOS.map(value => <option key={value}>{value}</option>)}
          </select>
        </Field>
        <Field label="Crecimiento mensual de ingresos (%)"><input type="number" step="0.1" className={INPUT} value={growth} onChange={event => setGrowth(Number(event.target.value))} /></Field>
        <Field label="Costo de ventas sobre ingresos (%)"><input type="number" step="0.1" className={INPUT} value={costRatio} onChange={event => setCostRatio(Number(event.target.value))} /></Field>
        <Field label="Gastos administrativos iniciales"><input type="number" className={INPUT} value={adminStart} onChange={event => setAdminStart(Number(event.target.value))} /></Field>
        <Field label="Gastos de ventas iniciales"><input type="number" className={INPUT} value={salesStart} onChange={event => setSalesStart(Number(event.target.value))} /></Field>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600 sm:grid-cols-4">
        <div><div className="text-gray-400">Ingresos año</div><div className="tabular font-semibold text-gray-800">{money(totalRevenue)}</div></div>
        <div><div className="text-gray-400">Costo de ventas</div><div className="tabular font-semibold text-gray-800">{money(totalCost)}</div></div>
        <div><div className="text-gray-400">Margen bruto</div><div className="tabular font-semibold text-gray-800">{(100 - costRatio).toFixed(1)} %</div></div>
        <div><div className="text-gray-400">Escenario base</div><div className="font-semibold text-gray-800">{base.name}</div></div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="primary"
          disabled={!valid}
          onClick={() => onSave({
            id: '',
            name: name.trim(),
            year: base.year,
            scenario,
            current: false,
            note: `Generada desde ${base.name} con crecimiento mensual de ${growth} % y costo de ventas de ${costRatio} %.`,
            lines: build(),
          })}
        >
          Crear proyección
        </Button>
      </div>
    </Modal>
  );
}
