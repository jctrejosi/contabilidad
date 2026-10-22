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
  Progress,
  SearchInput,
  SectionTitle,
  type Column,
} from '../../components/finance/ui';
import { FINANCIAL_MODULES } from '../../data/finance';
import { useFinance } from '../../finance/store';
import {
  HOY,
  daysBetween,
  fmtDate,
  invoiceTotals,
  money,
  partyOf,
  statusTone,
} from '../../finance/selectors';
import type {
  FinanceState,
  Invoice,
  InvoiceKind,
  InvoiceLine,
  Product,
  Resolution,
} from '../../finance/types';
import Formulario from './facturacion/Formulario';
import Declaracion from './facturacion/Declaracion';
import Exogena from './facturacion/Exogena';

interface Props {
  page: string;
  onNavigate: (page: NavPage) => void;
}

type DraftLine = InvoiceLine;

const MODULE = FINANCIAL_MODULES.facturacion;
const SLUGS = MODULE.nav.map(item => item.slug);

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function initialLine(kind: InvoiceKind, products: Product[]): DraftLine {
  const product = products.find(item => item.active) ?? products[0];
  return {
    id: newId('line'),
    productCode: product?.code ?? '',
    description: product?.name ?? '',
    quantity: 1,
    price: product?.price ?? 0,
    discountPct: 0,
    taxRate: product?.taxRate ?? 19,
    withholdingRate: kind === 'FC' ? 2.5 : 0,
    account: product?.account ?? '4155',
    costCenter: 'ADM',
  };
}

function nextNumber(state: FinanceState, prefix: string): { number: string; resolutionId: string } {
  const resolution = state.resolutions.find(item => item.prefix === prefix && item.active);
  if (!resolution) return { number: `${prefix}-1`, resolutionId: '' };
  return { number: `${prefix}-${resolution.current}`, resolutionId: resolution.id };
}

function matchesSearch(invoice: Invoice, haystack: string): boolean {
  return haystack === ''
    || invoice.number.toLowerCase().includes(haystack)
    || invoice.motive.toLowerCase().includes(haystack);
}

export default function Facturacion({ page, onNavigate }: Props) {
  const { state, update } = useFinance();
  const slug = page.split('/')[1] ?? 'documentos';
  const activeSlug = SLUGS.includes(slug) ? slug : 'documentos';
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<'FV' | 'FC' | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteReference, setNoteReference] = useState('');
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [revertId, setRevertId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [importFile, setImportFile] = useState('');
  const [importValidated, setImportValidated] = useState(false);

  const invoices = state.invoices;
  const selected = selectedId ? invoices.find(invoice => invoice.id === selectedId) ?? null : null;

  const kpis = useMemo(() => {
    const sales = invoices.filter(invoice => invoice.kind === 'FV' && invoice.date.startsWith('2026-02') && invoice.status === 'Contabilizada');
    const pending = invoices.filter(invoice => invoice.dianStatus === 'Pendiente' || invoice.dianStatus === 'Enviada');
    const rejected = invoices.filter(invoice => invoice.dianStatus === 'Rechazada');
    const receivable = state.receivables.reduce((totalValue, item) => totalValue + Math.max(0, item.balance), 0);
    return {
      billed: sales.reduce((totalValue, invoice) => totalValue + invoiceTotals(invoice).total, 0),
      pending: pending.length,
      pendingAmount: pending.reduce((totalValue, invoice) => totalValue + invoiceTotals(invoice).total, 0),
      rejected: rejected.length,
      receivable,
    };
  }, [invoices, state.receivables]);

  const navTitle: Record<string, { title: string; subtitle: string }> = {
    documentos: { title: 'Facturas de venta', subtitle: 'Emisión, estado DIAN y paso a cartera de cada documento de venta.' },
    compras: { title: 'Facturas de compra', subtitle: 'Registro de documentos de proveedor, retenciones y obligaciones por pagar.' },
    notas: { title: 'Notas crédito y débito', subtitle: 'Ajustes fiscales y contables sobre documentos ya emitidos.' },
    dian: { title: 'Centro DIAN', subtitle: 'Cola de envío, aceptación, rechazo y contingencia de documentos electrónicos.' },
    resoluciones: { title: 'Resoluciones y numeración', subtitle: 'Rangos autorizados, vigencia y disponibilidad de consecutivos.' },
    productos: { title: 'Productos y servicios', subtitle: 'Catálogo usado en las líneas de facturación.' },
    importar: { title: 'Importar documentos', subtitle: 'Carga masiva de facturas con validación previa y resumen de resultados.' },
    'formulario-300': { title: 'Formulario 300 · IVA', subtitle: 'Declaración bimestral de IVA calculada desde las facturas contabilizadas.' },
    'formulario-350': { title: 'Formulario 350 · Retención', subtitle: 'Retenciones en la fuente y ReteICA practicadas en el período.' },
    'formulario-110': { title: 'Formulario 110 · Renta', subtitle: 'Declaración anual de renta con renta líquida, presuntiva e impuesto.' },
    declaracion: { title: 'Declaración electrónica', subtitle: 'Validación, presentación y acuse de los formularios tributarios.' },
    exogena: { title: 'Exógena y medios magnéticos', subtitle: 'Formatos anuales, terceros informados, incidencias y presentación.' },
  };

  const TAX_SLUGS = ['formulario-300', 'formulario-350', 'formulario-110', 'declaracion', 'exogena'];
  const isTax = TAX_SLUGS.includes(activeSlug);

  function showToast(text: string) {
    setToast(text);
    window.setTimeout(() => setToast(''), 3500);
  }

  function createInvoice(
    payload: {
      kind: 'FV' | 'FC';
      partyId: string;
      date: string;
      dueDate: string;
      paymentTerm: number;
      notes: string;
      lines: DraftLine[];
    },
    post: boolean,
  ) {
    const prefix = payload.kind === 'FV' ? 'FV' : 'FC';
    const { number, resolutionId } = nextNumber(state, prefix);
    const id = newId('inv');
    update(draft => {
      const resolution = draft.resolutions.find(item => item.id === resolutionId);
      if (resolution) resolution.current += 1;
      const invoice: Invoice = {
        id,
        kind: payload.kind,
        number,
        partyId: payload.partyId,
        date: payload.date,
        dueDate: payload.dueDate,
        paymentTerm: payload.paymentTerm,
        status: post ? 'Contabilizada' : 'Borrador',
        dianStatus: post && payload.kind === 'FV' ? 'Pendiente' : 'No aplica',
        cufe: '',
        resolutionId,
        referenceId: '',
        motive: '',
        notes: payload.notes,
        lines: payload.lines,
        createdAt: HOY,
      };
      draft.invoices.unshift(invoice);
      if (post) {
        const totals = invoiceTotals(invoice);
        if (payload.kind === 'FV') {
          draft.receivables.unshift({
            id: newId('cxc'),
            invoiceId: id,
            invoiceNumber: number,
            partyId: payload.partyId,
            issueDate: payload.date,
            dueDate: payload.dueDate,
            original: totals.total,
            balance: totals.total,
            status: daysBetween(HOY, payload.dueDate) >= 0 ? 'Por vencer' : 'Vencida',
            owner: 'Laura Gómez',
            lastAction: 'Creada por facturación',
            promiseDate: '',
            promiseAmount: 0,
          });
        } else {
          draft.payables.unshift({
            id: newId('cxp'),
            invoiceId: id,
            invoiceNumber: number,
            partyId: payload.partyId,
            issueDate: payload.date,
            dueDate: payload.dueDate,
            original: totals.total,
            withholdings: totals.withholding,
            balance: totals.total,
            status: 'Abierta',
            priority: 'Media',
            owner: 'Carlos Pérez',
          });
        }
        draft.dianEvents.unshift({
          id: newId('dian'),
          invoiceId: id,
          at: `${HOY} 09:30`,
          status: payload.kind === 'FV' ? 'Pendiente' : 'No aplica',
          code: '—',
          message: payload.kind === 'FV' ? 'Documento listo para envío a la DIAN.' : 'Documento de compra registrado internamente.',
        });
      }
    }, `${payload.kind === 'FV' ? 'Factura de venta' : 'Factura de compra'} ${number} ${post ? 'contabilizada' : 'guardada como borrador'}`, 'facturacion');
    setEditor(null);
    showToast(`${prefix === 'FV' ? 'Factura' : 'Compra'} ${number} ${post ? 'contabilizada. Cartera actualizada.' : 'guardada como borrador.'}`);
  }

  function postInvoice(id: string) {
    const invoice = state.invoices.find(item => item.id === id);
    if (!invoice || invoice.status === 'Contabilizada') return;
    update(draft => {
      const target = draft.invoices.find(item => item.id === id);
      if (!target) return;
      target.status = 'Contabilizada';
      if (target.kind === 'FV' && target.dianStatus === 'No aplica') target.dianStatus = 'Pendiente';
      const totals = invoiceTotals(target);
      if (target.kind === 'FV' && !draft.receivables.some(item => item.invoiceId === id)) {
        draft.receivables.unshift({
          id: newId('cxc'),
          invoiceId: id,
          invoiceNumber: target.number,
          partyId: target.partyId,
          issueDate: target.date,
          dueDate: target.dueDate,
          original: totals.total,
          balance: totals.total,
          status: 'Por vencer',
          owner: 'Laura Gómez',
          lastAction: 'Contabilizada desde facturación',
          promiseDate: '',
          promiseAmount: 0,
        });
      }
      if (target.kind === 'FC' && !draft.payables.some(item => item.invoiceId === id)) {
        draft.payables.unshift({
          id: newId('cxp'),
          invoiceId: id,
          invoiceNumber: target.number,
          partyId: target.partyId,
          issueDate: target.date,
          dueDate: target.dueDate,
          original: totals.total,
          withholdings: totals.withholding,
          balance: totals.total,
          status: 'Abierta',
          priority: 'Media',
          owner: 'Carlos Pérez',
        });
      }
    }, `Documento ${invoice.number} contabilizado`, 'facturacion');
    showToast(`${invoice.number} contabilizado. Se generó la partida en ${invoice.kind === 'FV' ? 'cartera' : 'cuentas por pagar'}.`);
  }

  function revertInvoice(id: string) {
    const invoice = state.invoices.find(item => item.id === id);
    if (!invoice || invoice.status !== 'Contabilizada') return;
    update(draft => {
      const target = draft.invoices.find(item => item.id === id);
      if (!target) return;
      target.status = 'Revertida';
      const receivable = draft.receivables.find(item => item.invoiceId === id);
      if (receivable) {
        receivable.balance = 0;
        receivable.status = 'Revertida';
        receivable.lastAction = 'Documento revertido';
      }
      const payable = draft.payables.find(item => item.invoiceId === id);
      if (payable) {
        payable.balance = 0;
        payable.status = 'Revertida';
      }
      draft.dianEvents.unshift({
        id: newId('dian'),
        invoiceId: id,
        at: `${HOY} 12:00`,
        status: target.dianStatus,
        code: 'REV',
        message: 'Documento revertido. El original se conserva y el saldo asociado quedó en cero.',
      });
    }, `Documento ${invoice.number} revertido`, 'facturacion');
    setRevertId(null);
    showToast(`${invoice.number} revertido. El documento y su histórico se conservan.`);
  }

  function sendToDian(id: string) {
    const invoice = state.invoices.find(item => item.id === id);
    if (!invoice) return;
    update(draft => {
      const target = draft.invoices.find(item => item.id === id);
      if (!target) return;
      target.dianStatus = 'Enviada';
      target.cufe = target.cufe || `CUFE-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
      draft.dianEvents.unshift({
        id: newId('dian'),
        invoiceId: id,
        at: `${HOY} 10:15`,
        status: 'Enviada',
        code: '00',
        message: 'Documento enviado al proveedor tecnológico. Esperando respuesta DIAN.',
      });
    }, `Documento ${invoice.number} enviado a la DIAN`, 'facturacion');
    showToast(`${invoice.number} enviado a la DIAN.`);
  }

  function resolveDian(id: string, result: 'Aceptada' | 'Rechazada') {
    const invoice = state.invoices.find(item => item.id === id);
    if (!invoice) return;
    update(draft => {
      const target = draft.invoices.find(item => item.id === id);
      if (!target) return;
      target.dianStatus = result;
      target.cufe = target.cufe || `CUFE-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
      draft.dianEvents.unshift({
        id: newId('dian'),
        invoiceId: id,
        at: `${HOY} 10:20`,
        status: result,
        code: result === 'Aceptada' ? '00' : 'FAB10',
        message: result === 'Aceptada'
          ? 'Documento validado y aceptado por la DIAN.'
          : 'Rechazo por inconsistencia en los datos del adquiriente.',
      });
    }, `${invoice.number} ${result.toLowerCase()} por la DIAN`, 'facturacion');
    showToast(`${invoice.number}: ${result.toLowerCase()} por la DIAN.`);
  }

  function createNote(payload: { kind: 'NC' | 'ND'; referenceId: string; motive: string; amount: number }) {
    const original = state.invoices.find(item => item.id === payload.referenceId);
    if (!original || payload.amount <= 0) return;
    const { number, resolutionId } = nextNumber(state, payload.kind);
    update(draft => {
      const resolution = draft.resolutions.find(item => item.id === resolutionId);
      if (resolution) resolution.current += 1;
      const base = payload.amount / 1.19;
      const note: Invoice = {
        id: newId('inv'),
        kind: payload.kind,
        number,
        partyId: original.partyId,
        date: HOY,
        dueDate: HOY,
        paymentTerm: 0,
        status: 'Contabilizada',
        dianStatus: original.kind === 'FV' ? 'Aceptada' : 'No aplica',
        cufe: original.kind === 'FV' ? `CUFE-${Math.random().toString(16).slice(2, 10).toUpperCase()}` : '',
        resolutionId,
        referenceId: original.id,
        motive: payload.motive,
        notes: '',
        lines: [{
          id: newId('line'),
          productCode: 'AJUSTE',
          description: payload.motive,
          quantity: 1,
          price: Math.round(base),
          discountPct: 0,
          taxRate: 19,
          withholdingRate: 0,
          account: '4155',
          costCenter: 'ADM',
        }],
        createdAt: HOY,
      };
      draft.invoices.unshift(note);
      const receivable = draft.receivables.find(item => item.invoiceId === original.id);
      const payable = draft.payables.find(item => item.invoiceId === original.id);
      if (receivable) {
        receivable.balance = payload.kind === 'NC'
          ? Math.max(0, receivable.balance - payload.amount)
          : receivable.balance + payload.amount;
        receivable.status = receivable.balance <= 0 ? 'Pagada' : receivable.status;
      }
      if (payable) {
        payable.balance = payload.kind === 'NC'
          ? Math.max(0, payable.balance - payload.amount)
          : payable.balance + payload.amount;
        payable.status = payable.balance <= 0 ? 'Pagada' : payable.status;
      }
    }, `${payload.kind === 'NC' ? 'Nota crédito' : 'Nota débito'} ${number} emitida`, 'facturacion');
    setNoteOpen(false);
    showToast(`${payload.kind === 'NC' ? 'Nota crédito' : 'Nota débito'} ${number} aplicada a ${original.number}.`);
  }

  function processPendingDian() {
    update(draft => {
      for (const invoice of draft.invoices) {
        if (invoice.dianStatus === 'Pendiente') {
          invoice.dianStatus = 'Enviada';
          invoice.cufe = invoice.cufe || `CUFE-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
          draft.dianEvents.unshift({
            id: newId('dian'),
            invoiceId: invoice.id,
            at: `${HOY} 11:00`,
            status: 'Enviada',
            code: '00',
            message: 'Envío masivo al proveedor tecnológico.',
          });
        }
      }
    }, 'Procesamiento masivo de envíos DIAN', 'facturacion');
    showToast('Documentos pendientes enviados a la DIAN.');
  }

  function acceptAllSent() {
    update(draft => {
      for (const invoice of draft.invoices) {
        if (invoice.dianStatus === 'Enviada') {
          invoice.dianStatus = 'Aceptada';
          draft.dianEvents.unshift({
            id: newId('dian'),
            invoiceId: invoice.id,
            at: `${HOY} 11:05`,
            status: 'Aceptada',
            code: '00',
            message: 'Aceptación registrada en la simulación DIAN.',
          });
        }
      }
    }, 'Aceptación masiva de documentos enviados', 'facturacion');
    showToast('Documentos enviados marcados como aceptados.');
  }

  function toggleProduct(id: string) {
    update(draft => {
      const product = draft.products.find(item => item.id === id);
      if (product) product.active = !product.active;
    }, 'Cambio de estado de producto', 'facturacion');
  }

  function createProduct(payload: Omit<Product, 'id' | 'active'>) {
    update(draft => {
      draft.products.unshift({ ...payload, id: newId('prod'), active: true });
    }, `Producto ${payload.code} creado`, 'facturacion');
    setProductOpen(false);
    showToast('Producto creado.');
  }

  function createResolution(payload: Omit<Resolution, 'id' | 'active' | 'current'>) {
    update(draft => {
      draft.resolutions.unshift({ ...payload, id: newId('res'), current: payload.from, active: true });
    }, `Resolución ${payload.prefix} creada`, 'facturacion');
    setResolutionOpen(false);
    showToast('Resolución creada y disponible para numeración.');
  }

  function importDocuments() {
    const supplier = state.parties.find(party => party.kind === 'Proveedor') ?? state.parties[0];
    if (!supplier) return;
    const numbers: string[] = [];
    update(draft => {
      for (let index = 0; index < 2; index += 1) {
        const number = `FC-${8872 + index}`;
        const base = 2_800_000 + index * 1_450_000;
        draft.invoices.unshift({
          id: newId('inv'),
          kind: 'FC',
          number,
          partyId: supplier.id,
          date: HOY,
          dueDate: '2026-03-30',
          paymentTerm: 30,
          status: 'Borrador',
          dianStatus: 'No aplica',
          cufe: '',
          resolutionId: 'res-fc',
          referenceId: '',
          motive: '',
          notes: 'Importada desde archivo plano',
          lines: [{
            id: newId('line'),
            productCode: 'IMP-001',
            description: 'Documento importado',
            quantity: 1,
            price: base,
            discountPct: 0,
            taxRate: 19,
            withholdingRate: 2.5,
            account: '5195',
            costCenter: 'ADM',
          }],
          createdAt: HOY,
        });
        numbers.push(number);
      }
    }, 'Importación de dos facturas de compra', 'facturacion');
    setImportValidated(false);
    setImportFile('');
    showToast(`Importación completada: ${numbers.join(', ')} en borrador.`);
  }

  const header = navTitle[activeSlug];
  const action = (() => {
    if (activeSlug === 'compras') return <Button variant="primary" onClick={() => setEditor('FC')}><Icon name="plus" className="h-3.5 w-3.5" /> Nueva factura de compra</Button>;
    if (activeSlug === 'notas') return <Button variant="primary" onClick={() => { setNoteReference(''); setNoteOpen(true); }}><Icon name="plus" className="h-3.5 w-3.5" /> Nueva nota</Button>;
    if (activeSlug === 'resoluciones') return <Button variant="primary" onClick={() => setResolutionOpen(true)}><Icon name="plus" className="h-3.5 w-3.5" /> Nueva resolución</Button>;
    if (activeSlug === 'productos') return <Button variant="primary" onClick={() => setProductOpen(true)}><Icon name="plus" className="h-3.5 w-3.5" /> Nuevo producto</Button>;
    if (activeSlug === 'dian') return <Button variant="primary" onClick={processPendingDian}>Procesar pendientes</Button>;
    if (activeSlug === 'importar') return <Button variant="primary" disabled={!importValidated} onClick={importDocuments}>Importar documentos</Button>;
    if (TAX_SLUGS.includes(activeSlug)) return undefined;
    return <Button variant="primary" onClick={() => setEditor('FV')}><Icon name="plus" className="h-3.5 w-3.5" /> Nueva factura</Button>;
  })();

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 p-4 lg:p-5">
      <PageHeader eyebrow="Facturación" title={header.title} subtitle={header.subtitle} actions={action} />

      {!isTax && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Facturado en febrero" value={money(kpis.billed)} detail="Documentos de venta contabilizados" tone="green" />
          <KpiCard label="Por enviar o en tránsito" value={String(kpis.pending)} detail={money(kpis.pendingAmount)} tone="amber" />
          <KpiCard label="Rechazadas por DIAN" value={String(kpis.rejected)} detail="Requieren corrección y reenvío" tone="red" />
          <KpiCard label="Saldo en cartera" value={money(kpis.receivable)} detail="Partidas abiertas al día de hoy" tone="blue" />
        </div>
      )}

      {activeSlug === 'documentos' && (
        <SalesInvoices state={state} query={query} status={status} onQuery={setQuery} onStatus={setStatus} onOpen={setSelectedId} />
      )}
      {activeSlug === 'compras' && <PurchaseInvoices state={state} onOpen={setSelectedId} onCreate={() => setEditor('FC')} />}
      {activeSlug === 'notas' && (
        <NotesView state={state} onOpen={setSelectedId} onCreate={(referenceId) => { setNoteReference(referenceId ?? ''); setNoteOpen(true); }} />
      )}
      {activeSlug === 'dian' && (
        <DianCenter state={state} onSend={sendToDian} onResolve={resolveDian} onOpen={setSelectedId} onAcceptAll={acceptAllSent} />
      )}
      {activeSlug === 'resoluciones' && <ResolutionsView state={state} />}
      {activeSlug === 'productos' && <ProductsView state={state} onToggle={toggleProduct} />}
      {activeSlug === 'importar' && (
        <ImportView
          fileName={importFile}
          validated={importValidated}
          onFile={(name) => { setImportFile(name); setImportValidated(false); }}
          onValidate={() => setImportValidated(true)}
          onImport={importDocuments}
        />
      )}
      {activeSlug === 'formulario-300' && <Formulario code="300" showToast={showToast} />}
      {activeSlug === 'formulario-350' && <Formulario code="350" showToast={showToast} />}
      {activeSlug === 'formulario-110' && <Formulario code="110" showToast={showToast} />}
      {activeSlug === 'declaracion' && <Declaracion showToast={showToast} />}
      {activeSlug === 'exogena' && <Exogena showToast={showToast} />}

      {selected && (
        <InvoiceDrawer
          state={state}
          invoice={selected}
          onClose={() => setSelectedId(null)}
          onPost={postInvoice}
          onSend={sendToDian}
          onResolve={resolveDian}
          onNote={(referenceId) => { setSelectedId(null); setNoteReference(referenceId); setNoteOpen(true); }}
          onRevert={setRevertId}
          onNavigate={onNavigate}
        />
      )}

      {revertId && <Modal title="Revertir documento" subtitle="El documento original no se elimina; se conserva con su histórico y el saldo asociado queda en cero." onClose={() => setRevertId(null)}><p className="text-xs leading-5 text-gray-600">Esta acción deja el documento en estado Revertido y ajusta la partida de cartera u obligación. Para corregir el valor fiscal use una nota crédito.</p><div className="mt-5 flex justify-end gap-2"><Button onClick={() => setRevertId(null)}>Cancelar</Button><Button variant="danger" onClick={() => revertInvoice(revertId)}>Revertir documento</Button></div></Modal>}

      {editor && <InvoiceEditor kind={editor} state={state} onClose={() => setEditor(null)} onSave={createInvoice} />}
      {noteOpen && <NoteEditor state={state} initialReference={noteReference} onClose={() => setNoteOpen(false)} onSave={createNote} />}
      {resolutionOpen && <ResolutionEditor onClose={() => setResolutionOpen(false)} onSave={createResolution} />}
      {productOpen && <ProductEditor onClose={() => setProductOpen(false)} onSave={createProduct} />}

      {toast && (
        <div className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-xl bg-[#001F4C] px-4 py-3 text-xs text-white shadow-2xl">
          <Icon name="check" className="h-4 w-4 text-emerald-300" />
          {toast}
        </div>
      )}
    </div>
  );
}

function SalesInvoices({ state, query, status, onQuery, onStatus, onOpen }: {
  state: FinanceState;
  query: string;
  status: string;
  onQuery: (value: string) => void;
  onStatus: (value: string) => void;
  onOpen: (id: string) => void;
}) {
  const haystack = query.trim().toLowerCase();
  const rows = state.invoices
    .filter(invoice => invoice.kind === 'FV')
    .filter(invoice => matchesSearch(invoice, haystack) || (partyOf(state, invoice.partyId)?.name.toLowerCase().includes(haystack) ?? false))
    .filter(invoice => status === 'Todos' || invoice.dianStatus === status || invoice.status === status)
    .sort((a, b) => b.number.localeCompare(a.number));

  const columns: Column<Invoice>[] = [
    { header: 'Documento', cell: invoice => <span className="font-mono font-semibold text-gray-800">{invoice.number}</span> },
    { header: 'Cliente', cell: invoice => <div className="max-w-56"><div className="truncate">{partyOf(state, invoice.partyId)?.name}</div><div className="text-[10px] text-gray-400">{partyOf(state, invoice.partyId)?.nit}</div></div> },
    { header: 'Fecha', cell: invoice => fmtDate(invoice.date) },
    { header: 'Vence', cell: invoice => fmtDate(invoice.dueDate) },
    { header: 'Total', align: 'right', cell: invoice => <Money value={invoiceTotals(invoice).total} className="font-semibold" /> },
    { header: 'Estado', cell: invoice => <Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge> },
    { header: 'DIAN', cell: invoice => <Badge tone={statusTone(invoice.dianStatus)}>{invoice.dianStatus}</Badge> },
    { header: '', align: 'right', cell: () => <span className="text-[10px] font-medium text-petroleum-600">Ver detalle</span> },
  ];

  const flow = [
    { label: 'Borrador', count: state.invoices.filter(i => i.kind === 'FV' && i.status === 'Borrador').length },
    { label: 'Por enviar', count: state.invoices.filter(i => i.kind === 'FV' && i.dianStatus === 'Pendiente').length },
    { label: 'Enviada', count: state.invoices.filter(i => i.kind === 'FV' && i.dianStatus === 'Enviada').length },
    { label: 'Aceptada', count: state.invoices.filter(i => i.kind === 'FV' && i.dianStatus === 'Aceptada').length },
    { label: 'En cartera', count: state.receivables.filter(i => i.balance > 0).length },
  ];

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          {flow.map((step, index) => (
            <div key={step.label} className="flex items-center gap-3">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5">
                <div className="text-[10px] uppercase tracking-wide text-gray-400">{step.label}</div>
                <div className="text-sm font-semibold text-gray-800">{step.count}</div>
              </div>
              {index < flow.length - 1 && <Icon name="arrow" className="h-3.5 w-3.5 text-gray-300" />}
            </div>
          ))}
        </div>
        <FilterBar>
          <SearchInput placeholder="Buscar número, cliente o NIT…" value={query} onChange={event => onQuery(event.target.value)} />
          <FilterSelect value={status} onChange={event => onStatus(event.target.value)} aria-label="Estado">
            {['Todos', 'Borrador', 'Por enviar', 'Contabilizada', 'Pendiente', 'Enviada', 'Aceptada', 'Rechazada', 'Anulada'].map(value => <option key={value}>{value}</option>)}
          </FilterSelect>
        </FilterBar>
        <DataTable columns={columns} rows={rows} rowKey={row => row.id} onRowClick={row => onOpen(row.id)} empty="No hay facturas de venta con los filtros aplicados." />
      </Card>
      <p className="text-[11px] text-gray-500">Los documentos aceptados por DIAN alimentan automáticamente la bandeja de cartera.</p>
    </>
  );
}

function PurchaseInvoices({ state, onOpen, onCreate }: { state: FinanceState; onOpen: (id: string) => void; onCreate: () => void }) {
  const rows = state.invoices.filter(invoice => invoice.kind === 'FC');
  const columns: Column<Invoice>[] = [
    { header: 'Documento', cell: invoice => <span className="font-mono font-semibold">{invoice.number}</span> },
    { header: 'Proveedor', cell: invoice => <div className="max-w-60"><div className="truncate">{partyOf(state, invoice.partyId)?.name}</div><div className="text-[10px] text-gray-400">{partyOf(state, invoice.partyId)?.nit}</div></div> },
    { header: 'Recepción', cell: invoice => fmtDate(invoice.date) },
    { header: 'Vence', cell: invoice => fmtDate(invoice.dueDate) },
    { header: 'Bruto', align: 'right', cell: invoice => <Money value={invoiceTotals(invoice).subtotal + invoiceTotals(invoice).tax} /> },
    { header: 'Retención', align: 'right', cell: invoice => <Money value={invoiceTotals(invoice).withholding} className="text-amber-700" /> },
    { header: 'Neto', align: 'right', cell: invoice => <Money value={invoiceTotals(invoice).total} className="font-semibold" /> },
    { header: 'Estado', cell: invoice => <Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge> },
  ];
  return (
    <Card>
      <SectionTitle
        title="Documentos de proveedor"
        detail="Cada factura contabilizada genera una obligación en cuentas por pagar."
        action={<Button variant="primary" size="sm" onClick={onCreate}><Icon name="plus" className="h-3.5 w-3.5" /> Registrar compra</Button>}
      />
      <DataTable columns={columns} rows={rows} rowKey={row => row.id} onRowClick={row => onOpen(row.id)} empty="Aún no hay facturas de compra." />
    </Card>
  );
}

function NotesView({ state, onOpen, onCreate }: { state: FinanceState; onOpen: (id: string) => void; onCreate: (referenceId?: string) => void }) {
  const rows = state.invoices.filter(invoice => invoice.kind === 'NC' || invoice.kind === 'ND');
  const columns: Column<Invoice>[] = [
    { header: 'Nota', cell: invoice => <span className="font-mono font-semibold">{invoice.number}</span> },
    { header: 'Tipo', cell: invoice => <Badge tone={invoice.kind === 'NC' ? 'violet' : 'amber'}>{invoice.kind === 'NC' ? 'Crédito' : 'Débito'}</Badge> },
    { header: 'Documento original', cell: invoice => state.invoices.find(item => item.id === invoice.referenceId)?.number ?? '—' },
    { header: 'Tercero', cell: invoice => <span className="block max-w-56 truncate">{partyOf(state, invoice.partyId)?.name}</span> },
    { header: 'Fecha', cell: invoice => fmtDate(invoice.date) },
    { header: 'Motivo', cell: invoice => <span className="block max-w-64 truncate text-gray-500">{invoice.motive || '—'}</span> },
    { header: 'Valor', align: 'right', cell: invoice => <Money value={invoiceTotals(invoice).total} className="font-semibold" /> },
    { header: 'Estado', cell: invoice => <Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge> },
  ];
  return (
    <Card>
      <SectionTitle
        title="Notas emitidas"
        detail="Las notas crédito reducen cartera o CxP; las notas débito las aumentan."
        action={<Button variant="primary" size="sm" onClick={() => onCreate()}><Icon name="plus" className="h-3.5 w-3.5" /> Nueva nota</Button>}
      />
      <DataTable columns={columns} rows={rows} rowKey={row => row.id} onRowClick={row => onOpen(row.id)} empty="No se han emitido notas crédito o débito." />
    </Card>
  );
}

function DianCenter({ state, onSend, onResolve, onOpen, onAcceptAll }: {
  state: FinanceState;
  onSend: (id: string) => void;
  onResolve: (id: string, result: 'Aceptada' | 'Rechazada') => void;
  onOpen: (id: string) => void;
  onAcceptAll: () => void;
}) {
  const documents = state.invoices.filter(invoice => invoice.kind !== 'FC');
  const counts = {
    pendiente: documents.filter(invoice => invoice.dianStatus === 'Pendiente').length,
    enviada: documents.filter(invoice => invoice.dianStatus === 'Enviada').length,
    aceptada: documents.filter(invoice => invoice.dianStatus === 'Aceptada').length,
    rechazada: documents.filter(invoice => invoice.dianStatus === 'Rechazada').length,
  };
  const columns: Column<Invoice>[] = [
    { header: 'Documento', cell: invoice => <span className="font-mono font-semibold">{invoice.number}</span> },
    { header: 'Cliente', cell: invoice => <span className="block max-w-56 truncate">{partyOf(state, invoice.partyId)?.name}</span> },
    { header: 'CUFE', cell: invoice => <span className="font-mono text-[10px] text-gray-500">{invoice.cufe || 'Sin generar'}</span> },
    { header: 'Estado', cell: invoice => <Badge tone={statusTone(invoice.dianStatus)}>{invoice.dianStatus}</Badge> },
    { header: 'Valor', align: 'right', cell: invoice => <Money value={invoiceTotals(invoice).total} /> },
    {
      header: 'Acciones',
      align: 'right',
      cell: invoice => (
        <div className="flex justify-end gap-1.5" onClick={event => event.stopPropagation()}>
          {invoice.dianStatus === 'Pendiente' && <Button size="sm" variant="primary" onClick={() => onSend(invoice.id)}>Enviar</Button>}
          {invoice.dianStatus === 'Enviada' && <Button size="sm" variant="success" onClick={() => onResolve(invoice.id, 'Aceptada')}>Aceptar</Button>}
          {invoice.dianStatus === 'Enviada' && <Button size="sm" variant="danger" onClick={() => onResolve(invoice.id, 'Rechazada')}>Rechazar</Button>}
        </div>
      ),
    },
  ];
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <KpiCard label="Pendientes" value={String(counts.pendiente)} detail="Listos para enviar" tone="amber" />
          <KpiCard label="En tránsito" value={String(counts.enviada)} detail="Esperando respuesta" tone="blue" />
          <KpiCard label="Aceptados" value={String(counts.aceptada)} detail="Documento válido" tone="green" />
          <KpiCard label="Rechazados" value={String(counts.rechazada)} detail="Corregir y reenviar" tone="red" />
        </div>
        <Card>
          <SectionTitle
            title="Cola de documentos electrónicos"
            detail="La aceptación es simulada en esta capa; el adaptador DIAN queda aislado para producción."
            action={<Button size="sm" variant="secondary" onClick={onAcceptAll}>Aceptar enviadas</Button>}
          />
          <DataTable columns={columns} rows={documents} rowKey={row => row.id} onRowClick={row => onOpen(row.id)} empty="No hay documentos electrónicos." />
        </Card>
      </div>
      <Card className="h-fit">
        <SectionTitle title="Últimos eventos" detail="Bitácora de respuestas DIAN" />
        <div className="max-h-[28rem] space-y-3 overflow-y-auto p-4">
          {state.dianEvents.slice(0, 12).map(event => {
            const invoice = state.invoices.find(item => item.id === event.invoiceId);
            return (
              <div key={event.id} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-gray-700">{invoice?.number ?? event.invoiceId}</span>
                  <Badge tone={statusTone(event.status)}>{event.status}</Badge>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-gray-600">{event.message}</p>
                <p className="mt-1 text-[10px] text-gray-400">{event.at} · Código {event.code}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function ResolutionsView({ state }: { state: FinanceState }) {
  const columns: Column<Resolution>[] = [
    { header: 'Prefijo', cell: row => <span className="font-mono font-semibold">{row.prefix}</span> },
    { header: 'Tipo', cell: row => row.type },
    { header: 'Rango', cell: row => <span className="font-mono">{row.from} – {row.to}</span> },
    { header: 'Siguiente', cell: row => <span className="font-mono">{row.current}</span> },
    { header: 'Disponibles', align: 'right', cell: row => <span className="font-mono">{Math.max(0, row.to - row.current + 1)}</span> },
    { header: 'Vigencia', cell: row => `${fmtDate(row.validFrom)} – ${fmtDate(row.validTo)}` },
    { header: 'Uso', cell: row => <Progress value={((row.current - row.from) / Math.max(1, row.to - row.from + 1)) * 100} /> },
    { header: 'Estado', cell: row => <Badge tone={row.validTo < HOY ? 'red' : row.current > row.to ? 'amber' : 'green'}>{row.validTo < HOY ? 'Vencida' : row.current > row.to ? 'Agotada' : 'Vigente'}</Badge> },
  ];
  const fv = state.resolutions.find(row => row.prefix === 'FV');
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
      <Card>
        <SectionTitle title="Resoluciones DIAN" detail="Rangos autorizados y consecutivos reservados." />
        <DataTable columns={columns} rows={state.resolutions} rowKey={row => row.id} empty="No hay resoluciones registradas." />
      </Card>
      <Card className="h-fit">
        <SectionTitle title="Recomendaciones" />
        <div className="space-y-3 p-4 text-[11px] leading-5 text-gray-600">
          <p>La resolución <strong>FV</strong> tiene {fv ? Math.max(0, fv.to - fv.current + 1) : 0} números disponibles.</p>
          <p>Una resolución agotada bloquea la emisión: cree un nuevo rango antes de llegar al límite.</p>
          <p>Los documentos anulados conservan su número; nunca se reutiliza un consecutivo.</p>
        </div>
      </Card>
    </div>
  );
}

function ProductsView({ state, onToggle }: { state: FinanceState; onToggle: (id: string) => void }) {
  const columns: Column<Product>[] = [
    { header: 'Código', cell: row => <span className="font-mono font-semibold">{row.code}</span> },
    { header: 'Nombre', cell: row => row.name },
    { header: 'Unidad', cell: row => row.unit },
    { header: 'Precio base', align: 'right', cell: row => <Money value={row.price} /> },
    { header: 'IVA', align: 'right', cell: row => `${row.taxRate} %` },
    { header: 'Cuenta', cell: row => <span className="font-mono">{row.account}</span> },
    { header: 'Estado', cell: row => <Badge tone={row.active ? 'green' : 'gray'}>{row.active ? 'Activo' : 'Inactivo'}</Badge> },
    { header: '', align: 'right', cell: row => <Button size="sm" variant="ghost" onClick={() => onToggle(row.id)}>{row.active ? 'Inactivar' : 'Activar'}</Button> },
  ];
  return (
    <Card>
      <SectionTitle title="Catálogo de productos y servicios" detail="El impuesto y la cuenta se heredan en cada línea de factura." />
      <DataTable columns={columns} rows={state.products} rowKey={row => row.id} empty="No hay productos." />
    </Card>
  );
}

function ImportView({ fileName, validated, onFile, onValidate, onImport }: {
  fileName: string;
  validated: boolean;
  onFile: (name: string) => void;
  onValidate: () => void;
  onImport: () => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
      <Card>
        <SectionTitle title="Carga de documentos" detail="Formatos aceptados: CSV, XLSX y JSON con plantilla de facturación." />
        <div className="p-4">
          <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-petroleum-200 bg-petroleum-50/40 px-6 py-10 text-center transition hover:bg-petroleum-50">
            <Icon name="download" className="mb-2 h-7 w-7 text-petroleum-500" />
            <span className="text-sm font-medium text-gray-700">Seleccione el archivo de facturas</span>
            <span className="mt-1 text-[11px] text-gray-500">Máximo 5.000 filas. Se valida antes de crear documentos.</span>
            <input type="file" accept=".csv,.xlsx,.json" className="hidden" onChange={event => onFile(event.target.files?.[0]?.name ?? '')} />
          </label>
          {fileName && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-gray-700"><Icon name="document" className="h-4 w-4 text-petroleum-500" /> {fileName}</div>
              <Button size="sm" variant={validated ? 'secondary' : 'primary'} onClick={onValidate} disabled={validated}>{validated ? 'Validado' : 'Validar archivo'}</Button>
            </div>
          )}
          {validated && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
              <p className="font-semibold">Archivo validado</p>
              <p className="mt-1">2 facturas de compra listas para importar. 0 filas rechazadas.</p>
              <Button className="mt-3" size="sm" variant="success" onClick={onImport}>Crear 2 borradores</Button>
            </div>
          )}
          <div className="mt-5 overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-left text-gray-500"><tr><th className="px-3 py-2">Columna</th><th className="px-3 py-2">Campo</th><th className="px-3 py-2">Requerido</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {[['NIT', 'Tercero', 'Sí'], ['Número', 'Documento', 'Sí'], ['Fecha', 'Fecha de emisión', 'Sí'], ['Base', 'Valor sin impuestos', 'Sí'], ['IVA', 'Impuesto', 'No'], ['Retención', 'Retención aplicada', 'No']].map(row => (
                  <tr key={row[0]}><td className="px-3 py-2 font-mono">{row[0]}</td><td className="px-3 py-2">{row[1]}</td><td className="px-3 py-2">{row[2]}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
      <Card className="h-fit">
        <SectionTitle title="Buenas prácticas" />
        <ul className="list-disc space-y-2 p-4 pl-8 text-[11px] leading-5 text-gray-600">
          <li>Verifique que el NIT exista en terceros antes de cargar.</li>
          <li>Un archivo repetido se rechaza por hash para evitar duplicados.</li>
          <li>Las filas con error se descargan y no crean documentos parciales.</li>
          <li>Los documentos importados nacen en borrador para revisión.</li>
        </ul>
      </Card>
    </div>
  );
}

function InvoiceDrawer({ state, invoice, onClose, onPost, onSend, onResolve, onNote, onRevert, onNavigate }: {
  state: FinanceState;
  invoice: Invoice;
  onClose: () => void;
  onPost: (id: string) => void;
  onSend: (id: string) => void;
  onResolve: (id: string, result: 'Aceptada' | 'Rechazada') => void;
  onNote: (referenceId: string) => void;
  onRevert: (id: string) => void;
  onNavigate: (page: NavPage) => void;
}) {
  const totals = invoiceTotals(invoice);
  const party = partyOf(state, invoice.partyId);
  const events = state.dianEvents.filter(event => event.invoiceId === invoice.id);
  const linkedReceivable = state.receivables.find(item => item.invoiceId === invoice.id);
  const linkedPayable = state.payables.find(item => item.invoiceId === invoice.id);
  return (
    <Drawer title={`${invoice.number} · ${party?.name ?? 'Tercero'}`} subtitle={`${invoice.kind === 'FV' ? 'Factura de venta' : invoice.kind === 'FC' ? 'Factura de compra' : 'Nota'} · ${fmtDate(invoice.date)}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge>
          <Badge tone={statusTone(invoice.dianStatus)}>DIAN {invoice.dianStatus}</Badge>
          {invoice.cufe && <Badge tone="cyan">CUFE {invoice.cufe}</Badge>}
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs">
          <div><div className="text-[10px] text-gray-400">NIT</div><div className="font-mono">{party?.nit ?? '—'}</div></div>
          <div><div className="text-[10px] text-gray-400">Vencimiento</div><div className="font-mono">{fmtDate(invoice.dueDate)}</div></div>
          <div><div className="text-[10px] text-gray-400">Subtotal</div><Money value={totals.subtotal} /></div>
          <div><div className="text-[10px] text-gray-400">IVA</div><Money value={totals.tax} /></div>
          <div><div className="text-[10px] text-gray-400">Retenciones</div><Money value={totals.withholding} /></div>
          <div><div className="text-[10px] text-gray-400">Total</div><Money value={totals.total} className="font-semibold" /></div>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold text-gray-700">Líneas del documento</h3>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-[11px]">
              <thead className="bg-gray-50 text-gray-500"><tr><th className="px-2 py-2 text-left">Descripción</th><th className="px-2 py-2 text-right">Cant.</th><th className="px-2 py-2 text-right">Precio</th><th className="px-2 py-2 text-right">IVA</th><th className="px-2 py-2 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.lines.map(line => (
                  <tr key={line.id}>
                    <td className="px-2 py-2">{line.description}<div className="text-[9px] text-gray-400">{line.productCode} · CC {line.costCenter}</div></td>
                    <td className="px-2 py-2 text-right font-mono">{line.quantity}</td>
                    <td className="px-2 py-2 text-right"><Money value={line.price} /></td>
                    <td className="px-2 py-2 text-right">{line.taxRate} %</td>
                    <td className="px-2 py-2 text-right"><Money value={line.quantity * line.price * (1 - line.discountPct / 100) * (1 + line.taxRate / 100)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {invoice.motive && <div className="rounded-lg bg-violet-50 px-3 py-2 text-[11px] text-violet-800"><strong>Motivo:</strong> {invoice.motive}</div>}

        <div>
          <h3 className="mb-2 text-xs font-semibold text-gray-700">Trazabilidad</h3>
          <div className="space-y-2">
            {events.length === 0 && <p className="text-[11px] text-gray-500">Sin eventos DIAN registrados.</p>}
            {events.map(event => (
              <div key={event.id} className="rounded-lg border border-gray-100 px-3 py-2">
                <div className="flex items-center justify-between"><Badge tone={statusTone(event.status)}>{event.status}</Badge><span className="text-[10px] text-gray-400">{event.at}</span></div>
                <p className="mt-1 text-[11px] text-gray-600">{event.message}</p>
              </div>
            ))}
          </div>
        </div>

        {(linkedReceivable || linkedPayable) && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">
            {linkedReceivable && <>Partida de cartera <strong>{linkedReceivable.invoiceNumber}</strong> · saldo <Money value={linkedReceivable.balance} />.</>}
            {linkedPayable && <>Obligación <strong>{linkedPayable.invoiceNumber}</strong> · saldo <Money value={linkedPayable.balance} />.</>}
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          {invoice.status !== 'Contabilizada' && <Button variant="primary" onClick={() => onPost(invoice.id)}>Contabilizar</Button>}
          {invoice.kind === 'FV' && invoice.dianStatus !== 'Aceptada' && <Button variant="success" onClick={() => onSend(invoice.id)}>Enviar a DIAN</Button>}
          {invoice.dianStatus === 'Enviada' && <Button onClick={() => onResolve(invoice.id, 'Aceptada')}>Marcar aceptada</Button>}
          {invoice.kind !== 'NC' && invoice.kind !== 'ND' && invoice.status === 'Contabilizada' && <Button variant="secondary" onClick={() => onNote(invoice.id)}>Emitir nota</Button>}
          {invoice.status === 'Contabilizada' && <Button variant="danger" onClick={() => onRevert(invoice.id)}>Revertir</Button>}
          {linkedReceivable && <Button variant="ghost" onClick={() => { onClose(); onNavigate('cartera/partidas'); }}>Ver cartera</Button>}
          {linkedPayable && <Button variant="ghost" onClick={() => { onClose(); onNavigate('cuentas-pagar/obligaciones'); }}>Ver CxP</Button>}
        </div>
      </div>
    </Drawer>
  );
}

function InvoiceEditor({ kind, state, onClose, onSave }: {
  kind: 'FV' | 'FC';
  state: FinanceState;
  onClose: () => void;
  onSave: (payload: {
    kind: 'FV' | 'FC';
    partyId: string;
    date: string;
    dueDate: string;
    paymentTerm: number;
    notes: string;
    lines: DraftLine[];
  }, post: boolean) => void;
}) {
  const parties = state.parties.filter(party => kind === 'FV' ? party.kind !== 'Proveedor' : party.kind !== 'Cliente');
  const [partyId, setPartyId] = useState(parties[0]?.id ?? '');
  const [date, setDate] = useState(HOY);
  const [term, setTerm] = useState(30);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([initialLine(kind, state.products)]);
  const dueDate = useMemo(() => {
    const base = new Date(`${date}T12:00:00`);
    base.setDate(base.getDate() + Number(term || 0));
    return base.toISOString().slice(0, 10);
  }, [date, term]);

  const preview: Invoice = {
    id: 'preview', kind, number: '—', partyId, date, dueDate, paymentTerm: term,
    status: 'Borrador', dianStatus: 'Pendiente', cufe: '', resolutionId: '', referenceId: '',
    motive: '', notes, lines, createdAt: date,
  };
  const totals = invoiceTotals(preview);
  const valid = partyId !== '' && lines.length > 0 && lines.every(line => line.description.trim() && line.price >= 0) && totals.subtotal > 0;

  function updateLine(id: string, patch: Partial<DraftLine>) {
    setLines(current => current.map(line => line.id === id ? { ...line, ...patch } : line));
  }

  function changeProduct(id: string, code: string) {
    const product = state.products.find(item => item.code === code);
    if (!product) return;
    updateLine(id, { productCode: product.code, description: product.name, price: product.price, taxRate: product.taxRate, account: product.account });
  }

  return (
    <Modal
      title={kind === 'FV' ? 'Nueva factura de venta' : 'Nueva factura de compra'}
      subtitle="Complete el encabezado y las líneas. El total se calcula automáticamente."
      onClose={onClose}
      wide
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={kind === 'FV' ? 'Cliente' : 'Proveedor'}>
              <select className={INPUT} value={partyId} onChange={event => setPartyId(event.target.value)}>
                {parties.map(party => <option key={party.id} value={party.id}>{party.name} · {party.nit}</option>)}
              </select>
            </Field>
            <Field label="Fecha de emisión"><input type="date" className={INPUT} value={date} onChange={event => setDate(event.target.value)} /></Field>
            <Field label="Condición de pago (días)"><input type="number" min={0} className={INPUT} value={term} onChange={event => setTerm(Number(event.target.value))} /></Field>
            <Field label="Fecha de vencimiento"><input type="date" className={INPUT} value={dueDate} readOnly /></Field>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
              <span className="text-xs font-semibold text-gray-700">Líneas</span>
              <Button size="sm" variant="ghost" onClick={() => setLines(current => [...current, initialLine(kind, state.products)])}><Icon name="plus" className="h-3.5 w-3.5" /> Agregar línea</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-white text-gray-500"><tr><th className="px-2 py-2 text-left">Producto</th><th className="px-2 py-2 text-left">Descripción</th><th className="px-2 py-2 text-right">Cant.</th><th className="px-2 py-2 text-right">Precio</th><th className="px-2 py-2 text-right">Desc. %</th><th className="px-2 py-2 text-right">IVA %</th><th className="px-2 py-2 text-right">Ret. %</th><th className="px-2 py-2 text-right">Total</th><th /></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {lines.map(line => {
                    const gross = line.quantity * line.price;
                    const base = gross * (1 - line.discountPct / 100);
                    const totalLine = base * (1 + line.taxRate / 100) - base * (line.withholdingRate / 100);
                    return (
                      <tr key={line.id}>
                        <td className="px-2 py-1.5">
                          <select className={INPUT} value={line.productCode} onChange={event => changeProduct(line.id, event.target.value)}>
                            {state.products.filter(product => product.active).map(product => <option key={product.id} value={product.code}>{product.code}</option>)}
                            {!state.products.some(product => product.code === line.productCode) && <option value={line.productCode}>{line.productCode || 'Libre'}</option>}
                          </select>
                        </td>
                        <td className="min-w-48 px-2 py-1.5"><input className={INPUT} value={line.description} onChange={event => updateLine(line.id, { description: event.target.value })} /></td>
                        <td className="px-2 py-1.5"><input type="number" min={1} className={`${INPUT} w-20 text-right`} value={line.quantity} onChange={event => updateLine(line.id, { quantity: Number(event.target.value) })} /></td>
                        <td className="px-2 py-1.5"><input type="number" min={0} className={`${INPUT} w-28 text-right`} value={line.price} onChange={event => updateLine(line.id, { price: Number(event.target.value) })} /></td>
                        <td className="px-2 py-1.5"><input type="number" min={0} max={100} className={`${INPUT} w-16 text-right`} value={line.discountPct} onChange={event => updateLine(line.id, { discountPct: Number(event.target.value) })} /></td>
                        <td className="px-2 py-1.5"><input type="number" min={0} max={100} className={`${INPUT} w-16 text-right`} value={line.taxRate} onChange={event => updateLine(line.id, { taxRate: Number(event.target.value) })} /></td>
                        <td className="px-2 py-1.5"><input type="number" min={0} max={100} className={`${INPUT} w-16 text-right`} value={line.withholdingRate} onChange={event => updateLine(line.id, { withholdingRate: Number(event.target.value) })} /></td>
                        <td className="px-2 py-1.5 text-right"><Money value={totalLine} /></td>
                        <td className="px-2 py-1.5 text-right"><button type="button" onClick={() => setLines(current => current.length === 1 ? current : current.filter(item => item.id !== line.id))} className="text-gray-400 hover:text-red-600" aria-label="Eliminar línea"><Icon name="close" className="h-3.5 w-3.5" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Field label="Observaciones"><textarea className={`${INPUT} min-h-20`} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Notas internas o condiciones del documento" /></Field>
        </div>

        <aside className="h-fit rounded-xl border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-xs font-semibold text-gray-700">Resumen del documento</h3>
          <dl className="mt-3 space-y-2 text-[11px]">
            <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd><Money value={totals.subtotal} /></dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Descuentos</dt><dd><Money value={totals.discount} /></dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">IVA</dt><dd><Money value={totals.tax} /></dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Retenciones</dt><dd><Money value={totals.withholding} /></dd></div>
            <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-semibold"><dt>Total</dt><dd><Money value={totals.total} /></dd></div>
          </dl>
          <div className="mt-3 rounded-lg bg-white p-2.5 text-[10px] leading-4 text-gray-500">
            {kind === 'FV'
              ? 'Al contabilizar se crea la partida de cartera y el documento queda listo para envío DIAN.'
              : 'Al contabilizar se crea la obligación por pagar por el valor neto de retenciones.'}
          </div>
          <div className="mt-4 space-y-2">
            <Button variant="primary" className="w-full" disabled={!valid} onClick={() => onSave({ kind, partyId, date, dueDate, paymentTerm: term, notes, lines }, true)}>
              {kind === 'FV' ? 'Emitir y contabilizar' : 'Registrar y contabilizar'}
            </Button>
            <Button variant="secondary" className="w-full" disabled={!valid} onClick={() => onSave({ kind, partyId, date, dueDate, paymentTerm: term, notes, lines }, false)}>
              Guardar borrador
            </Button>
          </div>
        </aside>
      </div>
    </Modal>
  );
}

function NoteEditor({ state, initialReference, onClose, onSave }: {
  state: FinanceState;
  initialReference: string;
  onClose: () => void;
  onSave: (payload: { kind: 'NC' | 'ND'; referenceId: string; motive: string; amount: number }) => void;
}) {
  const [kind, setKind] = useState<'NC' | 'ND'>('NC');
  const [referenceId, setReferenceId] = useState(initialReference);
  const [motive, setMotive] = useState('');
  const [amount, setAmount] = useState(0);
  const originals = state.invoices.filter(invoice => (invoice.kind === 'FV' || invoice.kind === 'FC') && invoice.status === 'Contabilizada');
  const original = originals.find(invoice => invoice.id === referenceId);
  const party = original ? partyOf(state, original.partyId) : undefined;
  const max = original ? invoiceTotals(original).total : 0;
  const valid = referenceId !== '' && motive.trim().length >= 4 && amount > 0 && amount <= max;
  return (
    <Modal title="Nueva nota de ajuste" subtitle="La nota actualiza el saldo de cartera u obligación del documento original." onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo de nota">
          <select className={INPUT} value={kind} onChange={event => setKind(event.target.value as 'NC' | 'ND')}>
            <option value="NC">Nota crédito</option>
            <option value="ND">Nota débito</option>
          </select>
        </Field>
        <Field label="Documento original">
          <select className={INPUT} value={referenceId} onChange={event => setReferenceId(event.target.value)}>
            <option value="">Seleccione…</option>
            {originals.map(invoice => <option key={invoice.id} value={invoice.id}>{invoice.number} · {partyOf(state, invoice.partyId)?.name}</option>)}
          </select>
        </Field>
        <Field label="Valor de la nota" hint="IVA incluido">
          <input type="number" min={0} className={INPUT} value={amount} onChange={event => setAmount(Number(event.target.value))} />
        </Field>
        <Field label="Saldo del documento">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
            {original ? <><div>{party?.name}</div><div className="mt-0.5 text-[10px] text-gray-500">Total original: {money(max)}</div></> : 'Seleccione un documento'}
          </div>
        </Field>
        <Field label="Motivo" className="sm:col-span-2">
          <textarea className={`${INPUT} min-h-20`} value={motive} onChange={event => setMotive(event.target.value)} placeholder="Explique el ajuste; quedará en la trazabilidad." />
        </Field>
      </div>
      {amount > max && <p className="mt-2 text-[11px] text-red-600">El valor no puede superar el total del documento original.</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => onSave({ kind, referenceId, motive, amount })}>Emitir nota</Button>
      </div>
    </Modal>
  );
}

function ResolutionEditor({ onClose, onSave }: { onClose: () => void; onSave: (payload: Omit<Resolution, 'id' | 'active' | 'current'>) => void }) {
  const [prefix, setPrefix] = useState('FV');
  const [from, setFrom] = useState(2000);
  const [to, setTo] = useState(2999);
  const [validFrom, setValidFrom] = useState('2026-03-01');
  const [validTo, setValidTo] = useState('2026-12-31');
  const [type, setType] = useState<'Venta' | 'Compra'>('Venta');
  const valid = prefix.trim().length >= 2 && from > 0 && to >= from && validFrom !== '' && validTo >= validFrom;
  return (
    <Modal title="Nueva resolución de numeración" subtitle="Defina el rango autorizado y su vigencia." onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Prefijo"><input className={INPUT} value={prefix} maxLength={4} onChange={event => setPrefix(event.target.value.toUpperCase())} /></Field>
        <Field label="Tipo"><select className={INPUT} value={type} onChange={event => setType(event.target.value as 'Venta' | 'Compra')}><option>Venta</option><option>Compra</option></select></Field>
        <Field label="Desde"><input type="number" className={INPUT} value={from} onChange={event => setFrom(Number(event.target.value))} /></Field>
        <Field label="Hasta"><input type="number" className={INPUT} value={to} onChange={event => setTo(Number(event.target.value))} /></Field>
        <Field label="Vigente desde"><input type="date" className={INPUT} value={validFrom} onChange={event => setValidFrom(event.target.value)} /></Field>
        <Field label="Vigente hasta"><input type="date" className={INPUT} value={validTo} onChange={event => setValidTo(event.target.value)} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2"><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!valid} onClick={() => onSave({ prefix, from, to, validFrom, validTo, type })}>Crear resolución</Button></div>
    </Modal>
  );
}

function ProductEditor({ onClose, onSave }: { onClose: () => void; onSave: (payload: Omit<Product, 'id' | 'active'>) => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('Unidad');
  const [price, setPrice] = useState(0);
  const [taxRate, setTaxRate] = useState(19);
  const [account, setAccount] = useState('4155');
  const valid = code.trim() !== '' && name.trim() !== '' && price >= 0;
  return (
    <Modal title="Nuevo producto o servicio" subtitle="El catálogo alimenta las líneas de facturación." onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Código"><input className={INPUT} value={code} onChange={event => setCode(event.target.value.toUpperCase())} /></Field>
        <Field label="Nombre"><input className={INPUT} value={name} onChange={event => setName(event.target.value)} /></Field>
        <Field label="Unidad"><input className={INPUT} value={unit} onChange={event => setUnit(event.target.value)} /></Field>
        <Field label="Precio base"><input type="number" className={INPUT} value={price} onChange={event => setPrice(Number(event.target.value))} /></Field>
        <Field label="IVA %"><input type="number" className={INPUT} value={taxRate} onChange={event => setTaxRate(Number(event.target.value))} /></Field>
        <Field label="Cuenta contable"><input className={INPUT} value={account} onChange={event => setAccount(event.target.value)} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2"><Button onClick={onClose}>Cancelar</Button><Button variant="primary" disabled={!valid} onClick={() => onSave({ code, name, unit, price, taxRate, account })}>Crear producto</Button></div>
    </Modal>
  );
}
