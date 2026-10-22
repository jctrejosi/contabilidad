import { useMemo } from 'react';
import Icon from '../../../components/Icon';
import {
  Badge,
  Button,
  Card,
  DataTable,
  KpiCard,
  Money,
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import { useFinance } from '../../../finance/store';
import { HOY, money } from '../../../finance/selectors';
import type { EliminationEntry, EliminationStatus } from '../../../finance/types';

const STATUS_TONE: Record<EliminationStatus, 'amber' | 'green' | 'blue'> = {
  Pendiente: 'amber',
  Aplicada: 'green',
  Revisada: 'blue',
};

export default function Eliminaciones({ showToast }: { showToast: (text: string) => void }) {
  const { state, update } = useFinance();

  const rows = useMemo(
    () => [...state.eliminations].sort((a, b) => a.concept.localeCompare(b.concept)),
    [state.eliminations],
  );

  const totalDebit = rows.reduce((total, row) => total + row.debit, 0);
  const totalCredit = rows.reduce((total, row) => total + row.credit, 0);
  const pending = rows.filter(row => row.status === 'Pendiente');
  const applied = rows.filter(row => row.status !== 'Pendiente');
  const difference = totalDebit - totalCredit;

  function advance(row: EliminationEntry) {
    const next: EliminationStatus = row.status === 'Pendiente' ? 'Aplicada' : 'Revisada';
    update(draft => {
      const target = draft.eliminations.find(item => item.id === row.id);
      if (target) target.status = next;
    }, `Eliminación ${row.concept} marcada como ${next}`, 'consolidacion');
    showToast(`Eliminación marcada como ${next.toLowerCase()}.`);
  }

  function generate() {
    if (pending.length > 0) {
      showToast(`Hay ${pending.length} eliminaciones pendientes de aplicar.`);
      return;
    }
    const receivable = state.consolidationCompanies.reduce((total, company) => total + company.intercompanyReceivable, 0);
    const payable = state.consolidationCompanies.reduce((total, company) => total + company.intercompanyPayable, 0);
    if (receivable === 0 && payable === 0) {
      showToast('No hay saldos intercompañía por eliminar.');
      return;
    }
    update(draft => {
      if (receivable > 0) {
        draft.eliminations.unshift({
          id: `elim-${Date.now()}-cxc`,
          period: '2026-02',
          concept: 'Cuentas por cobrar intercompañía',
          fromCompany: 'Grupo',
          toCompany: 'Grupo',
          account: '1305 / 2205',
          debit: receivable,
          credit: receivable,
          status: 'Pendiente',
          note: 'Eliminación generada desde los saldos intercompañía del perímetro.',
        });
      }
      if (payable > 0) {
        draft.eliminations.unshift({
          id: `elim-${Date.now()}-cxp`,
          period: '2026-02',
          concept: 'Cuentas por pagar intercompañía',
          fromCompany: 'Grupo',
          toCompany: 'Grupo',
          account: '2205 / 1305',
          debit: payable,
          credit: payable,
          status: 'Pendiente',
          note: 'Eliminación generada desde los saldos intercompañía del perímetro.',
        });
      }
    }, 'Eliminaciones intercompañía generadas', 'consolidacion');
    showToast('Eliminaciones generadas desde los saldos intercompañía.');
  }

  const columns: Column<EliminationEntry>[] = [
    {
      header: 'Concepto',
      cell: row => (
        <div>
          <div className="font-medium text-gray-800">{row.concept}</div>
          <div className="text-[10px] text-gray-400">{row.note}</div>
        </div>
      ),
    },
    {
      header: 'Compañías',
      cell: row => (
        <span className="text-[11px] text-gray-600">
          {state.consolidationCompanies.find(company => company.id === row.fromCompany)?.code ?? row.fromCompany}
          {' → '}
          {state.consolidationCompanies.find(company => company.id === row.toCompany)?.code ?? row.toCompany}
        </span>
      ),
    },
    { header: 'Cuenta', cell: row => <span className="font-mono text-[11px] text-gray-600">{row.account}</span> },
    { header: 'Débito', align: 'right', cell: row => <Money value={row.debit} /> },
    { header: 'Crédito', align: 'right', cell: row => <Money value={row.credit} /> },
    { header: 'Estado', cell: row => <Badge tone={STATUS_TONE[row.status]}>{row.status}</Badge> },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => (
        <Button size="sm" onClick={() => advance(row)} disabled={row.status === 'Revisada'}>
          {row.status === 'Pendiente' ? 'Aplicar' : row.status === 'Aplicada' ? 'Revisar' : 'Revisada'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total eliminado" value={<Money value={totalDebit} />} detail={`${rows.length} partidas`} tone="cyan" />
        <KpiCard label="Pendientes" value={String(pending.length)} detail={money(pending.reduce((total, row) => total + row.debit, 0))} tone={pending.length > 0 ? 'amber' : 'green'} />
        <KpiCard label="Aplicadas y revisadas" value={String(applied.length)} detail="Con trazabilidad" tone="green" />
        <KpiCard label="Diferencia débito/crédito" value={<Money value={difference} />} detail={Math.abs(difference) < 1 ? 'Partidas cuadradas' : 'Requiere revisión'} tone={Math.abs(difference) < 1 ? 'green' : 'red'} />
      </div>

      <Card>
        <SectionTitle
          title="Eliminaciones intercompañía"
          detail="Ventas, préstamos y servicios entre compañías del grupo"
          action={
            <Button variant="primary" onClick={generate}>
              <Icon name="plus" className="h-3.5 w-3.5" /> Generar eliminaciones
            </Button>
          }
        />
        <div className="p-4">
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={row => row.id}
            empty="No hay eliminaciones registradas."
            footer={
              <span className="text-[11px] text-gray-500">
                Generar eliminaciones toma los saldos intercompañía de las compañías incluidas. El corte es {HOY}.
              </span>
            }
          />
        </div>
      </Card>
    </div>
  );
}
