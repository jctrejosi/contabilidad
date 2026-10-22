import { useMemo, useState } from 'react';
import { Badge, BarChart, Card, DataTable, FilterBar, FilterSelect, KpiCard, Money, SearchInput, SectionTitle } from '../../../components/finance/ui';
import { fmtDate } from '../../../finance/selectors';
import type { FinanceState } from '../../../finance/types';
import { currentCash, realFlow, realMovements } from './cashflow';

export default function FlujoReal({ state }: { state: FinanceState }) {
  const [type, setType] = useState('Todos');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => realFlow(state), [state]);
  const movements = useMemo(() => realMovements(state), [state]);

  const year = rows[0]?.month.slice(0, 4) ?? '';
  const inflow = rows.reduce((total, row) => total + row.inflow, 0);
  const outflow = rows.reduce((total, row) => total + row.outflow, 0);
  const cash = currentCash(state);

  const filtered = movements
    .filter(movement => type === 'Todos' || movement.type === type)
    .filter(movement => `${movement.concept} ${movement.party} ${movement.account}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Disponible hoy" value={<Money value={cash.total} />} detail={`Bancos ${Math.round(cash.bank / 1_000_000)} M · Caja ${Math.round(cash.petty / 1_000_000)} M`} tone="blue" />
        <KpiCard label={`Entradas ${year}`} value={<Money value={inflow} />} detail={`${movements.filter(item => item.type === 'Entrada').length} movimientos`} tone="green" />
        <KpiCard label={`Salidas ${year}`} value={<Money value={outflow} />} detail={`${movements.filter(item => item.type === 'Salida').length} movimientos`} tone="amber" />
        <KpiCard label="Flujo neto del año" value={<Money value={inflow - outflow} />} detail={inflow - outflow >= 0 ? 'Generación de caja' : 'Consumo de caja'} tone={inflow - outflow >= 0 ? 'cyan' : 'red'} />
      </div>

      <Card>
        <SectionTitle title="Flujo de caja mensual" detail="Entradas y salidas reales agrupadas por mes; el saldo de cierre se ancla al disponible actual." />
        <div className="px-4 py-4">
          <BarChart
            data={rows.map(row => ({ label: row.label.split(' ')[0], value: row.net }))}
            height={160}
            tone="cyan"
            formatter={value => `${Math.round(value / 1_000_000)} M`}
          />
        </div>
        <DataTable
          rows={rows}
          rowKey={row => row.month}
          dense
          columns={[
            { header: 'Mes', cell: row => <span className="font-medium text-gray-800">{row.label}</span> },
            { header: 'Entradas', align: 'right', cell: row => <span className="tabular text-emerald-700">{row.inflow ? row.inflow.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }) : '—'}</span> },
            { header: 'Salidas', align: 'right', cell: row => <span className="tabular text-red-700">{row.outflow ? row.outflow.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }) : '—'}</span> },
            { header: 'Flujo neto', align: 'right', cell: row => <span className={row.net >= 0 ? 'tabular font-semibold text-emerald-700' : 'tabular font-semibold text-red-700'}>{Math.abs(row.net).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> },
            { header: 'Saldo de cierre', align: 'right', cell: row => <Money value={row.closing} /> },
          ]}
          footer={<div className="flex items-center justify-between text-[11px] text-gray-600"><span>Flujo neto acumulado</span><span className="tabular font-semibold">{(inflow - outflow).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span></div>}
        />
      </Card>

      <Card>
        <SectionTitle
          title="Detalle de movimientos"
          detail="Recibos, pagos, cheques cobrados y movimientos de caja menor."
        />
        <FilterBar>
          <SearchInput placeholder="Buscar concepto, tercero o cuenta…" value={query} onChange={event => setQuery(event.target.value)} />
          <FilterSelect value={type} onChange={event => setType(event.target.value)}>
            {['Todos', 'Entrada', 'Salida'].map(value => <option key={value}>{value}</option>)}
          </FilterSelect>
        </FilterBar>
        <DataTable
          rows={filtered}
          rowKey={movement => movement.id}
          dense
          columns={[
            { header: 'Fecha', cell: movement => <span className="tabular text-gray-700">{fmtDate(movement.date)}</span> },
            { header: 'Tipo', cell: movement => <Badge tone={movement.type === 'Entrada' ? 'green' : 'amber'}>{movement.type}</Badge> },
            { header: 'Concepto', cell: movement => <div><div className="font-medium text-gray-800">{movement.concept}</div><div className="text-[9px] text-gray-400">{movement.party}</div></div> },
            { header: 'Cuenta', cell: movement => <span className="text-gray-600">{movement.account}</span> },
            { header: 'Valor', align: 'right', cell: movement => <span className={movement.type === 'Entrada' ? 'tabular font-semibold text-emerald-700' : 'tabular font-semibold text-red-700'}>{movement.amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span> },
          ]}
          footer={<div className="flex items-center justify-between text-[11px] text-gray-600"><span>{filtered.length} movimientos</span><span className="tabular font-semibold">Neto: {(filtered.reduce((total, item) => total + (item.type === 'Entrada' ? item.amount : -item.amount), 0)).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</span></div>}
        />
      </Card>

      <Card>
        <SectionTitle title="Lectura del flujo" detail="Cómo se construye el reporte." />
        <p className="px-4 py-4 text-[11px] leading-5 text-gray-600">
          El flujo real usa los registros operativos de tesorería: recibos de caja como entradas, pagos como salidas,
          cheques en estado <strong>Cobrado</strong> y movimientos de caja menor. Las transferencias entre cuentas no se
          incluyen porque son movimientos internos que no alteran la posición consolidada. El mes en curso se ancla al
          saldo disponible de las cuentas activas y de las cajas abiertas; los meses anteriores se derivan del flujo neto.
          La tabla solo muestra meses ya transcurridos, nunca meses futuros.
        </p>
      </Card>
    </div>
  );
}
