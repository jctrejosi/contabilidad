import { MOVIMIENTOS_FEB, fmtCOP, EMPRESA, PERIODO } from '../data/mock';
import type { NavPage } from '../components/Shell';

interface Props {
  onNavigate: (page: NavPage) => void;
}

export default function DocumentoOficial({ onNavigate }: Props) {
  const lineas = MOVIMIENTOS_FEB.filter(m => m.documento === 'NOM-2026-02');
  const debTotal = lineas.reduce((s, l) => s + l.debito, 0);
  const credTotal = lineas.reduce((s, l) => s + l.credito, 0);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <button onClick={() => onNavigate('movimientos/lotes')} className="hover:text-gray-700">Lotes</button>
        <span>/</span>
        <span>NOM2</span>
        <span>/</span>
        <span className="text-gray-800 font-medium">Documento NOM-2026-02</span>
      </div>

      {/* Document header */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 flex items-start justify-between border-b border-gray-200" style={{ backgroundColor: '#EFFAFF' }}>
          <div>
            <div className="text-base font-bold text-gray-800">DOCUMENTO CONTABLE OFICIAL</div>
            <div className="text-xs text-gray-600 mt-0.5">{EMPRESA.nombre} — NIT {EMPRESA.nit}-{EMPRESA.digito}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold font-mono" style={{ color: '#001F4C' }}>CE-000245</div>
            <div className="text-xs text-gray-500 mt-0.5">NOM-2026-02</div>
          </div>
        </div>

        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-100">
          {[
            ['Período', PERIODO.nombre],
            ['Fecha', '28 de febrero de 2026'],
            ['Tipo documento', 'Nómina (NOM)'],
            ['Estado', 'Contabilizado'],
            ['Origen', 'Lote NOM2'],
            ['Registrado por', 'Laura Gómez'],
            ['Fecha registro', `${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`],
            ['Año contable', '2026'],
          ].map(([label, val]) => (
            <div key={String(label)}>
              <div className="text-xs text-gray-400 mb-0.5">{label}</div>
              <div className={`text-xs font-medium ${String(label) === 'Estado' ? 'text-green-700' : 'text-gray-800'}`}>{val}</div>
            </div>
          ))}
        </div>

        {/* Lines */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600 w-8">#</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Cuenta</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Nombre cuenta</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600">NIT</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Tercero</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Centro</th>
                <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Débito</th>
                <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Crédito</th>
                <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Concepto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lineas.map((l, idx) => (
                <tr key={l.id} className="hoverable">
                  <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-2 font-mono text-gray-700 font-medium">{l.cuenta}</td>
                  <td className="px-4 py-2 text-gray-600">{l.nombreCuenta}</td>
                  <td className="px-4 py-2 font-mono text-gray-500">{l.nit || '—'}</td>
                  <td className="px-4 py-2 text-gray-600 max-w-44 truncate">{l.tercero || '—'}</td>
                  <td className="px-4 py-2">
                    {l.centro ? (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        l.centro === 'ADM' ? 'bg-blue-50 text-blue-700' :
                        l.centro === 'VEN' ? 'bg-green-50 text-green-700' :
                        'bg-amber-50 text-amber-700'
                      }`}>{l.centro}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-medium text-gray-800">
                    {l.debito > 0 ? fmtCOP(l.debito) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-gray-500">
                    {l.credito > 0 ? fmtCOP(l.credito) : '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{l.concepto}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td colSpan={6} className="px-4 py-2.5 font-bold text-gray-700 text-xs">TOTALES</td>
                <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-800">{fmtCOP(debTotal)}</td>
                <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-800">{fmtCOP(credTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="text-xs text-gray-400">
            Diferencia: <span className={`font-mono font-semibold ${debTotal === credTotal ? 'text-green-600' : 'text-red-600'}`}>
              {fmtCOP(Math.abs(debTotal - credTotal))}
            </span>
          </div>
          <span className="text-xs font-medium text-green-600">✓ Cuadrado y contabilizado</span>
        </div>
      </div>

      {/* Audit trail */}
      <div className="bg-white rounded border border-gray-200 p-4">
        <h3 className="text-xs font-semibold text-gray-700 mb-3">Trazabilidad del documento</h3>
        <div className="space-y-3">
          {[
            { accion: 'Lote creado', usuario: 'Laura Gómez', fecha: '2026-02-28 09:15', tipo: 'info' },
            { accion: 'Errores detectados (2)', usuario: 'Sistema', fecha: '2026-02-28 09:16', tipo: 'error' },
            { accion: 'Error corregido: tercero asignado', usuario: 'Laura Gómez', fecha: '2026-02-28 10:30', tipo: 'success' },
            { accion: 'Error corregido: centro asignado', usuario: 'Laura Gómez', fecha: '2026-02-28 10:32', tipo: 'success' },
            { accion: 'Lote verificado', usuario: 'Laura Gómez', fecha: '2026-02-28 10:33', tipo: 'info' },
            { accion: 'Enviado a aprobación', usuario: 'Laura Gómez', fecha: '2026-02-28 10:34', tipo: 'info' },
            { accion: 'Aprobado', usuario: 'Laura Gómez', fecha: '2026-02-28 10:35', tipo: 'success' },
            { accion: 'Contabilizado exitosamente', usuario: 'Sistema', fecha: '2026-02-28 10:35', tipo: 'success' },
          ].map((evt, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                evt.tipo === 'success' ? 'bg-green-500' : evt.tipo === 'error' ? 'bg-red-500' : 'bg-blue-400'
              }`} />
              <div className="flex-1 flex items-center justify-between text-xs">
                <span className="text-gray-700">{evt.accion}</span>
                <div className="flex items-center gap-3 text-gray-400 shrink-0">
                  <span>{evt.usuario}</span>
                  <span className="font-mono">{evt.fecha}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('consultas/mensual')} className="text-xs px-4 py-2 rounded font-medium text-white" style={{ backgroundColor: '#0073C0' }}>
          → Ir a consulta mensual
        </button>
        <button onClick={() => onNavigate('informes/estados')} className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium">
          Balance de comprobación
        </button>
        <button className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">
          ⎙ Imprimir documento
        </button>
      </div>
    </div>
  );
}
