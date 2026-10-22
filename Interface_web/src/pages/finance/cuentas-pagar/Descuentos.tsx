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
import { HOY, fmtDate, money, partyOf } from '../../../finance/selectors';
import type { SupplierAdjustment, SupplierAdjustmentKind, SupplierAdjustmentStatus } from '../../../finance/types';

const KINDS: SupplierAdjustmentKind[] = [
  'Descuento pronto pago',
  'Nota débito',
  'Nota crédito',
  'Devolución',
  'Ajuste de precio',
];

const STATUS_TONE: Record<SupplierAdjustmentStatus, 'gray' | 'blue' | 'green' | 'red'> = {
  Borrador: 'gray',
  Aprobado: 'blue',
  Aplicado: 'green',
  Rechazado: 'red',
};

function affectsBalance(kind: SupplierAdjustmentKind): 1 | -1 {
  return kind === 'Nota débito' ? 1 : -1;
}

function nextNumber(state: { supplierAdjustments: SupplierAdjustment[] }): string {
  const max = state.supplierAdjustments.reduce((value, row) => {
    const number = Number(row.number.match(/(\d+)$/)?.[1] ?? 0);
    return Math.max(value, number);
  }, 0);
  return `ADJ-${String(max + 1).padStart(4, '0')}`;
}

export default function Descuentos({ showToast }: { showToast: (text: string) => void }) {
  const { state, update } = useFinance();
  const [open, setOpen] = useState(false);

  const rows = useMemo(
    () => [...state.supplierAdjustments].sort((a, b) => b.date.localeCompare(a.date)),
    [state.supplierAdjustments],
  );

  const applied = rows.filter(row => row.status === 'Aplicado');
  const discounts = applied.filter(row => row.kind === 'Descuento pronto pago').reduce((total, row) => total + row.amount, 0);
  const debitNotes = applied.filter(row => row.kind === 'Nota débito').reduce((total, row) => total + row.amount, 0);
  const pending = rows.filter(row => row.status === 'Borrador' || row.status === 'Aprobado').length;

  function approve(id: string) {
    update(draft => {
      const target = draft.supplierAdjustments.find(row => row.id === id);
      if (!target) return;
      target.status = 'Aprobado';
      target.approvedBy = USUARIO.nombre;
    }, 'Ajuste de proveedor aprobado', 'cuentas-pagar');
    showToast('Ajuste aprobado. Puede aplicarse a la obligación.');
  }

  function reject(id: string) {
    update(draft => {
      const target = draft.supplierAdjustments.find(row => row.id === id);
      if (target) target.status = 'Rechazado';
    }, 'Ajuste de proveedor rechazado', 'cuentas-pagar');
    showToast('Ajuste rechazado.');
  }

  function apply(id: string) {
    const adjustment = rows.find(row => row.id === id);
    if (!adjustment) return;
    update(draft => {
      const target = draft.supplierAdjustments.find(row => row.id === id);
      const payable = draft.payables.find(item => item.id === adjustment.payableId);
      if (!target || !payable) return;
      target.status = 'Aplicado';
      target.approvedBy = target.approvedBy || USUARIO.nombre;
      payable.balance = Math.max(0, payable.balance + affectsBalance(target.kind) * target.amount);
      if (payable.balance === 0) payable.status = 'Pagada';
      else if (payable.dueDate < HOY) payable.status = 'Vencida';
      else payable.status = 'Abierta';
    }, `Ajuste ${adjustment.number} aplicado a obligación`, 'cuentas-pagar');
    showToast(`Ajuste ${adjustment.number} aplicado por ${money(adjustment.amount)}.`);
  }

  function create(payload: {
    payableId: string;
    kind: SupplierAdjustmentKind;
    base: number;
    rate: number;
    amount: number;
    note: string;
  }) {
    const payable = state.payables.find(item => item.id === payload.payableId);
    if (!payable) return;
    const record: SupplierAdjustment = {
      id: `adj-${Date.now()}`,
      number: nextNumber(state),
      payableId: payable.id,
      partyId: payable.partyId,
      date: HOY,
      kind: payload.kind,
      base: payload.base,
      rate: payload.rate,
      amount: payload.amount,
      status: 'Borrador',
      requestedBy: USUARIO.nombre,
      approvedBy: '',
      note: payload.note,
    };
    update(draft => {
      draft.supplierAdjustments.unshift(record);
    }, `Ajuste ${record.number} registrado`, 'cuentas-pagar');
    setOpen(false);
    showToast(`Ajuste ${record.number} registrado como borrador.`);
  }

  const columns: Column<SupplierAdjustment>[] = [
    {
      header: 'Ajuste',
      cell: row => (
        <div>
          <div className="font-medium text-gray-800">{row.number}</div>
          <div className="text-[10px] text-gray-400">{fmtDate(row.date)}</div>
        </div>
      ),
    },
    {
      header: 'Proveedor',
      cell: row => {
        const party = state.parties.find(item => item.id === row.partyId);
        return (
          <div>
            <div className="font-medium text-gray-800">{party?.name ?? row.partyId}</div>
            <div className="text-[10px] text-gray-400">
              {state.payables.find(payable => payable.id === row.payableId)?.invoiceNumber ?? row.payableId}
            </div>
          </div>
        );
      },
    },
    { header: 'Tipo', cell: row => <Badge tone={row.kind === 'Nota débito' ? 'amber' : 'cyan'}>{row.kind}</Badge> },
    { header: 'Base', align: 'right', cell: row => <Money value={row.base} /> },
    {
      header: 'Tasa',
      align: 'right',
      cell: row => <span className="text-gray-500">{row.rate > 0 ? `${row.rate.toFixed(2)} %` : '—'}</span>,
    },
    { header: 'Valor', align: 'right', cell: row => <Money value={row.amount} className="font-semibold" /> },
    { header: 'Estado', cell: row => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge> },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => (
        <div className="flex justify-end gap-1.5">
          {row.status === 'Borrador' && (
            <>
              <Button size="sm" onClick={() => reject(row.id)}>Rechazar</Button>
              <Button size="sm" variant="primary" onClick={() => approve(row.id)}>Aprobar</Button>
            </>
          )}
          {row.status === 'Aprobado' && (
            <Button size="sm" variant="success" onClick={() => apply(row.id)}>Aplicar</Button>
          )}
          {row.status === 'Aplicado' && <span className="text-[10px] text-gray-400">{row.approvedBy}</span>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Descuentos aplicados" value={<Money value={discounts} />} detail="Pronto pago y ajustes a favor" tone="green" />
        <KpiCard label="Notas débito" value={<Money value={debitNotes} />} detail="Cobros adicionales del proveedor" tone="amber" />
        <KpiCard label="Pendientes de aplicar" value={String(pending)} detail="Borradores y aprobados" tone={pending > 0 ? 'red' : 'gray'} />
        <KpiCard label="Ajustes del período" value={String(rows.length)} detail="Descuentos, notas y devoluciones" tone="cyan" />
      </div>

      <Card>
        <SectionTitle
          title="Descuentos y notas débito"
          detail="Ajustes sobre obligaciones con proveedores, con aprobación y aplicación al saldo"
          action={
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Icon name="plus" className="h-3.5 w-3.5" /> Nuevo ajuste
            </Button>
          }
        />
        <div className="p-4">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={row => row.id}
            empty="No hay descuentos ni notas de proveedor registradas."
            footer={
              <span className="text-[11px] text-gray-500">
                Los descuentos y notas crédito reducen la obligación; las notas débito la incrementan.
              </span>
            }
          />
        </div>
      </Card>

      {open && <AdjustmentModal state={state} onClose={() => setOpen(false)} onSave={create} />}
    </div>
  );
}

function AdjustmentModal({
  state,
  onClose,
  onSave,
}: {
  state: ReturnType<typeof useFinance>['state'];
  onClose: () => void;
  onSave: (payload: {
    payableId: string;
    kind: SupplierAdjustmentKind;
    base: number;
    rate: number;
    amount: number;
    note: string;
  }) => void;
}) {
  const payables = state.payables.filter(payable => payable.balance > 0);
  const [payableId, setPayableId] = useState(payables[0]?.id ?? '');
  const [kind, setKind] = useState<SupplierAdjustmentKind>('Descuento pronto pago');
  const [base, setBase] = useState(payables[0]?.balance ?? 0);
  const [rate, setRate] = useState(2);
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');

  const payable = state.payables.find(item => item.id === payableId);
  const isDiscount = kind === 'Descuento pronto pago';
  const computed = isDiscount ? Math.round(base * (rate / 100)) : amount;
  const balance = payable?.balance ?? 0;
  const valid = Boolean(payable) && computed > 0 && computed <= balance;

  function changePayable(id: string) {
    setPayableId(id);
    const next = state.payables.find(item => item.id === id);
    setBase(next?.balance ?? 0);
    setAmount(0);
  }

  return (
    <Modal
      title="Nuevo descuento o nota de proveedor"
      subtitle="El ajuste queda en borrador hasta su aprobación y aplicación al saldo."
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Obligación">
            <FilterSelect value={payableId} onChange={event => changePayable(event.target.value)}>
              {payables.map(item => (
                <option key={item.id} value={item.id}>
                  {item.invoiceNumber} · {partyOf(state, item.partyId)?.name ?? item.partyId}
                </option>
              ))}
            </FilterSelect>
          </Field>
          <Field label="Tipo de ajuste">
            <FilterSelect value={kind} onChange={event => setKind(event.target.value as SupplierAdjustmentKind)}>
              {KINDS.map(item => <option key={item} value={item}>{item}</option>)}
            </FilterSelect>
          </Field>
          <Field label="Base del cálculo">
            <input
              type="number"
              className={INPUT}
              value={base}
              onChange={event => setBase(Number(event.target.value))}
            />
          </Field>
          {isDiscount ? (
            <Field label="Tasa del descuento (%)">
              <input
                type="number"
                step="0.01"
                className={INPUT}
                value={rate}
                onChange={event => setRate(Number(event.target.value))}
              />
            </Field>
          ) : (
            <Field label="Valor del ajuste">
              <input
                type="number"
                className={INPUT}
                value={amount}
                onChange={event => setAmount(Number(event.target.value))}
              />
            </Field>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Valor calculado: <strong className="tabular text-gray-900">{money(computed)}</strong>
          {' · '}Saldo de la obligación: <strong className="tabular text-gray-900">{money(balance)}</strong>
        </div>
        <Field label="Motivo y soporte" hint="Explica el descuento, la devolución o el cobro adicional del proveedor.">
          <textarea
            className={`${INPUT} min-h-24`}
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder="Referencia del acuerdo, correo o documento soporte."
          />
        </Field>
        {!valid && computed > 0 && (
          <p className="text-xs text-red-700">El valor del ajuste no puede superar el saldo de la obligación.</p>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => onSave({ payableId, kind, base, rate: isDiscount ? rate : 0, amount: computed, note })}
          >
            Registrar ajuste
          </Button>
        </div>
      </div>
    </Modal>
  );
}
