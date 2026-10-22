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
import type { AssetDisposal, FinanceState } from '../../../finance/types';
import type { AssetActions } from './shared';

export default function Bajas({
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
  const pending = state.disposals.filter(item => item.status === 'Solicitada' || item.status === 'Aprobada');
  const applied = state.disposals.filter(item => item.status === 'Aplicada');
  const retiredBookValue = applied.reduce((sum, item) => sum + item.netBookValue, 0);
  const result = applied.reduce((sum, item) => sum + item.gainLoss, 0);

  const columns: Column<AssetDisposal>[] = [
    {
      header: 'Activo',
      cell: row => {
        const asset = state.assets.find(item => item.id === row.assetId);
        return <div><div className="font-mono text-[10px] text-gray-400">{asset?.code ?? '—'}</div><div className="max-w-52 truncate font-medium text-gray-800">{asset?.name ?? 'Activo eliminado'}</div></div>;
      },
    },
    { header: 'Fecha', cell: row => fmtDate(row.date) },
    { header: 'Tipo', cell: row => <Badge tone={row.type === 'Venta' ? 'blue' : row.type === 'Obsolescencia' ? 'amber' : row.type === 'Pérdida' ? 'red' : 'gray'}>{row.type}</Badge> },
    { header: 'Valor en libros', align: 'right', cell: row => <Money value={row.netBookValue} /> },
    { header: 'Recuperación', align: 'right', cell: row => <Money value={row.proceeds} /> },
    { header: 'Resultado', align: 'right', cell: row => <Money value={row.gainLoss} className={row.gainLoss >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-600'} /> },
    { header: 'Soporte', cell: row => <span className="block max-w-28 truncate font-mono text-[10px] text-gray-500">{row.invoiceRef || '—'}</span> },
    { header: 'Estado', cell: row => <Badge tone={row.status === 'Aplicada' ? 'green' : row.status === 'Rechazada' ? 'red' : row.status === 'Aprobada' ? 'blue' : 'amber'}>{row.status}</Badge> },
    {
      header: 'Acciones',
      align: 'right',
      cell: row => (
        <div className="flex justify-end gap-1.5" onClick={event => event.stopPropagation()}>
          {row.status === 'Solicitada' && <Button size="sm" variant="primary" onClick={() => actions.approveDisposal(row.id)}>Aprobar</Button>}
          {row.status === 'Aprobada' && <Button size="sm" variant="success" onClick={() => actions.applyDisposal(row.id)}>Aplicar baja</Button>}
          {(row.status === 'Solicitada' || row.status === 'Aprobada') && <Button size="sm" variant="ghost" onClick={() => onReject(row.id)}>Rechazar</Button>}
          <Button size="sm" variant="ghost" onClick={() => onOpenAsset(row.assetId)}>Ver activo</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Solicitudes por gestionar" value={String(pending.length)} detail={`${pending.filter(item => item.status === 'Aprobada').length} aprobadas por aplicar`} tone="amber" />
        <KpiCard label="Valor retirado" value={money(retiredBookValue)} detail={`${applied.length} ${applied.length === 1 ? 'baja aplicada' : 'bajas aplicadas'}`} tone="blue" />
        <KpiCard label="Resultado de las bajas" value={money(result)} detail="Utilidad o pérdida acumulada" tone={result >= 0 ? 'green' : 'red'} />
        <KpiCard label="Activos vendidos" value={String(state.assets.filter(asset => asset.status === 'Vendido').length)} detail="Conservan ficha e histórico" />
      </div>

      <Card>
        <SectionTitle
          title="Bajas, ventas y retiros"
          detail="La solicitud se aprueba antes de afectar el mayor; al aplicarse, el activo conserva su histórico."
          action={<Button size="sm" variant="primary" onClick={onCreate}>Nueva baja</Button>}
        />
        <DataTable columns={columns} rows={[...state.disposals].sort((a, b) => b.date.localeCompare(a.date))} rowKey={row => row.id} onRowClick={row => onOpenAsset(row.assetId)} empty="No hay solicitudes de baja registradas." />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-xs font-semibold text-gray-700">Cálculo del resultado</h3>
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] leading-5 text-gray-600">
            <div>Valor en libros = costo + mejoras + revalorización − deterioro − depreciación acumulada.</div>
            <div className="mt-1">Resultado = valor de venta o recuperación − valor en libros.</div>
          </div>
          <ul className="mt-3 space-y-2 text-[11px] leading-4 text-gray-600">
            <li>Se debita la depreciación acumulada (1592) y el deterioro (1596).</li>
            <li>Se acredita el costo bruto del activo (15xx).</li>
            <li>Se debita bancos (1110) o cuentas por cobrar por la recuperación.</li>
            <li>La diferencia va a utilidad (4245) o pérdida (5395).</li>
          </ul>
        </Card>
        <Card className="p-4">
          <h3 className="text-xs font-semibold text-gray-700">Estados de la solicitud</h3>
          <div className="mt-3 space-y-2">
            {[
              { status: 'Solicitada', detail: 'Registrada por el responsable del activo con su justificación.' },
              { status: 'Aprobada', detail: 'Validada por el comité o la gerencia; aún no afecta el mayor.' },
              { status: 'Aplicada', detail: 'Genera los asientos de retiro y cambia el estado del activo.' },
              { status: 'Rechazada', detail: 'Se conserva la solicitud y el motivo del rechazo.' },
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
