import {
  Badge,
  Button,
  Card,
  DataTable,
  KpiCard,
  Money,
  SectionTitle,
  type Column,
} from '../../../components/finance/ui';
import { fmtDate, money } from '../../../finance/selectors';
import type { AssetRevaluation, FinanceState } from '../../../finance/types';
import type { AssetActions } from './shared';

export default function Revalorizaciones({
  state,
  actions,
  onCreate,
  onReject,
  onOpenAsset,
}: {
  state: FinanceState;
  actions: AssetActions;
  onCreate: () => void;
  onReject: (id: string) => void;
  onOpenAsset: (id: string) => void;
}) {
  const applied = state.revaluations.filter(item => item.status === 'Aplicada');
  const pending = state.revaluations.filter(item => item.status === 'Borrador' || item.status === 'Aprobada');
  const pendingSurplus = pending.reduce((sum, item) => sum + item.surplus, 0);
  const appliedSurplus = applied.reduce((sum, item) => sum + item.surplus, 0);

  const columns: Column<AssetRevaluation>[] = [
    {
      header: 'Activo',
      cell: row => {
        const asset = state.assets.find(item => item.id === row.assetId);
        return <div><div className="font-mono text-[10px] text-gray-400">{asset?.code ?? '—'}</div><div className="max-w-52 truncate font-medium text-gray-800">{asset?.name ?? 'Activo eliminado'}</div></div>;
      },
    },
    { header: 'Fecha', cell: row => fmtDate(row.date) },
    { header: 'Valor anterior', align: 'right', cell: row => <Money value={row.previousValue} /> },
    { header: 'Valor nuevo', align: 'right', cell: row => <Money value={row.newValue} /> },
    { header: 'Superávit', align: 'right', cell: row => <Money value={row.surplus} className={row.surplus >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-600'} /> },
    { header: 'Perito / informe', cell: row => <div><div className="max-w-40 truncate text-gray-600">{row.appraiser}</div><div className="font-mono text-[10px] text-gray-400">{row.report}</div></div> },
    { header: 'Estado', cell: row => <Badge tone={row.status === 'Aplicada' ? 'green' : row.status === 'Rechazada' ? 'red' : row.status === 'Aprobada' ? 'blue' : 'amber'}>{row.status}</Badge> },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => (
        <div className="flex justify-end gap-1.5" onClick={event => event.stopPropagation()}>
          {row.status === 'Borrador' && <Button size="sm" variant="primary" onClick={() => actions.approveRevaluation(row.id)}>Aprobar</Button>}
          {row.status === 'Aprobada' && <Button size="sm" variant="success" onClick={() => actions.applyRevaluation(row.id)}>Aplicar</Button>}
          {(row.status === 'Borrador' || row.status === 'Aprobada') && <Button size="sm" variant="ghost" onClick={() => onReject(row.id)}>Rechazar</Button>}
          <Button size="sm" variant="ghost" onClick={() => onOpenAsset(row.assetId)}>Ver activo</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Superávit aplicado" value={money(appliedSurplus)} detail={`${applied.length} ${applied.length === 1 ? 'avalúo' : 'avalúos'} en el patrimonio`} tone="violet" />
        <KpiCard label="Superávit pendiente" value={money(pendingSurplus)} detail={`${pending.length} ${pending.length === 1 ? 'revalorización' : 'revalorizaciones'} por aplicar`} tone="amber" />
        <KpiCard label="Avalúos del periodo" value={String(state.revaluations.filter(item => item.date.startsWith('2026')).length)} detail="Informes recibidos en 2026" tone="blue" />
        <KpiCard label="Cuenta patrimonial" value="3805" detail="Superávit por revalorización" />
      </div>

      <Card>
        <SectionTitle
          title="Revalorizaciones de propiedades, planta y equipo"
          detail="El superávit se registra en otro resultado integral; no afecta el resultado del ejercicio."
          action={<Button size="sm" variant="primary" onClick={onCreate}>Nueva revalorización</Button>}
        />
        <DataTable columns={columns} rows={[...state.revaluations].sort((a, b) => b.date.localeCompare(a.date))} rowKey={row => row.id} onRowClick={row => onOpenAsset(row.assetId)} empty="No hay revalorizaciones registradas." />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-xs font-semibold text-gray-700">Tratamiento contable</h3>
          <ul className="mt-3 space-y-2 text-[11px] leading-4 text-gray-600">
            <li>El valor nuevo se compara contra el valor en libros actual del activo.</li>
            <li>Si el valor aumenta, el superávit se abona a la cuenta 3805 (patrimonio).</li>
            <li>Si el valor disminuye y no existía superávit previo, el déficit se lleva a resultados.</li>
            <li>La depreciación futura se recalcula sobre el nuevo valor menos el residual y los meses restantes.</li>
            <li>Aplicar una revalorización genera un movimiento con débito al activo y crédito al patrimonio.</li>
          </ul>
        </Card>
        <Card className="p-4">
          <h3 className="text-xs font-semibold text-gray-700">Flujo de aprobación</h3>
          <div className="mt-3 space-y-2">
            {[
              { status: 'Borrador', detail: 'Registro del avalúo y del perito; aún no afecta el mayor.' },
              { status: 'Aprobada', detail: 'El comité aprueba el avalúo; queda pendiente de aplicación.' },
              { status: 'Aplicada', detail: 'Se actualiza el activo, se genera el asiento y se recalcula la depreciación.' },
              { status: 'Rechazada', detail: 'Se conserva la trazabilidad y el motivo del rechazo.' },
            ].map(step => (
              <div key={step.status} className="flex items-start gap-2 text-[11px]">
                <Badge tone={step.status === 'Aplicada' ? 'green' : step.status === 'Rechazada' ? 'red' : step.status === 'Aprobada' ? 'blue' : 'amber'}>{step.status}</Badge>
                <span className="text-gray-600">{step.detail}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
