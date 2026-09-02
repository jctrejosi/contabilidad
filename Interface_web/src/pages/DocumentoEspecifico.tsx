import { useMemo, useState } from 'react';
import { CUENTAS, MOVIMIENTOS_FEB, fmtCOP } from '../data/mock';
import type { MovimientoLinea } from '../types';

const INPUT = 'min-w-0 w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-800 outline-none transition focus:border-petroleum-500 focus:ring-2 focus:ring-petroleum-100';
const BUTTON_PRIMARY = 'rounded bg-petroleum-500 px-5 py-2 text-sm font-medium text-white hover:bg-petroleum-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleum-500';

interface Props {
  onOpenDocumento?: () => void;
}

/** Febrero real + complemento NOM2 + enero y marzo locales cuadrados para que la búsqueda cubra el año. */
function generarMovs(): MovimientoLinea[] {
  const out: MovimientoLinea[] = [...MOVIMIENTOS_FEB];
  let seq = 0;
  const nombreCuenta = (codigo: string) => CUENTAS.find(c => c.codigo === codigo)?.nombre ?? codigo;
  const add = (mes: number, dia: number, comprobante: string, tipoDoc: string, documento: string, cuenta: string, nit: string, tercero: string, centro: string, debito: number, credito: number, concepto: string, origen: string, lote: string, docAfectado = '') => {
    seq += 1;
    out.push({
      id: `G${String(seq).padStart(3, '0')}`,
      periodo: `2026-${String(mes).padStart(2, '0')}`,
      fecha: `2026-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
      comprobante, tipoDoc, documento, cuenta, nombreCuenta: nombreCuenta(cuenta),
      nit, tercero, centro, debito, credito, base: 0, clase: cuenta === '236540' ? 'RETFTE' : '', docAfectado, concepto, origen, lote,
    });
  };

  // Complemento NOM2 (febrero).
  add(2, 28, 'CE-000245', 'NOM', 'NOM-2026-02', '510506', '12.345.678', 'García Moreno Juan Pablo', 'ADM', 800000, 0, 'Prestaciones febrero ADM', 'Nómina', 'NOM2');
  add(2, 28, 'CE-000245', 'NOM', 'NOM-2026-02', '510506', '34.567.890', 'Martínez Rojas Ana Lucía', 'OPE', 600000, 0, 'Prestaciones febrero OPE', 'Nómina', 'NOM2');
  add(2, 28, 'CE-000245', 'NOM', 'NOM-2026-02', '510506', '12.345.678', 'García Moreno Juan Pablo', 'ADM', 1200000, 0, 'Aportes seguridad social feb', 'Nómina', 'NOM2');
  add(2, 28, 'CE-000245', 'NOM', 'NOM-2026-02', '250505', '12.345.678', 'García Moreno Juan Pablo', 'ADM', 0, 800000, 'Prestaciones por pagar feb ADM', 'Nómina', 'NOM2');
  add(2, 28, 'CE-000245', 'NOM', 'NOM-2026-02', '250505', '34.567.890', 'Martínez Rojas Ana Lucía', 'OPE', 0, 600000, 'Prestaciones por pagar feb OPE', 'Nómina', 'NOM2');
  add(2, 20, 'CE-000246', 'RB', 'RB-2026-006', '510506', '34.567.890', 'Martínez Rojas Ana Lucía', 'OPE', 390000, 0, 'Reembolso caja menor transporte', 'Manual', 'CE-001');
  add(2, 20, 'CE-000246', 'RB', 'RB-2026-006', '110505', '', '', '', 0, 390000, 'Reembolso caja menor', 'Manual', 'CE-001');

  // Enero.
  add(1, 8, 'CI-000143', 'FV', 'FV-2026-008', '111005', '800.100.200', 'Empresa ABC Comercial S.A.S.', '', 7500000, 0, 'Recaudo factura ventas', 'Manual', 'CI-003', 'FV-2025-140');
  add(1, 8, 'CI-000143', 'FV', 'FV-2026-008', '130505', '800.100.200', 'Empresa ABC Comercial S.A.S.', '', 0, 7500000, 'Recaudo factura ventas', 'Manual', 'CI-003', 'FV-2025-140');
  add(1, 20, 'CI-000144', 'FV', 'FV-2026-009', '111005', '900.200.300', 'Comercial XYZ Distribuciones Ltda.', '', 4500000, 0, 'Recaudo factura ventas', 'Manual', 'CI-003', 'FV-2025-141');
  add(1, 20, 'CI-000144', 'FV', 'FV-2026-009', '130505', '900.200.300', 'Comercial XYZ Distribuciones Ltda.', '', 0, 4500000, 'Recaudo factura ventas', 'Manual', 'CI-003', 'FV-2025-141');
  add(1, 15, 'CE-000241', 'OR', 'OR-2026-021', '111005', '860.050.010', 'Suministros Técnicos del Norte Ltda.', '', 0, 3200000, 'Pago proveedor materiales', 'Manual', 'CE-001');
  add(1, 15, 'CE-000241', 'OR', 'OR-2026-021', '130505', '860.050.010', 'Suministros Técnicos del Norte Ltda.', '', 3200000, 0, 'Pago proveedor materiales', 'Manual', 'CE-001');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '510506', '12.345.678', 'García Moreno Juan Pablo', 'ADM', 4500000, 0, 'Sueldo enero Administración', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '510506', '23.456.789', 'López Vargas María Fernanda', 'VEN', 3200000, 0, 'Sueldo enero Ventas', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '510506', '34.567.890', 'Martínez Rojas Ana Lucía', 'OPE', 2300000, 0, 'Sueldo enero Operaciones', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '510506', '12.345.678', 'García Moreno Juan Pablo', 'ADM', 1400000, 0, 'Prestaciones enero ADM', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '510506', '12.345.678', 'García Moreno Juan Pablo', 'ADM', 1200000, 0, 'Aportes seguridad social ene', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '250505', '12.345.678', 'García Moreno Juan Pablo', 'ADM', 0, 4500000, 'Obligación nómina ene ADM', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '250505', '23.456.789', 'López Vargas María Fernanda', 'VEN', 0, 3200000, 'Obligación nómina ene VEN', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '250505', '34.567.890', 'Martínez Rojas Ana Lucía', 'OPE', 0, 2300000, 'Obligación nómina ene OPE', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '250505', '12.345.678', 'García Moreno Juan Pablo', 'ADM', 0, 1400000, 'Prestaciones por pagar ene ADM', 'Nómina', 'NOM1');
  add(1, 28, 'CE-000242', 'NOM', 'NOM-2026-01', '236540', '', '', '', 0, 1200000, 'Retención nómina enero', 'Nómina', 'NOM1');
  add(1, 31, 'NO-000087', 'NO', 'NO-2026-087', '250505', '', '', '', 10000000, 0, 'Pago nómina enero', 'Manual', 'NO-001');
  add(1, 31, 'NO-000087', 'NO', 'NO-2026-087', '111005', '', '', '', 0, 10000000, 'Pago nómina enero', 'Manual', 'NO-001');
  add(1, 31, 'NO-000088', 'NO', 'NO-2026-088', '236540', '', '', '', 1200000, 0, 'Pago retención enero', 'Manual', 'NO-001');
  add(1, 31, 'NO-000088', 'NO', 'NO-2026-088', '111005', '', '', '', 0, 1200000, 'Pago retención enero', 'Manual', 'NO-001');
  add(1, 22, 'CE-000241', 'RB', 'RB-2026-005', '510506', '34.567.890', 'Martínez Rojas Ana Lucía', 'OPE', 390000, 0, 'Reembolso caja menor', 'Manual', 'CE-001');
  add(1, 22, 'CE-000241', 'RB', 'RB-2026-005', '110505', '', '', '', 0, 390000, 'Reembolso caja menor', 'Manual', 'CE-001');

  // Marzo (muestra).
  add(3, 5, 'CI-000147', 'FV', 'FV-2026-013', '111005', '900.200.300', 'Comercial XYZ Distribuciones Ltda.', '', 7400000, 0, 'Recaudo factura ventas', 'Manual', 'CI-003', 'FV-2026-012');
  add(3, 5, 'CI-000147', 'FV', 'FV-2026-013', '130505', '900.200.300', 'Comercial XYZ Distribuciones Ltda.', '', 0, 7400000, 'Recaudo factura ventas', 'Manual', 'CI-003', 'FV-2026-012');

  return out;
}

export default function DocumentoEspecifico({ onOpenDocumento }: Props) {
  const [docPropio, setDocPropio] = useState('');
  const [docAfectado, setDocAfectado] = useState('');
  const [periodo, setPeriodo] = useState('2026-02');
  const [expandido, setExpandido] = useState<string | null>(null);

  const movs = useMemo(generarMovs, []);

  const qPropio = docPropio.trim().toLowerCase();
  const qAfectado = docAfectado.trim().toLowerCase();

  const coincidentes = movs.filter(m => {
    if (periodo && m.periodo !== periodo) return false;
    if (qPropio && !m.documento.toLowerCase().includes(qPropio)) return false;
    if (qAfectado && !m.docAfectado.toLowerCase().includes(qAfectado)) return false;
    return qPropio || qAfectado;
  });

  const documentos = Array.from(new Map(coincidentes.map(m => [m.documento, m])).values());

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 text-xs text-gray-400">Consultas / Documento específico</div>
          <h1 className="text-lg font-semibold text-gray-800">Documento específico</h1>
          <p className="mt-1 text-xs text-gray-500">Consulta de un documento por número propio o por documento afectado, con acceso al documento oficial.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-petroleum-100 bg-petroleum-50 px-3 py-1 text-xs font-medium text-petroleum-700">Datos de demostración</span>
          <button type="button" onClick={() => window.print()} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">⎙ Imprimir</button>
        </div>
      </div>

      <div className="bg-white rounded border border-gray-200 p-3">
        <fieldset className="rounded-md border border-gray-200 px-3 pb-3">
          <legend className="px-2 text-xs font-semibold text-petroleum-800">Búsqueda</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Documento propio</label>
              <input value={docPropio} onChange={e => setDocPropio(e.target.value)} placeholder="NOM-2026-02, FV-2026-001…" className={`${INPUT} font-mono`} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Documento afectado</label>
              <input value={docAfectado} onChange={e => setDocAfectado(e.target.value)} placeholder="FV-2025-145…" className={`${INPUT} font-mono`} />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-600">Período</label>
              <input type="month" value={periodo} onChange={e => setPeriodo(e.target.value)} className={INPUT} />
            </div>
            <div className="flex items-end">
              <button type="button" onClick={() => setExpandido(null)} className={BUTTON_PRIMARY + ' w-full'}>
                Buscar
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Escriba un número de documento propio o afectado. Ejemplos: NOM-2026-01, OR-2026-023, FV-2025-145.
          </p>
        </fieldset>
      </div>

      {documentos.length === 0 ? (
        <div className="bg-white rounded border border-gray-200 px-4 py-10 text-center">
          <div className="text-2xl mb-2 text-gray-300">⊟</div>
          <div className="text-xs text-gray-500">Sin resultados — ningún documento coincide con la búsqueda en el período seleccionado.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {documentos.map(d => {
            const lineas = coincidentes.filter(m => m.documento === d.documento);
            const totalDeb = lineas.reduce((s, l) => s + l.debito, 0);
            const totalCred = lineas.reduce((s, l) => s + l.credito, 0);
            const abierto = expandido === d.documento;
            const cuadrado = totalDeb === totalCred;
            return (
              <div key={d.documento} className="bg-white rounded border border-gray-200 overflow-hidden">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 border-b border-gray-100">
                  <div>
                    <div className="font-mono font-bold text-gray-800">{d.documento}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{d.comprobante} · {d.fecha}</div>
                  </div>
                  <div className="text-xs text-gray-600 max-w-56 truncate">{d.tercero || 'Sin tercero'}</div>
                  {d.docAfectado && (
                    <div className="text-xs text-gray-500">Afecta: <span className="font-mono">{d.docAfectado}</span></div>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cuadrado ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {cuadrado ? 'Cuadrada' : 'Descuadrada'}
                  </span>
                  <div className="ml-auto flex items-center gap-3">
                    <button type="button" onClick={() => setExpandido(abierto ? null : d.documento)} className="text-xs text-petroleum-600 hover:underline">
                      {abierto ? 'Ocultar líneas' : `Ver ${lineas.length} líneas`}
                    </button>
                    <button type="button" onClick={onOpenDocumento} className={BUTTON_PRIMARY + ' px-3! py-1.5! text-xs'}>
                      Documento oficial →
                    </button>
                  </div>
                </div>
                {abierto && (
                  <div className="table-fixed-header overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Fecha</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Comprobante</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Cuenta</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre cuenta</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Tercero</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Centro</th>
                          <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Débito</th>
                          <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Crédito</th>
                          <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Concepto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {lineas.map(l => (
                          <tr key={l.id} className="hoverable">
                            <td className="px-3 py-2 font-mono text-gray-600">{l.fecha}</td>
                            <td className="px-3 py-2 font-mono text-gray-700">{l.comprobante}</td>
                            <td className="px-3 py-2 font-mono text-gray-700">{l.cuenta}</td>
                            <td className="px-3 py-2 text-gray-600">{l.nombreCuenta}</td>
                            <td className="px-3 py-2 text-gray-600 max-w-44 truncate">{l.tercero || <span className="text-gray-300">—</span>}</td>
                            <td className="px-3 py-2 text-gray-600">{l.centro || <span className="text-gray-300">—</span>}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-800">{l.debito > 0 ? fmtCOP(l.debito) : <span className="text-gray-200">—</span>}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-500">{l.credito > 0 ? fmtCOP(l.credito) : <span className="text-gray-200">—</span>}</td>
                            <td className="px-3 py-2 text-gray-500">{l.concepto}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex items-center gap-6 px-4 py-2.5 bg-gray-50 border-t border-gray-200">
                  <span className="text-xs text-gray-500">Total débitos: <span className="font-mono font-semibold text-gray-800">{fmtCOP(totalDeb)}</span></span>
                  <span className="text-xs text-gray-500">Total créditos: <span className="font-mono font-semibold text-gray-800">{fmtCOP(totalCred)}</span></span>
                  <span className={`text-xs font-mono font-semibold ${cuadrado ? 'text-green-600' : 'text-red-600'}`}>
                    Diferencia: {fmtCOP(Math.abs(totalDeb - totalCred))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
