import { useMemo, useState } from 'react';
import type { NavPage } from '../../components/Shell';
import Icon from '../../components/Icon';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  FilterBar,
  FilterSelect,
  INPUT,
  KpiCard,
  Modal,
  Money,
  PageHeader,
  Progress,
  SearchInput,
  SectionTitle,
  StackedLegend,
  type Column,
} from '../../components/finance/ui';
import { FINANCIAL_MODULES } from '../../data/finance';
import { USUARIO } from '../../data/mock';
import { useFinance } from '../../finance/store';
import {
  AGING_BUCKETS,
  HOY,
  addDays,
  agingBucket,
  daysBetween,
  fmtDate,
  invoiceTotals,
  money,
  partyOf,
  receivableAging,
  statusTone,
  type AgingBucket,
} from '../../finance/selectors';
import type {
  Advance,
  CollectionAction,
  FinanceState,
  Receivable,
  Receipt,
  WriteOff,
} from '../../finance/types';

interface Props {
  page: string;
  onNavigate: (page: NavPage) => void;
}

const MODULE = FINANCIAL_MODULES.cartera;
const SLUGS = MODULE.nav.map(item => item.slug);

const TITULOS: Record<string, { title: string; subtitle: string }> = {
  partidas: { title: 'Bandeja de cartera', subtitle: 'Partidas abiertas por cliente, vencimientos, promesas y acciones de cobro.' },
  recibos: { title: 'Recibos de caja', subtitle: 'Registro de recaudos recibidos y su disponibilidad para aplicar a cartera.' },
  aplicacion: { title: 'Aplicación de pagos', subtitle: 'Cruce de recibos con partidas abiertas del mismo cliente.' },
  edades: { title: 'Edades de cartera', subtitle: 'Distribución del saldo por vencimiento y concentración por cliente.' },
  'estados-cuenta': { title: 'Estados de cuenta', subtitle: 'Documentos, notas, recibos y saldo corrido por cliente.' },
  cobro: { title: 'Cobro y promesas', subtitle: 'Gestiones realizadas, compromisos de pago y seguimiento de cumplimiento.' },
  ajustes: { title: 'Castigos y ajustes', subtitle: 'Solicitudes de castigo, aprobación y depuración de partidas incobrables.' },
  anticipos: { title: 'Anticipos de clientes', subtitle: 'Recursos recibidos antes de la facturación y su aplicación a partidas.' },
};

const RECEIVABLE_STATUSES: Receivable['status'][] = [
  'Al día', 'Por vencer', 'Vencida', 'Acuerdo de pago', 'Pagada', 'Castigada',
];
const RECEIPT_METHODS: Receipt['method'][] = ['Transferencia', 'Efectivo', 'Cheque', 'PSE'];
const COLLECTION_CHANNELS: CollectionAction['channel'][] = ['Llamada', 'Correo', 'Visita', 'WhatsApp'];
const COLLECTION_RESULTS: CollectionAction['result'][] = ['Promesa', 'Sin respuesta', 'Pago parcial', 'Disputa', 'Acuerdo'];

type ResultTone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet';

const RESULT_TONE: Record<CollectionAction['result'], ResultTone> = {
  Promesa: 'blue',
  'Sin respuesta': 'gray',
  'Pago parcial': 'amber',
  Disputa: 'red',
  Acuerdo: 'violet',
};

type AgingTone = 'green' | 'cyan' | 'amber' | 'red' | 'violet';

const AGING_TONE: Record<AgingBucket, AgingTone> = {
  Corriente: 'green',
  '1–30': 'cyan',
  '31–60': 'amber',
  '61–90': 'red',
  '+90': 'violet',
};

const AGING_BAR: Record<AgingBucket, string> = {
  Corriente: 'bg-emerald-500',
  '1–30': 'bg-cyan-500',
  '31–60': 'bg-amber-500',
  '61–90': 'bg-red-500',
  '+90': 'bg-violet-500',
};

interface CarteraKpis {
  total: number;
  overdue: number;
  next15: number;
  collected: number;
  openCount: number;
  monthReceipts: number;
}

interface ReceiptDraft {
  partyId: string;
  date: string;
  method: Receipt['method'];
  accountId: string;
  amount: number;
  reference: string;
}

interface CollectionDraft {
  receivableId: string;
  channel: CollectionAction['channel'];
  result: CollectionAction['result'];
  note: string;
  promiseDate: string;
  promiseAmount: number;
}

interface WriteOffDraft {
  receivableId: string;
  amount: number;
  reason: string;
}

interface AdvanceDraft {
  partyId: string;
  date: string;
  amount: number;
  reference: string;
}

interface Allocation {
  receivableId: string;
  amount: number;
}

interface StatementEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
}

interface StatementRow extends StatementEntry {
  balance: number;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function roundMoney(value: number): number {
  return Math.round(value);
}

function nextDocumentNumber(values: string[], prefix: string): string {
  const max = values.reduce((current, value) => {
    const match = value.match(/(\d+)$/);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

function openReceivables(state: FinanceState): Receivable[] {
  return state.receivables.filter(item => item.balance > 0.005 && item.status !== 'Pagada' && item.status !== 'Castigada');
}

function receiptAvailable(receipt: Receipt): number {
  return Math.max(0, receipt.amount - receipt.applied);
}

function advanceAvailable(advance: Advance): number {
  return Math.max(0, advance.amount - advance.applied);
}

function totalOf(rows: Receivable[]): number {
  return rows.reduce((total, row) => total + row.balance, 0);
}

function accountLabel(state: FinanceState, accountId: string): string {
  const account = state.accounts.find(item => item.id === accountId);
  return account ? `${account.bank} · ${account.number}` : '—';
}

function receivableOf(state: FinanceState, id: string): Receivable | undefined {
  return state.receivables.find(item => item.id === id);
}

function buildStatementEntries(state: FinanceState, partyId: string): StatementEntry[] {
  const entries: StatementEntry[] = [];
  const receivables = state.receivables.filter(item => item.partyId === partyId);
  const byInvoice = new Map(receivables.map(item => [item.invoiceId, item]));

  for (const invoice of state.invoices) {
    if (invoice.partyId !== partyId || invoice.kind === 'FC' || invoice.status !== 'Contabilizada') continue;
    if (invoice.kind === 'NC') {
      if (!invoice.referenceId || !byInvoice.has(invoice.referenceId)) continue;
      entries.push({
        id: invoice.id,
        date: invoice.date,
        reference: invoice.number,
        description: 'Nota crédito aplicada a cartera',
        debit: 0,
        credit: invoiceTotals(invoice).total,
      });
      continue;
    }
    if (invoice.kind === 'ND') {
      if (!invoice.referenceId || !byInvoice.has(invoice.referenceId)) continue;
      entries.push({
        id: invoice.id,
        date: invoice.date,
        reference: invoice.number,
        description: 'Nota débito',
        debit: invoiceTotals(invoice).total,
        credit: 0,
      });
      continue;
    }
    const receivable = byInvoice.get(invoice.id);
    if (!receivable) continue;
    entries.push({
      id: invoice.id,
      date: invoice.date,
      reference: invoice.number,
      description: 'Factura de venta',
      debit: receivable.original,
      credit: 0,
    });
  }

  for (const receipt of state.receipts) {
    if (receipt.partyId !== partyId || receipt.applied <= 0.005) continue;
    entries.push({
      id: receipt.id,
      date: receipt.date,
      reference: receipt.number,
      description: `Recibo de caja · ${receipt.method}`,
      debit: 0,
      credit: receipt.applied,
    });
  }

  for (const application of state.applications) {
    const advance = state.advances.find(item => item.id === application.receiptId);
    if (!advance || advance.partyId !== partyId) continue;
    entries.push({
      id: application.id,
      date: application.date,
      reference: advance.number,
      description: 'Anticipo aplicado a cartera',
      debit: 0,
      credit: application.amount,
    });
  }

  for (const writeOff of state.writeOffs) {
    if (writeOff.status !== 'Aprobado') continue;
    const receivable = receivables.find(item => item.id === writeOff.receivableId);
    if (!receivable) continue;
    entries.push({
      id: writeOff.id,
      date: writeOff.date,
      reference: 'Castigo',
      description: writeOff.reason,
      debit: 0,
      credit: writeOff.amount,
    });
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference));
}

export default function Cartera({ page, onNavigate }: Props) {
  const { state, update } = useFinance();
  const slug = page.split('/')[1] ?? 'partidas';
  const activeSlug = SLUGS.includes(slug) ? slug : 'partidas';

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionTarget, setCollectionTarget] = useState('');
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [writeOffTarget, setWriteOffTarget] = useState('');
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceApply, setAdvanceApply] = useState<{ receivableId?: string; advanceId?: string } | null>(null);
  const [statementParty, setStatementParty] = useState('');
  const [applicationReceiptId, setApplicationReceiptId] = useState('');
  const [toast, setToast] = useState('');

  const openRows = useMemo(
    () => state.receivables.filter(item => item.balance > 0.005 && item.status !== 'Pagada' && item.status !== 'Castigada'),
    [state.receivables],
  );

  const kpis: CarteraKpis = useMemo(() => {
    const month = HOY.slice(0, 7);
    const monthReceipts = state.receipts.filter(item => item.date.startsWith(month));
    const overdueRows = openRows.filter(item => daysBetween(item.dueDate, HOY) > 0);
    const next15Rows = openRows.filter(item => {
      const days = daysBetween(HOY, item.dueDate);
      return days >= 0 && days <= 15;
    });
    return {
      total: totalOf(openRows),
      overdue: totalOf(overdueRows),
      next15: totalOf(next15Rows),
      collected: monthReceipts.reduce((total, item) => total + item.amount, 0),
      openCount: openRows.length,
      monthReceipts: monthReceipts.length,
    };
  }, [openRows, state.receipts]);

  const selected = selectedId ? state.receivables.find(item => item.id === selectedId) ?? null : null;

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(''), 3500);
  }

  function createReceipt(payload: ReceiptDraft) {
    const number = nextDocumentNumber(state.receipts.map(item => item.number), 'REC');
    const id = newId('rec');
    update(draft => {
      draft.receipts.unshift({
        id,
        number,
        partyId: payload.partyId,
        date: payload.date,
        method: payload.method,
        accountId: payload.accountId,
        amount: payload.amount,
        applied: 0,
        reference: payload.reference.trim(),
        status: 'Sin aplicar',
      });
      const account = draft.accounts.find(item => item.id === payload.accountId);
      if (account) account.balance += payload.amount;
    }, `Recibo ${number} registrado por ${money(payload.amount)}`, 'cartera');
    setApplicationReceiptId(id);
    setReceiptOpen(false);
    showToast(`Recibo ${number} registrado. Queda disponible para aplicar.`);
  }

  function registerCollection(payload: CollectionDraft) {
    const receivable = receivableOf(state, payload.receivableId);
    const hasPromise = payload.promiseDate !== '' && payload.promiseAmount > 0;
    update(draft => {
      const target = draft.receivables.find(item => item.id === payload.receivableId);
      draft.collections.unshift({
        id: newId('col'),
        receivableId: payload.receivableId,
        date: HOY,
        channel: payload.channel,
        result: payload.result,
        note: payload.note.trim(),
        user: USUARIO.nombre,
        promiseDate: hasPromise ? payload.promiseDate : '',
        promiseAmount: hasPromise ? payload.promiseAmount : 0,
        fulfilled: hasPromise ? 'Pendiente' : 'No aplica',
      });
      if (target) {
        target.lastAction = payload.result === 'Promesa'
          ? `Promesa de pago para ${fmtDate(payload.promiseDate)}`
          : `${payload.result}: ${payload.note.trim()}`;
        if (hasPromise) {
          target.promiseDate = payload.promiseDate;
          target.promiseAmount = payload.promiseAmount;
        }
        if (payload.result === 'Acuerdo') target.status = 'Acuerdo de pago';
      }
    }, `Gestión de cobro (${payload.channel}) registrada para ${receivable?.invoiceNumber ?? 'partida'}`, 'cartera');
    setCollectionOpen(false);
    setCollectionTarget('');
    showToast(`Gestión registrada para ${receivable?.invoiceNumber ?? 'la partida'}.`);
  }

  function requestWriteOff(payload: WriteOffDraft) {
    const receivable = receivableOf(state, payload.receivableId);
    update(draft => {
      const target = draft.receivables.find(item => item.id === payload.receivableId);
      draft.writeOffs.unshift({
        id: newId('wo'),
        receivableId: payload.receivableId,
        date: HOY,
        amount: payload.amount,
        reason: payload.reason.trim(),
        status: 'Solicitado',
        requestedBy: USUARIO.nombre,
      });
      if (target) target.lastAction = `Castigo solicitado por ${money(payload.amount)}`;
    }, `Solicitud de castigo para ${receivable?.invoiceNumber ?? 'partida'} por ${money(payload.amount)}`, 'cartera');
    setWriteOffOpen(false);
    setWriteOffTarget('');
    showToast(`Solicitud de castigo registrada para ${receivable?.invoiceNumber ?? 'la partida'}.`);
  }

  function approveWriteOff(id: string) {
    const writeOff = state.writeOffs.find(item => item.id === id);
    update(draft => {
      const target = draft.writeOffs.find(item => item.id === id);
      if (!target || target.status !== 'Solicitado') return;
      target.status = 'Aprobado';
      const receivable = draft.receivables.find(item => item.id === target.receivableId);
      if (receivable) {
        receivable.balance = 0;
        receivable.status = 'Castigada';
        receivable.promiseDate = '';
        receivable.promiseAmount = 0;
        receivable.lastAction = `Castigo aprobado por ${money(target.amount)}`;
      }
    }, `Castigo aprobado por ${money(writeOff?.amount ?? 0)}`, 'cartera');
    showToast('Castigo aprobado. La partida quedó cerrada.');
  }

  function rejectWriteOff(id: string) {
    update(draft => {
      const target = draft.writeOffs.find(item => item.id === id);
      if (!target || target.status !== 'Solicitado') return;
      target.status = 'Rechazado';
      const receivable = draft.receivables.find(item => item.id === target.receivableId);
      if (receivable) receivable.lastAction = 'Solicitud de castigo rechazada';
    }, 'Solicitud de castigo rechazada', 'cartera');
    showToast('Solicitud de castigo rechazada.');
  }

  function applyReceipt(receiptId: string, allocations: Allocation[]) {
    const receipt = state.receipts.find(item => item.id === receiptId);
    if (!receipt) return;
    let remaining = receiptAvailable(receipt);
    const normalized: Allocation[] = [];
    for (const allocation of allocations) {
      if (remaining <= 0.005) break;
      const receivable = receivableOf(state, allocation.receivableId);
      if (!receivable || receivable.partyId !== receipt.partyId || receivable.balance <= 0.005) continue;
      const value = roundMoney(Math.min(allocation.amount, receivable.balance, remaining));
      if (value <= 0) continue;
      normalized.push({ receivableId: receivable.id, amount: value });
      remaining -= value;
    }
    if (normalized.length === 0) {
      showToast('No hay valores válidos por aplicar.');
      return;
    }
    const applied = normalized.reduce((total, item) => total + item.amount, 0);
    update(draft => {
      const target = draft.receipts.find(item => item.id === receiptId);
      if (!target) return;
      for (const allocation of normalized) {
        const receivable = draft.receivables.find(item => item.id === allocation.receivableId);
        if (!receivable) continue;
        receivable.balance = Math.max(0, receivable.balance - allocation.amount);
        if (receivable.balance <= 0.005) {
          receivable.balance = 0;
          receivable.status = 'Pagada';
          receivable.promiseDate = '';
          receivable.promiseAmount = 0;
        }
        receivable.lastAction = `Aplicación del recibo ${target.number}`;
        draft.applications.unshift({
          id: newId('app'),
          receiptId: target.id,
          receivableId: receivable.id,
          amount: allocation.amount,
          date: HOY,
        });
        target.applied += allocation.amount;
      }
      target.status = target.applied >= target.amount - 0.005 ? 'Aplicado' : target.applied > 0 ? 'Parcial' : 'Sin aplicar';
    }, `Aplicación del recibo ${receipt.number} por ${money(applied)}`, 'cartera');
    showToast(`Recibo ${receipt.number}: ${money(applied)} aplicados a cartera.`);
  }

  function applyAdvance(payload: { advanceId: string; receivableId: string; amount: number }) {
    const advance = state.advances.find(item => item.id === payload.advanceId);
    const receivable = receivableOf(state, payload.receivableId);
    if (!advance || !receivable || advance.partyId !== receivable.partyId) return;
    const value = roundMoney(Math.min(payload.amount, advanceAvailable(advance), receivable.balance));
    if (value <= 0) {
      showToast('El valor del anticipo no es válido.');
      return;
    }
    update(draft => {
      const targetAdvance = draft.advances.find(item => item.id === payload.advanceId);
      const targetReceivable = draft.receivables.find(item => item.id === payload.receivableId);
      if (!targetAdvance || !targetReceivable) return;
      targetAdvance.applied += value;
      targetReceivable.balance = Math.max(0, targetReceivable.balance - value);
      if (targetReceivable.balance <= 0.005) {
        targetReceivable.balance = 0;
        targetReceivable.status = 'Pagada';
        targetReceivable.promiseDate = '';
        targetReceivable.promiseAmount = 0;
      }
      targetReceivable.lastAction = `Anticipo ${targetAdvance.number} aplicado`;
      draft.applications.unshift({
        id: newId('app'),
        receiptId: targetAdvance.id,
        receivableId: targetReceivable.id,
        amount: value,
        date: HOY,
      });
    }, `Anticipo ${advance.number} aplicado por ${money(value)}`, 'cartera');
    setAdvanceApply(null);
    showToast(`Anticipo ${advance.number}: ${money(value)} aplicados a ${receivable.invoiceNumber}.`);
  }

  function createAdvance(payload: AdvanceDraft) {
    const number = nextDocumentNumber(
      state.advances.filter(item => item.direction === 'AR').map(item => item.number),
      'ANT',
    );
    update(draft => {
      draft.advances.unshift({
        id: newId('adv'),
        number,
        partyId: payload.partyId,
        date: payload.date,
        amount: payload.amount,
        applied: 0,
        reference: payload.reference.trim(),
        direction: 'AR',
      });
    }, `Anticipo ${number} registrado por ${money(payload.amount)}`, 'cartera');
    setAdvanceOpen(false);
    showToast(`Anticipo ${number} registrado para el cliente.`);
  }

  function resolvePromise(collectionId: string, fulfilled: 'Cumplida' | 'Incumplida') {
    const collection = state.collections.find(item => item.id === collectionId);
    if (!collection) return;
    update(draft => {
      const target = draft.collections.find(item => item.id === collectionId);
      if (!target) return;
      target.fulfilled = fulfilled;
      const receivable = draft.receivables.find(item => item.id === target.receivableId);
      if (receivable) {
        receivable.promiseDate = '';
        receivable.promiseAmount = 0;
        receivable.lastAction = `${fulfilled === 'Cumplida' ? 'Promesa cumplida' : 'Promesa incumplida'} (${fmtDate(target.promiseDate)})`;
        if (receivable.balance > 0.005 && (fulfilled === 'Incumplida' || receivable.status === 'Acuerdo de pago')) {
          receivable.status = daysBetween(receivable.dueDate, HOY) > 0 ? 'Vencida' : 'Por vencer';
        }
      }
    }, `Promesa marcada como ${fulfilled.toLowerCase()}`, 'cartera');
    showToast(`Promesa marcada como ${fulfilled.toLowerCase()}.`);
  }

  function headerAction() {
    if (activeSlug === 'partidas' || activeSlug === 'cobro') {
      return (
        <Button variant="primary" onClick={() => { setCollectionTarget(''); setCollectionOpen(true); }}>
          <Icon name="plus" className="h-3.5 w-3.5" /> Registrar gestión
        </Button>
      );
    }
    if (activeSlug === 'recibos' || activeSlug === 'aplicacion') {
      return (
        <Button variant="primary" onClick={() => setReceiptOpen(true)}>
          <Icon name="plus" className="h-3.5 w-3.5" /> Nuevo recibo
        </Button>
      );
    }
    if (activeSlug === 'ajustes') {
      return (
        <Button variant="primary" onClick={() => { setWriteOffTarget(''); setWriteOffOpen(true); }}>
          <Icon name="plus" className="h-3.5 w-3.5" /> Solicitar castigo
        </Button>
      );
    }
    if (activeSlug === 'anticipos') {
      return (
        <Button variant="primary" onClick={() => setAdvanceOpen(true)}>
          <Icon name="plus" className="h-3.5 w-3.5" /> Registrar anticipo
        </Button>
      );
    }
    return undefined;
  }

  const header = TITULOS[activeSlug] ?? TITULOS.partidas;

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4 lg:p-5">
      <PageHeader eyebrow={MODULE.name} title={header.title} subtitle={header.subtitle} actions={headerAction()} />

      {activeSlug === 'partidas' && (
        <PartidasView
          state={state}
          kpis={kpis}
          query={query}
          status={status}
          onQuery={setQuery}
          onStatus={setStatus}
          onOpen={setSelectedId}
        />
      )}

      {activeSlug === 'recibos' && (
        <RecibosView
          state={state}
          onNew={() => setReceiptOpen(true)}
          onApply={id => { setApplicationReceiptId(id); onNavigate('cartera/aplicacion'); }}
        />
      )}

      {activeSlug === 'aplicacion' && (
        <AplicacionView
          key={applicationReceiptId || 'aplicacion'}
          state={state}
          initialReceiptId={applicationReceiptId}
          onNew={() => setReceiptOpen(true)}
          onApply={applyReceipt}
        />
      )}

      {activeSlug === 'edades' && <EdadesView state={state} />}

      {activeSlug === 'estados-cuenta' && (
        <EstadosCuentaView state={state} partyId={statementParty} onParty={setStatementParty} />
      )}

      {activeSlug === 'cobro' && (
        <CobroView
          state={state}
          onNew={() => { setCollectionTarget(''); setCollectionOpen(true); }}
          onResolve={resolvePromise}
          onOpen={setSelectedId}
        />
      )}

      {activeSlug === 'ajustes' && (
        <AjustesView
          state={state}
          onNew={() => { setWriteOffTarget(''); setWriteOffOpen(true); }}
          onApprove={approveWriteOff}
          onReject={rejectWriteOff}
        />
      )}

      {activeSlug === 'anticipos' && (
        <AnticiposView
          state={state}
          onNew={() => setAdvanceOpen(true)}
          onApply={advanceId => setAdvanceApply({ advanceId })}
        />
      )}

      {selected && (
        <ReceivableDrawer
          state={state}
          receivable={selected}
          onClose={() => setSelectedId(null)}
          onCollection={id => { setCollectionTarget(id); setCollectionOpen(true); }}
          onWriteOff={id => { setWriteOffTarget(id); setWriteOffOpen(true); }}
          onAdvance={id => setAdvanceApply({ receivableId: id })}
          onStatement={partyId => {
            setStatementParty(partyId);
            setSelectedId(null);
            onNavigate('cartera/estados-cuenta');
          }}
        />
      )}

      {receiptOpen && <ReceiptModal state={state} onClose={() => setReceiptOpen(false)} onSave={createReceipt} />}
      {collectionOpen && (
        <CollectionModal
          state={state}
          initialReceivableId={collectionTarget}
          onClose={() => { setCollectionOpen(false); setCollectionTarget(''); }}
          onSave={registerCollection}
        />
      )}
      {writeOffOpen && (
        <WriteOffModal
          state={state}
          initialReceivableId={writeOffTarget}
          onClose={() => { setWriteOffOpen(false); setWriteOffTarget(''); }}
          onSave={requestWriteOff}
        />
      )}
      {advanceOpen && <AdvanceModal state={state} onClose={() => setAdvanceOpen(false)} onSave={createAdvance} />}
      {advanceApply && (
        <AdvanceApplyModal
          state={state}
          receivableId={advanceApply.receivableId}
          advanceId={advanceApply.advanceId}
          onClose={() => setAdvanceApply(null)}
          onApply={applyAdvance}
        />
      )}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-xl bg-[#001F4C] px-4 py-3 text-xs text-white shadow-2xl">
          <Icon name="check" className="h-4 w-4 text-emerald-300" />
          {toast}
        </div>
      )}
    </div>
  );
}

function PartidasView({ state, kpis, query, status, onQuery, onStatus, onOpen }: {
  state: FinanceState;
  kpis: CarteraKpis;
  query: string;
  status: string;
  onQuery: (value: string) => void;
  onStatus: (value: string) => void;
  onOpen: (id: string) => void;
}) {
  const openRows = state.receivables.filter(item => item.balance > 0.005 && item.status !== 'Pagada' && item.status !== 'Castigada');
  const aging = receivableAging(openRows);
  const agingTotal = AGING_BUCKETS.reduce((total, bucket) => total + aging[bucket], 0);
  const haystack = query.trim().toLowerCase();

  const rows = state.receivables
    .filter(item => status === 'Todos' || item.status === status)
    .filter(item => {
      if (haystack === '') return true;
      const party = partyOf(state, item.partyId);
      return item.invoiceNumber.toLowerCase().includes(haystack)
        || (party?.name.toLowerCase().includes(haystack) ?? false)
        || (party?.nit.toLowerCase().includes(haystack) ?? false)
        || item.owner.toLowerCase().includes(haystack);
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const filteredBalance = rows.reduce((total, row) => total + row.balance, 0);

  const columns: Column<Receivable>[] = [
    { header: 'Documento', cell: row => <span className="font-mono font-semibold text-gray-800">{row.invoiceNumber}</span> },
    { header: 'Cliente', cell: row => <span className="block max-w-56 truncate">{partyOf(state, row.partyId)?.name ?? '—'}</span> },
    { header: 'NIT', cell: row => <span className="font-mono text-[11px] text-gray-500">{partyOf(state, row.partyId)?.nit ?? '—'}</span> },
    { header: 'Emisión', cell: row => fmtDate(row.issueDate) },
    { header: 'Vencimiento', cell: row => fmtDate(row.dueDate) },
    {
      header: 'Días vencidos',
      align: 'right',
      cell: row => {
        const days = daysBetween(row.dueDate, HOY);
        return days > 0 && row.balance > 0
          ? <span className="font-semibold text-red-600">{days}</span>
          : <span className="text-gray-400">—</span>;
      },
    },
    { header: 'Saldo', align: 'right', cell: row => <Money value={row.balance} className="font-semibold" /> },
    { header: 'Estado', cell: row => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Saldo total" value={money(kpis.total)} detail={`${kpis.openCount} partida${kpis.openCount === 1 ? '' : 's'} abierta${kpis.openCount === 1 ? '' : 's'}`} tone="blue" />
        <KpiCard label="Vencido" value={money(kpis.overdue)} detail="Requiere gestión inmediata" tone="red" />
        <KpiCard label="Por vencer 15 días" value={money(kpis.next15)} detail="Próximos vencimientos" tone="amber" />
        <KpiCard label="Recaudo del mes" value={money(kpis.collected)} detail={`${kpis.monthReceipts} recibo${kpis.monthReceipts === 1 ? '' : 's'} registrado${kpis.monthReceipts === 1 ? '' : 's'}`} tone="green" />
      </div>

      <Card>
        <SectionTitle title="Aging compacto" detail="Distribución del saldo abierto por edades de vencimiento." />
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {AGING_BUCKETS.map(bucket => (
              <div key={bucket} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  <span className={`h-2 w-2 rounded-sm ${AGING_BAR[bucket]}`} />
                  {bucket}
                </div>
                <div className="mt-1 text-xs font-semibold text-gray-800"><Money value={aging[bucket]} /></div>
              </div>
            ))}
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-gray-100">
            {AGING_BUCKETS.map(bucket => (
              <div
                key={bucket}
                className={AGING_BAR[bucket]}
                style={{ width: `${agingTotal > 0 ? (aging[bucket] / agingTotal) * 100 : 0}%` }}
                title={`${bucket}: ${money(aging[bucket])}`}
              />
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <FilterBar>
          <SearchInput placeholder="Buscar documento, cliente, NIT o responsable…" value={query} onChange={event => onQuery(event.target.value)} />
          <FilterSelect value={status} onChange={event => onStatus(event.target.value)} aria-label="Estado de la partida">
            {['Todos', ...RECEIVABLE_STATUSES].map(value => <option key={value}>{value}</option>)}
          </FilterSelect>
        </FilterBar>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={row => row.id}
          onRowClick={row => onOpen(row.id)}
          empty="No hay partidas de cartera con los filtros aplicados."
          footer={(
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
              <span>{rows.length} partidas · clic en una fila para ver el detalle y gestionar el cobro.</span>
              <span>Saldo filtrado <strong className="ml-1 tabular text-gray-800">{money(filteredBalance)}</strong></span>
            </div>
          )}
        />
      </Card>
    </>
  );
}

function RecibosView({ state, onNew, onApply }: {
  state: FinanceState;
  onNew: () => void;
  onApply: (id: string) => void;
}) {
  const rows = [...state.receipts].sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  const available = rows.reduce((total, row) => total + receiptAvailable(row), 0);

  const columns: Column<Receipt>[] = [
    { header: 'Número', cell: row => <span className="font-mono font-semibold text-gray-800">{row.number}</span> },
    { header: 'Cliente', cell: row => <span className="block max-w-56 truncate">{partyOf(state, row.partyId)?.name ?? '—'}</span> },
    { header: 'Fecha', cell: row => fmtDate(row.date) },
    { header: 'Medio', cell: row => <Badge tone="blue">{row.method}</Badge> },
    { header: 'Cuenta', cell: row => <span className="text-[11px] text-gray-500">{accountLabel(state, row.accountId)}</span> },
    { header: 'Valor', align: 'right', cell: row => <Money value={row.amount} className="font-semibold" /> },
    { header: 'Aplicado', align: 'right', cell: row => <Money value={row.applied} /> },
    {
      header: 'Saldo',
      align: 'right',
      cell: row => {
        const pending = receiptAvailable(row);
        return <Money value={pending} className={pending > 0 ? 'font-semibold text-amber-700' : 'text-gray-400'} />;
      },
    },
    { header: 'Estado', cell: row => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => receiptAvailable(row) > 0.005
        ? <Button size="sm" variant="ghost" onClick={() => onApply(row.id)}>Aplicar</Button>
        : <span className="text-[10px] text-gray-400">Cerrado</span>,
    },
  ];

  return (
    <Card>
      <SectionTitle
        title="Recibos registrados"
        detail={`${rows.length} recibos · ${money(available)} disponibles por aplicar.`}
        action={<Button variant="primary" size="sm" onClick={onNew}><Icon name="plus" className="h-3.5 w-3.5" /> Nuevo recibo</Button>}
      />
      <DataTable columns={columns} rows={rows} rowKey={row => row.id} empty="Aún no hay recibos de caja registrados." />
    </Card>
  );
}

function AplicacionView({ state, initialReceiptId, onNew, onApply }: {
  state: FinanceState;
  initialReceiptId: string;
  onNew: () => void;
  onApply: (receiptId: string, allocations: Allocation[]) => void;
}) {
  const [selectedId, setSelectedId] = useState(initialReceiptId);
  const receipts = state.receipts
    .filter(item => receiptAvailable(item) > 0.005)
    .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
  const selected = receipts.find(item => item.id === selectedId) ?? receipts[0] ?? null;

  if (receipts.length === 0) {
    return (
      <EmptyState
        title="No hay recibos con saldo disponible"
        detail="Registre un recibo de caja para poder aplicarlo contra las partidas abiertas del cliente."
        action={<Button variant="primary" onClick={onNew}><Icon name="plus" className="h-3.5 w-3.5" /> Nuevo recibo</Button>}
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[21rem_1fr]">
      <Card>
        <SectionTitle title="Recibos con saldo" detail={`${receipts.length} disponibles para aplicar.`} />
        <div className="max-h-[38rem] space-y-2 overflow-y-auto p-3">
          {receipts.map(receipt => {
            const active = selected?.id === receipt.id;
            return (
              <button
                key={receipt.id}
                type="button"
                onClick={() => setSelectedId(receipt.id)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${active ? 'border-petroleum-300 bg-petroleum-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-gray-800">{receipt.number}</span>
                  <span className="tabular text-[11px] font-semibold text-amber-700">{money(receiptAvailable(receipt))}</span>
                </div>
                <div className="mt-1 truncate text-[11px] text-gray-600">{partyOf(state, receipt.partyId)?.name ?? '—'}</div>
                <div className="mt-0.5 flex items-center justify-between text-[10px] text-gray-400">
                  <span>{fmtDate(receipt.date)} · {receipt.method}</span>
                  <Badge tone={statusTone(receipt.status)}>{receipt.status}</Badge>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {selected && (
        <ApplicationPanel
          key={selected.id}
          state={state}
          receipt={selected}
          onApply={allocations => onApply(selected.id, allocations)}
        />
      )}
    </div>
  );
}

function ApplicationPanel({ state, receipt, onApply }: {
  state: FinanceState;
  receipt: Receipt;
  onApply: (allocations: Allocation[]) => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const party = partyOf(state, receipt.partyId);
  const available = receiptAvailable(receipt);
  const receivables = state.receivables
    .filter(item => item.partyId === receipt.partyId && item.balance > 0.005 && item.status !== 'Pagada' && item.status !== 'Castigada')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const parsed = receivables.map(item => {
    const value = Number(amounts[item.id] ?? '');
    return { receivable: item, amount: Number.isFinite(value) ? Math.max(0, value) : 0 };
  });
  const total = parsed.reduce((sum, item) => sum + item.amount, 0);
  const difference = available - total;
  const rowExceeded = parsed.some(item => item.amount > item.receivable.balance + 0.005);
  const receiptExceeded = total > available + 0.005;
  const valid = total > 0 && !rowExceeded && !receiptExceeded;

  function changeAmount(id: string, value: string) {
    setAmounts(current => ({ ...current, [id]: value }));
  }

  function submit() {
    if (!valid) return;
    onApply(parsed.filter(item => item.amount > 0).map(item => ({ receivableId: item.receivable.id, amount: item.amount })));
    setAmounts({});
  }

  return (
    <Card>
      <SectionTitle
        title={`Aplicar ${receipt.number}`}
        detail={`${party?.name ?? '—'} · ${fmtDate(receipt.date)} · ${receipt.method}`}
        action={<Badge tone={statusTone(receipt.status)}>{receipt.status}</Badge>}
      />

      <div className="grid gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 sm:grid-cols-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-400">Valor del recibo</div>
          <div className="text-sm font-semibold text-gray-800"><Money value={receipt.amount} /></div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-400">Ya aplicado</div>
          <div className="text-sm font-semibold text-gray-800"><Money value={receipt.applied} /></div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-gray-400">Disponible</div>
          <div className="text-sm font-semibold text-amber-700"><Money value={available} /></div>
        </div>
      </div>

      {receivables.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="El cliente no tiene partidas abiertas"
            detail="Todas las partidas de este cliente están cerradas o no tienen saldo pendiente."
          />
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <div className="space-y-2">
            {parsed.map(({ receivable, amount }) => {
              const excess = amount > receivable.balance + 0.005;
              const days = daysBetween(receivable.dueDate, HOY);
              return (
                <div key={receivable.id} className="rounded-lg border border-gray-200 px-3 py-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-gray-800">{receivable.invoiceNumber}</span>
                        <Badge tone={statusTone(receivable.status)}>{receivable.status}</Badge>
                        {days > 0 && <span className="text-[10px] font-semibold text-red-600">{days} días vencida</span>}
                      </div>
                      <div className="mt-1 text-[11px] text-gray-500">
                        Vence {fmtDate(receivable.dueDate)} · Saldo <Money value={receivable.balance} />
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-500 sm:text-right">
                      Aplicar
                    </div>
                    <div>
                      <input
                        type="number"
                        min={0}
                        max={receivable.balance}
                        step={1000}
                        className={INPUT}
                        value={amounts[receivable.id] ?? ''}
                        placeholder="0"
                        onChange={event => changeAmount(receivable.id, event.target.value)}
                      />
                      {excess && <p className="mt-1 text-[10px] font-medium text-red-600">Excede el saldo de la partida.</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="grid grid-cols-2 gap-4 text-[11px] sm:grid-cols-3">
              <div>
                <div className="text-gray-500">Total asignado</div>
                <div className="font-semibold text-gray-800"><Money value={total} /></div>
              </div>
              <div>
                <div className="text-gray-500">Diferencia</div>
                <div className={`font-semibold ${difference < -0.005 ? 'text-red-600' : 'text-emerald-700'}`}>
                  <Money value={difference} />
                </div>
              </div>
              <div className="hidden sm:block">
                <div className="text-gray-500">Disponible del recibo</div>
                <div className="font-semibold text-gray-800"><Money value={available} /></div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button variant="primary" disabled={!valid} onClick={submit}>Aplicar pagos</Button>
              {receiptExceeded && <span className="text-[10px] font-medium text-red-600">La suma excede el disponible del recibo.</span>}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

interface AgingRow {
  partyId: string;
  name: string;
  nit: string;
  count: number;
  ages: Record<AgingBucket, number>;
  total: number;
}

function EdadesView({ state }: { state: FinanceState }) {
  const [partyFilter, setPartyFilter] = useState('Todos');

  const rows = useMemo(() => {
    const groups = new Map<string, AgingRow>();
    for (const receivable of state.receivables) {
      if (receivable.balance <= 0.005 || receivable.status === 'Pagada' || receivable.status === 'Castigada') continue;
      const party = state.parties.find(item => item.id === receivable.partyId);
      let group = groups.get(receivable.partyId);
      if (!group) {
        group = {
          partyId: receivable.partyId,
          name: party?.name ?? '—',
          nit: party?.nit ?? '—',
          count: 0,
          ages: receivableAging([]),
          total: 0,
        };
        groups.set(receivable.partyId, group);
      }
      group.ages[agingBucket(receivable.dueDate)] += receivable.balance;
      group.total += receivable.balance;
      group.count += 1;
    }
    return Array.from(groups.values()).sort((a, b) => b.total - a.total);
  }, [state.parties, state.receivables]);

  const filtered = partyFilter === 'Todos' ? rows : rows.filter(row => row.partyId === partyFilter);
  const totals = receivableAging([]);
  for (const row of filtered) {
    for (const bucket of AGING_BUCKETS) totals[bucket] += row.ages[bucket];
  }
  const grandTotal = AGING_BUCKETS.reduce((total, bucket) => total + totals[bucket], 0);

  return (
    <>
      <Card>
        <SectionTitle title="Distribución por edades" detail={`${money(grandTotal)} de saldo abierto en ${filtered.length} clientes.`} />
        <div className="space-y-3 p-4">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-gray-100">
            {AGING_BUCKETS.map(bucket => (
              <div
                key={bucket}
                className={AGING_BAR[bucket]}
                style={{ width: `${grandTotal > 0 ? (totals[bucket] / grandTotal) * 100 : 0}%` }}
                title={`${bucket}: ${money(totals[bucket])}`}
              />
            ))}
          </div>
          <StackedLegend items={AGING_BUCKETS.map(bucket => ({ label: bucket, tone: AGING_TONE[bucket], value: money(totals[bucket]) }))} />
          <div className="flex justify-between border-t border-gray-100 pt-2 text-[11px] text-gray-500">
            <span>Total cartera abierta</span>
            <strong className="tabular text-gray-800">{money(grandTotal)}</strong>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Matriz por cliente" detail="Saldo pendiente agrupado por rango de vencimiento." />
        <FilterBar>
          <FilterSelect value={partyFilter} onChange={event => setPartyFilter(event.target.value)} aria-label="Cliente">
            <option>Todos</option>
            {rows.map(row => <option key={row.partyId} value={row.partyId}>{row.name}</option>)}
          </FilterSelect>
        </FilterBar>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Cliente</th>
                {AGING_BUCKETS.map(bucket => <th key={bucket} className="px-3 py-2.5 text-right font-semibold text-gray-600">{bucket}</th>)}
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">No hay saldos abiertos para el filtro seleccionado.</td></tr>
              )}
              {filtered.map(row => (
                <tr key={row.partyId} className="hover:bg-petroleum-50/40">
                  <td className="px-3 py-2.5">
                    <div className="max-w-64 truncate font-medium text-gray-800">{row.name}</div>
                    <div className="text-[10px] text-gray-400">{row.nit} · {row.count} partidas</div>
                  </td>
                  {AGING_BUCKETS.map(bucket => (
                    <td key={bucket} className={`px-3 py-2.5 text-right ${bucket === '+90' && row.ages[bucket] > 0 ? 'font-semibold text-red-600' : 'text-gray-700'}`}>
                      {row.ages[bucket] > 0 ? money(row.ages[bucket]) : '—'}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{money(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 bg-gray-50">
              <tr>
                <td className="px-3 py-2.5 font-semibold text-gray-700">Totales por columna</td>
                {AGING_BUCKETS.map(bucket => <td key={bucket} className="px-3 py-2.5 text-right font-semibold text-gray-800">{money(totals[bucket])}</td>)}
                <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{money(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  );
}

function EstadosCuentaView({ state, partyId, onParty }: {
  state: FinanceState;
  partyId: string;
  onParty: (id: string) => void;
}) {
  const clients = state.parties.filter(item => item.kind !== 'Proveedor');
  const defaultPartyId = clients.find(item => state.receivables.some(row => row.partyId === item.id && row.balance > 0))?.id ?? clients[0]?.id ?? '';
  const selectedPartyId = clients.some(item => item.id === partyId) ? partyId : defaultPartyId;
  const party = state.parties.find(item => item.id === selectedPartyId);
  const [from, setFrom] = useState(`${HOY.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(HOY);

  const entries = useMemo(() => buildStatementEntries(state, selectedPartyId), [state, selectedPartyId]);
  const summary = useMemo(() => {
    const rows = state.receivables.filter(item => item.partyId === selectedPartyId && item.balance > 0.005 && item.status !== 'Pagada' && item.status !== 'Castigada');
    const overdueRows = rows.filter(item => daysBetween(item.dueDate, HOY) > 0);
    const upcomingRows = rows.filter(item => daysBetween(item.dueDate, HOY) <= 0);
    return {
      total: rows.reduce((total, item) => total + item.balance, 0),
      overdue: overdueRows.reduce((total, item) => total + item.balance, 0),
      upcoming: upcomingRows.reduce((total, item) => total + item.balance, 0),
      overdueCount: overdueRows.length,
      upcomingCount: upcomingRows.length,
    };
  }, [selectedPartyId, state.receivables]);

  const opening = entries
    .filter(entry => entry.date < from)
    .reduce((total, entry) => total + entry.debit - entry.credit, 0);
  const visible = from <= to ? entries.filter(entry => entry.date >= from && entry.date <= to) : [];
  let running = opening;
  const statementRows: StatementRow[] = visible.map(entry => {
    running += entry.debit - entry.credit;
    return { ...entry, balance: running };
  });
  const totalDebit = visible.reduce((total, entry) => total + entry.debit, 0);
  const totalCredit = visible.reduce((total, entry) => total + entry.credit, 0);
  const cupoAvailable = Math.max(0, (party?.cupo ?? 0) - summary.total);

  if (!party) {
    return <EmptyState title="Sin clientes disponibles" detail="No hay terceros de tipo cliente para consultar estados de cuenta." />;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Saldo total" value={money(summary.total)} detail={`${summary.overdueCount + summary.upcomingCount} partidas abiertas`} tone="blue" />
        <KpiCard label="Vencido" value={money(summary.overdue)} detail={`${summary.overdueCount} partidas vencidas`} tone="red" />
        <KpiCard label="Por vencer" value={money(summary.upcoming)} detail={`${summary.upcomingCount} partidas vigentes`} tone="amber" />
        <KpiCard label="Cupo disponible" value={money(cupoAvailable)} detail={`Cupo asignado ${money(party.cupo)}`} tone="green" />
      </div>

      <Card>
        <SectionTitle
          title="Estado de cuenta"
          detail={`${party.name} · NIT ${party.nit} · ${party.city}`}
          action={<Button variant="secondary" size="sm" onClick={() => window.print()}><Icon name="document" className="h-3.5 w-3.5" /> Imprimir</Button>}
        />
        <div className="space-y-3 border-b border-gray-100 px-4 py-3 text-[11px] text-gray-600">
          <div className="grid gap-2 sm:grid-cols-4">
            <div><span className="text-gray-400">Contacto</span><div>{party.email || '—'}</div></div>
            <div><span className="text-gray-400">Teléfono</span><div>{party.phone || '—'}</div></div>
            <div><span className="text-gray-400">Condición de pago</span><div>{party.term} días</div></div>
            <div><span className="text-gray-400">Cupo de crédito</span><div>{money(party.cupo)}</div></div>
          </div>
        </div>
        <div className="print:hidden">
          <FilterBar>
            <div className="min-w-40 flex-1">
              <Field label="Cliente">
                <select className={INPUT} value={selectedPartyId} onChange={event => onParty(event.target.value)}>
                  {clients.map(item => <option key={item.id} value={item.id}>{item.name} · {item.nit}</option>)}
                </select>
              </Field>
            </div>
            <div>
              <Field label="Desde">
                <input type="date" className={INPUT} value={from} onChange={event => setFrom(event.target.value)} />
              </Field>
            </div>
            <div>
              <Field label="Hasta">
                <input type="date" className={INPUT} value={to} onChange={event => setTo(event.target.value)} />
              </Field>
            </div>
          </FilterBar>
        </div>
        {from > to && (
          <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            La fecha inicial es posterior a la fecha final. Ajuste el período para ver movimientos.
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Fecha</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Documento</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Concepto</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Débito</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Crédito</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <tr className="bg-gray-50/60 text-gray-500">
                <td className="px-3 py-2">{fmtDate(from)}</td>
                <td className="px-3 py-2">—</td>
                <td className="px-3 py-2">Saldo inicial del período</td>
                <td className="px-3 py-2 text-right text-gray-300">—</td>
                <td className="px-3 py-2 text-right text-gray-300">—</td>
                <td className="px-3 py-2 text-right font-semibold"><Money value={opening} /></td>
              </tr>
              {statementRows.map(row => (
                <tr key={row.id} className="hover:bg-petroleum-50/40">
                  <td className="px-3 py-2.5 whitespace-nowrap">{fmtDate(row.date)}</td>
                  <td className="px-3 py-2.5 font-mono font-medium text-gray-800">{row.reference}</td>
                  <td className="px-3 py-2.5"><span className="block max-w-72 truncate text-gray-600" title={row.description}>{row.description}</span></td>
                  <td className="px-3 py-2.5 text-right">{row.debit > 0 ? <Money value={row.debit} /> : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-right">{row.credit > 0 ? <Money value={row.credit} className="text-emerald-700" /> : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-right font-semibold"><Money value={row.balance} /></td>
                </tr>
              ))}
              {statementRows.length === 0 && from <= to && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">No hay movimientos en el período seleccionado.</td></tr>
              )}
            </tbody>
            <tfoot className="border-t border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={3} className="px-3 py-2.5 font-semibold text-gray-700">Totales del período</td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-800"><Money value={totalDebit} /></td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-800"><Money value={totalCredit} /></td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-900"><Money value={running} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </>
  );
}

function CobroView({ state, onNew, onResolve, onOpen }: {
  state: FinanceState;
  onNew: () => void;
  onResolve: (id: string, fulfilled: 'Cumplida' | 'Incumplida') => void;
  onOpen: (receivableId: string) => void;
}) {
  const promises = state.collections.filter(item => item.promiseDate !== '' && item.promiseAmount > 0);
  const pending = promises.filter(item => item.fulfilled === 'Pendiente');
  const overdue = pending.filter(item => daysBetween(item.promiseDate, HOY) > 0);
  const fulfilled = promises.filter(item => item.fulfilled === 'Cumplida');
  const rows = [...state.collections].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const columns: Column<CollectionAction>[] = [
    {
      header: 'Cliente',
      cell: row => {
        const receivable = receivableOf(state, row.receivableId);
        return (
          <div className="max-w-56">
            <div className="truncate">{receivable ? partyOf(state, receivable.partyId)?.name ?? '—' : '—'}</div>
            <div className="font-mono text-[10px] text-gray-400">{receivable?.invoiceNumber ?? '—'}</div>
          </div>
        );
      },
    },
    { header: 'Canal', cell: row => <Badge tone="blue">{row.channel}</Badge> },
    {
      header: 'Resultado',
      cell: row => (
        <div className="max-w-64">
          <Badge tone={RESULT_TONE[row.result]}>{row.result}</Badge>
          <div className="mt-1 truncate text-[10px] text-gray-400" title={row.note}>{row.note}</div>
        </div>
      ),
    },
    { header: 'Fecha', cell: row => fmtDate(row.date) },
    {
      header: 'Promesa',
      cell: row => row.promiseDate
        ? <div><div>{fmtDate(row.promiseDate)}</div><div className="text-[10px] text-gray-500"><Money value={row.promiseAmount} /></div></div>
        : <span className="text-gray-400">—</span>,
    },
    { header: 'Estado', cell: row => <Badge tone={statusTone(row.fulfilled)}>{row.fulfilled}</Badge> },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => row.fulfilled === 'Pendiente'
        ? (
          <div className="flex justify-end gap-1.5" onClick={event => event.stopPropagation()}>
            <Button size="sm" variant="success" onClick={() => onResolve(row.id, 'Cumplida')}>Cumplida</Button>
            <Button size="sm" variant="danger" onClick={() => onResolve(row.id, 'Incumplida')}>Incumplida</Button>
          </div>
        )
        : <span className="text-[10px] text-gray-400">—</span>,
    },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Promesas pendientes" value={String(pending.length)} detail={money(pending.reduce((total, item) => total + item.promiseAmount, 0))} tone="amber" />
        <KpiCard label="Promesas vencidas" value={String(overdue.length)} detail={money(overdue.reduce((total, item) => total + item.promiseAmount, 0))} tone="red" />
        <KpiCard label="Promesas cumplidas" value={String(fulfilled.length)} detail={money(fulfilled.reduce((total, item) => total + item.promiseAmount, 0))} tone="green" />
      </div>

      <Card>
        <SectionTitle
          title="Gestiones de cobro"
          detail={`${rows.length} gestiones registradas · ${pending.length} promesas pendientes.`}
          action={<Button variant="primary" size="sm" onClick={onNew}><Icon name="plus" className="h-3.5 w-3.5" /> Registrar gestión</Button>}
        />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={row => row.id}
          onRowClick={row => onOpen(row.receivableId)}
          empty="No hay gestiones de cobro registradas."
        />
      </Card>
    </>
  );
}

function AjustesView({ state, onNew, onApprove, onReject }: {
  state: FinanceState;
  onNew: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const rows = [...state.writeOffs].sort((a, b) => b.date.localeCompare(a.date));
  const approved = rows.filter(row => row.status === 'Aprobado').reduce((total, row) => total + row.amount, 0);

  const columns: Column<WriteOff>[] = [
    {
      header: 'Partida',
      cell: row => {
        const receivable = receivableOf(state, row.receivableId);
        return <span className="font-mono font-semibold text-gray-800">{receivable?.invoiceNumber ?? '—'}</span>;
      },
    },
    {
      header: 'Cliente',
      cell: row => {
        const receivable = receivableOf(state, row.receivableId);
        return <span className="block max-w-56 truncate">{receivable ? partyOf(state, receivable.partyId)?.name ?? '—' : '—'}</span>;
      },
    },
    { header: 'Fecha', cell: row => fmtDate(row.date) },
    { header: 'Valor', align: 'right', cell: row => <Money value={row.amount} className="font-semibold" /> },
    {
      header: 'Motivo',
      cell: row => (
        <div className="max-w-72">
          <div className="truncate text-gray-600" title={row.reason}>{row.reason}</div>
          <div className="text-[10px] text-gray-400">Solicitado por {row.requestedBy}</div>
        </div>
      ),
    },
    { header: 'Estado', cell: row => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => row.status === 'Solicitado'
        ? (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="success" onClick={() => onApprove(row.id)}>Aprobar</Button>
            <Button size="sm" variant="secondary" onClick={() => onReject(row.id)}>Rechazar</Button>
          </div>
        )
        : <span className="text-[10px] text-gray-400">—</span>,
    },
  ];

  return (
    <Card>
      <SectionTitle
        title="Castigos y ajustes"
        detail={`${rows.length} solicitudes · ${money(approved)} castigados y aprobados.`}
        action={<Button variant="primary" size="sm" onClick={onNew}><Icon name="plus" className="h-3.5 w-3.5" /> Solicitar castigo</Button>}
      />
      <DataTable columns={columns} rows={rows} rowKey={row => row.id} empty="No hay solicitudes de castigo registradas." />
    </Card>
  );
}

function AnticiposView({ state, onNew, onApply }: {
  state: FinanceState;
  onNew: () => void;
  onApply: (advanceId: string) => void;
}) {
  const rows = state.advances.filter(item => item.direction === 'AR').sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const applied = rows.reduce((sum, row) => sum + row.applied, 0);
  const available = total - applied;

  const columns: Column<Advance>[] = [
    { header: 'Cliente', cell: row => <span className="block max-w-56 truncate">{partyOf(state, row.partyId)?.name ?? '—'}</span> },
    { header: 'Número', cell: row => <span className="font-mono font-semibold text-gray-800">{row.number}</span> },
    { header: 'Fecha', cell: row => fmtDate(row.date) },
    { header: 'Valor', align: 'right', cell: row => <Money value={row.amount} /> },
    { header: 'Aplicado', align: 'right', cell: row => <Money value={row.applied} /> },
    {
      header: 'Saldo',
      align: 'right',
      cell: row => <Money value={advanceAvailable(row)} className={advanceAvailable(row) > 0 ? 'font-semibold text-amber-700' : 'text-gray-400'} />,
    },
    { header: 'Referencia', cell: row => <span className="block max-w-56 truncate text-[11px] text-gray-500">{row.reference || '—'}</span> },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => advanceAvailable(row) > 0.005
        ? <Button size="sm" variant="ghost" onClick={() => onApply(row.id)}>Aplicar a factura</Button>
        : <span className="text-[10px] text-gray-400">Aplicado</span>,
    },
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Anticipos recibidos" value={money(total)} detail={`${rows.length} anticipos de clientes`} tone="violet" />
        <KpiCard label="Aplicado a cartera" value={money(applied)} detail="Valor cruzado con facturas" tone="blue" />
        <KpiCard label="Disponible" value={money(available)} detail="Saldo por aplicar" tone="amber" />
      </div>
      <Card>
        <SectionTitle
          title="Anticipos de clientes"
          detail={`${rows.length} registros · ${money(available)} disponibles para aplicar.`}
          action={<Button variant="primary" size="sm" onClick={onNew}><Icon name="plus" className="h-3.5 w-3.5" /> Registrar anticipo</Button>}
        />
        <DataTable columns={columns} rows={rows} rowKey={row => row.id} empty="No hay anticipos de clientes registrados." />
      </Card>
    </>
  );
}

function ReceivableDrawer({ state, receivable, onClose, onCollection, onWriteOff, onAdvance, onStatement }: {
  state: FinanceState;
  receivable: Receivable;
  onClose: () => void;
  onCollection: (id: string) => void;
  onWriteOff: (id: string) => void;
  onAdvance: (id: string) => void;
  onStatement: (partyId: string) => void;
}) {
  const party = partyOf(state, receivable.partyId);
  const history = state.collections
    .filter(item => item.receivableId === receivable.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const advances = state.advances.filter(item => item.direction === 'AR' && item.partyId === receivable.partyId && advanceAvailable(item) > 0.005);
  const collected = Math.max(0, receivable.original - receivable.balance);
  const progress = receivable.original > 0 ? (collected / receivable.original) * 100 : 0;
  const promiseOverdue = receivable.promiseDate !== '' && daysBetween(receivable.promiseDate, HOY) > 0;

  return (
    <Drawer
      title={`${receivable.invoiceNumber} · ${party?.name ?? 'Cliente'}`}
      subtitle={`Partida de cartera · vence ${fmtDate(receivable.dueDate)}`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone={statusTone(receivable.status)}>{receivable.status}</Badge>
          {receivable.promiseDate !== '' && <Badge tone={promiseOverdue ? 'red' : 'amber'}>Promesa {fmtDate(receivable.promiseDate)}</Badge>}
          {receivable.lastAction && <Badge tone="gray">{receivable.lastAction}</Badge>}
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs">
          <div><div className="text-[10px] text-gray-400">NIT</div><div className="font-mono">{party?.nit ?? '—'}</div></div>
          <div><div className="text-[10px] text-gray-400">Responsable</div><div>{receivable.owner}</div></div>
          <div><div className="text-[10px] text-gray-400">Emisión</div><div>{fmtDate(receivable.issueDate)}</div></div>
          <div><div className="text-[10px] text-gray-400">Vencimiento</div><div>{fmtDate(receivable.dueDate)}</div></div>
          <div><div className="text-[10px] text-gray-400">Valor original</div><Money value={receivable.original} /></div>
          <div><div className="text-[10px] text-gray-400">Saldo pendiente</div><Money value={receivable.balance} className="font-semibold text-gray-900" /></div>
        </div>

        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between text-[11px] text-gray-500">
            <span>Recaudado de la partida</span>
            <span className="tabular text-gray-800">{money(collected)}</span>
          </div>
          <Progress value={progress} tone={progress >= 100 ? 'green' : 'blue'} label="Avance de pago" />
        </Card>

        {receivable.promiseDate !== '' ? (
          <div className={`rounded-xl border p-3 text-[11px] ${promiseOverdue ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <div className="flex items-center justify-between gap-2">
              <strong>Promesa de pago vigente</strong>
              <Badge tone={promiseOverdue ? 'red' : 'amber'}>{promiseOverdue ? 'Vencida' : 'Pendiente'}</Badge>
            </div>
            <div className="mt-1">Fecha {fmtDate(receivable.promiseDate)} · Valor <Money value={receivable.promiseAmount} /></div>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 p-3 text-[11px] text-gray-500">Sin promesa de pago activa para esta partida.</div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" onClick={() => onCollection(receivable.id)}>Registrar gestión</Button>
          <Button variant="danger" disabled={receivable.balance <= 0.005} onClick={() => onWriteOff(receivable.id)}>Castigar partida</Button>
          <Button variant="secondary" disabled={advances.length === 0} onClick={() => onAdvance(receivable.id)}>
            Aplicar anticipo{advances.length > 0 ? ` (${advances.length})` : ''}
          </Button>
          <Button variant="ghost" onClick={() => onStatement(receivable.partyId)}>Ver estado de cuenta</Button>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-700">Historial de gestión</h3>
            <span className="text-[10px] text-gray-400">{history.length} gestiones</span>
          </div>
          <div className="space-y-2">
            {history.length === 0 && <p className="text-[11px] text-gray-500">No se han registrado gestiones de cobro para esta partida.</p>}
            {history.map(item => (
              <div key={item.id} className="rounded-lg border border-gray-100 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Badge tone={RESULT_TONE[item.result]}>{item.result}</Badge>
                    <span className="text-[10px] text-gray-500">{item.channel} · {fmtDate(item.date)}</span>
                  </div>
                  <Badge tone={statusTone(item.fulfilled)}>{item.fulfilled}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-gray-600">{item.note}</p>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-400">
                  <span>{item.user}</span>
                  {item.promiseDate !== '' && <span>Promesa {fmtDate(item.promiseDate)} · {money(item.promiseAmount)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function ReceiptModal({ state, onClose, onSave }: {
  state: FinanceState;
  onClose: () => void;
  onSave: (payload: ReceiptDraft) => void;
}) {
  const clients = state.parties.filter(item => item.kind !== 'Proveedor');
  const accounts = state.accounts.filter(item => item.status === 'Activa');
  const [partyId, setPartyId] = useState(clients[0]?.id ?? '');
  const [date, setDate] = useState(HOY);
  const [method, setMethod] = useState<Receipt['method']>('Transferencia');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');

  const value = Number(amount);
  const party = state.parties.find(item => item.id === partyId);
  const valid = partyId !== '' && date !== '' && accountId !== '' && Number.isFinite(value) && value > 0;

  return (
    <Modal
      title="Nuevo recibo de caja"
      subtitle="Registre el recaudo recibido. Quedará disponible para aplicar a partidas del cliente."
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cliente">
            <select className={INPUT} value={partyId} onChange={event => setPartyId(event.target.value)}>
              {clients.map(item => <option key={item.id} value={item.id}>{item.name} · {item.nit}</option>)}
            </select>
          </Field>
          <Field label="Fecha del recibo">
            <input type="date" className={INPUT} value={date} onChange={event => setDate(event.target.value)} />
          </Field>
          <Field label="Medio de recaudo">
            <select className={INPUT} value={method} onChange={event => setMethod(event.target.value as Receipt['method'])}>
              {RECEIPT_METHODS.map(item => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Cuenta destino">
            <select className={INPUT} value={accountId} onChange={event => setAccountId(event.target.value)}>
              {accounts.map(item => <option key={item.id} value={item.id}>{item.bank} · {item.number}</option>)}
            </select>
          </Field>
          <Field label="Valor recibido">
            <input type="number" min={0} step={1000} className={INPUT} value={amount} onChange={event => setAmount(event.target.value)} placeholder="0" />
          </Field>
          <Field label="Referencia">
            <input className={INPUT} value={reference} onChange={event => setReference(event.target.value)} placeholder="Transferencia, cheque o transacción" />
          </Field>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] text-gray-600">
          <div className="flex justify-between"><span>Cliente</span><strong className="text-gray-800">{party?.name ?? '—'}</strong></div>
          <div className="mt-1 flex justify-between"><span>Cuenta</span><span>{accountLabel(state, accountId)}</span></div>
          <div className="mt-1 flex justify-between"><span>Valor</span><strong className="text-gray-800">{money(Number.isFinite(value) ? value : 0)}</strong></div>
        </div>

        {accounts.length === 0 && <p className="text-[11px] font-medium text-red-600">No hay cuentas bancarias activas para recibir el recaudo.</p>}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => onSave({ partyId, date, method, accountId, amount: roundMoney(value), reference })}
          >
            Registrar recibo
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CollectionModal({ state, initialReceivableId, onClose, onSave }: {
  state: FinanceState;
  initialReceivableId: string;
  onClose: () => void;
  onSave: (payload: CollectionDraft) => void;
}) {
  const rows = openReceivables(state);
  const initial = rows.some(item => item.id === initialReceivableId) ? initialReceivableId : rows[0]?.id ?? '';
  const [receivableId, setReceivableId] = useState(initial);
  const selected = rows.find(item => item.id === receivableId);
  const [channel, setChannel] = useState<CollectionAction['channel']>('Llamada');
  const [result, setResult] = useState<CollectionAction['result']>('Promesa');
  const [note, setNote] = useState('');
  const [promiseDate, setPromiseDate] = useState(addDays(HOY, 7));
  const [promiseAmount, setPromiseAmount] = useState(selected ? String(selected.balance) : '');
  const needsPromise = result === 'Promesa' || result === 'Acuerdo';
  const promiseValue = Number(promiseAmount);
  const valid = receivableId !== ''
    && note.trim().length > 0
    && (!needsPromise || (promiseDate !== '' && Number.isFinite(promiseValue) && promiseValue > 0 && (!selected || promiseValue <= selected.balance + 0.005)));

  function changeReceivable(id: string) {
    setReceivableId(id);
    const target = state.receivables.find(item => item.id === id);
    setPromiseAmount(target ? String(target.balance) : '');
  }

  return (
    <Modal
      title="Registrar gestión de cobro"
      subtitle="Documente el contacto con el cliente y, si existe, la promesa de pago."
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Partida" className="sm:col-span-2">
            <select className={INPUT} value={receivableId} onChange={event => changeReceivable(event.target.value)}>
              {rows.map(item => {
                const party = partyOf(state, item.partyId);
                return <option key={item.id} value={item.id}>{item.invoiceNumber} · {party?.name ?? '—'} · saldo {money(item.balance)}</option>;
              })}
            </select>
          </Field>
          <Field label="Canal">
            <select className={INPUT} value={channel} onChange={event => setChannel(event.target.value as CollectionAction['channel'])}>
              {COLLECTION_CHANNELS.map(item => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Resultado">
            <select className={INPUT} value={result} onChange={event => setResult(event.target.value as CollectionAction['result'])}>
              {COLLECTION_RESULTS.map(item => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Fecha de promesa" hint={needsPromise ? 'Obligatoria' : 'No aplica'}>
            <input
              type="date"
              className={INPUT}
              value={needsPromise ? promiseDate : ''}
              disabled={!needsPromise}
              onChange={event => setPromiseDate(event.target.value)}
            />
          </Field>
          <Field label="Valor prometido" hint={needsPromise ? 'Obligatorio' : 'No aplica'}>
            <input
              type="number"
              min={0}
              step={1000}
              className={INPUT}
              value={needsPromise ? promiseAmount : ''}
              disabled={!needsPromise}
              onChange={event => setPromiseAmount(event.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Nota de la gestión" className="sm:col-span-2">
            <textarea className={`${INPUT} min-h-20`} value={note} onChange={event => setNote(event.target.value)} placeholder="Resumen del contacto, acuerdo o respuesta del cliente" />
          </Field>
        </div>

        {selected && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] text-gray-600">
            <div className="flex justify-between"><span>Saldo de la partida</span><strong className="text-gray-800"><Money value={selected.balance} /></strong></div>
            <div className="mt-1 flex justify-between"><span>Vencimiento</span><span>{fmtDate(selected.dueDate)}</span></div>
            {needsPromise && promiseValue > selected.balance + 0.005 && <p className="mt-2 font-medium text-red-600">La promesa no puede superar el saldo pendiente.</p>}
          </div>
        )}

        {rows.length === 0 && <p className="text-[11px] font-medium text-red-600">No hay partidas abiertas para registrar gestión.</p>}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => onSave({
              receivableId,
              channel,
              result,
              note,
              promiseDate: needsPromise ? promiseDate : '',
              promiseAmount: needsPromise ? roundMoney(promiseValue) : 0,
            })}
          >
            Guardar gestión
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function WriteOffModal({ state, initialReceivableId, onClose, onSave }: {
  state: FinanceState;
  initialReceivableId: string;
  onClose: () => void;
  onSave: (payload: WriteOffDraft) => void;
}) {
  const rows = openReceivables(state);
  const initial = rows.some(item => item.id === initialReceivableId) ? initialReceivableId : rows[0]?.id ?? '';
  const [receivableId, setReceivableId] = useState(initial);
  const selected = rows.find(item => item.id === receivableId);
  const [amount, setAmount] = useState(selected ? String(selected.balance) : '');
  const [reason, setReason] = useState('');
  const value = Number(amount);
  const valid = receivableId !== ''
    && reason.trim().length > 0
    && Number.isFinite(value)
    && value > 0
    && (!selected || value <= selected.balance + 0.005);

  function changeReceivable(id: string) {
    setReceivableId(id);
    const target = state.receivables.find(item => item.id === id);
    setAmount(target ? String(target.balance) : '');
  }

  return (
    <Modal
      title="Solicitar castigo de partida"
      subtitle="La solicitud queda pendiente de aprobación en la bandeja de castigos y ajustes."
      onClose={onClose}
    >
      <div className="space-y-4">
        <Field label="Partida a castigar">
          <select className={INPUT} value={receivableId} onChange={event => changeReceivable(event.target.value)}>
            {rows.map(item => {
              const party = partyOf(state, item.partyId);
              return <option key={item.id} value={item.id}>{item.invoiceNumber} · {party?.name ?? '—'} · saldo {money(item.balance)}</option>;
            })}
          </select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Valor a castigar">
            <input type="number" min={0} step={1000} className={INPUT} value={amount} onChange={event => setAmount(event.target.value)} placeholder="0" />
          </Field>
          <Field label="Saldo de la partida">
            <input className={`${INPUT} bg-gray-50`} value={selected ? money(selected.balance) : '—'} readOnly />
          </Field>
        </div>
        <Field label="Motivo del castigo">
          <textarea className={`${INPUT} min-h-24`} value={reason} onChange={event => setReason(event.target.value)} placeholder="Explique la gestión agotada y la justificación del castigo" />
        </Field>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          Al aprobar la solicitud, el saldo de la partida se lleva a cero y queda marcada como castigada.
        </div>
        {rows.length === 0 && <p className="text-[11px] font-medium text-red-600">No hay partidas abiertas para solicitar castigo.</p>}
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => onSave({ receivableId, amount: roundMoney(value), reason })}
          >
            Enviar solicitud
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AdvanceModal({ state, onClose, onSave }: {
  state: FinanceState;
  onClose: () => void;
  onSave: (payload: AdvanceDraft) => void;
}) {
  const clients = state.parties.filter(item => item.kind !== 'Proveedor');
  const [partyId, setPartyId] = useState(clients[0]?.id ?? '');
  const [date, setDate] = useState(HOY);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const value = Number(amount);
  const party = state.parties.find(item => item.id === partyId);
  const valid = partyId !== '' && date !== '' && Number.isFinite(value) && value > 0 && reference.trim().length > 0;

  return (
    <Modal
      title="Registrar anticipo de cliente"
      subtitle="Registre el valor recibido antes de la facturación para aplicarlo posteriormente."
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cliente">
            <select className={INPUT} value={partyId} onChange={event => setPartyId(event.target.value)}>
              {clients.map(item => <option key={item.id} value={item.id}>{item.name} · {item.nit}</option>)}
            </select>
          </Field>
          <Field label="Fecha">
            <input type="date" className={INPUT} value={date} onChange={event => setDate(event.target.value)} />
          </Field>
          <Field label="Valor">
            <input type="number" min={0} step={1000} className={INPUT} value={amount} onChange={event => setAmount(event.target.value)} placeholder="0" />
          </Field>
          <Field label="Referencia">
            <input className={INPUT} value={reference} onChange={event => setReference(event.target.value)} placeholder="Orden de servicio, consignación o contrato" />
          </Field>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] text-gray-600">
          <div className="flex justify-between"><span>Cliente</span><strong className="text-gray-800">{party?.name ?? '—'}</strong></div>
          <div className="mt-1 flex justify-between"><span>Valor</span><strong className="text-gray-800">{money(Number.isFinite(value) ? value : 0)}</strong></div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => onSave({ partyId, date, amount: roundMoney(value), reference })}
          >
            Registrar anticipo
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AdvanceApplyModal({ state, receivableId, advanceId, onClose, onApply }: {
  state: FinanceState;
  receivableId?: string;
  advanceId?: string;
  onClose: () => void;
  onApply: (payload: { advanceId: string; receivableId: string; amount: number }) => void;
}) {
  const fixedReceivable = receivableId ? state.receivables.find(item => item.id === receivableId) ?? null : null;
  const fixedAdvance = advanceId ? state.advances.find(item => item.id === advanceId) ?? null : null;
  const partyId = fixedReceivable?.partyId ?? fixedAdvance?.partyId ?? '';

  const advances = state.advances.filter(item =>
    item.direction === 'AR'
    && item.partyId === partyId
    && advanceAvailable(item) > 0.005,
  );
  const receivables = state.receivables.filter(item =>
    item.partyId === partyId
    && item.balance > 0.005
    && item.status !== 'Pagada'
    && item.status !== 'Castigada',
  );

  const [selectedAdvanceId, setSelectedAdvanceId] = useState(fixedAdvance?.id ?? advances[0]?.id ?? '');
  const [selectedReceivableId, setSelectedReceivableId] = useState(fixedReceivable?.id ?? receivables[0]?.id ?? '');
  const advance = advances.find(item => item.id === selectedAdvanceId);
  const receivable = receivables.find(item => item.id === selectedReceivableId);
  const available = advance ? advanceAvailable(advance) : 0;
  const cap = Math.min(available, receivable?.balance ?? 0);
  const [amount, setAmount] = useState(cap > 0 ? String(cap) : '');
  const value = Number(amount);
  const valid = Boolean(advance)
    && Boolean(receivable)
    && Number.isFinite(value)
    && value > 0
    && value <= available + 0.005
    && value <= (receivable?.balance ?? 0) + 0.005;

  function changeAdvance(id: string) {
    setSelectedAdvanceId(id);
    const nextAdvance = state.advances.find(item => item.id === id);
    const nextCap = Math.min(nextAdvance ? advanceAvailable(nextAdvance) : 0, receivable?.balance ?? 0);
    setAmount(nextCap > 0 ? String(nextCap) : '');
  }

  function changeReceivable(id: string) {
    setSelectedReceivableId(id);
    const nextReceivable = state.receivables.find(item => item.id === id);
    const nextCap = Math.min(available, nextReceivable?.balance ?? 0);
    setAmount(nextCap > 0 ? String(nextCap) : '');
  }

  return (
    <Modal
      title="Aplicar anticipo a factura"
      subtitle="El anticipo se cruza contra una partida abierta del mismo cliente."
      onClose={onClose}
    >
      <div className="space-y-4">
        {fixedReceivable ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
            <div className="text-[10px] uppercase tracking-wide text-gray-400">Partida destino</div>
            <div className="mt-0.5 flex justify-between gap-2">
              <span className="font-mono font-semibold text-gray-800">{fixedReceivable.invoiceNumber}</span>
              <span>Saldo <strong className="text-gray-800">{money(fixedReceivable.balance)}</strong></span>
            </div>
          </div>
        ) : (
          <Field label="Partida destino">
            <select className={INPUT} value={selectedReceivableId} onChange={event => changeReceivable(event.target.value)}>
              {receivables.map(item => <option key={item.id} value={item.id}>{item.invoiceNumber} · saldo {money(item.balance)}</option>)}
            </select>
          </Field>
        )}

        <Field label="Anticipo a aplicar">
          <select className={INPUT} value={selectedAdvanceId} onChange={event => changeAdvance(event.target.value)} disabled={Boolean(fixedAdvance)}>
            {advances.map(item => <option key={item.id} value={item.id}>{item.number} · disponible {money(advanceAvailable(item))}</option>)}
          </select>
        </Field>

        <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] sm:grid-cols-3">
          <div><div className="text-gray-500">Disponible anticipo</div><div className="font-semibold text-gray-800">{money(available)}</div></div>
          <div><div className="text-gray-500">Saldo partida</div><div className="font-semibold text-gray-800">{money(receivable?.balance ?? 0)}</div></div>
          <div><div className="text-gray-500">Máximo a aplicar</div><div className="font-semibold text-amber-700">{money(cap)}</div></div>
        </div>

        <Field label="Valor a aplicar">
          <input type="number" min={0} max={cap} step={1000} className={INPUT} value={amount} onChange={event => setAmount(event.target.value)} placeholder="0" />
        </Field>

        {advances.length === 0 && <p className="text-[11px] font-medium text-red-600">El cliente no tiene anticipos con saldo disponible.</p>}
        {receivables.length === 0 && <p className="text-[11px] font-medium text-red-600">El cliente no tiene partidas abiertas para aplicar el anticipo.</p>}
        {Number.isFinite(value) && value > available + 0.005 && <p className="text-[11px] font-medium text-red-600">El valor excede el disponible del anticipo.</p>}
        {Number.isFinite(value) && receivable && value > receivable.balance + 0.005 && <p className="text-[11px] font-medium text-red-600">El valor excede el saldo de la partida.</p>}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              if (!advance || !receivable) return;
              onApply({ advanceId: advance.id, receivableId: receivable.id, amount: roundMoney(value) });
            }}
          >
            Aplicar anticipo
          </Button>
        </div>
      </div>
    </Modal>
  );
}
