import { EMPRESA, PERIODO, ALERTAS, LOTES_INICIALES, fmt, fmtCOP } from '../data/mock';
import type { NavPage } from '../components/Shell';
import type { Lote, AlertaContable } from '../types';

const ESTADO_COLORS: Record<string, string> = {
  'Borrador': 'bg-gray-100 text-gray-600',
  'Con errores': 'bg-red-100 text-red-700',
  'Verificado': 'bg-blue-100 text-blue-700',
  'Pendiente aprobación': 'bg-amber-100 text-amber-700',
  'Aprobado': 'bg-purple-100 text-purple-700',
  'Contabilizando': 'bg-blue-100 text-blue-700',
  'Contabilizado': 'bg-green-100 text-green-700',
  'Fallido': 'bg-red-100 text-red-700',
  'Anulado': 'bg-gray-100 text-gray-500',
};

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded border border-gray-200 px-4 py-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold tabular ${color || 'text-gray-800'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function AlertRow({ alerta, onAction }: { alerta: AlertaContable; onAction: (page: NavPage) => void }) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
      alerta.tipo === 'error' ? 'border-l-2 border-l-red-400' :
      alerta.tipo === 'warning' ? 'border-l-2 border-l-amber-400' :
      'border-l-2 border-l-blue-400'
    }`}>
      <span className={`text-sm mt-0.5 ${
        alerta.tipo === 'error' ? 'text-red-500' :
        alerta.tipo === 'warning' ? 'text-amber-500' :
        'text-blue-500'
      }`}>
        {alerta.tipo === 'error' ? '⚠' : alerta.tipo === 'warning' ? '⚠' : 'ℹ'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-700">{alerta.mensaje}</div>
        <div className="text-xs text-gray-400 mt-0.5">{alerta.fecha}</div>
      </div>
      {alerta.accion && (
        <button
          onClick={() => onAction(alerta.accion as NavPage)}
          className="shrink-0 text-xs px-2 py-1 rounded text-white transition-colors"
          style={{ backgroundColor: '#0073C0' }}
        >
          Ver
        </button>
      )}
    </div>
  );
}

function LoteCard({ lote, onOpen }: { lote: Lote; onOpen: () => void }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 transition-colors"
      onClick={onOpen}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-800">{lote.codigo}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ESTADO_COLORS[lote.estado] || 'bg-gray-100 text-gray-600'}`}>
            {lote.estado}
          </span>
          {lote.erroresCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
              {lote.erroresCount} error{lote.erroresCount !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5 truncate">{lote.nombre}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs tabular text-gray-600 font-medium">{fmtCOP(lote.debito)}</div>
        <div className="text-xs text-gray-400">{lote.lineasCount} líneas</div>
      </div>
    </div>
  );
}

interface DashboardProps {
  lotes: Lote[];
  onNavigate: (page: NavPage, params?: Record<string, string>) => void;
  onOpenLote: (id: string) => void;
}

export default function Dashboard({ lotes, onNavigate, onOpenLote }: DashboardProps) {
  const totalDebFeb = lotes
    .filter(l => l.periodo === '2026-02')
    .reduce((s, l) => s + l.debito, 0);

  const totalCredFeb = lotes
    .filter(l => l.periodo === '2026-02')
    .reduce((s, l) => s + l.credito, 0);

  const diff = totalDebFeb - totalCredFeb;

  const lotesActivos = lotes.filter(
    l => l.estado !== 'Contabilizado' && l.estado !== 'Anulado'
  );

  const estadosCount = Object.entries(
    lotes.reduce((acc, l) => {
      acc[l.estado] = (acc[l.estado] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  );

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      {/* Period banner */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded border text-sm"
        style={{ backgroundColor: '#EFFAFF', borderColor: '#C8F0FD', color: '#001F4C' }}
      >
        <span className="font-medium">{EMPRESA.codigo} — {EMPRESA.nombre}</span>
        <span className="text-gray-400">·</span>
        <span>Año {PERIODO.anio}</span>
        <span className="text-gray-400">·</span>
        <span className="font-medium">{PERIODO.nombre}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${PERIODO.estado === 'Abierto' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
        >
          Período {PERIODO.estado}
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <StatCard label="Débitos del período" value={fmtCOP(totalDebFeb)} sub="Febrero 2026" color="text-gray-800" />
        <StatCard label="Créditos del período" value={fmtCOP(totalCredFeb)} sub="Febrero 2026" color="text-gray-800" />
        <StatCard
          label="Diferencia"
          value={diff === 0 ? '$ 0' : fmtCOP(Math.abs(diff))}
          sub={diff === 0 ? 'Cuadrado' : 'Descuadrado'}
          color={diff === 0 ? 'text-green-600' : 'text-red-600'}
        />
        <StatCard label="Lotes activos" value={String(lotesActivos.length)} sub="Sin contabilizar" />
        <StatCard label="Alertas activas" value={String(ALERTAS.filter(a => a.tipo === 'error').length)} sub="Requieren acción" color="text-red-600" />
        <StatCard label="Documentos registrados" value={fmt(2840)} sub="En el período" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lotes activos */}
        <div className="lg:col-span-2 bg-white rounded border border-gray-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Lotes activos</h2>
              <p className="text-xs text-gray-400">Pendientes de verificar, aprobar o contabilizar</p>
            </div>
            <button
              onClick={() => onNavigate('movimientos/lotes')}
              className="text-xs font-medium hover:underline"
              style={{ color: '#0073C0' }}
            >
              Ver todos
            </button>
          </div>
          <div>
            {lotes.map(l => (
              <LoteCard key={l.id} lote={l} onOpen={() => onOpenLote(l.id)} />
            ))}
          </div>
          {/* Estado summary */}
          <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap gap-2">
            {estadosCount.map(([estado, count]) => (
              <span key={estado} className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLORS[estado] || 'bg-gray-100 text-gray-600'}`}>
                {count} {estado}
              </span>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Alertas */}
          <div className="bg-white rounded border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Alertas contables</h2>
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
                {ALERTAS.filter(a => a.tipo === 'error').length} urgentes
              </span>
            </div>
            <div>
              {ALERTAS.map(a => (
                <AlertRow key={a.id} alerta={a} onAction={onNavigate} />
              ))}
            </div>
          </div>

          {/* Accesos rápidos */}
          <div className="bg-white rounded border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Accesos rápidos</h2>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              {[
                { label: 'Captura directa', icon: '✎', page: 'movimientos/captura' as NavPage },
                { label: 'Nuevo lote', icon: '⊞', page: 'movimientos/lotes' as NavPage },
                { label: 'Anulación', icon: '⊘', page: 'movimientos/anulacion' as NavPage },
                { label: 'Plan de cuentas', icon: '≡', page: 'config/plan-cuentas' as NavPage },
                { label: 'Balance', icon: '⊟', page: 'informes/estados' as NavPage },
                { label: 'Auditoría', icon: '⊛', page: 'reprocesos' as NavPage },
              ].map(item => (
                <button
                  key={item.page}
                  onClick={() => onNavigate(item.page)}
                  className="flex items-center gap-2 px-3 py-2.5 text-xs font-medium rounded border border-gray-200 hover:border-petroleum-300 hover:bg-petroleum-50 transition-colors text-gray-700 hover:text-gray-900"
                  style={{ '--hover-border': '#00B0F2' } as React.CSSProperties}
                >
                  <span className="text-sm">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tareas pendientes */}
          <div className="bg-white rounded border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Tareas pendientes</h2>
            </div>
            <div className="divide-y divide-gray-50">
              {[
                { texto: 'Corregir errores en lote NOM2', prioridad: 'Alta', color: 'text-red-600' },
                { texto: 'Aprobar lote NO-001', prioridad: 'Media', color: 'text-amber-600' },
                { texto: 'Acumular retenciones febrero', prioridad: 'Media', color: 'text-amber-600' },
                { texto: 'Conciliar saldo banco 111005', prioridad: 'Baja', color: 'text-gray-500' },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color.includes('red') ? '#DC2626' : t.color.includes('amber') ? '#D97706' : '#9CA3AF' }} />
                  <span className="text-xs text-gray-700 flex-1">{t.texto}</span>
                  <span className={`text-xs font-medium ${t.color}`}>{t.prioridad}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
