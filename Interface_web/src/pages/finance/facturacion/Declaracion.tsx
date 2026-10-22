import { useMemo, useState } from 'react';
import Icon from '../../../components/Icon';
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
import { HOY, fmtDate, money } from '../../../finance/selectors';
import type { TaxFiling, TaxFilingStatus } from '../../../finance/types';

const STATUS_TONE: Record<TaxFilingStatus, 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet'> = {
  Borrador: 'gray',
  Calculada: 'amber',
  Validada: 'blue',
  Presentada: 'violet',
  Aceptada: 'green',
  Rechazada: 'red',
};

function receiptFor(filing: TaxFiling): string {
  const sequence = String(Math.floor(Math.random() * 900000) + 100000);
  return `DIAN-${filing.code}-${filing.period.replace('-', '')}-${sequence}`;
}

export default function Declaracion({ showToast }: { showToast: (text: string) => void }) {
  const { state, update } = useFinance();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stage, setStage] = useState<'detail' | 'confirm'>('detail');
  const [typed, setTyped] = useState('');
  const [checks, setChecks] = useState({ reviewed: true, signature: true, payment: false });

  const rows = useMemo(
    () => [...state.taxFilings].sort((a, b) => b.period.localeCompare(a.period) || a.code.localeCompare(b.code)),
    [state.taxFilings],
  );

  const selected = rows.find(row => row.id === selectedId) ?? null;
  const pending = rows.filter(row => row.status !== 'Aceptada' && row.status !== 'Presentada').length;
  const validated = rows.filter(row => row.status === 'Validada').length;
  const presented = rows.filter(row => row.status === 'Aceptada' || row.status === 'Presentada').length;
  const payable = rows
    .filter(row => row.status !== 'Aceptada' && row.status !== 'Presentada')
    .reduce((total, row) => total + Math.max(0, row.balance), 0);

  function open(row: TaxFiling) {
    setSelectedId(row.id);
    setStage('detail');
    setTyped('');
    setChecks({ reviewed: true, signature: true, payment: row.balance <= 0 });
  }

  function validate() {
    if (!selected) return;
    update(draft => {
      const target = draft.taxFilings.find(item => item.id === selected.id);
      if (target) target.status = 'Validada';
    }, `Declaración ${selected.code} validada`, 'facturacion');
    showToast(`Declaración ${selected.code} validada y lista para presentar.`);
  }

  function present() {
    if (!selected) return;
    const receipt = receiptFor(selected);
    update(draft => {
      const target = draft.taxFilings.find(item => item.id === selected.id);
      if (!target) return;
      target.status = 'Aceptada';
      target.presentedAt = HOY;
      target.receipt = receipt;
    }, `Declaración ${selected.code} presentada ante la DIAN`, 'facturacion');
    showToast(`Declaración ${selected.code} aceptada. Acuse ${receipt}.`);
    setSelectedId(null);
    setStage('detail');
  }

  const columns: Column<TaxFiling>[] = [
    {
      header: 'Formulario',
      cell: row => (
        <div>
          <div className="font-medium text-gray-800">{row.code} · {row.name}</div>
          <div className="text-[10px] text-gray-400">{row.period}</div>
        </div>
      ),
    },
    { header: 'Vencimiento', cell: row => fmtDate(row.dueDate) },
    { header: 'Saldo', align: 'right', cell: row => <Money value={row.balance} className={row.balance > 0 ? 'font-semibold' : 'text-emerald-700'} /> },
    { header: 'Estado', cell: row => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge> },
    {
      header: 'Acuse DIAN',
      cell: row => (
        <span className="font-mono text-[10px] text-gray-600">{row.receipt || 'Sin presentar'}</span>
      ),
    },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => (
        <Button size="sm" variant={row.status === 'Aceptada' ? 'secondary' : 'primary'} onClick={() => open(row)}>
          {row.status === 'Aceptada' ? 'Ver acuse' : 'Gestionar'}
        </Button>
      ),
    },
  ];

  const autoCheck = Boolean(selected && selected.status !== 'Borrador');
  const balanceZero = (selected?.balance ?? 0) <= 0;
  const ready = autoCheck && checks.reviewed && checks.signature && (checks.payment || balanceZero);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Pendientes" value={String(pending)} detail="Por validar o presentar" tone={pending > 0 ? 'amber' : 'green'} />
        <KpiCard label="Validadas" value={String(validated)} detail="Listas para envío" tone="blue" />
        <KpiCard label="Presentadas" value={String(presented)} detail="Con acuse de la DIAN" tone="green" />
        <KpiCard label="Saldo por pagar" value={<Money value={payable} />} detail="Declaraciones pendientes" tone={payable > 0 ? 'red' : 'gray'} />
      </div>

      <Card>
        <SectionTitle
          title="Declaración electrónica"
          detail="Validación, presentación y acuse de los formularios tributarios"
        />
        <div className="p-4">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={row => row.id}
            empty="No hay declaraciones generadas."
            footer={
              <span className="text-[11px] text-gray-500">
                La presentación es simulada: genera un acuse y deja el formulario en estado Aceptada.
              </span>
            }
          />
        </div>
      </Card>

      {selected && (
        <Modal
          title={stage === 'detail' ? `Declaración ${selected.code} · ${selected.period}` : 'Confirmar presentación'}
          subtitle={stage === 'detail'
            ? 'Verifique las casillas, la firma y el pago antes de presentar.'
            : 'La presentación genera un acuse y bloquea el formulario.'}
          onClose={() => setSelectedId(null)}
        >
          {stage === 'detail' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs sm:grid-cols-4">
                <div>
                  <div className="text-gray-500">Formulario</div>
                  <div className="mt-0.5 font-semibold text-gray-900">{selected.code}</div>
                </div>
                <div>
                  <div className="text-gray-500">Período</div>
                  <div className="mt-0.5 font-semibold text-gray-900">{selected.period}</div>
                </div>
                <div>
                  <div className="text-gray-500">Vencimiento</div>
                  <div className="mt-0.5 font-semibold text-gray-900">{fmtDate(selected.dueDate)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Saldo</div>
                  <div className="mt-0.5 font-semibold text-gray-900"><Money value={selected.balance} /></div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold text-gray-700">Lista de verificación</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700">
                    <input type="checkbox" checked={autoCheck} disabled />
                    Formulario calculado y sin casillas pendientes
                    <Badge tone={autoCheck ? 'green' : 'red'} className="ml-auto">{autoCheck ? 'Cumple' : 'Pendiente'}</Badge>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700">
                    <input type="checkbox" checked={checks.reviewed} onChange={event => setChecks(current => ({ ...current, reviewed: event.target.checked }))} />
                    Cifras revisadas por el responsable tributario
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700">
                    <input type="checkbox" checked={checks.signature} onChange={event => setChecks(current => ({ ...current, signature: event.target.checked }))} />
                    Firma electrónica vigente y registrada
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={checks.payment || balanceZero}
                      disabled={balanceZero}
                      onChange={event => setChecks(current => ({ ...current, payment: event.target.checked }))}
                    />
                    {balanceZero ? 'Sin saldo a pagar' : 'Pago programado o acuerdo de pago registrado'}
                  </label>
                </div>
              </div>

              {selected.receipt ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-900">
                  Presentada el {selected.presentedAt}. Acuse <strong className="font-mono">{selected.receipt}</strong>.
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  Vence el {fmtDate(selected.dueDate)}. La presentación es simulada y no transmite a la DIAN.
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <Button onClick={() => setSelectedId(null)}>Cerrar</Button>
                <Button
                  onClick={validate}
                  disabled={selected.status === 'Aceptada' || selected.status === 'Validada' || !ready}
                >
                  Validar declaración
                </Button>
                <Button
                  variant="primary"
                  disabled={selected.status === 'Aceptada' || !ready}
                  onClick={() => { setStage('confirm'); setTyped(''); }}
                >
                  Presentar ante la DIAN
                </Button>
              </div>
              {!ready && selected.status !== 'Aceptada' && (
                <p className="text-right text-[10px] text-red-700">
                  Complete la lista de verificación para habilitar la presentación.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                Va a presentar el formulario <strong>{selected.code}</strong> del período{' '}
                <strong>{selected.period}</strong> por un saldo de <strong>{money(selected.balance)}</strong>.
                Esta acción no se puede deshacer desde la interfaz.
              </div>
              <Field label="Escriba PRESENTAR para confirmar" hint="La confirmación escrita evita presentaciones accidentales.">
                <input className={`${INPUT} font-mono`} value={typed} onChange={event => setTyped(event.target.value)} placeholder="PRESENTAR" />
              </Field>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setStage('detail')}>Volver</Button>
                <Button variant="primary" disabled={typed.trim() !== 'PRESENTAR'} onClick={present}>
                  <Icon name="check" className="h-3.5 w-3.5" /> Confirmar presentación
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
