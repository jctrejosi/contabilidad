import { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/Icon';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  INPUT,
  KpiCard,
  Money,
  SectionTitle,
} from '../../../components/finance/ui';
import { USUARIO } from '../../../data/mock';
import { useFinance } from '../../../finance/store';
import { HOY, fmtDate, money } from '../../../finance/selectors';
import { buildFiling, filingBalance, recomputeBoxes } from '../../../finance/tax';
import type { TaxBox, TaxFiling, TaxFormCode, TaxFilingStatus } from '../../../finance/types';

const TITLES: Record<TaxFormCode, { eyebrow: string; description: string; formula: string }> = {
  '300': {
    eyebrow: 'Formulario 300 · IVA',
    description: 'Declaración bimestral de IVA calculada desde las facturas contabilizadas del período.',
    formula: 'IVA generado − IVA descontable − retenciones de IVA = saldo a pagar.',
  },
  '350': {
    eyebrow: 'Formulario 350 · Retención',
    description: 'Retenciones en la fuente y ReteICA practicadas en el período, agrupadas por concepto.',
    formula: 'Retención en la fuente + ReteICA + otras retenciones = total del período.',
  },
  '110': {
    eyebrow: 'Formulario 110 · Renta',
    description: 'Declaración anual de renta con renta líquida, presuntiva e impuesto del ejercicio.',
    formula: 'Renta líquida gravable = mayor entre renta líquida y renta presuntiva.',
  },
};

const STATUS_TONE: Record<TaxFilingStatus, 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'violet'> = {
  Borrador: 'gray',
  Calculada: 'amber',
  Validada: 'blue',
  Presentada: 'violet',
  Aceptada: 'green',
  Rechazada: 'red',
};

const PERIOD = '2026-02';

export default function Formulario({
  code,
  showToast,
}: {
  code: TaxFormCode;
  showToast: (text: string) => void;
}) {
  const { state, update } = useFinance();
  const filing = state.taxFilings.find(item => item.code === code);
  const [values, setValues] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!filing) return;
    setValues(Object.fromEntries(filing.boxes.map(box => [box.number, box.value])));
  }, [filing?.id, filing]);

  const boxes: TaxBox[] = useMemo(
    () => filing ? filing.boxes.map(box => ({ ...box, value: values[box.number] ?? box.value })) : [],
    [filing, values],
  );

  function persist(next: TaxBox[], action: string, status?: TaxFilingStatus) {
    if (!filing) return;
    const balance = filingBalance(code, next);
    update(draft => {
      const target = draft.taxFilings.find(item => item.id === filing.id);
      if (!target) return;
      target.boxes = next;
      target.balance = balance;
      if (status) {
        target.status = status;
      } else if (target.status === 'Borrador' || target.status === 'Calculada') {
        target.status = 'Calculada';
      }
    }, action, 'facturacion');
    setValues(Object.fromEntries(next.map(box => [box.number, box.value])));
  }

  function save() {
    persist(boxes, `Formulario ${code} ajustado`);
    showToast(`Formulario ${code} guardado con saldo ${money(filingBalance(code, boxes))}.`);
  }

  function recalculate() {
    if (!filing) return;
    const next = recomputeBoxes(code, state, filing.period, boxes);
    persist(next, `Formulario ${code} recalculado desde documentos`);
    showToast(`Formulario ${code} recalculado desde las facturas del período.`);
  }

  function validate() {
    if (!filing) return;
    persist(boxes, `Formulario ${code} validado`, 'Validada');
    showToast(`Formulario ${code} validado. Puede presentarse desde Declaración electrónica.`);
  }

  function create() {
    const record: TaxFiling = buildFiling(state, code, PERIOD);
    update(draft => {
      draft.taxFilings.unshift(record);
    }, `Formulario ${code} generado`, 'facturacion');
    showToast(`Formulario ${code} generado para ${record.period}.`);
  }

  if (!filing) {
    return (
      <EmptyState
        title={`No hay formulario ${code} generado`}
        detail="Cree el formulario para calcularlo desde los documentos contabilizados del período."
        action={<Button variant="primary" onClick={create}>Generar formulario {code}</Button>}
      />
    );
  }

  const meta = TITLES[code];
  const balance = filingBalance(code, boxes);
  const editable = code !== '110';

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Saldo a pagar" value={<Money value={balance} />} detail={balance >= 0 ? 'Obligación del período' : 'Saldo a favor'} tone={balance > 0 ? 'red' : 'green'} />
        <KpiCard label="Estado" value={<Badge tone={STATUS_TONE[filing.status]}>{filing.status}</Badge>} detail={`Última revisión por ${USUARIO.nombre}`} tone="blue" />
        <KpiCard label="Período" value={filing.period} detail={code === '110' ? 'Ejercicio anual' : 'Bimestre'} tone="cyan" />
        <KpiCard label="Vencimiento" value={fmtDate(filing.dueDate)} detail={`Formulario ${code} · ${filing.name}`} tone="amber" />
      </div>

      <Card>
        <SectionTitle
          title={`${meta.eyebrow} · ${filing.period}`}
          detail={meta.description}
          action={
            <div className="flex flex-wrap gap-2">
              {editable && <Button onClick={recalculate}>Recalcular desde documentos</Button>}
              <Button onClick={save}>Guardar ajustes</Button>
              <Button variant="primary" onClick={validate} disabled={filing.status === 'Aceptada'}>Validar formulario</Button>
            </div>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-gray-100 bg-gray-50 text-gray-600">
              <tr>
                <th className="w-16 px-4 py-2 text-left font-semibold">Casilla</th>
                <th className="px-4 py-2 text-left font-semibold">Concepto</th>
                <th className="px-4 py-2 text-right font-semibold">Valor</th>
                <th className="w-28 px-4 py-2 text-left font-semibold">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {boxes.map(box => (
                <tr key={box.number} className={box.kind === 'calculado' ? 'bg-gray-50/50' : ''}>
                  <td className="px-4 py-2 font-mono text-[11px] text-gray-500">{box.number}</td>
                  <td className="px-4 py-2 text-gray-700">{box.concept}</td>
                  <td className="px-4 py-2 text-right">
                    {box.kind === 'editable' ? (
                      <input
                        type="number"
                        className={`${INPUT} w-44 text-right`}
                        value={values[box.number] ?? box.value}
                        onChange={event => setValues(current => ({ ...current, [box.number]: Number(event.target.value) }))}
                      />
                    ) : (
                      <Money value={box.value} className="font-medium" />
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={box.kind === 'calculado' ? 'blue' : box.kind === 'editable' ? 'gray' : 'cyan'}>
                      {box.kind === 'calculado' ? 'Calculado' : box.kind === 'editable' ? 'Editable' : 'Informativo'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 bg-gray-50">
              <tr>
                <td className="px-4 py-2" />
                <td className="px-4 py-2 font-semibold text-gray-800">Saldo determinado</td>
                <td className="px-4 py-2 text-right font-semibold"><Money value={balance} /></td>
                <td className="px-4 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Regla de cálculo" detail="Fórmula aplicada al formulario" />
          <div className="space-y-3 p-4 text-xs text-gray-600">
            <p>{meta.formula}</p>
            <p>
              Los valores calculados se derivan de las facturas contabilizadas y de las retenciones del
              período. Las casillas editables permiten ajustes con soporte antes de validar.
            </p>
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-[11px] text-blue-900">
              Al validar, el formulario queda listo para presentarse ante la DIAN desde la pantalla de
              declaración electrónica.
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Trazabilidad" detail="Estado y soporte del formulario" />
          <div className="space-y-3 p-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Estado actual</span>
              <Badge tone={STATUS_TONE[filing.status]}>{filing.status}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Período</span>
              <span className="font-medium text-gray-800">{filing.period}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Vencimiento</span>
              <span className="font-medium text-gray-800">{fmtDate(filing.dueDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Acuse DIAN</span>
              <span className="font-mono text-[11px] text-gray-800">{filing.receipt || 'Sin presentar'}</span>
            </div>
            {filing.note && (
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
                {filing.note}
              </p>
            )}
            <Button variant="ghost" onClick={() => showToast(`Formulario ${code} exportado para revisión.`)}>
              <Icon name="download" className="h-3.5 w-3.5" /> Exportar borrador
            </Button>
          </div>
        </Card>
      </div>

      <p className="text-[10px] text-gray-400">
        Corte del módulo: {fmtDate(HOY)} · Los valores se recalculan con las facturas y retenciones del estado local.
      </p>
    </div>
  );
}
