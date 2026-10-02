import { useEffect, useState } from 'react';
import { consultarDetallePorClave, type ClaveDocumento, type MovimientoDocumento } from '../api/documentos';
import type { NavPage } from '../components/Shell';

const fmtCOP = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 2,
}).format(value);

interface Props {
  /** Compañía activa: es parte obligatoria de la clave de consulta de MOV01. */
  cia: string;
  compania: { nombre: string; nit: string };
  /** Clave de la cabecera seleccionada en las pantallas de consulta. */
  clave: ClaveDocumento | null;
  onNavigate: (page: NavPage) => void;
}

export default function DocumentoOficial({ cia, compania, clave, onNavigate }: Props) {
  const [lineas, setLineas] = useState<MovimientoDocumento[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!clave) return;
    let vigente = true;
    setCargando(true);
    setError('');
    setLineas([]);
    consultarDetallePorClave(cia, clave)
      .then(items => { if (vigente) setLineas(items); })
      .catch((cause: unknown) => {
        if (vigente) setError(cause instanceof Error ? cause.message : 'No fue posible consultar el detalle en MOV01.');
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [cia, clave]);

  const debTotal = lineas.reduce((s, l) => s + l.debito, 0);
  const credTotal = lineas.reduce((s, l) => s + l.credito, 0);

  if (!clave) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <div className="bg-white rounded border border-gray-200 p-8 text-center text-xs text-gray-500">
          No hay un documento seleccionado. Abra el documento oficial desde una consulta de documentos.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <button onClick={() => onNavigate('consultas/documentos')} className="hover:text-gray-700">Consultas</button>
        <span>/</span>
        <span className="text-gray-800 font-medium">Documento {clave.documento}</span>
      </div>

      {/* Document header */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 flex items-start justify-between border-b border-gray-200" style={{ backgroundColor: '#EFFAFF' }}>
          <div>
            <div className="text-base font-bold text-gray-800">DOCUMENTO CONTABLE OFICIAL</div>
            <div className="text-xs text-gray-600 mt-0.5">{compania.nombre} — NIT {compania.nit}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold font-mono" style={{ color: '#001F4C' }}>{clave.comprobante}</div>
            <div className="text-xs text-gray-500 mt-0.5">{clave.documento}</div>
          </div>
        </div>

        <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-gray-100">
          {[
            ['Compañía', cia],
            ['Fecha', clave.fecha],
            ['Tipo documento', clave.tipoDocumento],
            ['Comprobante', clave.comprobante],
            ['Documento', clave.documento],
            ['Partidas', String(lineas.length)],
          ].map(([label, val]) => (
            <div key={String(label)}>
              <div className="text-xs text-gray-400 mb-0.5">{label}</div>
              <div className="text-xs font-medium text-gray-800">{val || '—'}</div>
            </div>
          ))}
        </div>

        {cargando && <div className="px-6 py-8 text-center text-xs text-gray-500">Consultando MOV01…</div>}
        {error && <div role="alert" className="px-6 py-4 text-sm text-red-700">{error}</div>}
        {!cargando && !error && lineas.length === 0 && (
          <div className="px-6 py-8 text-center text-xs text-gray-500">El documento no tiene partidas registradas en MOV01.</div>
        )}

        {/* Lines */}
        {!cargando && !error && lineas.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600 w-8">#</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Cuenta</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Nombre cuenta</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600">NIT</th>
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
                    <td className="px-4 py-2">
                      {l.centro ? (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">{l.centro}</span>
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
                  <td colSpan={5} className="px-4 py-2.5 font-bold text-gray-700 text-xs">TOTALES</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-800">{fmtCOP(debTotal)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-gray-800">{fmtCOP(credTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {!cargando && !error && lineas.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              Diferencia: <span className={`font-mono font-semibold ${debTotal === credTotal ? 'text-green-600' : 'text-red-600'}`}>
                {fmtCOP(Math.abs(debTotal - credTotal))}
              </span>
            </div>
            <span className={`text-xs font-medium ${debTotal === credTotal ? 'text-green-600' : 'text-red-600'}`}>
              {debTotal === credTotal ? 'Cuadrado' : 'Descuadrado'}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('consultas/mensual')} className="text-xs px-4 py-2 rounded font-medium text-white" style={{ backgroundColor: '#0073C0' }}>
          Ir a consulta mensual
        </button>
        <button onClick={() => onNavigate('informes/estados')} className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium">
          Balance de comprobación
        </button>
        <button onClick={() => window.print()} className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">
          Imprimir documento
        </button>
      </div>
    </div>
  );
}
