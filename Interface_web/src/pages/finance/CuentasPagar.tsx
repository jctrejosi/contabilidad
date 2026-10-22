import { useMemo, useState } from 'react';
import type { NavPage } from '../../components/Shell';
import Icon from '../../components/Icon';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
  Field,
  FilterBar,
  FilterSelect,
  INPUT,
  KpiCard,
  Modal,
  Money,
  PageHeader,
  SearchInput,
  SectionTitle,
  type Column,
} from '../../components/finance/ui';
import { FINANCIAL_MODULES } from '../../data/finance';
import { USUARIO } from '../../data/mock';
import { useFinance } from '../../finance/store';
import {
  AGING_BUCKETS,
  HOY,
  MESES_CORTOS,
  addDays,
  daysBetween,
  fmtDate,
  invoiceTotals,
  money,
  partyOf,
  payableAging,
  proposalTotal,
  statusTone,
  sum,
  type AgingBucket,
} from '../../finance/selectors';
import type {
  Advance,
  Expense,
  FinanceState,
  Invoice,
  Payable,
  Payment,
  PaymentProposal,
  Retention,
} from '../../finance/types';

interface Props {
  page: string;
  onNavigate: (page: NavPage) => void;
}

const MODULE = FINANCIAL_MODULES['cuentas-pagar'];
const MODULE_ID = 'cuentas-pagar' as const;
const SLUGS = MODULE.nav.map(item => item.slug);
const USERS = ['Laura Gómez', 'Carlos Pérez', 'María Restrepo'];

const HEADERS: Record<string, { title: string; subtitle: string }> = {
  obligaciones: {
    title: 'Bandeja de obligaciones',
    subtitle: 'Obligaciones con proveedores, retenciones, saldos y acciones de pago.',
  },
  propuestas: {
    title: 'Propuestas de pago',
    subtitle: 'Agrupación de obligaciones, aprobación segregada y ejecución del pago.',
  },
  pagos: {
    title: 'Pagos a proveedores',
    subtitle: 'Comprobantes registrados, cuentas de salida y aplicación a obligaciones.',
  },
  retenciones: {
    title: 'Retenciones y certificados',
    subtitle: 'Cálculo por concepto, período y emisión de certificados tributarios.',
  },
  anticipos: {
    title: 'Anticipos a proveedores',
    subtitle: 'Valores pagados por anticipado y aplicación contra obligaciones abiertas.',
  },
  programacion: {
    title: 'Edades y programación',
    subtitle: 'Aging de cuentas por pagar, proyección semanal y cola priorizada de pagos.',
  },
  'estados-cuenta': {
    title: 'Estados de cuenta',
    subtitle: 'Documentos, pagos y notas por proveedor con saldo corrido y resumen de vencimientos.',
  },
  gastos: {
    title: 'Gastos y reembolsos',
    subtitle: 'Soportes de empleados, aprobación y control de reembolsos.',
  },
  notas: {
    title: 'Notas de proveedor',
    subtitle: 'Notas crédito emitidas por proveedores y ajuste de la obligación asociada.',
  },
};

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function numberSequence(numbers: string[], pattern: RegExp): number {
  return Math.max(0, ...numbers.map(value => Number(value.match(pattern)?.[1] ?? 0)));
}

function nextPaymentNumber(state: FinanceState): string {
  return `PAG-${numberSequence(state.payments.map(payment => payment.number), /^PAG-(\d+)/) + 1}`;
}

function paymentSequence(state: FinanceState): number {
  return numberSequence(state.payments.map(payment => payment.number), /^PAG-(\d+)/);
}

function nextProposalNumber(state: FinanceState): string {
  const sequence = numberSequence(state.proposals.map(proposal => proposal.number), /^PROP-(\d+)/) + 1;
  return `PROP-${String(sequence).padStart(3, '0')}`;
}

function nextExpenseNumber(state: FinanceState): string {
  const sequence = numberSequence(state.expenses.map(expense => expense.number), /^GAS-(\d+)/) + 1;
  return `GAS-${String(sequence).padStart(4, '0')}`;
}

function nextAdvanceNumber(state: FinanceState): string {
  const sequence = numberSequence(
    state.advances.filter(advance => advance.direction === 'AP').map(advance => advance.number),
    /^ANT-P-(\d+)/,
  ) + 1;
  return `ANT-P-${String(sequence).padStart(4, '0')}`;
}

function nextCertificateNumber(state: FinanceState): string {
  const year = HOY.slice(0, 4);
  let sequence = 0;
  for (const retention of state.retentions) {
    const match = retention.certificateNumber.match(/^RET-(\d{4})-(\d+)$/);
    if (match && match[1] === year) sequence = Math.max(sequence, Number(match[2]));
  }
  return `RET-${year}-${String(sequence + 1).padStart(4, '0')}`;
}

function nextNoteNumber(state: FinanceState): { number: string; resolutionId: string; sequence: number } {
  const resolution = state.resolutions.find(item => item.prefix === 'NC' && item.active);
  const existing = state.invoices
    .filter(invoice => invoice.kind === 'NC')
    .map(invoice => Number(invoice.number.match(/(\d+)$/)?.[1] ?? 0));
  const maxExisting = Math.max(0, ...existing);
  const sequence = Math.max(resolution?.current ?? 0, maxExisting + 1, 1);
  return {
    number: `NC-${String(sequence).padStart(4, '0')}`,
    resolutionId: resolution?.id ?? '',
    sequence,
  };
}

function activeAccounts(state: FinanceState) {
  return state.accounts.filter(account => account.status === 'Activa');
}

function suppliers(state: FinanceState) {
  return state.parties.filter(party => party.kind !== 'Cliente');
}

function accountLabel(state: FinanceState, id: string): string {
  const account = state.accounts.find(item => item.id === id);
  return account ? `${account.bank} · ${account.number}` : 'Sin cuenta';
}

function priorityTone(priority: Payable['priority']): 'red' | 'amber' | 'gray' {
  if (priority === 'Alta') return 'red';
  if (priority === 'Media') return 'amber';
  return 'gray';
}

function priorityRank(priority: Payable['priority']): number {
  if (priority === 'Alta') return 0;
  if (priority === 'Media') return 1;
  return 2;
}

function dueLabel(dueDate: string): string {
  const days = daysBetween(HOY, dueDate);
  if (days < 0) return `Vencida ${Math.abs(days)} d`;
  if (days === 0) return 'Vence hoy';
  return `En ${days} d`;
}

function periodLabel(period: string): string {
  const [year, month] = period.split('-');
  const index = Number(month) - 1;
  return `${MESES_CORTOS[index] ?? month} ${year}`;
}

function inActiveProposal(state: FinanceState, payableId: string): boolean {
  return state.proposals.some(proposal => (
    (proposal.status === 'Borrador' || proposal.status === 'Pendiente aprobación' || proposal.status === 'Aprobada')
    && proposal.payableIds.includes(payableId)
  ));
}

function settlePayable(payable: Payable): void {
  if (payable.balance <= 0) {
    payable.balance = 0;
    payable.status = 'Pagada';
    return;
  }
  if (payable.status === 'En propuesta' || payable.status === 'Programada') return;
  payable.status = payable.dueDate < HOY ? 'Vencida' : 'Abierta';
}

function reopenPayable(payable: Payable): void {
  if (payable.balance <= 0) {
    payable.status = 'Pagada';
    return;
  }
  payable.status = payable.dueDate < HOY ? 'Vencida' : 'Abierta';
}

function proposalProviders(state: FinanceState, proposal: PaymentProposal): string[] {
  const names = proposal.payableIds
    .map(id => state.payables.find(payable => payable.id === id))
    .filter((payable): payable is Payable => payable !== undefined)
    .map(payable => partyOf(state, payable.partyId)?.name ?? 'Proveedor');
  return Array.from(new Set(names));
}

function addSupplierCreditNote(
  draft: FinanceState,
  payload: {
    invoiceId: string;
    amount: number;
    motive: string;
    number: string;
    resolutionId: string;
    sequence: number;
  },
): void {
  const original = draft.invoices.find(invoice => invoice.id === payload.invoiceId);
  const payable = draft.payables.find(item => item.invoiceId === payload.invoiceId);
  if (!original || !payable || payload.amount <= 0) return;

  const note: Invoice = {
    id: newId('inv'),
    kind: 'NC',
    number: payload.number,
    partyId: original.partyId,
    date: HOY,
    dueDate: HOY,
    paymentTerm: 0,
    status: 'Contabilizada',
    dianStatus: 'No aplica',
    cufe: '',
    resolutionId: payload.resolutionId,
    referenceId: original.id,
    motive: payload.motive,
    notes: 'Nota crédito de proveedor aplicada desde cuentas por pagar.',
    lines: [{
      id: newId('line'),
      productCode: 'NC-PROV',
      description: payload.motive,
      quantity: 1,
      price: payload.amount,
      discountPct: 0,
      taxRate: 0,
      withholdingRate: 0,
      account: '2205',
      costCenter: 'ADM',
    }],
    createdAt: HOY,
  };

  draft.invoices.unshift(note);
  const resolution = draft.resolutions.find(item => item.id === payload.resolutionId);
  if (resolution) resolution.current = Math.max(resolution.current, payload.sequence + 1);

  payable.balance = Math.max(0, payable.balance - payload.amount);
  settlePayable(payable);
}

export default function CuentasPagar({ page, onNavigate }: Props) {
  const slug = page.split('/')[1] ?? 'obligaciones';
  const activeSlug = SLUGS.includes(slug) ? slug : 'obligaciones';
  const [toast, setToast] = useState('');

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(''), 3500);
  }

  const header = HEADERS[activeSlug] ?? HEADERS.obligaciones;

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4 lg:p-5">
      <PageHeader eyebrow={MODULE.shortName} title={header.title} subtitle={header.subtitle} />

      {activeSlug === 'obligaciones' && <ObligacionesScreen onNavigate={onNavigate} showToast={showToast} />}
      {activeSlug === 'propuestas' && <ProposalsScreen showToast={showToast} />}
      {activeSlug === 'pagos' && <PaymentsScreen showToast={showToast} />}
      {activeSlug === 'retenciones' && <RetentionsScreen showToast={showToast} />}
      {activeSlug === 'anticipos' && <AdvancesScreen showToast={showToast} />}
      {activeSlug === 'programacion' && <SchedulingScreen onNavigate={onNavigate} showToast={showToast} />}
      {activeSlug === 'estados-cuenta' && <SupplierStatementScreen />}
      {activeSlug === 'gastos' && <ExpensesScreen showToast={showToast} />}
      {activeSlug === 'notas' && <SupplierNotesScreen showToast={showToast} />}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-xl bg-[#001F4C] px-4 py-3 text-xs text-white shadow-2xl">
          <Icon name="check" className="h-4 w-4 text-emerald-300" />
          {toast}
        </div>
      )}
    </div>
  );
}

function ObligacionesScreen({ onNavigate, showToast }: {
  onNavigate: (page: NavPage) => void;
  showToast: (text: string) => void;
}) {
  const { state, update } = useFinance();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  const selected = selectedId ? state.payables.find(payable => payable.id === selectedId) ?? null : null;
  const haystack = query.trim().toLowerCase();

  const kpis = useMemo(() => {
    const open = state.payables.filter(payable => payable.balance > 0);
    const limit = addDays(HOY, 7);
    const overdue = open.filter(payable => payable.dueDate < HOY);
    const nextSeven = open.filter(payable => payable.dueDate >= HOY && payable.dueDate <= limit);
    const month = HOY.slice(0, 7);
    const paid = state.payments.filter(payment => payment.status !== 'Anulado' && payment.date.startsWith(month));
    return {
      total: sum(open.map(payable => payable.balance)),
      openCount: open.length,
      overdue: sum(overdue.map(payable => payable.balance)),
      overdueCount: overdue.length,
      nextSeven: sum(nextSeven.map(payable => payable.balance)),
      nextSevenCount: nextSeven.length,
      paid: sum(paid.map(payment => payment.amount)),
      paidCount: paid.length,
    };
  }, [state.payables, state.payments]);

  const rows = useMemo(() => state.payables
    .filter(payable => status === 'Todos' || payable.status === status)
    .filter(payable => {
      if (haystack === '') return true;
      const party = partyOf(state, payable.partyId);
      return payable.invoiceNumber.toLowerCase().includes(haystack)
        || (party?.name.toLowerCase().includes(haystack) ?? false)
        || (party?.nit.toLowerCase().includes(haystack) ?? false)
        || payable.owner.toLowerCase().includes(haystack);
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [haystack, state, status]);

  const filteredBalance = sum(rows.map(row => row.balance));
  const filteredOverdue = sum(rows.filter(row => row.balance > 0 && row.dueDate < HOY).map(row => row.balance));

  const columns: Column<Payable>[] = [
    {
      header: 'Documento',
      cell: payable => <span className="font-mono font-semibold text-gray-800">{payable.invoiceNumber}</span>,
    },
    {
      header: 'Proveedor',
      cell: payable => {
        const party = partyOf(state, payable.partyId);
        return (
          <div className="max-w-56">
            <div className="truncate">{party?.name ?? 'Proveedor'}</div>
            <div className="text-[10px] text-gray-400">{payable.owner}</div>
          </div>
        );
      },
    },
    {
      header: 'NIT',
      cell: payable => <span className="font-mono text-[11px]">{partyOf(state, payable.partyId)?.nit ?? '—'}</span>,
    },
    { header: 'Emisión', cell: payable => fmtDate(payable.issueDate) },
    {
      header: 'Vencimiento',
      cell: payable => (
        <div>
          <div>{fmtDate(payable.dueDate)}</div>
          <div className={`text-[10px] ${payable.balance > 0 && payable.dueDate < HOY ? 'text-red-600' : 'text-gray-400'}`}>
            {payable.balance > 0 ? dueLabel(payable.dueDate) : 'Finalizada'}
          </div>
        </div>
      ),
    },
    { header: 'Bruto', align: 'right', cell: payable => <Money value={payable.original + payable.withholdings} /> },
    { header: 'Retenciones', align: 'right', cell: payable => <Money value={payable.withholdings} className="text-amber-700" /> },
    { header: 'Neto', align: 'right', cell: payable => <Money value={payable.original} className="font-semibold" /> },
    {
      header: 'Saldo',
      align: 'right',
      cell: payable => <Money value={payable.balance} className={payable.balance > 0 ? 'font-semibold' : 'text-gray-400'} />,
    },
    { header: 'Prioridad', cell: payable => <Badge tone={priorityTone(payable.priority)}>{payable.priority}</Badge> },
    { header: 'Estado', cell: payable => <Badge tone={statusTone(payable.status)}>{payable.status}</Badge> },
  ];

  function includeInProposal(payable: Payable) {
    if (payable.balance <= 0) {
      showToast('La obligación no tiene saldo pendiente.');
      return;
    }
    const active = state.proposals.find(proposal => (
      (proposal.status === 'Borrador' || proposal.status === 'Pendiente aprobación' || proposal.status === 'Aprobada')
      && proposal.payableIds.includes(payable.id)
    ));
    if (active) {
      showToast(`${payable.invoiceNumber} ya está incluida en ${active.number}.`);
      return;
    }
    const account = activeAccounts(state)[0];
    update(draft => {
      const target = draft.payables.find(item => item.id === payable.id);
      if (!target || target.balance <= 0) return;
      let proposal = draft.proposals.find(item => item.status === 'Borrador');
      if (!proposal) {
        proposal = {
          id: newId('prop'),
          number: nextProposalNumber(draft),
          date: HOY,
          cutoff: addDays(HOY, 7),
          payableIds: [],
          status: 'Borrador',
          createdBy: USUARIO.nombre,
          approvedBy: '',
          rejectedReason: '',
          note: 'Creada desde la bandeja de obligaciones.',
          accountId: account?.id ?? activeAccounts(draft)[0]?.id ?? '',
        };
        draft.proposals.unshift(proposal);
      }
      if (!proposal.payableIds.includes(target.id)) proposal.payableIds.push(target.id);
      target.status = 'En propuesta';
    }, `Obligación ${payable.invoiceNumber} incluida en propuesta`, MODULE_ID);
    showToast(`${payable.invoiceNumber} incluida en una propuesta de pago.`);
  }

  function registerPayment(payload: {
    amount: number;
    accountId: string;
    method: Payment['method'];
    reference: string;
    date: string;
  }) {
    if (!selected) return;
    const number = nextPaymentNumber(state);
    update(draft => {
      const target = draft.payables.find(item => item.id === selected.id);
      const account = draft.accounts.find(item => item.id === payload.accountId);
      if (!target || !account || payload.amount <= 0) return;
      const applied = Math.min(payload.amount, target.balance);
      target.balance = Math.max(0, target.balance - applied);
      settlePayable(target);
      account.balance = Math.max(0, account.balance - applied);
      draft.payments.unshift({
        id: newId('pay'),
        number,
        date: payload.date,
        partyId: target.partyId,
        accountId: payload.accountId,
        amount: applied,
        applied,
        method: payload.method,
        reference: payload.reference.trim() || `Pago ${target.invoiceNumber}`,
        status: 'Aplicado',
        applications: [{ payableId: target.id, amount: applied }],
      });
    }, `Pago ${number} aplicado a ${selected.invoiceNumber}`, MODULE_ID);
    setPayOpen(false);
    showToast(`${number} registrado por ${money(payload.amount)}.`);
  }

  function registerCreditNote(payload: { amount: number; motive: string }) {
    if (!selected) return;
    const { number, resolutionId, sequence } = nextNoteNumber(state);
    update(draft => {
      addSupplierCreditNote(draft, {
        invoiceId: selected.invoiceId,
        amount: payload.amount,
        motive: payload.motive,
        number,
        resolutionId,
        sequence,
      });
    }, `Nota crédito ${number} aplicada a ${selected.invoiceNumber}`, MODULE_ID);
    setNoteOpen(false);
    showToast(`Nota crédito ${number} aplicada. Saldo de la obligación actualizado.`);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total por pagar" value={money(kpis.total)} detail={`${kpis.openCount} obligaciones con saldo`} tone="violet" />
        <KpiCard label="Vencido" value={money(kpis.overdue)} detail={`${kpis.overdueCount} obligaci${kpis.overdueCount === 1 ? 'ón vencida' : 'ones vencidas'}`} tone="red" />
        <KpiCard label="Programado 7 días" value={money(kpis.nextSeven)} detail={`${kpis.nextSevenCount} obligaci${kpis.nextSevenCount === 1 ? 'ón por vencer' : 'ones por vencer'}`} tone="amber" />
        <KpiCard label="Pagado del mes" value={money(kpis.paid)} detail={`${kpis.paidCount} comprobante${kpis.paidCount === 1 ? '' : 's'} aplicado${kpis.paidCount === 1 ? '' : 's'}`} tone="green" />
      </div>

      <Card>
        <SectionTitle
          title="Obligaciones registradas"
          detail="El saldo neto descuenta retenciones y pagos aplicados. Seleccione una fila para gestionarla."
          action={(
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => onNavigate('cuentas-pagar/programacion')}>
                Ver programación
              </Button>
            </div>
          )}
        />
        <FilterBar>
          <SearchInput
            placeholder="Buscar documento, proveedor, NIT o responsable…"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <FilterSelect value={status} onChange={event => setStatus(event.target.value)} aria-label="Estado de la obligación">
            {['Todos', 'Abierta', 'En propuesta', 'Programada', 'Vencida', 'Pagada', 'En disputa'].map(value => (
              <option key={value}>{value}</option>
            ))}
          </FilterSelect>
        </FilterBar>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={row => row.id}
          onRowClick={row => setSelectedId(row.id)}
          empty="No hay obligaciones con los filtros aplicados."
          footer={(
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-600">
              <span>{rows.length} obligaciones · saldo {money(filteredBalance)}</span>
              <span>Vencido en la selección: <strong className="text-red-600">{money(filteredOverdue)}</strong></span>
            </div>
          )}
        />
      </Card>

      {selected && (
        <PayableDrawer
          state={state}
          payable={selected}
          onClose={() => setSelectedId(null)}
          onPay={() => setPayOpen(true)}
          onInclude={() => includeInProposal(selected)}
          onNote={() => setNoteOpen(true)}
          onSchedule={() => {
            setSelectedId(null);
            onNavigate('cuentas-pagar/programacion');
          }}
        />
      )}

      {selected && payOpen && (
        <PayablePaymentModal
          state={state}
          payable={selected}
          onClose={() => setPayOpen(false)}
          onSave={registerPayment}
        />
      )}

      {selected && noteOpen && (
        <SupplierCreditNoteModal
          payable={selected}
          onClose={() => setNoteOpen(false)}
          onSave={registerCreditNote}
        />
      )}
    </>
  );
}

function PayableDrawer({ state, payable, onClose, onPay, onInclude, onNote, onSchedule }: {
  state: FinanceState;
  payable: Payable;
  onClose: () => void;
  onPay: () => void;
  onInclude: () => void;
  onNote: () => void;
  onSchedule: () => void;
}) {
  const party = partyOf(state, payable.partyId);
  const appliedPayments = state.payments.flatMap(payment => payment.applications
    .filter(application => application.payableId === payable.id)
    .map(application => ({ payment, amount: application.amount })));
  const notes = state.invoices.filter(invoice => invoice.kind === 'NC' && invoice.referenceId === payable.invoiceId);
  const linkedProposals = state.proposals.filter(proposal => proposal.payableIds.includes(payable.id));
  const overdueDays = payable.balance > 0 && payable.dueDate < HOY ? daysBetween(payable.dueDate, HOY) : 0;

  return (
    <Drawer
      title={`${payable.invoiceNumber} · ${party?.name ?? 'Proveedor'}`}
      subtitle={`Obligación · emisión ${fmtDate(payable.issueDate)} · vence ${fmtDate(payable.dueDate)}`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone={statusTone(payable.status)}>{payable.status}</Badge>
          <Badge tone={priorityTone(payable.priority)}>Prioridad {payable.priority}</Badge>
          <Badge tone={payable.balance > 0 ? 'blue' : 'green'}>Saldo {money(payable.balance)}</Badge>
        </div>

        {overdueDays > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
            Obligación vencida hace {overdueDays} días. Requiere programación o pago inmediato.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs">
          <div><div className="text-[10px] text-gray-400">NIT</div><div className="font-mono">{party?.nit ?? '—'}</div></div>
          <div><div className="text-[10px] text-gray-400">Responsable</div><div>{payable.owner}</div></div>
          <div><div className="text-[10px] text-gray-400">Bruto</div><Money value={payable.original + payable.withholdings} /></div>
          <div><div className="text-[10px] text-gray-400">Retenciones</div><Money value={payable.withholdings} className="text-amber-700" /></div>
          <div><div className="text-[10px] text-gray-400">Neto</div><Money value={payable.original} /></div>
          <div><div className="text-[10px] text-gray-400">Saldo pendiente</div><Money value={payable.balance} className="font-semibold" /></div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold text-gray-700">Pagos aplicados</h3>
          <div className="space-y-2">
            {appliedPayments.length === 0 && <p className="text-[11px] text-gray-500">Sin pagos aplicados a esta obligación.</p>}
            {appliedPayments.map(({ payment, amount }) => (
              <div key={`${payment.id}-${amount}`} className="rounded-lg border border-gray-100 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-gray-700">{payment.number}</span>
                  <Badge tone={statusTone(payment.status)}>{payment.status}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-600">
                  <span>{fmtDate(payment.date)} · {accountLabel(state, payment.accountId)}</span>
                  <Money value={amount} className="font-semibold" />
                </div>
                {payment.reference && <p className="mt-1 text-[10px] text-gray-400">{payment.reference}</p>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold text-gray-700">Notas</h3>
          <div className="space-y-2">
            {notes.length === 0 && linkedProposals.length === 0 && (
              <p className="text-[11px] text-gray-500">Sin notas crédito ni propuestas asociadas.</p>
            )}
            {notes.map(note => (
              <div key={note.id} className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-[11px] text-violet-900">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold">{note.number}</span>
                  <span>{fmtDate(note.date)}</span>
                </div>
                <p className="mt-1">{note.motive}</p>
                <div className="mt-1 text-right font-semibold"><Money value={invoiceTotals(note).total} /></div>
              </div>
            ))}
            {linkedProposals.map(proposal => (
              <div key={proposal.id} className="rounded-lg border border-gray-100 px-3 py-2 text-[11px] text-gray-600">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-gray-700">{proposal.number}</span>
                  <Badge tone={statusTone(proposal.status)}>{proposal.status}</Badge>
                </div>
                <p className="mt-1">{proposal.note || 'Propuesta de pago sin nota adicional.'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          <Button variant="primary" disabled={payable.balance <= 0} onClick={onPay}>Pagar</Button>
          <Button variant="secondary" disabled={payable.balance <= 0} onClick={onInclude}>Incluir en propuesta</Button>
          <Button variant="secondary" disabled={payable.balance <= 0} onClick={onNote}>Emitir nota crédito</Button>
          <Button variant="ghost" onClick={onSchedule}>Ver programación</Button>
        </div>
      </div>
    </Drawer>
  );
}

function PayablePaymentModal({ state, payable, onClose, onSave }: {
  state: FinanceState;
  payable: Payable;
  onClose: () => void;
  onSave: (payload: {
    amount: number;
    accountId: string;
    method: Payment['method'];
    reference: string;
    date: string;
  }) => void;
}) {
  const accounts = activeAccounts(state);
  const [amount, setAmount] = useState(payable.balance);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [method, setMethod] = useState<Payment['method']>('Transferencia');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(HOY);
  const account = accounts.find(item => item.id === accountId);
  const valid = amount > 0
    && amount <= payable.balance + 0.01
    && accountId !== ''
    && date !== ''
    && (account?.balance ?? 0) + 0.01 >= amount;

  return (
    <Modal
      title={`Registrar pago · ${payable.invoiceNumber}`}
      subtitle={`${partyOf(state, payable.partyId)?.name ?? 'Proveedor'} · saldo ${money(payable.balance)}`}
      onClose={onClose}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Valor del pago">
          <input
            type="number"
            min={0}
            step="0.01"
            max={payable.balance}
            className={INPUT}
            value={amount}
            onChange={event => setAmount(Number(event.target.value))}
          />
        </Field>
        <Field label="Fecha del pago">
          <input type="date" className={INPUT} value={date} onChange={event => setDate(event.target.value)} />
        </Field>
        <Field label="Cuenta de salida">
          <select className={INPUT} value={accountId} onChange={event => setAccountId(event.target.value)}>
            {accounts.map(item => (
              <option key={item.id} value={item.id}>{item.bank} · {item.number} · {money(item.balance)}</option>
            ))}
          </select>
        </Field>
        <Field label="Método">
          <select className={INPUT} value={method} onChange={event => setMethod(event.target.value as Payment['method'])}>
            {['Transferencia', 'Cheque', 'Efectivo', 'ACH'].map(value => <option key={value}>{value}</option>)}
          </select>
        </Field>
        <Field label="Referencia" className="sm:col-span-2">
          <input className={INPUT} value={reference} onChange={event => setReference(event.target.value)} placeholder="Referencia bancaria o soporte del pago" />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setAmount(payable.balance)}>Saldo total</Button>
        <Button size="sm" variant="secondary" onClick={() => setAmount(payable.balance / 2)}>50 %</Button>
      </div>

      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
        <div className="flex justify-between"><span>Saldo de la obligación</span><Money value={payable.balance} /></div>
        <div className="mt-1 flex justify-between"><span>Saldo de la cuenta</span><Money value={account?.balance ?? 0} /></div>
        <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 font-semibold text-gray-800"><span>Saldo después del pago</span><Money value={Math.max(0, payable.balance - amount)} /></div>
      </div>

      {amount > payable.balance && <p className="mt-2 text-[11px] text-red-600">El valor no puede superar el saldo de la obligación.</p>}
      {account && amount > account.balance && <p className="mt-2 text-[11px] text-red-600">La cuenta seleccionada no tiene saldo suficiente.</p>}

      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave({ amount, accountId, method, reference, date })}>
          Registrar pago
        </Button>
      </div>
    </Modal>
  );
}

function SupplierCreditNoteModal({ payable, onClose, onSave }: {
  payable: Payable;
  onClose: () => void;
  onSave: (payload: { amount: number; motive: string }) => void;
}) {
  const [amount, setAmount] = useState(payable.balance);
  const [motive, setMotive] = useState('');
  const valid = amount > 0 && amount <= payable.balance + 0.01 && motive.trim().length >= 4;

  return (
    <Modal
      title={`Nota crédito de proveedor · ${payable.invoiceNumber}`}
      subtitle="La nota reduce el saldo de la obligación y queda registrada como factura NC del proveedor."
      onClose={onClose}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Valor de la nota" hint={`Máximo ${money(payable.balance)}`}>
          <input
            type="number"
            min={0}
            step="0.01"
            max={payable.balance}
            className={INPUT}
            value={amount}
            onChange={event => setAmount(Number(event.target.value))}
          />
        </Field>
        <Field label="Saldo actual">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
            <Money value={payable.balance} className="font-semibold" />
          </div>
        </Field>
        <Field label="Motivo" className="sm:col-span-2">
          <textarea
            className={`${INPUT} min-h-20`}
            value={motive}
            onChange={event => setMotive(event.target.value)}
            placeholder="Explique el ajuste del proveedor; quedará en la trazabilidad de la nota."
          />
        </Field>
      </div>
      {amount > payable.balance && <p className="mt-2 text-[11px] text-red-600">El valor no puede superar el saldo de la obligación.</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave({ amount, motive })}>Emitir nota</Button>
      </div>
    </Modal>
  );
}

function ProposalsScreen({ showToast }: { showToast: (text: string) => void }) {
  const { state, update } = useFinance();
  const [newOpen, setNewOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<PaymentProposal | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PaymentProposal | null>(null);

  const kpis = useMemo(() => {
    const pending = state.proposals.filter(proposal => proposal.status === 'Pendiente aprobación');
    const approved = state.proposals.filter(proposal => proposal.status === 'Aprobada');
    return {
      pendingCount: pending.length,
      pendingTotal: sum(pending.map(proposal => proposalTotal(state, proposal))),
      approvedCount: approved.length,
      approvedTotal: sum(approved.map(proposal => proposalTotal(state, proposal))),
      paidCount: state.proposals.filter(proposal => proposal.status === 'Pagada').length,
    };
  }, [state]);

  const rows = useMemo(() => [...state.proposals].sort((a, b) => b.number.localeCompare(a.number)), [state.proposals]);

  function createProposal(payload: {
    payableIds: string[];
    date: string;
    cutoff: string;
    accountId: string;
    note: string;
  }) {
    const number = nextProposalNumber(state);
    update(draft => {
      const ids = payload.payableIds.filter(id => {
        const payable = draft.payables.find(item => item.id === id);
        return payable !== undefined && payable.balance > 0;
      });
      if (ids.length === 0) return;
      draft.proposals.unshift({
        id: newId('prop'),
        number,
        date: payload.date,
        cutoff: payload.cutoff,
        payableIds: ids,
        status: 'Borrador',
        createdBy: USUARIO.nombre,
        approvedBy: '',
        rejectedReason: '',
        note: payload.note,
        accountId: payload.accountId,
      });
      for (const id of ids) {
        const payable = draft.payables.find(item => item.id === id);
        if (payable) payable.status = 'En propuesta';
      }
    }, `Propuesta ${number} creada con ${payload.payableIds.length} obligaciones`, MODULE_ID);
    setNewOpen(false);
    showToast(`Propuesta ${number} creada en borrador.`);
  }

  function sendToApproval(proposal: PaymentProposal) {
    if (proposal.payableIds.length === 0) {
      showToast('La propuesta no tiene obligaciones asociadas.');
      return;
    }
    update(draft => {
      const target = draft.proposals.find(item => item.id === proposal.id);
      if (!target || target.status !== 'Borrador') return;
      target.status = 'Pendiente aprobación';
      for (const id of target.payableIds) {
        const payable = draft.payables.find(item => item.id === id);
        if (payable && payable.balance > 0) payable.status = 'En propuesta';
      }
    }, `Propuesta ${proposal.number} enviada a aprobación`, MODULE_ID);
    showToast(`${proposal.number} enviada a aprobación.`);
  }

  function approveProposal(approver: string) {
    if (!approveTarget) return;
    if (!approver || approver === approveTarget.createdBy) {
      showToast('El aprobador debe ser distinto del creador de la propuesta.');
      return;
    }
    update(draft => {
      const target = draft.proposals.find(item => item.id === approveTarget.id);
      if (!target || target.status !== 'Pendiente aprobación') return;
      target.status = 'Aprobada';
      target.approvedBy = approver;
      target.rejectedReason = '';
      for (const id of target.payableIds) {
        const payable = draft.payables.find(item => item.id === id);
        if (payable && payable.balance > 0) payable.status = 'Programada';
      }
    }, `Propuesta ${approveTarget.number} aprobada por ${approver}`, MODULE_ID);
    setApproveTarget(null);
    showToast(`${approveTarget.number} aprobada por ${approver}.`);
  }

  function rejectProposal(reason: string) {
    if (!rejectTarget) return;
    if (reason.trim().length < 5) {
      showToast('Indique un motivo de rechazo de al menos 5 caracteres.');
      return;
    }
    update(draft => {
      const target = draft.proposals.find(item => item.id === rejectTarget.id);
      if (!target || target.status !== 'Pendiente aprobación') return;
      target.status = 'Rechazada';
      target.rejectedReason = reason.trim();
      target.approvedBy = '';
      for (const id of target.payableIds) {
        const payable = draft.payables.find(item => item.id === id);
        if (payable) reopenPayable(payable);
      }
    }, `Propuesta ${rejectTarget.number} rechazada`, MODULE_ID);
    setRejectTarget(null);
    showToast(`${rejectTarget.number} rechazada. Las obligaciones volvieron a la bandeja.`);
  }

  function executeProposal(proposal: PaymentProposal) {
    const total = proposalTotal(state, proposal);
    if (total <= 0) {
      showToast('La propuesta no tiene saldo pendiente por pagar.');
      return;
    }
    const account = state.accounts.find(item => item.id === proposal.accountId) ?? activeAccounts(state)[0];
    if (!account || account.status !== 'Activa') {
      showToast('La propuesta no tiene una cuenta de salida activa.');
      return;
    }
    if (account.balance + 0.01 < total) {
      showToast(`Saldo insuficiente en ${accountLabel(state, account.id)}. Requiere ${money(total)}.`);
      return;
    }

    const baseSequence = paymentSequence(state);
    update(draft => {
      const target = draft.proposals.find(item => item.id === proposal.id);
      const targetAccount = draft.accounts.find(item => item.id === account.id);
      if (!target || target.status !== 'Aprobada' || !targetAccount) return;

      const groups = new Map<string, Payable[]>();
      for (const id of target.payableIds) {
        const payable = draft.payables.find(item => item.id === id);
        if (!payable || payable.balance <= 0) continue;
        const list = groups.get(payable.partyId) ?? [];
        list.push(payable);
        groups.set(payable.partyId, list);
      }

      let offset = 1;
      let debited = 0;
      for (const [partyId, payables] of groups) {
        const amount = sum(payables.map(payable => payable.balance));
        const applications = payables.map(payable => ({ payableId: payable.id, amount: payable.balance }));
        draft.payments.unshift({
          id: newId('pay'),
          number: `PAG-${baseSequence + offset}`,
          date: HOY,
          partyId,
          accountId: targetAccount.id,
          amount,
          applied: amount,
          method: 'Transferencia',
          reference: `Pago propuesta ${target.number}`,
          status: 'Aplicado',
          applications,
        });
        for (const payable of payables) {
          payable.balance = 0;
          payable.status = 'Pagada';
        }
        debited += amount;
        offset += 1;
      }

      targetAccount.balance = Math.max(0, targetAccount.balance - debited);
      target.status = 'Pagada';
      target.approvedBy = target.approvedBy || 'Aprobación registrada';
    }, `Propuesta ${proposal.number} pagada por ${money(total)}`, MODULE_ID);
    showToast(`Propuesta ${proposal.number} ejecutada por ${money(total)}.`);
  }

  const columns: Column<PaymentProposal>[] = [
    { header: 'Número', cell: proposal => <span className="font-mono font-semibold text-gray-800">{proposal.number}</span> },
    { header: 'Fecha', cell: proposal => fmtDate(proposal.date) },
    { header: 'Corte', cell: proposal => fmtDate(proposal.cutoff) },
    {
      header: 'Proveedores',
      cell: proposal => {
        const names = proposalProviders(state, proposal);
        return (
          <div className="max-w-56">
            <div className="truncate">{names.join(', ') || 'Sin proveedores'}</div>
            <div className="text-[10px] text-gray-400">{proposal.payableIds.length} obligaciones</div>
          </div>
        );
      },
    },
    { header: 'Total', align: 'right', cell: proposal => <Money value={proposalTotal(state, proposal)} className="font-semibold" /> },
    { header: 'Estado', cell: proposal => <Badge tone={statusTone(proposal.status)}>{proposal.status}</Badge> },
    { header: 'Creador', cell: proposal => proposal.createdBy || '—' },
    { header: 'Aprobador', cell: proposal => proposal.approvedBy || '—' },
    {
      header: 'Acciones',
      align: 'right',
      cell: proposal => (
        <div className="flex justify-end gap-1.5">
          {proposal.status === 'Borrador' && (
            <Button size="sm" variant="primary" onClick={() => sendToApproval(proposal)}>Enviar</Button>
          )}
          {proposal.status === 'Pendiente aprobación' && (
            <>
              <Button size="sm" variant="success" onClick={() => setApproveTarget(proposal)}>Aprobar</Button>
              <Button size="sm" variant="danger" onClick={() => setRejectTarget(proposal)}>Rechazar</Button>
            </>
          )}
          {proposal.status === 'Aprobada' && (
            <Button size="sm" variant="success" onClick={() => executeProposal(proposal)}>Ejecutar pago</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Por aprobar" value={String(kpis.pendingCount)} detail={money(kpis.pendingTotal)} tone="amber" />
        <KpiCard label="Aprobadas" value={String(kpis.approvedCount)} detail={money(kpis.approvedTotal)} tone="blue" />
        <KpiCard label="Pagadas" value={String(kpis.paidCount)} detail="Propuestas ejecutadas" tone="green" />
        <KpiCard label="Propuestas totales" value={String(state.proposals.length)} detail="Histórico del módulo" tone="violet" />
      </div>

      <Card>
        <SectionTitle
          title="Propuestas de pago"
          detail="El creador no puede aprobar su propia propuesta. La ejecución genera comprobantes por proveedor."
          action={(
            <Button variant="primary" size="sm" onClick={() => setNewOpen(true)}>
              <Icon name="plus" className="h-3.5 w-3.5" /> Nueva propuesta
            </Button>
          )}
        />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={row => row.id}
          empty="No hay propuestas de pago registradas."
        />
      </Card>

      {newOpen && (
        <NewProposalModal
          state={state}
          onClose={() => setNewOpen(false)}
          onSave={createProposal}
        />
      )}

      {approveTarget && (
        <ApproveProposalModal
          state={state}
          proposal={approveTarget}
          onClose={() => setApproveTarget(null)}
          onSave={approveProposal}
        />
      )}

      {rejectTarget && (
        <RejectProposalModal
          proposal={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onSave={rejectProposal}
        />
      )}
    </>
  );
}

function NewProposalModal({ state, onClose, onSave }: {
  state: FinanceState;
  onClose: () => void;
  onSave: (payload: {
    payableIds: string[];
    date: string;
    cutoff: string;
    accountId: string;
    note: string;
  }) => void;
}) {
  const accounts = activeAccounts(state);
  const eligible = state.payables
    .filter(payable => payable.balance > 0 && !inActiveProposal(state, payable.id))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [date, setDate] = useState(HOY);
  const [cutoff, setCutoff] = useState(addDays(HOY, 7));
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [note, setNote] = useState('');
  const selected = eligible.filter(payable => selectedIds.includes(payable.id));
  const total = sum(selected.map(payable => payable.balance));
  const account = accounts.find(item => item.id === accountId);
  const valid = selected.length > 0 && accountId !== '' && date !== '' && cutoff >= date;

  function toggle(id: string) {
    setSelectedIds(current => current.includes(id)
      ? current.filter(value => value !== id)
      : [...current, id]);
  }

  return (
    <Modal
      title="Nueva propuesta de pago"
      subtitle="Seleccione obligaciones abiertas no incluidas en otra propuesta vigente."
      onClose={onClose}
      wide
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fecha de la propuesta">
              <input type="date" className={INPUT} value={date} onChange={event => setDate(event.target.value)} />
            </Field>
            <Field label="Fecha de corte">
              <input type="date" className={INPUT} value={cutoff} onChange={event => setCutoff(event.target.value)} />
            </Field>
            <Field label="Cuenta de salida">
              <select className={INPUT} value={accountId} onChange={event => setAccountId(event.target.value)}>
                {accounts.map(item => (
                  <option key={item.id} value={item.id}>{item.bank} · {item.number} · {money(item.balance)}</option>
                ))}
              </select>
            </Field>
            <Field label="Nota">
              <input className={INPUT} value={note} onChange={event => setNote(event.target.value)} placeholder="Motivo o alcance de la propuesta" />
            </Field>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
              <span className="text-xs font-semibold text-gray-700">Obligaciones disponibles</span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds(eligible.map(payable => payable.id))}>Seleccionar todas</Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Limpiar</Button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead className="border-b border-gray-100 bg-white text-gray-500">
                  <tr>
                    <th className="w-8 px-2 py-2" />
                    <th className="px-2 py-2 text-left">Documento</th>
                    <th className="px-2 py-2 text-left">Proveedor</th>
                    <th className="px-2 py-2 text-left">Vence</th>
                    <th className="px-2 py-2 text-right">Saldo</th>
                    <th className="px-2 py-2 text-left">Prioridad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {eligible.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No hay obligaciones abiertas disponibles.</td></tr>
                  )}
                  {eligible.map(payable => (
                    <tr
                      key={payable.id}
                      className="cursor-pointer hover:bg-petroleum-50/50"
                      onClick={() => toggle(payable.id)}
                    >
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(payable.id)}
                          onChange={() => toggle(payable.id)}
                          onClick={event => event.stopPropagation()}
                        />
                      </td>
                      <td className="px-2 py-2 font-mono font-semibold">{payable.invoiceNumber}</td>
                      <td className="max-w-48 truncate px-2 py-2">{partyOf(state, payable.partyId)?.name ?? 'Proveedor'}</td>
                      <td className="px-2 py-2">{fmtDate(payable.dueDate)}</td>
                      <td className="px-2 py-2 text-right"><Money value={payable.balance} /></td>
                      <td className="px-2 py-2"><Badge tone={priorityTone(payable.priority)}>{payable.priority}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-xs font-semibold text-gray-700">Resumen</h3>
          <dl className="mt-3 space-y-2 text-[11px]">
            <div className="flex justify-between"><dt className="text-gray-500">Obligaciones</dt><dd>{selected.length}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Total propuesto</dt><dd><Money value={total} className="font-semibold" /></dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Saldo de la cuenta</dt><dd><Money value={account?.balance ?? 0} /></dd></div>
            <div className="flex justify-between border-t border-gray-200 pt-2"><dt className="text-gray-500">Diferencia</dt><dd><Money value={(account?.balance ?? 0) - total} /></dd></div>
          </dl>
          <div className="mt-3 rounded-lg bg-white p-2.5 text-[10px] leading-4 text-gray-500">
            La propuesta nace en borrador. La aprobación debe realizarla un usuario distinto del creador.
          </div>
          <div className="mt-4 space-y-2">
            <Button variant="primary" className="w-full" disabled={!valid} onClick={() => onSave({ payableIds: selectedIds, date, cutoff, accountId, note })}>
              Crear propuesta
            </Button>
            <Button variant="secondary" className="w-full" onClick={onClose}>Cancelar</Button>
          </div>
        </aside>
      </div>
    </Modal>
  );
}

function ApproveProposalModal({ state, proposal, onClose, onSave }: {
  state: FinanceState;
  proposal: PaymentProposal;
  onClose: () => void;
  onSave: (approver: string) => void;
}) {
  const candidates = Array.from(new Set([USUARIO.nombre, ...USERS])).filter(name => name !== proposal.createdBy);
  const [approver, setApprover] = useState(candidates[0] ?? '');
  const total = proposalTotal(state, proposal);
  const valid = approver !== '' && approver !== proposal.createdBy;

  return (
    <Modal
      title={`Aprobar ${proposal.number}`}
      subtitle="Aplicación del principio de segregación de funciones."
      onClose={onClose}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Creador">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">{proposal.createdBy}</div>
        </Field>
        <Field label="Aprobador">
          <select className={INPUT} value={approver} onChange={event => setApprover(event.target.value)}>
            {candidates.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
        <Field label="Valor de la propuesta">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs"><Money value={total} /></div>
        </Field>
        <Field label="Cuenta de salida">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">{accountLabel(state, proposal.accountId)}</div>
        </Field>
      </div>
      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
        El aprobador seleccionado no puede ser el creador de la propuesta.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="success" disabled={!valid} onClick={() => onSave(approver)}>Aprobar propuesta</Button>
      </div>
    </Modal>
  );
}

function RejectProposalModal({ proposal, onClose, onSave }: {
  proposal: PaymentProposal;
  onClose: () => void;
  onSave: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= 5;

  return (
    <Modal
      title={`Rechazar ${proposal.number}`}
      subtitle="El motivo es obligatorio y quedará registrado en la propuesta."
      onClose={onClose}
    >
      <Field label="Motivo del rechazo">
        <textarea
          className={`${INPUT} min-h-24`}
          value={reason}
          onChange={event => setReason(event.target.value)}
          placeholder="Indique por qué no se aprueba la propuesta"
        />
      </Field>
      {!valid && reason.length > 0 && <p className="mt-2 text-[11px] text-red-600">El motivo debe tener al menos 5 caracteres.</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="danger" disabled={!valid} onClick={() => onSave(reason)}>Rechazar propuesta</Button>
      </div>
    </Modal>
  );
}

function PaymentsScreen({ showToast }: { showToast: (text: string) => void }) {
  const { state, update } = useFinance();
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => [...state.payments].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    return byDate !== 0 ? byDate : b.number.localeCompare(a.number);
  }), [state.payments]);

  const month = HOY.slice(0, 7);
  const paidMonth = state.payments.filter(payment => payment.status !== 'Anulado' && payment.date.startsWith(month));
  const totalMonth = sum(paidMonth.map(payment => payment.amount));
  const totalApplied = sum(state.payments.filter(payment => payment.status === 'Aplicado').map(payment => payment.applied));

  const columns: Column<Payment>[] = [
    { header: 'Número', cell: payment => <span className="font-mono font-semibold text-gray-800">{payment.number}</span> },
    { header: 'Fecha', cell: payment => fmtDate(payment.date) },
    {
      header: 'Proveedor',
      cell: payment => <span className="block max-w-56 truncate">{partyOf(state, payment.partyId)?.name ?? 'Proveedor'}</span>,
    },
    { header: 'Cuenta', cell: payment => <span className="text-[11px]">{accountLabel(state, payment.accountId)}</span> },
    { header: 'Valor', align: 'right', cell: payment => <Money value={payment.amount} className="font-semibold" /> },
    { header: 'Aplicado', align: 'right', cell: payment => <Money value={payment.applied} /> },
    { header: 'Método', cell: payment => payment.method },
    {
      header: 'Referencia',
      cell: payment => <span className="block max-w-48 truncate text-gray-500">{payment.reference || '—'}</span>,
    },
    { header: 'Estado', cell: payment => <Badge tone={statusTone(payment.status)}>{payment.status}</Badge> },
  ];

  function registerPayment(payload: {
    partyId: string;
    accountId: string;
    amount: number;
    method: Payment['method'];
    reference: string;
    date: string;
    applications: { payableId: string; amount: number }[];
  }) {
    const number = nextPaymentNumber(state);
    update(draft => {
      const account = draft.accounts.find(item => item.id === payload.accountId);
      if (!account) return;
      const applications: { payableId: string; amount: number }[] = [];
      for (const application of payload.applications) {
        const payable = draft.payables.find(item => item.id === application.payableId);
        if (!payable || application.amount <= 0) continue;
        const amount = Math.min(application.amount, payable.balance);
        if (amount <= 0) continue;
        payable.balance = Math.max(0, payable.balance - amount);
        settlePayable(payable);
        applications.push({ payableId: payable.id, amount });
      }
      const applied = sum(applications.map(application => application.amount));
      if (applied <= 0) return;
      account.balance = Math.max(0, account.balance - applied);
      draft.payments.unshift({
        id: newId('pay'),
        number,
        date: payload.date,
        partyId: payload.partyId,
        accountId: payload.accountId,
        amount: applied,
        applied,
        method: payload.method,
        reference: payload.reference.trim() || 'Pago a proveedor',
        status: 'Aplicado',
        applications,
      });
    }, `Pago ${number} registrado`, MODULE_ID);
    setOpen(false);
    showToast(`${number} registrado y aplicado por ${money(payload.amount)}.`);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Pagos registrados" value={String(state.payments.length)} detail="Histórico de comprobantes" tone="violet" />
        <KpiCard label="Pagado del mes" value={money(totalMonth)} detail={`${paidMonth.length} comprobantes`} tone="green" />
        <KpiCard label="Total aplicado" value={money(totalApplied)} detail="A obligaciones de proveedores" tone="blue" />
        <KpiCard label="Cuentas activas" value={String(activeAccounts(state).length)} detail={money(sum(activeAccounts(state).map(account => account.balance)))} tone="cyan" />
      </div>

      <Card>
        <SectionTitle
          title="Comprobantes de pago"
          detail="Cada pago descuenta la cuenta de salida y actualiza el saldo de las obligaciones aplicadas."
          action={(
            <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
              <Icon name="plus" className="h-3.5 w-3.5" /> Registrar pago
            </Button>
          )}
        />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={row => row.id}
          empty="No hay pagos registrados."
        />
      </Card>

      {open && (
        <RegisterPaymentModal
          state={state}
          onClose={() => setOpen(false)}
          onSave={registerPayment}
        />
      )}
    </>
  );
}

function RegisterPaymentModal({ state, onClose, onSave }: {
  state: FinanceState;
  onClose: () => void;
  onSave: (payload: {
    partyId: string;
    accountId: string;
    amount: number;
    method: Payment['method'];
    reference: string;
    date: string;
    applications: { payableId: string; amount: number }[];
  }) => void;
}) {
  const available = state.payables.filter(payable => payable.balance > 0 && !inActiveProposal(state, payable.id));
  const supplierList = suppliers(state).filter(party => available.some(payable => payable.partyId === party.id));
  const accounts = activeAccounts(state);
  const [partyId, setPartyId] = useState(supplierList[0]?.id ?? '');
  const [date, setDate] = useState(HOY);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<Payment['method']>('Transferencia');
  const [reference, setReference] = useState('');
  const [applications, setApplications] = useState<Record<string, number>>({});

  const payables = available
    .filter(payable => payable.partyId === partyId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const account = accounts.find(item => item.id === accountId);
  const appliedTotal = sum(Object.values(applications));
  const selectedCount = Object.keys(applications).length;
  const valid = partyId !== ''
    && accountId !== ''
    && date !== ''
    && amount > 0
    && selectedCount > 0
    && Math.abs(appliedTotal - amount) < 0.01
    && (account?.balance ?? 0) + 0.01 >= amount;

  function changeParty(id: string) {
    setPartyId(id);
    setApplications({});
    setAmount(0);
  }

  function toggle(payable: Payable) {
    const next = { ...applications };
    if (next[payable.id] !== undefined) delete next[payable.id];
    else next[payable.id] = payable.balance;
    setApplications(next);
    setAmount(sum(Object.values(next)));
  }

  function updateApplication(payable: Payable, value: number) {
    const safe = Math.max(0, Math.min(value, payable.balance));
    const next = { ...applications, [payable.id]: safe };
    setApplications(next);
    setAmount(sum(Object.values(next)));
  }

  function distribute() {
    let remaining = amount;
    const next: Record<string, number> = {};
    for (const payable of payables) {
      if (applications[payable.id] === undefined || remaining <= 0) continue;
      const value = Math.min(payable.balance, remaining);
      if (value > 0) next[payable.id] = value;
      remaining -= value;
    }
    setApplications(next);
  }

  return (
    <Modal
      title="Registrar pago a proveedor"
      subtitle="Distribuya el valor del pago entre las obligaciones abiertas del proveedor."
      onClose={onClose}
      wide
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Proveedor">
              <select className={INPUT} value={partyId} onChange={event => changeParty(event.target.value)}>
                {supplierList.map(party => <option key={party.id} value={party.id}>{party.name} · {party.nit}</option>)}
              </select>
            </Field>
            <Field label="Fecha del pago">
              <input type="date" className={INPUT} value={date} onChange={event => setDate(event.target.value)} />
            </Field>
            <Field label="Cuenta de salida">
              <select className={INPUT} value={accountId} onChange={event => setAccountId(event.target.value)}>
                {accounts.map(item => (
                  <option key={item.id} value={item.id}>{item.bank} · {item.number} · {money(item.balance)}</option>
                ))}
              </select>
            </Field>
            <Field label="Valor del pago">
              <input
                type="number"
                min={0}
                step="0.01"
                className={INPUT}
                value={amount}
                onChange={event => setAmount(Number(event.target.value))}
              />
            </Field>
            <Field label="Método">
              <select className={INPUT} value={method} onChange={event => setMethod(event.target.value as Payment['method'])}>
                {['Transferencia', 'Cheque', 'Efectivo', 'ACH'].map(value => <option key={value}>{value}</option>)}
              </select>
            </Field>
            <Field label="Referencia">
              <input className={INPUT} value={reference} onChange={event => setReference(event.target.value)} placeholder="Referencia bancaria" />
            </Field>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
              <span className="text-xs font-semibold text-gray-700">Obligaciones a aplicar</span>
              <Button size="sm" variant="ghost" onClick={distribute} disabled={!amount || selectedCount === 0}>Distribuir valor</Button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-[11px] lg:min-w-[34rem]">
                <thead className="border-b border-gray-100 bg-white text-gray-500">
                  <tr>
                    <th className="w-8 px-2 py-2" />
                    <th className="px-2 py-2 text-left">Documento</th>
                    <th className="px-2 py-2 text-left">Vence</th>
                    <th className="px-2 py-2 text-right">Saldo</th>
                    <th className="px-2 py-2 text-right">Aplicar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payables.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">El proveedor no tiene obligaciones abiertas disponibles.</td></tr>
                  )}
                  {payables.map(payable => {
                    const active = applications[payable.id] !== undefined;
                    return (
                      <tr key={payable.id} className="hover:bg-petroleum-50/50">
                        <td className="px-2 py-2">
                          <input type="checkbox" checked={active} onChange={() => toggle(payable)} />
                        </td>
                        <td className="px-2 py-2 font-mono font-semibold">{payable.invoiceNumber}</td>
                        <td className="px-2 py-2">{fmtDate(payable.dueDate)}</td>
                        <td className="px-2 py-2 text-right"><Money value={payable.balance} /></td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            max={payable.balance}
                            step="0.01"
                            disabled={!active}
                            className={`${INPUT} w-28 text-right`}
                            value={applications[payable.id] ?? 0}
                            onChange={event => updateApplication(payable, Number(event.target.value))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-xs font-semibold text-gray-700">Resumen del pago</h3>
          <dl className="mt-3 space-y-2 text-[11px] ">
            <div className="flex justify-between"><dt className="text-gray-500">Obligaciones</dt><dd>{selectedCount}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Valor del pago</dt><dd><Money value={amount} className="font-semibold" /></dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Total aplicado</dt><dd><Money value={appliedTotal} /></dd></div>
            <div className="flex justify-between border-t border-gray-200 pt-2"><dt className="text-gray-500">Por aplicar</dt><dd><Money value={amount - appliedTotal} /></dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Saldo de la cuenta</dt><dd><Money value={account?.balance ?? 0} /></dd></div>
          </dl>
          <div className="mt-3 rounded-lg bg-white p-2.5 text-[10px] leading-4 text-gray-500">
            El pago debe quedar totalmente aplicado. Las obligaciones incluidas en propuestas vigentes no aparecen aquí.
          </div>
          {Math.abs(appliedTotal - amount) >= 0.01 && amount > 0 && (
            <p className="mt-2 text-[11px] text-amber-700">La suma aplicada debe coincidir con el valor del pago.</p>
          )}
          {account && amount > account.balance && (
            <p className="mt-2 text-[11px] text-red-600">La cuenta seleccionada no tiene saldo suficiente.</p>
          )}
          <div className="mt-4 space-y-2">
            <Button
              variant="primary"
              className="w-full"
              disabled={!valid}
              onClick={() => onSave({
                partyId,
                accountId,
                amount: appliedTotal,
                method,
                reference,
                date,
                applications: Object.entries(applications)
                  .filter(([, value]) => value > 0)
                  .map(([payableId, value]) => ({ payableId, amount: value })),
              })}
            >
              Registrar pago
            </Button>
            <Button variant="secondary" className="w-full" onClick={onClose}>Cancelar</Button>
          </div>
        </aside>
      </div>
    </Modal>
  );
}

function RetentionsScreen({ showToast }: { showToast: (text: string) => void }) {
  const { state, update } = useFinance();
  const [period, setPeriod] = useState('Todos');
  const periods = useMemo(() => Array.from(new Set(state.retentions.map(retention => retention.period))).sort().reverse(), [state.retentions]);
  const rows = useMemo(() => state.retentions
    .filter(retention => period === 'Todos' || retention.period === period)
    .sort((a, b) => b.date.localeCompare(a.date)), [period, state.retentions]);
  const totalRetained = sum(rows.map(retention => retention.amount));
  const totalCertified = sum(rows.filter(retention => retention.status === 'Certificada').map(retention => retention.amount));

  function certify(retention: Retention) {
    if (retention.status === 'Certificada') return;
    const certificate = nextCertificateNumber(state);
    update(draft => {
      const target = draft.retentions.find(item => item.id === retention.id);
      if (!target || target.status === 'Certificada') return;
      target.certificateNumber = certificate;
      target.status = 'Certificada';
    }, `Certificado ${certificate} emitido`, MODULE_ID);
    showToast(`Certificado ${certificate} emitido a ${partyOf(state, retention.partyId)?.name ?? 'proveedor'}.`);
  }

  function exportCsv() {
    if (rows.length === 0) {
      showToast('No hay retenciones para exportar con el período seleccionado.');
      return;
    }
    const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const header = ['Proveedor', 'Documento', 'Concepto', 'Base', 'Tarifa', 'Valor', 'Período', 'Certificado', 'Estado'];
    const lines = rows.map(retention => {
      const invoice = state.invoices.find(item => item.id === retention.invoiceId);
      return [
        partyOf(state, retention.partyId)?.name ?? 'Proveedor',
        invoice?.number ?? '—',
        retention.concept,
        retention.base,
        retention.rate,
        retention.amount,
        retention.period,
        retention.certificateNumber || 'Sin certificar',
        retention.status,
      ].map(escape).join(';');
    });
    const blob = new Blob([`\uFEFF${header.map(escape).join(';')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `retenciones-${period === 'Todos' ? 'todos' : period}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`Exportación generada con ${rows.length} retenciones.`);
  }

  const columns: Column<Retention>[] = [
    {
      header: 'Proveedor',
      cell: retention => <span className="block max-w-56 truncate">{partyOf(state, retention.partyId)?.name ?? 'Proveedor'}</span>,
    },
    {
      header: 'Documento',
      cell: retention => <span className="font-mono">{state.invoices.find(invoice => invoice.id === retention.invoiceId)?.number ?? '—'}</span>,
    },
    { header: 'Concepto', cell: retention => retention.concept },
    { header: 'Base', align: 'right', cell: retention => <Money value={retention.base} /> },
    { header: 'Tarifa', align: 'right', cell: retention => `${retention.rate} %` },
    { header: 'Valor', align: 'right', cell: retention => <Money value={retention.amount} className="font-semibold" /> },
    { header: 'Período', cell: retention => periodLabel(retention.period) },
    {
      header: 'Certificado',
      cell: retention => retention.certificateNumber
        ? <span className="font-mono text-[11px]">{retention.certificateNumber}</span>
        : <span className="text-gray-400">Sin certificar</span>,
    },
    {
      header: 'Estado',
      cell: retention => <Badge tone={retention.status === 'Certificada' ? 'green' : 'amber'}>{retention.status}</Badge>,
    },
    {
      header: 'Acciones',
      align: 'right',
      cell: retention => retention.status === 'Certificada'
        ? <span className="text-[10px] text-gray-400">Certificada</span>
        : <Button size="sm" variant="primary" onClick={() => certify(retention)}>Certificar</Button>,
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total retenido" value={money(totalRetained)} detail={`${rows.length} retenciones en el filtro`} tone="violet" />
        <KpiCard label="Certificado" value={money(totalCertified)} detail={`${rows.filter(retention => retention.status === 'Certificada').length} certificados emitidos`} tone="green" />
        <KpiCard label="Por certificar" value={money(totalRetained - totalCertified)} detail="Pendiente de emisión" tone="amber" />
        <KpiCard label="Períodos" value={String(periods.length)} detail="Histórico disponible" tone="blue" />
      </div>

      <Card>
        <SectionTitle
          title="Retenciones calculadas"
          detail="La certificación asigna un consecutivo RET-AAAA-0000 y deja el certificado disponible para el proveedor."
          action={(
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelect value={period} onChange={event => setPeriod(event.target.value)} aria-label="Período de retención">
                <option value="Todos">Todos los períodos</option>
                {periods.map(value => <option key={value} value={value}>{periodLabel(value)}</option>)}
              </FilterSelect>
              <Button size="sm" variant="secondary" onClick={exportCsv}>
                <Icon name="download" className="h-3.5 w-3.5" /> Exportar
              </Button>
            </div>
          )}
        />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={row => row.id}
          empty="No hay retenciones para el período seleccionado."
        />
      </Card>
    </>
  );
}

function AdvancesScreen({ showToast }: { showToast: (text: string) => void }) {
  const { state, update } = useFinance();
  const [open, setOpen] = useState(false);
  const [applyTarget, setApplyTarget] = useState<Advance | null>(null);
  const rows = useMemo(() => state.advances
    .filter(advance => advance.direction === 'AP')
    .sort((a, b) => b.date.localeCompare(a.date)), [state.advances]);
  const total = sum(rows.map(advance => advance.amount));
  const applied = sum(rows.map(advance => advance.applied));

  function registerAdvance(payload: { partyId: string; date: string; amount: number; reference: string }) {
    const number = nextAdvanceNumber(state);
    update(draft => {
      draft.advances.unshift({
        id: newId('adv'),
        number,
        partyId: payload.partyId,
        date: payload.date,
        amount: payload.amount,
        applied: 0,
        reference: payload.reference.trim() || 'Anticipo a proveedor',
        direction: 'AP',
      });
    }, `Anticipo ${number} registrado`, MODULE_ID);
    setOpen(false);
    showToast(`${number} registrado por ${money(payload.amount)}.`);
  }

  function applyAdvance(payload: { payableId: string; amount: number }) {
    if (!applyTarget) return;
    update(draft => {
      const advance = draft.advances.find(item => item.id === applyTarget.id);
      const payable = draft.payables.find(item => item.id === payload.payableId);
      if (!advance || !payable) return;
      const available = Math.max(0, advance.amount - advance.applied);
      const amount = Math.min(payload.amount, available, payable.balance);
      if (amount <= 0) return;
      advance.applied = Math.min(advance.amount, advance.applied + amount);
      payable.balance = Math.max(0, payable.balance - amount);
      settlePayable(payable);
    }, `Anticipo ${applyTarget.number} aplicado a obligación`, MODULE_ID);
    setApplyTarget(null);
    showToast(`Anticipo ${applyTarget.number} aplicado por ${money(payload.amount)}.`);
  }

  const columns: Column<Advance>[] = [
    {
      header: 'Proveedor',
      cell: advance => <span className="block max-w-56 truncate">{partyOf(state, advance.partyId)?.name ?? 'Proveedor'}</span>,
    },
    { header: 'Número', cell: advance => <span className="font-mono font-semibold">{advance.number}</span> },
    { header: 'Fecha', cell: advance => fmtDate(advance.date) },
    { header: 'Valor', align: 'right', cell: advance => <Money value={advance.amount} /> },
    { header: 'Aplicado', align: 'right', cell: advance => <Money value={advance.applied} /> },
    {
      header: 'Saldo',
      align: 'right',
      cell: advance => <Money value={Math.max(0, advance.amount - advance.applied)} className="font-semibold" />,
    },
    {
      header: 'Estado',
      cell: advance => {
        const balance = advance.amount - advance.applied;
        if (balance <= 0) return <Badge tone="green">Aplicado</Badge>;
        if (advance.applied > 0) return <Badge tone="amber">Parcial</Badge>;
        return <Badge tone="blue">Disponible</Badge>;
      },
    },
    {
      header: 'Acciones',
      align: 'right',
      cell: advance => advance.amount - advance.applied > 0
        ? <Button size="sm" variant="secondary" onClick={() => setApplyTarget(advance)}>Aplicar</Button>
        : <span className="text-[10px] text-gray-400">Sin saldo</span>,
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Anticipos registrados" value={String(rows.length)} detail="Anticipos por pagar a proveedores" tone="violet" />
        <KpiCard label="Total anticipado" value={money(total)} detail="Valor entregado a proveedores" tone="blue" />
        <KpiCard label="Aplicado" value={money(applied)} detail="Contra obligaciones" tone="green" />
        <KpiCard label="Saldo disponible" value={money(Math.max(0, total - applied))} detail="Pendiente de aplicar" tone="amber" />
      </div>

      <Card>
        <SectionTitle
          title="Anticipos a proveedores"
          detail="El anticipo aplicado reduce la obligación del mismo proveedor sin generar una nueva salida de tesorería."
          action={(
            <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
              <Icon name="plus" className="h-3.5 w-3.5" /> Registrar anticipo
            </Button>
          )}
        />
        <DataTable columns={columns} rows={rows} rowKey={row => row.id} empty="No hay anticipos a proveedores registrados." />
      </Card>

      {open && (
        <RegisterAdvanceModal state={state} onClose={() => setOpen(false)} onSave={registerAdvance} />
      )}
      {applyTarget && (
        <ApplyAdvanceModal state={state} advance={applyTarget} onClose={() => setApplyTarget(null)} onSave={applyAdvance} />
      )}
    </>
  );
}

function RegisterAdvanceModal({ state, onClose, onSave }: {
  state: FinanceState;
  onClose: () => void;
  onSave: (payload: { partyId: string; date: string; amount: number; reference: string }) => void;
}) {
  const parties = suppliers(state);
  const [partyId, setPartyId] = useState(parties[0]?.id ?? '');
  const [date, setDate] = useState(HOY);
  const [amount, setAmount] = useState(0);
  const [reference, setReference] = useState('');
  const valid = partyId !== '' && date !== '' && amount > 0;

  return (
    <Modal title="Registrar anticipo a proveedor" subtitle="El anticipo queda disponible para aplicar contra obligaciones del mismo tercero." onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Proveedor">
          <select className={INPUT} value={partyId} onChange={event => setPartyId(event.target.value)}>
            {parties.map(party => <option key={party.id} value={party.id}>{party.name} · {party.nit}</option>)}
          </select>
        </Field>
        <Field label="Fecha">
          <input type="date" className={INPUT} value={date} onChange={event => setDate(event.target.value)} />
        </Field>
        <Field label="Valor del anticipo">
          <input type="number" min={0} step="0.01" className={INPUT} value={amount} onChange={event => setAmount(Number(event.target.value))} />
        </Field>
        <Field label="Referencia">
          <input className={INPUT} value={reference} onChange={event => setReference(event.target.value)} placeholder="Orden de compra o soporte" />
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave({ partyId, date, amount, reference })}>Registrar anticipo</Button>
      </div>
    </Modal>
  );
}

function ApplyAdvanceModal({ state, advance, onClose, onSave }: {
  state: FinanceState;
  advance: Advance;
  onClose: () => void;
  onSave: (payload: { payableId: string; amount: number }) => void;
}) {
  const payables = state.payables
    .filter(payable => payable.partyId === advance.partyId && payable.balance > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const available = Math.max(0, advance.amount - advance.applied);
  const [payableId, setPayableId] = useState(payables[0]?.id ?? '');
  const payable = payables.find(item => item.id === payableId);
  const max = Math.min(available, payable?.balance ?? 0);
  const [amount, setAmount] = useState(max);
  const valid = payableId !== '' && amount > 0 && amount <= max + 0.01;

  function changePayable(id: string) {
    setPayableId(id);
    const target = payables.find(item => item.id === id);
    setAmount(Math.min(available, target?.balance ?? 0));
  }

  return (
    <Modal
      title={`Aplicar anticipo ${advance.number}`}
      subtitle={`${partyOf(state, advance.partyId)?.name ?? 'Proveedor'} · disponible ${money(available)}`}
      onClose={onClose}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Obligación destino">
          <select className={INPUT} value={payableId} onChange={event => changePayable(event.target.value)}>
            {payables.map(item => (
              <option key={item.id} value={item.id}>{item.invoiceNumber} · saldo {money(item.balance)}</option>
            ))}
          </select>
        </Field>
        <Field label="Valor a aplicar">
          <input
            type="number"
            min={0}
            max={max}
            step="0.01"
            className={INPUT}
            value={amount}
            onChange={event => setAmount(Number(event.target.value))}
          />
        </Field>
      </div>
      {payables.length === 0 && <p className="mt-3 text-[11px] text-amber-700">El proveedor no tiene obligaciones abiertas para aplicar el anticipo.</p>}
      <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
        <div className="flex justify-between"><span>Saldo del anticipo</span><Money value={available} /></div>
        <div className="mt-1 flex justify-between"><span>Saldo de la obligación</span><Money value={payable?.balance ?? 0} /></div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave({ payableId, amount })}>Aplicar anticipo</Button>
      </div>
    </Modal>
  );
}

interface AgingRow {
  id: string;
  name: string;
  nit: string;
  buckets: Record<AgingBucket, number>;
  total: number;
}

function SchedulingScreen({ onNavigate, showToast }: {
  onNavigate: (page: NavPage) => void;
  showToast: (text: string) => void;
}) {
  const { state, update } = useFinance();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const open = state.payables.filter(payable => payable.balance > 0);
  const available = sum(activeAccounts(state).map(account => account.balance));
  const overdue = sum(open.filter(payable => payable.dueDate < HOY).map(payable => payable.balance));

  const agingRows = useMemo<AgingRow[]>(() => {
    const groups = new Map<string, Payable[]>();
    for (const payable of state.payables) {
      if (payable.balance <= 0) continue;
      const list = groups.get(payable.partyId) ?? [];
      list.push(payable);
      groups.set(payable.partyId, list);
    }
    return Array.from(groups.entries()).map(([partyId, rows]) => {
      const party = partyOf(state, partyId);
      return {
        id: partyId,
        name: party?.name ?? 'Proveedor',
        nit: party?.nit ?? '—',
        buckets: payableAging(rows),
        total: sum(rows.map(row => row.balance)),
      };
    }).sort((a, b) => b.total - a.total);
  }, [state]);

  const projection = useMemo(() => {
    return [0, 1, 2, 3].map(index => {
      const from = index === 0 ? '' : addDays(HOY, index * 7);
      const to = addDays(HOY, index * 7 + 6);
      const previousEnd = index === 0 ? '' : addDays(HOY, (index - 1) * 7 + 6);
      const rows = open.filter(payable => (
        index === 0
          ? payable.dueDate <= to
          : payable.dueDate > previousEnd && payable.dueDate <= to
      ));
      return {
        index,
        from,
        to,
        amount: sum(rows.map(row => row.balance)),
        count: rows.length,
      };
    });
  }, [open]);

  const queue = useMemo(() => [...open].sort((a, b) => {
    const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
    return byPriority !== 0 ? byPriority : a.dueDate.localeCompare(b.dueDate);
  }), [open]);

  const selectedRows = queue.filter(payable => selectedIds.includes(payable.id));
  const selectedTotal = sum(selectedRows.map(payable => payable.balance));

  function toggle(id: string) {
    const payable = state.payables.find(item => item.id === id);
    if (!payable || inActiveProposal(state, id)) return;
    setSelectedIds(current => current.includes(id)
      ? current.filter(value => value !== id)
      : [...current, id]);
  }

  function createProposal() {
    const ids = selectedIds.filter(id => {
      const payable = state.payables.find(item => item.id === id);
      return payable !== undefined && payable.balance > 0 && !inActiveProposal(state, id);
    });
    if (ids.length === 0) {
      showToast('Seleccione al menos una obligación para crear la propuesta.');
      return;
    }
    const accounts = activeAccounts(state);
    if (accounts.length === 0) {
      showToast('No hay cuentas activas para asociar la propuesta.');
      return;
    }
    const number = nextProposalNumber(state);
    update(draft => {
      const validIds = ids.filter(id => {
        const payable = draft.payables.find(item => item.id === id);
        return payable !== undefined && payable.balance > 0;
      });
      if (validIds.length === 0) return;
      draft.proposals.unshift({
        id: newId('prop'),
        number,
        date: HOY,
        cutoff: addDays(HOY, 7),
        payableIds: validIds,
        status: 'Borrador',
        createdBy: USUARIO.nombre,
        approvedBy: '',
        rejectedReason: '',
        note: 'Creada desde la programación de pagos.',
        accountId: accounts[0].id,
      });
      for (const id of validIds) {
        const payable = draft.payables.find(item => item.id === id);
        if (payable) payable.status = 'En propuesta';
      }
    }, `Propuesta ${number} creada desde programación`, MODULE_ID);
    setSelectedIds([]);
    showToast(`Propuesta ${number} creada con ${ids.length} obligaciones. Revísela en Propuestas.`);
    onNavigate('cuentas-pagar/propuestas');
  }

  const agingColumns: Column<AgingRow>[] = [
    {
      header: 'Proveedor',
      cell: row => (
        <div className="max-w-64">
          <div className="truncate">{row.name}</div>
          <div className="text-[10px] text-gray-400">{row.nit}</div>
        </div>
      ),
    },
    ...AGING_BUCKETS.map(bucket => ({
      header: bucket,
      align: 'right' as const,
      cell: (row: AgingRow) => (
        <Money value={row.buckets[bucket]} className={row.buckets[bucket] > 0 ? 'font-medium' : 'text-gray-400'} />
      ),
    })),
    { header: 'Total', align: 'right', cell: row => <Money value={row.total} className="font-semibold" /> },
  ];

  const queueColumns: Column<Payable>[] = [
    {
      header: '',
      cell: payable => {
        const blocked = inActiveProposal(state, payable.id);
        return (
          <span onClick={event => event.stopPropagation()}>
            <input
              type="checkbox"
              title={blocked ? 'La obligación ya está en una propuesta vigente' : 'Seleccionar para propuesta'}
              checked={selectedIds.includes(payable.id)}
              disabled={blocked}
              onChange={() => toggle(payable.id)}
            />
          </span>
        );
      },
    },
    { header: 'Prioridad', cell: payable => <Badge tone={priorityTone(payable.priority)}>{payable.priority}</Badge> },
    { header: 'Documento', cell: payable => <span className="font-mono font-semibold">{payable.invoiceNumber}</span> },
    {
      header: 'Proveedor',
      cell: payable => (
        <div className="max-w-56">
          <div className="truncate">{partyOf(state, payable.partyId)?.name ?? 'Proveedor'}</div>
          <div className="text-[10px] text-gray-400">{partyOf(state, payable.partyId)?.nit ?? '—'}</div>
        </div>
      ),
    },
    {
      header: 'Vencimiento',
      cell: payable => (
        <div>
          <div>{fmtDate(payable.dueDate)}</div>
          <div className={`text-[10px] ${payable.dueDate < HOY ? 'text-red-600' : 'text-gray-400'}`}>{dueLabel(payable.dueDate)}</div>
        </div>
      ),
    },
    { header: 'Saldo', align: 'right', cell: payable => <Money value={payable.balance} className="font-semibold" /> },
    { header: 'Estado', cell: payable => <Badge tone={statusTone(payable.status)}>{payable.status}</Badge> },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Disponible en tesorería" value={money(available)} detail="Suma de cuentas activas" tone="green" />
        <KpiCard label="Total por pagar" value={money(sum(open.map(payable => payable.balance)))} detail={`${open.length} obligaciones abiertas`} tone="violet" />
        <KpiCard label="Vencido" value={money(overdue)} detail="Requiere atención inmediata" tone="red" />
        <KpiCard label="Seleccionado" value={money(selectedTotal)} detail={`${selectedRows.length} obligaciones para propuesta`} tone="amber" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <Card>
          <SectionTitle title="Aging de cuentas por pagar" detail="Saldo pendiente por proveedor y rango de vencimiento real." />
          <DataTable columns={agingColumns} rows={agingRows} rowKey={row => row.id} empty="No hay saldos pendientes por proveedor." dense />
        </Card>

        <Card className="h-fit">
          <SectionTitle title="Proyección de pagos" detail="Vencimientos de las próximas cuatro semanas." />
          <div className="grid grid-cols-2 gap-2 p-4">
            {projection.map(week => (
              <div key={week.index} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                <div className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                  {week.index === 0 ? 'Vencido + semana 1' : `Semana ${week.index + 1}`}
                </div>
                <div className="mt-1 text-sm font-semibold text-gray-900"><Money value={week.amount} /></div>
                <div className="mt-0.5 text-[10px] text-gray-500">{week.count} obligaciones · hasta {fmtDate(week.to)}</div>
              </div>
            ))}
          </div>
          {selectedTotal > available && (
            <div className="mx-4 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-800">
              La selección supera el disponible de tesorería en {money(selectedTotal - available)}.
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle
          title="Cola priorizada de pagos"
          detail="Ordenada por prioridad y fecha de vencimiento. Las obligaciones ya incluidas en propuestas no se pueden seleccionar."
          action={(
            <Button variant="primary" size="sm" disabled={selectedIds.length === 0} onClick={createProposal}>
              <Icon name="plus" className="h-3.5 w-3.5" /> Crear propuesta desde selección
            </Button>
          )}
        />
        <DataTable
          columns={queueColumns}
          rows={queue}
          rowKey={row => row.id}
          onRowClick={row => toggle(row.id)}
          empty="No hay obligaciones pendientes de programación."
          footer={(
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-600">
              <span>{queue.length} obligaciones en cola</span>
              <span>Seleccionado: <strong>{money(selectedTotal)}</strong> · disponible <strong>{money(available)}</strong></span>
            </div>
          )}
        />
      </Card>
    </>
  );
}

function ExpensesScreen({ showToast }: { showToast: (text: string) => void }) {
  const { state, update } = useFinance();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const [open, setOpen] = useState(false);
  const haystack = query.trim().toLowerCase();

  const rows = useMemo(() => state.expenses
    .filter(expense => status === 'Todos' || expense.status === status)
    .filter(expense => haystack === ''
      || expense.number.toLowerCase().includes(haystack)
      || expense.employee.toLowerCase().includes(haystack)
      || expense.category.toLowerCase().includes(haystack)
      || expense.costCenter.toLowerCase().includes(haystack))
    .sort((a, b) => b.date.localeCompare(a.date)), [haystack, state.expenses, status]);

  const pending = state.expenses.filter(expense => expense.status === 'Borrador' || expense.status === 'Pendiente aprobación');
  const approved = state.expenses.filter(expense => expense.status === 'Aprobado');
  const reimbursed = state.expenses.filter(expense => expense.status === 'Reembolsado');

  function approve(expense: Expense) {
    if (!expense.support.trim()) {
      showToast('El gasto no tiene soporte y no puede aprobarse.');
      return;
    }
    update(draft => {
      const target = draft.expenses.find(item => item.id === expense.id);
      if (!target || !target.support.trim()) return;
      target.status = 'Aprobado';
    }, `Gasto ${expense.number} aprobado`, MODULE_ID);
    showToast(`${expense.number} aprobado.`);
  }

  function reimburse(expense: Expense) {
    update(draft => {
      const target = draft.expenses.find(item => item.id === expense.id);
      if (!target || target.status !== 'Aprobado') return;
      target.status = 'Reembolsado';
    }, `Gasto ${expense.number} reembolsado`, MODULE_ID);
    showToast(`${expense.number} marcado como reembolsado.`);
  }

  function createExpense(payload: {
    date: string;
    employee: string;
    category: string;
    costCenter: string;
    amount: number;
    tax: number;
    support: string;
    note: string;
  }) {
    const number = nextExpenseNumber(state);
    update(draft => {
      draft.expenses.unshift({
        id: newId('gas'),
        number,
        date: payload.date,
        employee: payload.employee.trim(),
        category: payload.category,
        costCenter: payload.costCenter,
        amount: payload.amount,
        tax: payload.tax,
        support: payload.support.trim(),
        status: payload.support.trim() ? 'Pendiente aprobación' : 'Borrador',
        note: payload.note.trim(),
      });
    }, `Gasto ${number} registrado`, MODULE_ID);
    setOpen(false);
    showToast(`${number} registrado${payload.support.trim() ? ' y enviado a aprobación' : ' como borrador'}.`);
  }

  const columns: Column<Expense>[] = [
    { header: 'Número', cell: expense => <span className="font-mono font-semibold">{expense.number}</span> },
    { header: 'Empleado', cell: expense => expense.employee },
    { header: 'Fecha', cell: expense => fmtDate(expense.date) },
    { header: 'Categoría', cell: expense => expense.category },
    { header: 'Centro', cell: expense => expense.costCenter },
    { header: 'Valor', align: 'right', cell: expense => <Money value={expense.amount} className="font-semibold" /> },
    {
      header: 'Soporte',
      cell: expense => expense.support.trim()
        ? <span className="block max-w-48 truncate text-gray-600">{expense.support}</span>
        : <Badge tone="amber">Sin soporte</Badge>,
    },
    { header: 'Estado', cell: expense => <Badge tone={statusTone(expense.status)}>{expense.status}</Badge> },
    {
      header: 'Acciones',
      align: 'right',
      cell: expense => (
        <div className="flex justify-end gap-1.5">
          {(expense.status === 'Borrador' || expense.status === 'Pendiente aprobación') && (
            <Button
              size="sm"
              variant="success"
              disabled={!expense.support.trim()}
              title={expense.support.trim() ? 'Aprobar gasto' : 'Requiere soporte para aprobar'}
              onClick={() => approve(expense)}
            >
              Aprobar
            </Button>
          )}
          {expense.status === 'Aprobado' && (
            <Button size="sm" variant="primary" onClick={() => reimburse(expense)}>Reembolsar</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Pendientes" value={String(pending.length)} detail={money(sum(pending.map(expense => expense.amount)))} tone="amber" />
        <KpiCard label="Aprobados" value={String(approved.length)} detail={money(sum(approved.map(expense => expense.amount)))} tone="blue" />
        <KpiCard label="Reembolsado" value={money(sum(reimbursed.map(expense => expense.amount)))} detail={`${reimbursed.length} gastos pagados`} tone="green" />
        <KpiCard label="Gastos totales" value={String(state.expenses.length)} detail="Histórico de reembolsos" tone="violet" />
      </div>

      <Card>
        <SectionTitle
          title="Gastos y reembolsos"
          detail="Un gasto sin soporte no puede aprobarse. El reembolso solo aplica a gastos aprobados."
          action={(
            <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
              <Icon name="plus" className="h-3.5 w-3.5" /> Nuevo gasto
            </Button>
          )}
        />
        <FilterBar>
          <SearchInput
            placeholder="Buscar número, empleado, categoría o centro…"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <FilterSelect value={status} onChange={event => setStatus(event.target.value)} aria-label="Estado del gasto">
            {['Todos', 'Borrador', 'Pendiente aprobación', 'Aprobado', 'Reembolsado'].map(value => (
              <option key={value}>{value}</option>
            ))}
          </FilterSelect>
        </FilterBar>
        <DataTable columns={columns} rows={rows} rowKey={row => row.id} empty="No hay gastos con los filtros aplicados." />
      </Card>

      {open && (
        <NewExpenseModal onClose={() => setOpen(false)} onSave={createExpense} />
      )}
    </>
  );
}

function NewExpenseModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (payload: {
    date: string;
    employee: string;
    category: string;
    costCenter: string;
    amount: number;
    tax: number;
    support: string;
    note: string;
  }) => void;
}) {
  const [date, setDate] = useState(HOY);
  const [employee, setEmployee] = useState(USUARIO.nombre);
  const [category, setCategory] = useState('Transporte');
  const [costCenter, setCostCenter] = useState('ADM');
  const [amount, setAmount] = useState(0);
  const [tax, setTax] = useState(0);
  const [support, setSupport] = useState('');
  const [note, setNote] = useState('');
  const valid = date !== '' && employee.trim() !== '' && amount > 0;

  return (
    <Modal title="Nuevo gasto" subtitle="Registre el soporte del empleado y envíelo a aprobación." onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Empleado">
          <input className={INPUT} value={employee} onChange={event => setEmployee(event.target.value)} />
        </Field>
        <Field label="Fecha">
          <input type="date" className={INPUT} value={date} onChange={event => setDate(event.target.value)} />
        </Field>
        <Field label="Categoría">
          <select className={INPUT} value={category} onChange={event => setCategory(event.target.value)}>
            {['Viaje', 'Papelería', 'Capacitación', 'Transporte', 'Representación', 'Otros'].map(value => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field label="Centro de costo">
          <select className={INPUT} value={costCenter} onChange={event => setCostCenter(event.target.value)}>
            {['ADM', 'OPE', 'VEN'].map(value => <option key={value}>{value}</option>)}
          </select>
        </Field>
        <Field label="Valor">
          <input type="number" min={0} step="0.01" className={INPUT} value={amount} onChange={event => setAmount(Number(event.target.value))} />
        </Field>
        <Field label="Impuestos incluidos">
          <input type="number" min={0} step="0.01" className={INPUT} value={tax} onChange={event => setTax(Number(event.target.value))} />
        </Field>
        <Field label="Soporte" className="sm:col-span-2">
          <input className={INPUT} value={support} onChange={event => setSupport(event.target.value)} placeholder="Factura, recibo o certificado que respalda el gasto" />
        </Field>
        <Field label="Nota" className="sm:col-span-2">
          <textarea className={`${INPUT} min-h-20`} value={note} onChange={event => setNote(event.target.value)} placeholder="Detalle del gasto" />
        </Field>
      </div>
      {!support.trim() && <p className="mt-2 text-[11px] text-amber-700">Sin soporte el gasto queda en borrador y no podrá aprobarse.</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave({ date, employee, category, costCenter, amount, tax, support, note })}>Registrar gasto</Button>
      </div>
    </Modal>
  );
}

function SupplierNotesScreen({ showToast }: { showToast: (text: string) => void }) {
  const { state, update } = useFinance();
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => state.invoices
    .filter(invoice => {
      if (invoice.kind !== 'NC') return false;
      const party = partyOf(state, invoice.partyId);
      return party?.kind === 'Proveedor' || party?.kind === 'Ambos';
    })
    .sort((a, b) => b.date.localeCompare(a.date)), [state]);

  const total = sum(rows.map(invoice => invoiceTotals(invoice).total));

  function createNote(payload: { invoiceId: string; motive: string; amount: number }) {
    const original = state.invoices.find(invoice => invoice.id === payload.invoiceId);
    const payable = state.payables.find(item => item.invoiceId === payload.invoiceId);
    if (!original || !payable) {
      showToast('La factura de compra no tiene una obligación asociada.');
      return;
    }
    const { number, resolutionId, sequence } = nextNoteNumber(state);
    update(draft => {
      addSupplierCreditNote(draft, {
        invoiceId: payload.invoiceId,
        amount: payload.amount,
        motive: payload.motive,
        number,
        resolutionId,
        sequence,
      });
    }, `Nota de proveedor ${number} creada`, MODULE_ID);
    setOpen(false);
    showToast(`${number} aplicada a ${original.number}. Saldo de la obligación actualizado.`);
  }

  const columns: Column<Invoice>[] = [
    { header: 'Nota', cell: invoice => <span className="font-mono font-semibold">{invoice.number}</span> },
    {
      header: 'Documento original',
      cell: invoice => <span className="font-mono">{state.invoices.find(item => item.id === invoice.referenceId)?.number ?? '—'}</span>,
    },
    {
      header: 'Proveedor',
      cell: invoice => <span className="block max-w-56 truncate">{partyOf(state, invoice.partyId)?.name ?? 'Proveedor'}</span>,
    },
    { header: 'Fecha', cell: invoice => fmtDate(invoice.date) },
    { header: 'Motivo', cell: invoice => <span className="block max-w-64 truncate text-gray-500">{invoice.motive || '—'}</span> },
    { header: 'Valor', align: 'right', cell: invoice => <Money value={invoiceTotals(invoice).total} className="font-semibold" /> },
    { header: 'Estado', cell: invoice => <Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge> },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Notas de proveedor" value={String(rows.length)} detail="Notas crédito registradas" tone="violet" />
        <KpiCard label="Valor ajustado" value={money(total)} detail="Crédito aplicado a CxP" tone="green" />
        <KpiCard label="Proveedores" value={String(new Set(rows.map(invoice => invoice.partyId)).size)} detail="Terceros con notas" tone="blue" />
        <KpiCard label="Documentos origen" value={String(new Set(rows.map(invoice => invoice.referenceId)).size)} detail="Facturas de compra afectadas" tone="cyan" />
      </div>

      <Card>
        <SectionTitle
          title="Notas crédito de proveedores"
          detail="Cada nota se crea como documento NC contabilizado y reduce el saldo de la obligación original."
          action={(
            <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
              <Icon name="plus" className="h-3.5 w-3.5" /> Nueva nota de proveedor
            </Button>
          )}
        />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={row => row.id}
          empty="No hay notas crédito de proveedores registradas."
        />
      </Card>

      {open && (
        <NewSupplierNoteModal state={state} onClose={() => setOpen(false)} onSave={createNote} />
      )}
    </>
  );
}

function NewSupplierNoteModal({ state, onClose, onSave }: {
  state: FinanceState;
  onClose: () => void;
  onSave: (payload: { invoiceId: string; motive: string; amount: number }) => void;
}) {
  const originals = state.invoices.filter(invoice => (
    invoice.kind === 'FC'
    && invoice.status === 'Contabilizada'
    && state.payables.some(payable => payable.invoiceId === invoice.id && payable.balance > 0)
  ));

  function maxFor(invoiceId: string): number {
    const invoice = state.invoices.find(item => item.id === invoiceId);
    const payable = state.payables.find(item => item.invoiceId === invoiceId);
    return invoice ? Math.min(invoiceTotals(invoice).total, payable?.balance ?? 0) : 0;
  }

  const [invoiceId, setInvoiceId] = useState(originals[0]?.id ?? '');
  const [amount, setAmount] = useState(originals[0] ? maxFor(originals[0].id) : 0);
  const [motive, setMotive] = useState('');
  const max = maxFor(invoiceId);
  const original = originals.find(invoice => invoice.id === invoiceId);
  const valid = invoiceId !== '' && amount > 0 && amount <= max + 0.01 && motive.trim().length >= 4;

  function changeInvoice(id: string) {
    setInvoiceId(id);
    setAmount(maxFor(id));
  }

  return (
    <Modal
      title="Nueva nota crédito de proveedor"
      subtitle="Seleccione una factura de compra contabilizada con saldo pendiente."
      onClose={onClose}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Factura de compra" className="sm:col-span-2">
          <select className={INPUT} value={invoiceId} onChange={event => changeInvoice(event.target.value)}>
            {originals.map(invoice => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.number} · {partyOf(state, invoice.partyId)?.name ?? 'Proveedor'} · saldo {money(maxFor(invoice.id))}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Valor de la nota" hint={`Máximo ${money(max)}`}>
          <input
            type="number"
            min={0}
            max={max}
            step="0.01"
            className={INPUT}
            value={amount}
            onChange={event => setAmount(Number(event.target.value))}
          />
        </Field>
        <Field label="Documento original">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
            {original ? <>{original.number} · {fmtDate(original.date)}</> : 'Seleccione una factura'}
          </div>
        </Field>
        <Field label="Motivo" className="sm:col-span-2">
          <textarea
            className={`${INPUT} min-h-20`}
            value={motive}
            onChange={event => setMotive(event.target.value)}
            placeholder="Motivo del crédito otorgado por el proveedor"
          />
        </Field>
      </div>
      {originals.length === 0 && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          No hay facturas de compra contabilizadas con saldo pendiente.
        </p>
      )}
      {amount > max && <p className="mt-2 text-[11px] text-red-600">El valor no puede superar el saldo pendiente de la obligación.</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave({ invoiceId, motive, amount })}>Emitir nota</Button>
      </div>
    </Modal>
  );
}

interface StatementRow {
  key: string;
  date: string;
  document: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

function SupplierStatementScreen() {
  const { state } = useFinance();
  const suppliers = state.parties.filter(party => party.kind !== 'Cliente');
  const [partyId, setPartyId] = useState(suppliers[0]?.id ?? '');
  const [from, setFrom] = useState('2026-02-01');
  const [to, setTo] = useState('2026-02-28');
  const party = state.parties.find(item => item.id === partyId);

  const rows = useMemo<StatementRow[]>(() => {
    const movements: Omit<StatementRow, 'balance'>[] = [];
    for (const invoice of state.invoices) {
      if (invoice.partyId !== partyId) continue;
      if (invoice.kind === 'FC') {
        const totals = invoiceTotals(invoice);
        movements.push({ key: `inv-${invoice.id}`, date: invoice.date, document: invoice.number, type: 'Factura de compra', debit: 0, credit: totals.total });
      }
      if (invoice.kind === 'NC') {
        const totals = invoiceTotals(invoice);
        movements.push({ key: `nc-${invoice.id}`, date: invoice.date, document: invoice.number, type: 'Nota crédito', debit: totals.total, credit: 0 });
      }
    }
    for (const payment of state.payments) {
      if (payment.partyId !== partyId) continue;
      const linked = payment.applications.reduce((total, application) => {
        const payable = state.payables.find(item => item.id === application.payableId);
        return payable?.partyId === partyId ? total + application.amount : total;
      }, 0);
      movements.push({ key: `pay-${payment.id}`, date: payment.date, document: payment.number, type: 'Pago aplicado', debit: linked || payment.applied, credit: 0 });
    }
    movements.sort((a, b) => a.date.localeCompare(b.date) || a.document.localeCompare(b.document));
    const before = movements.filter(row => row.date < from);
    let running = before.reduce((total, row) => total + row.credit - row.debit, 0);
    return movements.filter(row => row.date >= from && row.date <= to).map(row => {
      running += row.credit - row.debit;
      return { ...row, balance: running };
    });
  }, [state.invoices, state.payments, state.payables, partyId, from, to]);

  const opening = useMemo(() => {
    const before = state.invoices.filter(invoice => invoice.partyId === partyId && invoice.date < from).reduce((total, invoice) => {
      if (invoice.kind === 'FC') return total + invoiceTotals(invoice).total;
      if (invoice.kind === 'NC') return total - invoiceTotals(invoice).total;
      return total;
    }, 0);
    const payments = state.payments.filter(payment => payment.partyId === partyId && payment.date < from).reduce((total, payment) => total + payment.applied, 0);
    return before - payments;
  }, [state.invoices, state.payments, partyId, from]);

  const invoiced = rows.filter(row => row.type === 'Factura de compra').reduce((total, row) => total + row.credit, 0);
  const paid = rows.filter(row => row.type === 'Pago aplicado').reduce((total, row) => total + row.debit, 0);
  const creditNotes = rows.filter(row => row.type === 'Nota crédito').reduce((total, row) => total + row.debit, 0);
  const finalBalance = rows.length ? rows[rows.length - 1].balance : opening;

  const columns: Column<StatementRow>[] = [
    { header: 'Fecha', cell: row => fmtDate(row.date) },
    { header: 'Documento', cell: row => <span className="font-mono font-semibold">{row.document}</span> },
    { header: 'Tipo', cell: row => <Badge tone={row.type === 'Factura de compra' ? 'blue' : row.type === 'Pago aplicado' ? 'green' : 'violet'}>{row.type}</Badge> },
    { header: 'Débito', align: 'right', cell: row => row.debit ? <Money value={row.debit} /> : '—' },
    { header: 'Crédito', align: 'right', cell: row => row.credit ? <Money value={row.credit} /> : '—' },
    { header: 'Saldo', align: 'right', cell: row => <Money value={row.balance} className="font-semibold" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Saldo inicial" value={<Money value={opening} />} detail="Antes del período" tone="blue" />
        <KpiCard label="Facturado" value={<Money value={invoiced} />} detail="Compras del período" tone="violet" />
        <KpiCard label="Pagado y notas" value={<Money value={paid + creditNotes} />} detail="Aplicado a obligaciones" tone="green" />
        <KpiCard label="Saldo final" value={<Money value={finalBalance} />} detail="Saldo con el proveedor" tone={finalBalance > 0 ? 'amber' : 'gray'} />
      </div>
      <Card>
        <SectionTitle
          title="Estado de cuenta por proveedor"
          detail="Débitos, créditos y saldo corrido del período seleccionado."
          action={<Button size="sm" variant="secondary" onClick={() => window.print()}>Imprimir</Button>}
        />
        <FilterBar>
          <FilterSelect value={partyId} onChange={event => setPartyId(event.target.value)} aria-label="Proveedor">
            {suppliers.map(item => <option key={item.id} value={item.id}>{item.name} · {item.nit}</option>)}
          </FilterSelect>
          <Field label="Desde"><input type="date" className={INPUT} value={from} onChange={event => setFrom(event.target.value)} /></Field>
          <Field label="Hasta"><input type="date" className={INPUT} value={to} onChange={event => setTo(event.target.value)} /></Field>
        </FilterBar>
        <div className="px-4 pt-3 text-xs text-gray-500">{party?.name} · NIT {party?.nit} · {party?.city}</div>
        <DataTable columns={columns} rows={rows} rowKey={row => row.key} empty="El proveedor no tiene movimientos en el período." footer={<div className="flex justify-between text-[11px] text-gray-600"><span>{rows.length} movimiento(s)</span><span>Saldo final: <Money value={finalBalance} className="font-semibold" /></span></div>} />
      </Card>
    </div>
  );
}
