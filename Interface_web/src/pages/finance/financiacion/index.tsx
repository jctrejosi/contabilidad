import { useState } from 'react';
import type { NavPage } from '../../../components/Shell';
import Icon from '../../../components/Icon';
import { Button, PageHeader } from '../../../components/finance/ui';
import { FINANCIAL_MODULES } from '../../../data/finance';
import { useFinance } from '../../../finance/store';
import { HOY } from '../../../finance/selectors';
import type { CreditLine, FinanceState, Loan } from '../../../finance/types';
import { buildSchedule, CreditLineEditor, LoanEditor, newId, type FundingActions } from './shared';
import Panel from './Panel';
import Prestamos from './Prestamos';
import Amortizacion from './Amortizacion';
import Pagos from './Pagos';
import Cupos from './Cupos';
import Leasing from './Leasing';
import Reportes from './Reportes';

interface Props {
  page: string;
  onNavigate: (page: NavPage) => void;
}

const MODULE = FINANCIAL_MODULES.financiacion;
const SLUGS = MODULE.nav.map(item => item.slug);

const HEADERS: Record<string, { title: string; subtitle: string }> = {
  panel: { title: 'Panel de deuda', subtitle: 'Saldo financiero, cuotas, intereses y cupos disponibles.' },
  prestamos: { title: 'Préstamos bancarios', subtitle: 'Registro de obligaciones financieras y su estado.' },
  amortizacion: { title: 'Calendario de amortización', subtitle: 'Cuotas, intereses y abono a capital por préstamo.' },
  pagos: { title: 'Intereses y pagos', subtitle: 'Registro de cuotas pagadas y pendientes del año.' },
  cupos: { title: 'Cupos de crédito', subtitle: 'Líneas aprobadas, uso y vencimiento.' },
  leasing: { title: 'Arrendamientos financieros', subtitle: 'Contratos con derecho de uso y opción de compra.' },
  reportes: { title: 'Reportes de deuda', subtitle: 'Perfil de vencimientos, intereses y concentración por entidad.' },
};

function nextLoanCode(state: FinanceState): string {
  return `LB-${HOY.slice(0, 4)}-${String(state.loans.length + 1).padStart(2, '0')}`;
}

function nextLineCode(state: FinanceState): string {
  return `CL-${String(state.creditLines.length + 1).padStart(3, '0')}`;
}

export default function Financiacion({ page, onNavigate }: Props) {
  const { state, update } = useFinance();
  const slug = page.split('/')[1] ?? 'panel';
  const activeSlug = SLUGS.includes(slug) ? slug : 'panel';

  const [toast, setToast] = useState('');
  const [loanModal, setLoanModal] = useState<Loan | 'new' | null>(null);
  const [lineModal, setLineModal] = useState<CreditLine | 'new' | null>(null);

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(''), 3800);
  }

  function createLoan(draft: Loan) {
    if (state.loans.some(loan => loan.code === draft.code)) {
      showToast(`El código ${draft.code} ya existe.`);
      return;
    }
    const id = newId('loan');
    const loan: Loan = { ...draft, id };
    const schedule = buildSchedule(loan);

    update(stateDraft => {
      stateDraft.loans.push(loan);
      stateDraft.amortization.push(...schedule);
      const line = stateDraft.creditLines.find(item => item.id === loan.creditLineId);
      if (line) line.used = Math.min(line.approved, line.used + loan.principal);
    }, `Préstamo ${loan.code} registrado por ${loan.principal.toLocaleString('es-CO')}`, 'financiacion');

    setLoanModal(null);
    showToast(`Préstamo ${loan.code} creado con ${schedule.length} cuotas.`);
  }

  function registerPayment(rowId: string) {
    const row = state.amortization.find(item => item.id === rowId);
    if (!row) return;
    update(draft => {
      const target = draft.amortization.find(item => item.id === rowId);
      if (target) target.status = 'Pagado';
      const loan = draft.loans.find(item => item.id === row.loanId);
      if (loan) {
        const pending = draft.amortization.filter(item => item.loanId === loan.id && item.status === 'Pendiente');
        if (pending.length === 0) loan.status = 'Pagado';
      }
    }, `Cuota #${row.number} pagada`, 'financiacion');
    showToast(`Cuota #${row.number} registrada como pagada.`);
  }

  function cancelLoan(loanId: string) {
    const loan = state.loans.find(item => item.id === loanId);
    if (!loan) return;
    update(draft => {
      const target = draft.loans.find(item => item.id === loanId);
      if (target) target.status = 'Cancelado';
      draft.amortization = draft.amortization.filter(item => !(item.loanId === loanId && item.status === 'Pendiente'));
      const line = draft.creditLines.find(item => item.id === loan.creditLineId);
      if (line) line.used = Math.max(0, line.used - loan.principal);
    }, `Préstamo ${loan.code} cancelado`, 'financiacion');
    showToast(`Préstamo ${loan.code} cancelado.`);
  }

  function createCreditLine(draft: CreditLine) {
    if (state.creditLines.some(line => line.code === draft.code)) {
      showToast(`El código ${draft.code} ya existe.`);
      return;
    }
    update(stateDraft => {
      stateDraft.creditLines.push({ ...draft, id: newId('cl') });
    }, `Cupo ${draft.code} creado`, 'financiacion');
    setLineModal(null);
    showToast(`Cupo ${draft.bank} creado.`);
  }

  function updateCreditLine(id: string, patch: Partial<CreditLine>) {
    update(draft => {
      const target = draft.creditLines.find(line => line.id === id);
      if (target) Object.assign(target, patch);
    }, 'Cupo de crédito actualizado', 'financiacion');
    setLineModal(null);
    showToast('Cupo actualizado.');
  }

  const actions: FundingActions = {
    createLoan,
    registerPayment,
    cancelLoan,
    createCreditLine,
    updateCreditLine,
    showToast,
  };

  const header = HEADERS[activeSlug] ?? HEADERS.panel;
  const action = (() => {
    if (activeSlug === 'cupos') {
      return <Button variant="primary" onClick={() => setLineModal('new')}><Icon name="plus" className="h-3.5 w-3.5" /> Nuevo cupo</Button>;
    }
    if (activeSlug === 'panel' || activeSlug === 'prestamos' || activeSlug === 'amortizacion') {
      return <Button variant="primary" onClick={() => setLoanModal('new')}><Icon name="plus" className="h-3.5 w-3.5" /> Nuevo préstamo</Button>;
    }
    return undefined;
  })();

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4 lg:p-5">
      <PageHeader eyebrow="Financiación y deuda" title={header.title} subtitle={header.subtitle} actions={action} />

      {activeSlug === 'panel' && <Panel state={state} onNavigate={onNavigate} />}
      {activeSlug === 'prestamos' && <Prestamos state={state} onCreate={() => setLoanModal('new')} onCancel={cancelLoan} onNavigate={onNavigate} />}
      {activeSlug === 'amortizacion' && <Amortizacion state={state} onPay={registerPayment} />}
      {activeSlug === 'pagos' && <Pagos state={state} onPay={registerPayment} />}
      {activeSlug === 'cupos' && <Cupos state={state} onCreate={() => setLineModal('new')} onEdit={setLineModal} />}
      {activeSlug === 'leasing' && <Leasing state={state} />}
      {activeSlug === 'reportes' && <Reportes state={state} onExport={() => actions.showToast('Reporte de deuda exportado (simulación).')} />}

      {loanModal && (
        <LoanEditor
          loan={loanModal === 'new' ? undefined : loanModal}
          creditLines={state.creditLines.filter(line => line.status === 'Vigente')}
          nextCode={nextLoanCode(state)}
          onClose={() => setLoanModal(null)}
          onSave={createLoan}
        />
      )}

      {lineModal && (
        <CreditLineEditor
          line={lineModal === 'new' ? undefined : lineModal}
          nextCode={nextLineCode(state)}
          onClose={() => setLineModal(null)}
          onSave={draft => {
            if (lineModal === 'new') createCreditLine(draft);
            else updateCreditLine(lineModal.id, draft);
          }}
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
