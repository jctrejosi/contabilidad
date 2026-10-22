import { useMemo, useState } from 'react';
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
  Money,
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import { USUARIO } from '../../../data/mock';
import { useFinance } from '../../../finance/store';
import { HOY, fmtDate, money } from '../../../finance/selectors';
import type { AssetTransfer, AssetTransferStatus } from '../../../finance/types';

const STATUS_TONE: Record<AssetTransferStatus, 'amber' | 'blue' | 'green' | 'red'> = {
  Solicitado: 'amber',
  Aprobado: 'blue',
  Aplicado: 'green',
  Rechazado: 'red',
};

const CENTERS = ['ADM', 'OPE', 'VEN', 'TI', 'PROD'];
const LOCATIONS = [
  'Sede principal · Bogotá',
  'Bodega norte · Bogotá',
  'Planta de producción · Bogotá',
  'Centro de distribución · Bogotá',
  'Data center · Bogotá',
  'Depósito TI · Bogotá',
];

export default function Traslados({ showToast }: { showToast: (text: string) => void }) {
  const { state, update } = useFinance();
  const [open, setOpen] = useState(false);

  const rows = useMemo(
    () => [...state.assetTransfers].sort((a, b) => b.date.localeCompare(a.date)),
    [state.assetTransfers],
  );

  const month = HOY.slice(0, 7);
  const thisMonth = rows.filter(row => row.date.startsWith(month));
  const pending = rows.filter(row => row.status === 'Solicitado' || row.status === 'Aprobado');
  const applied = rows.filter(row => row.status === 'Aplicado');
  const centers = new Set(rows.flatMap(row => [row.fromCenter, row.toCenter]));

  function approve(id: string) {
    update(draft => {
      const target = draft.assetTransfers.find(row => row.id === id);
      if (!target) return;
      target.status = 'Aprobado';
      target.approvedBy = USUARIO.nombre;
    }, 'Traslado de activo aprobado', 'activos-fijos');
    showToast('Traslado aprobado. Pendiente de aplicación.');
  }

  function reject(id: string) {
    update(draft => {
      const target = draft.assetTransfers.find(row => row.id === id);
      if (target) target.status = 'Rechazado';
    }, 'Traslado de activo rechazado', 'activos-fijos');
    showToast('Traslado rechazado.');
  }

  function apply(id: string) {
    const transfer = rows.find(row => row.id === id);
    if (!transfer) return;
    update(draft => {
      const target = draft.assetTransfers.find(row => row.id === id);
      const asset = draft.assets.find(item => item.id === transfer.assetId);
      if (!target || !asset) return;
      target.status = 'Aplicado';
      target.note = target.note || 'Traslado aplicado al activo.';
      asset.location = target.toLocation;
      asset.costCenter = target.toCenter;
      asset.responsible = target.toResponsible;
      const category = draft.assetCategories.find(item => item.id === asset.categoryId);
      draft.assetMovements.unshift({
        id: `mov-${Date.now()}`,
        assetId: asset.id,
        date: target.date,
        type: 'Traslado',
        description: `Traslado de ${target.fromLocation} a ${target.toLocation}; centro ${target.fromCenter} → ${target.toCenter}.`,
        debitAccount: category?.assetAccount ?? '1524',
        creditAccount: category?.assetAccount ?? '1524',
        amount: asset.acquisitionCost,
        reference: `TRASLADO-${asset.code}`,
        user: USUARIO.nombre,
      });
    }, `Traslado de activo ${transfer.assetId} aplicado`, 'activos-fijos');
    showToast('Traslado aplicado: ubicación, centro de costo y responsable actualizados.');
  }

  function create(payload: {
    assetId: string;
    date: string;
    toLocation: string;
    toCenter: string;
    toResponsible: string;
    reason: string;
  }) {
    const asset = state.assets.find(item => item.id === payload.assetId);
    if (!asset) return;
    const record: AssetTransfer = {
      id: `tr-${Date.now()}`,
      assetId: asset.id,
      date: payload.date,
      fromLocation: asset.location,
      toLocation: payload.toLocation,
      fromCenter: asset.costCenter,
      toCenter: payload.toCenter,
      fromResponsible: asset.responsible,
      toResponsible: payload.toResponsible,
      reason: payload.reason,
      status: 'Solicitado',
      requestedBy: USUARIO.nombre,
      approvedBy: '',
      note: '',
    };
    update(draft => {
      draft.assetTransfers.unshift(record);
    }, `Traslado solicitado para ${asset.code}`, 'activos-fijos');
    setOpen(false);
    showToast(`Traslado de ${asset.code} solicitado.`);
  }

  const columns: Column<AssetTransfer>[] = [
    {
      header: 'Activo',
      cell: row => {
        const asset = state.assets.find(item => item.id === row.assetId);
        return (
          <div>
            <div className="font-medium text-gray-800">{asset?.name ?? row.assetId}</div>
            <div className="text-[10px] text-gray-400">{asset?.code ?? row.assetId} · {fmtDate(row.date)}</div>
          </div>
        );
      },
    },
    {
      header: 'Origen',
      cell: row => (
        <div className="text-[11px]">
          <div className="text-gray-800">{row.fromLocation}</div>
          <div className="text-[10px] text-gray-400">{row.fromCenter} · {row.fromResponsible}</div>
        </div>
      ),
    },
    {
      header: 'Destino',
      cell: row => (
        <div className="text-[11px]">
          <div className="font-medium text-gray-800">{row.toLocation}</div>
          <div className="text-[10px] text-gray-400">{row.toCenter} · {row.toResponsible}</div>
        </div>
      ),
    },
    {
      header: 'Centro destino',
      cell: row => <Badge tone="cyan">{row.toCenter}</Badge>,
    },
    {
      header: 'Valor en libros',
      align: 'right',
      cell: row => {
        const asset = state.assets.find(item => item.id === row.assetId);
        return <Money value={asset ? asset.acquisitionCost : 0} />;
      },
    },
    { header: 'Estado', cell: row => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge> },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => (
        <div className="flex justify-end gap-1.5">
          {row.status === 'Solicitado' && (
            <>
              <Button size="sm" onClick={() => reject(row.id)}>Rechazar</Button>
              <Button size="sm" variant="primary" onClick={() => approve(row.id)}>Aprobar</Button>
            </>
          )}
          {row.status === 'Aprobado' && (
            <Button size="sm" variant="success" onClick={() => apply(row.id)}>Aplicar traslado</Button>
          )}
          {row.status === 'Aplicado' && <span className="text-[10px] text-gray-400">{row.approvedBy}</span>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Traslados del mes" value={String(thisMonth.length)} detail={month} tone="cyan" />
        <KpiCard label="Pendientes" value={String(pending.length)} detail="Solicitados y aprobados" tone={pending.length > 0 ? 'amber' : 'green'} />
        <KpiCard label="Aplicados" value={String(applied.length)} detail="Activos ya reubicados" tone="green" />
        <KpiCard label="Centros afectados" value={String(centers.size)} detail="Origen y destino" tone="violet" />
      </div>

      <Card>
        <SectionTitle
          title="Traslados de activos"
          detail="Cambio de ubicación, centro de costo y responsable con trazabilidad contable"
          action={
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Icon name="plus" className="h-3.5 w-3.5" /> Nuevo traslado
            </Button>
          }
        />
        <div className="p-4">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={row => row.id}
            empty="No hay traslados de activos registrados."
            footer={
              <span className="text-[11px] text-gray-500">
                Al aplicar, el activo actualiza su ubicación, centro de costo y responsable, y se crea un movimiento de traslado.
              </span>
            }
          />
        </div>
      </Card>

      {open && <TransferModal state={state} onClose={() => setOpen(false)} onSave={create} />}
    </div>
  );
}

function TransferModal({
  state,
  onClose,
  onSave,
}: {
  state: ReturnType<typeof useFinance>['state'];
  onClose: () => void;
  onSave: (payload: {
    assetId: string;
    date: string;
    toLocation: string;
    toCenter: string;
    toResponsible: string;
    reason: string;
  }) => void;
}) {
  const available = state.assets.filter(asset => asset.status === 'En operación' || asset.status === 'En montaje');
  const [assetId, setAssetId] = useState(available[0]?.id ?? '');
  const asset = state.assets.find(item => item.id === assetId);
  const [date, setDate] = useState(HOY);
  const [toLocation, setToLocation] = useState(asset?.location ?? LOCATIONS[0]);
  const [toCenter, setToCenter] = useState(asset?.costCenter ?? CENTERS[0]);
  const [toResponsible, setToResponsible] = useState(asset?.responsible ?? '');
  const [reason, setReason] = useState('');

  const valid = Boolean(asset) && reason.trim().length >= 8 && (toLocation !== asset!.location || toCenter !== asset!.costCenter || toResponsible !== asset!.responsible);

  function changeAsset(id: string) {
    setAssetId(id);
    const next = state.assets.find(item => item.id === id);
    setToLocation(next?.location ?? LOCATIONS[0]);
    setToCenter(next?.costCenter ?? CENTERS[0]);
    setToResponsible(next?.responsible ?? '');
  }

  return (
    <Modal
      title="Nuevo traslado de activo"
      subtitle="El activo conserva su valor; cambian ubicación, centro de costo y responsable."
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Activo">
            <FilterSelect value={assetId} onChange={event => changeAsset(event.target.value)}>
              {available.map(item => (
                <option key={item.id} value={item.id}>{item.code} · {item.name}</option>
              ))}
            </FilterSelect>
          </Field>
          <Field label="Fecha del traslado">
            <input type="date" className={INPUT} value={date} onChange={event => setDate(event.target.value)} />
          </Field>
          <Field label="Ubicación destino">
            <FilterSelect value={toLocation} onChange={event => setToLocation(event.target.value)}>
              {LOCATIONS.map(item => <option key={item} value={item}>{item}</option>)}
            </FilterSelect>
          </Field>
          <Field label="Centro de costo destino">
            <FilterSelect value={toCenter} onChange={event => setToCenter(event.target.value)}>
              {CENTERS.map(item => <option key={item} value={item}>{item}</option>)}
            </FilterSelect>
          </Field>
          <Field label="Responsable destino">
            <input className={INPUT} value={toResponsible} onChange={event => setToResponsible(event.target.value)} />
          </Field>
          <Field label="Valor en libros">
            <input className={INPUT} value={money(asset?.acquisitionCost ?? 0)} disabled />
          </Field>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
          Origen: {asset?.location ?? '—'} · centro {asset?.costCenter ?? '—'} · responsable {asset?.responsible ?? '—'}
        </div>
        <Field label="Motivo del traslado" hint="Mínimo 8 caracteres; queda en la trazabilidad del activo.">
          <textarea
            className={`${INPUT} min-h-20`}
            value={reason}
            onChange={event => setReason(event.target.value)}
            placeholder="Reasignación operativa, cambio de sede, requerimiento del área."
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => onSave({ assetId, date, toLocation, toCenter, toResponsible, reason })}
          >
            Solicitar traslado
          </Button>
        </div>
      </div>
    </Modal>
  );
}
