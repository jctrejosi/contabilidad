import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  FilterBar,
  FilterSelect,
  INPUT,
  KpiCard,
  Modal,
  Money,
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import {
  assetCategoryOf,
  assetReconciliationDifference,
  assetReconciliationValues,
  compactMoney,
  money,
  periodLabel,
} from '../../../finance/selectors';
import type { AssetReconciliation, FinanceState } from '../../../finance/types';
import type { AssetActions } from './shared';

export default function Conciliacion({ state, actions }: { state: FinanceState; actions: AssetActions }) {
  const periods = Array.from(new Set(state.assetReconciliations.map(item => item.period))).sort().reverse();
  const [period, setPeriod] = useState(periods[0] ?? '2026-01');
  const [noteModal, setNoteModal] = useState<{ id: string; mode: 'reconcile' | 'adjust' } | null>(null);
  const [note, setNote] = useState('');

  const rows = state.assetReconciliations.filter(item => item.period === period);
  const withDifference = rows.filter(item => Math.abs(assetReconciliationDifference(state.assets, item)) >= 1);
  const totalDifference = rows.reduce((sum, item) => sum + assetReconciliationDifference(state.assets, item), 0);
  const reconciled = rows.filter(item => item.status === 'Conciliada').length;
  const target = noteModal ? rows.find(item => item.id === noteModal.id) : undefined;
  const targetDifference = target ? assetReconciliationDifference(state.assets, target) : 0;
  const validNote = note.trim().length >= 4;

  const columns: Column<AssetReconciliation>[] = [
    { header: 'Categoría', cell: row => { const category = assetCategoryOf(state.assetCategories, row.categoryId); return <div><div className="font-mono text-[10px] text-gray-400">{category?.code ?? '—'}</div><div className="max-w-48 truncate font-medium text-gray-800">{category?.name ?? row.categoryId}</div></div>; } },
    {
      header: 'Mayor',
      align: 'right',
      cell: row => (
        <div>
          <Money value={row.ledgerGross - row.ledgerAccumulated - row.ledgerImpairment} className="font-medium" />
          <div className="text-[9px] text-gray-400">Bruto {compactMoney(row.ledgerGross)} · Acum. {compactMoney(row.ledgerAccumulated)}</div>
        </div>
      ),
    },
    {
      header: 'Sistema',
      align: 'right',
      cell: row => {
        const system = assetReconciliationValues(state.assets, row.categoryId);
        return (
          <div>
            <Money value={system.net} className="font-medium" />
            <div className="text-[9px] text-gray-400">Bruto {compactMoney(system.gross)} · Acum. {compactMoney(system.accumulated)}</div>
          </div>
        );
      },
    },
    {
      header: 'Diferencia',
      align: 'right',
      cell: row => {
        const difference = assetReconciliationDifference(state.assets, row);
        const ok = Math.abs(difference) < 1;
        return <Money value={difference} className={ok ? 'text-emerald-700' : 'font-semibold text-red-600'} />;
      },
    },
    { header: 'Estado', cell: row => <Badge tone={row.status === 'Conciliada' ? 'green' : row.status === 'Diferencia' ? 'red' : 'amber'}>{row.status}</Badge> },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => {
        const difference = assetReconciliationDifference(state.assets, row);
        return (
          <div className="flex justify-end gap-1.5">
            {Math.abs(difference) < 1 && row.status !== 'Conciliada' && <Button size="sm" variant="primary" onClick={() => { setNote('Cuadre verificado contra el libro mayor.'); setNoteModal({ id: row.id, mode: 'reconcile' }); }}>Conciliar</Button>}
            {Math.abs(difference) >= 1 && <Button size="sm" variant="danger" onClick={() => { setNote(`Ajuste por diferencia de ${money(difference)}.`); setNoteModal({ id: row.id, mode: 'adjust' }); }}>Registrar ajuste</Button>}
            <Button size="sm" variant="ghost" onClick={() => { setNote(row.note || 'Revisión de conciliación.'); setNoteModal({ id: row.id, mode: 'reconcile' }); }}>Nota</Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Categorías conciliadas" value={`${reconciled} / ${rows.length}`} detail="Cuadre contra el libro mayor" tone="green" />
        <KpiCard label="Categorías con diferencia" value={String(withDifference.length)} detail="Requieren ajuste contable" tone={withDifference.length ? 'red' : 'green'} />
        <KpiCard label="Diferencia neta" value={money(totalDifference)} detail="Mayor menos valor en libros" tone={Math.abs(totalDifference) < 1 ? 'green' : 'red'} />
        <KpiCard label="Periodo" value={periodLabel(period)} detail="Corte de conciliación" />
      </div>

      <Card>
        <SectionTitle
          title="Conciliación por categoría"
          detail="Compara las cuentas 15xx, 1592 y 1596 del mayor contra los saldos calculados por el módulo."
        />
        <FilterBar>
          <FilterSelect value={period} onChange={event => setPeriod(event.target.value)} aria-label="Periodo">
            {periods.map(item => <option key={item} value={item}>{periodLabel(item)}</option>)}
          </FilterSelect>
          <span className="text-[11px] text-gray-500">La diferencia se calcula sobre el valor neto: bruto menos depreciación acumulada y deterioro.</span>
        </FilterBar>
        <DataTable columns={columns} rows={rows} rowKey={row => row.id} empty="No hay conciliaciones para el periodo seleccionado." />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-xs font-semibold text-gray-700">Cómo se arma el cuadre</h3>
          <div className="mt-3 space-y-2 text-[11px] leading-5 text-gray-600">
            <p><strong>Mayor:</strong> saldos importados del libro (cuenta del activo, depreciación acumulada y deterioro).</p>
            <p><strong>Sistema:</strong> suma de costo + mejoras + revalorización, depreciación acumulada y deterioro de los activos vigentes de la categoría.</p>
            <p><strong>Diferencia:</strong> valor neto del mayor menos valor neto del sistema. Una diferencia menor a $1 se considera conciliada.</p>
          </div>
          <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-[11px] leading-4 text-blue-800">
            Los activos vendidos o dados de baja no entran en el saldo del sistema; su costo y depreciación se retiran del mayor al aplicar la baja.
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="text-xs font-semibold text-gray-700">Cuentas que se cruzan</h3>
          <div className="mt-3 space-y-1.5 text-[11px] text-gray-600">
            {state.assetCategories.map(category => (
              <div key={category.id} className="flex items-center justify-between gap-2 border-b border-gray-50 py-1.5 last:border-0">
                <span className="min-w-0 truncate">{category.name}</span>
                <span className="shrink-0 font-mono text-[10px] text-gray-500">{category.assetAccount} · {category.accumulatedAccount} · {category.impairmentAccount}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {noteModal && target && (
        <Modal
          title={noteModal.mode === 'adjust' ? 'Registrar ajuste de conciliación' : 'Marcar categoría como conciliada'}
          subtitle={`${assetCategoryOf(state.assetCategories, target.categoryId)?.name ?? ''} · ${periodLabel(target.period)}`}
          onClose={() => setNoteModal(null)}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><div className="text-gray-500">Diferencia actual</div><div className="mt-1 font-semibold"><Money value={targetDifference} /></div></div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><div className="text-gray-500">Acción</div><div className="mt-1 font-semibold">{noteModal.mode === 'adjust' ? 'Ajustar mayor al sistema' : 'Solo marcar conciliada'}</div></div>
            </div>
            {noteModal.mode === 'adjust' && Math.abs(targetDifference) >= 1 && (
              <p className="text-[11px] leading-4 text-amber-700">
                El ajuste lleva la diferencia a la cuenta de gasto o a la depreciación acumulada y genera un movimiento tipo Ajuste con referencia AJUSTE-{target.period}.
              </p>
            )}
            {noteModal.mode === 'reconcile' && Math.abs(targetDifference) >= 1 && (
              <p className="text-[11px] leading-4 text-red-600">No se puede conciliar mientras exista una diferencia. Use Registrar ajuste.</p>
            )}
            <Field label="Nota de conciliación">
              <textarea className={`${INPUT} min-h-20`} value={note} onChange={event => setNote(event.target.value)} />
            </Field>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setNoteModal(null)}>Cancelar</Button>
            <Button
              variant={noteModal.mode === 'adjust' ? 'danger' : 'primary'}
              disabled={!validNote || (noteModal.mode === 'reconcile' && Math.abs(targetDifference) >= 1)}
              onClick={() => {
                if (noteModal.mode === 'adjust') actions.adjustReconciliation(noteModal.id, note);
                else actions.reconcile(noteModal.id, note);
                setNoteModal(null);
              }}
            >
              {noteModal.mode === 'adjust' ? 'Registrar ajuste' : 'Conciliar'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
