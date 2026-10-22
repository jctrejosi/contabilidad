import { useMemo } from 'react';
import { Badge, BarChart, Card, DataTable, KpiCard, Money, SectionTitle } from '../../../components/finance/ui';
import { fmtDate } from '../../../finance/selectors';
import type { FinanceState } from '../../../finance/types';
import {
  currentCash,
  monthLabel,
  projectedFlow,
  projectedInflows,
  projectedOutflows,
  projectedMonths,
  type ProjectedItem,
} from './cashflow';

function ItemTable({ title, detail, items, tone }: { title: string; detail: string; items: ProjectedItem[]; tone: 'green' | 'amber' }) {
  return (
    <Card>
      <SectionTitle title={title} detail={detail} />
      <DataTable
        rows={items}
        rowKey={item => item.id}
        dense
        empty="Sin movimientos en el horizonte."
        columns={[
          { header: 'Fecha', cell: item => <div><div className="tabular text-gray-700">{fmtDate(item.date)}</div>{item.overdue && <div className="text-[9px] font-medium text-red-600">Vencido</div>}</div> },
          { header: 'Concepto', cell: item => <div><div className="font-medium text-gray-800">{item.concept}</div><div className="text-[9px] text-gray-400">{item.party}</div></div> },
          { header: 'Origen', cell: item => <Badge tone={item.source === 'Cartera' ? 'green' : item.source === 'Deuda' ? 'violet' : item.source === 'Leasing' ? 'cyan' : 'amber'}>{item.source}</Badge> },
          { header: 'Valor', align: 'right', cell: item => <span className={`tabular font-semibold ${tone === 'green' ? 'text-emerald-700' : 'text-red-700'}`}>{item.amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> },
        ]}
        footer={<div className="text-right text-[11px] text-gray-600">Total: <strong className="tabular">{items.reduce((total, item) => total + item.amount, 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</strong></div>}
      />
    </Card>
  );
}

export default function FlujoProyectado({ state }: { state: FinanceState }) {
  const rows = useMemo(() => projectedFlow(state), [state]);
  const months = projectedMonths();
  const horizon = `${months[months.length - 1]}-31`;

  const inflows = projectedInflows(state).filter(item => item.date <= horizon);
  const outflows = projectedOutflows(state).filter(item => item.date <= horizon);

  const opening = currentCash(state).total;
  const totalIn = rows.reduce((total, row) => total + row.inflow, 0);
  const totalOut = rows.reduce((total, row) => total + row.outflow, 0);
  const final = rows[rows.length - 1]?.closing ?? opening;
  const negative = rows.find(row => row.closing < 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Saldo inicial" value={<Money value={opening} />} detail="Disponible al cierre de hoy" tone="blue" />
        <KpiCard label="Entradas esperadas" value={<Money value={totalIn} />} detail={`${inflows.length} recaudos en el horizonte`} tone="green" />
        <KpiCard label="Salidas esperadas" value={<Money value={totalOut} />} detail={`${outflows.length} compromisos`} tone="amber" />
        <KpiCard label="Saldo final proyectado" value={<Money value={final} />} detail={negative ? `Déficit en ${monthLabel(negative.month)}` : 'Sin déficit proyectado'} tone={final >= 0 ? 'cyan' : 'red'} />
      </div>

      <Card>
        <SectionTitle
          title="Flujo de caja proyectado"
          detail={`Horizonte de ${months.length} meses. Incluye cartera, CxP, cuotas de deuda, leasing y reembolsos aprobados.`}
        />
        <div className="px-4 py-4">
          <BarChart
            data={rows.map(row => ({ label: row.label.split(' ')[0], value: row.net }))}
            height={160}
            tone={final >= 0 ? 'cyan' : 'red'}
            formatter={value => `${Math.round(value / 1_000_000)} M`}
          />
        </div>
        <DataTable
          rows={rows}
          rowKey={row => row.month}
          columns={[
            { header: 'Mes', cell: row => <span className="font-medium text-gray-800">{row.label}</span> },
            { header: 'Entradas', align: 'right', cell: row => <span className="tabular text-emerald-700">{row.inflow.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> },
            { header: 'Salidas', align: 'right', cell: row => <span className="tabular text-red-700">{row.outflow.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> },
            { header: 'Flujo neto', align: 'right', cell: row => <span className={row.net >= 0 ? 'tabular font-semibold text-emerald-700' : 'tabular font-semibold text-red-700'}>{row.net.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> },
            { header: 'Saldo de cierre', align: 'right', cell: row => <span className={row.closing < 0 ? 'tabular font-semibold text-red-700' : 'tabular font-semibold text-gray-800'}>{row.closing.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> },
            { header: 'Estado', cell: row => <Badge tone={row.closing < 0 ? 'red' : row.net < 0 ? 'amber' : 'green'}>{row.closing < 0 ? 'Déficit' : row.net < 0 ? 'Consume caja' : 'Cubre'}</Badge> },
          ]}
          footer={<div className="flex items-center justify-between text-[11px] text-gray-600"><span>Flujo neto del horizonte</span><span className="tabular font-semibold">{(totalIn - totalOut).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span></div>}
        />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <ItemTable title="Recaudos esperados" detail="Cartera abierta ordenada por vencimiento." items={inflows} tone="green" />
        <ItemTable title="Pagos y compromisos" detail="CxP, deuda, leasing y reembolsos aprobados." items={outflows} tone="amber" />
      </div>

      <Card>
        <SectionTitle title="Supuestos de la proyección" detail="Reglas aplicadas para construir el flujo." />
        <div className="grid gap-3 px-4 py-4 text-[11px] leading-5 text-gray-600 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-1 font-semibold text-gray-800">Entradas</div>
            Saldo de las partidas de cartera no pagadas, castigadas ni revertidas, en la fecha de vencimiento. Las partidas vencidas se ubican en el primer mes del horizonte.
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-1 font-semibold text-gray-800">Salidas</div>
            CxP abiertas, cuotas pendientes de préstamos, cuotas mensuales de leasing vigente y reembolsos de gastos aprobados. Las obligaciones vencidas también se ubican en el primer mes.
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-1 font-semibold text-gray-800">Depreciación y provisiones</div>
            No entran al flujo porque no generan movimiento de efectivo. El módulo solo considera movimientos de caja.
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-1 font-semibold text-gray-800">Alcance</div>
            Es una proyección de tesorería, no un estado de flujos de efectivo NIIF. No incluye aportes de capital, dividendos ni venta de activos.
          </div>
        </div>
      </Card>
    </div>
  );
}
