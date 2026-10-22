import { Badge, Card, DataTable, KpiCard, Money, SectionTitle } from '../../../components/finance/ui';
import type { FinanceState } from '../../../finance/types';
import { money } from './shared';

export default function Leasing({ state }: { state: FinanceState }) {
  const active = state.leases.filter(lease => lease.status === 'Vigente');
  const monthly = active.reduce((total, lease) => total + lease.monthlyPayment, 0);
  const total = state.leases.reduce((value, lease) => value + lease.monthlyPayment * lease.termMonths, 0);
  const withPurchase = state.leases.filter(lease => lease.option === 'Compra').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Arrendamientos vigentes" value={String(active.length)} detail={`${state.leases.length} en total`} tone="blue" />
        <KpiCard label="Cuota mensual" value={<Money value={monthly} />} detail="Obligación por arrendamiento" tone="amber" />
        <KpiCard label="Valor total del contrato" value={<Money value={total} />} detail="Suma de cuotas del plazo" tone="cyan" />
        <KpiCard label="Con opción de compra" value={String(withPurchase)} detail="Se reconocen como activo y pasivo" tone="violet" />
      </div>

      <Card>
        <SectionTitle title="Arrendamientos financieros" detail="Contratos con reconocimiento de derecho de uso y pasivo por arrendamiento." />
        <DataTable
          rows={state.leases}
          rowKey={lease => lease.id}
          columns={[
            { header: 'Contrato', cell: lease => <div><div className="font-medium text-gray-800">{lease.assetName}</div><div className="text-[9px] text-gray-400">{lease.code} · {lease.lessor}</div></div> },
            { header: 'Cuota mensual', align: 'right', cell: lease => <Money value={lease.monthlyPayment} /> },
            { header: 'Plazo', align: 'right', cell: lease => <span className="tabular">{lease.termMonths} meses</span> },
            { header: 'Inicio', cell: lease => <span className="tabular text-gray-600">{lease.startDate}</span> },
            { header: 'Tasa EA', align: 'right', cell: lease => <span className="tabular">{lease.annualRate.toFixed(2)} %</span> },
            { header: 'Valor total', align: 'right', cell: lease => <span className="tabular text-gray-700">{money(lease.monthlyPayment * lease.termMonths)}</span> },
            { header: 'Opción', cell: lease => <Badge tone={lease.option === 'Compra' ? 'violet' : 'gray'}>{lease.option}</Badge> },
            { header: 'Estado', cell: lease => <Badge tone={lease.status === 'Vigente' ? 'green' : 'gray'}>{lease.status}</Badge> },
          ]}
          footer={<div className="flex items-center justify-between text-[11px] text-gray-600"><span>{state.leases.length} contratos</span><span className="tabular font-semibold">Cuota mensual: {money(monthly)}</span></div>}
        />
      </Card>

      <Card>
        <SectionTitle title="Tratamiento contable" detail="Criterios aplicados en el módulo." />
        <div className="grid gap-3 px-4 py-4 text-[11px] leading-5 text-gray-600 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-1 font-semibold text-gray-800">Reconocimiento inicial</div>
            El derecho de uso se mide al valor presente de las cuotas y se registra como activo, con un pasivo por arrendamiento de igual valor.
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-1 font-semibold text-gray-800">Medición posterior</div>
            Cada cuota separa intereses financieros y abono al pasivo. El activo se deprecia durante el plazo del contrato o su vida útil.
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-1 font-semibold text-gray-800">Opción de compra</div>
            Cuando el contrato transfiere la propiedad, el activo se deprecia por su vida útil y la cuota final liquida el pasivo remanente.
          </div>
        </div>
      </Card>
    </div>
  );
}
