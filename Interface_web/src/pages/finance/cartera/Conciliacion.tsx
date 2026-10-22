import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  INPUT,
  KpiCard,
  Modal,
  Money,
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import { USUARIO } from '../../../data/mock';
import { useFinance } from '../../../finance/store';
import { HOY, money, partyOf, periodLabel, periodOf } from '../../../finance/selectors';
import type { CustomerReconciliation } from '../../../finance/types';

const CURRENT_PERIOD = periodOf(HOY);

const STATUS_TONE: Record<CustomerReconciliation['status'], 'gray' | 'green' | 'amber'> = {
  Pendiente: 'amber',
  Conciliada: 'green',
  'Con diferencia': 'gray',
};

export default function Conciliacion({ showToast }: { showToast: (text: string) => void }) {
  const { state, update } = useFinance();
  const [target, setTarget] = useState<CustomerReconciliation | null>(null);
  const [note, setNote] = useState('');
  const [adjust, setAdjust] = useState(true);

  const rows = useMemo(
    () => state.customerReconciliations
      .filter(row => row.period === CURRENT_PERIOD || row.status !== 'Conciliada')
      .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference)),
    [state.customerReconciliations],
  );

  const reconciled = rows.filter(row => row.status === 'Conciliada').length;
  const withDifference = rows.filter(row => Math.abs(row.difference) >= 1).length;
  const ledgerTotal = rows.reduce((total, row) => total + row.ledgerBalance, 0);
  const statementTotal = rows.reduce((total, row) => total + row.statementBalance, 0);
  const differenceTotal = ledgerTotal - statementTotal;

  function open(row: CustomerReconciliation) {
    setTarget(row);
    setNote(row.note);
    setAdjust(Math.abs(row.difference) >= 1);
  }

  function confirm() {
    if (!target) return;
    const current = target;
    update(draft => {
      const row = draft.customerReconciliations.find(item => item.id === current.id);
      if (!row) return;
      if (adjust) {
        row.ledgerBalance = row.statementBalance;
        row.difference = 0;
      }
      row.status = 'Conciliada';
      row.note = note.trim() || 'Conciliación confirmada con el cliente.';
      row.checkedBy = USUARIO.nombre;
      row.checkedAt = HOY;
      row.confirmedByClient = true;
    }, `Conciliación con cliente ${partyOf(state, current.partyId)?.name ?? current.partyId}`, 'cartera');
    showToast('Cuenta conciliada con el cliente.');
    setTarget(null);
  }

  function sendStatement(row: CustomerReconciliation) {
    update(draft => {
      const targetRow = draft.customerReconciliations.find(item => item.id === row.id);
      if (targetRow) targetRow.note = 'Estado de cuenta enviado al cliente para confirmación.';
    }, 'Estado de cuenta enviado al cliente', 'cartera');
    showToast(`Estado de cuenta enviado a ${partyOf(state, row.partyId)?.name ?? 'el cliente'}.`);
  }

  const columns: Column<CustomerReconciliation>[] = [
    {
      header: 'Cliente',
      cell: row => {
        const party = partyOf(state, row.partyId);
        return (
          <div>
            <div className="font-medium text-gray-800">{party?.name ?? row.partyId}</div>
            <div className="text-[10px] text-gray-400">{party?.nit ?? '—'}</div>
          </div>
        );
      },
    },
    { header: 'Saldo auxiliar', align: 'right', cell: row => <Money value={row.ledgerBalance} /> },
    { header: 'Estado de cuenta', align: 'right', cell: row => <Money value={row.statementBalance} /> },
    {
      header: 'Diferencia',
      align: 'right',
      cell: row => (
        <Money
          value={row.difference}
          className={Math.abs(row.difference) < 1 ? 'text-emerald-700' : 'font-semibold text-red-700'}
        />
      ),
    },
    { header: 'Estado', cell: row => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge> },
    {
      header: 'Confirmación',
      cell: row => (
        <div className="text-[11px]">
          <div className={row.confirmedByClient ? 'text-emerald-700' : 'text-gray-500'}>
            {row.confirmedByClient ? 'Confirmada por el cliente' : 'Sin confirmar'}
          </div>
          <div className="text-[10px] text-gray-400">{row.checkedAt || '—'}</div>
        </div>
      ),
    },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" onClick={() => sendStatement(row)}>Enviar estado</Button>
          <Button size="sm" variant="primary" onClick={() => open(row)}>Marcar conciliada</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Clientes conciliados" value={`${reconciled} de ${rows.length}`} detail={periodLabel(CURRENT_PERIOD)} tone="green" />
        <KpiCard label="Con diferencia" value={String(withDifference)} detail="Requieren ajuste o soporte" tone={withDifference > 0 ? 'red' : 'green'} />
        <KpiCard label="Saldo auxiliar" value={<Money value={ledgerTotal} />} detail="Cuenta 1305 clientes" tone="cyan" />
        <KpiCard label="Diferencia total" value={<Money value={differenceTotal} />} detail={`Estado de cuenta ${money(statementTotal)}`} tone={Math.abs(differenceTotal) < 1 ? 'green' : 'amber'} />
      </div>

      <Card>
        <SectionTitle
          title="Conciliación con clientes"
          detail="Saldo del auxiliar contra el estado de cuenta enviado y confirmado por cada cliente"
        />
        <div className="p-4">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={row => row.id}
            empty="No hay conciliaciones de clientes para el período."
            footer={
              <span className="text-[11px] text-gray-500">
                Conciliar ajusta el saldo auxiliar al estado de cuenta cuando existe diferencia y deja la nota en la bitácora.
              </span>
            }
          />
        </div>
      </Card>

      {target && (
        <Modal
          title="Marcar cuenta como conciliada"
          subtitle={`${partyOf(state, target.partyId)?.name ?? target.partyId} · ${periodLabel(target.period)}`}
          onClose={() => setTarget(null)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
              <div>
                <div className="text-gray-500">Saldo auxiliar</div>
                <div className="mt-0.5 font-semibold text-gray-900"><Money value={target.ledgerBalance} /></div>
              </div>
              <div>
                <div className="text-gray-500">Estado de cuenta</div>
                <div className="mt-0.5 font-semibold text-gray-900"><Money value={target.statementBalance} /></div>
              </div>
              <div>
                <div className="text-gray-500">Diferencia</div>
                <div className="mt-0.5 font-semibold text-red-700"><Money value={target.difference} /></div>
              </div>
            </div>
            {Math.abs(target.difference) >= 1 && (
              <label className="flex items-start gap-2 text-xs text-gray-700">
                <input type="checkbox" className="mt-0.5" checked={adjust} onChange={event => setAdjust(event.target.checked)} />
                <span>
                  Ajustar el saldo auxiliar al estado de cuenta del cliente por {money(target.difference)}.
                  El ajuste queda documentado en la nota.
                </span>
              </label>
            )}
            <Field label="Nota de conciliación" hint="Soporte de la confirmación o del ajuste aplicado.">
              <textarea
                className={`${INPUT} min-h-24`}
                value={note}
                onChange={event => setNote(event.target.value)}
                placeholder="Detalle de la diferencia, soporte recibido y responsable del cliente."
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setTarget(null)}>Cancelar</Button>
              <Button variant="primary" onClick={confirm}>Confirmar conciliación</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
