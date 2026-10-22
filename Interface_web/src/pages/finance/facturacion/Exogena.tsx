import { useState } from 'react';
import Icon from '../../../components/Icon';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  INPUT,
  KpiCard,
  Modal,
  Money,
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import { useFinance } from '../../../finance/store';
import { HOY, fmtDate, money } from '../../../finance/selectors';
import type { ExogenousReport, ExogenousRow, ExogenousStatus } from '../../../finance/types';

const STATUS_TONE: Record<ExogenousStatus, 'gray' | 'blue' | 'green'> = {
  'En preparación': 'gray',
  Validada: 'blue',
  Presentada: 'green',
};

export default function Exogena({ showToast }: { showToast: (text: string) => void }) {
  const { state, update } = useFinance();
  const report = state.exogenousReports[0] as ExogenousReport | undefined;
  const [presentOpen, setPresentOpen] = useState(false);
  const [typed, setTyped] = useState('');

  if (!report) {
    return (
      <Card>
        <SectionTitle title="Exógena y medios magnéticos" detail="No hay reportes configurados" />
        <div className="p-6 text-xs text-gray-500">Cree el reporte anual para iniciar la validación.</div>
      </Card>
    );
  }

  const issues = report.rows.reduce((total, row) => total + row.issues, 0);
  const thirdParties = report.rows.reduce((total, row) => total + row.thirdParties, 0);
  const total = report.rows.reduce((sum, row) => sum + row.total, 0);
  const isPresented = report.status === 'Presentada';

  function fixIssues(id: string) {
    update(draft => {
      const target = draft.exogenousReports.find(item => item.id === report?.id);
      const row = target?.rows.find(item => item.id === id);
      if (row) row.issues = 0;
    }, 'Incidencia de exógena corregida', 'facturacion');
    showToast('Incidencia corregida. El formato queda sin errores.');
  }

  function validate() {
    if (issues > 0) {
      showToast(`Quedan ${issues} incidencias por corregir antes de validar.`);
      return;
    }
    update(draft => {
      const target = draft.exogenousReports.find(item => item.id === report?.id);
      if (target) target.status = 'Validada';
    }, 'Exógena validada', 'facturacion');
    showToast('Exógena validada. Lista para presentar.');
  }

  function present() {
    const receipt = `EXO-${report?.year ?? ''}-${String(Math.floor(Math.random() * 900000) + 100000)}`;
    update(draft => {
      const target = draft.exogenousReports.find(item => item.id === report?.id);
      if (!target) return;
      target.status = 'Presentada';
      target.presentedAt = HOY;
      target.receipt = receipt;
    }, 'Exógena presentada', 'facturacion');
    setPresentOpen(false);
    setTyped('');
    showToast(`Exógena presentada. Acuse ${receipt}.`);
  }

  const columns: Column<ExogenousRow>[] = [
    {
      header: 'Formato',
      cell: row => (
        <div>
          <div className="font-mono text-[11px] font-semibold text-gray-800">{row.format}</div>
          <div className="text-[10px] text-gray-400">Medio magnético</div>
        </div>
      ),
    },
    { header: 'Concepto', cell: row => <span className="text-gray-700">{row.concept}</span> },
    { header: 'Terceros', align: 'right', cell: row => <span className="tabular">{row.thirdParties}</span> },
    { header: 'Valor reportado', align: 'right', cell: row => <Money value={row.total} /> },
    {
      header: 'Incidencias',
      align: 'center',
      cell: row => (
        row.issues === 0
          ? <Badge tone="green">Sin errores</Badge>
          : <Badge tone="red">{row.issues} por corregir</Badge>
      ),
    },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => (
        row.issues > 0
          ? <Button size="sm" onClick={() => fixIssues(row.id)} disabled={isPresented}>Corregir</Button>
          : <span className="text-[10px] text-gray-400">Validado</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Formatos" value={String(report.rows.length)} detail={`Ejercicio ${report.year}`} tone="cyan" />
        <KpiCard label="Terceros informados" value={String(thirdParties)} detail="Registros por formato" tone="blue" />
        <KpiCard label="Valor reportado" value={<Money value={total} />} detail="Suma de todos los formatos" tone="violet" />
        <KpiCard label="Incidencias" value={String(issues)} detail={issues === 0 ? 'Sin errores de validación' : 'Requieren corrección'} tone={issues > 0 ? 'red' : 'green'} />
      </div>

      <Card>
        <SectionTitle
          title="Exógena y medios magnéticos"
          detail={`Reporte anual ${report.year} · vence ${fmtDate(report.dueDate)}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[report.status]}>{report.status}</Badge>
              <Button onClick={validate} disabled={isPresented}>Validar exógena</Button>
              <Button variant="primary" onClick={() => { setPresentOpen(true); setTyped(''); }} disabled={isPresented || issues > 0}>
                Presentar exógena
              </Button>
            </div>
          }
        />
        <div className="p-4">
          <DataTable
            columns={columns}
            rows={report.rows}
            rowKey={row => row.id}
            empty="No hay formatos configurados para el reporte."
            footer={
              <span className="text-[11px] text-gray-500">
                {report.receipt
                  ? `Presentada el ${report.presentedAt} · acuse ${report.receipt}`
                  : 'La validación revisa terceros, bases y consistencia con los formularios del período.'}
              </span>
            }
          />
        </div>
      </Card>

      <Card>
        <SectionTitle title="Nota del reporte" detail="Contexto y pendientes" />
        <div className="space-y-3 p-4 text-xs text-gray-600">
          <p>{report.note}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-gray-400">Ejercicio</div>
              <div className="mt-1 font-semibold text-gray-900">{report.year}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-gray-400">Vencimiento</div>
              <div className="mt-1 font-semibold text-gray-900">{fmtDate(report.dueDate)}</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-gray-400">Acuse</div>
              <div className="mt-1 font-mono text-[11px] font-semibold text-gray-900">{report.receipt || 'Sin presentar'}</div>
            </div>
          </div>
        </div>
      </Card>

      {presentOpen && (
        <Modal
          title="Confirmar presentación de exógena"
          subtitle={`Ejercicio ${report.year} · ${report.rows.length} formatos`}
          onClose={() => setPresentOpen(false)}
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Se reportarán {thirdParties} terceros por un valor total de {money(total)}. La presentación
              es simulada y no transmite a la DIAN.
            </div>
            <Field label="Escriba EXOGENA para confirmar" hint="La confirmación escrita evita envíos accidentales.">
              <input className={`${INPUT} font-mono`} value={typed} onChange={event => setTyped(event.target.value)} placeholder="EXOGENA" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setPresentOpen(false)}>Cancelar</Button>
              <Button variant="primary" disabled={typed.trim() !== 'EXOGENA'} onClick={present}>
                <Icon name="check" className="h-3.5 w-3.5" /> Presentar exógena
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
