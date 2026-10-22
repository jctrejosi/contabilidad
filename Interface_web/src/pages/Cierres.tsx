import { useMemo, useState } from 'react';
import {
  blockingPending,
  buildClosingEntry,
  canClose,
  closePeriod,
  currentPeriod,
  generateClosing,
  loadCloseState,
  reopenPeriod,
  resultPreview,
  saveCloseState,
  sortedPeriods,
  toggleCheck,
  trialBalanceDifference,
  type CloseState,
  type PeriodEntry,
  type PeriodRecord,
} from '../data/cierres';
import { LOTES_INICIALES, USUARIO } from '../data/mock';

const money = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
}).format(value);

type Tab = 'periodo' | 'historial' | 'apertura';

const TABS: { id: Tab; label: string }[] = [
  { id: 'periodo', label: 'Período actual' },
  { id: 'historial', label: 'Historial de cierres' },
  { id: 'apertura', label: 'Apertura' },
];

const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-petroleum-600 disabled:cursor-not-allowed disabled:bg-gray-300';
const BUTTON_SECONDARY = 'rounded border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50';
const INPUT = 'w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';

function statusTone(status: PeriodRecord['status']): string {
  if (status === 'Cerrado') return 'bg-emerald-100 text-emerald-700';
  if (status === 'En cierre') return 'bg-amber-100 text-amber-700';
  return 'bg-sky-100 text-sky-700';
}

function EntryModal({
  title,
  subtitle,
  entry,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  subtitle: string;
  entry: PeriodEntry;
  confirmLabel?: string;
  onConfirm?: () => void;
  onClose: () => void;
}) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
            <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-xl leading-none text-gray-400 hover:text-gray-600">×</button>
        </div>
        <div className="px-5 py-4">
          <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <span className="font-mono font-semibold text-gray-800">{entry.number}</span>
            <span>{entry.date}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{entry.type}</span>
            <span className="text-gray-400">Generado por {entry.generatedBy}</span>
          </div>
          <div className="overflow-hidden rounded border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {['Cuenta', 'Nombre', 'Débito', 'Crédito'].map((header, index) => (
                    <th key={header} className={`px-3 py-2 font-semibold text-gray-600 ${index >= 2 ? 'text-right' : 'text-left'}`}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entry.lines.map((line, index) => (
                  <tr key={`${line.account}-${index}`}>
                    <td className="px-3 py-2 font-mono text-gray-700">{line.account}</td>
                    <td className="px-3 py-2 text-gray-600">{line.name}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700">{line.debit ? money(line.debit) : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700">{line.credit ? money(line.credit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <td colSpan={2} className="px-3 py-2 text-gray-700">Totales</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-900">{money(entry.debit)}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-900">{money(entry.credit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className={`text-xs font-medium ${entry.debit === entry.credit ? 'text-emerald-700' : 'text-red-700'}`}>
              {entry.debit === entry.credit ? 'Comprobante cuadrado' : `Diferencia ${money(entry.debit - entry.credit)}`}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>Cerrar</button>
              {confirmLabel && onConfirm && (
                <button type="button" onClick={onConfirm} className={BUTTON_PRIMARY}>{confirmLabel}</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  subtitle,
  keyword,
  actionLabel,
  tone,
  onClose,
  onConfirm,
}: {
  title: string;
  subtitle: string;
  keyword: string;
  actionLabel: string;
  tone: 'primary' | 'danger';
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const valid = text.trim().toUpperCase() === keyword;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-gray-500">{subtitle}</p>
        </div>
        <div className="space-y-3 px-5 py-4">
          <label className="block text-xs font-medium text-gray-600">
            Nota del cierre (opcional)
            <textarea value={note} onChange={event => setNote(event.target.value)} className={`${INPUT} mt-1 min-h-20`} placeholder="Motivo, observaciones o referencia del acta." />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Escriba <span className="font-mono font-bold text-gray-800">{keyword}</span> para confirmar
            <input value={text} onChange={event => setText(event.target.value)} className={`${INPUT} mt-1 font-mono`} autoFocus />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button type="button" onClick={onClose} className={BUTTON_SECONDARY}>Cancelar</button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => onConfirm(note)}
            className={tone === 'danger'
              ? 'rounded bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-300'
              : BUTTON_PRIMARY}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: PeriodRecord['status'] }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusTone(status)}`}>{status}</span>;
}

export default function Cierres() {
  const [closeState, setCloseState] = useState<CloseState>(loadCloseState);
  const [tab, setTab] = useState<Tab>('periodo');
  const [toast, setToast] = useState('');
  const [entryModal, setEntryModal] = useState<{ title: string; subtitle: string; entry: PeriodEntry; confirmLabel?: string; onConfirm?: () => void } | null>(null);
  const [closeTarget, setCloseTarget] = useState<PeriodRecord | null>(null);
  const [reopenTarget, setReopenTarget] = useState<PeriodRecord | null>(null);

  const current = useMemo(() => currentPeriod(closeState), [closeState]);
  const ordered = useMemo(() => sortedPeriods(closeState), [closeState]);
  const difference = current ? trialBalanceDifference(current.id) : 0;

  const periodLots = current ? LOTES_INICIALES.filter(lote => lote.periodo === current.id) : [];
  const pendingLots = periodLots.filter(lote => lote.estado !== 'Contabilizado');

  function apply(next: CloseState, message?: string) {
    setCloseState(next);
    saveCloseState(next);
    if (message) {
      setToast(message);
      window.setTimeout(() => setToast(''), 4000);
    }
  }

  function handleToggle(checkId: string) {
    if (!current) return;
    apply(toggleCheck(closeState, current.id, checkId));
  }

  function handleGenerate() {
    if (!current) return;
    apply(generateClosing(closeState, current.id, USUARIO.nombre), `Comprobante de cierre de ${current.label} generado.`);
    setEntryModal(null);
  }

  function handleClose(note: string) {
    if (!closeTarget) return;
    const next = closePeriod(closeState, closeTarget.id, USUARIO.nombre, note);
    apply(next, `${closeTarget.label} cerrado. Se abrió el período siguiente con su asiento de apertura.`);
    setCloseTarget(null);
    setTab('historial');
  }

  function handleReopen(note: string) {
    if (!reopenTarget) return;
    const next = reopenPeriod(closeState, reopenTarget.id, USUARIO.nombre, note);
    apply(next, `${reopenTarget.label} reabierto. El asiento de apertura del período siguiente fue retirado.`);
    setReopenTarget(null);
    setTab('periodo');
  }

  if (!current) {
    return (
      <div className="max-w-screen-xl space-y-4 p-4">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Cierres contables</h1>
          <p className="mt-1 text-xs text-gray-500">No hay períodos abiertos. Reabra el último período desde el historial.</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-6">
          <button type="button" onClick={() => setTab('historial')} className={BUTTON_PRIMARY}>Ver historial</button>
        </div>
        {tab === 'historial' && <HistoryTable periods={ordered} onView={entry => setEntryModal(entry)} onReopen={setReopenTarget} />}
        {entryModal && <EntryModal {...entryModal} onClose={() => setEntryModal(null)} />}
        {reopenTarget && (
          <ConfirmModal
            title={`Reabrir ${reopenTarget.label}`}
            subtitle="Se elimina el comprobante de cierre del período y el asiento de apertura del período siguiente si aún no tiene cierres."
            keyword="REABRIR"
            actionLabel="Reabrir período"
            tone="danger"
            onClose={() => setReopenTarget(null)}
            onConfirm={handleReopen}
          />
        )}
      </div>
    );
  }

  const pending = blockingPending(current);
  const preview = resultPreview(current.id);
  const ready = canClose(current);
  const latestClosed = ordered.find(period => period.status === 'Cerrado');
  const reopenable = latestClosed && !ordered.some(period => period.id > latestClosed.id && period.status === 'Cerrado') ? latestClosed : undefined;

  return (
    <div className="max-w-screen-xl space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-gray-800">Cierres contables</h1>
          <p className="mt-1 text-xs text-gray-500">
            Cierre mensual, bloqueo del período y apertura del siguiente — {current.label}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={current.status} />
          <span className="text-xs text-gray-400">Última actualización {closeState.audit[0]?.at ?? 'sin movimientos'}</span>
        </div>
      </div>

      {current.status === 'En cierre' && (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          El comprobante de cierre <strong className="font-mono">{current.closingEntry?.number}</strong> ya está generado.
          Complete la verificación y ejecute el cierre para bloquear el período.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded border border-gray-200 bg-white p-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Período</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">{current.label}</div>
          <div className="text-[10px] text-gray-400">{current.id}</div>
        </div>
        <div className="rounded border border-gray-200 bg-white p-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Estado</div>
          <div className="mt-1"><StatusPill status={current.status} /></div>
          <div className="mt-1 text-[10px] text-gray-400">{current.checks.filter(check => check.checked).length} de {current.checks.length} verificaciones</div>
        </div>
        <div className="rounded border border-gray-200 bg-white p-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Comprobante de cierre</div>
          <div className="mt-1 font-mono text-sm font-semibold text-gray-900">{current.closingEntry?.number ?? 'Sin generar'}</div>
          <div className="text-[10px] text-gray-400">{current.closingEntry ? money(current.closingEntry.debit) : 'Pendiente'}</div>
        </div>
        <div className="rounded border border-gray-200 bg-white p-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">Diferencia del balance</div>
          <div className={`mt-1 text-sm font-semibold ${difference === 0 ? 'text-emerald-700' : 'text-red-700'}`}>{money(difference)}</div>
          <div className="text-[10px] text-gray-400">{difference === 0 ? 'Débitos = créditos' : 'Requiere ajuste'}</div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`border-b-2 px-3 py-2 text-xs font-medium transition ${tab === item.id ? 'border-petroleum-500 text-petroleum-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'periodo' && (
        <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <div className="rounded border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="text-xs font-semibold text-gray-700">Lista de verificación previa al cierre</h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pending.length === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {current.checks.filter(check => check.checked).length}/{current.checks.length} completados
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {current.checks.map(check => {
                const extra = check.id === 'c1'
                  ? `${pendingLots.length} lote${pendingLots.length === 1 ? '' : 's'} pendiente${pendingLots.length === 1 ? '' : 's'} de ${periodLots.length}`
                  : check.id === 'c2'
                    ? `Diferencia calculada: ${money(difference)}`
                    : null;
                return (
                  <button
                    key={check.id}
                    type="button"
                    onClick={() => handleToggle(check.id)}
                    disabled={check.automatico}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${check.automatico ? 'cursor-default' : 'hover:bg-gray-50'} ${check.bloqueante && !check.checked ? 'bg-red-50/60' : ''}`}
                  >
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${check.checked ? 'bg-emerald-500 text-white' : 'border-2 border-gray-300 bg-white'}`}>
                      {check.checked && <span className="text-[11px]">✓</span>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-xs font-medium ${check.checked ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                        {check.label}
                        {check.bloqueante && !check.checked && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-red-700 no-underline">Bloqueante</span>}
                        {check.automatico && <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700 no-underline">Automático</span>}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-gray-400">{check.desc}</span>
                      {extra && <span className="mt-0.5 block text-[10px] font-medium text-gray-500">{extra}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            {pending.length > 0 && (
              <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-[11px] font-medium text-red-700">
                {pending.length} elemento{pending.length === 1 ? '' : 's'} bloqueante{pending.length === 1 ? '' : 's'} sin completar
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-gray-700">Comprobante de cierre</h3>
                  <p className="mt-1 text-[10px] leading-4 text-gray-400">
                    Cancela las cuentas de resultado (clases 4-9) contra resultados del ejercicio.
                  </p>
                </div>
                {current.closingEntry && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Generado</span>}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded bg-gray-50 p-3 text-[11px]">
                <div><div className="text-[10px] text-gray-400">Ingresos</div><div className="font-mono font-semibold text-gray-800">{money(preview.revenue)}</div></div>
                <div><div className="text-[10px] text-gray-400">Gastos</div><div className="font-mono font-semibold text-gray-800">{money(preview.expense)}</div></div>
                <div><div className="text-[10px] text-gray-400">Resultado</div><div className={`font-mono font-semibold ${preview.result >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{money(preview.result)}</div></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending.length > 0 || Boolean(current.closingEntry)}
                  onClick={() => setEntryModal({
                    title: `Vista previa — Comprobante de cierre ${current.label}`,
                    subtitle: 'Revise las cuentas que serán canceladas antes de generar el comprobante.',
                    entry: buildClosingEntry(current.id, USUARIO.nombre),
                    confirmLabel: 'Generar comprobante de cierre',
                    onConfirm: handleGenerate,
                  })}
                  className={BUTTON_PRIMARY}
                >
                  Previsualizar y generar
                </button>
                {current.closingEntry && (
                  <button type="button" onClick={() => setEntryModal({
                    title: `Comprobante de cierre ${current.closingEntry?.number}`,
                    subtitle: `${current.label} · generado por ${current.closingEntry?.generatedBy}`,
                    entry: current.closingEntry!,
                  })} className={BUTTON_SECONDARY}>
                    Ver asiento
                  </button>
                )}
              </div>
            </div>

            <div className="rounded border border-gray-200 bg-white p-4">
              <h3 className="text-xs font-semibold text-gray-700">Ejecutar cierre</h3>
              <p className="mt-1 text-[10px] leading-4 text-gray-400">
                Bloquea el período, registra la fecha y el usuario del cierre y genera el asiento de apertura del período siguiente.
              </p>
              <div className="mt-3 space-y-1 text-[11px] text-gray-600">
                <div className="flex items-center gap-2">
                  <span className={pending.length === 0 ? 'text-emerald-600' : 'text-red-600'}>{pending.length === 0 ? '✓' : '×'}</span>
                  Verificaciones bloqueantes
                </div>
                <div className="flex items-center gap-2">
                  <span className={current.closingEntry ? 'text-emerald-600' : 'text-red-600'}>{current.closingEntry ? '✓' : '×'}</span>
                  Comprobante de cierre generado
                </div>
              </div>
              <button
                type="button"
                disabled={!ready}
                onClick={() => setCloseTarget(current)}
                className={`mt-3 w-full ${BUTTON_PRIMARY}`}
              >
                Cerrar {current.label}
              </button>
            </div>

            <div className="rounded border border-gray-200 bg-white p-4">
              <h3 className="text-xs font-semibold text-gray-700">Apertura del siguiente período</h3>
              <p className="mt-1 text-[10px] leading-4 text-gray-400">
                Se genera automáticamente al cerrar: traslada los saldos de activo, pasivo y patrimonio del período cerrado.
              </p>
              <div className="mt-2 text-[11px] text-gray-600">
                {current.closingEntry
                  ? `Al confirmar el cierre se creará el asiento AP del período siguiente.`
                  : 'Primero genere y valide el comprobante de cierre.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'historial' && (
        <HistoryTable periods={ordered} onView={entry => setEntryModal(entry)} onReopen={period => { if (period.id === reopenable?.id) setReopenTarget(period); }} reopenableId={reopenable?.id} />
      )}

      {tab === 'apertura' && (
        <div className="space-y-4">
          <div className="rounded border border-gray-200 bg-white p-4">
            <h2 className="text-xs font-semibold text-gray-700">Asiento de apertura — {current.label}</h2>
            {current.openingEntry ? (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-gray-600">
                  <span className="font-mono font-semibold text-gray-800">{current.openingEntry.number}</span>
                  <span>{current.openingEntry.date}</span>
                  <span>Débito {money(current.openingEntry.debit)} · Crédito {money(current.openingEntry.credit)}</span>
                </div>
                <button
                  type="button"
                  className={`${BUTTON_SECONDARY} mt-3`}
                  onClick={() => setEntryModal({
                    title: `Asiento de apertura ${current.openingEntry?.number}`,
                    subtitle: `${current.label} · saldos trasladados del período anterior`,
                    entry: current.openingEntry!,
                  })}
                >
                  Ver asiento de apertura
                </button>
              </>
            ) : (
              <p className="mt-2 text-[11px] leading-5 text-gray-500">
                Este período es el inicial de la serie y no tiene asiento de apertura registrado. Al cerrar {current.label},
                el período siguiente se abrirá con los saldos trasladados.
              </p>
            )}
          </div>

          <div className="rounded border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-xs font-semibold text-gray-700">Trazabilidad de períodos</h2>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {['Período', 'Estado', 'Cierre', 'Apertura', 'Cerrado por'].map(header => (
                    <th key={header} className="px-3 py-2 text-left font-semibold text-gray-600">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ordered.map(period => (
                  <tr key={period.id}>
                    <td className="px-3 py-2 font-medium text-gray-800">{period.label}</td>
                    <td className="px-3 py-2"><StatusPill status={period.status} /></td>
                    <td className="px-3 py-2 font-mono text-gray-600">{period.closingEntry?.number ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-gray-600">{period.openingEntry?.number ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{period.closedBy ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded border border-gray-200 bg-white p-4">
            <h2 className="text-xs font-semibold text-gray-700">Últimos eventos</h2>
            <div className="mt-2 divide-y divide-gray-50">
              {closeState.audit.length === 0 && <p className="py-3 text-[11px] text-gray-500">Sin eventos registrados.</p>}
              {closeState.audit.slice(0, 8).map(event => (
                <div key={event.id} className="flex items-start justify-between gap-3 py-2 text-[11px]">
                  <span className="text-gray-700">{event.action}</span>
                  <span className="shrink-0 text-gray-400">{event.at} · {event.user}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {entryModal && <EntryModal {...entryModal} onClose={() => setEntryModal(null)} />}

      {closeTarget && (
        <ConfirmModal
          title={`Cerrar ${closeTarget.label}`}
          subtitle="El período quedará bloqueado para nuevos movimientos y se generará el asiento de apertura del período siguiente."
          keyword="CIERRE"
          actionLabel="Confirmar cierre"
          tone="primary"
          onClose={() => setCloseTarget(null)}
          onConfirm={handleClose}
        />
      )}

      {reopenTarget && (
        <ConfirmModal
          title={`Reabrir ${reopenTarget.label}`}
          subtitle="Se elimina el comprobante de cierre y el asiento de apertura del período siguiente si aún no tiene cierres. Esta acción queda en la trazabilidad."
          keyword="REABRIR"
          actionLabel="Reabrir período"
          tone="danger"
          onClose={() => setReopenTarget(null)}
          onConfirm={handleReopen}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[90] rounded-lg bg-[#001F4C] px-4 py-3 text-xs text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function HistoryTable({
  periods,
  onView,
  onReopen,
  reopenableId,
}: {
  periods: PeriodRecord[];
  onView: (payload: { title: string; subtitle: string; entry: PeriodEntry }) => void;
  onReopen: (period: PeriodRecord) => void;
  reopenableId?: string;
}) {
  return (
    <div className="overflow-hidden rounded border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-xs font-semibold text-gray-700">Historial de períodos</h2>
        <p className="mt-0.5 text-[10px] text-gray-400">Cierres y aperturas registrados en esta compañía.</p>
      </div>
      <table className="w-full text-xs">
        <thead className="bg-gray-50">
          <tr>
            {['Período', 'Estado', 'Cierre', 'Apertura', 'Cerrado', 'Acciones'].map(header => (
              <th key={header} className="px-3 py-2 text-left font-semibold text-gray-600">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {periods.map(period => (
            <tr key={period.id}>
              <td className="px-3 py-2">
                <div className="font-medium text-gray-800">{period.label}</div>
                <div className="text-[10px] text-gray-400">{period.id}</div>
              </td>
              <td className="px-3 py-2"><StatusPill status={period.status} /></td>
              <td className="px-3 py-2">
                {period.closingEntry ? (
                  <button
                    type="button"
                    onClick={() => onView({
                      title: `Comprobante de cierre ${period.closingEntry?.number}`,
                      subtitle: `${period.label} · generado por ${period.closingEntry?.generatedBy}`,
                      entry: period.closingEntry!,
                    })}
                    className="font-mono text-sky-700 hover:underline"
                  >
                    {period.closingEntry.number}
                  </button>
                ) : '—'}
              </td>
              <td className="px-3 py-2">
                {period.openingEntry ? (
                  <button
                    type="button"
                    onClick={() => onView({
                      title: `Asiento de apertura ${period.openingEntry?.number}`,
                      subtitle: `${period.label} · saldos trasladados`,
                      entry: period.openingEntry!,
                    })}
                    className="font-mono text-sky-700 hover:underline"
                  >
                    {period.openingEntry.number}
                  </button>
                ) : '—'}
              </td>
              <td className="px-3 py-2 text-gray-500">
                {period.closedAt ? <div><div>{period.closedAt}</div><div className="text-[10px] text-gray-400">{period.closedBy}</div></div> : '—'}
              </td>
              <td className="px-3 py-2">
                {period.status === 'Cerrado' && period.id === reopenableId && (
                  <button type="button" onClick={() => onReopen(period)} className="text-[11px] font-medium text-red-600 hover:underline">
                    Reabrir
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {periods.length === 0 && <div className="px-4 py-8 text-center text-xs text-gray-500">Aún no hay períodos registrados.</div>}
    </div>
  );
}
