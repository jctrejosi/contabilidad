import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
  Field,
  INPUT,
  Money,
  Modal,
  Progress,
  SectionTitle,
  Tabs,
  type Column,
} from '../../../components/finance/ui';
import {
  assetDepreciableBase,
  assetDepreciationPct,
  assetGross,
  assetNetBook,
  assetProjection,
  assetRemainingMonths,
  assetMonthlyDepreciation,
  fmtDate,
  money,
  periodLabel,
  statusTone,
} from '../../../finance/selectors';
import type {
  Asset,
  AssetCategory,
  AssetDisposal,
  AssetMovement,
  AssetStatus,
  DepreciationMethod,
  FinanceState,
} from '../../../finance/types';

export interface AssetDraft {
  code: string;
  name: string;
  description: string;
  categoryId: string;
  serial: string;
  plate: string;
  location: string;
  costCenter: string;
  responsible: string;
  supplier: string;
  invoiceRef: string;
  acquisitionDate: string;
  inServiceDate: string;
  acquisitionCost: number;
  residualValue: number;
  usefulLifeMonths: number;
  method: DepreciationMethod;
  estimatedUnits: number;
  status: AssetStatus;
  insurancePolicy: string;
  warrantyUntil: string;
  notes: string;
}

export interface RevaluationDraft {
  assetId: string;
  date: string;
  newValue: number;
  appraiser: string;
  report: string;
  note: string;
}

export interface DisposalDraft {
  assetId: string;
  date: string;
  type: AssetDisposal['type'];
  proceeds: number;
  invoiceRef: string;
  note: string;
}

export interface AssetActions {
  createAsset: (draft: AssetDraft) => void;
  updateAsset: (id: string, patch: Partial<Asset>, action: string) => void;
  putInService: (id: string, date: string) => void;
  registerImprovement: (id: string, amount: number, note: string, date: string) => void;
  registerImpairment: (id: string, amount: number, note: string, date: string) => void;
  runDepreciation: (period: string, units: Record<string, number>) => void;
  reverseDepreciation: (period: string) => void;
  createRevaluation: (draft: RevaluationDraft) => void;
  approveRevaluation: (id: string) => void;
  applyRevaluation: (id: string) => void;
  rejectRevaluation: (id: string, note: string) => void;
  createDisposal: (draft: DisposalDraft) => void;
  approveDisposal: (id: string) => void;
  applyDisposal: (id: string) => void;
  rejectDisposal: (id: string, note: string) => void;
  reconcile: (id: string, note: string) => void;
  adjustReconciliation: (id: string, note: string) => void;
  createCategory: (draft: Omit<AssetCategory, 'id'>) => void;
  updateCategory: (id: string, patch: Partial<AssetCategory>) => void;
  showToast: (text: string) => void;
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function assetStatusTone(status: string) {
  if (status === 'Vendido' || status === 'Dado de baja') return 'gray' as const;
  if (status === 'En montaje') return 'amber' as const;
  if (status === 'Totalmente depreciado') return 'violet' as const;
  return statusTone(status);
}

export function methodLabel(method: DepreciationMethod) {
  if (method === 'Unidades de producción') return 'Unidades';
  if (method === 'Saldos decrecientes') return 'Saldo decreciente';
  return 'Línea recta';
}

export function assetCategory(categories: AssetCategory[], id: string) {
  return categories.find(category => category.id === id);
}

export function blankAssetDraft(categories: AssetCategory[], nextCode: string): AssetDraft {
  const category = categories.find(item => item.active) ?? categories[0];
  return {
    code: nextCode,
    name: '',
    description: '',
    categoryId: category?.id ?? '',
    serial: '',
    plate: '',
    location: '',
    costCenter: 'ADM',
    responsible: '',
    supplier: '',
    invoiceRef: '',
    acquisitionDate: '2026-02-28',
    inServiceDate: '2026-02-28',
    acquisitionCost: 0,
    residualValue: 0,
    usefulLifeMonths: category?.usefulLifeMonths ?? 60,
    method: category?.method ?? 'Línea recta',
    estimatedUnits: 0,
    status: 'En operación',
    insurancePolicy: '',
    warrantyUntil: '',
    notes: '',
  };
}

export function draftFromAsset(asset: Asset): AssetDraft {
  return {
    code: asset.code,
    name: asset.name,
    description: asset.description,
    categoryId: asset.categoryId,
    serial: asset.serial,
    plate: asset.plate,
    location: asset.location,
    costCenter: asset.costCenter,
    responsible: asset.responsible,
    supplier: asset.supplier,
    invoiceRef: asset.invoiceRef,
    acquisitionDate: asset.acquisitionDate,
    inServiceDate: asset.inServiceDate,
    acquisitionCost: asset.acquisitionCost,
    residualValue: asset.residualValue,
    usefulLifeMonths: asset.usefulLifeMonths,
    method: asset.method,
    estimatedUnits: asset.estimatedUnits,
    status: asset.status,
    insurancePolicy: asset.insurancePolicy,
    warrantyUntil: asset.warrantyUntil,
    notes: asset.notes,
  };
}

export function AssetEditor({
  state,
  nextCode,
  asset,
  onClose,
  onSave,
}: {
  state: FinanceState;
  nextCode: string;
  asset?: Asset;
  onClose: () => void;
  onSave: (draft: AssetDraft) => void;
}) {
  const [draft, setDraft] = useState<AssetDraft>(() => asset ? draftFromAsset(asset) : blankAssetDraft(state.assetCategories, nextCode));
  const [autoResidual, setAutoResidual] = useState(!asset);
  const categories = state.assetCategories.filter(category => category.active || category.id === draft.categoryId);
  const category = assetCategory(state.assetCategories, draft.categoryId);
  const patch = (values: Partial<AssetDraft>) => setDraft(current => ({ ...current, ...values }));
  const valid = draft.code.trim() !== ''
    && draft.name.trim() !== ''
    && draft.categoryId !== ''
    && draft.acquisitionCost > 0
    && draft.usefulLifeMonths >= 0
    && draft.residualValue >= 0
    && draft.residualValue < draft.acquisitionCost;

  function changeCategory(categoryId: string) {
    const next = assetCategory(state.assetCategories, categoryId);
    patch({
      categoryId,
      usefulLifeMonths: next?.usefulLifeMonths ?? draft.usefulLifeMonths,
      method: next?.method ?? draft.method,
    });
    if (autoResidual && next) {
      patch({ residualValue: Math.round(draft.acquisitionCost * next.residualPct / 100) });
    }
  }

  function changeCost(value: number) {
    patch({
      acquisitionCost: value,
      ...(autoResidual && category ? { residualValue: Math.round(value * category.residualPct / 100) } : {}),
    });
  }

  return (
    <Modal
      title={asset ? `Editar ${asset.code}` : 'Nuevo activo fijo'}
      subtitle="La capitalización genera el asiento de adquisición contra proveedores o bancos."
      onClose={onClose}
      wide
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Código"><input className={INPUT} value={draft.code} onChange={event => patch({ code: event.target.value.toUpperCase() })} /></Field>
            <Field label="Nombre del activo"><input className={INPUT} value={draft.name} onChange={event => patch({ name: event.target.value })} /></Field>
            <Field label="Categoría">
              <select className={INPUT} value={draft.categoryId} onChange={event => changeCategory(event.target.value)}>
                {categories.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
              </select>
            </Field>
            <Field label="Estado">
              {asset ? (
                <input className={INPUT} value={draft.status} disabled />
              ) : (
                <select className={INPUT} value={draft.status} onChange={event => patch({ status: event.target.value as AssetStatus })}>
                  <option value="En operación">En operación</option>
                  <option value="En montaje">En montaje</option>
                </select>
              )}
            </Field>
            <Field label="Serial / identificación"><input className={INPUT} value={draft.serial} onChange={event => patch({ serial: event.target.value })} /></Field>
            <Field label="Placa (vehículos)"><input className={INPUT} value={draft.plate} onChange={event => patch({ plate: event.target.value.toUpperCase() })} /></Field>
            <Field label="Ubicación"><input className={INPUT} value={draft.location} onChange={event => patch({ location: event.target.value })} /></Field>
            <Field label="Centro de costo">
              <select className={INPUT} value={draft.costCenter} onChange={event => patch({ costCenter: event.target.value })}>
                {['ADM', 'OPE', 'VEN', 'TI'].map(value => <option key={value}>{value}</option>)}
              </select>
            </Field>
            <Field label="Responsable"><input className={INPUT} value={draft.responsible} onChange={event => patch({ responsible: event.target.value })} /></Field>
            <Field label="Proveedor"><input className={INPUT} value={draft.supplier} onChange={event => patch({ supplier: event.target.value })} /></Field>
            <Field label="Documento de compra"><input className={INPUT} value={draft.invoiceRef} onChange={event => patch({ invoiceRef: event.target.value })} /></Field>
            <Field label="Fecha de adquisición"><input type="date" className={INPUT} value={draft.acquisitionDate} onChange={event => patch({ acquisitionDate: event.target.value })} /></Field>
            <Field label="Fecha de puesta en servicio"><input type="date" className={INPUT} value={draft.inServiceDate} disabled={draft.status === 'En montaje'} onChange={event => patch({ inServiceDate: event.target.value })} /></Field>
            <Field label="Costo de adquisición" hint={asset ? 'use Registrar mejora' : undefined}>
              <input type="number" min={0} className={INPUT} value={draft.acquisitionCost} disabled={Boolean(asset)} onChange={event => changeCost(Number(event.target.value))} />
            </Field>
            <Field label="Valor residual" hint="editable">
              <input type="number" min={0} className={INPUT} value={draft.residualValue} onChange={event => { setAutoResidual(false); patch({ residualValue: Number(event.target.value) }); }} />
            </Field>
            <Field label="Vida útil (meses)"><input type="number" min={0} className={INPUT} value={draft.usefulLifeMonths} onChange={event => patch({ usefulLifeMonths: Number(event.target.value) })} /></Field>
            <Field label="Método de depreciación">
              <select className={INPUT} value={draft.method} onChange={event => patch({ method: event.target.value as DepreciationMethod })}>
                <option>Línea recta</option>
                <option>Saldos decrecientes</option>
                <option>Unidades de producción</option>
              </select>
            </Field>
            {draft.method === 'Unidades de producción' && (
              <Field label="Unidades estimadas"><input type="number" min={0} className={INPUT} value={draft.estimatedUnits} onChange={event => patch({ estimatedUnits: Number(event.target.value) })} /></Field>
            )}
            <Field label="Póliza de seguro"><input className={INPUT} value={draft.insurancePolicy} onChange={event => patch({ insurancePolicy: event.target.value })} /></Field>
            <Field label="Garantía hasta"><input type="date" className={INPUT} value={draft.warrantyUntil} onChange={event => patch({ warrantyUntil: event.target.value })} /></Field>
          </div>
          <Field label="Descripción"><textarea className={`${INPUT} min-h-16`} value={draft.description} onChange={event => patch({ description: event.target.value })} /></Field>
          <Field label="Notas"><textarea className={`${INPUT} min-h-16`} value={draft.notes} onChange={event => patch({ notes: event.target.value })} /></Field>
        </div>

        <aside className="h-fit rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-xs font-semibold text-gray-700">Resumen del activo</h3>
          <dl className="mt-3 space-y-2 text-[11px]">
            <div className="flex justify-between"><dt className="text-gray-500">Cuenta del activo</dt><dd className="font-mono">{category?.assetAccount ?? '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Vida fiscal</dt><dd>{category ? `${Math.round(category.taxUsefulLifeMonths / 12)} años` : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Valor a depreciar</dt><dd><Money value={Math.max(0, draft.acquisitionCost - draft.residualValue)} /></dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Cuota lineal estimada</dt><dd><Money value={draft.usefulLifeMonths > 0 ? (draft.acquisitionCost - draft.residualValue) / draft.usefulLifeMonths : 0} /></dd></div>
          </dl>
          <div className="mt-3 rounded-lg bg-white p-2.5 text-[10px] leading-4 text-gray-500">
            {draft.status === 'En montaje'
              ? 'El activo queda en montaje y no deprecia hasta la puesta en servicio.'
              : 'La depreciación inicia el mes siguiente a la puesta en servicio.'}
          </div>
          <div className="mt-4 space-y-2">
            <Button variant="primary" className="w-full" disabled={!valid} onClick={() => onSave(draft)}>{asset ? 'Guardar cambios' : 'Registrar y capitalizar'}</Button>
            <Button variant="secondary" className="w-full" onClick={onClose}>Cancelar</Button>
          </div>
        </aside>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-50 py-1.5 last:border-0">
      <span className="text-[11px] text-gray-500">{label}</span>
      <span className="text-right text-[11px] font-medium text-gray-800">{value}</span>
    </div>
  );
}

export function AssetDrawer({
  state,
  asset,
  actions,
  onClose,
  onEdit,
  onImprove,
  onRevalue,
  onImpair,
  onDispose,
}: {
  state: FinanceState;
  asset: Asset;
  actions: AssetActions;
  onClose: () => void;
  onEdit: (asset: Asset) => void;
  onImprove: (asset: Asset) => void;
  onRevalue: (asset: Asset) => void;
  onImpair: (asset: Asset) => void;
  onDispose: (asset: Asset) => void;
}) {
  const [tab, setTab] = useState('ficha');
  const [serviceDate, setServiceDate] = useState('2026-02-28');
  const category = assetCategory(state.assetCategories, asset.categoryId);
  const entries = state.depreciationEntries.filter(entry => entry.assetId === asset.id);
  const movements = state.assetMovements.filter(movement => movement.assetId === asset.id);
  const revaluations = state.revaluations.filter(item => item.assetId === asset.id);
  const disposals = state.disposals.filter(item => item.assetId === asset.id);
  const projection = useMemo(() => assetProjection(asset, 12), [asset]);

  const movementColumns: Column<AssetMovement>[] = [
    { header: 'Fecha', cell: row => fmtDate(row.date) },
    { header: 'Tipo', cell: row => <Badge tone={row.type === 'Depreciación' ? 'blue' : row.type === 'Revalorización' ? 'violet' : 'gray'}>{row.type}</Badge> },
    { header: 'Detalle', cell: row => <span className="block max-w-64 truncate text-gray-600">{row.description}</span> },
    { header: 'Débito', cell: row => <span className="font-mono">{row.debitAccount}</span> },
    { header: 'Crédito', cell: row => <span className="font-mono">{row.creditAccount}</span> },
    { header: 'Valor', align: 'right', cell: row => <Money value={row.amount} /> },
  ];

  return (
    <Drawer title={`${asset.code} · ${asset.name}`} subtitle={`${category?.name ?? 'Sin categoría'} · ${asset.location || 'Sin ubicación'}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={assetStatusTone(asset.status)}>{asset.status}</Badge>
          <Badge tone="blue">{methodLabel(asset.method)}</Badge>
          {asset.plate && <Badge tone="gray">{asset.plate}</Badge>}
          <span className="ml-auto text-[11px] text-gray-400">CC {asset.costCenter}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-400">Valor bruto</div>
            <div className="text-sm font-semibold text-gray-800"><Money value={assetGross(asset)} /></div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-400">Valor neto</div>
            <div className="text-sm font-semibold text-gray-800"><Money value={assetNetBook(asset)} /></div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-400">Depreciación acumulada</div>
            <div className="text-sm font-semibold text-gray-800"><Money value={asset.accumulatedDepreciation} /></div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-[10px] uppercase tracking-wide text-gray-400">Meses restantes</div>
            <div className="text-sm font-semibold text-gray-800">{assetRemainingMonths(asset)} de {asset.usefulLifeMonths}</div>
          </div>
        </div>

        <Progress value={assetDepreciationPct(asset)} label="Depreciación acumulada" tone={assetDepreciationPct(asset) >= 100 ? 'violet' : 'blue'} />

        <Tabs
          items={[
            { id: 'ficha', label: 'Ficha' },
            { id: 'depreciacion', label: 'Depreciación', badge: entries.length },
            { id: 'movimientos', label: 'Movimientos', badge: movements.length },
            { id: 'eventos', label: 'Eventos', badge: revaluations.length + disposals.length },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'ficha' && (
          <div className="space-y-3">
            <Card className="p-4">
              <SectionTitle title="Datos del activo" detail={`${asset.serial || 'Sin serial'} · ${asset.supplier || 'Sin proveedor'}`} />
              <div className="mt-2">
                <Row label="Descripción" value={asset.description || '—'} />
                <Row label="Adquisición" value={fmtDate(asset.acquisitionDate)} />
                <Row label="Puesta en servicio" value={asset.inServiceDate ? fmtDate(asset.inServiceDate) : 'Pendiente'} />
                <Row label="Documento de compra" value={asset.invoiceRef || '—'} />
                <Row label="Responsable" value={asset.responsible || '—'} />
                <Row label="Proveedor" value={asset.supplier || '—'} />
                <Row label="Costo de adquisición" value={<Money value={asset.acquisitionCost} />} />
                <Row label="Mejoras capitalizadas" value={<Money value={asset.improvements} />} />
                <Row label="Revalorización" value={<Money value={asset.revaluation} />} />
                <Row label="Deterioro" value={<Money value={asset.impairment} />} />
                <Row label="Valor residual" value={<Money value={asset.residualValue} />} />
                <Row label="Última depreciación" value={asset.lastDepreciation ? periodLabel(asset.lastDepreciation) : 'Sin depreciar'} />
                <Row label="Póliza" value={asset.insurancePolicy || '—'} />
                <Row label="Garantía" value={asset.warrantyUntil ? fmtDate(asset.warrantyUntil) : '—'} />
                {asset.disposedAt && <Row label="Fecha de retiro" value={fmtDate(asset.disposedAt)} />}
                {asset.disposedAt && <Row label="Valor de venta" value={<Money value={asset.disposalValue} />} />}
              </div>
            </Card>

            {asset.status === 'En montaje' && (
              <Card className="p-4">
                <SectionTitle title="Puesta en servicio" detail="Al poner en servicio inicia la depreciación el mes siguiente." />
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <Field label="Fecha de puesta en servicio"><input type="date" className={INPUT} value={serviceDate} onChange={event => setServiceDate(event.target.value)} /></Field>
                  <Button variant="primary" disabled={!serviceDate} onClick={() => actions.putInService(asset.id, serviceDate)}>Poner en servicio</Button>
                </div>
              </Card>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => onEdit(asset)}>Editar ficha</Button>
              {asset.status !== 'Vendido' && asset.status !== 'Dado de baja' && <Button onClick={() => onImprove(asset)}>Registrar mejora</Button>}
              {asset.status !== 'Vendido' && asset.status !== 'Dado de baja' && <Button onClick={() => onRevalue(asset)}>Revalorizar</Button>}
              {asset.status !== 'Vendido' && asset.status !== 'Dado de baja' && <Button onClick={() => onImpair(asset)}>Registrar deterioro</Button>}
              {asset.status !== 'Vendido' && asset.status !== 'Dado de baja' && <Button variant="danger" onClick={() => onDispose(asset)}>Dar de baja</Button>}
            </div>
            {asset.notes && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">{asset.notes}</p>}
          </div>
        )}

        {tab === 'depreciacion' && (
          <div className="space-y-3">
            <Card>
              <SectionTitle title="Asientos de depreciación" detail={`${entries.length} periodos registrados`} />
              <DataTable
                columns={[
                  { header: 'Periodo', cell: row => periodLabel(row.period) },
                  { header: 'Valor', align: 'right', cell: row => <Money value={row.amount} /> },
                  { header: 'Acumulado', align: 'right', cell: row => <Money value={row.accumulatedAfter} /> },
                  { header: 'Estado', cell: row => <Badge tone={row.status === 'Contabilizada' ? 'green' : row.status === 'Reversada' ? 'red' : 'amber'}>{row.status}</Badge> },
                  { header: 'Contabilizado', cell: row => fmtDate(row.postedAt) },
                ]}
                rows={[...entries].sort((a, b) => b.period.localeCompare(a.period))}
                rowKey={row => row.id}
                empty="Sin depreciación registrada para este activo."
                dense
              />
            </Card>
            <Card>
              <SectionTitle title="Proyección próximos 12 meses" detail={`Cuota actual ${money(assetMonthlyDepreciation(asset))}`} />
              <DataTable
                columns={[
                  { header: 'Periodo', cell: (row: { period: string; amount: number; accumulated: number }) => periodLabel(row.period) },
                  { header: 'Depreciación', align: 'right', cell: (row: { period: string; amount: number; accumulated: number }) => <Money value={row.amount} /> },
                  { header: 'Acumulado', align: 'right', cell: (row: { period: string; amount: number; accumulated: number }) => <Money value={row.accumulated} /> },
                ]}
                rows={projection}
                rowKey={row => row.period}
                dense
              />
            </Card>
          </div>
        )}

        {tab === 'movimientos' && (
          <Card>
            <SectionTitle title="Registro contable del activo" detail="Cada hecho económico deja débito, crédito y documento soporte." />
            <DataTable columns={movementColumns} rows={[...movements].sort((a, b) => b.date.localeCompare(a.date))} rowKey={row => row.id} empty="Sin movimientos contables." dense />
          </Card>
        )}

        {tab === 'eventos' && (
          <div className="space-y-3">
            <Card>
              <SectionTitle title="Revalorizaciones" detail="El superávit se abona a la cuenta 3805." />
              <DataTable
                columns={[
                  { header: 'Fecha', cell: row => fmtDate(row.date) },
                  { header: 'Valor nuevo', align: 'right', cell: row => <Money value={row.newValue} /> },
                  { header: 'Superávit', align: 'right', cell: row => <Money value={row.surplus} /> },
                  { header: 'Estado', cell: row => <Badge tone={row.status === 'Aplicada' ? 'green' : row.status === 'Rechazada' ? 'red' : 'amber'}>{row.status}</Badge> },
                ]}
                rows={revaluations}
                rowKey={row => row.id}
                empty="Sin revalorizaciones."
                dense
              />
            </Card>
            <Card>
              <SectionTitle title="Bajas y retiros" detail="El histórico se conserva aunque el activo salga de los totales." />
              <DataTable
                columns={[
                  { header: 'Fecha', cell: row => fmtDate(row.date) },
                  { header: 'Tipo', cell: row => row.type },
                  { header: 'Valor en libros', align: 'right', cell: row => <Money value={row.netBookValue} /> },
                  { header: 'Resultado', align: 'right', cell: row => <Money value={row.gainLoss} className={row.gainLoss < 0 ? 'text-red-600' : 'text-emerald-700'} /> },
                  { header: 'Estado', cell: row => <Badge tone={row.status === 'Aplicada' ? 'green' : row.status === 'Rechazada' ? 'red' : 'amber'}>{row.status}</Badge> },
                ]}
                rows={disposals}
                rowKey={row => row.id}
                empty="Sin bajas registradas."
                dense
              />
            </Card>
          </div>
        )}
      </div>
    </Drawer>
  );
}

export function ImprovementEditor({
  state,
  assetId,
  onClose,
  onSave,
}: {
  state: FinanceState;
  assetId?: string;
  onClose: () => void;
  onSave: (assetId: string, amount: number, note: string, date: string) => void;
}) {
  const candidates = state.assets.filter(asset => asset.status !== 'Vendido' && asset.status !== 'Dado de baja');
  const [selected, setSelected] = useState(assetId ?? candidates[0]?.id ?? '');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState('2026-02-28');
  const [note, setNote] = useState('');
  const asset = candidates.find(item => item.id === selected);
  const valid = selected !== '' && amount > 0 && note.trim().length >= 4;
  return (
    <Modal title="Registrar mejora" subtitle="La mejora aumenta el valor del activo y su base depreciable futura." onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Activo" className="sm:col-span-2">
          <select className={INPUT} value={selected} onChange={event => setSelected(event.target.value)}>
            {candidates.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
          </select>
        </Field>
        <Field label="Fecha"><input type="date" className={INPUT} value={date} onChange={event => setDate(event.target.value)} /></Field>
        <Field label="Valor de la mejora"><input type="number" min={0} className={INPUT} value={amount} onChange={event => setAmount(Number(event.target.value))} /></Field>
        <Field label="Descripción" className="sm:col-span-2">
          <textarea className={`${INPUT} min-h-20`} value={note} onChange={event => setNote(event.target.value)} placeholder="Capacidad ampliada, vida útil extendida o componente reemplazado." />
        </Field>
      </div>
      {asset && (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
          Valor neto actual <strong><Money value={assetNetBook(asset)} /></strong> · base depreciable <strong><Money value={assetDepreciableBase(asset)} /></strong>. La nueva cuota se recalcula sobre los meses restantes.
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave(selected, amount, note, date)}>Registrar mejora</Button>
      </div>
    </Modal>
  );
}

export function RevaluationEditor({
  state,
  assetId,
  onClose,
  onSave,
}: {
  state: FinanceState;
  assetId?: string;
  onClose: () => void;
  onSave: (draft: RevaluationDraft) => void;
}) {
  const candidates = state.assets.filter(asset => asset.status !== 'Vendido' && asset.status !== 'Dado de baja');
  const [selected, setSelected] = useState(assetId ?? candidates[0]?.id ?? '');
  const [date, setDate] = useState('2026-02-28');
  const [newValue, setNewValue] = useState(0);
  const [appraiser, setAppraiser] = useState('');
  const [report, setReport] = useState('');
  const [note, setNote] = useState('');
  const asset = candidates.find(item => item.id === selected);
  const current = asset ? assetNetBook(asset) : 0;
  const surplus = newValue - current;
  const valid = selected !== '' && newValue > 0 && newValue !== current && appraiser.trim().length >= 3 && report.trim().length >= 3;
  return (
    <Modal title="Nueva revalorización" subtitle="Modelo de revaluación NIC 16: el superávit va a otro resultado integral." onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Activo" className="sm:col-span-2">
          <select className={INPUT} value={selected} onChange={event => setSelected(event.target.value)}>
            {candidates.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
          </select>
        </Field>
        <Field label="Fecha del avalúo"><input type="date" className={INPUT} value={date} onChange={event => setDate(event.target.value)} /></Field>
        <Field label="Valor nuevo del activo"><input type="number" min={0} className={INPUT} value={newValue} onChange={event => setNewValue(Number(event.target.value))} /></Field>
        <Field label="Perito evaluador"><input className={INPUT} value={appraiser} onChange={event => setAppraiser(event.target.value)} /></Field>
        <Field label="Informe de avalúo"><input className={INPUT} value={report} onChange={event => setReport(event.target.value)} /></Field>
        <Field label="Nota" className="sm:col-span-2"><textarea className={`${INPUT} min-h-16`} value={note} onChange={event => setNote(event.target.value)} /></Field>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><div className="text-gray-500">Valor en libros</div><div className="mt-1 font-semibold"><Money value={current} /></div></div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><div className="text-gray-500">Valor nuevo</div><div className="mt-1 font-semibold"><Money value={newValue} /></div></div>
        <div className={`rounded-lg border p-3 ${surplus >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}><div className="text-gray-500">Superávit / (déficit)</div><div className="mt-1 font-semibold"><Money value={surplus} /></div></div>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-gray-500">
        Si el activo tenía deterioro previo, primero se revierte la pérdida y el exceso se registra en patrimonio (3805).
        La revalorización queda en borrador hasta la aprobación del comité.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave({ assetId: selected, date, newValue, appraiser, report, note })}>Crear revalorización</Button>
      </div>
    </Modal>
  );
}

export function DisposalEditor({
  state,
  assetId,
  onClose,
  onSave,
}: {
  state: FinanceState;
  assetId?: string;
  onClose: () => void;
  onSave: (draft: DisposalDraft) => void;
}) {
  const candidates = state.assets.filter(asset => asset.status !== 'Vendido' && asset.status !== 'Dado de baja');
  const [selected, setSelected] = useState(assetId ?? candidates[0]?.id ?? '');
  const [date, setDate] = useState('2026-02-28');
  const [type, setType] = useState<AssetDisposal['type']>('Venta');
  const [proceeds, setProceeds] = useState(0);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [note, setNote] = useState('');
  const asset = candidates.find(item => item.id === selected);
  const netBook = asset ? assetNetBook(asset) : 0;
  const result = proceeds - netBook;
  const valid = selected !== '' && note.trim().length >= 4 && (type !== 'Venta' || invoiceRef.trim().length >= 3);
  return (
    <Modal title="Solicitud de baja" subtitle="La baja requiere aprobación antes de afectar el libro mayor." onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Activo" className="sm:col-span-2">
          <select className={INPUT} value={selected} onChange={event => setSelected(event.target.value)}>
            {candidates.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name} · neto {money(assetNetBook(item))}</option>)}
          </select>
        </Field>
        <Field label="Fecha de retiro"><input type="date" className={INPUT} value={date} onChange={event => setDate(event.target.value)} /></Field>
        <Field label="Tipo de baja">
          <select className={INPUT} value={type} onChange={event => setType(event.target.value as AssetDisposal['type'])}>
            {['Venta', 'Obsolescencia', 'Donación', 'Pérdida', 'Chatarra'].map(value => <option key={value}>{value}</option>)}
          </select>
        </Field>
        <Field label="Valor de venta / recuperación"><input type="number" min={0} className={INPUT} value={proceeds} onChange={event => setProceeds(Number(event.target.value))} /></Field>
        <Field label="Documento soporte" hint={type === 'Venta' ? 'obligatorio' : 'opcional'}>
          <input className={INPUT} value={invoiceRef} onChange={event => setInvoiceRef(event.target.value)} placeholder="FV, acta o comprobante" />
        </Field>
        <Field label="Justificación" className="sm:col-span-2">
          <textarea className={`${INPUT} min-h-20`} value={note} onChange={event => setNote(event.target.value)} placeholder="Motivo técnico, operativo o comercial de la baja." />
        </Field>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><div className="text-gray-500">Valor en libros</div><div className="mt-1 font-semibold"><Money value={netBook} /></div></div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><div className="text-gray-500">Valor de venta</div><div className="mt-1 font-semibold"><Money value={proceeds} /></div></div>
        <div className={`rounded-lg border p-3 ${result >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}><div className="text-gray-500">Utilidad / (pérdida)</div><div className="mt-1 font-semibold"><Money value={result} /></div></div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave({ assetId: selected, date, type, proceeds, invoiceRef, note })}>Enviar a aprobación</Button>
      </div>
    </Modal>
  );
}

export function RejectModal({
  title,
  onClose,
  onReject,
}: {
  title: string;
  onClose: () => void;
  onReject: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  return (
    <Modal title={title} subtitle="La nota de rechazo queda en la trazabilidad." onClose={onClose}>
      <Field label="Motivo del rechazo">
        <textarea className={`${INPUT} min-h-20`} value={note} onChange={event => setNote(event.target.value)} />
      </Field>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="danger" disabled={note.trim().length < 4} onClick={() => onReject(note)}>Rechazar</Button>
      </div>
    </Modal>
  );
}

export function ImpairmentEditor({
  state,
  assetId,
  onClose,
  onSave,
}: {
  state: FinanceState;
  assetId?: string;
  onClose: () => void;
  onSave: (assetId: string, amount: number, note: string, date: string) => void;
}) {
  const candidates = state.assets.filter(asset => asset.status !== 'Vendido' && asset.status !== 'Dado de baja');
  const [selected, setSelected] = useState(assetId ?? candidates[0]?.id ?? '');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState('2026-02-28');
  const [note, setNote] = useState('');
  const asset = candidates.find(item => item.id === selected);
  const netBook = asset ? assetNetBook(asset) : 0;
  const valid = selected !== '' && amount > 0 && amount <= netBook && note.trim().length >= 4;
  return (
    <Modal title="Registrar deterioro" subtitle="NIC 36: la pérdida reduce el valor en libros y la base depreciable futura." onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Activo" className="sm:col-span-2">
          <select className={INPUT} value={selected} onChange={event => setSelected(event.target.value)}>
            {candidates.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name} · neto {money(assetNetBook(item))}</option>)}
          </select>
        </Field>
        <Field label="Fecha"><input type="date" className={INPUT} value={date} onChange={event => setDate(event.target.value)} /></Field>
        <Field label="Pérdida por deterioro" hint={`máximo ${money(netBook)}`}>
          <input type="number" min={0} className={INPUT} value={amount} onChange={event => setAmount(Number(event.target.value))} />
        </Field>
        <Field label="Justificación" className="sm:col-span-2">
          <textarea className={`${INPUT} min-h-20`} value={note} onChange={event => setNote(event.target.value)} placeholder="Indique la evidencia del menor valor recuperable." />
        </Field>
      </div>
      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
        Débito al gasto 5199 y crédito al deterioro acumulado 1596. El valor neto después del deterioro será <strong>{money(Math.max(0, netBook - amount))}</strong>.
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave(selected, amount, note, date)}>Registrar deterioro</Button>
      </div>
    </Modal>
  );
}

export function CategoryEditor({
  category,
  onClose,
  onSave,
}: {
  category?: AssetCategory;
  onClose: () => void;
  onSave: (draft: Omit<AssetCategory, 'id'>) => void;
}) {
  const [draft, setDraft] = useState<Omit<AssetCategory, 'id'>>(() => category
    ? {
        code: category.code, name: category.name, assetAccount: category.assetAccount,
        depreciationAccount: category.depreciationAccount, accumulatedAccount: category.accumulatedAccount,
        impairmentAccount: category.impairmentAccount, revaluationAccount: category.revaluationAccount,
        usefulLifeMonths: category.usefulLifeMonths, taxUsefulLifeMonths: category.taxUsefulLifeMonths,
        residualPct: category.residualPct, method: category.method, depreciable: category.depreciable,
        active: category.active, note: category.note,
      }
    : {
        code: '', name: '', assetAccount: '1520', depreciationAccount: '5160',
        accumulatedAccount: '1592', impairmentAccount: '1596', revaluationAccount: '3805',
        usefulLifeMonths: 120, taxUsefulLifeMonths: 120, residualPct: 0,
        method: 'Línea recta', depreciable: true, active: true, note: '',
      });
  const patch = (values: Partial<Omit<AssetCategory, 'id'>>) => setDraft(current => ({ ...current, ...values }));
  const valid = draft.code.trim() !== '' && draft.name.trim() !== '' && draft.assetAccount.trim() !== '';
  return (
    <Modal title={category ? `Editar categoría ${category.code}` : 'Nueva categoría de activo'} subtitle="La política define cuentas, vida útil y método de depreciación." onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Código PUC"><input className={INPUT} value={draft.code} onChange={event => patch({ code: event.target.value })} /></Field>
        <Field label="Nombre"><input className={INPUT} value={draft.name} onChange={event => patch({ name: event.target.value })} /></Field>
        <Field label="Cuenta del activo"><input className={INPUT} value={draft.assetAccount} onChange={event => patch({ assetAccount: event.target.value })} /></Field>
        <Field label="Gasto por depreciación"><input className={INPUT} value={draft.depreciationAccount} onChange={event => patch({ depreciationAccount: event.target.value })} /></Field>
        <Field label="Depreciación acumulada"><input className={INPUT} value={draft.accumulatedAccount} onChange={event => patch({ accumulatedAccount: event.target.value })} /></Field>
        <Field label="Deterioro acumulado"><input className={INPUT} value={draft.impairmentAccount} onChange={event => patch({ impairmentAccount: event.target.value })} /></Field>
        <Field label="Superávit por revalorización"><input className={INPUT} value={draft.revaluationAccount} onChange={event => patch({ revaluationAccount: event.target.value })} /></Field>
        <Field label="Vida útil contable (meses)"><input type="number" min={0} className={INPUT} value={draft.usefulLifeMonths} onChange={event => patch({ usefulLifeMonths: Number(event.target.value) })} /></Field>
        <Field label="Vida útil fiscal (meses)"><input type="number" min={0} className={INPUT} value={draft.taxUsefulLifeMonths} onChange={event => patch({ taxUsefulLifeMonths: Number(event.target.value) })} /></Field>
        <Field label="Valor residual (%)"><input type="number" min={0} max={100} className={INPUT} value={draft.residualPct} onChange={event => patch({ residualPct: Number(event.target.value) })} /></Field>
        <Field label="Método">
          <select className={INPUT} value={draft.method} onChange={event => patch({ method: event.target.value as DepreciationMethod })}>
            <option>Línea recta</option>
            <option>Saldos decrecientes</option>
            <option>Unidades de producción</option>
          </select>
        </Field>
        <Field label="¿Es depreciable?">
          <select className={INPUT} value={draft.depreciable ? 'Sí' : 'No'} onChange={event => patch({ depreciable: event.target.value === 'Sí' })}>
            <option>Sí</option>
            <option>No</option>
          </select>
        </Field>
        <Field label="Referencia normativa" className="sm:col-span-2"><input className={INPUT} value={draft.note} onChange={event => patch({ note: event.target.value })} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave(draft)}>{category ? 'Guardar cambios' : 'Crear categoría'}</Button>
      </div>
    </Modal>
  );
}
