import type { MesMovimientoAnual } from '../api/movimientoAnualCuenta';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const money = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });
const x = (index: number) => 65 + index * (835 / 11);

interface Props {
  id: string;
  label: string;
  year: number;
  months: MesMovimientoAnual[];
  filterLabel?: string;
}

/** Visualiza exactamente los doce renglones mensuales ya devueltos por la consulta. */
export default function AnnualMovementChart({ id, label, year, months, filterLabel }: Props) {
  const balances = months.map(month => month.saldoAcumulado);
  const minimum = Math.min(0, ...balances);
  const maximum = Math.max(0, ...balances);
  const span = maximum - minimum || 1;
  const y = (value: number) => 210 - (value - minimum) / span * 170;
  const line = balances.map((value, index) => `${index ? 'L' : 'M'} ${x(index)} ${y(value)}`).join(' ');
  const maxMovement = Math.max(1, ...months.map(month => Math.max(month.debito, month.credito)));
  const hasMovement = months.some(month => month.debito !== 0 || month.credito !== 0);

  return <section id={id} aria-label={`Gráficas del movimiento anual de ${label}`} className="border-b border-gray-200 bg-white px-4 py-4">
    <p className="mb-3 text-xs text-gray-600">Comportamiento de {label} durante {year}{filterLabel ? ` · ${filterLabel}` : ''}. Los valores exactos permanecen en la tabla.</p>
    <div className="grid gap-4">
      <div className="min-w-0 rounded border border-gray-200 p-3">
        <h3 className="mb-2 text-xs font-semibold text-gray-700">Saldo acumulado por mes</h3>
        <div className="overflow-x-auto"><svg viewBox="0 0 960 250" className="min-w-[640px] w-full" role="img" aria-label="Evolución mensual del saldo acumulado">
          {[0, 0.25, 0.5, 0.75, 1].map(fraction => {
            const value = minimum + span * fraction;
            return <g key={fraction}><line x1="55" x2="920" y1={y(value)} y2={y(value)} stroke="#e5e7eb" strokeWidth="1" /><text x="50" y={y(value) + 4} textAnchor="end" fill="#6b7280" fontSize="11">{compact.format(value)}</text></g>;
          })}
          <path d={line} fill="none" stroke="#0073C0" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {months.map((month, index) => <g key={month.mes}>
            <circle cx={x(index)} cy={y(month.saldoAcumulado)} r="5" fill="#0073C0"><title>{`${MONTHS[month.mes - 1]}: ${money(month.saldoAcumulado)}`}</title></circle>
            <text x={x(index)} y="239" textAnchor="middle" fill="#4b5563" fontSize="11">{MONTHS[month.mes - 1].slice(0, 3)}</text>
          </g>)}
        </svg></div>
      </div>

      <div className="min-w-0 rounded border border-gray-200 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-gray-700">Débitos y créditos por mes</h3>
          <div className="flex gap-3 text-xs text-gray-600"><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-petroleum-500" />Débitos</span><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#00B0F2]" />Créditos</span></div>
        </div>
        {hasMovement ? <div className="overflow-x-auto"><svg viewBox="0 0 960 250" className="min-w-[640px] w-full" role="img" aria-label="Comparación mensual de débitos y créditos">
          {[0, 0.25, 0.5, 0.75, 1].map(fraction => <g key={fraction}><line x1="55" x2="920" y1={210 - fraction * 170} y2={210 - fraction * 170} stroke="#e5e7eb" strokeWidth="1" /><text x="50" y={214 - fraction * 170} textAnchor="end" fill="#6b7280" fontSize="11">{compact.format(maxMovement * fraction)}</text></g>)}
          {months.map((month, index) => {
            const center = x(index);
            const debitHeight = month.debito / maxMovement * 170;
            const creditHeight = month.credito / maxMovement * 170;
            return <g key={month.mes}>
              <rect x={center - 22} y={210 - debitHeight} width="19" height={debitHeight} rx="2" fill="#0073C0"><title>{`${MONTHS[month.mes - 1]} · Débitos: ${money(month.debito)}`}</title></rect>
              <rect x={center + 3} y={210 - creditHeight} width="19" height={creditHeight} rx="2" fill="#00B0F2"><title>{`${MONTHS[month.mes - 1]} · Créditos: ${money(month.credito)}`}</title></rect>
              <text x={center} y="239" textAnchor="middle" fill="#4b5563" fontSize="11">{MONTHS[month.mes - 1].slice(0, 3)}</text>
            </g>;
          })}
        </svg></div> : <p className="py-8 text-center text-xs text-gray-500">La cuenta no tiene débitos ni créditos en este ejercicio.</p>}
      </div>
    </div>
  </section>;
}
