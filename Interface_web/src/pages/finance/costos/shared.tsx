import { useState } from 'react';
import { Button, Field, INPUT, Modal } from '../../../components/finance/ui';
import type {
  CostCenter,
  CostCenterKind,
  CostObject,
  CostObjectKind,
  FinanceState,
} from '../../../finance/types';

export interface CostActions {
  createCenter: (draft: CostCenter) => void;
  updateCenter: (id: string, patch: Partial<CostCenter>) => void;
  createObject: (draft: CostObject) => void;
  updateObject: (id: string, patch: Partial<CostObject>) => void;
  distributePool: (poolId: string) => void;
  runAbc: () => void;
  closeRun: () => void;
  showToast: (message: string) => void;
}

export const CENTER_KINDS: CostCenterKind[] = ['Producción', 'Servicio', 'Administrativo', 'Comercial'];
export const OBJECT_KINDS: CostObjectKind[] = ['Producto', 'Servicio', 'Proyecto'];

export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
}

export function money(value: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

export function pct(value: number, digits = 1): string {
  return `${value.toFixed(digits)} %`;
}

/** Traduce el inductor del pool a la base almacenada en el centro. */
export function driverBasis(center: CostCenter, driver: string): number {
  const key = driver.toLowerCase();
  if (key.includes('área') || key.includes('area')) return center.areaM2;
  if (key.includes('eléctric') || key.includes('electric') || key.includes('kwh')) return center.energyKwh;
  if (key.includes('máquina') || key.includes('maquina')) return center.machineHours;
  if (key.includes('asegurado')) return center.insuredValue;
  return center.driverQty;
}

export function standardCost(object: CostObject): number {
  return object.standardQty * object.standardPrice * object.units;
}

export function actualCost(object: CostObject): number {
  return object.actualQty * object.actualPrice * object.units;
}

/** Positivo = sobrecosto (desfavorable). */
export function totalVariance(object: CostObject): number {
  return actualCost(object) - standardCost(object);
}

export function priceVariance(object: CostObject): number {
  return (object.actualPrice - object.standardPrice) * object.actualQty * object.units;
}

export function quantityVariance(object: CostObject): number {
  return (object.actualQty - object.standardQty) * object.standardPrice * object.units;
}

export function objectMargin(object: CostObject): number {
  return object.revenue > 0 ? ((object.revenue - actualCost(object)) / object.revenue) * 100 : 0;
}

export function centerById(state: FinanceState, id: string): CostCenter | undefined {
  return state.costCenters.find(center => center.id === id);
}

export function allocatedForPool(state: FinanceState, poolId: string): number {
  return state.costAllocations
    .filter(item => item.poolId === poolId)
    .reduce((total, item) => total + item.amount, 0);
}

export function allocatedForCenter(state: FinanceState, centerId: string): number {
  return state.costAllocations
    .filter(item => item.centerId === centerId)
    .reduce((total, item) => total + item.amount, 0);
}

function centerDraft(center?: CostCenter): CostCenter {
  return center
    ? { ...center }
    : {
        id: '',
        code: '',
        name: '',
        kind: 'Producción',
        manager: '',
        driver: 'Horas máquina',
        driverUnit: 'h',
        driverQty: 0,
        areaM2: 0,
        energyKwh: 0,
        machineHours: 0,
        insuredValue: 0,
        directCost: 0,
        status: 'Activo',
      };
}

export function CostCenterEditor({
  center,
  nextCode,
  onClose,
  onSave,
}: {
  center?: CostCenter;
  nextCode: string;
  onClose: () => void;
  onSave: (draft: CostCenter) => void;
}) {
  const [draft, setDraft] = useState<CostCenter>(() => ({
    ...centerDraft(center),
    code: center?.code ?? nextCode,
  }));

  function patch(changes: Partial<CostCenter>) {
    setDraft(previous => ({ ...previous, ...changes }));
  }

  const valid = draft.code.trim().length > 0 && draft.name.trim().length > 0 && draft.driverQty >= 0;

  return (
    <Modal
      title={center ? `Editar ${center.code}` : 'Nuevo centro de costo'}
      subtitle="El centro acumula costos directos y recibe CIF según su base de distribución."
      onClose={onClose}
      wide
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Código"><input className={INPUT} value={draft.code} onChange={event => patch({ code: event.target.value })} /></Field>
        <Field label="Nombre"><input className={INPUT} value={draft.name} onChange={event => patch({ name: event.target.value })} /></Field>
        <Field label="Tipo">
          <select className={INPUT} value={draft.kind} onChange={event => patch({ kind: event.target.value as CostCenterKind })}>
            {CENTER_KINDS.map(kind => <option key={kind}>{kind}</option>)}
          </select>
        </Field>
        <Field label="Responsable"><input className={INPUT} value={draft.manager} onChange={event => patch({ manager: event.target.value })} /></Field>
        <Field label="Inductor principal"><input className={INPUT} value={draft.driver} onChange={event => patch({ driver: event.target.value })} /></Field>
        <Field label="Unidad del inductor"><input className={INPUT} value={draft.driverUnit} onChange={event => patch({ driverUnit: event.target.value })} /></Field>
        <Field label="Consumo del inductor"><input type="number" min={0} className={INPUT} value={draft.driverQty} onChange={event => patch({ driverQty: Number(event.target.value) })} /></Field>
        <Field label="Costo directo del período"><input type="number" min={0} className={INPUT} value={draft.directCost} onChange={event => patch({ directCost: Number(event.target.value) })} /></Field>
        <Field label="Área ocupada (m²)"><input type="number" min={0} className={INPUT} value={draft.areaM2} onChange={event => patch({ areaM2: Number(event.target.value) })} /></Field>
        <Field label="Consumo eléctrico (kWh)"><input type="number" min={0} className={INPUT} value={draft.energyKwh} onChange={event => patch({ energyKwh: Number(event.target.value) })} /></Field>
        <Field label="Horas máquina"><input type="number" min={0} className={INPUT} value={draft.machineHours} onChange={event => patch({ machineHours: Number(event.target.value) })} /></Field>
        <Field label="Valor asegurado ($ M)"><input type="number" min={0} className={INPUT} value={draft.insuredValue} onChange={event => patch({ insuredValue: Number(event.target.value) })} /></Field>
        <Field label="Estado">
          <select className={INPUT} value={draft.status} onChange={event => patch({ status: event.target.value === 'Inactivo' ? 'Inactivo' : 'Activo' })}>
            <option>Activo</option>
            <option>Inactivo</option>
          </select>
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave({ ...draft, code: draft.code.trim(), name: draft.name.trim() })}>
          {center ? 'Guardar cambios' : 'Crear centro'}
        </Button>
      </div>
    </Modal>
  );
}

function objectDraft(centers: CostCenter[], object?: CostObject): CostObject {
  return object
    ? { ...object }
    : {
        id: '',
        code: '',
        name: '',
        kind: 'Producto',
        productCode: '',
        centerId: centers[0]?.id ?? '',
        units: 1,
        period: '2026-02',
        standardQty: 1,
        actualQty: 1,
        standardPrice: 0,
        actualPrice: 0,
        revenue: 0,
      };
}

export function CostObjectEditor({
  object,
  centers,
  nextCode,
  onClose,
  onSave,
}: {
  object?: CostObject;
  centers: CostCenter[];
  nextCode: string;
  onClose: () => void;
  onSave: (draft: CostObject) => void;
}) {
  const [draft, setDraft] = useState<CostObject>(() => ({
    ...objectDraft(centers, object),
    code: object?.code ?? nextCode,
  }));

  function patch(changes: Partial<CostObject>) {
    setDraft(previous => ({ ...previous, ...changes }));
  }

  const standard = draft.standardQty * draft.standardPrice * draft.units;
  const actual = draft.actualQty * draft.actualPrice * draft.units;
  const valid = draft.code.trim().length > 0 && draft.name.trim().length > 0 && draft.centerId.length > 0 && draft.units > 0;

  return (
    <Modal
      title={object ? `Editar ${object.code}` : 'Nuevo objeto de costo'}
      subtitle="El objeto concentra el costo estándar, el real y la variación del período."
      onClose={onClose}
      wide
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Código"><input className={INPUT} value={draft.code} onChange={event => patch({ code: event.target.value })} /></Field>
        <Field label="Nombre"><input className={INPUT} value={draft.name} onChange={event => patch({ name: event.target.value })} /></Field>
        <Field label="Tipo">
          <select className={INPUT} value={draft.kind} onChange={event => patch({ kind: event.target.value as CostObjectKind })}>
            {OBJECT_KINDS.map(kind => <option key={kind}>{kind}</option>)}
          </select>
        </Field>
        <Field label="Código de producto o proyecto"><input className={INPUT} value={draft.productCode} onChange={event => patch({ productCode: event.target.value })} /></Field>
        <Field label="Centro de costo">
          <select className={INPUT} value={draft.centerId} onChange={event => patch({ centerId: event.target.value })}>
            {centers.map(center => <option key={center.id} value={center.id}>{center.code} · {center.name}</option>)}
          </select>
        </Field>
        <Field label="Unidades del período"><input type="number" min={1} className={INPUT} value={draft.units} onChange={event => patch({ units: Number(event.target.value) })} /></Field>
        <Field label="Cantidad estándar por unidad"><input type="number" min={0} step="0.01" className={INPUT} value={draft.standardQty} onChange={event => patch({ standardQty: Number(event.target.value) })} /></Field>
        <Field label="Cantidad real por unidad"><input type="number" min={0} step="0.01" className={INPUT} value={draft.actualQty} onChange={event => patch({ actualQty: Number(event.target.value) })} /></Field>
        <Field label="Precio estándar unitario"><input type="number" min={0} className={INPUT} value={draft.standardPrice} onChange={event => patch({ standardPrice: Number(event.target.value) })} /></Field>
        <Field label="Precio real unitario"><input type="number" min={0} className={INPUT} value={draft.actualPrice} onChange={event => patch({ actualPrice: Number(event.target.value) })} /></Field>
        <Field label="Ingreso del período" className="sm:col-span-2"><input type="number" min={0} className={INPUT} value={draft.revenue} onChange={event => patch({ revenue: Number(event.target.value) })} /></Field>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
        <div><div className="text-gray-400">Costo estándar</div><div className="tabular font-semibold text-gray-800">{money(standard)}</div></div>
        <div><div className="text-gray-400">Costo real</div><div className="tabular font-semibold text-gray-800">{money(actual)}</div></div>
        <div><div className="text-gray-400">Variación</div><div className={`tabular font-semibold ${actual - standard > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{money(actual - standard)}</div></div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave({ ...draft, code: draft.code.trim(), name: draft.name.trim() })}>
          {object ? 'Guardar cambios' : 'Crear objeto'}
        </Button>
      </div>
    </Modal>
  );
}
