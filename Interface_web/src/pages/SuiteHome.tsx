import Icon from '../components/Icon';
import { FINANCIAL_MODULES, MODULE_ORDER } from '../data/finance';
import { PERIODO } from '../data/mock';
import type { CompaniaSesion } from '../types';
import type { NavPage } from '../components/Shell';
import { useFinance } from '../finance/store';
import { budgetAvailable, budgetTotal, compactMoney, currentVersion, HOY } from '../finance/selectors';

interface SuiteHomeProps {
  onNavigate: (page: NavPage) => void;
  compania: CompaniaSesion;
}

const moduleMetrics: Record<string, { value: string; label: string; alert?: string }> = {
  facturacion: { value: '$ 286,4 M', label: 'facturado en febrero', alert: '2 rechazadas DIAN' },
  cartera: { value: '$ 148,6 M', label: 'saldo por cobrar', alert: '9 vencidas' },
  'cuentas-pagar': { value: '$ 96,3 M', label: 'saldo por pagar', alert: '2 por aprobar' },
  tesoreria: { value: '$ 214,7 M', label: 'disponible hoy', alert: '18 sin conciliar' },
  presupuesto: { value: '78,4 %', label: 'disponible anual', alert: '4 alertas' },
};

export default function SuiteHome({ onNavigate, compania }: SuiteHomeProps) {
  const { state } = useFinance();
  const billed = state.invoices
    .filter(invoice => invoice.kind === 'FV' && invoice.status === 'Contabilizada' && invoice.date.startsWith('2026-02'))
    .reduce((total, invoice) => total + invoice.lines.reduce((sum, line) => {
      const base = line.quantity * line.price * (1 - line.discountPct / 100);
      return sum + base + base * line.taxRate / 100 - base * line.withholdingRate / 100;
    }, 0), 0);
  const receivable = state.receivables.reduce((total, item) => total + Math.max(0, item.balance), 0);
  const overdue = state.receivables.filter(item => item.balance > 0 && item.dueDate < HOY).length;
  const payable = state.payables.reduce((total, item) => total + Math.max(0, item.balance), 0);
  const proposals = state.proposals.filter(item => item.status === 'Pendiente aprobación').length;
  const treasury = state.accounts.filter(item => item.status === 'Activa').reduce((total, item) => total + item.balance, 0);
  const unreconciled = state.statementLines.filter(item => item.status !== 'Conciliado').length;
  const rejected = state.invoices.filter(item => item.dianStatus === 'Rechazada').length;
  const version = currentVersion(state);
  const availablePct = version ? (budgetAvailable(version) / Math.max(1, budgetTotal(version))) * 100 : 0;
  const openAlerts = state.budgetAlerts.filter(item => item.status === 'Abierta').length;
  const collected = state.receipts.filter(item => item.date.startsWith('2026-02')).reduce((total, item) => total + item.applied, 0);
  const paid = state.payments.filter(item => item.date.startsWith('2026-02')).reduce((total, item) => total + item.applied, 0);

  const liveMetrics: Record<string, { value: string; label: string; alert?: string }> = {
    facturacion: { value: compactMoney(billed), label: 'facturado en febrero', alert: rejected ? `${rejected} rechazada${rejected === 1 ? '' : 's'} DIAN` : 'DIAN al día' },
    cartera: { value: compactMoney(receivable), label: 'saldo por cobrar', alert: overdue ? `${overdue} vencida${overdue === 1 ? '' : 's'}` : 'Sin vencidas' },
    'cuentas-pagar': { value: compactMoney(payable), label: 'saldo por pagar', alert: proposals ? `${proposals} por aprobar` : 'Sin pendientes' },
    tesoreria: { value: compactMoney(treasury), label: 'disponible hoy', alert: unreconciled ? `${unreconciled} sin conciliar` : 'Conciliado' },
    presupuesto: { value: `${availablePct.toFixed(1)} %`, label: 'disponible anual', alert: openAlerts ? `${openAlerts} alerta${openAlerts === 1 ? '' : 's'}` : 'Sin alertas' },
  };

  const pendientes: { tag: string; title: string; page: NavPage; tone: 'danger' | 'warning' | 'info' }[] = [];
  if (rejected) pendientes.push({ tag: 'DIAN', title: `${rejected} factura${rejected === 1 ? '' : 's'} rechazada${rejected === 1 ? '' : 's'}`, page: 'facturacion/dian', tone: 'danger' });
  if (overdue) pendientes.push({ tag: 'Cobro', title: `${overdue} partida${overdue === 1 ? '' : 's'} vencida${overdue === 1 ? '' : 's'}`, page: 'cartera/partidas', tone: 'warning' });
  if (proposals) pendientes.push({ tag: 'Aprobación', title: `${proposals} propuesta${proposals === 1 ? '' : 's'} de pago`, page: 'cuentas-pagar/propuestas', tone: 'warning' });
  if (unreconciled) pendientes.push({ tag: 'Conciliación', title: `${unreconciled} movimiento${unreconciled === 1 ? '' : 's'} pendiente${unreconciled === 1 ? '' : 's'}`, page: 'tesoreria/conciliacion', tone: 'info' });
  if (openAlerts) pendientes.push({ tag: 'Presupuesto', title: `${openAlerts} alerta${openAlerts === 1 ? '' : 's'} de ejecución`, page: 'presupuesto/alertas', tone: 'warning' });
  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <section className="relative overflow-hidden rounded-xl bg-petroleum-900 text-white p-6 shadow-sm">
        <div className="absolute -right-16 -top-24 w-72 h-72 rounded-full border border-white/10" />
        <div className="absolute right-20 -bottom-32 w-64 h-64 rounded-full bg-petroleum-700/50" />
        <div className="relative max-w-3xl">
          <div className="text-xs font-semibold tracking-widest uppercase text-petroleum-200 mb-2">CONTABDSI Suite Financiera</div>
          <h1 className="text-2xl font-semibold tracking-tight">Centro financiero</h1>
          <p className="text-sm text-petroleum-100 mt-2 max-w-2xl leading-6">
            Una vista integrada para facturar, recaudar, pagar, conciliar y controlar la ejecución financiera de la compañía.
          </p>
          <div className="flex items-center gap-5 mt-5 text-xs text-petroleum-100">
            <span className="flex items-center gap-2"><Icon name="building" className="w-4 h-4" /> {compania.nombre}</span>
            <span className="flex items-center gap-2"><Icon name="calendar" className="w-4 h-4" /> {PERIODO.nombre}</span>
            <span className="font-mono">COP</span>
          </div>
        </div>
      </section>

      <div>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Módulos de la suite</h2>
            <p className="text-xs text-gray-500 mt-1">Seleccione un módulo para ingresar a su espacio de trabajo.</p>
          </div>
          <span className="text-xs text-gray-400">6 módulos activos</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <button
            onClick={() => onNavigate('dashboard')}
            className="group text-left bg-white rounded-lg border border-gray-200 p-5 hover:border-petroleum-300 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-petroleum-300"
          >
            <div className="flex items-start justify-between">
              <span className="w-10 h-10 rounded-lg bg-petroleum-50 text-petroleum-700 flex items-center justify-center">
                <Icon name="ledger" />
              </span>
              <span className="text-gray-300 group-hover:text-petroleum-500 transition-colors"><Icon name="arrow" /></span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mt-4">Contabilidad general</h3>
            <p className="text-xs text-gray-500 mt-1.5 leading-5 min-h-10">Lotes, movimientos, balances, impuestos, cierres y consolidación.</p>
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-end justify-between">
              <div><div className="text-lg font-semibold tabular text-gray-900">2.840</div><div className="text-xs text-gray-400">documentos registrados</div></div>
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">2 alertas</span>
            </div>
          </button>

          {MODULE_ORDER.map(id => {
            const module = FINANCIAL_MODULES[id];
            const metric = liveMetrics[id];
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`group text-left bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-petroleum-300 ${module.border.replace('border-', 'hover:border-')}`}
              >
                <div className="flex items-start justify-between">
                  <span className={`w-10 h-10 rounded-lg flex items-center justify-center ${module.tint} ${module.accent}`}>
                    <Icon name={module.icon} />
                  </span>
                  <span className="text-gray-300 group-hover:text-petroleum-500 transition-colors"><Icon name="arrow" /></span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900 mt-4">{module.name}</h3>
                <p className="text-xs text-gray-500 mt-1.5 leading-5 min-h-10">{module.description}</p>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-end justify-between">
                  <div><div className="text-lg font-semibold tabular text-gray-900">{metric.value}</div><div className="text-xs text-gray-400">{metric.label}</div></div>
                  {metric.alert && <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">{metric.alert}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <section className="xl:col-span-2 bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div><h2 className="text-sm font-semibold text-gray-900">Pulso financiero</h2><p className="text-xs text-gray-400 mt-0.5">Posición consolidada al 28/02/2026</p></div>
            <button className="text-xs font-medium text-petroleum-700 hover:underline">Ver informe consolidado</button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-gray-100">
            {[
              ['Ingresos del mes', compactMoney(billed), 'Facturación contabilizada'],
              ['Recaudo aplicado', compactMoney(collected), 'Recibos de febrero'],
              ['Pagos ejecutados', compactMoney(paid), 'Pagos aplicados'],
              ['Liquidez disponible', compactMoney(treasury), `${state.accounts.filter(item => item.status === 'Activa').length} cuentas activas`],
            ].map(([label, value, detail]) => (
              <div key={label} className="p-5">
                <div className="text-xs text-gray-500">{label}</div>
                <div className="text-xl font-semibold tabular text-gray-900 mt-2">{value}</div>
                <div className="text-xs text-green-600 mt-1">{detail}</div>
              </div>
            ))}
          </div>
          <div className="px-5 pb-5">
            <div className="h-28 flex items-end gap-3 border-b border-gray-200">
              {[42, 58, 48, 72, 61, 82, 68, 91, 76, 88, 72, 96].map((height, i) => (
                <div key={i} className="flex-1 rounded-t bg-petroleum-100 hover:bg-petroleum-300 transition-colors" style={{ height: `${height}%` }} />
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-2"><span>01 feb</span><span>Movimiento de caja diario</span><span>28 feb</span></div>
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Pendientes prioritarios</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {pendientes.map(item => (
              <button
                key={`${item.tag}-${item.title}`}
                type="button"
                onClick={() => onNavigate(item.page)}
                className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-gray-50"
              >
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.tone === 'danger' ? 'bg-red-500' : item.tone === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-gray-800">{item.title}</span><span className="mt-1 block text-xs text-gray-400">{item.tag}</span></span>
                <Icon name="chevron" className="h-4 w-4 text-gray-300" />
              </button>
            ))}
            {pendientes.length === 0 && <div className="px-5 py-8 text-center text-xs text-gray-500">No hay pendientes prioritarios.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
